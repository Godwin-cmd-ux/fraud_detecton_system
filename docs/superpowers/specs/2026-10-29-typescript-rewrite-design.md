# Design: Rewrite of the Fraud Detection System in TypeScript (React + Node.js + PostgreSQL)

Date: 2026-10-29
Status: draft, awaiting approval
Source system: the PHP 8 / MySQL application in this repository (reverse-engineered on 2026-10-29; there is no SQL schema file, the schema below was recovered from the PHP queries).

## 1. Intent

Replace the PHP/MySQL implementation of the "FraudDetect / Sentinel" mobile-money fraud detection demo with the same product built on:

- **Frontend:** React 19 + TypeScript (Vite), single-page app.
- **Backend:** Node.js 22 + TypeScript HTTP API.
- **Database:** PostgreSQL 18 (already installed and running on this machine).
- **ML scoring service:** the existing Python Flask + XGBoost service is kept and called over HTTP exactly as the PHP did. It is not part of the PHP code and is not rewritten.

The product is a customer wallet with peer-to-peer transfers and withdrawals in Tanzanian shillings (TSh), protected by rule-based fraud patterns plus an ML risk score, with an admin control panel to approve users, adjust balances, monitor transactions, and review fraud alerts.

**Why:** the owner asked for the stack change. Beyond the language swap, the rewrite is the chance to fix the bugs found in the PHP that make the current system unreliable (listed in §9) without changing what the product does.

## 2. Goals, non-goals, anti-goals

**Goals**
1. Feature parity with every PHP page and action (user side, admin side, auth, password reset).
2. Identical fraud behaviour: same patterns, thresholds, time windows, scores, messages, and what gets recorded. The automated scenarios in `check.php` must still pass against the new system (ported as integration tests).
3. Type safety end to end: shared request/response types between API and UI, validated at the API boundary.
4. Runs locally with three commands: start Postgres (already a service), `pnpm dev`, and start the Python ML service.
5. Automated tests for the fraud rules and the critical money paths.

**Non-goals**
- No new product features (no fees, no notifications, no KYC, no multi-currency).
- No redesign of what pages exist or what they show. The look may be modernised but every element the PHP pages show must still be there.
- No retraining or changes to the ML model, and no port of the Python service to Node.
- No data migration tooling. There is no MySQL server on this machine and no production data; the new system starts from a seed script.
- No deployment/infra work (Docker, CI, hosting) in this project.

**Anti-goals (would make this a failure even if it "works")**
- Money paths that are not atomic: a transfer must debit, credit, and record in one database transaction, and must never let a balance go negative.
- Fraud rules that silently differ from the PHP (a threshold off by one, a window off by a minute). Where the PHP's text and its code disagree, §6 says which one wins.
- Fraud detection that depends on the browser doing the right thing (the PHP counted failed withdrawals from client-side JavaScript).
- A blocked transaction that is not recorded. Every block writes an ABORTED transaction row, as the PHP does.

## 3. Constraints

- Windows 11 development machine. Node 22.20, pnpm 10, Python 3.13, PostgreSQL 18.3 (service `postgresql-x64-18`, superuser `postgres`, local auth works). No Docker, no MySQL.
- All timestamps stored as `timestamptz`. All "hour of day" rules use the **Africa/Dar_es_Salaam** timezone explicitly (the PHP used the server default on most pages, which was a bug).
- Money is `numeric(15,2)`. Balance changes happen in SQL (`balance = balance - $1 ... WHERE balance >= $1`), never read-modify-write in JS.
- The ML service listens on `http://localhost:5000` and may be down. The system must degrade exactly as the PHP did: score 0, prediction LEGIT, risk LOW, transaction proceeds (rules still apply).
- Browser targets: current Chrome/Edge/Firefox. Mobile layouts must work at 768px and below, as the PHP's did.

## 4. Repository layout (decided)

The repository root stays `fraud_detecton_system/` (existing git repo). It becomes a pnpm workspace:

