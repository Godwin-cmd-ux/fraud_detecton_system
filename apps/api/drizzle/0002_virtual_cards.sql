ALTER TABLE "transactions" ADD COLUMN "tx_lat" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "tx_lng" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "card_expiry" varchar(5);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "card_cvc" varchar(3);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_lat" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_lng" numeric(9, 6);--> statement-breakpoint

-- Backfill: every pre-existing account gets a virtual card number starting with 44, plus an
-- expiry and a CVC. Numbers are derived from the immutable id, so the update is deterministic,
-- collision-free against the unique constraint, and safe to re-run on rows that already comply.
UPDATE "users"
SET "card_number" = '44' || lpad("id"::text, 14, '0')
WHERE "card_number" !~ '^44[0-9]{14}$';--> statement-breakpoint
UPDATE "users"
SET "card_expiry" = coalesce("card_expiry", to_char(now() + interval '3 years', 'MM/YY'))
WHERE "card_expiry" IS NULL;--> statement-breakpoint
UPDATE "users"
SET "card_cvc" = coalesce("card_cvc", lpad((("id" * 37) % 1000)::text, 3, '0'))
WHERE "card_cvc" IS NULL;
