import bcrypt from 'bcryptjs';

const COST = 10;

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, COST);

export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);

export const phoneDigits = (value: string): string => value.replace(/\D/g, '');

/**
 * Accounts created over USSD use the phone number as their first web password, stored in
 * digits-only form. A customer may type it as `+255 700 000 001`, so the digits are compared
 * instead — and only when they are that account's own number.
 */
export async function matchesPhonePassword(
  typed: string,
  phone: string,
  hash: string,
): Promise<boolean> {
  const digits = phoneDigits(typed);
  if (digits.length < 9 || digits !== phoneDigits(phone)) return false;
  return verifyPassword(digits, hash);
}