```
fraud_detecton_system/
  package.json              pnpm workspace root, scripts: dev, build, test, lint, db:migrate, db:seed
  pnpm-workspace.yaml
  tsconfig.base.json
  .env.example
  apps/
    api/                    Node.js + TypeScript API (Express 5)
      src/
        config/             env parsing (zod)
        db/                 Drizzle schema, migrations, client
        modules/
          auth/             login, lockout, register, admin signup, password reset
          users/
          transactions/
          fraud/            rule engine (pure functions), velocity queries, ML client
          admin/
        http/               app factory, middleware (session, csrf, error handler), routes
        index.ts
      test/                 vitest: unit (fraud rules) + integration (supertest against a test DB)
      drizzle.config.ts
    web/                    React + TypeScript (Vite)
      src/
        api/                typed fetch client, TanStack Query hooks
        app/                router, providers, guards
        features/           auth/, user/, admin/ (pages + components)
        components/ui/      shared UI primitives
        styles/             Tailwind config, theme tokens
  packages/
    shared/                 zod schemas + inferred TS types for every API request/response, enums, constants (thresholds, locations)
  services/
    fraud-api/              the existing Python Flask service (app.py, requirements.txt); only MODEL_DIR is changed to point at ../../models
  models/                   existing trained model artifacts, unchanged
  train.py                  existing, unchanged (paths updated if needed)
  legacy/php/               the current PHP code, moved here for reference during the port
  docs/superpowers/specs/   this document
```

**My calls on tooling (change if you disagree):**
- **Express 5** for the API. It is the most widely known Node framework and the app is a straightforward JSON API. Validation with **zod** on every route; error handler converts zod errors to 400 with field messages.
- **Drizzle ORM** with `node-postgres`. The schema lives in TypeScript, migrations are generated by `drizzle-kit`, and raw SQL is natural for the many aggregate/velocity queries the app needs.
- **Sessions in cookies**, not JWT: `express-session` backed by Postgres (`connect-pg-simple`), `httpOnly`, `SameSite=Lax`. The PHP app is session-shaped (lockouts, unlock-transactions timer, reset flow state) and this keeps those flows simple. CSRF protection: the API only accepts state-changing requests with `Content-Type: application/json` and a custom `X-Requested-With: fetch` header, which cross-site forms cannot send.
- **Passwords:** bcrypt (`bcryptjs`), cost 10, compatible with PHP `password_hash` output if anyone ever imports data.
- **Frontend:** Vite, React Router 7, TanStack Query 5, Tailwind CSS 4, react-hook-form + zod resolvers reusing the shared schemas, **Recharts** for the three Fraud Overview charts, `lucide-react` icons in place of the emoji glyphs (emoji may still be used in badges where the PHP used them as part of the text).
- **Tests:** Vitest in both apps, Supertest for API integration tests, Testing Library for a small number of UI tests. Integration tests run against a dedicated database `fraud_detection_test` that the test setup creates and migrates.
- **Lint/format:** ESLint (typescript-eslint) + Prettier, one config at the root.
- **Dev experience:** `pnpm dev` runs API (port 4000) and web (port 5173, Vite proxy `/api` → 4000) concurrently. ML service started separately with the existing `start_fraud_api.bat` (updated path).

## 5. Data model (PostgreSQL)

Enums:
- `transaction_type`: `transfer | withdrawal | deposit | bonus | refund | adjustment`
- `transaction_status`: `SUCCESS | ABORTED | PENDING`
- `fraud_prediction`: `FRAUD | LEGIT | PENDING`
- `risk_level`: `LOW | MEDIUM | HIGH`
- `admin_action_type`: `add_balance | approve_user | disapprove_user | activate_user | deactivate_user | delete_user | reject_user | create_user | mark_reviewed`

