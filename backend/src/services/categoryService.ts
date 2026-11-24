import { AppError } from "../common/errors";
import * as categoryRepo from "../repo/categoryRepo";
import type { Category } from "../types/models";

const PG_UNIQUE_VIOLATION = "23505";

export function listCategories(): Promise<Category[]> {
  return categoryRepo.findAll();
}

export async function createCategory(name: string): Promise<Category> {
  if (await categoryRepo.findByName(name)) {
    throw AppError.conflict("Tên danh mục đã tồn tại");
  }
  try {
    return await categoryRepo.create(name);
  } catch (err) {
    // 2 request tạo cùng tên một lúc: lần kiểm tra trên đều qua, DB chặn bằng UNIQUE
    if ((err as { code?: string }).code === PG_UNIQUE_VIOLATION) {
      throw AppError.conflict("Tên danh mục đã tồn tại");
    }
    throw err;
  }
}
