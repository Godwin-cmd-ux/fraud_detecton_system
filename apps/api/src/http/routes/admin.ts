import { Router } from 'express';
import type { Request, RequestHandler } from 'express';
import {
  addBalanceSchema,
  createUserSchema,
  idParamSchema,
  optionalReasonSchema,
  reasonSchema,
  usersQuerySchema,
} from '@fraud/shared';
import type { AddBalanceInput, CreateUserInput, UsersQuery } from '@fraud/shared';
import type { AppDeps } from '../app';
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

  return r;
}
