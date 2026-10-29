import bcrypt from 'bcryptjs';
import type { Db } from '../../src/db/client';
import { admins, transactions, users } from '../../src/db/schema';
import type { NewTransaction } from '../../src/modules/transactions/repo';
import type { UserRow } from '../../src/modules/users/repo';
import { newTransactionId } from '../../src/lib/ids';

let counter = 0;
const next = () => ++counter;

export interface UserFixture {
  fullName: string;
  email: string;
  phone: string;
  cardNumber: string;
  password: string;
  balance: number;
  isApproved: boolean;
  isActive: boolean;
  createdAt: Date;
  lastKnownLocation: string | null;
  securityAnswers: Record<string, string> | null;
}

/** bcrypt is slow; cache hashes per plaintext within a test run. */
const hashCache = new Map<string, string>();
async function hash(plain: string): Promise<string> {
  const cached = hashCache.get(plain);
  if (cached) return cached;
  const h = await bcrypt.hash(plain, 4);
  hashCache.set(plain, h);
  return h;
}

export async function createUser(
  db: Db,
  o: Partial<UserFixture> = {},
): Promise<UserRow & { password: string }> {
  const n = next();
  const password = o.password ?? 'User@123';
  const fx: UserFixture = {
    fullName: o.fullName ?? `User ${n}`,
    email: o.email ?? `user${n}@test.local`,
    phone: o.phone ?? `+2557${String(n).padStart(8, '0')}`,
    cardNumber: o.cardNumber ?? `4${String(n).padStart(15, '0')}`,
    password,
    balance: o.balance ?? 1_000_000,
    isApproved: o.isApproved ?? true,
    isActive: o.isActive ?? true,
    createdAt: o.createdAt ?? new Date('2026-01-01T00:00:00Z'),
    lastKnownLocation: o.lastKnownLocation === undefined ? 'Dar es Salaam' : o.lastKnownLocation,
    securityAnswers: o.securityAnswers === undefined ? null : o.securityAnswers,
  };
  const answers =
    fx.securityAnswers ??
    (await (async () => {
      const h = await hash('test');
      return { mother_maiden: h, first_school: h, birth_city: h };
    })());
  const [row] = await db
    .insert(users)
    .values({
      fullName: fx.fullName,
      email: fx.email,
      phone: fx.phone,
      cardNumber: fx.cardNumber,
      passwordHash: await hash(password),
      balance: fx.balance.toFixed(2),
      isApproved: fx.isApproved,
      isActive: fx.isActive,
      createdAt: fx.createdAt,
      lastKnownLocation: fx.lastKnownLocation,
      securityAnswers: answers,
    })
    .returning();
  return { ...row!, password };
}

export async function createAdmin(
  db: Db,
  o: Partial<{ username: string; email: string; password: string; fullName: string; isActive: boolean }> = {},
): Promise<{ id: number; username: string; email: string; password: string; fullName: string }> {
  const n = next();
  const password = o.password ?? 'Admin@123';
  const username = o.username ?? `admin${n}`;
  const email = o.email ?? `admin${n}@test.local`;
  const fullName = o.fullName ?? `Admin ${n}`;
  const [row] = await db
    .insert(admins)
    .values({ username, email, fullName, passwordHash: await hash(password), isActive: o.isActive ?? true })
    .returning();
  return { id: row!.id, username, email, password, fullName };
}

let txSeq = 0;

/** Inserts a transaction row directly, allowing an explicit created_at for window tests. */
export async function insertTx(
  db: Db,
  o: Partial<NewTransaction> & { createdAt?: Date; now?: Date },
): Promise<{ id: number }> {
  const now = o.now ?? new Date();
  // Fixture ids use a sequence suffix so bulk inserts within one second never collide.
  const seqId = newTransactionId(now, () => 0).slice(0, -4) + String(1000 + (++txSeq % 9000));
  const [row] = await db
    .insert(transactions)
    .values({
      transactionId: o.transactionId ?? seqId,
      senderId: o.senderId ?? null,
      receiverId: o.receiverId ?? null,
      senderName: o.senderName ?? null,
      receiverName: o.receiverName ?? null,
      amount: (o.amount ?? 1000).toFixed(2),
      transactionType: o.transactionType ?? 'transfer',
      status: o.status ?? 'SUCCESS',
      message: o.message ?? null,
      fraudScore: (o.fraudScore ?? 0).toFixed(2),
      fraudPrediction: o.fraudPrediction ?? null,
      riskLevel: o.riskLevel ?? null,
      predictionTime: o.predictionTime ?? null,
      modelVersion: o.modelVersion ?? null,
      featureData: (o.featureData as Record<string, unknown> | null | undefined) ?? null,
      transactionLocation: o.transactionLocation ?? null,
      ipAddress: o.ipAddress ?? null,
      userAgent: o.userAgent ?? null,
      adminId: o.adminId ?? null,
      createdAt: o.createdAt ?? now,
    })
    .returning({ id: transactions.id });
  return { id: row!.id };
}
