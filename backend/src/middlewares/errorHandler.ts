import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../common/errors';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(AppError.notFound('Endpoint not found'));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // 1. Lỗi validate DTO (Zod) -> 400 + data.errors
  if (err instanceof ZodError) {
    const errors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return res.status(400).json({
      status: 400,
      message: 'Validation failed',
      data: { errors },
    });
  }

  // 2. Lỗi nghiệp vụ chủ động ném ra (400, 401, 403, 404, 409)
  if (err instanceof AppError) {
    return res.status(err.status).json({
      status: err.status,
      message: err.message,
      data: err.data ?? null,
    });
  }

  // 3. Lỗi JSON syntax sai từ client
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      status: 400,
      message: 'Invalid JSON payload',
      data: null,
    });
  }

  // 4. Fallback 500 - KHÔNG lộ stacktrace ra response
  console.error('[Unhandled Error]', err);
  return res.status(500).json({
    status: 500,
    message: 'Internal server error',
    data: null,
  });
}