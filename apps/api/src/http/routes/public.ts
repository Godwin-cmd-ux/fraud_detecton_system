import { Router } from 'express';
import { sql } from 'drizzle-orm';
import type { AppDeps } from '../app';

export function publicRoutes(deps: AppDeps): Router {
  const r = Router();

  r.get('/health', async (_req, res) => {
    let db = false;
    try {
      await deps.db.execute(sql`select 1`);
      db = true;
    } catch {
      db = false;
    }
    const available = await deps.ml.isAvailable();
    res.json({ status: 'ok', db, ml: { available } });
  });

  return r;
}
