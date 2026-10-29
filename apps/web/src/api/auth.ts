import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminSignupInput, LoginInput, Principal, RegisterInput } from '@fraud/shared';
import { api, ApiError } from './client';
import type { SecurityQuestion } from './types';

export const meKey = ['auth', 'me'] as const;

export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async (): Promise<Principal | null> => {
      try {
        return await api<Principal>('auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api<Principal>('auth/login', { method: 'POST', body: input }),
    onSuccess: (principal) => {
      qc.setQueryData(meKey, principal);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('auth/logout', { method: 'POST', body: {} }),
    onSettled: () => {
      qc.clear();
      qc.setQueryData(meKey, null);
    },
  });
}

export const register = (input: RegisterInput) =>
  api<{ message: string }>('auth/register', { method: 'POST', body: input });

export const adminSignup = (input: AdminSignupInput) =>
  api<{ message: string }>('auth/admin-signup', { method: 'POST', body: input });

export const adminSignupStatus = () => api<{ firstAdmin: boolean }>('auth/admin-signup/status');

export const forgotStart = (email: string) =>
  api<{ questions: { key: string; text: string }[] }>('auth/forgot-password/start', {
    method: 'POST',
    body: { email },
  });

export const forgotVerify = (answers: Record<string, string>) =>
  api<{ token: string; expiresAt: string }>('auth/forgot-password/verify', {
    method: 'POST',
    body: { answers },
  });

export type ResetTokenCheck =
  | { valid: true; expiresAt: string; userName: string }
  | { valid: false; reason: 'INVALID' | 'EXPIRED' };

export const checkResetToken = (token: string) => api<ResetTokenCheck>(`auth/reset-password/${token}`);

export const resetPassword = (token: string, password: string, confirmPassword: string) =>
  api<{ message: string }>('auth/reset-password', {
    method: 'POST',
    body: { token, password, confirmPassword },
  });

export function useSecurityQuestions() {
  return useQuery({
    queryKey: ['security-questions'],
    queryFn: () => api<SecurityQuestion[]>('security-questions'),
    staleTime: 5 * 60_000,
  });
}
