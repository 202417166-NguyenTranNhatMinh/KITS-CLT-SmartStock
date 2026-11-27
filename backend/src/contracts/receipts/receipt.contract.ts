import { z } from "zod";

import type { DocumentStatus } from "../common/enums.contract";

const positiveIdSchema = z.number().int().positive();

export const receiptItemRequestSchema = z.object({
  productId: positiveIdSchema,
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});

export const receiptRequestSchema = z
  .object({
    supplierId: positiveIdSchema,
    note: z.string().trim().max(500).optional(),
    items: z.array(receiptItemRequestSchema).min(1),
  })
  .superRefine((value, ctx) => {
    const duplicateProductId = value.items.find(
      (item, index) => value.items.findIndex(({ productId }) => productId === item.productId) !== index,
    )?.productId;

    if (duplicateProductId !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: `Product ${duplicateProductId} appears more than once`,
      });
    }
  });

export type ReceiptItemRequest = z.infer<typeof receiptItemRequestSchema>;
export type ReceiptRequest = z.infer<typeof receiptRequestSchema>;

export type ReceiptItem = ReceiptItemRequest & {
  id: number;
  productName: string;
};

export type Receipt = {
  id: number;
  code: string;
  supplierId: number;
  supplierName: string;
  status: DocumentStatus;
  note?: string;
  createdBy: number;
  createdByName: string;
  createdAt: string;
  finalizedBy: number | null;
  finalizedByName: string | null;
  finalizedAt: string | null;
  totalAmount: number;
  items: ReceiptItem[];
};

