import { eq } from 'drizzle-orm';
import type { Principal } from '@fraud/shared';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import { generateCard } from '../lib/card';
import { HttpError } from '../lib/errors';
import { money } from '../lib/money';
import { hashPassword } from '../lib/password';
import { logAdminAction } from '../modules/admin/audit';
import { assertUserUnique } from '../modules/auth/register';

/**
 * USSD account creation.
 *
 * The web form collects a password plus three security answers; those cannot be typed on a USSD
 * keypad in a reasonable number of screens. The USSD flow therefore collects the identity fields
 * and a transaction PIN, sets an unguessable placeholder password, and leaves the security answers
 * unset — the customer finishes that on the web before password reset becomes available. Approval
 * rules are unchanged: the account is created unapproved.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CARD_RE = /^\d{16,20}$/;

export const isValidEmail = (value: string): boolean => EMAIL_RE.test(value.trim());
export const isValidCard = (value: string): boolean => CARD_RE.test(value.replace(/\s+/g, ''));

/**
 * Initial web password for an account created over USSD.
 *
 * The keypad flow cannot collect a password, so the number the customer registered with becomes
 * the first password for the website, where the dashboard lets them choose a new one. Only the
 * digits are used so the same secret works whether the number is typed with `+`, spaces or a
 * leading zero. The login form accepts both spellings.
 */
export const initialPasswordFor = (phone: string): string => phone.replace(/\D/g, '');

export interface UssdRegistrationInput {
  fullName: string;
  email: string;
  phone: string;
  /** Already bcrypt-hashed by the PIN enrolment screens. */
  pinHash: string;
  /** Accepted for older callers; the card is always issued by the server. */
  cardNumber?: string;
}

export async function registerViaUssd(db: Db, input: UssdRegistrationInput): Promise<{ id: number }> {
  const card = generateCard();
  await assertUserUnique(db, input.email.trim(), input.phone, card.number);
  const [row] = await db
    .insert(users)
    .values({
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone,
      cardNumber: card.number,
      cardExpiry: card.expiry,
      cardCvc: card.cvc,
      passwordHash: await hashPassword(initialPasswordFor(input.phone)),
      balance: '0.00',
      securityAnswers: null,
      isApproved: false,
      isActive: true,
      transactionPinHash: input.pinHash,
    })
    .returning({ id: users.id });
  return { id: row!.id };
}

export interface UssdAdminCreateInput {
  fullName: string;
  email: string;
  phone: string;
  initialBalance: number;
  isApproved: boolean;
  /** Accepted for older callers; the card is always issued by the server. */
  cardNumber?: string;
}

/**
 * Administrator-created account (menu 4). Reuses the shared uniqueness rules and writes the same
 * audit row type as the web "create user" action.
 */
export async function createUserViaUssd(
  db: Db,
  input: UssdAdminCreateInput,
  admin: Principal,
  ip: string | null,
): Promise<{ id: number }> {
  const card = generateCard();
  await assertUserUnique(db, input.email.trim(), input.phone, card.number);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(users)
      .values({
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone,
        cardNumber: card.number,
        cardExpiry: card.expiry,
        cardCvc: card.cvc,
        passwordHash: await hashPassword(initialPasswordFor(input.phone)),
        balance: money(input.initialBalance),
        securityAnswers: null,
        isApproved: input.isApproved,
        isActive: true,
      })
      .returning({ id: users.id });
    await logAdminAction(tx, {
      adminId: admin.id,
      adminName: admin.name,
      actionType: 'create_user',
      userId: row!.id,
      userName: input.fullName.trim(),
      amount: input.initialBalance,
      reason: 'User created by admin via USSD',
      details: `USSD account creation. Balance ${money(input.initialBalance)}, approved: ${input.isApproved}`,
      ip,
    });
    return { id: row!.id };
  });
}

export async function userExists(db: Db, id: number): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  return !!row;
}

export { HttpError };
