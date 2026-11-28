import { pool } from "../config/db";
import type {
  LowStockItem,
  StockHistoryItem,
  StockSummaryItem,
} from "../contracts/inventory/inventory.contract";
import type { Queryable } from "../types/db";

interface LowStockRow {
  product_id: number;
  sku: string;
  name: string;
  quantity_in_stock: number;
  min_stock: number;
}

interface StockHistoryRow {
  document_type: "RECEIPT" | "ISSUE";
  document_id: number;
  document_code: string;
  direction: "IN" | "OUT";
  quantity: number;
  confirmed_at: Date | string;
  created_by: number;
  created_by_name: string;
}

interface StockSummaryRow {
  product_id: number;
  sku: string;
  name: string;
  opening_qty: number | string;
  total_in: number | string;
  total_out: number | string;
}

export interface InventoryRepository {
  findLowStock(): Promise<LowStockItem[]>;
  productExists(productId: number): Promise<boolean>;
  findProductHistory(
    productId: number,
    page: number,
    pageSize: number,
  ): Promise<{ items: StockHistoryItem[]; totalItems: number }>;
  findStockSummary(fromStart: Date, toExclusive: Date): Promise<StockSummaryItem[]>;
}

const HISTORY_UNION_CTE = `
  WITH history AS (
    SELECT
      'RECEIPT'::text AS document_type,
      r.id AS document_id,
      r.code AS document_code,
      'IN'::text AS direction,
      d.quantity,
      r.finalized_at AS confirmed_at,
      r.created_by,
      u.full_name AS created_by_name
    FROM stock_receipt_details d
    JOIN stock_receipts r ON r.id = d.receipt_id
    JOIN users u ON u.id = r.created_by
    WHERE d.product_id = $1 AND r.status = 'CONFIRMED'
    UNION ALL
    SELECT
      'ISSUE'::text AS document_type,
      i.id AS document_id,
      i.code AS document_code,
      'OUT'::text AS direction,
      d.quantity,
      i.finalized_at AS confirmed_at,
      i.created_by,
      u.full_name AS created_by_name
    FROM stock_issue_details d
    JOIN stock_issues i ON i.id = d.issue_id
    JOIN users u ON u.id = i.created_by
    WHERE d.product_id = $1 AND i.status = 'CONFIRMED'
  )
`;

export async function findLowStock(db: Queryable = pool): Promise<LowStockItem[]> {
  const { rows } = await db.query<LowStockRow>(
    `SELECT id AS product_id, sku, name, quantity_in_stock, min_stock
     FROM products
     WHERE is_active = TRUE AND quantity_in_stock <= min_stock
     ORDER BY sku ASC, id ASC`,
  );
  return rows.map((row) => ({
    productId: row.product_id,
    sku: row.sku,
    name: row.name,
    quantityInStock: row.quantity_in_stock,
    minStock: row.min_stock,
  }));
}

export async function productExists(productId: number, db: Queryable = pool): Promise<boolean> {
  const { rowCount } = await db.query("SELECT 1 FROM products WHERE id = $1", [productId]);
  return (rowCount ?? 0) > 0;
}

export async function findProductHistory(
  productId: number,
  page: number,
  pageSize: number,
  db: Queryable = pool,
): Promise<{ items: StockHistoryItem[]; totalItems: number }> {
  const countResult = await db.query<{ total: number }>(
    `${HISTORY_UNION_CTE} SELECT COUNT(*)::int AS total FROM history`,
    [productId],
  );
  const totalItems = Number(countResult.rows[0]?.total ?? 0);

  const offset = (page - 1) * pageSize;
  const { rows } = await db.query<StockHistoryRow>(
    `${HISTORY_UNION_CTE}
     SELECT document_type, document_id, document_code, direction, quantity,
            confirmed_at, created_by, created_by_name
     FROM history
     ORDER BY confirmed_at DESC, document_id DESC
     LIMIT $2 OFFSET $3`,
    [productId, pageSize, offset],
  );

  return {
    totalItems,
    items: rows.map((row) => ({
      documentType: row.document_type,
      documentId: row.document_id,
      documentCode: row.document_code,
      direction: row.direction,
      quantity: row.quantity,
      confirmedAt: new Date(row.confirmed_at).toISOString(),
      createdBy: row.created_by,
      createdByName: row.created_by_name,
    })),
  };
}

export async function findStockSummary(
  fromStart: Date,
  toExclusive: Date,
  db: Queryable = pool,
): Promise<StockSummaryItem[]> {
  const { rows } = await db.query<StockSummaryRow>(
    `WITH movements AS (
       SELECT d.product_id, r.finalized_at, d.quantity AS in_qty, 0 AS out_qty
       FROM stock_receipt_details d
       JOIN stock_receipts r ON r.id = d.receipt_id
       WHERE r.status = 'CONFIRMED' AND r.finalized_at < $2
       UNION ALL
       SELECT d.product_id, i.finalized_at, 0 AS in_qty, d.quantity AS out_qty
       FROM stock_issue_details d
       JOIN stock_issues i ON i.id = d.issue_id
       WHERE i.status = 'CONFIRMED' AND i.finalized_at < $2
     ),
     agg AS (
       SELECT
         product_id,
         COALESCE(SUM(CASE WHEN finalized_at < $1 THEN in_qty - out_qty ELSE 0 END), 0)::int AS opening_qty,
         COALESCE(SUM(CASE WHEN finalized_at >= $1 THEN in_qty ELSE 0 END), 0)::int AS total_in,
         COALESCE(SUM(CASE WHEN finalized_at >= $1 THEN out_qty ELSE 0 END), 0)::int AS total_out
       FROM movements
       GROUP BY product_id
     )
     SELECT
       p.id AS product_id,
       p.sku,
       p.name,
       COALESCE(a.opening_qty, 0)::int AS opening_qty,
       COALESCE(a.total_in, 0)::int AS total_in,
       COALESCE(a.total_out, 0)::int AS total_out
     FROM products p
     LEFT JOIN agg a ON a.product_id = p.id
     ORDER BY p.sku ASC, p.id ASC`,
    [fromStart, toExclusive],
  );

  return rows.map((row) => {
    const openingQty = Number(row.opening_qty);
    const totalIn = Number(row.total_in);
    const totalOut = Number(row.total_out);
    return {
      productId: row.product_id,
      sku: row.sku,
      name: row.name,
      openingQty,
      totalIn,
      totalOut,
      closingQty: openingQty + totalIn - totalOut,
    };
  });
}

export const inventoryRepository: InventoryRepository = {
  findLowStock: () => findLowStock(),
  productExists: (productId) => productExists(productId),
  findProductHistory: (productId, page, pageSize) => findProductHistory(productId, page, pageSize),
  findStockSummary: (fromStart, toExclusive) => findStockSummary(fromStart, toExclusive),
};
