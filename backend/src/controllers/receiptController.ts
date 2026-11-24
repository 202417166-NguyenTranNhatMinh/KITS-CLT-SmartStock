import type { Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../common/errors";
import { sendSuccess } from "../common/response";
import { documentFiltersSchema } from "../contracts/common/documentFilters.contract";
import { receiptRequestSchema } from "../contracts/receipts/receipt.contract";
import { documentCodeRepository } from "../repo/documentCodeRepo";
import { receiptRepository } from "../repo/receiptRepo";
import { DocumentNumberService } from "../services/documentNumberService";
import { ReceiptService } from "../services/receiptService";

const service = new ReceiptService(receiptRepository, new DocumentNumberService(documentCodeRepository));
const idSchema = z.coerce.number().int().positive();
const actor = (req: Request) => {
  if (!req.user) throw AppError.unauthorized("Missing or invalid token");
  return req.user;
};

export async function listReceipts(req: Request, res: Response): Promise<Response> {
  const data = await service.list(documentFiltersSchema.parse(req.query));
  return sendSuccess(res, data);
}
export async function createReceipt(req: Request, res: Response): Promise<Response> {
  const data = await service.create(receiptRequestSchema.parse(req.body), actor(req));
  return sendSuccess(res, data, "Receipt created", 201);
}
export async function getReceipt(req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, await service.getById(idSchema.parse(req.params.id)));
}
export async function updateReceipt(req: Request, res: Response): Promise<Response> {
  const data = await service.update(idSchema.parse(req.params.id), receiptRequestSchema.parse(req.body), actor(req));
  return sendSuccess(res, data, "Receipt updated");
}
export async function confirmReceipt(req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, await service.confirm(idSchema.parse(req.params.id), actor(req)), "Receipt confirmed");
}
export async function cancelReceipt(req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, await service.cancel(idSchema.parse(req.params.id), actor(req)), "Receipt cancelled");
}
