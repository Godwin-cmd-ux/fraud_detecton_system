import { sql } from 'drizzle-orm';
import type pg from 'pg';
import { env } from '../../src/config/env';
import { createDb } from '../../src/db/client';
import type { Db } from '../../src/db/client';
import { ensureDatabase, runMigrations } from '../../src/db/migrate';

let current: { db: Db; pool: pg.Pool } | null = null;

export async function setupTestDb(): Promise<Db> {
  if (current) return current.db;
  const url = env.DATABASE_URL_TEST;
  await ensureDatabase(url);
  await runMigrations(url);
  current = createDb(url);
  return current.db;
}

export function testPool(): pg.Pool {
  if (!current) throw new Error('setupTestDb() has not been called');
  return current.pool;
}

const APP_TABLES = [
  'admin_actions',
  'transactions',
  'failed_withdrawal_attempts',
  'login_attempts',
  'failed_login_log',
  'sessions',
  'users',
  'admins',
  'security_questions',
];

export async function truncateAll(db: Db): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE TABLE ${APP_TABLES.join(', ')} RESTART IDENTITY CASCADE`));
}

export async function closeTestDb(): Promise<void> {
  if (current) {
    await current.pool.end();
    current = null;
  }
}
