import { z } from "zod";

export const productHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const stockSummaryQuerySchema = z
  .object({
    from: z.iso.date("from phải đúng định dạng YYYY-MM-DD"),
    to: z.iso.date("to phải đúng định dạng YYYY-MM-DD"),
  })
  .superRefine((value, ctx) => {
    if (value.from > value.to) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "to phải lớn hơn hoặc bằng from",
      });
    }
  });

export type ProductHistoryQuery = z.infer<typeof productHistoryQuerySchema>;
export type StockSummaryQuery = z.infer<typeof stockSummaryQuerySchema>;

export interface LowStockItem {
  productId: number;
  sku: string;
  name: string;
  quantityInStock: number;
  minStock: number;
}

export interface StockHistoryItem {
  documentType: "RECEIPT" | "ISSUE";
  documentId: number;
  documentCode: string;
  direction: "IN" | "OUT";
  quantity: number;
  confirmedAt: string;
  createdBy: number;
  createdByName: string;
}

export interface StockSummaryItem {
  productId: number;
  sku: string;
  name: string;
  openingQty: number;
  totalIn: number;
  totalOut: number;
  closingQty: number;
}

export interface StockSummaryReport {
  from: string;
  to: string;
  items: StockSummaryItem[];
}
