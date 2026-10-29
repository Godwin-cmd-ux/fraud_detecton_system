import type { AdminActionType } from '@fraud/shared';
import type { Db } from '../../db/client';
import { adminActions } from '../../db/schema';
import { money } from '../../lib/money';

export interface AdminActionLog {
  adminId: number;
  adminName: string;
  actionType: AdminActionType;
  userId?: number | null;
  userName?: string | null;
  amount?: number | null;
  reason?: string | null;
  details?: string | null;
  ip: string | null;
}

/** Every admin action writes one audit row (the original only did so for some). */
export async function logAdminAction(tx: Db, a: AdminActionLog): Promise<void> {
  await tx.insert(adminActions).values({
    adminId: a.adminId,
    adminName: a.adminName,
    actionType: a.actionType,
    userId: a.userId ?? null,
    userName: a.userName ?? null,
    amount: a.amount === null || a.amount === undefined ? null : money(a.amount),
    reason: a.reason ?? null,
    details: a.details ?? null,
    ipAddress: a.ip,
  });
}
