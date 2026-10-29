import type { RequestHandler } from 'express';
import { HttpError } from '../../lib/errors';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Cross-site forms cannot send a JSON content type or custom headers,
 * so requiring both on every state-changing request blocks CSRF.
 */
export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (!MUTATING.has(req.method)) return next();
  const header = req.get('x-requested-with');
  if (header !== 'fetch' || !req.is('application/json')) {
    return next(new HttpError(403, 'CSRF', 'Request must be sent as JSON with X-Requested-With: fetch'));
  }
  next();
};
