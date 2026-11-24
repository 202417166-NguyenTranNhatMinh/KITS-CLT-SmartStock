import type { PoolClient } from 'pg';
import { pool } from '../config/db';
import type { Queryable } from '../types/db';
import type { Product } from '../types/models';

interface ProductRow {
  id: number;
  sku: string;
  name: string;
  category_id: number;
  category_name: string;
  unit: string;
  price: string; // pg trả NUMERIC về dạng string → đổi sang number ở toProduct
  quantity_in_stock: number;
  min_stock: number;
  is_active: boolean;
}

const SELECT_PRODUCT = `
  SELECT p.id, p.sku, p.name, p.category_id, c.name AS category_name, p.unit,
         p.price, p.quantity_in_stock, p.min_stock, p.is_active
  FROM products p
  JOIN categories c ON c.id = p.category_id
`;

const toProduct = (r: ProductRow): Product => ({
  id: r.id,
  sku: r.sku,
  name: r.name,
  categoryId: r.category_id,
  categoryName: r.category_name,
  unit: r.unit,
  price: Number(r.price),
  quantityInStock: r.quantity_in_stock,
  minStock: r.min_stock,
  isActive: r.is_active,
});

// Whitelist cột được sort: không bao giờ ghép thẳng chuỗi client gửi vào SQL
const SORT_COLUMNS = {
  name: 'p.name',
  sku: 'p.sku',
  price: 'p.price',
  quantityInStock: 'p.quantity_in_stock',
} as const;
export type ProductSortBy = keyof typeof SORT_COLUMNS;

export interface ProductFilter {
  page: number; // bắt đầu từ 1
  pageSize: number;
  sortBy: ProductSortBy;
  sortDir: 'asc' | 'desc';
  keyword?: string;
  categoryId?: number;
  includeInactive?: boolean;
}

export async function findPaged(
  f: ProductFilter,
  db: Queryable = pool,
): Promise<{ items: Product[]; totalItems: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (!f.includeInactive) where.push('p.is_active = TRUE');
  if (f.keyword) {
    params.push(`%${f.keyword}%`);
    where.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`);
  }
  if (f.categoryId) {
    params.push(f.categoryId);
    where.push(`p.category_id = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const count = await db.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM products p ${whereSql}`,
    params,
  );

  const orderSql = `ORDER BY ${SORT_COLUMNS[f.sortBy]} ${f.sortDir === 'desc' ? 'DESC' : 'ASC'}, p.id`;
  params.push(f.pageSize, (f.page - 1) * f.pageSize);
  const { rows } = await db.query<ProductRow>(
    `${SELECT_PRODUCT} ${whereSql} ${orderSql} LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return { items: rows.map(toProduct), totalItems: Number(count.rows[0].total) };
}

export async function findById(id: number, db: Queryable = pool): Promise<Product | null> {
  const { rows } = await db.query<ProductRow>(`${SELECT_PRODUCT} WHERE p.id = $1`, [id]);
  return rows[0] ? toProduct(rows[0]) : null;
}

export async function findBySku(sku: string, db: Queryable = pool): Promise<Product | null> {
  const { rows } = await db.query<ProductRow>(`${SELECT_PRODUCT} WHERE p.sku = $1`, [sku]);
  return rows[0] ? toProduct(rows[0]) : null;
}

/** Lấy nhiều sản phẩm theo id, dùng khi kiểm tra dòng chứng từ (tồn tại? đang active?) */
export async function findByIds(ids: number[], db: Queryable = pool): Promise<Product[]> {
  if (ids.length === 0) return [];
  const { rows } = await db.query<ProductRow>(`${SELECT_PRODUCT} WHERE p.id = ANY($1::int[])`, [ids]);
  return rows.map(toProduct);
}

/**
 * Cho Minh: khóa các dòng sản phẩm trong transaction trước khi cộng/trừ tồn.
 * ORDER BY id để 2 transaction luôn khóa theo cùng thứ tự → tránh deadlock.
 * BẮT BUỘC truyền client đang trong transaction (không truyền pool).
 */
export async function lockByIds(client: PoolClient, ids: number[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const { rows } = await client.query<ProductRow>(
    `${SELECT_PRODUCT} WHERE p.id = ANY($1::int[]) ORDER BY p.id FOR UPDATE OF p`,
    [ids],
  );
  return rows.map(toProduct);
}

export interface ProductInput {
  sku: string;
  name: string;
  categoryId: number;
  unit: string;
  price: number;
  minStock: number;
}

export async function create(input: ProductInput, db: Queryable = pool): Promise<Product> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO products (sku, name, category_id, unit, price, min_stock)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.sku, input.name, input.categoryId, input.unit, input.price, input.minStock],
  );
  return (await findById(rows[0].id, db)) as Product;
}

export async function update(id: number, input: ProductInput, db: Queryable = pool): Promise<Product | null> {
  // Cố ý KHÔNG có quantity_in_stock: tồn kho chỉ đổi qua chứng từ
  const { rowCount } = await db.query(
    `UPDATE products SET sku = $2, name = $3, category_id = $4, unit = $5, price = $6, min_stock = $7
     WHERE id = $1`,
    [id, input.sku, input.name, input.categoryId, input.unit, input.price, input.minStock],
  );
  return rowCount ? findById(id, db) : null;
}

/** Xóa mềm: chỉ ẩn sản phẩm */
export async function softDelete(id: number, db: Queryable = pool): Promise<boolean> {
  const { rowCount } = await db.query('UPDATE products SET is_active = FALSE WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}
