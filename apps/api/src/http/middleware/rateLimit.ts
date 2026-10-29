import type { RequestHandler } from 'express';
import { HttpError } from '../../lib/errors';

/** Per-session sliding-window limiter: at most `max` hits per `windowMs` under `key`. */
export function sessionRateLimit(
  key: string,
  max: number,
  windowMs: number,
  now: () => Date = () => new Date(),
): RequestHandler {
  return (req, _res, next) => {
    const t = now().getTime();
    const limits = (req.session.rateLimits ??= {});
    const entry = limits[key];
    if (!entry || t - entry.windowStart >= windowMs) {
      limits[key] = { count: 1, windowStart: t };
      return next();
    }
    if (entry.count >= max) {
      return next(new HttpError(429, 'RATE_LIMITED', 'Too many attempts. Please wait a minute.'));
    }
    entry.count += 1;
    next();
  };
}
