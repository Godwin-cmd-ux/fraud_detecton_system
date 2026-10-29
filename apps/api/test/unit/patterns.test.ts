import { describe, expect, it } from 'vitest';
import {
  checkLargeVolume,
  checkManyReceivers,
  checkManySenders,
} from '../../src/modules/fraud/patterns';
import type { VelocityContext } from '../../src/modules/fraud/patterns';

const base: VelocityContext = {
  transactionCountLast5Min: 0,
  amountLast5Min: 0,
  largeCountLast5Min: 0,
  largeSumLast5Min: 0,
  uniqueReceiversLast5Min: 0,
  receiverAlreadyInWindow: false,
  uniqueSendersToReceiverLast7Min: 0,
  senderAlreadyInReceiverWindow: false,
  uniqueSendersLast5Min: 0,
  failedWithdrawalsLast10Min: 0,
  avgUserAmount: 0,
};

describe('Pattern 1: large volume', () => {
  it('blocks the third large transaction when the total exceeds 10M', () => {
    const b = checkLargeVolume(1_500_000, { ...base, largeCountLast5Min: 2, largeSumLast5Min: 9_000_000 }, 'hi');
    expect(b).not.toBeNull();
    expect(b!.pattern).toBe(1);
    expect(b!.score).toBe(85);
    expect(b!.dbMessage).toBe(
      'BLOCKED: Large transaction volume - 3 large transactions totaling TSh 10,500,000.00 in 5 minutes (max: 3, 10M) | hi',
    );
    expect(b!.userMessage).toContain('You have made 3 large transactions totaling TSh 10,500,000.00');
  });

  it('does not count a small transaction toward the large count', () => {
    expect(checkLargeVolume(500_000, { ...base, largeCountLast5Min: 2, largeSumLast5Min: 9_000_000 })).toBeNull();
  });

  it('blocks even a tiny transfer once the window already holds 3 large over 10M', () => {
    expect(checkLargeVolume(100, { ...base, largeCountLast5Min: 3, largeSumLast5Min: 11_000_000 })).not.toBeNull();
  });

  it('allows a third large transaction when the total stays at or under 10M', () => {
    expect(checkLargeVolume(1_500_000, { ...base, largeCountLast5Min: 2, largeSumLast5Min: 5_000_000 })).toBeNull();
  });
});

describe('Pattern 2: many receivers', () => {
  it('blocks a new fourth receiver', () => {
    const b = checkManyReceivers({ ...base, uniqueReceiversLast5Min: 3, receiverAlreadyInWindow: false }, 'm');
    expect(b!.pattern).toBe(2);
    expect(b!.score).toBe(90);
    expect(b!.dbMessage).toBe(
      'BLOCKED: User has 3 unique receivers in 5 minutes. Attempting to send to 4 (max: 4) | m',
    );
    expect(b!.userMessage).toContain('Maximum allowed: 3 recipients per 5 minutes');
  });

  it('allows sending again to a receiver already in the window', () => {
    expect(checkManyReceivers({ ...base, uniqueReceiversLast5Min: 3, receiverAlreadyInWindow: true })).toBeNull();
  });

  it('allows a third distinct receiver', () => {
    expect(checkManyReceivers({ ...base, uniqueReceiversLast5Min: 2, receiverAlreadyInWindow: false })).toBeNull();
  });
});

describe('Pattern 3: many senders', () => {
  it('blocks a new third sender to the same receiver', () => {
    const b = checkManySenders({ ...base, uniqueSendersToReceiverLast7Min: 2, senderAlreadyInReceiverWindow: false });
    expect(b!.pattern).toBe(3);
    expect(b!.score).toBe(90);
    expect(b!.dbMessage).toBe(
      'BLOCKED: Receiver has 2 unique senders in 7 minutes. Attempting to receive from 3 (max: 3) | ',
    );
    expect(b!.userMessage).toContain('Maximum allowed: 2 senders per 7 minutes');
  });

  it('allows a sender already in the window', () => {
    expect(checkManySenders({ ...base, uniqueSendersToReceiverLast7Min: 2, senderAlreadyInReceiverWindow: true })).toBeNull();
  });

  it('allows a second distinct sender', () => {
    expect(checkManySenders({ ...base, uniqueSendersToReceiverLast7Min: 1, senderAlreadyInReceiverWindow: false })).toBeNull();
  });
});
