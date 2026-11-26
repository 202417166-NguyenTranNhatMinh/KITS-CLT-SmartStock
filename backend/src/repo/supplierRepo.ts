import { pool } from "../config/db";
import type { Queryable } from "../types/db";
import type { Supplier } from "../types/models";

interface SupplierRow {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
}

export interface SupplierInput {
  name: string;
  phone: string | null;
  address: string | null;
}

const toSupplier = (r: SupplierRow): Supplier => ({ id: r.id, name: r.name, phone: r.phone, address: r.address });

export async function findAll(db: Queryable = pool): Promise<Supplier[]> {
  const { rows } = await db.query<SupplierRow>("SELECT id, name, phone, address FROM suppliers ORDER BY name");
  return rows.map(toSupplier);
}

export async function findById(id: number, db: Queryable = pool): Promise<Supplier | null> {
  const { rows } = await db.query<SupplierRow>("SELECT id, name, phone, address FROM suppliers WHERE id = $1", [id]);
  return rows[0] ? toSupplier(rows[0]) : null;
}

export async function create(input: SupplierInput, db: Queryable = pool): Promise<Supplier> {
  const { rows } = await db.query<SupplierRow>(
    "INSERT INTO suppliers (name, phone, address) VALUES ($1, $2, $3) RETURNING id, name, phone, address",
    [input.name, input.phone, input.address],
  );
  return toSupplier(rows[0]);
}

export async function update(id: number, input: SupplierInput, db: Queryable = pool): Promise<Supplier | null> {
  const { rows } = await db.query<SupplierRow>(
    "UPDATE suppliers SET name = $2, phone = $3, address = $4 WHERE id = $1 RETURNING id, name, phone, address",
    [id, input.name, input.phone, input.address],
  );
  return rows[0] ? toSupplier(rows[0]) : null;
}
