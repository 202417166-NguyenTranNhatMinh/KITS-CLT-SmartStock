import { z } from "zod";

export const productListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["name", "sku", "price", "quantityInStock"]).default("name"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
  keyword: z.string().trim().optional().transform((v) => (v ? v : undefined)),
  categoryId: z.coerce.number().int().positive().optional(),
});

// Không có quantityInStock: zod bỏ qua field này nếu client gửi lên, tồn kho chỉ đổi qua chứng từ
export const productRequestSchema = z.object({
  sku: z.string().trim().min(1, "SKU không được rỗng").max(50, "Tối đa 50 ký tự"),
  name: z.string().trim().min(1, "Tên sản phẩm không được rỗng").max(200, "Tối đa 200 ký tự"),
  categoryId: z.number().int().positive(),
  unit: z.string().trim().min(1, "Đơn vị không được rỗng").max(20, "Tối đa 20 ký tự"),
  price: z.number().min(0, "Giá phải >= 0"),
  minStock: z.number().int().min(0, "Tồn tối thiểu phải >= 0"),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type ProductRequest = z.infer<typeof productRequestSchema>;
