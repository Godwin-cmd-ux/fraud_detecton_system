import { randomInt } from 'node:crypto';

/**
 * Virtual cards issued to every account.
 *
 * Numbers are 16 digits starting with `44` and carry a valid Luhn check digit, the way a real Visa
 * test card does; expiry is three years out and the CVC is three digits. Nothing here is a real
 * payment instrument — the number is an identifier the sender can type to address another customer.
 */

export const CARD_PREFIX = '44';

const luhnDigit = (partial: string): number => {
  let sum = 0;
  let double = true;
  for (let i = partial.length - 1; i >= 0; i -= 1) {
    let digit = Number(partial[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return (10 - (sum % 10)) % 10;
};

/** 15 digit body plus its Luhn check digit. */
export function cardNumber(): string {
  let body = CARD_PREFIX;
  while (body.length < 15) body += String(randomInt(0, 10));
  return `${body}${luhnDigit(body)}`;
}

/** `MM/YY`, three years from `from`. */
export function cardExpiry(from: Date = new Date()): string {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + 3);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}

export function cardCvc(): string {
  return String(randomInt(0, 1000)).padStart(3, '0');
}

export interface VirtualCard {
  number: string;
  expiry: string;
  cvc: string;
}

export function generateCard(from: Date = new Date()): VirtualCard {
  return { number: cardNumber(), expiry: cardExpiry(from), cvc: cardCvc() };
}

/** Shown on screens that must not print a full number. */
export const maskCard = (number: string): string => `•••• ${number.slice(-4)}`;
