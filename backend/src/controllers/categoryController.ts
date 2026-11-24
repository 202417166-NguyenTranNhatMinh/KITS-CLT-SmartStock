import type { Request, Response } from "express";

import { sendSuccess } from "../common/response";
import { categoryRequestSchema } from "../contracts/categories/category.contract";
import * as categoryService from "../services/categoryService";

// Express 5 tự chuyển lỗi của hàm async (kể cả ZodError từ parse) sang errorHandler

export async function listCategories(_req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, await categoryService.listCategories());
}

export async function createCategory(req: Request, res: Response): Promise<Response> {
  const body = categoryRequestSchema.parse(req.body);
  const data = await categoryService.createCategory(body.name);
  return sendSuccess(res, data, "Category created", 201);
}
