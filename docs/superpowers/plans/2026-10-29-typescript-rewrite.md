# TypeScript Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the PHP/MySQL fraud detection wallet as a pnpm monorepo with a React + TypeScript frontend, an Express + TypeScript API, and PostgreSQL, with identical fraud behaviour and the bug fixes listed in the spec.

**Architecture:** Three workspace packages. `packages/shared` holds zod schemas, enums and the fraud constants used by both sides. `apps/api` is an Express 5 app with Drizzle ORM; the fraud engine is a set of pure functions fed by a velocity repository and an ML HTTP client, and every money path runs inside one DB transaction. `apps/web` is a Vite SPA using React Router and TanStack Query against the typed API. The Python ML service stays as is under `services/fraud-api`.

**Tech Stack:** Node 22, pnpm 10, TypeScript 5, Express 5, Drizzle ORM + drizzle-kit + pg, express-session + connect-pg-simple, bcryptjs, zod, pino, Vitest, Supertest; React 19, Vite 6, React Router 7, TanStack Query 5, Tailwind CSS 4, react-hook-form, Recharts, lucide-react, Testing Library; PostgreSQL 18 (local, trust auth: `postgres://postgres@localhost:5432/<db>`).

**Spec:** `docs/superpowers/specs/2026-10-29-typescript-rewrite-design.md`

## Global Constraints

- Node `>=22`, pnpm workspace; `"type": "module"` everywhere; TypeScript `strict: true`.
- Money columns are `numeric(15,2)`; balance changes only via SQL `balance = balance ± $1` with `WHERE balance >= $1` on debits; never read-modify-write in JS.
- All timestamps `timestamptz`; hour-of-day rules use `Africa/Dar_es_Salaam`.
- Currency rendering is always `TSh 1,234.56` (two decimals, thousands separators).
- ML service base URL from env `ML_API_URL` (default `http://localhost:5000`); health timeout 3 s, predict timeout 5 s; any failure → score 0, `LEGIT`, `LOW`, model version `1.0.0`.
- Every block or failed attempt writes an `ABORTED` transaction row; every admin action writes an `admin_actions` row.
- State-changing requests require `Content-Type: application/json` and header `X-Requested-With: fetch`; otherwise 403 `CSRF`.
- Error envelope: `{ error: { code: string, message: string, fields?: Record<string,string> } }`.
- API on port 4000, web on 5173 with `/api` proxied; DB names `fraud_detection` (dev) and `fraud_detection_test` (tests).
- Fraud thresholds, windows, scores and messages exactly as spec §6; the open question defaults to the code's numbers (block at the 4th distinct receiver and the 3rd distinct sender).
- Commit after every task with a conventional message; the repo's single branch is `main`.

## Review Focus

1. Amount `1000.005` or `"abc"` or `-5` on transfer/withdraw must be a 400 with a field message, never silently rounded or coerced. Pinned in Task 11 step 1 (`rejects invalid amounts`).
2. Two concurrent transfers from one sender that together exceed the balance: exactly one succeeds, the other returns 409 and both balances stay consistent. Pinned in Task 11 (`concurrent transfers cannot overdraw`).
3. Receiver deactivated or un-approved after the recipient list was loaded: transfer returns 400 "Invalid receiver selected" and nothing is written. Pinned in Task 11 (`rejects inactive receiver`).
4. Forgot-password step 2 or 3 called without step 1 in the session (expired/restarted): 400 `SESSION_EXPIRED`, not a crash. Pinned in Task 10.
5. Deleting a user who has transactions keeps the rows with `sender_id/receiver_id = null` and the lists still render "System"/"Unknown". Pinned in Task 14 (`delete keeps transaction history`).

---

## File structure

```
fraud_detecton_system/
  package.json, pnpm-workspace.yaml, tsconfig.base.json, eslint.config.js, .prettierrc, .env.example, .gitignore, README.md
  legacy/php/                        (moved PHP: admin/, user/, ajax/, config/, assets/, *.php, start_fraud_api.bat, test.php, check.php)
  services/fraud-api/app.py, requirements.txt   (moved; MODEL_DIR → ../../models)
  models/, train.py                  (unchanged)
  packages/shared/src/
    index.ts
    constants.ts                     enums as const arrays + FRAUD constants + LOCATIONS/LOCATION_COORDS
    schemas/common.ts                pagination, money, location, id params
    schemas/auth.ts                  login, register, adminSignup, forgot/verify/reset, principal
    schemas/user.ts                  transfer, withdrawal, verifyPassword, dashboard/transactions/context responses
    schemas/admin.ts                 createUser, balance, reject, filters, response shapes
  apps/api/
    package.json, tsconfig.json, drizzle.config.ts, vitest.config.ts
    src/index.ts                     boot: env → db → app.listen
    src/config/env.ts                zod-parsed env
    src/db/schema.ts                 Drizzle tables + enums
    src/db/client.ts                 createDb(url) → { db, pool }
    src/db/migrate.ts                runMigrations(url)
    src/db/seed.ts                   seed(url)
    src/lib/errors.ts                HttpError, ValidationError, errorToResponse
    src/lib/time.ts                  hourInDar(date), minutesAgo
    src/lib/ids.ts                   newTransactionId(now)
    src/lib/password.ts              hashPassword, verifyPassword
    src/lib/money.ts                 toNumber(numericString), isValidAmount
    src/http/app.ts                  createApp(deps) → Express app
    src/http/middleware/{session.ts, csrf.ts, auth.ts, validate.ts, errorHandler.ts, rateLimit.ts}
    src/http/routes/{health.ts, auth.ts, me.ts, admin.ts}
    src/modules/fraud/{location.ts, patterns.ts, rules.ts, features.ts, mlClient.ts, velocity.ts}
    src/modules/auth/{lockout.ts, login.ts, register.ts, adminSignup.ts, passwordReset.ts}
    src/modules/transactions/{repo.ts, transfer.ts, withdrawal.ts}
    src/modules/users/{repo.ts, dashboard.ts, transactions.ts, context.ts}
    src/modules/admin/{audit.ts, users.ts, transactions.ts, fraudAlerts.ts, balanceAdjustments.ts, overview.ts, counters.ts}
    test/helpers/{db.ts, app.ts, fixtures.ts, mlMock.ts}
    test/unit/*.test.ts
    test/integration/*.test.ts
  apps/web/
    package.json, tsconfig.json, vite.config.ts, index.html, vitest.config.ts
    src/main.tsx, src/app/{router.tsx, providers.tsx, guards.tsx}
    src/api/{client.ts, auth.ts, me.ts, admin.ts}        (fetch wrappers + TanStack hooks)
    src/lib/{format.ts, useClock.ts}
    src/styles/index.css                                  Tailwind + both theme token sets
    src/components/ui/{Button,Input,Select,Textarea,Modal,ConfirmDialog,Alert,Badge,Table,Pagination,StatCard,RiskBar,Spinner}.tsx
    src/components/layout/{SidebarShell.tsx, TopHeader.tsx}
    src/features/auth/pages/{Landing,Login,Register,AdminSignup,ForgotPassword,ResetPassword}.tsx
    src/features/auth/components/{PasswordStrength.tsx, SecurityQuestionsFields.tsx}
    src/features/user/{UserLayout.tsx, pages/{Dashboard,Send,Withdraw,Transactions}.tsx, components/{BlockedPanel,TransactionDetailsModal,UnlockOverlay}.tsx}
    src/features/admin/{AdminLayout.tsx, pages/{Dashboard,Users,CreateUser,Approvals,AddBalance,BalanceAdjustments,Transactions,TransactionDetails,FraudAlerts,FraudOverview}.tsx, components/{UserViewModal,ReasonModal,TransactionsTable}.tsx}
```

---

### Task 1: Workspace scaffold and legacy move

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.env.example`, `.gitignore`, `README.md`
- Create: `packages/shared/{package.json,tsconfig.json,src/index.ts}`
- Create: `apps/api/{package.json,tsconfig.json,vitest.config.ts,src/index.ts}`
- Create: `apps/web/{package.json,tsconfig.json,vite.config.ts,index.html,src/main.tsx}` (placeholder `<div>FraudDetect</div>`)
- Move (git mv): all PHP files and dirs (`admin/ user/ ajax/ config/ assets/ *.php start_fraud_api.bat`) → `legacy/php/`; `fraud_api/` → `services/fraud-api/`
- Modify: `services/fraud-api/app.py` line with `MODEL_DIR` → `os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'models')`

**Interfaces:**
- Produces: workspace names `@fraud/shared`, `@fraud/api`, `@fraud/web`; root scripts `dev`, `build`, `test`, `lint`, `typecheck`, `db:migrate`, `db:seed`, `ml`.
- `.env.example`: `DATABASE_URL=postgres://postgres@localhost:5432/fraud_detection`, `DATABASE_URL_TEST=postgres://postgres@localhost:5432/fraud_detection_test`, `SESSION_SECRET=change-me`, `ML_API_URL=http://localhost:5000`, `ADMIN_SETUP_KEY=AdminSetupTZ`, `PORT=4000`, `CORS_ORIGIN=http://localhost:5173`.

- [ ] **Step 1: Move legacy code** with `git mv` into `legacy/php/` and `services/fraud-api/`; patch `MODEL_DIR`. Run `python -c "import ast,sys; ast.parse(open('services/fraud-api/app.py').read())"` → no error.
- [ ] **Step 2: Write root workspace files.** `pnpm-workspace.yaml` lists `apps/*`, `packages/*`. `tsconfig.base.json`: `strict`, `module: NodeNext` for api/shared, `target: ES2022`, `skipLibCheck`. Root scripts: `dev` = `concurrently` of `pnpm --filter @fraud/api dev` and `pnpm --filter @fraud/web dev`; `test` = `pnpm -r test`; `typecheck` = `pnpm -r typecheck`; `ml` = `python services/fraud-api/app.py`.
- [ ] **Step 3: Scaffold the three packages** with placeholder `src/index.ts` exporting `export const name = '@fraud/…'`, each with `typecheck: tsc --noEmit` and `test: vitest run --passWithNoTests`. Web uses `@vitejs/plugin-react`, tsconfig `jsx: react-jsx`, `moduleResolution: bundler`. `.gitignore`: `node_modules`, `dist`, `.env`, `logs/`, `temp/`, `*.log`, `coverage`.
- [ ] **Step 4: Install and verify.** Run `pnpm install && pnpm typecheck && pnpm test` → all three packages pass. Run `pnpm --filter @fraud/web build` → `dist/index.html` exists.
- [ ] **Step 5: Commit** `chore: scaffold pnpm workspace, move PHP to legacy/`.

