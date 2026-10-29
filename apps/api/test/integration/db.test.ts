import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { seed } from '../../src/db/seed';
import { closeTestDb, setupTestDb, testPool, truncateAll } from '../helpers/db';
import type { Db } from '../../src/db/client';

let db: Db;

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll(db);
});

afterAll(async () => {
  await closeTestDb();
});

describe('database schema and seed', () => {
  it('seeds idempotently with one admin, six questions and demo users', async () => {
    const first = await seed(db);
    await seed(db);

    const admins = await db.execute(sql`select count(*)::int as c from admins`);
    expect(admins.rows[0]).toEqual({ c: 1 });

    const questions = await db.execute(sql`select count(*)::int as c from security_questions`);
    expect(questions.rows[0]).toEqual({ c: 6 });

    const users = await db.execute(sql`select count(*)::int as c from users`);
    expect(users.rows[0]).toEqual({ c: 4 });

    const admin = await db.execute(
      sql`select password_hash from admins where username = ${first.adminUsername}`,
    );
    const hash = (admin.rows[0] as { password_hash: string }).password_hash;
    expect(await bcrypt.compare(first.adminPassword, hash)).toBe(true);
  });

  it('enforces a non-negative balance in the database', async () => {
    await expect(
      testPool().query(`update users set balance = -1 where email = 'amina@example.com'`),
    ).rejects.toThrow(/check constraint|violates/i);
  });

  it('truncateAll empties the tables', async () => {
    await truncateAll(db);
    const users = await db.execute(sql`select count(*)::int as c from users`);
    expect(users.rows[0]).toEqual({ c: 0 });
  });
});
