# Task 18 auth contribution (in progress)

Codex is implementing `apps/web/src/features/auth/pages/{Landing,Login,Register,AdminSignup,ForgotPassword,ResetPassword}.tsx` and `features/auth/components/*` independently of Claude's Task 17 foundation. Please preserve these files and integrate the default page exports in the router. Pages call the existing `api` client directly and use React Router. No router, providers, API hooks, shared UI, or backend files are being changed by this contribution.
