# Merging `database_export.sql` into your database

`database_export.sql` is a `pg_dump --clean` file: running it directly would **drop every table**
first. `merge_export.sql` takes only its data and merges it on top of what you already have.

## Run it

```bash
database/merge_export/run.sh postgres://postgres:password@localhost:5432/fraud_detection
```

`run.sh` backs the database up with `pg_dump` first, then runs the merge. Without the script:

```bash
pg_dump -Fc -f backup.dump "$DATABASE_URL"
psql -v ON_ERROR_STOP=1 -d "$DATABASE_URL" -f database/merge_export/merge_export.sql
```

Use `psql` (the file contains `COPY … FROM stdin` data blocks; pgAdmin's query tool cannot run
them). It works on PostgreSQL 12 and newer.

## What it does

All of it runs in one transaction; if any step or final check fails, nothing is changed.

| Step | |
| --- | --- |
| Schema | Brings the database up to drizzle `0003` with additive, `IF NOT EXISTS` statements only. Older databases gain the USSD, virtual-card, location and fee columns. |
| Merge | Users are matched by email, then phone; admins by username, then email; transactions by `transaction_id`; USSD requests by `(session_id, text_hash)`; logs by their full content. **Your existing rows always win**: balances, passwords, PINs and cards are never overwritten. |
| Remap | Imported ids are kept when free and renumbered when taken. Every reference follows the new id: transaction senders, receivers and reviewers, admin actions, login logs, withdrawal counters and USSD actors. |
| Cards | Every user without a valid card gets one: 16 digits, prefix `44`, valid Luhn check digit, expiry three years out, 3-digit CVC. If one of your users lacks a card and the export has a card for the same person, that card is used instead. Expired or malformed expiries and CVCs are renewed. |
| Defaults | New columns (`fee`, `pin_attempts`, …) are filled in; expired PIN lockouts are cleared. |
| Sequences | Each id sequence moves past the highest id, so new rows never collide. |
| Drizzle | Migrations `0000`–`0003` are recorded as applied, so `pnpm db:migrate` skips them. |
| Checks | Aborts if any row count went down, any exported user, admin, transaction, security question or USSD row is missing, or any user still lacks a complete card. |

Running it again changes nothing.

Web sessions are only carried over while they are still valid and their account kept the same
id; otherwise a cookie could sign someone in as another person.

## Afterwards

```sql
SELECT * FROM data_migration.merge_log ORDER BY id;   -- every decision, per run
SELECT * FROM data_migration.user_map;                 -- export user id → your user id
SELECT * FROM data_migration.admin_map;
```

Rows matched to an existing account are listed in the log with any differences (for example a
different balance in the export), so you can review them.

## Rebuilding and testing

`merge_export.sql` is generated. To change it, edit `merge_template.sql` (or replace
`database_export.sql`) and run:

```bash
python3 database/merge_export/build.py
PGHOST=localhost PGUSER=postgres PGPASSWORD=… database/merge_export/test/run.sh
```

The test creates scratch databases (`merge_t_*`) and checks four cases: an empty database; an
older-schema database with its own users whose ids, emails, phones, cards and transaction ids
collide with the export; a second run, which must change nothing; and a run that fails partway,
which must leave the database exactly as it was.
