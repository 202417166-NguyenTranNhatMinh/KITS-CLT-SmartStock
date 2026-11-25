import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService';
import { sendSuccess } from '../common/response';
import { AppError } from '../common/errors';

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const data = await authService.login(email, password);
      return sendSuccess(res, data, 'success', 200);
    } catch (err) {
      return next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Unauthorized');
      }
      const user = await authService.getMe(req.user.id);
      return sendSuccess(res, user, 'success', 200);
    } catch (err) {
      return next(err);
    }
  },
};