import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { ADJUSTMENT_TYPES, PAGE_SIZES } from '@fraud/shared';
import type {
  AddBalanceInput,
  AdminUserRow,
  CreateUserInput,
  Paginated,
  Principal,
  UserStatus,
  UsersQuery,
} from '@fraud/shared';
import type { Db } from '../../db/client';
import { transactions, users } from '../../db/schema';
import { HttpError } from '../../lib/errors';
import { newTransactionId } from '../../lib/ids';
import { formatTsh, num } from '../../lib/money';
import { hashPassword } from '../../lib/password';
import { assertUserUnique, hashAnswers } from '../auth/register';
import { creditBalance, insertTransaction } from '../transactions/repo';
import { logAdminAction } from './audit';

type Row = typeof users.$inferSelect;

export function userStatus(u: Pick<Row, 'isActive' | 'isApproved'>): UserStatus {
  if (!u.isActive) return 'inactive';
  if (!u.isApproved) return 'pending';
  return 'active';
}

export function toAdminUserRow(u: Row): AdminUserRow {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    balance: num(u.balance),
    cardLast4: u.cardNumber.slice(-4),
    isApproved: u.isApproved,
    isActive: u.isActive,
    status: userStatus(u),
    createdAt: u.createdAt.toISOString(),
  };
}

export async function listUsers(db: Db, q: UsersQuery): Promise<Paginated<AdminUserRow>> {
  const pageSize = PAGE_SIZES.ADMIN;
  const where = q.search
    ? or(
        ilike(users.fullName, `%${q.search}%`),
        ilike(users.email, `%${q.search}%`),
        ilike(users.phone, `%${q.search}%`),
      )
    : undefined;
  const [count] = await db.select({ c: sql<number>`count(*)::int` }).from(users).where(where);
  const total = count?.c ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(q.page, totalPages);
  const rows = await db
    .select()
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { items: rows.map(toAdminUserRow), page, pageSize, total, totalPages };
}

async function requireUserRow(db: Db, id: number): Promise<Row> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!row) throw new HttpError(404, 'NOT_FOUND', '❌ User not found!');
  return row;
}

export async function getUser(db: Db, id: number): Promise<AdminUserRow> {
  return toAdminUserRow(await requireUserRow(db, id));
}

export async function listPendingUsers(db: Db): Promise<AdminUserRow[]> {
  const rows = await db.select().from(users).where(eq(users.isApproved, false)).orderBy(desc(users.createdAt));
  return rows.map(toAdminUserRow);
}

export async function createUser(
  db: Db,
  input: CreateUserInput,
  admin: Principal,
  ip: string | null,
): Promise<{ id: number; message: string }> {
  await assertUserUnique(db, input.email, input.phone, input.cardNumber);
  const securityAnswers = await hashAnswers(db, input.answers);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(users)
      .values({
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        cardNumber: input.cardNumber,
        passwordHash: await hashPassword(input.password),
        balance: input.initialBalance.toFixed(2),
        securityAnswers,
        isApproved: input.isApproved,
        isActive: true,
      })
      .returning({ id: users.id });
    await logAdminAction(tx, {
      adminId: admin.id,
      adminName: admin.name,
      actionType: 'create_user',
      userId: row!.id,
      userName: input.fullName,
      amount: input.initialBalance,
      reason: 'User created by admin',
      details: `Security questions set: ${Object.keys(securityAnswers).length} answered`,
      ip,
    });
    return {
      id: row!.id,
      message: input.isApproved
        ? '✅ User created successfully! Account is active.'
        : '✅ User created successfully! Account requires approval.',
    };
  });
}

export type UserFlagAction = 'approve' | 'disapprove' | 'activate' | 'deactivate';

const FLAG_ACTIONS: Record<
  UserFlagAction,
  { column: 'isApproved' | 'isActive'; value: boolean; type: 'approve_user' | 'disapprove_user' | 'activate_user' | 'deactivate_user'; reason: string; details: string; message: string }
> = {
  approve: { column: 'isApproved', value: true, type: 'approve_user', reason: 'User account approved', details: 'User approved by admin', message: '✅ User approved successfully!' },
  disapprove: { column: 'isApproved', value: false, type: 'disapprove_user', reason: 'User account disapproved', details: 'User disapproved by admin', message: '✅ User disapproved successfully!' },
  activate: { column: 'isActive', value: true, type: 'activate_user', reason: 'User account activated', details: 'User activated by admin', message: '✅ User activated successfully!' },
  deactivate: { column: 'isActive', value: false, type: 'deactivate_user', reason: 'User account deactivated', details: 'User deactivated by admin', message: '✅ User deactivated successfully!' },
};

