# Fraud Detection System

Mobile-money wallet demo (Tanzanian shillings) with rule-based and ML fraud detection.

- `apps/web` — React + TypeScript frontend (Vite)
- `apps/api` — Node.js + TypeScript API (Express, Drizzle ORM, PostgreSQL)
- `packages/shared` — zod schemas, types and fraud constants shared by both
- `services/fraud-api` — Python Flask + XGBoost scoring service
- `models/` — trained model artifacts
- `legacy/php` — the original PHP implementation, kept for reference

Setup instructions are completed at the end of the rewrite (see `docs/superpowers/plans`).
