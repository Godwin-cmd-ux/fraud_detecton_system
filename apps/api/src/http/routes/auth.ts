import { Router } from 'express';
import { loginSchema } from '@fraud/shared';
import type { AppDeps } from '../app';
import { validate } from '../middleware/validate';
import { SESSION_COOKIE } from '../middleware/session';

export function authRoutes(_deps: AppDeps): Router {
  const r = Router();

  r.post('/login', validate(loginSchema, 'body'), (_req, res) => {
    res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Login arrives in Task 8' } });
  });

  r.post('/logout', (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie(SESSION_COOKIE);
      res.status(204).end();
    });
  });

  return r;
}
