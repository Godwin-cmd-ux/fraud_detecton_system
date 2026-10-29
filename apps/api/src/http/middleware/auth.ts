import type { Request, RequestHandler } from 'express';
import type { Principal } from '@fraud/shared';
import { HttpError } from '../../lib/errors';

export const requireUser: RequestHandler = (req, _res, next) => {
  if (req.session.principal?.kind !== 'user') {
    return next(new HttpError(401, 'UNAUTHENTICATED', 'Please sign in'));
  }
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.session.principal?.kind !== 'admin') {
    return next(new HttpError(401, 'UNAUTHENTICATED', 'Admin sign-in required'));
  }
  next();
};

export function principalOf(req: Request): Principal {
  const p = req.session.principal;
  if (!p) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in');
  return p;
}

export function clientIp(req: Request): string {
  return req.ip ?? '0.0.0.0';
}
