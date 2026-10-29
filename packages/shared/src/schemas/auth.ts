import { z } from 'zod';
import { answersSchema, cardNumberSchema, phoneSchema } from './common';

export const loginSchema = z.object({
  role: z.enum(['user', 'admin']),
  login: z.string().trim().min(1, 'Login is required'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

const passwordMin6 = z.string().min(6, 'Password must be at least 6 characters');

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Full name must be at least 3 characters'),
    email: z.string().trim().email('Valid email is required'),
    phone: phoneSchema,
    password: passwordMin6,
    confirmPassword: z.string(),
    cardNumber: cardNumberSchema,
    answers: answersSchema,
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((p) => /[A-Z]/.test(p), 'Password must contain an uppercase letter')
  .refine((p) => /[a-z]/.test(p), 'Password must contain a lowercase letter')
  .refine((p) => /[0-9]/.test(p), 'Password must contain a digit')
  .refine((p) => /[!@#$%^&*(),.?":{}|<>]/.test(p), 'Password must contain a special character');

export const adminSignupSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Full name must be at least 3 characters'),
    username: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_]{3,}$/, 'Username must be at least 3 letters, digits or underscores'),
    email: z.string().trim().email('Valid email is required'),
    password: strongPasswordSchema,
    confirmPassword: z.string(),
    secretKey: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type AdminSignupInput = z.infer<typeof adminSignupSchema>;

export const forgotStartSchema = z.object({ email: z.string().trim().email() });
export const forgotVerifySchema = z.object({ answers: z.record(z.string(), z.string()) });
export const resetPasswordSchema = z
  .object({
    token: z.string().length(64),
    password: passwordMin6,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const principalSchema = z.object({
  kind: z.enum(['user', 'admin']),
  id: z.number(),
  name: z.string(),
  email: z.string(),
});
export type Principal = z.infer<typeof principalSchema>;
