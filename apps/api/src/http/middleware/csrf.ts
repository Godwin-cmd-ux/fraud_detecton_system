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
  // req.is() returns null when the request carries no body (e.g. DELETE); the header check still applies.
  const hasBody = req.get('content-length') !== undefined || req.get('transfer-encoding') !== undefined;
  const jsonOk = !hasBody || req.is('application/json') === 'application/json';
  if (header !== 'fetch' || !jsonOk) {
    return next(new HttpError(403, 'CSRF', 'Request must be sent as JSON with X-Requested-With: fetch'));
  }
  next();
};
