import bcrypt from 'bcryptjs';
import type { Result, Ctx } from '../machine';
import { defineScene } from '../machine';
import { PIN_POLICY, hashPin, isWellFormedPin, storePinHash } from '../pin';
import type { PinCheck } from '../pin';
import { logSecurityEvent } from '../repo';
import { money } from '../text';

/**
 * Shared PIN screens.
 *
 * The first entry is hashed immediately, so neither screen ever keeps a plaintext PIN: only the
 * bcrypt digest travels through session state, exactly as it is stored in the users/admins table.
 */

export const PIN_PROMPT = `Enter ${PIN_POLICY.length}-digit PIN`;

defineScene('pin.new', async (c) => {
  if (!c.actor) return { text: 'Session expired. Dial again.', end: true };
  const ask = `Set transaction PIN\n${PIN_PROMPT}\n0. Cancel`;
  if (c.input === '' || !isWellFormedPin(c.input)) {
    return {
      text: c.input === '' ? ask : `PIN must be ${PIN_POLICY.length} digits.\n${PIN_PROMPT}`,
      scene: 'pin.new',
    };
  }
  return {
    text: 'Confirm your new PIN',
    scene: 'pin.confirm',
    data: { pinh: await hashPin(c.input) },
  };
});

defineScene('pin.confirm', async (c) => {
  if (!c.actor) return { text: 'Session expired. Dial again.', end: true };
  const stored = c.state.data.pinh;
  if (!stored) return { text: `Set transaction PIN\n${PIN_PROMPT}`, scene: 'pin.new', data: { pinh: '' } };
  if (c.input === '') return { text: 'Confirm your new PIN\n0. Cancel' };

  if (!(await bcrypt.compare(c.input, stored))) {
    return { text: `PINs do not match.\n${PIN_PROMPT}`, scene: 'pin.new', data: { pinh: '' } };
  }

  await storePinHash(c.db, c.actor.kind, c.actor.id, stored);
  return resumeAfterPin(c);
});

/** Returns to whatever action was waiting for a PIN, keeping the collected inputs. */
async function resumeAfterPin(c: Ctx): Promise<Result> {
  const target = c.state.data.return ?? '';
  const summary = c.state.data.summary ?? '';
  const amount = Number(c.state.data.amount ?? 0);
  const patch = { pinh: '', return: '' };

  switch (target) {
    case 'user.send.pin':
      return {
        text: `PIN set.\nSend ${money(amount)} to ${c.state.data.rname ?? ''}\n${PIN_PROMPT}`,
        scene: target,
        data: patch,
      };
    case 'user.withdraw.pin':
      return { text: `PIN set.\nWithdraw ${money(amount)}\n${PIN_PROMPT}`, scene: target, data: patch };
    case 'admin.balance.pin':
      return { text: `PIN set.\n${summary}\n${PIN_PROMPT}`, scene: target, data: patch };
    case 'admin.create.pin':
      return { text: `PIN set.\n${summary}\n${PIN_PROMPT}`, scene: target, data: patch };
    default:
      return { text: 'PIN set. Dial again to continue.', end: true, clearData: true };
  }
}

/**
 * One place to turn a failed PIN check into a screen: wrong PIN keeps the workflow alive, while a
 * lockout ends the session so the customer cannot keep guessing.
 */
export async function handlePinFailure(
  c: Ctx,
  check: Extract<PinCheck, { ok: false }>,
  scene: string,
): Promise<Result> {
  const who = c.actor ? `${c.actor.kind}:${c.actor.id}` : 'unknown';

  if (check.reason === 'locked') {
    await logSecurityEvent(c.db, {
      type: 'PIN_LOCKED',
      phone: c.phone,
      sessionId: c.sessionId,
      detail: `${who} attempted a PIN while locked`,
      ip: c.ip,
      now: c.now,
    });
    return { text: `PIN locked for ${check.minutesLeft} min.\nTry again later.`, end: true };
  }

  await logSecurityEvent(c.db, {
    type: 'PIN_FAILED',
    phone: c.phone,
    sessionId: c.sessionId,
    detail: `${who} wrong PIN (${check.attemptsLeft} left)`,
    ip: c.ip,
    now: c.now,
  });

  if (check.attemptsLeft <= 0) {
    return { text: `Too many wrong PINs.\nLocked for ${PIN_POLICY.lockMinutes} min.`, end: true };
  }
  return { text: `Wrong PIN. ${check.attemptsLeft} attempt(s) left.\n${PIN_PROMPT}`, scene };
}