---

### Task 2: Shared constants and schemas

**Files:**
- Create: `packages/shared/src/constants.ts`, `schemas/common.ts`, `schemas/auth.ts`, `schemas/user.ts`, `schemas/admin.ts`; `src/index.ts` re-exports all
- Test: `packages/shared/test/schemas.test.ts`

**Interfaces (Produces):**
```ts
export const LOCATIONS = ['Dar es Salaam','Mwanza','Arusha','Dodoma','Mbeya','Morogoro','Tanga','Moshi','Zanzibar','Kigoma'] as const;
export type Location = (typeof LOCATIONS)[number];
export const LOCATION_COORDS: Record<Location, { lat: number; lng: number }>; // PHP values
export const TRANSACTION_TYPES = ['transfer','withdrawal','deposit','bonus','refund','adjustment'] as const;
export const ADJUSTMENT_TYPES = ['deposit','bonus','refund','adjustment'] as const;
export const TRANSACTION_STATUSES = ['SUCCESS','ABORTED','PENDING'] as const;
export const FRAUD_PREDICTIONS = ['FRAUD','LEGIT','PENDING'] as const;
export const RISK_LEVELS = ['LOW','MEDIUM','HIGH'] as const;
export const ADMIN_ACTION_TYPES = ['add_balance','approve_user','disapprove_user','activate_user','deactivate_user','delete_user','reject_user','create_user','mark_reviewed'] as const;
export const FRAUD = { LARGE_TX_THRESHOLD: 1_000_000, LARGE_VOLUME_MAX_COUNT: 3, LARGE_VOLUME_MAX_SUM: 10_000_000, LARGE_VOLUME_WINDOW_MIN: 5, MANY_RECEIVERS_WINDOW_MIN: 5, MANY_RECEIVERS_BLOCK_AT: 4, MANY_SENDERS_WINDOW_MIN: 7, MANY_SENDERS_BLOCK_AT: 3, FAILED_WITHDRAWALS_WINDOW_MIN: 10, LOCATION_WINDOW_MIN: 5, MIN_WITHDRAWAL: 1_000, MAX_ADMIN_ADJUSTMENT: 10_000_000, EXTREME_AMOUNT: 10_000_000, LOGIN_MAX_FAILURES: 3, LOGIN_LOCKOUT_MIN: 5, FAILED_WITHDRAWAL_BLOCK_COUNT: 3, FAILED_WITHDRAWAL_RESET_HOURS: 24, RESET_TOKEN_TTL_MIN: 5, TRANSACTIONS_UNLOCK_TTL_MIN: 5, BALANCE_REVEAL_TTL_MIN: 5, FLAG_REVIEW_MIN_EXCLUSIVE: 40, FLAG_REVIEW_MAX_INCLUSIVE: 70, ALERT_MIN_SCORE_EXCLUSIVE: 50 } as const;
export const PAGE_SIZES = { USER_TRANSACTIONS: 15, ADMIN: 20 } as const;
// schemas/common.ts
export const amountSchema = z.number().finite().positive().multipleOf(0.01);
export const locationSchema = z.enum(LOCATIONS);
export const pageSchema = z.coerce.number().int().min(1).catch(1);
export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
export interface Paginated<T> { items: T[]; page: number; pageSize: number; total: number; totalPages: number }
// Input types are z.infer of the schemas: RegisterInput, AdminSignupInput, TransferInput, WithdrawalInput, CreateUserInput, AddBalanceInput, UserTransactionsQuery, AdminTransactionsQuery, FraudAlertsQuery, BalanceAdjustmentsQuery, UsersQuery
// schemas/auth.ts
export const loginSchema = z.object({ role: z.enum(['user','admin']), login: z.string().trim().min(1), password: z.string().min(1) });
export const registerSchema: full_name min 3, email, phone regex /^\+?[0-9]{10,15}$/ after stripping spaces (transform), password min 6, confirmPassword (refine equal), cardNumber 16-20 digits after stripping spaces, answers: z.record(z.string()) refined to ≥3 non-empty
export const adminSignupSchema: fullName min3, username /^[A-Za-z0-9_]{3,}$/, email, password min 8 + upper/lower/digit/special refine, confirmPassword, secretKey optional
export const forgotStartSchema = { email }, forgotVerifySchema = { answers: z.record(z.string()) }, resetPasswordSchema = { token: z.string().length(64), password min 6, confirmPassword }
export const principalSchema = z.object({ kind: z.enum(['user','admin']), id: z.number(), name: z.string(), email: z.string() }); export type Principal
// schemas/user.ts
export const transferSchema = z.object({ receiverId: z.number().int().positive(), amount: amountSchema, location: locationSchema, message: z.string().trim().max(500).optional() });
export const withdrawalSchema = z.object({ amount: amountSchema, location: locationSchema, message: z.string().trim().max(500).optional() });
export const verifyPasswordSchema = z.object({ password: z.string().min(1) });
export const userTransactionsQuerySchema = z.object({ search: z.string().trim().optional(), status: z.enum(TRANSACTION_STATUSES).optional(), fraud: z.enum(['fraud','legit','pending']).optional(), page: pageSchema });
export type TransferResult = { outcome: 'blocked'; reason: string; riskScore: number; riskLevel: RiskLevel; transactionId: string; locationWarning?: string } | { outcome: 'success'; transactionId: string; newBalance: number; riskScore: number; riskLevel: RiskLevel; flaggedForReview: boolean; locationWarning?: string };
export type WithdrawalResult = TransferResult | { outcome: 'failed'; failedAttempts: number; blocked: boolean; message: string };
// schemas/admin.ts
export const createUserSchema: fullName min 3, email, phone (same transform), password min 6, initialBalance z.number().min(0).multipleOf(0.01).default(0), cardNumber 16-20 digits, isApproved z.boolean().default(true), answers ≥3
export const addBalanceSchema = z.object({ amount: amountSchema.max(FRAUD.MAX_ADMIN_ADJUSTMENT), type: z.enum(ADJUSTMENT_TYPES), reason: z.string().trim().min(10) });
export const reasonSchema = z.object({ reason: z.string().trim().min(1) }); export const optionalReasonSchema = z.object({ reason: z.string().trim().optional() });
export const adminTransactionsQuerySchema: search?, status?, type? (transfer|deposit|withdrawal), riskLevel?, fraud? (fraud|legit|pending), page
export const fraudAlertsQuerySchema: search?, riskLevel?, dateFrom?/dateTo? (YYYY-MM-DD), reviewed: z.enum(['all','unreviewed','reviewed']).default('unreviewed'), page
export const balanceAdjustmentsQuerySchema: search?, type? (ADJUSTMENT_TYPES), adminId?, dateFrom?, dateTo?, page
export const usersQuerySchema = { search?, page }
```

- [ ] **Step 1: Write failing tests** in `packages/shared/test/schemas.test.ts`: `amountSchema` rejects `1000.005`, `-5`, `0`, accepts `1000.5`; `registerSchema` strips spaces from phone `+255 712 345 678` and rejects `12345`; `registerSchema` rejects when only 2 answers are non-empty; `adminSignupSchema` rejects `Password1` (no special) and accepts `Password1!`; `pageSchema` turns `"0"`, `"abc"`, `undefined` into `1`; `addBalanceSchema` rejects `10_000_000.01` and reason of 9 chars.
- [ ] **Step 2: Run** `pnpm --filter @fraud/shared test` → FAIL (module not found).
- [ ] **Step 3: Implement** constants and schemas as specified.
- [ ] **Step 4: Run tests** → PASS. `pnpm typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(shared): constants and zod schemas`.

---

### Task 3: Database schema, migrations, client, seed

**Files:**
- Create: `apps/api/src/config/env.ts`, `src/db/schema.ts`, `src/db/client.ts`, `src/db/migrate.ts`, `src/db/seed.ts`, `drizzle.config.ts`, `drizzle/` (generated SQL)
- Create: `apps/api/test/helpers/db.ts`
- Test: `apps/api/test/integration/db.test.ts`

**Interfaces (Produces):**
```ts
// config/env.ts
export const env: { DATABASE_URL: string; DATABASE_URL_TEST: string; SESSION_SECRET: string; ML_API_URL: string; ADMIN_SETUP_KEY: string; PORT: number; CORS_ORIGIN: string; NODE_ENV: 'development'|'test'|'production' }; // zod, dotenv from repo root
// db/client.ts
export type Db = NodePgDatabase<typeof schema>;
export function createDb(url: string): { db: Db; pool: pg.Pool };
// db/migrate.ts
export async function runMigrations(url: string): Promise<void>;   // drizzle-orm/node-postgres/migrator, folder apps/api/drizzle
// db/seed.ts
export async function seed(db: Db): Promise<{ adminUsername: string; adminPassword: string; users: { email: string; password: string; balance: number }[] }>; // idempotent (onConflictDoNothing)
// db/schema.ts: tables users, admins, transactions, adminActions, loginAttempts, failedLoginLog, failedWithdrawalAttempts, securityQuestions, sessions (sid varchar PK, sess json, expire timestamptz, index on expire) and pg enums transactionType, transactionStatus, fraudPrediction, riskLevel, adminActionType exactly as spec §5 (snake_case column names, camelCase TS names)
// test/helpers/db.ts
export async function setupTestDb(): Promise<Db>;      // CREATE DATABASE fraud_detection_test if missing (connect to 'postgres'), runMigrations, return db
export async function truncateAll(db: Db): Promise<void>;  // TRUNCATE all app tables RESTART IDENTITY CASCADE (not drizzle migrations table)
export async function closeTestDb(): Promise<void>;
```