Tables (columns beyond the PHP's are marked **new**):

**users**: `id` serial PK; `full_name` varchar(100) not null; `email` varchar(100) unique not null; `phone` varchar(20) unique not null; `card_number` varchar(20) unique not null; `password_hash` varchar(255); `balance` numeric(15,2) not null default 0 check (balance >= 0); `security_answers` jsonb (object `{question_key: bcryptHash}`); `is_approved` bool default false; `is_active` bool default true; `reset_token` varchar(64) null; `reset_token_expiry` timestamptz null; `last_known_location` varchar(100) null; `location_updated_at` timestamptz null; `created_at`, `updated_at` timestamptz default now().

**admins**: `id`; `username` varchar(50) unique; `email` varchar(100) unique; `password_hash`; `full_name` varchar(100); `is_active` bool default true; `last_login` timestamptz null; `created_at`.

**transactions**: `id` serial PK; `transaction_id` varchar(50) unique (format `TXN` + `YYYYMMDDHHmmss` + 4 random digits, retry on collision); `sender_id` int null FK users **on delete set null**; `receiver_id` int null FK users on delete set null; `sender_name`, `receiver_name` varchar(100) null (denormalised, as the PHP); `amount` numeric(15,2); `transaction_type`; `status`; `message` text null; `fraud_score` numeric(5,2) default 0; `fraud_prediction` null; `risk_level` null; `prediction_time` timestamptz null; `model_version` varchar(20) null; `feature_data` jsonb null (the feature vector sent to the ML service plus the context counters; replaces the PHP's `logs/ai_transactions.log` file, and the admin details page already reads it); `transaction_location` varchar(100) null; `ip_address` varchar(45) null; `user_agent` text null; `admin_id` int null FK admins (set for admin balance adjustments, which the PHP forgot); **new** `reviewed_at` timestamptz null, **new** `reviewed_by` int null FK admins (replaces the PHP's habit of overwriting `status` with `REVIEWED`, which destroyed the real status); `created_at` timestamptz default now().
Indexes: `(sender_id, created_at)`, `(receiver_id, created_at)`, `(status)`, `(fraud_prediction, fraud_score)`, `(risk_level)`, `(transaction_type)`, `(created_at)`.

**admin_actions**: `id`; `admin_id` FK admins; `admin_name`; `action_type`; `user_id` int null (no FK, so delete_user audit survives); `user_name` null; `amount` numeric(15,2) null; `reason` text null; `details` text null; `ip_address` null; `created_at`.

**login_attempts**: as the PHP's CREATE TABLE: `id`, `user_id` null, `email` (the login string typed, may be phone/card/username), `ip_address`, `attempt_count` default 1, `lockout_until` timestamptz null, `created_at`, `updated_at`. Index on `(email, ip_address)` and `lockout_until`.

**failed_login_log**: `id`, `email`, `ip_address`, `user_id` null, `attempted_at`.

**failed_withdrawal_attempts**: `user_id` int PK FK users on delete cascade; `attempt_count` int default 0; `last_attempt_time` timestamptz null.

**security_questions**: `id`; `question_key` varchar(50) unique; `question_text` varchar(255); `is_active` bool default true. Seeded with 6 questions (mother's maiden name, first school, city of birth, first pet, favourite teacher, childhood nickname). Builder may choose the exact wording.

**sessions**: created by `connect-pg-simple` (`sid`, `sess` jsonb, `expire`).

Dropped from the PHP: `receiver_activity`, `receiver_interval_counts` (only read by a throwaway test file), the `ai_transactions.log` file, and the "create tables on every request" behaviour (migrations replace it).

Seed script (`pnpm db:seed`): one admin (`admin` / `Admin@123`, printed on seed), the security questions, and 4 approved demo users with balances (printed on seed). Seeding is idempotent.

## 6. Fraud engine (the heart of the port)

All rules live in `apps/api/src/modules/fraud/` as pure functions over a `FraudContext` so they can be unit-tested without a database. The velocity counters are computed by a repository against Postgres with `now() - interval`. **Counters include ABORTED rows, as the PHP's did** (a blocked attempt counts toward the next limit).

Constants (exported from `packages/shared` so the UI can show the same numbers):

| Name | Value |
|---|---|
| LARGE_TX_THRESHOLD | 1,000,000 TSh |
| LARGE_VOLUME_MAX_COUNT / MAX_SUM / WINDOW | 3 / 10,000,000 / 5 min |
| MANY_RECEIVERS_WINDOW | 5 min |
| MANY_SENDERS_WINDOW | 7 min |
| FAILED_WITHDRAWALS_WINDOW | 10 min |
| LOCATION_WINDOW | 5 min |
| MIN_WITHDRAWAL | 1,000 TSh |
| MAX_ADMIN_ADJUSTMENT | 10,000,000 TSh |
| LOGIN_MAX_FAILURES / LOCKOUT | 3 / 5 min |
| FAILED_WITHDRAWAL_BLOCK_COUNT / RESET_AFTER | 3 / 24 h |
| RESET_TOKEN_TTL | 5 min |
| TRANSACTIONS_UNLOCK_TTL | 5 min |

Locations: the fixed list of 10 Tanzanian cities with the PHP's coordinates; haversine distance in km.

Location score (unchanged): if the sender's most recent sent transaction with a location in the last 5 min has a different location: +10, plus 50 if distance > 500 km, 30 if > 200 km, 15 if > 50 km.

### 6.1 Transfer pipeline (`POST /api/me/transfers`), in order, first block wins

Inputs: `receiverId`, `amount`, `location`, `message?`.

1. **Pattern 1, large volume.** `isLarge = amount > 1,000,000`. `newCount = largeCount5m + (isLarge ? 1 : 0)`, `newSum = largeSum5m + (isLarge ? amount : 0)`. Block if `newCount >= 3 && newSum > 10,000,000`. Record ABORTED, score 85, FRAUD, HIGH, message `BLOCKED: Large transaction volume - {newCount} large transactions totaling TSh {newSum} in 5 minutes (max: 3, 10M) | {msg}`. (Note the PHP side effect is preserved: once a user already has 3 large transactions over 10M in the window, even a small transfer is blocked.)
2. **Pattern 2, many receivers.** `newCount = uniqueReceivers5m + (receiver already sent to in window ? 0 : 1)`. Block if `newCount >= 4`. ABORTED, score 90, FRAUD, HIGH, message `BLOCKED: User has {unique} unique receivers in 5 minutes. Attempting to send to {newCount} (max: 4) | {msg}`.
   **OPEN (owner's decision, see §14):** the PHP code blocks the 4th distinct receiver although its text says "max 4". Nothing in `check.php` pins either reading (it only asserts on helper counters). Default if no answer: preserve the code's behaviour (3 distinct receivers allowed, 4th blocked) and correct the user-facing text to "Maximum allowed: 3 recipients per 5 minutes".
3. **Pattern 3, many senders.** `newCount = uniqueSendersToReceiver7m + (this sender already sent to receiver in window ? 0 : 1)`. Block if `newCount >= 3`. ABORTED, score 90, FRAUD, HIGH, message `BLOCKED: Receiver has {unique} unique senders in 7 minutes. Attempting to receive from {newCount} (max: 3) | {msg}`. Same open question: default is behaviour preserved (2 distinct senders allowed, 3rd blocked) with text corrected to "Maximum allowed: 2 senders per 7 minutes".
4. **Location check.** Compute `locationChanged` info (for the warning banner) and `locationScore`.
5. **Validation** (returns 400 with all messages, writes nothing): receiver required; not self; amount > 0; amount <= balance ("Insufficient balance. Your balance is TSh X"); receiver exists, active and approved.
6. **ML score.** Build the 11 features (`amount`, `transaction_count_last_5min`, `amount_last_5min`, `unique_receivers_last_5min`, `unique_senders_last_5min` (distinct senders *to this user*), `failed_withdrawals_last_10min` (ABORTED withdrawals by this user), `transaction_hour` (Dar es Salaam), `avg_user_amount` (avg of user's SUCCESS sent transactions), `amount_deviation = avg == 0 ? 0 : (amount - avg) / (avg + 1)`, `account_age_days`, `balance`). `GET /health` (3 s) then `POST /predict` (5 s). On any failure: score 0, LEGIT, LOW, model_version `1.0.0`, prediction_time null. The ML score never blocks on its own.
7. **Rule overrides** (each sets FRAUD / HIGH / block; score = max(score, value); if several fire the last reason wins, as in PHP):
   - failed withdrawals (10 min) >= 3 → 85, "Multiple failed withdrawal attempts detected"
   - hour < 6 and amount > 1,000,000 → 80, "Abnormal transaction at unusual hour with large amount"
   - locationScore > 30 and amount > 500,000 → 75, "Suspicious location change with large transaction"
   - amount > 10,000,000 → 90, "Transaction amount exceeds security threshold"
   Then if locationScore > 0: score = min(score + locationScore, 100).
8. **Commit** in one DB transaction:
   - Blocked: insert ABORTED transfer row with score/prediction/level/prediction_time/model_version/feature_data, message `BLOCKED: {reason} | {msg}`. Respond 200 with `{ outcome: 'blocked', reason, riskScore, riskLevel }`.
   - Allowed: `UPDATE users SET balance = balance - $amt WHERE id = $sender AND balance >= $amt` (0 rows → rollback, 409 "Failed to deduct balance"); credit receiver; update sender's last_known_location; insert SUCCESS row; respond `{ outcome: 'success', transaction, newBalance, flaggedForReview: score > 40 && score <= 70, locationWarning? }`.
   All responses also carry `locationWarning` text when the location changed.

### 6.2 Withdrawal pipeline (`POST /api/me/withdrawals`)

Inputs: `amount`, `location`, `message?`. Before anything, rows in `failed_withdrawal_attempts` older than 24 h are reset (done in the request path, as the PHP, by a single `UPDATE` guarded by `last_attempt_time < now() - 24h`).

1. **Lockout.** If `failed_withdrawal_attempts.attempt_count >= 3`: insert ABORTED withdrawal, score 95, FRAUD, HIGH, message `BLOCKED: User has {n} consecutive failed withdrawal attempts | {msg}`; respond `{ outcome: 'blocked', ... }`.
2. **Location score** as above (no warning text on withdrawals, as PHP).
3. **Validation:** amount > 0; amount >= 1,000 ("Minimum withdrawal amount is TSh 1,000"); **insufficient balance is handled server-side (fix of PHP bug, my call):** if amount > balance → increment `failed_withdrawal_attempts` (upsert), insert ABORTED withdrawal with score `50 + failedCount*10` (capped 100; **the ML service is not called for failed attempts**), prediction PENDING, risk MEDIUM, message `FAILED: Insufficient balance (Attempt {n}) | {msg}`, and respond `{ outcome: 'failed', failedAttempts: n, blocked: n >= 3, message: 'Insufficient balance. Please try a lower amount.' }`. The PHP's client-side `increment_failed` AJAX call is removed; the UI no longer pre-checks balance in a way that would hide this from the server (it may still warn).
   **Behaviour change to be aware of:** in the running PHP this branch was dead code (validation errors skipped it), so no ABORTED row was ever written for an insufficient-balance attempt. Writing it means three such attempts within 10 minutes now also trip the transfer rule "Multiple failed withdrawal attempts detected" (§6.1 step 7) and feed the ML feature `failed_withdrawals_last_10min`. This is what the PHP author evidently intended (`check.php` test 4 inserts exactly these rows) and is listed in §9.
4. **ML score** with the same features (unique receivers counter is the sender's distinct receivers in 5 min).
5. **Rules** (FRAUD / HIGH / block; max-score semantics; last reason wins):
   - txCount5m >= 3 and amountSum5m > 10,000,000 → 85, "Multiple large transactions detected in short period"
   - hour < 6 and amount > 1,000,000 → 85, "Abnormal withdrawal at unusual hour with large amount"
   - locationScore > 30 and amount > 500,000 → 80, "Suspicious location change with large withdrawal"
   - amount / balance > 0.9 and amount > 1,000,000 → 80, "Attempting to withdraw more than 90% of balance"
   - amount > 10,000,000 → 90, "Withdrawal amount exceeds security threshold"
   Then add locationScore, cap 100.
6. **Commit:** blocked → ABORTED row, `BLOCKED: {reason} | {msg}`. Allowed → reset failed attempts to 0, conditional debit (0 rows → rollback), update location, insert SUCCESS row. Withdrawal rows have `sender_id = user`, `receiver_id = null`, `transaction_type = 'withdrawal'`.

### 6.3 Admin balance adjustment (`POST /api/admin/users/:id/balance`)

Inputs: `amount` (0 < amount <= 10,000,000), `type` in deposit/bonus/refund/adjustment, `reason` (min 10 chars, enforced server-side now). One DB transaction: credit balance, insert SUCCESS transaction with `sender_id = null`, `receiver_id = user`, `admin_id = admin` (fix), `fraud_score = 0`, message `Admin adjustment: {reason}`; insert `admin_actions` row `add_balance` with amount and reason.

## 7. Authentication and account flows

- **Login** `POST /api/auth/login { role: 'user'|'admin', login, password }`. Lockout check first: locked if any `login_attempts` row for this login string **or** this IP has `lockout_until > now()`; respond 423 with `{ lockedUntil, minutesRemaining }`. Admin: match `username = login OR email = login` and `is_active`. User: match `email | phone | card_number = login` and `is_active`; if password OK but `is_approved = false` → 403 "Your account is pending admin approval. Please wait for confirmation." (not counted as a failure). Wrong password / unknown login → record failure (increment per (login, ip), lock for 5 min at >= 3, append to `failed_login_log`), respond 401 with `{ attemptsRemaining: 3 - count }` or 423 if this failure locked. **Fix (my call):** when a failure arrives after a previous lockout has expired, the counter restarts at 1 (fresh window of 3). The PHP kept incrementing the old count, so a single wrong password after a lockout expired locked the account again for 5 minutes; only a successful login ever reset it. Success → reset attempts for (login, ip), regenerate session, store `{ kind: 'admin'|'user', id, name }`, for admins set `last_login`. Response: the session principal.
- **Session principal** `GET /api/auth/me` → `{ kind, id, name, email }` or 401. Separate middleware `requireUser`, `requireAdmin`.
- **Logout** `POST /api/auth/logout` destroys the session and clears the cookie (the PHP left the cookie).
- **Register** `POST /api/auth/register`: full_name >= 3 chars; valid email; phone matches `^\+?[0-9]{10,15}$` after stripping spaces; password >= 6; confirm matches; card_number 16–20 digits after stripping spaces; answers to at least 3 active security questions (each hashed with bcrypt after trim; **no HTML-escaping before storage**, output is escaped by React); uniqueness of email, phone, card → 409 "Email, phone number, or card number already exists". Creates user with `is_approved = false`, balance 0.
- **Admin signup** `POST /api/auth/admin-signup`: allowed without a key only while `admins` is empty; afterwards requires `secretKey` equal to env `ADMIN_SETUP_KEY` (**fix:** no longer hard-coded; `.env.example` ships `AdminSetupTZ` to keep the demo behaviour). Username `^[A-Za-z0-9_]{3,}$`; password >= 8 with upper, lower, digit, special; unique username and email.
- **Forgot password** (three steps, state in session):
  1. `POST /api/auth/forgot-password/start { email }` → checks in PHP order (not found / deactivated / pending approval / fewer than 3 answered active questions) each with its own message; on success stores `resetUserId` in session and returns the user's answered active questions `[ { key, text } ]`.
  2. `POST /api/auth/forgot-password/verify { answers: { [key]: string } }` → needs session state; at least 3 answers; each bcrypt-compared (case-sensitive); if >= 3 correct, generate 64-hex token, store on user with expiry now + 5 min, return `{ token, expiresAt }`. Else 400 "Incorrect answers. Please try again. ({n}/3 correct)". **Add (my call):** verify attempts count toward the same login lockout table keyed by the email, so answers cannot be brute-forced (the PHP had no limit).
  3. `POST /api/auth/reset-password { token, password, confirmPassword }` → token must exist and not be expired (messages as PHP); sets password, clears token. Token comes **only** from the request (the PHP's session fallback is removed). `GET /api/auth/reset-password/:token` returns `{ valid, expiresAt, userName }` so the page can show the countdown.
- **Password re-verification** `POST /api/me/verify-password { password }` uses the session user only (fix: the PHP trusted a posted `user_id`). Rate limited: 5 per minute per session.
- **Transactions unlock** `POST /api/me/transactions/unlock { password }` sets `transactionsUnlockedUntil = now + 5 min` in the session; `POST /api/me/transactions/lock` clears it; `GET /api/me/transactions` returns `locked: true` and no rows while locked (the PHP returned the rows blurred behind an overlay; the data was still in the page, which defeated the point).

## 8. API surface (all JSON under `/api`, errors as `{ error: { code, message, fields? } }`)

Public: `GET /health` (API + DB + ML service status), `GET /security-questions` (active).
Auth: as §7.
User (`requireUser`):
- `GET /me/dashboard` → balance (returned only when the session flag `balanceRevealed` was set by a successful verify-password in the last 5 min; otherwise `null`), stats (total/success/aborted/pending), fraud stats (analysed, fraud, legit, avgScore, maxScore), recent 5 transactions.
- `GET /me/transactions?search&status&fraud=fraud|legit|pending&page` (15 per page) and the lock/unlock endpoints.
- `GET /me/send/context?receiverId?` → recipients list (active+approved others), locations, default location, large-volume stats, receiver stats, sender stats for the chosen receiver, current balance.
- `POST /me/transfers`.
- `GET /me/withdraw/context` → locations, default location, failed attempt count, blocked flag, balance.
- `POST /me/withdrawals`.
- `POST /me/verify-password`.
Admin (`requireAdmin`):
- `GET /admin/counters` → the six sidebar badges (**decision:** "AI Review Queue" is defined once as `fraud_prediction = 'PENDING' AND fraud_score > 0`, used by both sidebar and dashboard; the sidebar item links to `transactions?fraud=pending`. The PHP sidebar used `status = 'PENDING'`, which no code path ever writes, so that badge was permanently zero. `transaction_status.PENDING` is kept in the enum for filter parity but nothing writes it).
- `GET /admin/dashboard` → KPIs (total users, total tx, success, aborted, money moved, **fraud detected = fraud_prediction = 'FRAUD'** (fix of the PHP card that counted every analysed row), high risk, review queue), recent fraud alerts (5), recent transactions (10), recent users (10).
- `GET /admin/users?search&page` (20), `GET /admin/users/:id`, `POST /admin/users`, `POST /admin/users/:id/{approve|disapprove|activate|deactivate}` (server checks the current state and rejects no-op transitions with 409), `POST /admin/users/:id/reject { reason }` (hard delete only if still pending, as PHP), `DELETE /admin/users/:id`, `POST /admin/users/:id/balance`, `GET /admin/users/:id/adjustments` (last 10). Every action writes `admin_actions` with the same `action_type`, reason and details strings as the PHP.
- `GET /admin/pending-users`.
- `GET /admin/balance-adjustments?search&type&adminId&dateFrom&dateTo&page` plus `summary` (totals, by type) and `GET /admin/admins` (active, for the filter).
- `GET /admin/transactions?search&status&type&riskLevel&fraud&page` (search joins sender/receiver names in both list and count queries: fix), `GET /admin/transactions/:id` (with sender/receiver contact + current balances, and `feature_data`).
- `GET /admin/fraud-alerts?search&riskLevel&dateFrom&dateTo&reviewed=all|unreviewed|reviewed&page` (base filter `fraud_prediction = 'FRAUD' AND fraud_score > 50`; default `unreviewed`), `POST /admin/transactions/:id/review` (sets `reviewed_at/by`, writes `admin_actions` `mark_reviewed`; 404 if not a FRAUD row, 409 if already reviewed).
- `GET /admin/fraud-overview` → stats, 7-day daily series (**zero-filled for missing days**), by-type series, by-hour series (0–23 zero-filled), top 10 suspects. Percentages are 0 when there are no transactions (fix of divide-by-zero).

## 9. PHP bugs fixed on purpose (behaviour changes the owner should know about)

1. Count queries on transactions/fraud-alerts search no longer crash.
2. Admin balance adjustments now record `admin_id`, so the Admin column, admin filter and "Unique Admins" work.
3. Dashboard "Fraud Detected" counts FRAUD predictions only; AI Review Queue is defined once.
4. Marking an alert reviewed no longer overwrites the transaction status; alerts default to showing unreviewed ones, with a toggle. Review is audited.
5. Failed withdrawal attempts are counted by the server, not by browser JavaScript.
6. Password re-verification uses the session user, not a posted id.
7. CSRF protection on every state-changing request; HTML escaping happens on output, not on storage.
8. Admin setup key moves to an environment variable.
9. Hour-of-day rules always evaluate in Africa/Dar_es_Salaam.
10. Balance on the user dashboard is not sent to the browser until the password check succeeds.
11. Pattern 2 and 3 messages say the real limits (3 recipients, 2 senders) while the blocking behaviour stays exactly as it was.
12. Deleting a user keeps their transaction history (FK set null) instead of relying on cascade behaviour that was never defined.
13. Insufficient-balance withdrawal attempts are recorded as ABORTED withdrawal rows (prediction PENDING, score 50 + 10 per attempt). In the PHP that code was unreachable, so these attempts left no transaction row and never fed the "multiple failed withdrawals" transfer rule or the ML feature. Now they do.
14. After a login lockout expires the failure counter restarts; the PHP re-locked on the very next wrong password.
15. The AI Review Queue counts `fraud_prediction = 'PENDING'` rows (the ones that exist) instead of `status = 'PENDING'` rows (which never exist).

Everything not listed here is a faithful port.

## 10. Frontend

Routes (React Router):
- Public: `/` landing (Sentinel hero, pillars, pipeline, decorative ticker), `/login` (role toggle, lockout countdown), `/register`, `/admin-signup`, `/forgot-password` (two steps), `/reset-password/:token`.
- User (`/app/...`, guarded): `dashboard`, `send`, `withdraw`, `transactions`. Sidebar: Dashboard, Send Money, Withdraw, Transactions, Logout. Header with avatar initial, name and live EAT clock.
- Admin (`/admin/...`, guarded): `dashboard`, `users`, `users/new`, `approvals`, `users/:id/balance`, `balance-adjustments`, `transactions`, `transactions/:id`, `fraud-alerts`, `fraud-overview`. Sidebar with the same 11 items and badge counters (refetched every 30 s and after mutations), the two conditional items (High Risk, AI Review Queue) only when their counters are > 0.

Behaviour to preserve on the user side: blocked-transaction panel replaces the form; success banner with optional "flagged for review" line; location-change banner; large-volume warning banner when `largeCount >= 2`; confirm dialogs before sending/withdrawing (use an in-app modal, not `window.confirm`); masked balance with password modal; transactions page locked overlay with unlock form and auto-lock after 5 min; details modal with risk colours (> 70 red, > 40 amber, else green).

Behaviour to preserve on the admin side: all tables, columns, filters, windowed pagination, badges (status, risk level with PENDING when empty, score bars), user view modal with the conditional action buttons, approve/reject modals with reason, add-balance live preview, CSV export of the current balance-adjustments page, print, the three charts, top suspects, quick actions.

Visual: two themes as in the PHP. Public/auth pages use the dark "Sentinel" palette (bg `#0E1525`, panel `#16203A`, text `#E8ECF4`, dim `#8C97B3`, amber `#F2A93B`, teal `#3FD8B0`, red `#E5484D`, fonts Space Grotesk / IBM Plex Sans / IBM Plex Mono). The user and admin panels use the light dashboard theme (page `#f9fafb`, white cards, primary `#2563eb`, success `#10b981`, danger `#ef4444`, warning `#f59e0b`, 280px dark sidebar `#111827→#1f2937`, system font stack), collapsing to a hamburger at 768px. Both are Tailwind theme tokens. Currency always rendered as `TSh 1,234.56`.

## 11. Testing

- Unit (vitest, no DB): every rule in §6 with boundary values (e.g. 3rd vs 4th receiver, 1,000,000 vs 1,000,000.01, hour 5 vs 6, location score 30 vs 31 with amount 500,000 vs 500,001), location score table, feature builder, transaction-id format, login lockout arithmetic.
- Integration (vitest + supertest, test DB): the `check.php` scenarios ported one-to-one (Pattern 1 large volume, Pattern 2 many receivers, Pattern 3 many senders, failed withdrawal lockout, abnormal hour, location change, extreme amount), plus: transfer atomicity (insufficient balance leaves both balances unchanged), concurrent transfers cannot overdraw, login lockout after 3 failures and release after 5 min (clock injected), register → pending → admin approve → login, forgot/verify/reset flow and token expiry, admin actions write audit rows, ML service down degrades gracefully (ML client mocked), ML service up stores its score and feature_data.
- UI: smoke tests for login role toggle, send-money blocked panel, admin users table actions (mocked API).
- `pnpm test` runs everything; integration tests skip with a clear message if Postgres is unreachable.

## 12. Cutover

1. Build the new system alongside the PHP (PHP moved to `legacy/php/` in the first commit so the root can become the workspace).
2. When all tests pass and a manual walkthrough of every page is done, the owner decides whether to delete `legacy/php/` (git history keeps it). This document does not delete it.

## 13. Left to the builder

- Exact folder/file names inside the modules, component breakdown, Tailwind token names.
- Wording of the six seeded security questions and the demo users.
- Pagination component implementation (must be windowed: first, …, ±2, …, last, prev/next).
- How the dev script starts the Python service (a `pnpm ml` script that shells out to python is enough).
- Logging library (pino is fine) and request-id middleware.
- Whether the landing-page ticker keeps the PHP's `$` amounts or switches to TSh (switch to TSh; it is decorative).

## 14. Open questions for the owner

1. **Pattern 2 / Pattern 3 limits.** The PHP code allows 3 distinct recipients per 5 minutes (blocks the 4th) and 2 distinct senders per 7 minutes (blocks the 3rd), but its own messages and comments say "max 4" and "max 3". Which should the new system enforce: the code's numbers (3 / 2) or the text's numbers (4 / 3)? Default if unanswered: the code's numbers, with the text corrected.

Decisions made without an answer are marked "my call" above and summarised in §9.
