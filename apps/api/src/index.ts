import pino from 'pino';
import { env } from './config/env';
import { createDb } from './db/client';
import { createApp } from './http/app';
import { MlClient } from './modules/fraud/mlClient';
import { SmsClient } from './modules/sms/client';

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
});

const { db, pool } = createDb(env.DATABASE_URL);
const sms = new SmsClient(
  { apiKey: env.AT_API_KEY, username: env.AT_USERNAME, senderId: env.AT_SENDER_ID },
  logger,
);
if (!sms.enabled) logger.warn('SMS disabled: set AT_API_KEY to enable Africa\'s Talking messages');

const app = createApp({
  db,
  pool,
  ml: new MlClient(env.ML_API_URL),
  sms,
  now: () => new Date(),
  sessionSecret: env.SESSION_SECRET,
  corsOrigin: env.CORS_ORIGIN,
  adminSetupKey: env.ADMIN_SETUP_KEY,
  logger,
  secureCookies: env.NODE_ENV === 'production',
});

app.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});
