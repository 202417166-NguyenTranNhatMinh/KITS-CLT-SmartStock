import type { Request, Response } from "express";

import { sendSuccess } from "../common/response";
import { parseReceiptRequestSchema } from "../contracts/llm/receiptParse.contract";
import { receiptParseService } from "../services/llm/receiptParseService";

export async function parseReceipt(req: Request, res: Response): Promise<Response> {
  const { text } = parseReceiptRequestSchema.parse(req.body);
  return sendSuccess(res, await receiptParseService.parse(text));
}
