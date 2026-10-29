# Fraud Detection System

Mobile-money wallet demo (Tanzanian shillings) with rule-based and ML fraud detection.

- `apps/web` — React + TypeScript frontend (Vite)
- `apps/api` — Node.js + TypeScript API (Express, Drizzle ORM, PostgreSQL)
- `packages/shared` — zod schemas, types and fraud constants shared by both
- `services/fraud-api` — Python Flask + XGBoost scoring service
- `models/` — trained model artifacts

The original PHP application was removed after the TypeScript rewrite passed automated checks and browser verification. Earlier versions remain available in Git history. See [verification results](docs/rewrite-verification.md).

## Local setup

Run commands from the repository root. Install Node.js 22 or newer, pnpm 10.34.5 (the version in `package.json`), PostgreSQL, and Python with pip. PostgreSQL must be running and accessible to the configured database user.

1. Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell).
2. Set `DATABASE_URL` and `DATABASE_URL_TEST` to your local PostgreSQL credentials. Use separate databases: the integration tests truncate the test database. Replace `SESSION_SECRET` with a long random value and set `ADMIN_SETUP_KEY` for additional administrator registration.
3. Install dependencies and initialize the application database:

   ```sh
   pnpm install
   python -m venv .venv
   ```

   Activate the virtual environment with `.venv\Scripts\Activate.ps1` in PowerShell, or `source .venv/bin/activate` on macOS/Linux, then run:

   ```sh
   python -m pip install -r services/fraud-api/requirements.txt
   pnpm db:migrate
   pnpm db:seed
   ```

The migration command creates the database if absent; the PostgreSQL user needs database creation privileges for that step. The seed inserts demo accounts without overwriting existing accounts.

Start the scoring service in one terminal and the API/frontend in another:

Activate the virtual environment in the scoring terminal so `pnpm ml` uses the installed Python dependencies. On Windows you can also run `.venv\Scripts\python.exe services/fraud-api/app.py` directly.

```sh
pnpm ml
```

```sh
pnpm dev
```

Open <http://localhost:5173>. Vite proxies `/api` to the Node API on port 4000. The Python service runs on port 5000 and loads the artifacts in `models/`. Check <http://localhost:4000/api/health>: `db` and `ml.available` should both be `true`. If ML is unavailable, the API uses its rule-based fallback; inspect the Python terminal for model loading errors.

On Windows, use `pnpm.cmd` if PowerShell blocks the `pnpm.ps1` shim. If you change the API port, update the proxy target in `apps/web/vite.config.ts` too.

## Demo accounts

Choose the Admin role on the login page for the administrator account.

| Role | Login | Password | Initial balance (TSh) |
| --- | --- | --- | --- |
| Admin | `admin` or `admin@example.com` | `Admin@123` | — |
| User | `amina@example.com` | `User@123` | 5,000,000 |
| User | `juma@example.com` | `User@123` | 2,500,000 |
| User | `neema@example.com` | `User@123` | 12,000,000 |
| User | `baraka@example.com` | `User@123` | 800,000 |

Demo users are active and approved. Their first three security-question answers are all `test`. Newly registered users require administrator approval before login. These credentials and balances are for local demonstration.

## Verification

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

API integration tests require PostgreSQL and use `DATABASE_URL_TEST`; they create and migrate that database automatically, then clear its application tables between tests. They mock ML, so the Python service is not required for the test suite. Run only frontend tests with `pnpm --filter @fraud/web test`, or API unit tests with `pnpm --filter @fraud/api test unit`.

For a running-system check, sign in as a demo user, reveal the balance with the account password, send money to another demo user, and inspect transaction history. Sign in as admin to approve registrations, adjust balances, and inspect transactions and fraud alerts. The implementation plan and full walkthrough are in `docs/superpowers/plans/2026-10-29-typescript-rewrite.md`; passing automated checks alone does not establish completion of that walkthrough.
