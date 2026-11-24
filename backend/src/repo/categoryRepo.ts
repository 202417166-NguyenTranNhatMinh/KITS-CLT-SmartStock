import { pool } from '../config/db';
import type { Queryable } from '../types/db';
import type { Category } from '../types/models';

interface CategoryRow {
  id: number;
  name: string;
}

const toCategory = (r: CategoryRow): Category => ({ id: r.id, name: r.name });

export async function findAll(db: Queryable = pool): Promise<Category[]> {
  const { rows } = await db.query<CategoryRow>('SELECT id, name FROM categories ORDER BY name');
  return rows.map(toCategory);
}

export async function findById(id: number, db: Queryable = pool): Promise<Category | null> {
  const { rows } = await db.query<CategoryRow>('SELECT id, name FROM categories WHERE id = $1', [id]);
  return rows[0] ? toCategory(rows[0]) : null;
}

/** So sánh không phân biệt hoa thường để chặn "Rau củ" và "rau củ" cùng tồn tại */
export async function findByName(name: string, db: Queryable = pool): Promise<Category | null> {
  const { rows } = await db.query<CategoryRow>(
    'SELECT id, name FROM categories WHERE LOWER(name) = LOWER($1)',
    [name],
  );
  return rows[0] ? toCategory(rows[0]) : null;
}

export async function create(name: string, db: Queryable = pool): Promise<Category> {
  const { rows } = await db.query<CategoryRow>(
    'INSERT INTO categories (name) VALUES ($1) RETURNING id, name',
    [name],
  );
  return toCategory(rows[0]);
}
