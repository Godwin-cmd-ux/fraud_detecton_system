# English and Kiswahili

The Language / Lugha selector is available on the landing page, every auth form, and above signed-in customer/admin pages. English is the default. The selected language is stored under `fraud-detect.language` in browser local storage, restored on reload, and synchronized across tabs. When storage is blocked, switching still works for the current tab.

The interface updates without remounting forms. Field values, selected recipients, passwords, security answers, and customer-entered notes are preserved. Document language/title, accessible labels, navigation, forms, native constraint feedback, dialogs, table headings, status/risk labels, system notifications, chart legends/type labels, CSV headings, and date formatting follow the selected language. Names, locations, IDs, and API enum/query values retain their original values. Dates keep the Africa/Dar_es_Salaam timezone.

## Implementation

- `apps/web/src/i18n/index.ts`: language store, React subscription, document metadata, and translation lookup.
- `sw.ts`: interface text and seeded security questions.
- `messages.ts`: dynamic UI messages, validation messages, and known API responses. Numbered placeholders preserve names and amounts.
- `LanguageSwitcher.tsx`: shared accessible selector.
- `validation.ts`: native form constraint messages in the selected language.

English source text is the catalog key. Components subscribe with `useLanguage()` and translate display text with `translate` (aliased as `tr`). Translation happens during rendering; API paths, mutation payloads, enum values, database records, and private customer input are not translated. Unknown messages remain in English. No translation service or additional package is required.

## Verification

Six regression tests cover signup data/answer preservation, translation without refetching questions, unchanged API filter values, preservation of dynamic values, cross-tab synchronization, unavailable storage, and native validation feedback. The existing frontend tests remain unchanged and pass: **34 tests across 10 files**.

Headless Edge checks passed landing language selection; signup navigation, reload persistence and native required-field feedback; localized login errors; customer dashboard and Swahili date formatting; transfer form preservation and localized confirmation; transaction-history unlock/details; admin dashboard, users, create-user, transaction monitoring, adjustment log, and fraud overview; mobile overflow checks; and switching/reloading back to English. No browser page errors were observed. Desktop/mobile and signup screenshots were inspected; chart type labels were localized after the visual review.

Ignored local evidence: `.superpowers/browser/language-check.mjs`, `language-results.json`, and `swahili-*.png` screenshots. Typecheck, lint, and production build pass.

Final workspace test run: **173 tests across 30 files passed** (shared 11, API 128, frontend 34). `git diff --check` also passed.
