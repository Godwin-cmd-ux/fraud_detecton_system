# Rewrite verification — 2026-10-30

Tasks 18 and 22 are implemented and integrated with the router. Claude completed Tasks 19–21. Setup documentation includes actual seed credentials, virtual environment setup, database requirements, startup commands, and checks.

## Automated checks

- `pnpm.cmd typecheck`: passed for shared, API, and web packages.
- `pnpm.cmd lint`: passed. Local virtual environment and scratch tooling are excluded.
- `pnpm.cmd test`: passed **167 tests across 29 files** (shared 11, API 128, web 28).
- `pnpm.cmd build`: passed. Vite reports a nonblocking large JavaScript bundle warning.
- `git diff --check`: passed.

The initial broad run exposed an admin-adjustment timestamp bug after local midnight. Transactions now use the operation's injected clock; an integration assertion pins the stored timestamp. Frontend regression tests cover review confirmation/refetch and CSV escaping/formula handling. An initial pagination timeout under concurrent load did not recur in the separate frontend run or final combined run.

## Running-system checks

PostgreSQL migration and demo seed succeeded. API on port 4000, frontend on port 5173, and Python scoring on port 5000 were started. `/api/health` returned `status: ok`, `db: true`, and `ml.available: true`. A real prediction returned `LEGIT`, score 3, model version 1.0.0. A browser transfer using the real model succeeded with score 5; its prediction timestamp and model version were present in admin transaction details.

Headless Microsoft Edge walkthrough passed:

- Landing, registration, pending-login denial, admin approval, user login, balance reveal.
- Admin balance credit and CSV download of the visible adjustment page.
- Three transfers to distinct recipients succeeded; the fourth was blocked and the form disappeared. A new walkthrough sender supplied the extra account needed beyond the four seeded users.
- Three insufficient withdrawals incremented the failure counter and blocked further withdrawals.
- Admin transaction search, transaction details and features, fraud-alert review.
- Overview charts with a nonzero daily series at desktop/mobile widths. Screenshots were inspected; the mobile page had no document overflow.
- Security-question password recovery, password reset, login after reset, transaction-history unlock, details modal, and relock.
- No browser page runtime errors were observed.

Ignored local evidence is under `.superpowers/browser/`: walkthrough scripts, screenshots, and `results.json`. Walkthrough data remains in the development database; integration tests use the separate test database. The first browser run stopped on an ambiguous test locator after successfully blocking the fourth transfer; the locator was corrected and remaining checks passed in a resumed run.

## Review and integration

Reviewed monitoring pages against Task 22, checked hook/query contracts and route imports, inspected mobile/desktop charts, and reviewed the timestamp fix and regression assertion. Root scripts and favicon were already present.

After the user's instruction to finish the rewrite and delete PHP, the full test suite was rerun: 167 tests passed across 29 files, with typecheck, lint, and build passing. The running health endpoint reported database and ML availability. No active application referenced `legacy/php`. The verified legacy directory was then removed: 32 PHP files, one obsolete launcher, and one legacy stylesheet. README and current service comments were updated; historical design/plan notes remain as an audit trail. The original implementation remains in Git history. No changes were pushed.

After removal, the build passed again, no PHP source files remained, the frontend returned HTTP 200, and the health endpoint still reported database and ML availability. Implementation and cleanup are committed on `feat/typescript-rewrite`.

The Python model loaded and predicted successfully, but its serialized artifacts emit version-compatibility warnings with the installed libraries, including the scaler trained under scikit-learn 1.5.0. This walkthrough establishes local functionality, not numerical equivalence across library versions or production deployment readiness.
