import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import type { Logger } from 'pino';
import type pg from 'pg';
import type { Db } from '../db/client';
import type { MlClient } from '../modules/fraud/mlClient';
import { HttpError } from '../lib/errors';
import { csrfGuard } from './middleware/csrf';
import { errorHandler } from './middleware/errorHandler';
import { requireUser } from './middleware/auth';
import { sessionMiddleware } from './middleware/session';
import { authRoutes } from './routes/auth';
import { publicRoutes } from './routes/public';

export interface AppDeps {
  db: Db;
  pool: pg.Pool;
  ml: MlClient;
  now: () => Date;
  sessionSecret: string;
  corsOrigin: string;
  adminSetupKey: string;
  /** pino logger, or `false` to disable request logging (tests). */
  logger?: Logger | false;
  secureCookies?: boolean;
}

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  const logger = deps.logger === false ? null : (deps.logger ?? null);

  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');

  if (logger) app.use(pinoHttp({ logger }));
  app.use(cors({ origin: deps.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(sessionMiddleware(deps.pool, deps.sessionSecret, deps.secureCookies ?? false));
  app.use(csrfGuard);

  app.use('/api', publicRoutes(deps));
  app.use('/api/auth', authRoutes(deps));

  // Placeholder user area so authentication is enforced before the real routes land.
  app.use('/api/me', requireUser, (_req, _res, next) =>
    next(new HttpError(404, 'NOT_FOUND', 'Not found')),
  );

  app.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'Not found')));
  app.use(errorHandler(logger));
  return app;
}
