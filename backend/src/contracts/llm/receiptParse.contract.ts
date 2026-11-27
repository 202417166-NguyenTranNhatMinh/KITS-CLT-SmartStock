import { z } from "zod";

export const parseReceiptRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Nội dung hóa đơn không được rỗng")
    .max(5000, "Nội dung hóa đơn tối đa 5000 ký tự"),
});

export const llmParsedItemSchema = z.object({
  productId: z.number().int().positive("productId phải là số nguyên dương"),
  quantity: z.number().int().positive("quantity phải lớn hơn 0"),
  unitPrice: z.number().min(0, "unitPrice phải >= 0").nullable().optional().default(null),
  rawText: z.string().trim().optional().default(""),
});

export const llmParsedOutputSchema = z.object({
  supplierId: z.number().int().positive().nullable().optional().default(null),
  items: z.array(llmParsedItemSchema),
  unmatched: z.array(z.string()).optional().default([]),
});

export type ParseReceiptRequest = z.infer<typeof parseReceiptRequestSchema>;

export interface ParsedReceiptItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number | null;
  rawText: string;
}

export interface ParseReceiptData {
  supplierId: number | null;
  items: ParsedReceiptItem[];
  unmatched: string[];
  isSuggestionOnly: true;
}

export interface LlmProductOption {
  id: number;
  sku: string;
  name: string;
  unit: string;
  price: number;
}

export interface LlmSupplierOption {
  id: number;
  name: string;
}
