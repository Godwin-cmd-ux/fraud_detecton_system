import { and, eq, sql } from 'drizzle-orm';
import type { FraudPrediction, RiskLevel, TransactionStatus, TransactionType } from '@fraud/shared';
import type { Db } from '../../db/client';
import { transactions, users } from '../../db/schema';
import { newTransactionId } from '../../lib/ids';
import { money } from '../../lib/money';

export interface NewTransaction {
  createdAt?: Date;
  transactionId: string;
  senderId: number | null;
  receiverId: number | null;
  senderName: string | null;
  receiverName: string | null;
  amount: number;
  transactionType: TransactionType;
  status: TransactionStatus;
  message: string | null;
  fraudScore: number;
  fraudPrediction: FraudPrediction | null;
  riskLevel: RiskLevel | null;
  predictionTime: Date | null;
  modelVersion: string | null;
  featureData: Record<string, unknown> | null;
  transactionLocation: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  adminId: number | null;
}

const MAX_ID_ATTEMPTS = 5;

function isTransactionIdCollision(err: unknown): boolean {
  const cause = (err as { cause?: { code?: string; constraint?: string } })?.cause ?? err;
  return (
    (cause as { code?: string })?.code === '23505' &&
    (cause as { constraint?: string })?.constraint === 'transactions_transaction_id_unique'
  );
}

/**
 * Inserts the row; a transaction-id collision (same second, same random suffix) gets a fresh id.
 * Each attempt runs in its own savepoint so a failure cannot abort an enclosing transaction.
 * The id actually stored is returned and must be what callers report.
 */
export async function insertTransaction(
  tx: Db,
  t: NewTransaction,
): Promise<{ id: number; transactionId: string }> {
  let transactionId = t.transactionId;
  for (let attempt = 1; ; attempt++) {
    try {
      const id = await tx.transaction(async (sp) => {
        const [row] = await sp
          .insert(transactions)
          .values({ ...t, transactionId, amount: money(t.amount), fraudScore: money(t.fraudScore) })
          .returning({ id: transactions.id });
        return row!.id;
      });
      return { id, transactionId };
    } catch (err) {
      if (!isTransactionIdCollision(err) || attempt >= MAX_ID_ATTEMPTS) throw err;
      transactionId = newTransactionId(new Date());
    }
  }
}

/** Conditional debit; returns false (and changes nothing) when the balance is insufficient. */
export async function debitBalance(tx: Db, userId: number, amount: number): Promise<boolean> {
  const amt = money(amount);
  const result = await tx
    .update(users)
    .set({ balance: sql`${users.balance} - ${amt}::numeric`, updatedAt: sql`now()` })
    .where(and(eq(users.id, userId), sql`${users.balance} >= ${amt}::numeric`))
    .returning({ id: users.id });
  return result.length === 1;
}

export async function creditBalance(tx: Db, userId: number, amount: number): Promise<void> {
  const amt = money(amount);
  await tx
    .update(users)
    .set({ balance: sql`${users.balance} + ${amt}::numeric`, updatedAt: sql`now()` })
    .where(eq(users.id, userId));
}
