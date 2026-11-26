import { pool } from "../config/db";
import type { LlmProductOption, LlmSupplierOption } from "../contracts/llm/receiptParse.contract";
import * as supplierRepo from "./supplierRepo";
import type { Queryable } from "../types/db";

interface LlmProductRow {
  id: number;
  sku: string;
  name: string;
  unit: string;
  price: string;
}

export interface LlmCatalogRepository {
  findActiveProducts(): Promise<LlmProductOption[]>;
  findSuppliers(): Promise<LlmSupplierOption[]>;
}

export async function findActiveProducts(db: Queryable = pool): Promise<LlmProductOption[]> {
  const { rows } = await db.query<LlmProductRow>(
    "SELECT id, sku, name, unit, price FROM products WHERE is_active = TRUE ORDER BY id ASC",
  );
  return rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    name: row.name,
    unit: row.unit,
    price: Number(row.price),
  }));
}

export async function findSuppliers(): Promise<LlmSupplierOption[]> {
  const suppliers = await supplierRepo.findAll();
  return suppliers.map(({ id, name }) => ({ id, name }));
}

export const llmCatalogRepository: LlmCatalogRepository = {
  findActiveProducts: () => findActiveProducts(),
  findSuppliers,
};
