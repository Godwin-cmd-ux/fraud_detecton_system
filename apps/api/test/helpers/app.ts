import type { Express } from 'express';
import supertest from 'supertest';
import { createApp } from '../../src/http/app';
import type { Db } from '../../src/db/client';
import type { MlClient } from '../../src/modules/fraud/mlClient';
import type { SmsSender } from '../../src/modules/sms/client';
import { ML_FALLBACK } from '../../src/modules/fraud/rules';
import { setupTestDb, testPool } from './db';
import { mlMock } from './mlMock';

export interface TestApp {
  app: Express;
  db: Db;
  /** A cookie-keeping agent whose requests carry the JSON + CSRF headers. */
  agent: () => supertest.Agent;
  /** Mutable clock used by the app; set `clock.now` to travel in time. */
  clock: { now: Date };
}

export async function makeTestApp(opts: { ml?: MlClient; now?: Date; sms?: SmsSender } = {}): Promise<TestApp> {
  const db = await setupTestDb();
  const clock = { now: opts.now ?? new Date() };
  const app = createApp({
    db,
    pool: testPool(),
    ml: opts.ml ?? mlMock(ML_FALLBACK),
    sms: opts.sms,
    now: () => clock.now,
    sessionSecret: 'test-secret-test-secret',
    corsOrigin: 'http://localhost:5173',
    adminSetupKey: 'AdminSetupTZ',
    logger: false,
  });
  const agent = () =>
    supertest
      .agent(app)
      .set('Content-Type', 'application/json')
      .set('X-Requested-With', 'fetch');
  return { app, db, agent, clock };
}

/** Logs in through the real endpoint and returns an agent holding the session cookie. */
export async function loginAs(
  t: TestApp,
  role: 'user' | 'admin',
  login: string,
  password: string,
): Promise<supertest.Agent> {
  const a = t.agent();
  const res = await a.post('/api/auth/login').send({ role, login, password });
  if (res.status !== 200) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return a;
}
