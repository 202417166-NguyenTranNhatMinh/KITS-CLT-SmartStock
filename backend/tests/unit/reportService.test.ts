import assert from "node:assert/strict";
import test from "node:test";

import { stockSummaryQuerySchema } from "../../src/contracts/inventory/inventory.contract";
import {
  formatStockSummaryCsv,
  ReportService,
  toVietnamDateRange,
} from "../../src/services/reportService";

test("toVietnamDateRange maps YYYY-MM-DD bounds using Asia/Ho_Chi_Minh (+07:00)", () => {
  const { fromStart, toExclusive } = toVietnamDateRange("2026-11-20", "2026-11-23");
  assert.equal(fromStart.toISOString(), "2026-11-19T17:00:00.000Z");
  assert.equal(toExclusive.toISOString(), "2026-11-23T17:00:00.000Z");
});

test("getStockSummary computes opening, movement, idle, and never-imported products", async () => {
  let capturedRange: [Date, Date] | undefined;
  const service = new ReportService({
    async findStockSummary(fromStart, toExclusive) {
      capturedRange = [fromStart, toExclusive];
      return [
        {
          productId: 1,
          sku: "RAU-001",
          name: "Cà chua",
          openingQty: 60,
          totalIn: 30,
          totalOut: 35,
          closingQty: 0, // service recalculates closingQty from opening + in - out
        },
        {
          productId: 2,
          sku: "RAU-003",
          name: "Cà rốt Đà Lạt",
          openingQty: 50,
          totalIn: 0,
          totalOut: 0,
          closingQty: 0,
        },
        {
          productId: 3,
          sku: "NEW-001",
          name: "Sản phẩm mới chưa nhập",
          openingQty: 0,
          totalIn: 0,
          totalOut: 0,
          closingQty: 0,
        },
      ];
    },
  });

  const report = await service.getStockSummary({ from: "2026-11-21", to: "2026-11-24" });

  assert.equal(capturedRange?.[0].toISOString(), "2026-11-20T17:00:00.000Z");
  assert.equal(capturedRange?.[1].toISOString(), "2026-11-24T17:00:00.000Z");
  assert.equal(report.from, "2026-11-21");
  assert.equal(report.to, "2026-11-24");
  assert.deepEqual(report.items, [
    {
      productId: 1,
      sku: "RAU-001",
      name: "Cà chua",
      openingQty: 60,
      totalIn: 30,
      totalOut: 35,
      closingQty: 55,
    },
    {
      productId: 2,
      sku: "RAU-003",
      name: "Cà rốt Đà Lạt",
      openingQty: 50,
      totalIn: 0,
      totalOut: 0,
      closingQty: 50,
    },
    {
      productId: 3,
      sku: "NEW-001",
      name: "Sản phẩm mới chưa nhập",
      openingQty: 0,
      totalIn: 0,
      totalOut: 0,
      closingQty: 0,
    },
  ]);
});

test("stockSummaryQuerySchema rejects missing params, invalid calendar dates, and from > to", () => {
  assert.deepEqual(stockSummaryQuerySchema.parse({ from: "2026-11-20", to: "2026-11-20" }), {
    from: "2026-11-20",
    to: "2026-11-20",
  });
  assert.throws(() => stockSummaryQuerySchema.parse({ from: "2026-11-20" }));
  assert.throws(() => stockSummaryQuerySchema.parse({ to: "2026-11-20" }));
  assert.throws(() => stockSummaryQuerySchema.parse({ from: "2026-02-30", to: "2026-03-01" }));
  assert.throws(() => stockSummaryQuerySchema.parse({ from: "2026-11-25", to: "2026-11-20" }));
});

test("formatStockSummaryCsv includes UTF-8 BOM, Vietnamese headers, and escapes commas, quotes, and formulas", () => {
  const csv = formatStockSummaryCsv({
    from: "2026-11-20",
    to: "2026-11-26",
    items: [
      {
        productId: 1,
        sku: "RAU-001",
        name: 'Cà chua, "sạch"',
        openingQty: 60,
        totalIn: 30,
        totalOut: 35,
        closingQty: 55,
      },
      {
        productId: 2,
        sku: "=CMD",
        name: "+Nguy hiểm",
        openingQty: 0,
        totalIn: 0,
        totalOut: 0,
        closingQty: 0,
      },
    ],
  });

  assert.ok(csv.startsWith("\uFEFF"), "CSV must start with UTF-8 BOM");
  const lines = csv.slice(1).split("\r\n");
  assert.equal(lines[0], "Mã SP,SKU,Tên sản phẩm,Tồn đầu kỳ,Tổng nhập,Tổng xuất,Tồn cuối kỳ");
  assert.equal(lines[1], '1,RAU-001,"Cà chua, ""sạch""",60,30,35,55');
  assert.equal(lines[2], "2,'=CMD,'+Nguy hiểm,0,0,0,0");
});
