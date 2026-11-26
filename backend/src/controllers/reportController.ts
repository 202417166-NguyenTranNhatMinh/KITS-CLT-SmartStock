import type { Request, Response } from "express";

import { sendSuccess } from "../common/response";
import { stockSummaryQuerySchema } from "../contracts/inventory/inventory.contract";
import { reportService } from "../services/reportService";

export async function getStockSummary(req: Request, res: Response): Promise<Response> {
  const query = stockSummaryQuerySchema.parse(req.query);
  return sendSuccess(res, await reportService.getStockSummary(query));
}

export async function exportStockSummary(req: Request, res: Response): Promise<Response> {
  const query = stockSummaryQuerySchema.parse(req.query);
  const csv = await reportService.exportStockSummaryCsv(query);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="stock-summary-${query.from}-to-${query.to}.csv"`,
  );
  return res.status(200).send(csv);
}
