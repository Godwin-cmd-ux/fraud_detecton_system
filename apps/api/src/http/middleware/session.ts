import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import type pg from 'pg';
import type { Principal } from '@fraud/shared';

declare module 'express-session' {
  interface SessionData {
    principal?: Principal;
    transactionsUnlockedUntil?: number;
    balanceRevealedUntil?: number;
    reset?: { userId: number; email: string; questionKeys: string[] };
    rateLimits?: Record<string, { count: number; windowStart: number }>;
  }
}

export const SESSION_COOKIE = 'fd.sid';

export function sessionMiddleware(pool: pg.Pool, secret: string, secure: boolean) {
  const PgStore = connectPgSimple(session);
  return session({
    name: SESSION_COOKIE,
    secret,
    store: new PgStore({ pool, tableName: 'sessions', createTableIfMissing: false }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 30 * 60 * 1000,
    },
  });
}
