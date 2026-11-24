import type { PoolClient } from "pg";

import { AppError } from "../common/errors";
import { pool, withTransaction } from "../config/db";
import type { DocumentFilters } from "../contracts/common/documentFilters.contract";
import type { Receipt, ReceiptItem, ReceiptRequest } from "../contracts/receipts/receipt.contract";
import type { Queryable } from "../types/db";
import * as productRepo from "./productRepo";

export type ActiveProduct = { id: number; name: string; isActive: boolean };
export type ReceiptCreateInput = ReceiptRequest & { code: string; createdBy: number; createdAt: Date };

export interface ReceiptTransaction {
  findByIdForUpdate(id: number): Promise<Receipt | null>;
  increaseStock(productId: number, quantity: number): Promise<void>;
  finalize(id: number, status: "CONFIRMED" | "CANCELLED", finalizedBy: number, finalizedAt: Date): Promise<Receipt>;
}

export interface ReceiptRepository {
  findSupplierById(id: number): Promise<{ id: number; name: string } | null>;
  findProductsByIds(ids: number[]): Promise<ActiveProduct[]>;
  createDraft(input: ReceiptCreateInput): Promise<Receipt>;
  findById(id: number): Promise<Receipt | null>;
  replaceDraft(id: number, input: ReceiptRequest): Promise<Receipt>;
  findAll(filters: DocumentFilters): Promise<Receipt[]>;
  transaction<T>(work: (tx: ReceiptTransaction) => Promise<T>): Promise<T>;
}

type ReceiptRow = {
  id: number; code: string; supplier_id: number; supplier_name: string; status: Receipt["status"]; note: string | null;
  created_by: number; created_by_name: string; created_at: Date; finalized_by: number | null; finalized_at: Date | null;
};
type ReceiptDetailRow = { id: number; product_id: number; product_name: string; quantity: number; unit_price: string };

const RECEIPT_SELECT = `
  SELECT sr.id, sr.code, sr.supplier_id, s.name AS supplier_name, sr.status, sr.note,
         sr.created_by, creator.full_name AS created_by_name, sr.created_at, sr.finalized_by, sr.finalized_at
  FROM stock_receipts sr
  JOIN suppliers s ON s.id = sr.supplier_id
  JOIN users creator ON creator.id = sr.created_by
`;
const toIso = (value: Date | string): string => new Date(value).toISOString();

async function loadDetails(receiptId: number, db: Queryable): Promise<ReceiptItem[]> {
  const { rows } = await db.query<ReceiptDetailRow>(
    `SELECT srd.id, srd.product_id, p.name AS product_name, srd.quantity, srd.unit_price
     FROM stock_receipt_details srd JOIN products p ON p.id = srd.product_id
     WHERE srd.receipt_id = $1 ORDER BY srd.id`,
    [receiptId],
  );
  return rows.map((row) => ({ id: row.id, productId: row.product_id, productName: row.product_name, quantity: row.quantity, unitPrice: Number(row.unit_price) }));
}

async function toReceipt(row: ReceiptRow, db: Queryable): Promise<Receipt> {
  const items = await loadDetails(row.id, db);
  return {
    id: row.id, code: row.code, supplierId: row.supplier_id, supplierName: row.supplier_name, status: row.status,
    ...(row.note ? { note: row.note } : {}), createdBy: row.created_by, createdByName: row.created_by_name,
    createdAt: toIso(row.created_at), finalizedBy: row.finalized_by, finalizedAt: row.finalized_at ? toIso(row.finalized_at) : null,
    totalAmount: items.reduce((total, item) => total + item.quantity * item.unitPrice, 0), items,
  };
}

async function findByIdInternal(id: number, db: Queryable, lock = false): Promise<Receipt | null> {
  const { rows } = await db.query<ReceiptRow>(`${RECEIPT_SELECT} WHERE sr.id = $1${lock ? " FOR UPDATE OF sr" : ""}`, [id]);
  return rows[0] ? toReceipt(rows[0], db) : null;
}

