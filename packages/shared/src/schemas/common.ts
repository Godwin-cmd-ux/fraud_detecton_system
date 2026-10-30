import { z } from 'zod';
import { LOCATIONS } from '../constants';

/** A positive money amount with at most two decimals. */
export const amountSchema = z
  .number()
  .finite()
  .positive()
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
    message: 'Amount may have at most two decimal places',
  });

export const locationSchema = z.enum(LOCATIONS);

/** Page number from a query string; anything invalid becomes page 1. */
export const pageSchema = z.coerce.number().int().min(1).catch(1);

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const stripSpaces = (s: string) => s.replace(/\s+/g, '');

export const phoneSchema = z
  .string()
  .transform(stripSpaces)
  .pipe(z.string().regex(/^\+?[0-9]{10,15}$/, 'Phone must be 10-15 digits, e.g. +255712345678'));

export const cardNumberSchema = z
  .string()
  .transform(stripSpaces)
  .pipe(z.string().regex(/^[0-9]{16,20}$/, 'Card number must be 16-20 digits'));

/** Virtual cards issued by the system: 16 digits, always starting with 44. */
export const virtualCardSchema = z
  .string()
  .transform(stripSpaces)
  .pipe(z.string().regex(/^44[0-9]{14}$/, 'Enter the 16-digit card number (starts with 44)'));

/** Browser geolocation, captured silently when a form is submitted. */
export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type Coordinates = z.infer<typeof coordinatesSchema>;

/** Security-question answers keyed by question key; at least three must be non-empty. */
export const answersSchema = z
  .record(z.string(), z.string())
  .transform((rec) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(rec)) {
      const t = v.trim();
      if (t) out[k] = t;
    }
    return out;
  })
  .refine((rec) => Object.keys(rec).length >= 3, {
    message: 'Please answer at least 3 security questions',
  });
