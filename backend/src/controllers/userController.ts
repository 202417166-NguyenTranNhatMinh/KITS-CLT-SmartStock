import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { userService } from '../services/userService';
import { sendSuccess } from '../common/response';
import { AppError } from '../common/errors';

const createUserSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(150),
  email: z.string().trim().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'STAFF']),
});

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

const idParamSchema = z.coerce.number().int().positive('Invalid user id');

export const userController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const users = await userService.getAllUsers();
      return sendSuccess(res, users, 'success', 200);
    } catch (err) {
      return next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = createUserSchema.parse(req.body);
      const user = await userService.createUser(payload);
      return sendSuccess(res, user, 'Created', 201);
    } catch (err) {
      return next(err);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = idParamSchema.parse(req.params.id);
      const { isActive } = updateStatusSchema.parse(req.body);
      if (!req.user) {
        throw AppError.unauthorized('Unauthorized');
      }
      const user = await userService.updateUserStatus(id, isActive, req.user.id);
      return sendSuccess(res, user, 'success', 200);
    } catch (err) {
      return next(err);
    }
  },
};