import assert from "node:assert/strict";
import test from "node:test";

import type { Issue } from "../../src/contracts/issues/issue.contract";
import type { IssueRepository } from "../../src/repo/issueRepo";
import { DocumentNumberService } from "../../src/services/documentNumberService";
import { AppError } from "../../src/common/errors";
import { IssueService } from "../../src/services/issueService";

const staff = { id: 10, email: "staff@freshmart.local", role: "STAFF" as const };

function createDraftIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 1,
    code: "PX-20261122-001",
    reason: "SALE",
    status: "DRAFT",
    createdBy: 10,
    createdByName: "Staff",
    createdAt: "2026-11-22T10:00:00.000Z",
    finalizedBy: null,
    finalizedByName: null,
    finalizedAt: null,
    items: [{ id: 1, productId: 7, productName: "Milk", quantity: 50 }],
    ...overrides,
  };
}

function createService(issue: Issue, decreaseStock: () => Promise<void> = async () => {}): IssueService {
  const repository: IssueRepository = {
    async findProductsByIds() { return []; },
    async createDraft() { return issue; },
    async findById() { return issue; },
    async findAll() { return []; },
    async transaction(work) {
      return work({
        async findByIdForUpdate() { return issue; },
        async findProductsByIds() { return [{ id: 7, name: "Milk", isActive: true }]; },
        async replaceDraft() { return issue; },
        async lockProductsByIds() {
          return [{ id: 7, name: "Milk", isActive: true, quantityInStock: 32, minStock: 5 }];
        },
        decreaseStock,
        async finalize() { return issue; },
        async findLowStockByIds() { return []; },
      });
    },
  };

  const numberService = new DocumentNumberService({ async reserveNextSequence() { return 1; } });
  return new IssueService(repository, numberService);
}

test("does not decrease any stock when an issue has a shortage", async () => {
  let decrements = 0;
  const service = createService(createDraftIssue(), async () => { decrements += 1; });

  await assert.rejects(
    () => service.confirm(1, staff),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 409);
      assert.deepEqual(error.data, {
        shortages: [{ productId: 7, productName: "Milk", requested: 50, available: 32 }],
      });
      return true;
    },
  );
  assert.equal(decrements, 0);
});

test("prevents STAFF from confirming a DAMAGED issue", async () => {
  const service = createService(createDraftIssue({ reason: "DAMAGED" }));

  await assert.rejects(
    () => service.confirm(1, staff),
    (error: unknown) => error instanceof AppError && error.status === 403,
  );
});

test("reports only products that newly reach or cross the low-stock threshold", async () => {
  const issue = createDraftIssue({
    items: [
      { id: 1, productId: 1, productName: "At threshold", quantity: 5 },
      { id: 2, productId: 2, productName: "Already low", quantity: 1 },
      { id: 3, productId: 3, productName: "Still above", quantity: 2 },
      { id: 4, productId: 4, productName: "Below threshold", quantity: 7 },
    ],
  });
  const products = [
    { id: 1, name: "At threshold", isActive: true, quantityInStock: 10, minStock: 5 },
    { id: 2, name: "Already low", isActive: true, quantityInStock: 5, minStock: 5 },
    { id: 3, name: "Still above", isActive: true, quantityInStock: 10, minStock: 5 },
    { id: 4, name: "Below threshold", isActive: true, quantityInStock: 10, minStock: 5 },
  ];
  const stocks = new Map(products.map((product) => [product.id, product.quantityInStock]));
  let checkedIds: number[] = [];
  const repository: IssueRepository = {
    async findProductsByIds() { return []; },
    async createDraft() { return issue; },
    async findById() { return issue; },
    async findAll() { return []; },
    async transaction(work) {
      return work({
        async findByIdForUpdate() { return issue; },
        async findProductsByIds() { return products; },
        async replaceDraft() { return issue; },
        async lockProductsByIds() { return products; },
        async decreaseStock(id, quantity) { stocks.set(id, stocks.get(id)! - quantity); },
        async finalize() { return { ...issue, status: "CONFIRMED" }; },
        async findLowStockByIds(ids) {
          checkedIds = ids;
          return products
            .filter((product) => ids.includes(product.id) && stocks.get(product.id)! <= product.minStock)
            .map((product) => ({
              productId: product.id, sku: `SKU-${product.id}`, name: product.name,
              quantityInStock: stocks.get(product.id)!, minStock: product.minStock,
            }));
        },
      });
    },
  };
  const numberService = new DocumentNumberService({ async reserveNextSequence() { return 1; } });

  const result = await new IssueService(repository, numberService).confirm(1, staff);

  assert.deepEqual(checkedIds, [1, 3, 4]);
  assert.deepEqual(result.lowStockProducts.map((product) => [product.productId, product.quantityInStock]), [[1, 5], [4, 3]]);
});

test("locks issue before checking update products and replacing details", async () => {
  const issue = createDraftIssue();
  const events: string[] = [];
  const repository: IssueRepository = {
    async findProductsByIds() { throw new Error("Expected transaction client"); },
    async createDraft() { return issue; },
    async findById() { throw new Error("Expected locked read"); },
    async findAll() { return []; },
    async transaction(work) {
      events.push("begin");
      return work({
        async findByIdForUpdate() { events.push("lock"); return issue; },
        async findProductsByIds() { events.push("products"); return [{ id: 7, name: "Milk", isActive: true }]; },
        async replaceDraft() { events.push("replace"); return issue; },
        async lockProductsByIds() { return []; },
        async decreaseStock() {},
        async finalize() { return issue; },
        async findLowStockByIds() { return []; },
      });
    },
  };
  const numbers = new DocumentNumberService({ async reserveNextSequence() { return 1; } });
  await new IssueService(repository, numbers).update(1, { reason: "SALE", items: [{ productId: 7, quantity: 1 }] }, staff);
  assert.deepEqual(events, ["begin", "lock", "products", "replace"]);
});
