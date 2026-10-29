import { Router } from 'express';
import type { Request } from 'express';
import { adminSignupSchema, loginSchema, registerSchema } from '@fraud/shared';
import type { AdminSignupInput, LoginInput, Principal, RegisterInput } from '@fraud/shared';
import type { AppDeps } from '../app';
import { HttpError } from '../../lib/errors';
import { adminSignup, isFirstAdmin } from '../../modules/auth/adminSignup';
import { login } from '../../modules/auth/login';
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

  return r;
}
