import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load the repository-root .env (two levels above apps/api/src/config).
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../../../.env'), quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().default('postgres://postgres@localhost:5432/fraud_detection'),
  DATABASE_URL_TEST: z.string().default('postgres://postgres@localhost:5432/fraud_detection_test'),
  SESSION_SECRET: z.string().min(8).default('dev-session-secret-change-me'),
  ML_API_URL: z.string().url().default('http://localhost:5000'),
  ADMIN_SETUP_KEY: z.string().min(1).default('AdminSetupTZ'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /** Shared secret the Africa's Talking callback URL must carry (?token=...). */
  USSD_CALLBACK_SECRET: z.string().min(8).default('ussd-dev-secret'),
  /** Optional comma-separated source IP allowlist; empty allows any source (ngrok masks the IP). */
  USSD_ALLOWED_IPS: z.string().default(''),
  USSD_SESSION_TTL_SEC: z.coerce.number().int().positive().default(180),
  USSD_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(30),
});

export const env = envSchema.parse(process.env);
export type Env = typeof env;
