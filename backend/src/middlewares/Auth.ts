import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

import { AppError } from "../common/errors";
import { env } from "../config/env";
import type { AuthenticatedUser, Role } from "../contracts/common/enums.contract";
import { roleSchema } from "../contracts/common/enums.contract";

function parseActor(payload: string | JwtPayload): AuthenticatedUser {
  if (typeof payload === "string" || typeof payload.sub !== "string" || !payload.email || !payload.role) {
    throw AppError.unauthorized("Invalid token");
  }
  const id = Number(payload.sub);
  const role = roleSchema.safeParse(payload.role);
  if (!Number.isSafeInteger(id) || id <= 0 || typeof payload.email !== "string" || !role.success) {
    throw AppError.unauthorized("Invalid token");
  }
  return { id, email: payload.email, role: role.data };
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const [scheme, token] = req.header("authorization")?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) throw AppError.unauthorized("Missing or invalid token");
    req.user = parseActor(jwt.verify(token, env.JWT_SECRET));
    next();
  } catch (error) {
    next(error instanceof AppError ? error : AppError.unauthorized("Missing or invalid token"));
  }
}

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(AppError.unauthorized("Missing or invalid token"));
    if (!roles.includes(req.user.role)) return next(AppError.forbidden("Bạn không có quyền thực hiện thao tác này"));
    next();
  };
}
