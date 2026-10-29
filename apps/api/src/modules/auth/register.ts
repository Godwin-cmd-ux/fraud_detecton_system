import { asc, eq, or } from 'drizzle-orm';
import type { RegisterInput } from '@fraud/shared';
import type { Db } from '../../db/client';
import { securityQuestions, users } from '../../db/schema';
import { HttpError } from '../../lib/errors';
import { hashPassword } from '../../lib/password';

export const DUPLICATE_USER_MSG = 'Email, phone number, or card number already exists';

export interface QuestionRow {
  id: number;
  key: string;
  text: string;
}

export async function listActiveQuestions(db: Db): Promise<QuestionRow[]> {
  return db
    .select({ id: securityQuestions.id, key: securityQuestions.questionKey, text: securityQuestions.questionText })
    .from(securityQuestions)
    .where(eq(securityQuestions.isActive, true))
    .orderBy(asc(securityQuestions.id));
}

/** Hashes each answer that matches an active question; fewer than three valid answers is a 400. */
export async function hashAnswers(db: Db, answers: Record<string, string>): Promise<Record<string, string>> {
  const active = new Set((await listActiveQuestions(db)).map((q) => q.key));
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    const v = value.trim();
    if (active.has(key) && v) out[key] = await hashPassword(v);
  }
  if (Object.keys(out).length < 3) {
    throw new HttpError(400, 'VALIDATION', 'Please answer at least 3 security questions');
  }
  return out;
}

export async function assertUserUnique(
  db: Db,
  email: string,
  phone: string,
  cardNumber: string,
): Promise<void> {
  const [dup] = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.email, email), eq(users.phone, phone), eq(users.cardNumber, cardNumber)))
    .limit(1);
  if (dup) throw new HttpError(409, 'DUPLICATE', DUPLICATE_USER_MSG);
}

export async function registerUser(db: Db, input: RegisterInput): Promise<{ id: number }> {
  await assertUserUnique(db, input.email, input.phone, input.cardNumber);
  const securityAnswers = await hashAnswers(db, input.answers);
  const [row] = await db
    .insert(users)
    .values({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      cardNumber: input.cardNumber,
      passwordHash: await hashPassword(input.password),
      balance: '0.00',
      securityAnswers,
      isApproved: false,
      isActive: true,
    })
    .returning({ id: users.id });
  return { id: row!.id };
}
