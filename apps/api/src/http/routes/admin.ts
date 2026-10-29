import { Router } from 'express';
import type { Request, RequestHandler } from 'express';
import {
  addBalanceSchema,
  adminTransactionsQuerySchema,
  balanceAdjustmentsQuerySchema,
  createUserSchema,
  fraudAlertsQuerySchema,
  idParamSchema,
  optionalReasonSchema,
  reasonSchema,
  usersQuerySchema,
} from '@fraud/shared';
import type {
  AddBalanceInput,
  AdminTransactionsQuery,
  BalanceAdjustmentsQuery,
  CreateUserInput,
  FraudAlertsQuery,
  UsersQuery,
} from '@fraud/shared';
import type { AppDeps } from '../app';
import { listAdmins, listBalanceAdjustments } from '../../modules/admin/balanceAdjustments';
import { getCounters } from '../../modules/admin/counters';
import { getAdminDashboard } from '../../modules/admin/dashboard';
import { listFraudAlerts } from '../../modules/admin/fraudAlerts';
import { getFraudOverview } from '../../modules/admin/overview';
import {
  getAdminTransaction,
  listAdminTransactions,
  markReviewed,
} from '../../modules/admin/transactions';
import {
  addBalance,
  createUser,
  deleteUser,
  getUser,
  listPendingUsers,
  listUserAdjustments,
  listUsers,
  rejectUser,
  setUserFlag,
} from '../../modules/admin/users';
import type { UserFlagAction } from '../../modules/admin/users';
import { clientIp, principalOf, requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';

const idOf = (res: { locals: Record<string, unknown> }) => (res.locals.params as { id: number }).id;

/** Wraps an async handler so rejections reach the error handler. */
const wrap =
  (fn: (req: Request, res: Parameters<RequestHandler>[1]) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

export function adminRoutes(deps: AppDeps): Router {
  const r = Router();
  r.use(requireAdmin);

  r.get(
    '/users',
    validate(usersQuerySchema, 'query'),
    wrap(async (_req, res) => {
      res.json(await listUsers(deps.db, res.locals.query as UsersQuery));
    }),
  );

  r.get(
    '/pending-users',
    wrap(async (_req, res) => {
      res.json(await listPendingUsers(deps.db));
    }),
  );

  r.post(
    '/users',
    validate(createUserSchema, 'body'),
    wrap(async (req, res) => {
      const result = await createUser(deps.db, res.locals.body as CreateUserInput, principalOf(req), clientIp(req));
      res.status(201).json(result);
    }),
  );

  r.get(
    '/users/:id',
    validate(idParamSchema, 'params'),
    wrap(async (_req, res) => {
      res.json(await getUser(deps.db, idOf(res)));
    }),
  );

  for (const action of ['approve', 'disapprove', 'activate', 'deactivate'] as UserFlagAction[]) {
    r.post(
      `/users/:id/${action}`,
      validate(idParamSchema, 'params'),
      validate(optionalReasonSchema, 'body'),
      wrap(async (req, res) => {
        const { reason } = res.locals.body as { reason?: string };
        res.json(await setUserFlag(deps.db, idOf(res), action, principalOf(req), clientIp(req), reason));
      }),
    );
  }

  r.post(
    '/users/:id/reject',
    validate(idParamSchema, 'params'),
    validate(reasonSchema, 'body'),
    wrap(async (req, res) => {
      const { reason } = res.locals.body as { reason: string };
      res.json(await rejectUser(deps.db, idOf(res), reason, principalOf(req), clientIp(req)));
    }),
  );

  r.delete(
    '/users/:id',
    validate(idParamSchema, 'params'),
    wrap(async (req, res) => {
      res.json(await deleteUser(deps.db, idOf(res), principalOf(req), clientIp(req)));
    }),
  );

  r.post(
    '/users/:id/balance',
    validate(idParamSchema, 'params'),
    validate(addBalanceSchema, 'body'),
    wrap(async (req, res) => {
      res.json(
        await addBalance(
          deps.db,
          idOf(res),
          res.locals.body as AddBalanceInput,
          principalOf(req),
          clientIp(req),
          req.get('user-agent') ?? null,
          deps.now(),
        ),
      );
    }),
  );

  r.get(
    '/users/:id/adjustments',
    validate(idParamSchema, 'params'),
    wrap(async (_req, res) => {
      res.json(await listUserAdjustments(deps.db, idOf(res)));
    }),
  );

  r.get(
    '/counters',
    wrap(async (_req, res) => {
      res.json(await getCounters(deps.db, deps.now()));
    }),
  );

  r.get(
    '/dashboard',
    wrap(async (_req, res) => {
      res.json(await getAdminDashboard(deps.db, deps.now()));
    }),
  );

  r.get(
    '/transactions',
    validate(adminTransactionsQuerySchema, 'query'),
    wrap(async (_req, res) => {
      res.json(await listAdminTransactions(deps.db, res.locals.query as AdminTransactionsQuery));
    }),
  );

  r.get(
    '/transactions/:id',
    validate(idParamSchema, 'params'),
    wrap(async (_req, res) => {
      res.json(await getAdminTransaction(deps.db, idOf(res)));
    }),
  );

  r.post(
    '/transactions/:id/review',
    validate(idParamSchema, 'params'),
    wrap(async (req, res) => {
      await markReviewed(deps.db, idOf(res), principalOf(req), clientIp(req), deps.now());
      res.json({ message: '✅ Transaction marked as reviewed.' });
    }),
  );

  r.get(
    '/fraud-alerts',
    validate(fraudAlertsQuerySchema, 'query'),
    wrap(async (_req, res) => {
      res.json(await listFraudAlerts(deps.db, res.locals.query as FraudAlertsQuery));
    }),
  );

  r.get(
    '/balance-adjustments',
    validate(balanceAdjustmentsQuerySchema, 'query'),
    wrap(async (_req, res) => {
      res.json(await listBalanceAdjustments(deps.db, res.locals.query as BalanceAdjustmentsQuery));
    }),
  );

  r.get(
    '/admins',
    wrap(async (_req, res) => {
      res.json(await listAdmins(deps.db));
    }),
  );

  r.get(
    '/fraud-overview',
    wrap(async (_req, res) => {
      res.json(await getFraudOverview(deps.db, deps.now()));
    }),
  );

  return r;
}
