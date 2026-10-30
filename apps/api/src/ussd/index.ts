import type { Db } from '../db/client';
import type { MlClient } from '../modules/fraud/mlClient';
import type { SmsClient } from '../modules/sms/client';
import { HttpError } from '../lib/errors';
import { con, end, fit } from './text';
import { normalizePhone } from './phone';
import {
  countRecentCallbacks,
  deleteSession,
  emptyState,
  findLoggedRequest,
  lockSession,
  logSecurityEvent,
  resolveActor,
  textDigest,
  upsertSession,
  writeRequest,
} from './repo';
import type { Ctx, Result, UssdState } from './machine';
import { getScene, homeScene, isRootScene } from './machine';

// Registering the scenes is what populates the machine; order does not matter.
import './scenes/admin';
import './scenes/guest';
import './scenes/pin';
import './scenes/user';

export interface UssdConfig {
  sessionTtlSec: number;
  rateLimitPerMin: number;
}

export interface UssdDeps {
  db: Db;
  ml: MlClient;
  /** Absent in tests; wallet services then skip their SMS notices. */
  sms?: SmsClient;
  now: () => Date;
  config: UssdConfig;
}

export interface CallbackInput {
  sessionId: string;
  serviceCode?: string;
  phoneNumber: string;
  text: string;
  ip: string;
  userAgent: string | null;
}

export interface CallbackResult {
  status: number;
  body: string;
}

/**
 * Screens whose input segment is a secret (a PIN). The stored copy of the cumulative gateway text
 * replaces that segment with `***`, so a PIN never reaches the request ledger in readable form.
 */
const SECRET_SCENES = new Set([
  'pin.new',
  'pin.confirm',
  'user.send.pin',
  'user.withdraw.pin',
  'admin.balance.pin',
  'admin.create.pin',
  'guest.reg.pin',
  'guest.reg.pinConfirm',
]);

const THANK_YOU = 'Thank you for using Fraud Detection System.';

/**
 * Entry point for an Africa's Talking callback.
 *
 * Everything happens inside one database transaction that holds a row lock on the session, so two
 * deliveries of the same screen cannot interleave a multi-step payment. The (session, text) pair is
 * also recorded, which makes a retried callback return the first response instead of executing the
 * workflow twice.
 */
export async function handleCallback(deps: UssdDeps, input: CallbackInput): Promise<CallbackResult> {
  const phone = normalizePhone(input.phoneNumber);
  if (!phone) return { status: 200, body: end('Invalid phone number.') };

  const now = deps.now();
  try {
    return await deps.db.transaction(async (tx) => {
      const recent = await countRecentCallbacks(tx, phone, new Date(now.getTime() - 60_000));
      if (recent >= deps.config.rateLimitPerMin) {
        await logSecurityEvent(tx, {
          type: 'RATE_LIMITED',
          phone,
          sessionId: input.sessionId,
          detail: `${recent} callbacks in the last minute`,
          ip: input.ip,
          now,
        });
        return { status: 200, body: end('Too many requests. Try again in a minute.') };
      }
      return run(tx, deps, input, phone, now);
    });
  } catch (error) {
    await logSecurityEvent(deps.db, {
      type: 'INTERNAL_ERROR',
      phone,
      sessionId: input.sessionId,
      detail: error instanceof Error ? error.message : String(error),
      ip: input.ip,
      now,
    });
    return { status: 200, body: end('Service is busy. Please dial again.') };
  }
}