async function insertDetails(receiptId: number, items: ReceiptRequest["items"], client: PoolClient): Promise<void> {
  for (const item of items) {
    await client.query(
      `INSERT INTO stock_receipt_details (receipt_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)`,
      [receiptId, item.productId, item.quantity, item.unitPrice],
    );
  }
}

export async function findSupplierById(id: number): Promise<{ id: number; name: string } | null> {
  const { rows } = await pool.query<{ id: number; name: string }>("SELECT id, name FROM suppliers WHERE id = $1", [id]);
  return rows[0] ?? null;
}
export async function findProductsByIds(ids: number[]): Promise<ActiveProduct[]> {
  const products = await productRepo.findByIds(ids);
  return products.map(({ id, name, isActive }) => ({ id, name, isActive }));
}
export async function createDraft(input: ReceiptCreateInput): Promise<Receipt> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO stock_receipts (code, supplier_id, status, note, created_by, created_at)
       VALUES ($1, $2, 'DRAFT', $3, $4, $5) RETURNING id`,
      [input.code, input.supplierId, input.note ?? null, input.createdBy, input.createdAt],
    );
    const id = rows[0]!.id;
    await insertDetails(id, input.items, client);
    return (await findByIdInternal(id, client))!;
  });
}
export function findById(id: number): Promise<Receipt | null> { return findByIdInternal(id, pool); }
export async function replaceDraft(id: number, input: ReceiptRequest): Promise<Receipt> {
  return withTransaction(async (client) => {
    const result = await client.query(`UPDATE stock_receipts SET supplier_id = $2, note = $3 WHERE id = $1 AND status = 'DRAFT'`, [id, input.supplierId, input.note ?? null]);
    if (result.rowCount !== 1) throw AppError.conflict("Only DRAFT documents can be updated");
    await client.query("DELETE FROM stock_receipt_details WHERE receipt_id = $1", [id]);
    await insertDetails(id, input.items, client);
    return (await findByIdInternal(id, client))!;
  });
}
export async function findAll(filters: DocumentFilters): Promise<Receipt[]> {
  const where: string[] = []; const params: unknown[] = [];
  if (filters.from) { params.push(filters.from); where.push(`sr.created_at >= $${params.length}::date`); }
  if (filters.to) { params.push(filters.to); where.push(`sr.created_at < ($${params.length}::date + INTERVAL '1 day')`); }
  if (filters.status) { params.push(filters.status); where.push(`sr.status = $${params.length}`); }
  const { rows } = await pool.query<ReceiptRow>(`${RECEIPT_SELECT}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY sr.created_at DESC, sr.id DESC`, params);
  return Promise.all(rows.map((row) => toReceipt(row, pool)));
}

function createTransaction(client: PoolClient): ReceiptTransaction {
  return {
    findByIdForUpdate: (id) => findByIdInternal(id, client, true),
    async increaseStock(productId, quantity) {
      await client.query("UPDATE products SET quantity_in_stock = quantity_in_stock + $2 WHERE id = $1", [productId, quantity]);
    },
    async finalize(id, status, finalizedBy, finalizedAt) {
      const result = await client.query(
        `UPDATE stock_receipts SET status = $2, finalized_by = $3, finalized_at = $4 WHERE id = $1 AND status = 'DRAFT'`,
        [id, status, finalizedBy, finalizedAt],
      );
      if (result.rowCount !== 1) throw AppError.conflict("Only DRAFT documents can be finalized");
      return (await findByIdInternal(id, client))!;
    },
  };
}
export function transaction<T>(work: (tx: ReceiptTransaction) => Promise<T>): Promise<T> {
  return withTransaction((client) => work(createTransaction(client)));
}
export const receiptRepository: ReceiptRepository = { findSupplierById, findProductsByIds, createDraft, findById, replaceDraft, findAll, transaction };
