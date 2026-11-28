import type { Request, Response } from "express";
import { z } from "zod";

import { sendSuccess } from "../common/response";
import { productHistoryQuerySchema } from "../contracts/inventory/inventory.contract";
import { inventoryService } from "../services/inventoryService";

const idSchema = z.coerce.number().int().positive();

export async function getLowStock(_req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, await inventoryService.getLowStock());
}

export async function getProductHistory(req: Request, res: Response): Promise<Response> {
  const productId = idSchema.parse(req.params.id);
  const query = productHistoryQuerySchema.parse(req.query);
  return sendSuccess(res, await inventoryService.getProductHistory(productId, query));
}
