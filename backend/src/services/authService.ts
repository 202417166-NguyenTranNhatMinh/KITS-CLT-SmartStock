import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../common/errors';
import { toUserDto, UserDto, userRepo } from '../repo/userRepo';
export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserDto;
}

const INVALID_CREDENTIALS_MSG = 'Invalid email or password';

export const authService = {
  async login(email: string, password: string): Promise<LoginResult> {
    const user = await userRepo.findByEmail(email);

    // Sai email, tài khoản bị khóa, hoặc sai mật khẩu -> trả 401 cùng 1 message
    if (!user || !user.is_active) {
      throw AppError.unauthorized(INVALID_CREDENTIALS_MSG);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw AppError.unauthorized(INVALID_CREDENTIALS_MSG);
    }

    const accessToken = jwt.sign(
      {
        sub: String(user.id),
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN_SECONDS }
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: env.JWT_EXPIRES_IN_SECONDS,
      user: toUserDto(user),
    };
  },

  async getMe(userId: number): Promise<UserDto> {
    const user = await userRepo.findById(userId);
    if (!user || !user.is_active) {
      throw AppError.unauthorized('Unauthorized');
    }
    return toUserDto(user);
  },
};