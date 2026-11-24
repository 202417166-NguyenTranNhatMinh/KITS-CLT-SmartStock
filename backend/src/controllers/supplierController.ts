import type { Request, Response } from "express";
import { z } from "zod";

import { sendSuccess } from "../common/response";
import { supplierRequestSchema } from "../contracts/suppliers/supplier.contract";
import * as supplierService from "../services/supplierService";

const idSchema = z.coerce.number().int().positive();

export async function listSuppliers(_req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, await supplierService.listSuppliers());
}

export async function createSupplier(req: Request, res: Response): Promise<Response> {
  const data = await supplierService.createSupplier(supplierRequestSchema.parse(req.body));
  return sendSuccess(res, data, "Supplier created", 201);
}

export async function updateSupplier(req: Request, res: Response): Promise<Response> {
  const data = await supplierService.updateSupplier(idSchema.parse(req.params.id), supplierRequestSchema.parse(req.body));
  return sendSuccess(res, data, "Supplier updated");
}
