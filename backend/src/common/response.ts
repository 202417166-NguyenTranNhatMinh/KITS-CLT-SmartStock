import { Response } from 'express';

export interface ApiResponseBody<T = unknown> {
  status: number;
  message: string;
  data: T | null;
}

export interface PageResponse<T> {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  items: T[];
}

export function sendSuccess<T>(
  res: Response,
  data: T | null = null,
  message = 'success',
  status = 200
): Response<ApiResponseBody<T>> {
  return res.status(status).json({
    status,
    message,
    data,
  });
}

export function buildPageResponse<T>(
  items: T[],
  page: number,
  pageSize: number,
  totalItems: number
): PageResponse<T> {
  return {
    page,
    pageSize,
    totalItems,
    totalPages: Math.ceil(totalItems / pageSize),
    items,
  };
}