import { z } from "zod";

export const categoryRequestSchema = z.object({
  name: z.string().trim().min(1, "Tên danh mục không được rỗng").max(100, "Tối đa 100 ký tự"),
});

export type CategoryRequest = z.infer<typeof categoryRequestSchema>;