/** Flips one flag; a no-op transition is a 409. An explicit reason replaces the default audit reason. */
export async function setUserFlag(
  db: Db,
  id: number,
  action: UserFlagAction,
  admin: Principal,
  ip: string | null,
  reason?: string,
): Promise<{ message: string }> {
  const spec = FLAG_ACTIONS[action];
  const user = await requireUserRow(db, id);
  if (user[spec.column] === spec.value) {
    throw new HttpError(409, 'NO_CHANGE', `User is already ${action}d`);
  }
  await db.transaction(async (tx) => {
    await tx.update(users).set({ [spec.column]: spec.value, updatedAt: sql`now()` }).where(eq(users.id, id));
    await logAdminAction(tx, {
      adminId: admin.id,
      adminName: admin.name,
      actionType: spec.type,
      userId: id,
      userName: user.fullName,
      reason: reason?.trim() || spec.reason,
      details: reason?.trim() ? spec.reason : spec.details,
      ip,
    });
  });
  return { message: spec.message };
}

export async function rejectUser(
  db: Db,
  id: number,
  reason: string,
  admin: Principal,
  ip: string | null,
): Promise<{ message: string }> {
  const user = await requireUserRow(db, id);
  if (user.isApproved) throw new HttpError(409, 'NOT_PENDING', 'Only pending users can be rejected');
  await db.transaction(async (tx) => {
    await tx.delete(users).where(and(eq(users.id, id), eq(users.isApproved, false)));
    await logAdminAction(tx, {
      adminId: admin.id,
      adminName: admin.name,
      actionType: 'reject_user',
      userId: id,
      userName: user.fullName,
      reason,
      details: 'User account rejected',
      ip,
    });
  });
  return { message: '✅ User rejected and removed.' };
}

export async function deleteUser(db: Db, id: number, admin: Principal, ip: string | null): Promise<{ message: string }> {
  const user = await requireUserRow(db, id);
  await db.transaction(async (tx) => {
    await tx.delete(users).where(eq(users.id, id));
    await logAdminAction(tx, {
      adminId: admin.id,
      adminName: admin.name,
      actionType: 'delete_user',
      userId: id,
      userName: user.fullName,
      reason: 'User account deleted',
      details: `User deleted by admin - Email: ${user.email}`,
      ip,
    });
  });
  return { message: '🗑️ User deleted successfully!' };
}

export async function addBalance(
  db: Db,
  id: number,
  input: AddBalanceInput,
  admin: Principal,
  ip: string | null,
  userAgent: string | null,
  now: Date,
): Promise<{ newBalance: number; transactionId: string; message: string }> {
  const user = await requireUserRow(db, id);
  let transactionId = newTransactionId(now);
  await db.transaction(async (tx) => {
    await creditBalance(tx, id, input.amount);
    const inserted = await insertTransaction(tx, {
      transactionId,
      senderId: null,
      receiverId: id,
      senderName: null,
      receiverName: user.fullName,
      amount: input.amount,
      transactionType: input.type,
      status: 'SUCCESS',
      message: `Admin adjustment: ${input.reason}`,
      fraudScore: 0,
      fraudPrediction: null,
      riskLevel: null,
      predictionTime: null,
      modelVersion: null,
      featureData: null,
      transactionLocation: null,
      ipAddress: ip,
      userAgent,
      adminId: admin.id,
      createdAt: now,
    });
    transactionId = inserted.transactionId;
    await logAdminAction(tx, {
      adminId: admin.id,
      adminName: admin.name,
      actionType: 'add_balance',
      userId: id,
      userName: user.fullName,
      amount: input.amount,
      reason: input.reason,
      ip,
    });
  });
  const newBalance = Math.round((num(user.balance) + input.amount) * 100) / 100;
  return {
    newBalance,
    transactionId,
    message: `✅ Successfully added ${formatTsh(input.amount)} to ${user.fullName}'s account!`,
  };
}

export interface AdjustmentRow {
  id: number;
  transactionId: string;
  amount: number;
  type: string;
  reason: string | null;
  createdAt: string;
}

export async function listUserAdjustments(db: Db, id: number): Promise<AdjustmentRow[]> {
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.receiverId, id), inArray(transactions.transactionType, [...ADJUSTMENT_TYPES])))
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(10);
  return rows.map((r) => ({
    id: r.id,
    transactionId: r.transactionId,
    amount: num(r.amount),
    type: r.transactionType,
    reason: r.message,
    createdAt: r.createdAt.toISOString(),
  }));
}
