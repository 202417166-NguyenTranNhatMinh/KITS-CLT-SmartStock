import { z } from "zod";

import { issueReasonSchema, type DocumentStatus } from "../common/enums.contract";

const positiveIdSchema = z.number().int().positive();

export const issueItemRequestSchema = z.object({
  productId: positiveIdSchema,
  quantity: z.number().int().positive(),
});

export const issueRequestSchema = z
  .object({
    reason: issueReasonSchema,
    note: z.string().trim().max(500).optional(),
    items: z.array(issueItemRequestSchema).min(1),
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

export type IssueItemRequest = z.infer<typeof issueItemRequestSchema>;
export type IssueRequest = z.infer<typeof issueRequestSchema>;

export type IssueItem = IssueItemRequest & {
  id: number;
  productName: string;
};

export type Issue = {
  id: number;
  code: string;
  reason: z.infer<typeof issueReasonSchema>;
  status: DocumentStatus;
  note?: string;
  createdBy: number;
  createdByName: string;
  createdAt: string;
  finalizedBy: number | null;
  finalizedAt: string | null;
  items: IssueItem[];
};


export type StockShortage = {
  productId: number;
  productName: string;
  requested: number;
  available: number;
};

export type LowStockProduct = {
  productId: number;
  sku: string;
  name: string;
  quantityInStock: number;
  minStock: number;
};

export type ConfirmIssueData = {
  issue: Issue;
  lowStockProducts: LowStockProduct[];
};
