import { AppError } from "../common/errors";
import { buildPageResponse, type PageResponse } from "../common/response";
import type { ProductListQuery, ProductRequest } from "../contracts/products/product.contract";
import * as categoryRepo from "../repo/categoryRepo";
import * as productRepo from "../repo/productRepo";
import type { Product } from "../types/models";

const PG_UNIQUE_VIOLATION = "23505";
const skuConflict = () => AppError.conflict("SKU đã tồn tại");

export async function listProducts(q: ProductListQuery): Promise<PageResponse<Product>> {
  const { items, totalItems } = await productRepo.findPaged(q);
  return buildPageResponse(items, q.page, q.pageSize, totalItems);
}

export async function getProduct(id: number): Promise<Product> {
  const product = await productRepo.findById(id);
  if (!product) throw AppError.notFound("Không tìm thấy sản phẩm");
  return product;
}

async function ensureCategoryExists(categoryId: number): Promise<void> {
  if (!(await categoryRepo.findById(categoryId))) throw AppError.notFound("Không tìm thấy danh mục");
}

/** Chuyển lỗi UNIQUE của DB (2 request cùng SKU một lúc) thành 409 thay vì 500 */
async function mapSkuConflict<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if ((err as { code?: string }).code === PG_UNIQUE_VIOLATION) throw skuConflict();
    throw err;
  }
}

export async function createProduct(input: ProductRequest): Promise<Product> {
  await ensureCategoryExists(input.categoryId);
  if (await productRepo.findBySku(input.sku)) throw skuConflict();
  return mapSkuConflict(() => productRepo.create(input));
}

export async function updateProduct(id: number, input: ProductRequest): Promise<Product> {
  await getProduct(id);
  await ensureCategoryExists(input.categoryId);
  const sameSku = await productRepo.findBySku(input.sku);
  if (sameSku && sameSku.id !== id) throw skuConflict();
  const product = await mapSkuConflict(() => productRepo.update(id, input));
  if (!product) throw AppError.notFound("Không tìm thấy sản phẩm");
  return product;
}

export async function deactivateProduct(id: number): Promise<void> {
  if (!(await productRepo.softDelete(id))) throw AppError.notFound("Không tìm thấy sản phẩm");
}
