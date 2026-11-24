import assert from "node:assert/strict";
import test from "node:test";

import type { Receipt } from "../../src/contracts/receipts/receipt.contract";
import type { ReceiptRepository } from "../../src/repo/receiptRepo";
import { DocumentNumberService } from "../../src/services/documentNumberService";
import { AppError } from "../../src/common/errors";
import { ReceiptService } from "../../src/services/receiptService";

const staff = { id: 10, email: "staff@freshmart.local", role: "STAFF" as const };

function createReceipt(status: Receipt["status"], createdBy = 10): Receipt {
  return {
    id: 1,
    code: "PN-20261122-001",
    supplierId: 1,
    supplierName: "Supplier",
    status,
    createdBy,
    createdByName: "Staff",
    createdAt: "2026-11-22T10:00:00.000Z",
    finalizedBy: null,
    finalizedAt: null,
    totalAmount: 100,
    items: [{ id: 1, productId: 7, productName: "Milk", quantity: 2, unitPrice: 50 }],
  };
}

function createService(receipt: Receipt): ReceiptService {
  const repository: ReceiptRepository = {
    async findSupplierById() { return { id: 1, name: "Supplier" }; },
    async findProductsByIds() { return []; },
    async createDraft() { return receipt; },
    async findById() { return receipt; },
    async replaceDraft() { return receipt; },
    async findAll() { return []; },
    async transaction(work) {
      return work({
        async findByIdForUpdate() { return receipt; },
        async increaseStock() {},
        async finalize() { return receipt; },
      });
    },
  };
  const numberService = new DocumentNumberService({ async reserveNextSequence() { return 1; } });
  return new ReceiptService(repository, numberService);
}

test("rejects confirmation for a receipt that is not DRAFT", async () => {
  const service = createService(createReceipt("CONFIRMED"));

  await assert.rejects(
    () => service.confirm(1, staff),
    (error: unknown) => error instanceof AppError && error.status === 409,
  );
});

test("rejects a STAFF member managing another member's receipt", async () => {
  const service = createService(createReceipt("DRAFT", 20));

  await assert.rejects(
    () => service.cancel(1, staff),
    (error: unknown) => error instanceof AppError && error.status === 403,
  );
});
