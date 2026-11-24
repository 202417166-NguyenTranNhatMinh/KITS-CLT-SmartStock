import type { Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../common/errors";
import { sendSuccess } from "../common/response";
import { documentFiltersSchema } from "../contracts/common/documentFilters.contract";
import { issueRequestSchema } from "../contracts/issues/issue.contract";
import { documentCodeRepository } from "../repo/documentCodeRepo";
import { issueRepository } from "../repo/issueRepo";
import { DocumentNumberService } from "../services/documentNumberService";
import { IssueService } from "../services/issueService";

const service = new IssueService(issueRepository, new DocumentNumberService(documentCodeRepository));
const idSchema = z.coerce.number().int().positive();
const actor = (req: Request) => {
  if (!req.user) throw AppError.unauthorized("Missing or invalid token");
  return req.user;
};

export async function listIssues(req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, await service.list(documentFiltersSchema.parse(req.query)));
}
export async function createIssue(req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, await service.create(issueRequestSchema.parse(req.body), actor(req)), "Issue created", 201);
}
export async function getIssue(req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, await service.getById(idSchema.parse(req.params.id)));
}
export async function updateIssue(req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, await service.update(idSchema.parse(req.params.id), issueRequestSchema.parse(req.body), actor(req)), "Issue updated");
}
export async function confirmIssue(req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, await service.confirm(idSchema.parse(req.params.id), actor(req)), "Issue confirmed");
}
export async function cancelIssue(req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, await service.cancel(idSchema.parse(req.params.id), actor(req)), "Issue cancelled");
}
