import { z } from 'zod';
import { ADJUSTMENT_TYPES, FRAUD, RISK_LEVELS, TRANSACTION_STATUSES } from '../constants';
import {
  amountSchema,
  answersSchema,
  cardNumberSchema,
  dateOnlySchema,
  pageSchema,
  phoneSchema,
} from './common';
import { fraudFilterSchema } from './user';

export const createUserSchema = z.object({
  fullName: z.string().trim().min(3, 'Full name must be at least 3 characters'),
  email: z.string().trim().email('Valid email is required'),
  phone: phoneSchema,
  password: z.string().min(6, 'Password must be at least 6 characters'),
  initialBalance: z
    .number()
    .min(0, 'Initial balance cannot be negative')
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'At most two decimals')
    .default(0),
  cardNumber: cardNumberSchema,
  isApproved: z.boolean().default(true),
  answers: answersSchema,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const addBalanceSchema = z.object({
  amount: amountSchema.refine(
    (v) => v <= FRAUD.MAX_ADMIN_ADJUSTMENT,
    'Maximum amount per transaction is TSh 10,000,000',
  ),
  type: z.enum(ADJUSTMENT_TYPES),
  reason: z.string().trim().min(10, 'Reason must be at least 10 characters'),
});
export type AddBalanceInput = z.infer<typeof addBalanceSchema>;

export const reasonSchema = z.object({ reason: z.string().trim().min(1, 'Reason is required') });
export const optionalReasonSchema = z.object({ reason: z.string().trim().optional() });

export const usersQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: pageSchema,
});
export type UsersQuery = z.infer<typeof usersQuerySchema>;

export const adminTransactionsQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(TRANSACTION_STATUSES).optional(),
  type: z.enum(['transfer', 'deposit', 'withdrawal']).optional(),
  riskLevel: z.enum(RISK_LEVELS).optional(),
  fraud: fraudFilterSchema.optional(),
  page: pageSchema,
});
export type AdminTransactionsQuery = z.infer<typeof adminTransactionsQuerySchema>;

export const fraudAlertsQuerySchema = z.object({
  search: z.string().trim().optional(),
  riskLevel: z.enum(RISK_LEVELS).optional(),
  dateFrom: dateOnlySchema.optional(),
  dateTo: dateOnlySchema.optional(),
  reviewed: z.enum(['all', 'unreviewed', 'reviewed']).default('unreviewed'),
  page: pageSchema,
});
export type FraudAlertsQuery = z.infer<typeof fraudAlertsQuerySchema>;

export const balanceAdjustmentsQuerySchema = z.object({
  search: z.string().trim().optional(),
  type: z.enum(ADJUSTMENT_TYPES).optional(),
  adminId: z.coerce.number().int().positive().optional(),
  dateFrom: dateOnlySchema.optional(),
  dateTo: dateOnlySchema.optional(),
  page: pageSchema,
});
export type BalanceAdjustmentsQuery = z.infer<typeof balanceAdjustmentsQuerySchema>;

export type UserStatus = 'inactive' | 'pending' | 'active';

export interface AdminUserRow {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  balance: number;
  cardLast4: string;
  isApproved: boolean;
  isActive: boolean;
  status: UserStatus;
  createdAt: string;
}
