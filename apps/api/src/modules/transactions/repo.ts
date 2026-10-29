import { and, eq, sql } from 'drizzle-orm';
import type { FraudPrediction, RiskLevel, TransactionStatus, TransactionType } from '@fraud/shared';
import type { Db } from '../../db/client';
import { transactions, users } from '../../db/schema';
import { money } from '../../lib/money';

export interface NewTransaction {
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

export async function insertTransaction(tx: Db, t: NewTransaction): Promise<{ id: number }> {
  const [row] = await tx
    .insert(transactions)
    .values({
      ...t,
      amount: money(t.amount),
      fraudScore: money(t.fraudScore),
    })
    .returning({ id: transactions.id });
  return { id: row!.id };
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