- [ ] **Step 1: Write failing test** `db.test.ts`: `setupTestDb()` then `seed(db)` twice; `select count(*) from admins` = 1; `security_questions` count = 6; seeded admin's `password_hash` verifies against returned password (use bcryptjs compare directly); inserting a transaction with `amount: '-1'` is allowed (no check) but `UPDATE users SET balance = -1` throws (check constraint); `truncateAll` leaves users count 0.
- [ ] **Step 2: Run** `pnpm --filter @fraud/api test` → FAIL.
- [ ] **Step 3: Implement env, schema, client, migrate** (`drizzle-kit generate` to produce `drizzle/0000_*.sql`), seed (admin `admin`/`Admin@123`, 6 questions with keys `mother_maiden`, `first_school`, `birth_city`, `first_pet`, `favorite_teacher`, `childhood_nickname`, 4 users `amina@example.com`, `juma@example.com`, `neema@example.com`, `baraka@example.com`, password `User@123`, balances 5,000,000 / 2,500,000 / 12,000,000 / 800,000, phones `+2557000000{1..4}`, card numbers Luhn-valid 16 digits, approved+active, each with 3 hashed answers `"test"`), and test helpers. Add scripts `db:migrate` (`tsx src/db/migrate.ts` with `DATABASE_URL`) and `db:seed`.
- [ ] **Step 4: Run tests** → PASS. Run `pnpm db:migrate && pnpm db:seed` against the dev DB → prints credentials.
- [ ] **Step 5: Commit** `feat(api): drizzle schema, migrations, seed`.

---

### Task 4: HTTP app skeleton: sessions, CSRF, validation, errors, health

**Files:**
- Create: `apps/api/src/lib/errors.ts`, `src/http/app.ts`, `src/http/middleware/{session.ts,csrf.ts,auth.ts,validate.ts,errorHandler.ts,rateLimit.ts}`, `src/http/routes/health.ts`, `src/index.ts`
- Create: `apps/api/test/helpers/app.ts`, `test/helpers/mlMock.ts`
- Test: `apps/api/test/integration/app.test.ts`

**Interfaces (Produces):**
```ts
// lib/errors.ts
export class HttpError extends Error { constructor(public status: number, public code: string, message: string, public fields?: Record<string,string>) }
export class ValidationError extends HttpError { constructor(messages: string[]) /* 400, code VALIDATION, message = messages.join('\n') */ }
// http/app.ts
export interface AppDeps { db: Db; ml: MlClient; now?: () => Date; sessionSecret: string; corsOrigin: string; adminSetupKey: string; pool: pg.Pool }
export function createApp(deps: AppDeps): express.Express;
// session data (module augmentation of express-session)
interface SessionData { principal?: Principal; transactionsUnlockedUntil?: number; balanceRevealedUntil?: number; reset?: { userId: number; email: string; questionKeys: string[] }; verifyAttempts?: { count: number; windowStart: number } }
// middleware/auth.ts
export const requireUser: RequestHandler;  // 401 UNAUTHENTICATED unless principal.kind === 'user'
export const requireAdmin: RequestHandler; // 401 unless kind === 'admin'
// middleware/validate.ts
export function validate<T extends ZodTypeAny>(schema: T, source: 'body'|'query'|'params'): RequestHandler; // puts parsed into res.locals[source]
// middleware/csrf.ts: for POST/PUT/PATCH/DELETE require header x-requested-with === 'fetch' and is('application/json') else 403 CSRF
// middleware/rateLimit.ts: export function sessionRateLimit(key: string, max: number, windowMs: number): RequestHandler // 429 RATE_LIMITED, state in session
// routes/health.ts: GET /api/health → { status: 'ok', db: boolean, ml: { available: boolean } }
// test/helpers/app.ts
export async function makeTestApp(opts?: { ml?: MlClient; now?: () => Date }): Promise<{ app: Express; db: Db; agent: () => supertest.Agent }>; // agent() returns supertest.agent(app) with helper .json() that sets both headers
// test/helpers/mlMock.ts
export function mlMock(result: MlResult | 'down'): MlClient;
```

- [ ] **Step 1: Write failing tests** `app.test.ts`: `GET /api/health` → 200 `{ status:'ok', db:true }`; `POST /api/auth/logout` without headers → 403 `{ error: { code: 'CSRF' } }`; with headers → 204; `GET /api/me/dashboard` unauthenticated → 401 `UNAUTHENTICATED`; `POST /api/auth/login` with body `{}` → 400 `VALIDATION` with `fields.role`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** app factory (helmet-less; `express.json({limit:'100kb'})`, cors with credentials for `corsOrigin`, session cookie `fd.sid` httpOnly SameSite=Lax, `connect-pg-simple` on `deps.pool` table `sessions`, rolling 30 min), middleware, health route, a stub `POST /api/auth/logout` (destroys session, clears cookie, 204) and a stub `/api/auth/login` wired only to `validate(loginSchema)` returning 501 for now. `src/index.ts` boots with real env, `MlClient` from Task 6 (import a placeholder class now that Task 6 fills).
- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** `feat(api): express app with sessions, csrf, validation, health`.

---

### Task 5: Fraud engine pure functions

**Files:**
- Create: `apps/api/src/lib/time.ts`, `src/lib/ids.ts`, `src/lib/money.ts`, `src/modules/fraud/location.ts`, `patterns.ts`, `rules.ts`, `features.ts`
- Test: `apps/api/test/unit/{time,ids,location,patterns,rules,features}.test.ts`

**Interfaces (Produces):**
```ts
// lib/time.ts
export function hourInDar(d: Date): number;                 // Intl.DateTimeFormat hour in Africa/Dar_es_Salaam, 0-23
export function minutesAgo(now: Date, m: number): Date;
export function daysBetween(a: Date, b: Date): number;      // floor
// lib/ids.ts
export function newTransactionId(now: Date, rand?: () => number): string; // 'TXN' + yyyyMMddHHmmss (Dar time) + 4 digits 1000-9999
// lib/money.ts
export function num(v: string | number | null): number;     // numeric→number, null→0
export function formatTsh(v: number): string;               // 'TSh 1,234.56'
// fraud/location.ts
export function distanceKm(a: Location, b: Location): number;  // haversine, R=6371, rounded to integer
export interface LocationChange { changed: boolean; previousLocation?: Location; newLocation: Location; distanceKm?: number; timeElapsedMinutes: number }
export function locationScore(c: LocationChange): number;   // 0 if !changed; else 10 + (50|30|15|0)
export function locationWarning(c: LocationChange): string | undefined; // '⚠️ Location changed from A to B (D km away) in 5 minutes'
// fraud/patterns.ts
export interface VelocityContext { transactionCountLast5Min: number; amountLast5Min: number; largeCountLast5Min: number; largeSumLast5Min: number; uniqueReceiversLast5Min: number; receiverAlreadyInWindow: boolean; uniqueSendersToReceiverLast7Min: number; senderAlreadyInReceiverWindow: boolean; uniqueSendersLast5Min: number; failedWithdrawalsLast10Min: number; avgUserAmount: number }
export interface PatternBlock { pattern: 1|2|3; score: 85|90; dbMessage: string; userMessage: string }
export function checkLargeVolume(amount: number, ctx: VelocityContext, userMessage?: string): PatternBlock | null;
export function checkManyReceivers(ctx: VelocityContext, userMessage?: string): PatternBlock | null;
export function checkManySenders(ctx: VelocityContext, userMessage?: string): PatternBlock | null;
// fraud/rules.ts
export interface MlResult { riskScore: number; prediction: FraudPrediction; riskLevel: RiskLevel; predictionTime: Date | null; modelVersion: string }
export const ML_FALLBACK: MlResult; // 0, LEGIT, LOW, null, '1.0.0'
export interface RuleInput { amount: number; balance: number; hour: number; locationScore: number; ctx: VelocityContext }
export interface RuleOutcome { fraudScore: number; fraudPrediction: FraudPrediction; riskLevel: RiskLevel; block: boolean; blockReason: string | null }
export function applyTransferRules(i: RuleInput, ml: MlResult): RuleOutcome;
export function applyWithdrawalRules(i: RuleInput, ml: MlResult): RuleOutcome;
export function isFlaggedForReview(score: number): boolean;  // 40 < score <= 70
// fraud/features.ts
export interface MlFeatures { amount: number; transaction_count_last_5min: number; amount_last_5min: number; unique_receivers_last_5min: number; unique_senders_last_5min: number; failed_withdrawals_last_10min: number; transaction_hour: number; avg_user_amount: number; amount_deviation: number; account_age_days: number; balance: number }
export function buildFeatures(a: { amount: number; hour: number; balance: number; accountCreatedAt: Date; now: Date; ctx: VelocityContext }): MlFeatures;
```
Message formats (exact): Pattern 1 db `BLOCKED: Large transaction volume - {n} large transactions totaling {formatTsh(sum)} in 5 minutes (max: 3, 10M) | {msg}`, user `You have made {n} large transactions totaling {formatTsh(sum)} in the last 5 minutes.\nMaximum allowed: 3 large transactions totaling 10,000,000 TSh per 5 minutes.\n\nPlease wait a few minutes before sending again.`; Pattern 2 db `BLOCKED: User has {u} unique receivers in 5 minutes. Attempting to send to {n} (max: 4) | {msg}`, user `You have sent money to {u} different recipients in the last 5 minutes.\nMaximum allowed: 3 recipients per 5 minutes.\n\nPlease wait a few minutes before sending again.`; Pattern 3 db `BLOCKED: Receiver has {u} unique senders in 7 minutes. Attempting to receive from {n} (max: 3) | {msg}`, user `The recipient has received money from {u} different senders in the last 7 minutes.\nMaximum allowed: 2 senders per 7 minutes.\n\nPlease wait a few minutes before sending again.`

