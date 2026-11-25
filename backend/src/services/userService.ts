import bcrypt from 'bcryptjs';
import { AppError } from '../common/errors';
import { toUserDto, UserDto, userRepo, UserRole } from '../repo/userRepo';

export const userService = {
  async getAllUsers(): Promise<UserDto[]> {
    const users = await userRepo.findAll();
    return users.map(toUserDto);
  },

  async createUser(input: {
    fullName: string;
    email: string;
    password: string;
    role: UserRole;
  }): Promise<UserDto> {
    const existing = await userRepo.findByEmail(input.email);
    if (existing) {
      throw AppError.conflict('Email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const created = await userRepo.create({
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      passwordHash,
      role: input.role,
    });

    return toUserDto(created);
  },

  async updateUserStatus(id: number, isActive: boolean, actorId: number): Promise<UserDto> {
    if (id === actorId && !isActive) {
      throw AppError.badRequest('Cannot deactivate your own account');
    }

    const updated = await userRepo.updateStatus(id, isActive);
    if (!updated) {
      throw AppError.notFound('User not found');
    }

    return toUserDto(updated);
  },
};