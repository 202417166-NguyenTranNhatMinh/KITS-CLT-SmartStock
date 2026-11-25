import { z } from "zod";

// Chuỗi rỗng / toàn khoảng trắng coi như không nhập → lưu NULL
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Tối đa ${max} ký tự`)
    .optional()
    .transform((v) => (v ? v : null));

export const supplierRequestSchema = z.object({
  name: z.string().trim().min(1, "Tên nhà cung cấp không được rỗng").max(150, "Tối đa 150 ký tự"),
  phone: optionalText(30),
  address: optionalText(255),
});

export type SupplierRequest = z.infer<typeof supplierRequestSchema>;