- [ ] **Step 1: Write failing unit tests** with these assertions:
  - `hourInDar(new Date('2026-10-29T02:30:00Z'))` → 5; `'2026-10-29T03:00:00Z'` → 6.
  - `newTransactionId(new Date('2026-10-29T10:00:00Z'), () => 0)` → `'TXN202610291300001000'`; random variant matches `/^TXN\d{14}\d{4}$/`.
  - `distanceKm('Dar es Salaam','Mwanza')` within ±5 of 843; same city → 0.
  - `locationScore`: unchanged → 0; changed 30 km → 10; 100 km → 25; 300 km → 40; 600 km → 60.
  - Pattern 1: ctx large 2 / sum 9,000,000 + amount 1,500,000 → block (n=3, sum 10,500,000); + amount 500,000 → null; large 3 / sum 11,000,000 + amount 100 → block; large 2 / sum 5,000,000 + amount 1,500,000 → null (sum 6.5M).
  - Pattern 2: unique 3, receiver new → block (n=4), dbMessage contains `(max: 4)`; unique 3, receiver already in window → null; unique 2, new → null.
  - Pattern 3: unique 2, sender new → block; unique 2, already → null; unique 1, new → null.
  - `applyTransferRules`: ML 20/LEGIT/LOW with no triggers → score 20, no block; failed withdrawals 3 → 85/FRAUD/HIGH block reason "Multiple failed withdrawal attempts detected"; hour 5 amount 1,000,001 → 80 "Abnormal transaction at unusual hour with large amount"; hour 6 same amount → no block; locationScore 40 amount 500,001 → 75 "Suspicious location change with large transaction", and final score 100 (min(75+40,100)=100? no: 75+40=115→100); locationScore 25 amount 500,001 → ML score + 25, no block; amount 10,000,001 → 90 "Transaction amount exceeds security threshold"; hour 5 amount 20,000,000 → score 90 and reason "Transaction amount exceeds security threshold" (last wins); ML 95 and no rules → 95 no block.
  - `applyWithdrawalRules`: count 3 sum 10,000,001 → 85 "Multiple large transactions detected in short period"; hour 3 amount 1,000,001 → 85 "Abnormal withdrawal at unusual hour with large amount"; locationScore 40 amount 600,000 → 80 "Suspicious location change with large withdrawal"; amount 1,000,001 balance 1,100,000 → 80 "Attempting to withdraw more than 90% of balance"; amount 900,000 balance 1,000,000 → no block (amount not > 1M); amount 10,000,001 → 90 "Withdrawal amount exceeds security threshold".
  - `isFlaggedForReview`: 40 → false, 41 → true, 70 → true, 71 → false.
  - `buildFeatures`: avg 0 → deviation 0; avg 50,000 amount 150,000 → `(100000)/(50001)`; account created 10 days before now → 10.
- [ ] **Step 2: Run** `pnpm --filter @fraud/api test unit` → FAIL.
- [ ] **Step 3: Implement** all functions.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(api): fraud engine pure functions`.

---

### Task 6: ML client

**Files:**
- Create: `apps/api/src/modules/fraud/mlClient.ts`
- Test: `apps/api/test/unit/mlClient.test.ts`

**Interfaces (Produces):**
```ts
export class MlClient {
  constructor(baseUrl: string, fetchImpl: typeof fetch = fetch, timeouts = { health: 3000, predict: 5000 });
  isAvailable(): Promise<boolean>;                       // GET /health, 200 → true; error/timeout → false
  predict(features: MlFeatures): Promise<MlResult | null>; // POST /predict; null on non-200, non-success status, network error, timeout
  modelInfo(): Promise<unknown | null>;
}
export async function scoreWithMl(ml: MlClient, features: MlFeatures): Promise<{ result: MlResult; used: boolean }>; // isAvailable → predict → else ML_FALLBACK
```

- [ ] **Step 1: Write failing tests** using a fake `fetchImpl`: health 200 → available; health throws → not available; predict returns `{status:'success', risk_score: 72, prediction:'FRAUD', risk_level:'HIGH', prediction_time:'2026-10-29T10:00:00', model_version:'1.0.0'}` → `MlResult` with riskScore 72, predictionTime a Date; predict 500 → null; predict `{status:'error'}` → null; `scoreWithMl` with health down → `{ result: ML_FALLBACK, used: false }`; AbortSignal timeout respected (fake fetch that never resolves, timeouts 10 ms → null within 100 ms).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** with `AbortSignal.timeout`. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(api): ML client with graceful degrade`.

---

### Task 7: Velocity repository and transaction repository

**Files:**
- Create: `apps/api/src/modules/fraud/velocity.ts`, `src/modules/transactions/repo.ts`, `src/modules/users/repo.ts`
- Create: `apps/api/test/helpers/fixtures.ts`
- Test: `apps/api/test/integration/velocity.test.ts`

**Interfaces (Produces):**
```ts
// users/repo.ts
export type UserRow = typeof users.$inferSelect;
export async function findUserById(db: Db, id: number): Promise<UserRow | null>;
export async function findActiveUserById(db: Db, id: number): Promise<UserRow | null>;
export async function findUserByLogin(db: Db, login: string): Promise<UserRow | null>; // email|phone|card_number, is_active
export async function listRecipients(db: Db, excludeId: number): Promise<{ id: number; fullName: string; email: string; phone: string }[]>;
export async function updateUserLocation(tx: Db, userId: number, location: Location): Promise<void>;
// transactions/repo.ts
export interface NewTransaction { transactionId: string; senderId: number | null; receiverId: number | null; senderName: string | null; receiverName: string | null; amount: number; transactionType: TransactionType; status: TransactionStatus; message: string | null; fraudScore: number; fraudPrediction: FraudPrediction | null; riskLevel: RiskLevel | null; predictionTime: Date | null; modelVersion: string | null; featureData: unknown | null; transactionLocation: string | null; ipAddress: string | null; userAgent: string | null; adminId: number | null }
export async function insertTransaction(tx: Db, t: NewTransaction): Promise<{ id: number }>;
export async function debitBalance(tx: Db, userId: number, amount: number): Promise<boolean>;  // UPDATE … WHERE balance >= amount; returns rowCount === 1
export async function creditBalance(tx: Db, userId: number, amount: number): Promise<void>;
// fraud/velocity.ts
export async function getVelocityContext(db: Db, a: { senderId: number; receiverId?: number; now: Date }): Promise<VelocityContext>;
export async function getLocationChange(db: Db, a: { userId: number; newLocation: Location; now: Date }): Promise<LocationChange>; // most recent sent tx with location in last 5 min
export async function getFailedWithdrawalCount(db: Db, userId: number, now: Date): Promise<number>; // after resetting rows older than 24 h
export async function incrementFailedWithdrawal(tx: Db, userId: number, now: Date): Promise<number>; // upsert, returns new count
export async function resetFailedWithdrawals(tx: Db, userId: number): Promise<void>;
// test/helpers/fixtures.ts
export async function createUser(db: Db, o?: Partial<{ fullName; email; phone; cardNumber; password; balance; isApproved; isActive; createdAt; lastKnownLocation }>): Promise<UserRow & { password: string }>;
export async function createAdmin(db: Db, o?): Promise<{ id; username; password }>;
export async function insertTx(db: Db, o: Partial<NewTransaction> & { createdAt?: Date }): Promise<{ id: number }>; // allows explicit created_at for window tests
```

- [ ] **Step 1: Write failing integration tests**: seed sender A, receivers B, C, D, E. Insert via `insertTx` with explicit `createdAt`: A→B 1,500,000 (2 min ago), A→C 2,000,000 ABORTED (4 min ago), A→D 500 (6 min ago), withdrawal by A ABORTED (3 min ago), E→A transfer (1 min ago). Assert `getVelocityContext(A, receiverId: B)`: transactionCountLast5Min 3 (B, C, withdrawal), amountLast5Min 3,500,000, largeCount 2, largeSum 3,500,000, uniqueReceivers 2, receiverAlreadyInWindow true, uniqueSendersLast5Min 1, failedWithdrawalsLast10Min 1; with receiverId D → `receiverAlreadyInWindow` false; `uniqueSendersToReceiverLast7Min` for receiver A = 1 and `senderAlreadyInReceiverWindow` false for sender B; `avgUserAmount` = avg of A's SUCCESS sends (1,500,250). `getLocationChange` with last tx location 'Dar es Salaam' and new 'Mwanza' → changed, distance ≈ 843; new 'Dar es Salaam' → unchanged. `incrementFailedWithdrawal` twice → 2; set `last_attempt_time` to 25 h ago then `getFailedWithdrawalCount` → 0. `debitBalance` with insufficient balance → false and balance unchanged.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** with Drizzle `sql` templates (`now()` replaced by the passed `now` parameter so tests are deterministic: `created_at >= $now - interval '5 minutes'`). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(api): velocity counters and transaction repository`.

---

### Task 8: Login, lockout, logout, me

**Files:**
- Create: `apps/api/src/lib/password.ts`, `src/modules/auth/lockout.ts`, `src/modules/auth/login.ts`, `src/http/routes/auth.ts` (login/logout/me only for now)
- Modify: `src/http/app.ts` (mount auth routes, remove stubs)
- Test: `apps/api/test/integration/login.test.ts`

