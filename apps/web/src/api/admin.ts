import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddBalanceInput,
  AdminTransactionsQuery,
  AdminUserRow,
  BalanceAdjustmentsQuery,
  CreateUserInput,
  FraudAlertsQuery,
  UsersQuery,
} from '@fraud/shared';
import { api } from './client';
import type {
  AdjustmentRow,
  AdminCounters,
  AdminDashboard,
  AdminSummary,
  AdminTxDetails,
  AdminTxRow,
  BalanceAdjustmentsResponse,
  FraudOverview,
  Paged,
} from './types';

const ADMIN = ['admin'] as const;

/** Every admin mutation invalidates all admin queries so counters and lists stay current. */
function useAdminMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries({ queryKey: ADMIN }) });
}

export function useAdminCounters() {
  return useQuery({
    queryKey: [...ADMIN, 'counters'],
    queryFn: () => api<AdminCounters>('admin/counters'),
    refetchInterval: 30_000,
  });
}

export function useAdminDashboard() {
  return useQuery({ queryKey: [...ADMIN, 'dashboard'], queryFn: () => api<AdminDashboard>('admin/dashboard') });
}

export function useAdminUsers(q: Partial<UsersQuery>) {
  return useQuery({
    queryKey: [...ADMIN, 'users', q],
    queryFn: () => api<Paged<AdminUserRow>>('admin/users', { query: q }),
    placeholderData: (prev) => prev,
  });
}

export function useAdminUser(id: number | undefined) {
  return useQuery({
    queryKey: [...ADMIN, 'user', id],
    queryFn: () => api<AdminUserRow>(`admin/users/${id}`),
    enabled: id !== undefined,
  });
}

export function usePendingUsers() {
  return useQuery({ queryKey: [...ADMIN, 'pending-users'], queryFn: () => api<AdminUserRow[]>('admin/pending-users') });
}

export function useCreateUser() {
  return useAdminMutation((input: CreateUserInput) =>
    api<{ id: number; message: string }>('admin/users', { method: 'POST', body: input }),
  );
}

export type UserAction = 'approve' | 'disapprove' | 'activate' | 'deactivate';

export function useUserAction() {
  return useAdminMutation((a: { id: number; action: UserAction; reason?: string }) =>
    api<{ message: string }>(`admin/users/${a.id}/${a.action}`, { method: 'POST', body: { reason: a.reason } }),
  );
}

export function useRejectUser() {
  return useAdminMutation((a: { id: number; reason: string }) =>
    api<{ message: string }>(`admin/users/${a.id}/reject`, { method: 'POST', body: { reason: a.reason } }),
  );
}

export function useDeleteUser() {
  return useAdminMutation((id: number) => api<{ message: string }>(`admin/users/${id}`, { method: 'DELETE' }));
}

export function useAddBalance() {
  return useAdminMutation((a: { id: number } & AddBalanceInput) =>
    api<{ newBalance: number; transactionId: string; message: string }>(`admin/users/${a.id}/balance`, {
      method: 'POST',
      body: { amount: a.amount, type: a.type, reason: a.reason },
    }),
  );
}

export function useUserAdjustments(id: number | undefined) {
  return useQuery({
    queryKey: [...ADMIN, 'user-adjustments', id],
    queryFn: () => api<AdjustmentRow[]>(`admin/users/${id}/adjustments`),
    enabled: id !== undefined,
  });
}

export function useAdminTransactions(q: Partial<AdminTransactionsQuery>) {
  return useQuery({
    queryKey: [...ADMIN, 'transactions', q],
    queryFn: () => api<Paged<AdminTxRow>>('admin/transactions', { query: q }),
    placeholderData: (prev) => prev,
  });
}

export function useAdminTransaction(id: number | undefined) {
  return useQuery({
    queryKey: [...ADMIN, 'transaction', id],
    queryFn: () => api<AdminTxDetails>(`admin/transactions/${id}`),
    enabled: id !== undefined,
  });
}

export function useMarkReviewed() {
  return useAdminMutation((id: number) =>
    api<{ message: string }>(`admin/transactions/${id}/review`, { method: 'POST', body: {} }),
  );
}

export function useFraudAlerts(q: Partial<FraudAlertsQuery>) {
  return useQuery({
    queryKey: [...ADMIN, 'fraud-alerts', q],
    queryFn: () => api<Paged<AdminTxRow>>('admin/fraud-alerts', { query: q }),
    placeholderData: (prev) => prev,
  });
}

export function useBalanceAdjustments(q: Partial<BalanceAdjustmentsQuery>) {
  return useQuery({
    queryKey: [...ADMIN, 'balance-adjustments', q],
    queryFn: () => api<BalanceAdjustmentsResponse>('admin/balance-adjustments', { query: q }),
    placeholderData: (prev) => prev,
  });
}

export function useAdmins() {
  return useQuery({ queryKey: [...ADMIN, 'admins'], queryFn: () => api<AdminSummary[]>('admin/admins') });
}

export function useFraudOverview() {
  return useQuery({ queryKey: [...ADMIN, 'fraud-overview'], queryFn: () => api<FraudOverview>('admin/fraud-overview') });
}