async function run(
  tx: Db,
  deps: UssdDeps,
  input: CallbackInput,
  phone: string,
  now: Date,
): Promise<CallbackResult> {
  const started = Date.now();
  const rawText = (input.text ?? '').trim();
  const digest = textDigest(input.sessionId, rawText);

  const cached = await findLoggedRequest(tx, input.sessionId, digest);
  if (cached) {
    await logSecurityEvent(tx, {
      type: 'DUPLICATE_CALLBACK',
      phone,
      sessionId: input.sessionId,
      detail: 'replayed response',
      ip: input.ip,
      now,
    });
    return { status: 200, body: cached.response };
  }

  const row = await lockSession(tx, input.sessionId);

  // Re-check under the lock: a concurrent duplicate may have committed while we waited.
  if (row) {
    const again = await findLoggedRequest(tx, input.sessionId, digest);
    if (again) return { status: 200, body: again.response };
  }

  const expired = row ? row.expiresAt.getTime() <= now.getTime() : false;
  const isNew = !row || expired;
  if (row && expired) {
    await logSecurityEvent(tx, {
      type: 'SESSION_EXPIRED',
      phone,
      sessionId: input.sessionId,
      detail: 'continued after expiry',
      ip: input.ip,
      now,
    });
  }

  // A session id belongs to exactly one number; a mismatch is a hijack attempt, not a typo.
  if (row && normalizePhone(row.phone) !== phone) {
    await logSecurityEvent(tx, {
      type: 'CALLBACK_CONTINUITY_VIOLATION',
      phone,
      sessionId: input.sessionId,
      detail: `session bound to ${row.phone}`,
      ip: input.ip,
      now,
    });
    return { status: 200, body: end('Session error. Please dial again.') };
  }

  let segment = '';
  if (!isNew) {
    const previous = row!.lastText;
    if (rawText !== previous) {
      if (!rawText.startsWith(previous)) {
        await logSecurityEvent(tx, {
          type: 'CALLBACK_CONTINUITY_VIOLATION',
          phone,
          sessionId: input.sessionId,
          detail: 'text does not extend the previous input',
          ip: input.ip,
          now,
        });
        return { status: 200, body: end('Session error. Please dial again.') };
      }
      segment = rawText.slice(previous.length);
      if (segment.startsWith('*')) segment = segment.slice(1);
    }
  }

  const { actor, user, admin } = await resolveActor(tx, phone);
  const home = homeScene(actor);
  const stored = isNew ? emptyState(home) : (row!.state as unknown as UssdState);
  const state: UssdState = {
    scene: stored.scene ?? home,
    stack: stored.stack ?? [],
    data: stored.data ?? {},
  };

  const forced = admin
    ? admin.isActive
      ? null
      : 'guest.blocked'
    : user
      ? !user.isActive
        ? 'guest.suspended'
        : !user.isApproved
          ? 'guest.pending'
          : null
      : null;

  let sceneName: string;
  let nextInput: string;

  if (forced) {
    if (segment === '0' && state.stack.length === 0) {
      await writeRequest(tx, {
        sessionId: input.sessionId,
        phone,
        textHash: digest,
        text: rawText,
        response: end(THANK_YOU),
        isEnd: true,
        scene: forced,
        actor,
        ip: input.ip,
        durationMs: Date.now() - started,
        now,
      });
      await deleteSession(tx, input.sessionId);
      return { status: 200, body: end(THANK_YOU) };
    }
    sceneName = forced;
    nextInput = '';
  } else {
    sceneName = getScene(state.scene) ? state.scene : home;

    // A genuine role change (the number was bound to an administrator, or a pending registration
    // was approved mid-session) starts the caller at their new home. A scene that merely belongs
    // to another role while the role is unchanged is tampering, and is rejected by the scope check
    // below rather than being quietly redirected.
    const storedKind = isNew ? actor?.kind ?? null : row!.actorKind;
    if (actor && storedKind !== actor.kind) sceneName = home;

    if (segment === '0') {
      const previous = state.stack[state.stack.length - 1];
      if (previous && getScene(previous)) {
        state.stack = state.stack.slice(0, -1);
        sceneName = previous;
        nextInput = '';
      } else {
        await writeRequest(tx, {
          sessionId: input.sessionId,
          phone,
          textHash: digest,
          text: rawText,
          response: end(THANK_YOU),
          isEnd: true,
          scene: sceneName,
          actor,
          ip: input.ip,
          durationMs: Date.now() - started,
          now,
        });
        await deleteSession(tx, input.sessionId);
        return { status: 200, body: end(THANK_YOU) };
      }
    } else {
      nextInput = segment;
    }
  }

  const def = getScene(sceneName);
  if (!def) return { status: 200, body: end('Service is busy. Please dial again.') };

  // Role is verified on the server for the screen actually being run, not by which menu was shown.
  if (def.scope && actor?.kind !== def.scope) {
    await logSecurityEvent(tx, {
      type: 'UNAUTHORIZED_ACCESS',
      phone,
      sessionId: input.sessionId,
      detail: `${actor?.kind ?? 'guest'} attempted ${sceneName}`,
      ip: input.ip,
      now,
    });
    return { status: 200, body: end('Not authorised for this service.') };
  }

  const ctx: Ctx = {
    db: tx,
    ml: deps.ml,
    ...(deps.sms ? { sms: deps.sms } : {}),
    now,
    sessionId: input.sessionId,
    phone,
    input: nextInput,
    state: { scene: sceneName, stack: [...state.stack], data: { ...state.data } },
    actor,
    meUser: user,
    meAdmin: admin,
    ip: input.ip,
    userAgent: input.userAgent,
  };

  const before = sceneName;
  let result: Result;
  try {
    result = await def.run(ctx);
  } catch (error) {
    if (error instanceof HttpError && error.status < 500) {
      result = { text: `${error.message}\n0. Back`, scene: sceneName };
    } else {
      await logSecurityEvent(tx, {
        type: 'INTERNAL_ERROR',
        phone,
        sessionId: input.sessionId,
        detail: `${sceneName}: ${error instanceof Error ? error.message : String(error)}`,
        ip: input.ip,
        now,
      });
      result = { text: 'Service is busy. Please dial again.', end: true };
    }
  }

  const nextScene = result.scene && getScene(result.scene) ? result.scene : before;
  const stack = [...ctx.state.stack];
  if (nextScene !== before) {
    stack.push(before);
    if (stack.length > 10) stack.shift();
  }
  const base = result.clearData || isRootScene(nextScene) ? {} : ctx.state.data;
  const newState: UssdState = { scene: nextScene, stack, data: { ...base, ...(result.data ?? {}) } };

  const body = result.end ? end(fit(result.text)) : con(fit(result.text));

  const previousText = !isNew && row ? row.lastText : '';
  const storedText = SECRET_SCENES.has(before)
    ? `${previousText}${previousText ? '*' : ''}***`
    : rawText;

  if (result.end) {
    await deleteSession(tx, input.sessionId);
  } else {
    await upsertSession(tx, {
      id: input.sessionId,
      phone,
      state: newState,
      lastText: rawText,
      actor,
      expiresAt: new Date(now.getTime() + deps.config.sessionTtlSec * 1000),
      now,
    });
  }

  await writeRequest(tx, {
    sessionId: input.sessionId,
    phone,
    textHash: digest,
    text: storedText,
    response: body,
    isEnd: !!result.end,
    scene: before,
    actor,
    ip: input.ip,
    durationMs: Date.now() - started,
    now,
  });

  return { status: 200, body };
}