**Interfaces (Produces):**
```ts
// lib/password.ts
export const hashPassword: (plain: string) => Promise<string>; export const verifyPassword: (plain: string, hash: string) => Promise<boolean>;
// auth/lockout.ts
export async function getLockout(db: Db, login: string, ip: string, now: Date): Promise<{ locked: false } | { locked: true; lockoutUntil: Date; minutesRemaining: number }>;
export async function recordFailure(db: Db, login: string, ip: string, userId: number | null, now: Date): Promise<{ attemptCount: number; lockoutUntil: Date | null }>; // restart at 1 if the existing row's lockout has expired
export async function resetAttempts(db: Db, login: string, ip: string): Promise<void>;
// auth/login.ts
export async function login(db: Db, a: { role: 'user'|'admin'; login: string; password: string; ip: string; now: Date }): Promise<Principal>; // throws HttpError 423 LOCKED {lockoutUntil, minutesRemaining in fields}, 403 PENDING_APPROVAL, 401 INVALID_CREDENTIALS with fields.attemptsRemaining
// routes: POST /api/auth/login → 200 Principal (session regenerated); POST /api/auth/logout → 204; GET /api/auth/me → 200 Principal | 401
```
Messages: locked `Your account is locked. Please wait {n} minute(s) before trying again.`; locked by this failure `Too many failed attempts. Account locked for 5 minute(s).`; invalid `Invalid {admin|user} credentials. {k} attempt(s) remaining before lockout.`; pending `Your account is pending admin approval. Please wait for confirmation.`

- [ ] **Step 1: Write failing tests** (`now` injectable via `makeTestApp({ now })`): user login by email, by phone, by card number each → 200 and `GET /me` → principal kind `user`; wrong password → 401 `attemptsRemaining` 2 then 1; third failure → 423 with message "Too many failed attempts…"; fourth attempt (even with correct password) → 423 "Your account is locked…"; advance `now` 6 min → correct password → 200 and `login_attempts.attempt_count` is 0; after expiry one wrong password → 401 with `attemptsRemaining` 2 (not 423); unapproved user correct password → 403 and `failed_login_log` count unchanged; admin login by username and by email → 200 kind `admin`, `admins.last_login` set; logout → 204 then `/me` → 401; login as user then as admin in the same agent → `/me` is admin (session replaced).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(api): login with lockout, logout, me`.

---

### Task 9: Registration, admin signup, security questions

**Files:**
- Create: `apps/api/src/modules/auth/register.ts`, `src/modules/auth/adminSignup.ts`
- Modify: `src/http/routes/auth.ts`, add `GET /api/security-questions` in `routes/health.ts` (rename file to `public.ts`)
- Test: `apps/api/test/integration/register.test.ts`

**Interfaces (Produces):**
```ts
export async function registerUser(db: Db, input: RegisterInput): Promise<{ id: number }>; // 409 DUPLICATE 'Email, phone number, or card number already exists'; 400 if fewer than 3 answers match active question keys
export async function adminSignup(db: Db, input: AdminSignupInput, setupKey: string): Promise<{ id: number }>; // first admin needs no key; else 403 INVALID_KEY '❌ Invalid secret key. You don't have permission to create admin accounts.'; 409 DUPLICATE 'Username or email already exists'
export async function listActiveQuestions(db: Db): Promise<{ id: number; key: string; text: string }[]>;
// routes: POST /api/auth/register → 201 { message: 'Registration successful. Your account is pending admin approval — you'll be notified once it's reviewed.' }; POST /api/auth/admin-signup → 201; GET /api/security-questions → 200 [{ id, key, text }]; GET /api/auth/admin-signup/status → { firstAdmin: boolean }
```

- [ ] **Step 1: Write failing tests**: register happy path → 201, user `is_approved` false, balance `0.00`, `security_answers` has 3 keys whose values verify with bcrypt against the plain answers (and are not the plain text); duplicate email → 409; phone with spaces stored normalised; login as the new user → 403 pending; admin-signup with empty admins table and no key → 201; second signup without key → 403; with key `AdminSetupTZ` → 201; duplicate username → 409; `GET /security-questions` → 6 rows with `key` and `text`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(api): registration and admin signup`.

---

### Task 10: Forgot password, verify answers, reset

**Files:**
- Create: `apps/api/src/modules/auth/passwordReset.ts`
- Modify: `src/http/routes/auth.ts`
- Test: `apps/api/test/integration/passwordReset.test.ts`

**Interfaces (Produces):**
```ts
export async function startReset(db: Db, email: string): Promise<{ userId: number; questions: { key: string; text: string }[] }>; // 404 'Email not found. Please check your email address.'; 403 DEACTIVATED 'Your account has been deactivated. Please contact support.'; 403 PENDING_APPROVAL 'Your account is pending admin approval. Please wait for confirmation.'; 400 INSUFFICIENT_QUESTIONS 'Your account doesn't have sufficient security questions set up. Please contact support.'
export async function verifyAnswers(db: Db, userId: number, answers: Record<string,string>, now: Date): Promise<{ token: string; expiresAt: Date }>; // 400 'Please answer at least 3 security questions.'; 400 INCORRECT_ANSWERS 'Incorrect answers. Please try again. ({n}/3 correct)'
export async function checkToken(db: Db, token: string, now: Date): Promise<{ valid: true; expiresAt: Date; userName: string } | { valid: false; reason: 'INVALID' | 'EXPIRED' }>;
export async function resetPassword(db: Db, token: string, password: string, now: Date): Promise<void>; // 400 INVALID_TOKEN 'Invalid reset token. Please request a new password reset.' / EXPIRED_TOKEN 'Your reset token has expired (valid for 5 minutes). Please request a new one.'
// routes: POST /api/auth/forgot-password/start → { questions } and session.reset set; POST /api/auth/forgot-password/verify → { token, expiresAt } (400 SESSION_EXPIRED 'Your session expired. Please start again.' if no session.reset; failures also call recordFailure(db, email, ip) and a locked email gets 423); GET /api/auth/reset-password/:token → checkToken result; POST /api/auth/reset-password → 200 { message: 'Password reset successfully. You can now sign in with your new password.' }
```

- [ ] **Step 1: Write failing tests**: start with unknown email → 404; deactivated → 403; pending → 403; user with 2 answers → 400; happy → 200 with 3 questions; verify without start → 400 `SESSION_EXPIRED`; verify 2 correct of 3 → 400 "(2/3 correct)"; 3 correct → token 64 hex, `users.reset_token` set, expiry = now + 5 min; three wrong verifies → 423; `GET reset-password/:token` → valid with `expiresAt`; after 6 min → `{ valid:false, reason:'EXPIRED' }`; reset with valid token → 200, old password fails login, new one succeeds, token cleared; reset again with same token → 400 INVALID_TOKEN.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(api): password reset via security questions`.

---

### Task 11: Transfer pipeline

**Files:**
- Create: `apps/api/src/modules/transactions/transfer.ts`, `src/http/routes/me.ts` (`POST /api/me/transfers` only)
- Modify: `src/http/app.ts`
- Test: `apps/api/test/integration/transfer.test.ts`

**Interfaces (Produces):**
```ts
export interface TransferDeps { db: Db; ml: MlClient; now: () => Date }
export interface TransferCommand { userId: number; receiverId: number; amount: number; location: Location; message?: string; ip: string | null; userAgent: string | null }
export async function executeTransfer(d: TransferDeps, c: TransferCommand): Promise<TransferResult>; // throws ValidationError (400) for validation failures; HttpError 409 DEBIT_FAILED 'Failed to deduct balance'
// route: POST /api/me/transfers (requireUser, validate(transferSchema)) → 200 TransferResult; blocked responses are 200 with outcome 'blocked' and carry `reasonText` (the multi-line user text) besides `reason`
```
Blocked response for pattern blocks: `reason` = pattern's `userMessage`, `riskScore` = 85/90, `riskLevel` 'HIGH'. Blocked by rules: `reason` = `blockReason`, text `❌ Transaction BLOCKED due to fraud detection.\n\nReason: {r}\nRisk Score: {s}%\nRisk Level: {l}\n\nPlease contact support if you believe this is a mistake.` Success message `Transaction successful! You sent {formatTsh(amount)} to {receiverName}`; include `message` field in both.

- [ ] **Step 1: Write failing tests** (ML mocked to `ML_FALLBACK` unless stated; `now` fixed at 12:00 Dar time):
  - happy path 100,000 from A (5,000,000) to B → 200 success, A balance 4,900,000, B +100,000, row SUCCESS score 0 LEGIT LOW, `feature_data` has 11 keys, `sender_name`/`receiver_name` filled, A `last_known_location` updated.
  - `rejects invalid amounts`: `1000.005`, `"abc"`, `-5`, `0` → 400 VALIDATION, no rows.
  - self transfer → 400 "You cannot send money to yourself"; amount > balance → 400 contains "Insufficient balance. Your balance is TSh 5,000,000.00"; `rejects inactive receiver` (deactivate B first) → 400 "Invalid receiver selected", no row.
  - Pattern 1: two prior large sends (4M, 5M, both ≤5 min ago) then 1,500,000 → blocked, row ABORTED score 85, message starts `BLOCKED: Large transaction volume - 3 large transactions totaling TSh 10,500,000.00`; balances unchanged. Then even 100 → blocked (side effect preserved). Prior sends 6 min ago → success.
  - Pattern 2: sends to B, C, D (within 5 min) then E → blocked score 90, message contains `(max: 4)`; then to B again → success.
  - Pattern 3: B→A and C→A within 7 min then D→A → blocked score 90; B→A again → success.
  - ML down (`mlMock('down')`) → success with score 0 and `model_version` '1.0.0'; ML returns 65/FRAUD/MEDIUM → success, `flaggedForReview` true, row score 65 prediction FRAUD; ML returns 95 → success and not flagged (PHP parity).
  - Rules: 3 ABORTED withdrawals in last 10 min → blocked "Multiple failed withdrawal attempts detected" score 85; `now` at 05:30 Dar and 1,500,000 → blocked 80; same at 06:00 → success; previous send 2 min ago from 'Dar es Salaam', new location 'Mwanza' amount 600,000 → blocked 75 + 60 → score 100, response `locationWarning` present; same with amount 400,000 → success, score 60, `flaggedForReview` true, warning present; 10,000,001 → blocked 90 (needs balance ≥, give A 20M).
  - `concurrent transfers cannot overdraw`: A balance 1,000, fire two 800 transfers with `Promise.all` → one success one 409, A balance 200, exactly one SUCCESS row.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `executeTransfer` as spec §6.1 (pattern checks → location → validation → ML → rules → `db.transaction`). Route reads `req.ip` and `user-agent`. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(api): transfer pipeline with fraud patterns and rules`.

