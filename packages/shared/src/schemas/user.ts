import { z } from 'zod';
import { TRANSACTION_STATUSES } from '../constants';
import type { FraudPrediction, RiskLevel, TransactionStatus, TransactionType } from '../constants';
import { amountSchema, coordinatesSchema, locationSchema, pageSchema, virtualCardSchema } from './common';

/**
 * A transfer identifies the recipient by card number (what the web form asks for) or by id (what
 * USSD and the tests use). `location` is only sent by channels without geolocation; the web app
 * posts silent `coordinates` instead and the API resolves the city from them.
 */
export const transferSchema = z
  .object({
    receiverId: z.number().int().positive().optional(),
    cardNumber: virtualCardSchema.optional(),
    amount: amountSchema,
    location: locationSchema.optional(),
    coordinates: coordinatesSchema.optional(),
    message: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.receiverId !== undefined || d.cardNumber !== undefined, {
    message: 'Enter the recipient card number',
    path: ['cardNumber'],
  });
export type TransferInput = z.infer<typeof transferSchema>;

export const withdrawalSchema = z.object({
  amount: amountSchema,
  location: locationSchema.optional(),
  coordinates: coordinatesSchema.optional(),
  message: z.string().trim().max(500).optional(),
});
export type WithdrawalInput = z.infer<typeof withdrawalSchema>;

/** Card number typed by the sender to reveal the recipient's name before confirming. */
export const cardLookupQuerySchema = z.object({ cardNumber: virtualCardSchema });
export type CardLookupQuery = z.infer<typeof cardLookupQuerySchema>;

export const verifyPasswordSchema = z.object({ password: z.string().min(1) });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const fraudFilterSchema = z.enum(['fraud', 'legit', 'pending']);
export type FraudFilter = z.infer<typeof fraudFilterSchema>;

export const userTransactionsQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(TRANSACTION_STATUSES).optional(),
  fraud: fraudFilterSchema.optional(),
  page: pageSchema,
});
export type UserTransactionsQuery = z.infer<typeof userTransactionsQuerySchema>;

export type TransferResult =
  | {
      outcome: 'blocked';
      reason: string;
      message: string;
      riskScore: number;
      riskLevel: RiskLevel;
      transactionId: string;
      locationWarning?: string;
    }
  | {
      outcome: 'success';
      message: string;
      transactionId: string;
      newBalance: number;
      riskScore: number;
      riskLevel: RiskLevel;
      /** Present on successful transfers and withdrawals so a receipt can be generated. */
      fraudPrediction: FraudPrediction;
      /** When the transaction was recorded (ISO 8601). */
      createdAt: string;
      flaggedForReview: boolean;
      locationWarning?: string;
    };

export type WithdrawalResult =
  | TransferResult
  | { outcome: 'failed'; message: string; failedAttempts: number; blocked: boolean };

export type TransactionDirection = 'sent' | 'received' | 'withdrawal' | 'deposit';

export interface TransactionListItem {
  id: number;
  transactionId: string;
  type: TransactionType;
  direction: TransactionDirection;
  counterpartyName: string | null;
  amount: number;
  status: TransactionStatus;
  fraudScore: number;
  fraudPrediction: FraudPrediction | null;
  riskLevel: RiskLevel | null;
  message: string | null;
  location: string | null;
  createdAt: string;
}
