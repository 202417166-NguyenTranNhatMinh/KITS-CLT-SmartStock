import { pool } from '../config/db';

export type UserRole = 'ADMIN' | 'STAFF';

export interface UserEntity {
  id: number;
  full_name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
}

export interface UserDto {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}

export function toUserDto(entity: UserEntity): UserDto {
  return {
    id: entity.id,
    fullName: entity.full_name,
    email: entity.email,
    role: entity.role,
    isActive: entity.is_active,
    createdAt: entity.created_at,
  };
}

export const userRepo = {
  async findByEmail(email: string): Promise<UserEntity | null> {
    const result = await pool.query<UserEntity>(
      `SELECT id, full_name, email, password_hash, role, is_active, created_at
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email]
    );
    return result.rows[0] ?? null;
  },

  async findById(id: number): Promise<UserEntity | null> {
    const result = await pool.query<UserEntity>(
      `SELECT id, full_name, email, password_hash, role, is_active, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    return result.rows[0] ?? null;
  },
  async findAll(): Promise<UserEntity[]> {
    const result = await pool.query<UserEntity>(
      `SELECT id, full_name, email, password_hash, role, is_active, created_at
       FROM users
       ORDER BY id ASC`
    );
    return result.rows;
  },

  async create(params: {
    fullName: string;
    email: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<UserEntity> {
    const result = await pool.query<UserEntity>(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, full_name, email, password_hash, role, is_active, created_at`,
      [params.fullName, params.email, params.passwordHash, params.role]
    );
    return result.rows[0];
  },

  async updateStatus(id: number, isActive: boolean): Promise<UserEntity | null> {
    const result = await pool.query<UserEntity>(
      `UPDATE users
       SET is_active = $2
       WHERE id = $1
       RETURNING id, full_name, email, password_hash, role, is_active, created_at`,
      [id, isActive]
    );
    return result.rows[0] ?? null;
  },
};