---

### Task 12: Withdrawal pipeline

**Files:**
- Create: `apps/api/src/modules/transactions/withdrawal.ts`
- Modify: `src/http/routes/me.ts` (`POST /api/me/withdrawals`)
- Test: `apps/api/test/integration/withdrawal.test.ts`

**Interfaces (Produces):**
```ts
export interface WithdrawalCommand { userId: number; amount: number; location: Location; message?: string; ip: string | null; userAgent: string | null }
export async function executeWithdrawal(d: TransferDeps, c: WithdrawalCommand): Promise<WithdrawalResult>;
```
Texts: lockout `❌ WITHDRAWAL BLOCKED\n\nYour withdrawals are temporarily blocked due to multiple consecutive failed withdrawal attempts.\nPlease contact support to unblock your account.`; min `Minimum withdrawal amount is TSh 1,000`; failed `Insufficient balance. Please try a lower amount.`; success `Withdrawal successful! You withdrew {formatTsh(amount)}`; blocked by rules same template as transfer with "Withdrawal".

- [ ] **Step 1: Write failing tests**: happy 50,000 from 1,000,000 → success, balance 950,000, row `withdrawal` SUCCESS `receiver_id` null; 999 → 400 min message; insufficient balance 2,000,000 → 200 `outcome:'failed'`, `failedAttempts` 1, row ABORTED prediction PENDING risk MEDIUM score 60, message `FAILED: Insufficient balance (Attempt 1) | `; second → score 70; third → `blocked` true; fourth request 50,000 → `outcome:'blocked'` score 95 message starts `BLOCKED: User has 3 consecutive failed withdrawal attempts`; set `last_attempt_time` 25 h ago → 50,000 succeeds and counter reset to 0; successful withdrawal resets counter from 2 to 0; rules: three prior sends summing 10,000,001 within 5 min then withdraw 50,000 → blocked 85 "Multiple large transactions detected in short period"; 05:00 Dar 1,500,000 → 85; location change >200 km with 600,000 → 80 (+40 → 100); 1,500,000 from balance 1,600,000 → 80 "Attempting to withdraw more than 90% of balance"; 10,000,001 from 20M → 90; ML not called on failed attempts (mock records calls).
- [ ] **Step 2–4:** FAIL → implement (spec §6.2) → PASS. **Step 5: Commit** `feat(api): withdrawal pipeline`.

---

### Task 13: User read endpoints and session gates

**Files:**
- Create: `apps/api/src/modules/users/{dashboard.ts,transactions.ts,context.ts}`
- Modify: `src/http/routes/me.ts`
- Test: `apps/api/test/integration/me.test.ts`

**Interfaces (Produces):**
```ts
export async function getDashboard(db: Db, userId: number): Promise<{ user: { id; fullName; email; phone; cardLast4; location: string | null; createdAt }; balance: number | null; stats: { total; successful; aborted; pending; successRate: number }; fraud: { analyzed; fraud; legit; avgScore; maxScore }; recent: TransactionListItem[] }>;
export interface TransactionListItem { id; transactionId; type: TransactionType; direction: 'sent'|'received'|'withdrawal'|'deposit'; counterpartyName: string | null; amount; status; fraudScore; fraudPrediction; riskLevel; message; location; createdAt }
export async function listUserTransactions(db: Db, userId: number, q: UserTransactionsQuery): Promise<{ items: TransactionListItem[]; page; pageSize: 15; total; totalPages }>;
export async function getSendContext(db: Db, userId: number, receiverId: number | undefined, now: Date): Promise<{ balance; recipients; locations: readonly Location[]; defaultLocation: Location; largeVolume: { count; totalAmount; blocked: boolean }; receivers: { unique; blocked: boolean }; senders: { unique; blocked: boolean } }>;
export async function getWithdrawContext(db: Db, userId: number, now: Date): Promise<{ balance; locations; defaultLocation; failedAttempts: number; blocked: boolean }>;
// routes (all requireUser):
// GET /api/me/dashboard (balance null unless session.balanceRevealedUntil > now)
// POST /api/me/verify-password → 200 { ok: true } sets balanceRevealedUntil = now+5min; 401 { ok:false, message:'Incorrect password' }; sessionRateLimit('verify', 5, 60_000)
// GET /api/me/transactions → { locked: true } | { locked: false, ...list }
// POST /api/me/transactions/unlock { password } → 204 (sets transactionsUnlockedUntil) | 401
// POST /api/me/transactions/lock → 204
// GET /api/me/send/context?receiverId=  ; GET /api/me/withdraw/context
```

- [ ] **Step 1: Write failing tests**: dashboard balance null; after `verify-password` with correct password → balance number; wrong password 6 times in a minute → 429 on the 6th; transactions locked by default `{ locked: true }` with no `items`; unlock with wrong password → 401; correct → 204 then list shows items with `direction` 'sent' for sender rows and 'received' for receiver rows, page size 15 and `totalPages` for 20 rows = 2; `search` by transaction id matches; `status=ABORTED` filter; `fraud=pending` returns rows with null prediction; advance `now` 6 min → locked again; `lock` → locked; send context lists only active approved others and `defaultLocation` = user's last known or 'Dar es Salaam'; `receivers.blocked` true when 4 distinct receivers in window; withdraw context `blocked` true when count ≥ 3.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(api): user dashboard, transactions, contexts`.

---

### Task 14: Admin user management and balance adjustments

**Files:**
- Create: `apps/api/src/modules/admin/{audit.ts,users.ts}`, `src/http/routes/admin.ts`
- Modify: `src/http/app.ts`
- Test: `apps/api/test/integration/adminUsers.test.ts`

**Interfaces (Produces):**
```ts
// audit.ts
export async function logAdminAction(tx: Db, a: { adminId: number; adminName: string; actionType: AdminActionType; userId?: number | null; userName?: string | null; amount?: number | null; reason?: string | null; details?: string | null; ip: string | null }): Promise<void>;
// users.ts
export async function listUsers(db, q: { search?: string; page: number }): Promise<Paginated<AdminUserRow>>; // AdminUserRow: id, fullName, email, phone, balance, cardLast4, isApproved, isActive, createdAt, status: 'inactive'|'pending'|'active'
export async function getUser(db, id): Promise<AdminUserRow>;
export async function listPendingUsers(db): Promise<AdminUserRow[]>;
export async function createUser(db, input: CreateUserInput, admin: Principal, ip): Promise<{ id: number; message: string }>; // message '✅ User created successfully! Account is active.' | '… Account requires approval.'; audit create_user amount=initialBalance details 'Security questions set: {n} answered'
export async function setUserFlag(db, id, action: 'approve'|'disapprove'|'activate'|'deactivate', admin, ip, reason?: string): Promise<void>; // 409 NO_CHANGE if already in target state; audit reason/details strings as spec/PHP ('User account approved' / 'User approved by admin', etc.; approve from approvals page passes the admin's reason)
export async function rejectUser(db, id, reason, admin, ip): Promise<void>; // delete only if is_approved=false else 409; audit reject_user details 'User account rejected'
export async function deleteUser(db, id, admin, ip): Promise<void>; // 404 if missing; audit delete_user details 'User deleted by admin - Email: {email}'
export async function addBalance(db, id, input: AddBalanceInput, admin, ip, userAgent, now): Promise<{ newBalance: number; transactionId: string }>; // §6.3
export async function listUserAdjustments(db, id): Promise<AdjustmentRow[]>; // last 10
// routes under /api/admin (requireAdmin): GET users, GET users/:id, POST users, GET pending-users, POST users/:id/approve|disapprove|activate|deactivate (optionalReasonSchema), POST users/:id/reject (reasonSchema), DELETE users/:id, POST users/:id/balance, GET users/:id/adjustments
```

