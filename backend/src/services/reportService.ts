import type {
  StockSummaryQuery,
  StockSummaryReport,
} from "../contracts/inventory/inventory.contract";
import { inventoryRepository, type InventoryRepository } from "../repo/inventoryRepo";

const DAY_MS = 24 * 60 * 60 * 1000;
const VN_OFFSET = "+07:00";
const UTF8_BOM = "\uFEFF";

function escapeCsvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function formatStockSummaryCsv(report: StockSummaryReport): string {
  const header = ["Mã SP", "SKU", "Tên sản phẩm", "Tồn đầu kỳ", "Tổng nhập", "Tổng xuất", "Tồn cuối kỳ"];
  const rows = report.items.map((item) => [
    String(item.productId),
    escapeCsvCell(item.sku),
    escapeCsvCell(item.name),
    String(item.openingQty),
    String(item.totalIn),
    String(item.totalOut),
    String(item.closingQty),
  ]);
  return UTF8_BOM + [header.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}

/** Quy đổi khoảng ngày YYYY-MM-DD theo múi giờ Asia/Ho_Chi_Minh sang nửa khoảng [fromStart, toExclusive). */
export function toVietnamDateRange(from: string, to: string): { fromStart: Date; toExclusive: Date } {
  const fromStart = new Date(`${from}T00:00:00.000${VN_OFFSET}`);
  const toStart = new Date(`${to}T00:00:00.000${VN_OFFSET}`);
  return {
    fromStart,
    toExclusive: new Date(toStart.getTime() + DAY_MS),
  };
}

export class ReportService {
  constructor(private readonly repo: Pick<InventoryRepository, "findStockSummary">) {}

  async getStockSummary(query: StockSummaryQuery): Promise<StockSummaryReport> {
    const { fromStart, toExclusive } = toVietnamDateRange(query.from, query.to);
    const rawItems = await this.repo.findStockSummary(fromStart, toExclusive);
    const items = rawItems.map((item) => ({
      ...item,
      closingQty: item.openingQty + item.totalIn - item.totalOut,
    }));
    return {
      from: query.from,
      to: query.to,
      items,
    };
  }

  async exportStockSummaryCsv(query: StockSummaryQuery): Promise<string> {
    const report = await this.getStockSummary(query);
    return formatStockSummaryCsv(report);
  }
}

export const reportService = new ReportService(inventoryRepository);
