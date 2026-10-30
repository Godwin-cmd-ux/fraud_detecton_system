import { Router } from 'express';
import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { AppDeps } from '../app';
import { env } from '../../config/env';
import { handleCallback } from '../../ussd';
import type { CallbackInput } from '../../ussd';

/**
 * Public gateway endpoint. Africa's Talking posts form-encoded fields and expects plain text that
 * starts with CON or END.
 *
 * The endpoint is deliberately outside the cookie/CSRF-protected API: the caller is a gateway, not
 * a browser. It is authenticated instead by a shared callback secret (in the configured URL or the
 * `x-ussd-token` header) plus an optional source-IP allowlist.
 */

const field = (req: Request, name: string): string => {
  const fromBody = (req.body as Record<string, unknown> | undefined)?.[name];
  const fromQuery = req.query[name];
  const value = fromBody ?? fromQuery;
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
};

const constantTimeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

const allowedIps = (): string[] =>
  env.USSD_ALLOWED_IPS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

function authorised(req: Request): { ok: true } | { ok: false; reason: string } {
  const token = (req.get('x-ussd-token') ?? field(req, 'token')).trim();
  if (!token || !constantTimeEqual(token, env.USSD_CALLBACK_SECRET)) {
    return { ok: false, reason: 'Invalid callback token' };
  }
  const list = allowedIps();
  const ip = req.ip ?? '';
  if (list.length > 0 && !list.includes(ip)) return { ok: false, reason: `IP ${ip} not allowed` };
  return { ok: true };
}

export function ussdRoutes(deps: AppDeps): Router {
  const r = Router();

  r.use(express.urlencoded({ extended: false, limit: '16kb' }));
  r.use(express.json({ limit: '16kb' }));

  const callback = async (req: Request, res: Response): Promise<void> => {
    const gate = authorised(req);
    if (!gate.ok) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: gate.reason } });
      return;
    }

    const sessionId = field(req, 'sessionId') || field(req, 'session_id');
    if (!sessionId) {
      res.type('text/plain').status(200).send('END Missing sessionId.');
      return;
    }

    const input: CallbackInput = {
      sessionId,
      serviceCode: field(req, 'serviceCode') || field(req, 'service_code'),
      phoneNumber: field(req, 'phoneNumber') || field(req, 'phone_number'),
      text: field(req, 'text'),
      ip: req.ip ?? '0.0.0.0',
      userAgent: req.get('user-agent') ?? null,
    };

    const result = await handleCallback(
      {
        db: deps.db,
        ml: deps.ml,
        now: deps.now,
        config: {
          sessionTtlSec: env.USSD_SESSION_TTL_SEC,
          rateLimitPerMin: env.USSD_RATE_LIMIT_PER_MIN,
        },
      },
      input,
    );

    res.type('text/plain').status(result.status).send(result.body);
  };

  r.post('/callback', (req, res, next) => {
    callback(req, res).catch(next);
  });
  r.get('/callback', (req, res, next) => {
    callback(req, res).catch(next);
  });

  r.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'ussd',
      callback: '/api/ussd/callback',
      secretConfigured: env.USSD_CALLBACK_SECRET.length > 0,
    });
  });

  return r;
}
