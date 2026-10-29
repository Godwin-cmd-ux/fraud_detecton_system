import { darStamp } from './time';

/** `TXN` + Dar es Salaam timestamp + four random digits (1000-9999). */
export function newTransactionId(now: Date, rand: () => number = Math.random): string {
  const suffix = 1000 + Math.floor(rand() * 9000);
  return `TXN${darStamp(now)}${suffix}`;
}
