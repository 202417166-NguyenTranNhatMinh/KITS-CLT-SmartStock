import type { PoolClient } from "pg";

import { AppError } from "../common/errors";
import { pool, withTransaction } from "../config/db";
import type { DocumentFilters } from "../contracts/common/documentFilters.contract";
import type { ConfirmIssueData, Issue, IssueItem, IssueRequest, LowStockProduct } from "../contracts/issues/issue.contract";
import type { Queryable } from "../types/db";
import * as productRepo from "./productRepo";

export type StockProduct = { id: number; name: string; isActive: boolean; quantityInStock: number; minStock: number };
export type IssueCreateInput = IssueRequest & { code: string; createdBy: number; createdAt: Date };
export interface IssueTransaction {
  findByIdForUpdate(id: number): Promise<Issue | null>;
  findProductsByIds(ids: number[]): Promise<Pick<StockProduct, "id" | "name" | "isActive">[]>;
  replaceDraft(id: number, input: IssueRequest): Promise<Issue>;
  lockProductsByIds(ids: number[]): Promise<StockProduct[]>;
  decreaseStock(productId: number, quantity: number): Promise<void>;
  finalize(id: number, status: "CONFIRMED" | "CANCELLED", finalizedBy: number, finalizedAt: Date): Promise<Issue>;
  findLowStockByIds(ids: number[]): Promise<LowStockProduct[]>;
}
export interface IssueRepository {
  findProductsByIds(ids: number[]): Promise<Pick<StockProduct, "id" | "name" | "isActive">[]>;
  createDraft(input: IssueCreateInput): Promise<Issue>;
  findById(id: number): Promise<Issue | null>;
  findAll(filters: DocumentFilters): Promise<Issue[]>;
  transaction<T>(work: (tx: IssueTransaction) => Promise<T>): Promise<T>;
}

type IssueRow = {
  id: number; code: string; reason: Issue["reason"]; status: Issue["status"]; note: string | null;
  created_by: number; created_by_name: string; created_at: Date; finalized_by: number | null; finalized_by_name: string | null; finalized_at: Date | null;
};
type IssueDetailRow = { id: number; product_id: number; product_name: string; quantity: number };
const ISSUE_SELECT = `
  SELECT si.id, si.code, si.reason, si.status, si.note, si.created_by,
         creator.full_name AS created_by_name, si.created_at,
         si.finalized_by, finalizer.full_name AS finalized_by_name, si.finalized_at
  FROM stock_issues si JOIN users creator ON creator.id = si.created_by
  LEFT JOIN users finalizer ON finalizer.id = si.finalized_by
`;
const toIso = (value: Date | string): string => new Date(value).toISOString();

async function loadDetails(issueId: number, db: Queryable): Promise<IssueItem[]> {
  const { rows } = await db.query<IssueDetailRow>(
    `SELECT sid.id, sid.product_id, p.name AS product_name, sid.quantity
     FROM stock_issue_details sid JOIN products p ON p.id = sid.product_id
     WHERE sid.issue_id = $1 ORDER BY sid.id`, [issueId],
  );
  return rows.map((row) => ({ id: row.id, productId: row.product_id, productName: row.product_name, quantity: row.quantity }));
}
async function toIssue(row: IssueRow, db: Queryable): Promise<Issue> {
  return {
    id: row.id, code: row.code, reason: row.reason, status: row.status, ...(row.note ? { note: row.note } : {}),
    createdBy: row.created_by, createdByName: row.created_by_name, createdAt: toIso(row.created_at),
    finalizedBy: row.finalized_by, finalizedByName: row.finalized_by_name,
    finalizedAt: row.finalized_at ? toIso(row.finalized_at) : null,
    items: await loadDetails(row.id, db),
  };
}
async function findByIdInternal(id: number, db: Queryable, lock = false): Promise<Issue | null> {
  const { rows } = await db.query<IssueRow>(`${ISSUE_SELECT} WHERE si.id = $1${lock ? " FOR UPDATE OF si" : ""}`, [id]);
  return rows[0] ? toIssue(rows[0], db) : null;
}
async function insertDetails(issueId: number, items: IssueRequest["items"], client: PoolClient): Promise<void> {
  for (const item of items) {
    await client.query("INSERT INTO stock_issue_details (issue_id, product_id, quantity) VALUES ($1, $2, $3)", [issueId, item.productId, item.quantity]);
  }
}

