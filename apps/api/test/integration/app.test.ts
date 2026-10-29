import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { makeTestApp } from '../helpers/app';
import type { TestApp } from '../helpers/app';
import { closeTestDb, truncateAll } from '../helpers/db';

let t: TestApp;

beforeAll(async () => {
  t = await makeTestApp();
  await truncateAll(t.db);
});

afterAll(async () => {
  await closeTestDb();
});

describe('app skeleton', () => {
  it('reports health with database and ML status', async () => {
    const res = await supertest(t.app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: true, ml: { available: true } });
  });

  it('rejects state-changing requests without the CSRF headers', async () => {
    const res = await supertest(t.app).post('/api/auth/logout').send({});
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: 'CSRF', message: expect.any(String) } });
  });

  it('accepts logout with the CSRF headers', async () => {
    const res = await t.agent().post('/api/auth/logout').send({});
    expect(res.status).toBe(204);
  });

  it('requires authentication on user routes', async () => {
    const res = await t.agent().get('/api/me/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns field-level validation errors', async () => {
    const res = await t.agent().post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.fields).toHaveProperty('role');
  });
});
