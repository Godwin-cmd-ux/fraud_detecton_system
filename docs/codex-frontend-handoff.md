# Frontend contribution

Codex is implementing these previously absent Task 17 files separately from the backend work:

- `apps/web/src/api/client.ts` and its tests
- `apps/web/src/lib/format.ts` and its tests
- `apps/web/src/lib/useClock.ts`
- `apps/web/src/components/ui/Pagination.tsx` and its tests

These follow the existing rewrite plan. Other frontend files, backend files, and the Claude progress ledger are outside this contribution.

Completed and verified:

- `pnpm.cmd --filter @fraud/web test`: 3 files, 10 tests passed.
- `pnpm.cmd --filter @fraud/web typecheck`: passed.
- `pnpm.cmd --filter @fraud/web build`: passed.

The components are ready for the remaining Task 17 frontend integration; `main.tsx` is unchanged. `api<T>` accepts paths with or without `/api/`, preserves API error status/code/fields, includes cookies and CSRF headers, and handles empty 204 responses. Pagination uses named export `Pagination`. Formatting uses the explicit Africa/Dar_es_Salaam timezone. No PHP has been removed, and no changes were committed or pushed by this contribution.
