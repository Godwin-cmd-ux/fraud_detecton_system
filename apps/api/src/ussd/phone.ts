/**
 * Phone handling for the USSD gateway.
 *
 * Africa's Talking delivers `phoneNumber` in international form (`+255712345678`), while the same
 * customer may have registered on the web as `0712345678` or `255712345678`. Everything is
 * canonicalised to `+255XXXXXXXXX` and matched in SQL on the digits only, so one customer maps to
 * exactly one account regardless of how the number was typed.
 */

const COUNTRY_CODE = '255';
const MSISDN_LENGTH = 9;

/** `+255712345678` for any recognisable Tanzanian number, otherwise null. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith(`${COUNTRY_CODE}0`)) digits = digits.slice(4);
  else if (digits.startsWith(COUNTRY_CODE)) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  if (!new RegExp(`^\\d{${MSISDN_LENGTH}}$`).test(digits)) return null;
  return `+${COUNTRY_CODE}${digits}`;
}

/** The bare `255XXXXXXXXX` form used to compare against stored numbers in SQL. */
export const phoneDigits = (normalized: string): string => normalized.replace(/\D/g, '');

/** `+2557*****001`, used in lists where a full number is not needed. */
export function maskPhone(normalized: string | null): string {
  if (!normalized) return 'n/a';
  return normalized.length > 7 ? `${normalized.slice(0, 5)}***${normalized.slice(-3)}` : normalized;
}
