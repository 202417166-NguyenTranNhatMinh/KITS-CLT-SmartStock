import type { Request, Response } from "express";

import { sendSuccess } from "../common/response";
import { stockSummaryQuerySchema } from "../contracts/inventory/inventory.contract";
import { reportService } from "../services/reportService";

export async function getStockSummary(req: Request, res: Response): Promise<Response> {
  const query = stockSummaryQuerySchema.parse(req.query);
  return sendSuccess(res, await reportService.getStockSummary(query));
}
