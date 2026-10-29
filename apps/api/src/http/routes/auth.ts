import { Router } from 'express';
import type { Request } from 'express';
import { loginSchema } from '@fraud/shared';
import type { LoginInput, Principal } from '@fraud/shared';
import type { AppDeps } from '../app';
import { HttpError } from '../../lib/errors';
import { login } from '../../modules/auth/login';
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

  return r;
}
