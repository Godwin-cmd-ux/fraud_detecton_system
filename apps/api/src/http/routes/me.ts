import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import {
  FRAUD,
  transferSchema,
  userTransactionsQuerySchema,
  verifyPasswordSchema,
  withdrawalSchema,
} from '@fraud/shared';
import type { TransferInput, UserTransactionsQuery, WithdrawalInput } from '@fraud/shared';
import type { AppDeps } from '../app';
import { HttpError } from '../../lib/errors';
import { verifyPassword } from '../../lib/password';
import { executeTransfer } from '../../modules/transactions/transfer';
import { executeWithdrawal } from '../../modules/transactions/withdrawal';
import { getSendContext, getWithdrawContext } from '../../modules/users/context';
import { getDashboard } from '../../modules/users/dashboard';
import { findActiveUserById } from '../../modules/users/repo';
import { listUserTransactions } from '../../modules/users/transactions';
import { clientIp, principalOf, requireUser } from '../middleware/auth';
import { sessionRateLimit } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';

export function requestMeta(req: Request): { ip: string | null; userAgent: string | null } {
  return { ip: clientIp(req), userAgent: req.get('user-agent') ?? null };
}

const sendContextQuery = z.object({ receiverId: z.coerce.number().int().positive().optional() });

export function meRoutes(deps: AppDeps): Router {
  const r = Router();
  r.use(requireUser);

  const minutes = (m: number) => m * 60_000;
  const active = (until: number | undefined) => until !== undefined && until > deps.now().getTime();

  /** Checks the session user's password; 401 with the original message when wrong. */
  async function checkPassword(req: Request, password: string): Promise<void> {
    const user = await findActiveUserById(deps.db, principalOf(req).id);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(401, 'INCORRECT_PASSWORD', 'Incorrect password');
    }
  }

  r.get('/dashboard', async (req, res, next) => {
    try {
      res.json(await getDashboard(deps.db, principalOf(req).id, active(req.session.balanceRevealedUntil)));
    } catch (e) {
      next(e);
    }
  });

  r.post(
    '/verify-password',
    sessionRateLimit('verify', 5, minutes(1), deps.now),
    validate(verifyPasswordSchema, 'body'),
    async (req, res, next) => {
      try {
        const { password } = res.locals.body as { password: string };
        try {
          await checkPassword(req, password);
        } catch (err) {
          if (err instanceof HttpError && err.code === 'INCORRECT_PASSWORD') {
            return res.status(401).json({ ok: false, message: err.message });
          }
          throw err;
        }
        req.session.balanceRevealedUntil = deps.now().getTime() + minutes(FRAUD.BALANCE_REVEAL_TTL_MIN);
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    },
  );

  r.get('/transactions', validate(userTransactionsQuerySchema, 'query'), async (req, res, next) => {
    try {
      if (!active(req.session.transactionsUnlockedUntil)) {
        delete req.session.transactionsUnlockedUntil;
        return res.json({ locked: true });
      }
      const list = await listUserTransactions(deps.db, principalOf(req).id, res.locals.query as UserTransactionsQuery);
      res.json({ locked: false, ...list });
    } catch (e) {
      next(e);
    }
  });

  r.post('/transactions/unlock', validate(verifyPasswordSchema, 'body'), async (req, res, next) => {
    try {
      await checkPassword(req, (res.locals.body as { password: string }).password);
      req.session.transactionsUnlockedUntil = deps.now().getTime() + minutes(FRAUD.TRANSACTIONS_UNLOCK_TTL_MIN);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  r.post('/transactions/lock', (req, res) => {
    delete req.session.transactionsUnlockedUntil;
    res.status(204).end();
  });

  r.get('/send/context', validate(sendContextQuery, 'query'), async (req, res, next) => {
    try {
      const { receiverId } = res.locals.query as { receiverId?: number };
      res.json(await getSendContext(deps.db, principalOf(req).id, receiverId, deps.now()));
    } catch (e) {
      next(e);
    }
  });

  r.get('/withdraw/context', async (req, res, next) => {
    try {
      res.json(await getWithdrawContext(deps.db, principalOf(req).id, deps.now()));
    } catch (e) {
      next(e);
    }
  });

  r.post('/transfers', validate(transferSchema, 'body'), async (req, res, next) => {
    try {
      const body = res.locals.body as TransferInput;
      res.json(await executeTransfer(deps, { userId: principalOf(req).id, ...body, ...requestMeta(req) }));
    } catch (e) {
      next(e);
    }
  });

  r.post('/withdrawals', validate(withdrawalSchema, 'body'), async (req, res, next) => {
    try {
      const body = res.locals.body as WithdrawalInput;
      res.json(await executeWithdrawal(deps, { userId: principalOf(req).id, ...body, ...requestMeta(req) }));
    } catch (e) {
      next(e);
    }
  });

  return r;
}
