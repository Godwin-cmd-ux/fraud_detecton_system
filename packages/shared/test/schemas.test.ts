import { describe, expect, it } from 'vitest';
import {
  FRAUD,
  LOCATIONS,
  addBalanceSchema,
  adminSignupSchema,
  amountSchema,
  pageSchema,
  registerSchema,
} from '../src/index';

describe('amountSchema', () => {
  it('rejects more than two decimals, negatives and zero', () => {
    expect(amountSchema.safeParse(1000.005).success).toBe(false);
    expect(amountSchema.safeParse(-5).success).toBe(false);
    expect(amountSchema.safeParse(0).success).toBe(false);
  });

  it('accepts a valid amount with two decimals', () => {
    expect(amountSchema.safeParse(1000.5).success).toBe(true);
  });
});

const validRegister = {
  fullName: 'Amina Hassan',
  email: 'amina@example.com',
  phone: '+255 712 345 678',
  password: 'secret1',
  confirmPassword: 'secret1',
  cardNumber: '4532 0151 1283 0366',
  answers: { mother_maiden: 'a', first_school: 'b', birth_city: 'c' },
};

describe('registerSchema', () => {
  it('strips spaces from phone and card number', () => {
    const parsed = registerSchema.parse(validRegister);
    expect(parsed.phone).toBe('+255712345678');
    expect(parsed.cardNumber).toBe('4532015112830366');
  });

  it('rejects a phone with too few digits', () => {
    expect(registerSchema.safeParse({ ...validRegister, phone: '12345' }).success).toBe(false);
  });

  it('rejects when only two security answers are non-empty', () => {
    const r = registerSchema.safeParse({
      ...validRegister,
      answers: { mother_maiden: 'a', first_school: 'b', birth_city: '   ' },
    });
    expect(r.success).toBe(false);
  });

  it('rejects mismatched password confirmation', () => {
    expect(registerSchema.safeParse({ ...validRegister, confirmPassword: 'other1' }).success).toBe(
      false,
    );
  });
});

describe('adminSignupSchema', () => {
  const base = {
    fullName: 'Root Admin',
    username: 'root_admin',
    email: 'root@example.com',
    password: 'Password1!',
    confirmPassword: 'Password1!',
  };
  it('rejects a password without a special character', () => {
    expect(
      adminSignupSchema.safeParse({ ...base, password: 'Password1', confirmPassword: 'Password1' })
        .success,
    ).toBe(false);
  });
  it('accepts a password meeting every rule', () => {
    expect(adminSignupSchema.safeParse(base).success).toBe(true);
  });
});

describe('pageSchema', () => {
  it('falls back to page 1 for invalid input', () => {
    expect(pageSchema.parse('0')).toBe(1);
    expect(pageSchema.parse('abc')).toBe(1);
    expect(pageSchema.parse(undefined)).toBe(1);
    expect(pageSchema.parse('3')).toBe(3);
  });
});

describe('addBalanceSchema', () => {
  it('rejects amounts above the admin maximum and short reasons', () => {
    expect(
      addBalanceSchema.safeParse({ amount: 10_000_000.01, type: 'deposit', reason: 'a valid reason' })
        .success,
    ).toBe(false);
    expect(
      addBalanceSchema.safeParse({ amount: 100, type: 'deposit', reason: '123456789' }).success,
    ).toBe(false);
    expect(
      addBalanceSchema.safeParse({ amount: 100, type: 'bonus', reason: 'ten chars!' }).success,
    ).toBe(true);
  });
});

describe('constants', () => {
  it('exposes the fraud thresholds from the spec', () => {
    expect(FRAUD.LARGE_TX_THRESHOLD).toBe(1_000_000);
    expect(FRAUD.MANY_RECEIVERS_BLOCK_AT).toBe(4);
    expect(FRAUD.MANY_SENDERS_BLOCK_AT).toBe(3);
    expect(LOCATIONS).toHaveLength(10);
  });
});
