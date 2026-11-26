import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: Number(process.env.PORT) || 4000,
  DATABASE_URL: process.env.DATABASE_URL || '',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-jwt-secret-change-in-production',
  JWT_EXPIRES_IN_SECONDS: Number(process.env.JWT_EXPIRES_IN_SECONDS) || 3600, // 60 phút
  NODE_ENV: process.env.NODE_ENV || 'development',
  LLM_PROVIDER: process.env.LLM_PROVIDER || 'auto',
  LLM_BASE_URL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
  LLM_API_KEY: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '',
  LLM_MODEL: process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
  LLM_TIMEOUT_MS: Number(process.env.LLM_TIMEOUT_MS) || 30000,
};