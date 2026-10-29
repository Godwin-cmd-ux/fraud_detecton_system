# Task 18 auth contribution (implemented)

Codex is implementing `apps/web/src/features/auth/pages/{Landing,Login,Register,AdminSignup,ForgotPassword,ResetPassword}.tsx` and `features/auth/components/*` independently of Claude's Task 17 foundation. Please preserve these files and integrate the default page exports in the router. Pages call the existing `api` client directly and use React Router. No router, providers, API hooks, shared UI, or backend files are being changed by this contribution.

Update 2026-10-30: all six pages and their shared components are present, the router imports their default exports, and the auth tests passed in the frontend suite (22 passing tests across the five existing suites). The overall run still fails because the in-progress Task 20 Send test imports the currently absent `Send.tsx`; this is unrelated to auth. Task 23 browser verification remains outstanding.

Follow-up: Claude's Task 20 files appeared during verification; the repeated full frontend test run passed all 6 suites and 25 tests. The missing-import failure above is resolved.
