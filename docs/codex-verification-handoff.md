# Task 23 documentation contribution

Codex expanded `README.md` with local setup, environment configuration, PostgreSQL requirements, Python dependencies, service startup, health checks, actual seeded credentials and balances, test commands, and the integration test database isolation requirement. Commands and credentials were checked against repository source. Root scripts already cover the requested commands, and `apps/web/public/favicon.svg` already exists and is linked from `index.html`, so neither needed changes.

Scope: README and handoff documentation only. Task 20 implementation files and the Claude progress ledger were left untouched. No commits or pushes were made.

Verification on 2026-10-30:

- `pnpm.cmd --filter @fraud/web test`: 5 suites passed, 22 tests passed; 1 suite failed during import because `apps/web/src/features/user/pages/Send.tsx` is absent in the Task 20 work in progress.
- Auth pages exist, have router imports, and their test suite passed. The auth handoff status was updated accordingly.
- A subsequent run after Claude's Send/Withdraw files appeared passed: **6 suites, 25 tests**. The initial missing-import failure is resolved in the current tree.

Still required before marking Task 23 complete: finish Tasks 20–22, rerun full typecheck/lint/tests/build, boot services and check `db` and `ml.available`, perform the plan's browser walkthrough, and complete whole-branch review. This contribution does not certify those checks. In particular, the planned four-distinct-recipients scenario needs an extra approved recipient: the seed provides four users total, so one sender has only three seeded recipients.
