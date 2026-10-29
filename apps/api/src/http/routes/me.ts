import { Router } from 'express';
import type { Request } from 'express';
import { transferSchema, withdrawalSchema } from '@fraud/shared';
import type { TransferInput, WithdrawalInput } from '@fraud/shared';
import type { AppDeps } from '../app';
import { executeTransfer } from '../../modules/transactions/transfer';
import { executeWithdrawal } from '../../modules/transactions/withdrawal';
import { clientIp, principalOf, requireUser } from '../middleware/auth';
import { validate } from '../middleware/validate';

export function requestMeta(req: Request): { ip: string | null; userAgent: string | null } {
  return { ip: clientIp(req), userAgent: req.get('user-agent') ?? null };
}

export function meRoutes(deps: AppDeps): Router {
  const r = Router();
  r.use(requireUser);

  r.post('/transfers', validate(transferSchema, 'body'), async (req, res, next) => {
    try {
      const body = res.locals.body as TransferInput;
      const result = await executeTransfer(deps, {
        userId: principalOf(req).id,
        ...body,
        ...requestMeta(req),
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  r.post('/withdrawals', validate(withdrawalSchema, 'body'), async (req, res, next) => {
    try {
      const body = res.locals.body as WithdrawalInput;
      const result = await executeWithdrawal(deps, {
        userId: principalOf(req).id,
        ...body,
        ...requestMeta(req),
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  return r;
}
