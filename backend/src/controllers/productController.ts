import type { Request, Response } from "express";
import { z } from "zod";

import { sendSuccess } from "../common/response";
import { productListQuerySchema, productRequestSchema } from "../contracts/products/product.contract";
import * as productService from "../services/productService";

const idSchema = z.coerce.number().int().positive();

export async function listProducts(req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, await productService.listProducts(productListQuerySchema.parse(req.query)));
}

export async function getProduct(req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, await productService.getProduct(idSchema.parse(req.params.id)));
}

export async function createProduct(req: Request, res: Response): Promise<Response> {
  const data = await productService.createProduct(productRequestSchema.parse(req.body));
  return sendSuccess(res, data, "Product created", 201);
}

export async function updateProduct(req: Request, res: Response): Promise<Response> {
  const data = await productService.updateProduct(idSchema.parse(req.params.id), productRequestSchema.parse(req.body));
  return sendSuccess(res, data, "Product updated");
}

export async function deactivateProduct(req: Request, res: Response): Promise<Response> {
  await productService.deactivateProduct(idSchema.parse(req.params.id));
  return sendSuccess(res, null, "Product deactivated");
}
