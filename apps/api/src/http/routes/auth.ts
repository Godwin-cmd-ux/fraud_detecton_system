import { Router } from 'express';
import type { Request } from 'express';
import {
  adminSignupSchema,
  forgotStartSchema,
  forgotVerifySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@fraud/shared';
import type { AdminSignupInput, LoginInput, Principal, RegisterInput } from '@fraud/shared';
import type { AppDeps } from '../app';
import { HttpError } from '../../lib/errors';
import { adminSignup, isFirstAdmin } from '../../modules/auth/adminSignup';
import { getLockout, recordFailure, resetAttempts } from '../../modules/auth/lockout';
import { MSG, login } from '../../modules/auth/login';
import {
  RESET_MSG,
  checkToken,
  resetPassword,
  startReset,
  verifyAnswers,
} from '../../modules/auth/passwordReset';
import { registerUser } from '../../modules/auth/register';

export const REGISTER_SUCCESS_MSG =
  "Registration successful. Your account is pending admin approval — you'll be notified once it's reviewed.";
import { clientIp } from '../middleware/auth';
import { SESSION_COOKIE } from '../middleware/session';
import { validate } from '../middleware/validate';

/** Replaces the session id and stores the principal (prevents session fixation). */
function startSession(req: Request, principal: Principal): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.principal = principal;
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

export function authRoutes(deps: AppDeps): Router {
  const r = Router();

  r.post('/login', validate(loginSchema, 'body'), async (req, res, next) => {
    try {
      const body = res.locals.body as LoginInput;
      const principal = await login(deps.db, { ...body, ip: clientIp(req), now: deps.now() });
      await startSession(req, principal);
      res.json(principal);
    } catch (e) {
      next(e);
    }
  });

  r.post('/logout', (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie(SESSION_COOKIE);
      res.status(204).end();
    });
  });

  r.get('/me', (req, res, next) => {
    const p = req.session.principal;
    if (!p) return next(new HttpError(401, 'UNAUTHENTICATED', 'Please sign in'));
    res.json(p);
  });

  r.post('/register', validate(registerSchema, 'body'), async (req, res, next) => {
    try {
      await registerUser(deps.db, res.locals.body as RegisterInput);
      res.status(201).json({ message: REGISTER_SUCCESS_MSG });
    } catch (e) {
      next(e);
    }
  });

  r.get('/admin-signup/status', async (_req, res, next) => {
    try {
      res.json({ firstAdmin: await isFirstAdmin(deps.db) });
    } catch (e) {
      next(e);
    }
  });

  r.post('/admin-signup', validate(adminSignupSchema, 'body'), async (req, res, next) => {
    try {
      await adminSignup(deps.db, res.locals.body as AdminSignupInput, deps.adminSetupKey);
      res.status(201).json({ message: '✅ Admin account created successfully! You can now login.' });
    } catch (e) {
      next(e);
    }
  });

  r.post('/forgot-password/start', validate(forgotStartSchema, 'body'), async (req, res, next) => {
    try {
      const { email } = res.locals.body as { email: string };
      const result = await startReset(deps.db, email);
      req.session.reset = { userId: result.userId, email, questionKeys: result.questions.map((q) => q.key) };
      res.json({ questions: result.questions });
    } catch (e) {
      next(e);
    }
  });

  r.post('/forgot-password/verify', validate(forgotVerifySchema, 'body'), async (req, res, next) => {
    try {
      const state = req.session.reset;
      if (!state) throw new HttpError(400, 'SESSION_EXPIRED', RESET_MSG.sessionExpired);
      const ip = clientIp(req);
      const now = deps.now();
      const lock = await getLockout(deps.db, state.email, ip, now);
      if (lock.locked) {
        throw new HttpError(423, 'LOCKED', MSG.locked(lock.minutesRemaining), {
          minutesRemaining: String(lock.minutesRemaining),
        });
      }
      const { answers } = res.locals.body as { answers: Record<string, string> };
      try {
        const result = await verifyAnswers(deps.db, state.userId, answers, now);
        await resetAttempts(deps.db, state.email, ip);
        delete req.session.reset;
        res.json({ token: result.token, expiresAt: result.expiresAt.toISOString() });
      } catch (err) {
        if (err instanceof HttpError && err.code === 'INCORRECT_ANSWERS') {
          const failure = await recordFailure(deps.db, state.email, ip, state.userId, now);
          if (failure.lockoutUntil) throw new HttpError(423, 'LOCKED', MSG.lockedNow);
        }
        throw err;
      }
    } catch (e) {
      next(e);
    }
  });

  r.get('/reset-password/:token', async (req, res, next) => {
    try {
      const check = await checkToken(deps.db, String(req.params.token), deps.now());
      res.json(
        check.valid
          ? { valid: true, expiresAt: check.expiresAt.toISOString(), userName: check.userName }
          : { valid: false, reason: check.reason },
      );
    } catch (e) {
      next(e);
    }
  });

  r.post('/reset-password', validate(resetPasswordSchema, 'body'), async (req, res, next) => {
    try {
      const { token, password } = res.locals.body as { token: string; password: string };
      await resetPassword(deps.db, token, password, deps.now());
      res.json({ message: RESET_MSG.success });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