- [ ] **Step 1: Write failing tests**: non-admin → 401; list with search by partial name/email/phone and page size 20; create user with 3 answers and `isApproved:true` → 201, user approved, audit row `create_user` with `amount` = initial balance; duplicate → 409; approve pending → 200 and audit `approve_user`; approve again → 409; deactivate then activate; reject approved user → 409; reject pending → user gone, audit `reject_user` with reason; `delete keeps transaction history`: user with 2 transactions deleted → rows remain with `sender_id` null, audit `delete_user` details contains email; add balance 250,000 type `bonus` reason ≥10 chars → balance +250,000, transaction row `bonus` SUCCESS `sender_id` null `admin_id` = admin, message `Admin adjustment: {reason}`, audit `add_balance`; amount 10,000,000.01 → 400; adjustments list returns it.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(api): admin user management and balance adjustments`.

---

### Task 15: Admin counters, dashboard, transactions, fraud alerts, adjustments log

**Files:**
- Create: `apps/api/src/modules/admin/{counters.ts,transactions.ts,fraudAlerts.ts,balanceAdjustments.ts,dashboard.ts}`
- Modify: `src/http/routes/admin.ts`
- Test: `apps/api/test/integration/adminMonitoring.test.ts`

**Interfaces (Produces):**
```ts
export async function getCounters(db, now): Promise<{ newUsers24h; pendingUsers; aborted24h; fraudAlerts; highRisk; reviewQueue }>; // reviewQueue = fraud_prediction='PENDING' AND fraud_score>0; fraudAlerts = FRAUD AND score>50 AND reviewed_at IS NULL
export async function getAdminDashboard(db, now): Promise<{ kpis: { totalUsers; totalTransactions; successful; aborted; moneyMoved; fraudDetected; highRisk; reviewQueue }; recentAlerts: AdminTxRow[]; recentTransactions: AdminTxRow[]; recentUsers: AdminUserRow[] }>;
export interface AdminTxRow { id; transactionId; senderId; senderName: string | null; receiverId; receiverName: string | null; amount; type; status; fraudScore; fraudPrediction; riskLevel; location; createdAt; reviewedAt }
export async function listAdminTransactions(db, q): Promise<Paginated<AdminTxRow>>; // search over transaction_id, sender name, receiver name in BOTH count and list
export async function getAdminTransaction(db, id): Promise<AdminTxRow & { message; modelVersion; predictionTime; featureData; ipAddress; userAgent; sender: PartyInfo | null; receiver: PartyInfo | null; admin: { id; fullName; username } | null; reviewedBy }>; // PartyInfo: id, fullName, email, phone, balance
export async function listFraudAlerts(db, q): Promise<Paginated<AdminTxRow>>;
export async function markReviewed(db, id, admin, ip): Promise<void>; // 404 NOT_FRAUD, 409 ALREADY_REVIEWED; audit mark_reviewed
export async function listBalanceAdjustments(db, q): Promise<Paginated<AdjustmentLogRow> & { summary: { total; totalAmount; avgAmount; uniqueUsers; uniqueAdmins; byType: { type; count; total }[] } }>; // AdjustmentLogRow adds user email, admin fullName/username, ipAddress
export async function listAdmins(db): Promise<{ id; fullName; username }[]>;
// routes: GET counters, GET dashboard, GET transactions, GET transactions/:id, POST transactions/:id/review, GET fraud-alerts, GET balance-adjustments, GET admins
```

- [ ] **Step 1: Write failing tests** with a fixture set (users, 3 FRAUD rows score 60/80/90 with one HIGH, 1 PENDING-prediction row score 60, 2 SUCCESS legit, 1 ABORTED 2 days ago, admin bonus via Task 14): counters values; dashboard `fraudDetected` 3 (not 6), `moneyMoved` sums SUCCESS only; transactions `search` by receiver name returns correct `total` (the PHP crash case); filters `status`, `type`, `riskLevel`, `fraud=pending` (prediction PENDING or null); details includes `sender.balance` and `featureData`; fraud alerts default excludes reviewed, `reviewed=all` includes; `review` → `reviewed_at` set, status unchanged, audit row; review again → 409; review a LEGIT row → 404; adjustments log summary `uniqueAdmins` 1 and `byType` has `bonus`; filter `adminId`, `type`, `dateFrom`/`dateTo` (Dar dates).
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(api): admin monitoring endpoints`.

---

### Task 16: Admin fraud overview

**Files:**
- Create: `apps/api/src/modules/admin/overview.ts`; Modify: `routes/admin.ts`
- Test: `apps/api/test/integration/adminOverview.test.ts`

**Interfaces (Produces):**
```ts
export async function getFraudOverview(db, now): Promise<{ stats: { total; fraud; legit; pending; highRisk; mediumRisk; lowRisk; avgScore; maxScore; minScore; highPct; mediumPct; lowPct }; daily: { date: string; total; fraud; legit }[]; /* 7 entries, oldest first, Dar dates, zero-filled */ byType: { type; total; fraud }[]; byHour: { hour: number; total; fraud }[]; /* 24 entries */ topSuspects: { id; fullName; email; fraudCount; totalAmount }[] }>;
// GET /api/admin/fraud-overview
```

