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
    async replaceDraft() { return issue; },
    async findAll() { return []; },
    async transaction(work) {
      return work({
        async findByIdForUpdate() { return issue; },
        async lockProductsByIds() {
          return [{ id: 7, name: "Milk", isActive: true, quantityInStock: 32 }];
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
