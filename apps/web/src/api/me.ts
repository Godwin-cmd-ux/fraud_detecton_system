import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChangePasswordInput,
  TransferInput,
  TransferResult,
  UserTransactionsQuery,
  WithdrawalInput,
  WithdrawalResult,
} from '@fraud/shared';
import { api, ApiError } from './client';
import type { SendContext, UserDashboard, UserTransactionsResponse, WithdrawContext } from './types';

const meKeys = {
  dashboard: ['me', 'dashboard'] as const,
  transactions: (q: Partial<UserTransactionsQuery>) => ['me', 'transactions', q] as const,
  sendContext: (receiverId?: number) => ['me', 'send-context', receiverId ?? null] as const,
  withdrawContext: ['me', 'withdraw-context'] as const,
};

export function useDashboard() {
  return useQuery({ queryKey: meKeys.dashboard, queryFn: () => api<UserDashboard>('me/dashboard') });
}

export function useVerifyPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (password: string): Promise<{ ok: boolean; message?: string }> => {
      try {
        return await api<{ ok: true }>('me/verify-password', { method: 'POST', body: { password } });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return { ok: false, message: e.message };
        throw e;
      }
    },
    onSuccess: (r) => {
      if (r.ok) void qc.invalidateQueries({ queryKey: meKeys.dashboard });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => api<void>('me/password', { method: 'POST', body: input }),
  });
}

export function useUserTransactions(q: Partial<UserTransactionsQuery>) {
  return useQuery({
    queryKey: meKeys.transactions(q),
    queryFn: () => api<UserTransactionsResponse>('me/transactions', { query: q }),
    placeholderData: (prev) => prev,
  });
}

export function useUnlockTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => api<void>('me/transactions/unlock', { method: 'POST', body: { password } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'transactions'] }),
  });
}

export function useLockTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('me/transactions/lock', { method: 'POST', body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'transactions'] }),
  });
}

export function useSendContext(receiverId?: number) {
  return useQuery({
    queryKey: meKeys.sendContext(receiverId),
    queryFn: () => api<SendContext>('me/send/context', { query: { receiverId } }),
    placeholderData: (prev) => prev,
  });
}

export function useTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TransferInput) => api<TransferResult>('me/transfers', { method: 'POST', body: input }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useWithdrawContext() {
  return useQuery({ queryKey: meKeys.withdrawContext, queryFn: () => api<WithdrawContext>('me/withdraw/context') });
}

export function useWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WithdrawalInput) => api<WithdrawalResult>('me/withdrawals', { method: 'POST', body: input }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