- [ ] **Step 1: Write failing tests**: empty DB → all zeros, `highPct` 0 (no NaN), `daily.length` 7, `byHour.length` 24; with fixtures (rows on 3 of the last 7 days, hours 2 and 14) → correct buckets, `topSuspects` ordered by fraudCount desc limit 10.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(api): fraud overview analytics`.

---

### Task 17: Web scaffold: themes, router, API client, UI primitives

**Files:**
- Create: `apps/web/src/styles/index.css`, `src/app/{router.tsx,providers.tsx,guards.tsx}`, `src/api/{client.ts,auth.ts,me.ts,admin.ts}`, `src/lib/{format.ts,useClock.ts}`, `src/components/ui/*.tsx`, `src/components/layout/{SidebarShell,TopHeader}.tsx`, `src/main.tsx`, `vite.config.ts` (proxy `/api` → `http://localhost:4000`), `vitest.config.ts` (jsdom)
- Test: `apps/web/src/lib/format.test.ts`, `src/components/ui/Pagination.test.tsx`

**Interfaces (Produces):**
```ts
// api/client.ts
export class ApiError extends Error { status: number; code: string; fields?: Record<string,string> }
export async function api<T>(path: string, init?: { method?: 'GET'|'POST'|'DELETE'; body?: unknown; query?: Record<string, string|number|undefined> }): Promise<T>; // credentials 'include', JSON + X-Requested-With: fetch, throws ApiError
// api/auth.ts: useMe(), useLogin(), useLogout(), register(), adminSignup(), forgotStart(), forgotVerify(), checkResetToken(), resetPassword(), useSecurityQuestions()
// api/me.ts: useDashboard(), useVerifyPassword(), useUserTransactions(q), useUnlockTransactions(), useLockTransactions(), useSendContext(receiverId?), useTransfer(), useWithdrawContext(), useWithdraw()
// api/admin.ts: hooks for every /api/admin endpoint (names: useAdminCounters, useAdminDashboard, useAdminUsers, useAdminUser, useCreateUser, useUserAction, useRejectUser, useDeleteUser, useAddBalance, useUserAdjustments, usePendingUsers, useAdminTransactions, useAdminTransaction, useMarkReviewed, useFraudAlerts, useBalanceAdjustments, useAdmins, useFraudOverview); mutations invalidate ['admin'] queries
// lib/format.ts
export function formatTsh(n: number): string; export function formatDate(iso: string, style: 'date'|'minute'|'second'|'long'): string; // Dar es Salaam
export function riskColor(score: number): string; // >70 '#ef4444', >40 '#f59e0b', else '#10b981'
export function maskCard(card: string): string;   // '****' + last 4
// lib/useClock.ts: export function useClock(): string  // 'Wednesday, October 29, 2026 at 03:00:00 PM (EAT)' updated each second
// guards.tsx: <RequireUser/>, <RequireAdmin/>, <RedirectIfAuthed/> (outlet-based; redirect user→/app/dashboard, admin→/admin/dashboard, guest→/login)
// components/ui: Button({variant:'primary'|'success'|'danger'|'secondary'|'ghost'}), Input, Select, Textarea (react-hook-form compatible, show error text), Modal({open,onClose,title}), ConfirmDialog({open,title,body,confirmText,danger,onConfirm,onCancel}), Alert({kind:'success'|'error'|'info'|'warning'|'blocked', children}), Badge({tone}), Table (thead/tbody helpers), Pagination({page,totalPages,onChange}) windowed, StatCard({label,value,sub,icon,tone}), RiskBar({score}), Spinner
// layout: SidebarShell({brand, subtitle, items: {to,label,icon,badge?: {count, tone}}[], footer}) with ≤768px hamburger; TopHeader({title, subtitle, name, hint})
```
Theme tokens in `index.css` (`@theme`): Sentinel `--color-s-bg #0E1525`, `--color-s-panel #16203A`, `--color-s-panel2 #121A30`, `--color-s-line #25324F`, `--color-s-text #E8ECF4`, `--color-s-dim #8C97B3`, `--color-s-amber #F2A93B`, `--color-s-teal #3FD8B0`, `--color-s-red #E5484D`; Panel `--color-p-bg #f9fafb`, `--color-p-primary #2563eb`, `--color-p-primary-dark #1e40af`, `--color-p-success #10b981`, `--color-p-danger #ef4444`, `--color-p-warning #f59e0b`, `--color-p-dark #1f2937`, `--color-p-darker #111827`, `--color-p-text #374151`, `--color-p-muted #6b7280`, `--color-p-border #e5e7eb`; fonts `--font-display 'Space Grotesk'`, `--font-body 'IBM Plex Sans'`, `--font-mono 'IBM Plex Mono'` loaded from Google Fonts in `index.html`.

- [ ] **Step 1: Write failing tests**: `formatTsh(1234.5)` → `'TSh 1,234.50'`; `maskCard('1234567812345678')` → `'****5678'`; `riskColor(71)` red, `(41)` amber, `(40)` green; Pagination with page 5 of 20 renders buttons `1 … 3 4 5 6 7 … 20`, Previous and Next, and calls `onChange(6)` on Next.
- [ ] **Step 2: Run** `pnpm --filter @fraud/web test` → FAIL. **Step 3: Implement** scaffold with router containing placeholder pages for every route in spec §10 (each renders its title) so navigation compiles. **Step 4: Run tests → PASS; `pnpm typecheck` → PASS; `pnpm --filter @fraud/web build` → PASS.**
- [ ] **Step 5: Commit** `feat(web): scaffold, themes, api client, ui primitives`.

---

### Task 18: Public and auth pages

**Files:**
- Create: `apps/web/src/features/auth/pages/{Landing,Login,Register,AdminSignup,ForgotPassword,ResetPassword}.tsx`, `features/auth/components/{PasswordStrength,SecurityQuestionsFields}.tsx`
- Test: `apps/web/src/features/auth/pages/Login.test.tsx`

**Behaviour to implement (from spec §7/§10 and the PHP survey):**
- Landing: Sentinel hero "Sentinel — Fraud Detection System", nav (How it works, Capabilities, Create account, Sign in), three pillars, pipeline section, CTA band, decorative ticker adding a row every 1.9 s (max 9; 14 % Flagged risk 68–98 %, 24 % Scanning, else Cleared risk 2–22 %; TSh amounts; paused under `prefers-reduced-motion`).
- Login: role toggle (user/admin) changes label/placeholder and clears the field; errors from API; on 423 show the lock message, disable the form, countdown from `minutesRemaining*60` seconds then re-enable; on success navigate by kind. Links to forgot/register.
- Register: fields per `registerSchema` (card number auto-grouped in fours while typing, maxlength 23), password strength meter (points: len≥6, len≥8, lower, upper, digit, one of `$@#&!`; ≤2 Weak red, ≤4 Medium amber, else Strong teal), live match indicator, security questions with "N/3 answered" counter, confirm dialog, success state hides form and links to sign in.
- AdminSignup: fetches `/admin-signup/status`; "First Time Setup" banner when `firstAdmin`; secret key field otherwise; requirement checklist for the password rule.
- ForgotPassword: step 1 email → step 2 questions (answers required) → navigate to `/reset-password/:token`.
- ResetPassword: validates token on load, shows "expires in X minutes and Y seconds" countdown, form with strength meter, success state with sign-in link; invalid/expired state with "Request new reset" button.

- [ ] **Step 1: Write failing test** `Login.test.tsx` (mock `api`): toggling to Admin changes the label to "Username or Email"; submitting with API rejecting 401 `{ fields: { attemptsRemaining: '2' } }` shows the message text; API rejecting 423 disables the submit button with text "🔒 Account Locked - Please wait".
- [ ] **Step 2–4:** FAIL → implement all six pages → PASS; `pnpm typecheck`.
- [ ] **Step 5: Commit** `feat(web): landing and auth pages`.

---

### Task 19: User layout, dashboard, transactions

**Files:**
- Create: `apps/web/src/features/user/UserLayout.tsx`, `pages/{Dashboard,Transactions}.tsx`, `components/{TransactionDetailsModal,UnlockOverlay}.tsx`
- Test: `apps/web/src/features/user/pages/Dashboard.test.tsx`

**Behaviour:** layout = SidebarShell (brand "🛡️ FraudDetect / Customer Portal", items Dashboard/Send Money/Withdraw/Transactions/Logout) + TopHeader with clock. Dashboard: security alert when `fraud.fraud > 0` linking to `/app/transactions?fraud=fraud`; balance card masked `••••••••••••••••` 🔒 with hint "Click the balance amount to reveal"; clicking opens password modal → `useVerifyPassword` → on success refetch dashboard and show `TSh …` 🔓 "👁️ Visible"; clicking again hides (local state); stat cards (total, successful, aborted, pending, success rate); fraud card when `analyzed > 0` ("⚠️ Suspicious Activity"/"✅ Safe", avg %, "Highest: x%"); quick actions; recent table. Transactions: filters (search, status, fraud) in URL search params, page size 15, windowed pagination, "Clear" link; locked state renders `UnlockOverlay` (password form, note about 5 minutes); Lock button with confirm; rows with icons (🏧 Withdrawal / 💰 Deposit / 💸 Sent to / 💰 Received from), score only when > 0, View opens `TransactionDetailsModal` (fraud section when score > 0, colours by `riskColor`, "⚠️ This transaction was flagged as high risk" when > 70, message when present).

- [ ] **Step 1: Write failing test**: with mocked dashboard `{ balance: null, ... }` the masked string is shown; after clicking and submitting the modal with a resolved verify and refetched `{ balance: 1234.5 }`, `TSh 1,234.50` is shown.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(web): user dashboard and transactions`.

---

### Task 20: Send money and withdraw pages

**Files:**
- Create: `apps/web/src/features/user/pages/{Send,Withdraw}.tsx`, `components/BlockedPanel.tsx`
- Test: `apps/web/src/features/user/pages/Send.test.tsx`

**Behaviour:** Send: form (receiver select "Name - email", location select defaulting to context, amount, message, Reset); large-volume warning banner when `largeVolume.count >= 2 && !blocked`; client pre-checks mirroring PHP (`validateSendForm`) using context numbers but via ConfirmDialog instead of `window.confirm`; final confirm "You are about to send TSh X to the selected recipient. Continue?"; submit `useTransfer`; on `outcome:'blocked'` render `BlockedPanel` (title "🚫 TRANSACTION BLOCKED", reason text, "📞 If you believe this is a mistake, please contact our support team.") in place of the form; on success show green Alert with message and, if `flaggedForReview`, the line "⚠️ This transaction was flagged for review. Please monitor your account."; show `locationWarning` in a red "🚨 Location Change Detected" box; refetch context after any result. Withdraw: info box (min 1,000; funds deducted immediately; keep receipts); if context `blocked` show blocked panel and no form; confirm text uses "You have N previous failed attempts…" when `failedAttempts >= 2`; `outcome:'failed'` shows the insufficient-balance error plus "Failed attempts: n/3" and, when `blocked`, the blocked panel after refetch.

- [ ] **Step 1: Write failing test** `Send.test.tsx`: with mocked context and a transfer mutation resolving `{ outcome:'blocked', reason:'…', riskScore:85, riskLevel:'HIGH' }`, after filling the form and confirming, the text "TRANSACTION BLOCKED" is shown and the form is gone.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(web): send money and withdraw`.

---

### Task 21: Admin layout, dashboard, users, create user, approvals, add balance

**Files:**
- Create: `apps/web/src/features/admin/AdminLayout.tsx`, `pages/{Dashboard,Users,CreateUser,Approvals,AddBalance}.tsx`, `components/{UserViewModal,ReasonModal}.tsx`
- Test: `apps/web/src/features/admin/pages/Users.test.tsx`

**Behaviour:** layout brand "🛡️ FraudDetect / Admin Control Panel", footer "Fraud Detection System v2.0 / 🤖 AI-Powered Fraud Detection", the 11 items with badges from `useAdminCounters` (refetchInterval 30 s), High Risk and AI Review Queue items only when counters > 0, links `transactions?riskLevel=HIGH` and `transactions?fraud=pending`. Dashboard: 8 stat cards (two conditional), recent alerts section (only if any, "View All Alerts →"), recent transactions (10), recent users (10). Users: search + 20/page, columns per PHP, status badge logic (inactive / pending / active), row actions with ConfirmDialog (approve/disapprove/activate/deactivate/delete) + "💰 Add Balance" link + "👁️ View" modal with same conditional actions; flash Alert after mutations with the PHP messages. CreateUser: form per `createUserSchema` with strength meter, card grouping, questions counter, "Activate account immediately" checkbox default checked (state respected on submit), confirm "Create this user account with N security questions answered?", success message from API, form reset. Approvals: pending table, Approve modal (optional reason), Reject modal (required reason, warning), View modal, empty state "✅ No pending approvals / All users have been reviewed". AddBalance: user card, form (amount with hint "Min: TSh 1 | Max: TSh 10,000,000 per transaction", type select with emoji labels, reason ≥10 chars), live preview (customer, current, amount, new balance), confirm, success message "✅ Successfully added TSh X to {name}'s account!", recent adjustments table (10), "← Back to Users".

- [ ] **Step 1: Write failing test** `Users.test.tsx`: mocked list with one pending user shows "⏳ Pending" and an Approve button; clicking Approve and confirming calls the action hook with `('approve')` and shows "✅ User approved successfully!".
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(web): admin layout, dashboard, user management`.

---

### Task 22: Admin transactions, details, fraud alerts, adjustments log, fraud overview

**Files:**
- Create: `apps/web/src/features/admin/pages/{Transactions,TransactionDetails,FraudAlerts,BalanceAdjustments,FraudOverview}.tsx`, `components/TransactionsTable.tsx`
- Test: `apps/web/src/features/admin/pages/FraudAlerts.test.tsx`

**Behaviour:** Transactions: filters (search, status, type, risk level, fraud) in URL, "Clear Filters", table with score bar (or "N/A" when 0), risk badge (PENDING when empty), "System" for null parties, View link. Details: sections (Transaction Information, Party Information side by side with contact + balance when user exists, Fraud Detection Analysis when score > 0 with risk meter ticks 0/30/70/100, model version, prediction time or "N/A", key features from `featureData` with "N/A" fallbacks; else "✅ No Fraud Analysis Available"), buttons Back and "View All Fraud Alerts" when score > 70. FraudAlerts: heading "Fraud Alerts (N)", filters (search, risk level, date range, reviewed toggle default unreviewed), rows class by risk, score colour red > 70 else amber, "Mark Reviewed" with confirm → `useMarkReviewed` → refetch; empty state "✅ No Fraud Alerts / All transactions appear legitimate". BalanceAdjustments: 5 KPI cards + type badges from `summary`, filters (search, type, admin select from `useAdmins`, dates auto-submit), table with Admin "name @username" or "System", CSV export of the visible page (commas → `;`, file `balance-adjustments-{ISO}.csv`), Print button, empty state. FraudOverview: summary row, risk cards with "x.x% of total", pending card, score range, three Recharts charts (daily line with filled areas: Total blue `#2563eb`, Fraud red `#ef4444`, Legit green `#10b981`; type grouped bars; hour grouped bars labelled "h:00"), top suspects table with "View User" → `/admin/users?search={name}`, quick actions.

- [ ] **Step 1: Write failing test** `FraudAlerts.test.tsx`: mocked page with one alert renders its id and a "Mark Reviewed" button; confirming calls the mutation with the row id.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(web): admin monitoring pages`.

---

### Task 23: README, scripts, end-to-end verification

**Files:**
- Modify: `README.md` (setup: Postgres URL, `pnpm install`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm ml`, `pnpm dev`; seeded credentials; test commands; folder map), root `package.json` scripts
- Create: `apps/web/public/favicon.svg`

- [ ] **Step 1: Full test run.** `pnpm typecheck && pnpm lint && pnpm test` → all pass; paste the summary counts into the commit message.
- [ ] **Step 2: Boot everything.** `pnpm db:migrate && pnpm db:seed`; start `pnpm ml` and `pnpm dev`; `curl http://localhost:4000/api/health` → `ml.available: true`.
- [ ] **Step 3: Browser walkthrough** (Claude in Chrome or manual): register → pending login message → admin approves → user login → reveal balance → send 100,000 → success banner; send to 4 different seeded users → 4th blocked panel; withdraw 2,000,000 over balance three times → blocked; admin: users list, add balance, transactions search by name, transaction details with features, fraud alerts mark reviewed, balance adjustments CSV, fraud overview charts render. Fix anything found; add a regression test for each fix.
- [ ] **Step 4: Commit** `docs: README and verification`.
- [ ] **Step 5: Whole-branch review** with `superpowers:requesting-code-review` against the spec; fix findings; commit.
