import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../../src/common/errors";
import { productHistoryQuerySchema } from "../../src/contracts/inventory/inventory.contract";
import { InventoryService } from "../../src/services/inventoryService";

test("getLowStock returns low-stock items from repository", async () => {
  const expected = [
    { productId: 1, sku: "RAU-001", name: "Cà chua", quantityInStock: 10, minStock: 20 },
  ];
  const service = new InventoryService({
    async findLowStock() {
      return expected;
    },
    async productExists() {
      return true;
    },
    async findProductHistory() {
      return { items: [], totalItems: 0 };
    },
  });

  const result = await service.getLowStock();
  assert.deepEqual(result, expected);
});

test("getProductHistory throws 404 when product does not exist", async () => {
  const service = new InventoryService({
    async findLowStock() {
      return [];
    },
    async productExists() {
      return false;
    },
    async findProductHistory() {
      throw new Error("Should not query history for missing product");
    },
  });

  await assert.rejects(
    () => service.getProductHistory(999, { page: 1, pageSize: 20 }),
    (error: unknown) => error instanceof AppError && error.status === 404,
  );
});

test("getProductHistory returns paginated history when product exists", async () => {
  const historyItems = [
    {
      documentType: "ISSUE" as const,
      documentId: 2,
      documentCode: "PX-20261123-001",
      direction: "OUT" as const,
      quantity: 5,
      confirmedAt: "2026-11-23T10:45:00.000Z",
      createdBy: 3,
      createdByName: "Trần Thị Bình",
    },
    {
      documentType: "RECEIPT" as const,
      documentId: 1,
      documentCode: "PN-20261120-001",
      direction: "IN" as const,
      quantity: 20,
      confirmedAt: "2026-11-20T01:30:00.000Z",
      createdBy: 1,
      createdByName: "Quản trị viên",
    },
  ];

  let capturedArgs: [number, number, number] | undefined;
  const service = new InventoryService({
    async findLowStock() {
      return [];
    },
    async productExists(id) {
      return id === 7;
    },
    async findProductHistory(productId, page, pageSize) {
      capturedArgs = [productId, page, pageSize];
      return { items: historyItems, totalItems: 5 };
    },
  });

  const result = await service.getProductHistory(7, { page: 2, pageSize: 2 });
  assert.deepEqual(capturedArgs, [7, 2, 2]);
  assert.deepEqual(result, {
    page: 2,
    pageSize: 2,
    totalItems: 5,
    totalPages: 3,
    items: historyItems,
  });
});

test("productHistoryQuerySchema applies defaults and rejects invalid bounds", () => {
  assert.deepEqual(productHistoryQuerySchema.parse({}), { page: 1, pageSize: 20 });
  assert.throws(() => productHistoryQuerySchema.parse({ page: 0 }));
  assert.throws(() => productHistoryQuerySchema.parse({ pageSize: 101 }));
});
