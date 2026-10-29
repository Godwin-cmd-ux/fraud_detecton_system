import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './client';

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');

export async function runMigrations(url: string): Promise<void> {
  const { db, pool } = createDb(url);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}

/** Create the database named in `url` if it does not exist (connects to the `postgres` db). */
export async function ensureDatabase(url: string): Promise<void> {
  const target = new URL(url);
  const dbName = target.pathname.replace(/^\//, '');
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const { pool } = createDb(admin.toString());
  try {
    const exists = await pool.query('select 1 from pg_database where datname = $1', [dbName]);
    if (exists.rowCount === 0) {
      await pool.query(`create database "${dbName.replace(/"/g, '""')}"`);
    }
  } finally {
    await pool.end();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const { env } = await import('../config/env');
  await ensureDatabase(env.DATABASE_URL);
  await runMigrations(env.DATABASE_URL);
  console.log(`Migrations applied to ${env.DATABASE_URL}`);
}
