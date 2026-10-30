/**
 * Revenue model.
 *
 * Every successful movement of money earns the business a fee: 0.8% of a transfer, paid by the
 * sender, and 1.1% of a withdrawal, paid by the customer. The fee is recorded on the transaction
 * row, so the admin dashboard can report daily revenue straight from the ledger.
 */
export const FEES = {
  TRANSFER_RATE: 0.008,
  WITHDRAWAL_RATE: 0.011,
} as const;

/**
 * Fee on an amount, rounded to the smallest unit (two decimals) so the ledger never carries
 * fractions of a cent.
 */
export function feeFor(amount: number, rate: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * rate * 100) / 100;
}

/** Percentage label for the UI: 0.008 -> "0.8%". */
export const feePercent = (rate: number): string => `${Math.round(rate * 1000) / 10}%`;

/** What leaves the customer's balance for a movement: the amount plus its fee. */
export function totalWithFee(amount: number, rate: number): number {
  return Math.round((amount + feeFor(amount, rate)) * 100) / 100;
}