export async function findProductsByIds(ids: number[], db: Queryable = pool): Promise<Pick<StockProduct, "id" | "name" | "isActive">[]> {
  const products = await productRepo.findByIds(ids, db);
  return products.map(({ id, name, isActive }) => ({ id, name, isActive }));
}
export async function createDraft(input: IssueCreateInput): Promise<Issue> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO stock_issues (code, reason, status, note, created_by, created_at)
       VALUES ($1, $2, 'DRAFT', $3, $4, $5) RETURNING id`,
      [input.code, input.reason, input.note ?? null, input.createdBy, input.createdAt],
    );
    const id = rows[0]!.id;
    await insertDetails(id, input.items, client);
    return (await findByIdInternal(id, client))!;
  });
}
export function findById(id: number): Promise<Issue | null> { return findByIdInternal(id, pool); }
async function replaceDraft(id: number, input: IssueRequest, client: PoolClient): Promise<Issue> {
    const result = await client.query("UPDATE stock_issues SET reason = $2, note = $3 WHERE id = $1 AND status = 'DRAFT'", [id, input.reason, input.note ?? null]);
    if (result.rowCount !== 1) throw AppError.conflict("Only DRAFT documents can be updated");
    await client.query("DELETE FROM stock_issue_details WHERE issue_id = $1", [id]);
    await insertDetails(id, input.items, client);
    return (await findByIdInternal(id, client))!;
}
export async function findAll(filters: DocumentFilters): Promise<Issue[]> {
  const where: string[] = []; const params: unknown[] = [];
  if (filters.from) { params.push(filters.from); where.push(`si.created_at >= $${params.length}::date`); }
  if (filters.to) { params.push(filters.to); where.push(`si.created_at < ($${params.length}::date + INTERVAL '1 day')`); }
  if (filters.status) { params.push(filters.status); where.push(`si.status = $${params.length}`); }
  const { rows } = await pool.query<IssueRow>(`${ISSUE_SELECT}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY si.created_at DESC, si.id DESC`, params);
  return Promise.all(rows.map((row) => toIssue(row, pool)));
}

function createTransaction(client: PoolClient): IssueTransaction {
  return {
    findByIdForUpdate: (id) => findByIdInternal(id, client, true),
    findProductsByIds: (ids) => findProductsByIds(ids, client),
    replaceDraft: (id, input) => replaceDraft(id, input, client),
    async lockProductsByIds(ids) {
      const products = await productRepo.lockByIds(client, ids);
      return products.map(({ id, name, isActive, quantityInStock, minStock }) => ({ id, name, isActive, quantityInStock, minStock }));
    },
    async decreaseStock(productId, quantity) {
      const result = await client.query(
        "UPDATE products SET quantity_in_stock = quantity_in_stock - $2 WHERE id = $1 AND quantity_in_stock >= $2",
        [productId, quantity],
      );
      if (result.rowCount !== 1) throw AppError.conflict("Insufficient stock");
    },
    async finalize(id, status, finalizedBy, finalizedAt) {
      const result = await client.query(
        `UPDATE stock_issues SET status = $2, finalized_by = $3, finalized_at = $4 WHERE id = $1 AND status = 'DRAFT'`,
        [id, status, finalizedBy, finalizedAt],
      );
      if (result.rowCount !== 1) throw AppError.conflict("Only DRAFT documents can be finalized");
      return (await findByIdInternal(id, client))!;
    },
    async findLowStockByIds(ids) {
      if (ids.length === 0) return [];
      const { rows } = await client.query<{ id: number; sku: string; name: string; quantity_in_stock: number; min_stock: number }>(
        `SELECT id, sku, name, quantity_in_stock, min_stock FROM products
         WHERE id = ANY($1::int[]) AND quantity_in_stock <= min_stock ORDER BY id`, [ids],
      );
      return rows.map((row) => ({ productId: row.id, sku: row.sku, name: row.name, quantityInStock: row.quantity_in_stock, minStock: row.min_stock }));
    },
  };
}
export function transaction<T>(work: (tx: IssueTransaction) => Promise<T>): Promise<T> {
  return withTransaction((client) => work(createTransaction(client)));
}
export const issueRepository: IssueRepository = { findProductsByIds, createDraft, findById, findAll, transaction };
