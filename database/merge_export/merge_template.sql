-- =================================================================================================
--  Sentinel — merge database_export.sql into an existing database
-- =================================================================================================
--
--  What this does, in order, inside ONE transaction (any failure rolls everything back):
--
--    1. Brings the schema up to the level the application expects (drizzle 0000 → 0003), using
--       only additive, idempotent statements: missing types, enum values, tables, columns,
--       constraints and indexes are created; nothing that exists is dropped or rewritten.
--    2. Loads every row of database_export.sql into a private staging schema (_export_stage).
--       The dump itself is never executed: it was taken with --clean and would DROP every table.
--    3. Merges the staged rows into public, matching on natural keys so nothing is duplicated:
--         users ............ email, then phone          admins ............ username, then email
--         transactions ..... transaction_id             security_questions  question_key
--         ussd_requests .... (session_id, text_hash)    ussd_sessions ..... id
--         sessions ......... sid                         logs .............. full row content
--       Rows that already exist in your database always win — your data is never overwritten.
--       Imported ids are kept when free and remapped when taken; every foreign key that points at
--       a remapped id (transactions, admin actions, login logs, USSD actors…) follows the remap.
--    4. Upgrades every account (old and imported) to the current feature set:
--         * a virtual card — 16 digits, prefix 44, valid Luhn check digit — for every user whose
--           card number is missing or not in that format,
--         * a card expiry (MM/YY, three years out) where missing, malformed or already expired,
--         * a 3-digit CVC where missing or malformed,
--         * PIN counters, transaction fees and other new columns defaulted.
--    5. Repairs every serial sequence so new rows never collide with imported ids.
--    6. Records drizzle migrations 0000–0003 as applied, so `pnpm db:migrate` will not try to
--       re-create what is now in place.
--    7. Verifies the result and aborts (rolling back) if anything is missing.
--
--  Every decision is written to data_migration.merge_log; the export → database id mapping is kept
--  in data_migration.user_map / data_migration.admin_map.
--
--  Safe to run more than once: a second run finds every row already present and changes nothing.
--
--  Run with psql (the file contains COPY … FROM stdin blocks):
--      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f merge_export.sql
-- =================================================================================================

\set ON_ERROR_STOP on
SET client_min_messages = warning;
SET statement_timeout = 0;
SET lock_timeout = 0;
SET standard_conforming_strings = on;
SET client_encoding = 'UTF8';
SET search_path = public;

-- -------------------------------------------------------------------------------------------------
--  0. Enum types and values.  ALTER TYPE … ADD VALUE cannot be used by the transaction that adds
--     it, so this runs (idempotently and additively) before the main transaction begins.
-- -------------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regtype('public.admin_action_type') IS NULL THEN
    CREATE TYPE public.admin_action_type AS ENUM ('add_balance', 'approve_user', 'disapprove_user',
      'activate_user', 'deactivate_user', 'delete_user', 'reject_user', 'create_user', 'mark_reviewed');
  END IF;
  IF to_regtype('public.fraud_prediction') IS NULL THEN
    CREATE TYPE public.fraud_prediction AS ENUM ('FRAUD', 'LEGIT', 'PENDING');
  END IF;
  IF to_regtype('public.risk_level') IS NULL THEN
    CREATE TYPE public.risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH');
  END IF;
  IF to_regtype('public.transaction_status') IS NULL THEN
    CREATE TYPE public.transaction_status AS ENUM ('SUCCESS', 'ABORTED', 'PENDING');
  END IF;
  IF to_regtype('public.transaction_type') IS NULL THEN
    CREATE TYPE public.transaction_type AS ENUM ('transfer', 'withdrawal', 'deposit', 'bonus',
      'refund', 'adjustment');
  END IF;
END $$;

ALTER TYPE public.admin_action_type ADD VALUE IF NOT EXISTS 'add_balance';
ALTER TYPE public.admin_action_type ADD VALUE IF NOT EXISTS 'approve_user';
ALTER TYPE public.admin_action_type ADD VALUE IF NOT EXISTS 'disapprove_user';
ALTER TYPE public.admin_action_type ADD VALUE IF NOT EXISTS 'activate_user';
ALTER TYPE public.admin_action_type ADD VALUE IF NOT EXISTS 'deactivate_user';
ALTER TYPE public.admin_action_type ADD VALUE IF NOT EXISTS 'delete_user';
ALTER TYPE public.admin_action_type ADD VALUE IF NOT EXISTS 'reject_user';
ALTER TYPE public.admin_action_type ADD VALUE IF NOT EXISTS 'create_user';
ALTER TYPE public.admin_action_type ADD VALUE IF NOT EXISTS 'mark_reviewed';
ALTER TYPE public.fraud_prediction ADD VALUE IF NOT EXISTS 'FRAUD';
ALTER TYPE public.fraud_prediction ADD VALUE IF NOT EXISTS 'LEGIT';
ALTER TYPE public.fraud_prediction ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE public.risk_level ADD VALUE IF NOT EXISTS 'LOW';
ALTER TYPE public.risk_level ADD VALUE IF NOT EXISTS 'MEDIUM';
ALTER TYPE public.risk_level ADD VALUE IF NOT EXISTS 'HIGH';
ALTER TYPE public.transaction_status ADD VALUE IF NOT EXISTS 'SUCCESS';
ALTER TYPE public.transaction_status ADD VALUE IF NOT EXISTS 'ABORTED';
ALTER TYPE public.transaction_status ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'transfer';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'withdrawal';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'deposit';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'bonus';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'refund';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'adjustment';

BEGIN;

-- Nobody else may write while rows are being matched and remapped.
DO $$ BEGIN PERFORM pg_advisory_xact_lock(hashtext('sentinel.merge_export')); END $$;

CREATE SCHEMA IF NOT EXISTS data_migration;

CREATE TABLE IF NOT EXISTS data_migration.merge_log (
  id         serial PRIMARY KEY,
  run_at     timestamptz NOT NULL DEFAULT now(),
  run_id     text        NOT NULL,
  phase      text        NOT NULL,
  entity     text        NOT NULL,
  export_key text,
  target_key text,
  action     text        NOT NULL,
  detail     text
);

-- One id per run so each run's decisions can be told apart in merge_log.
CREATE TEMP TABLE _run ON COMMIT DROP AS
  SELECT to_char(clock_timestamp(), 'YYYYMMDD"T"HH24MISS') || '-' || substr(md5(random()::text), 1, 6)
         AS id;

CREATE OR REPLACE FUNCTION data_migration.log(
  p_phase text, p_entity text, p_export_key text, p_target_key text, p_action text, p_detail text
) RETURNS void LANGUAGE sql AS $$
  INSERT INTO data_migration.merge_log (run_id, phase, entity, export_key, target_key, action, detail)
  SELECT id, p_phase, p_entity, p_export_key, p_target_key, p_action, p_detail FROM _run;
$$;

-- Adds a constraint unless one with that name already exists on the table.
CREATE OR REPLACE FUNCTION data_migration.ensure_constraint(p_table regclass, p_name text, p_ddl text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = p_table AND conname = p_name) THEN
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', p_table, p_name, p_ddl);
    PERFORM data_migration.log('schema', p_table::text, NULL, p_name, 'constraint_added', p_ddl);
  END IF;
END $$;

-- Same algorithm as apps/api/src/lib/card.ts: prefix 44, 13 random digits, Luhn check digit.
CREATE OR REPLACE FUNCTION data_migration.luhn_digit(p_partial text) RETURNS int
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  total int := 0;
  dbl boolean := true;
  d int;
BEGIN
  FOR i IN REVERSE length(p_partial)..1 LOOP
    d := substr(p_partial, i, 1)::int;
    IF dbl THEN
      d := d * 2;
      IF d > 9 THEN d := d - 9; END IF;
    END IF;
    total := total + d;
    dbl := NOT dbl;
  END LOOP;
  RETURN (10 - total % 10) % 10;
END $$;

CREATE OR REPLACE FUNCTION data_migration.is_luhn_valid(p_number text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_number ~ '^[0-9]{2,}$'
     AND data_migration.luhn_digit(left(p_number, -1)) = right(p_number, 1)::int;
$$;

CREATE OR REPLACE FUNCTION data_migration.new_card_number() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  body text;
  candidate text;
BEGIN
  LOOP
    body := '44' || lpad(floor(random() * 1e13)::bigint::text, 13, '0');
    candidate := body || data_migration.luhn_digit(body);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.users WHERE card_number = candidate);
  END LOOP;
  RETURN candidate;
END $$;

CREATE OR REPLACE FUNCTION data_migration.new_cvc() RETURNS text
LANGUAGE sql AS $$ SELECT lpad(floor(random() * 1000)::int::text, 3, '0') $$;

-- `MM/YY` three years out, the way card.ts writes it.
CREATE OR REPLACE FUNCTION data_migration.new_expiry() RETURNS text
LANGUAGE sql AS $$ SELECT to_char(now() + interval '3 years', 'MM/YY') $$;

-- A card is valid through the last day of its expiry month.
CREATE OR REPLACE FUNCTION data_migration.expiry_is_current(p_expiry text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT p_expiry ~ '^(0[1-9]|1[0-2])/[0-9]{2}$'
     AND (to_date('20' || right(p_expiry, 2) || left(p_expiry, 2) || '01', 'YYYYMMDD')
          + interval '1 month') > now();
$$;

-- -------------------------------------------------------------------------------------------------
--  1. Schema: bring every table up to drizzle 0003.  Additive only.
-- -------------------------------------------------------------------------------------------------

-- Counts before anything is touched, so retention can be proven at the end.
CREATE TEMP TABLE _before (tbl text PRIMARY KEY, n bigint) ON COMMIT DROP;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'admins', 'transactions', 'admin_actions', 'login_attempts',
    'failed_login_log', 'failed_withdrawal_attempts', 'security_questions', 'sessions',
    'ussd_sessions', 'ussd_requests', 'ussd_security_events'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('INSERT INTO _before SELECT %L, count(*) FROM public.%I', t, t);
    ELSE
      INSERT INTO _before VALUES (t, 0);
    END IF;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.users (
  id serial PRIMARY KEY,
  full_name varchar(100) NOT NULL,
  email varchar(100) NOT NULL,
  phone varchar(20) NOT NULL,
  card_number varchar(20) NOT NULL,
  password_hash varchar(255) NOT NULL,
  balance numeric(15, 2) DEFAULT '0' NOT NULL,
  security_answers jsonb,
  is_approved boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  reset_token varchar(64),
  reset_token_expiry timestamptz,
  last_known_location varchar(100),
  location_updated_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS transaction_pin_hash varchar(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pin_attempts integer DEFAULT 0 NOT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS card_expiry varchar(5);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS card_cvc varchar(3);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_lat numeric(9, 6);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_lng numeric(9, 6);

CREATE TABLE IF NOT EXISTS public.admins (
  id serial PRIMARY KEY,
  username varchar(50) NOT NULL,
  email varchar(100) NOT NULL,
  password_hash varchar(255) NOT NULL,
  full_name varchar(100) NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  last_login timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS phone varchar(20);
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS pin_hash varchar(255);
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS pin_attempts integer DEFAULT 0 NOT NULL;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz;

CREATE TABLE IF NOT EXISTS public.transactions (
  id serial PRIMARY KEY,
  transaction_id varchar(50) NOT NULL,
  sender_id integer,
  receiver_id integer,
  sender_name varchar(100),
  receiver_name varchar(100),
  amount numeric(15, 2) NOT NULL,
  transaction_type public.transaction_type NOT NULL,
  status public.transaction_status NOT NULL,
  message text,
  fraud_score numeric(5, 2) DEFAULT '0' NOT NULL,
  fraud_prediction public.fraud_prediction,
  risk_level public.risk_level,
  prediction_time timestamptz,
  model_version varchar(20),
  feature_data jsonb,
  transaction_location varchar(100),
  ip_address varchar(45),
  user_agent text,
  admin_id integer,
  reviewed_at timestamptz,
  reviewed_by integer,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS tx_lat numeric(9, 6);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS tx_lng numeric(9, 6);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS fee numeric(15, 2) DEFAULT '0' NOT NULL;

CREATE TABLE IF NOT EXISTS public.admin_actions (
  id serial PRIMARY KEY,
  admin_id integer NOT NULL,
  admin_name varchar(100) NOT NULL,
  action_type public.admin_action_type NOT NULL,
  user_id integer,
  user_name varchar(100),
  amount numeric(15, 2),
  reason text,
  details text,
  ip_address varchar(45),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id serial PRIMARY KEY,
  user_id integer,
  email varchar(100) NOT NULL,
  ip_address varchar(45) NOT NULL,
  attempt_count integer DEFAULT 1 NOT NULL,
  lockout_until timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.failed_login_log (
  id serial PRIMARY KEY,
  email varchar(100) NOT NULL,
  ip_address varchar(45) NOT NULL,
  user_id integer,
  attempted_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.failed_withdrawal_attempts (
  user_id integer PRIMARY KEY,
  attempt_count integer DEFAULT 0 NOT NULL,
  last_attempt_time timestamptz
);

CREATE TABLE IF NOT EXISTS public.security_questions (
  id serial PRIMARY KEY,
  question_key varchar(50) NOT NULL,
  question_text varchar(255) NOT NULL,
  is_active boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sessions (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ussd_sessions (
  id varchar(128) PRIMARY KEY,
  phone varchar(20) NOT NULL,
  actor_kind varchar(10),
  actor_id integer,
  state jsonb NOT NULL,
  last_text text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ussd_requests (
  id serial PRIMARY KEY,
  session_id varchar(128) NOT NULL,
  phone varchar(20) NOT NULL,
  text_hash varchar(64) NOT NULL,
  text text NOT NULL,
  response text NOT NULL,
  is_end boolean DEFAULT false NOT NULL,
  scene varchar(40),
  actor_kind varchar(10),
  actor_id integer,
  ip_address varchar(45),
  duration_ms integer,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ussd_security_events (
  id serial PRIMARY KEY,
  event_type varchar(40) NOT NULL,
  phone varchar(20),
  session_id varchar(128),
  detail text,
  ip_address varchar(45),
  created_at timestamptz DEFAULT now() NOT NULL
);

DO $$
BEGIN
PERFORM data_migration.ensure_constraint('public.users', 'users_email_unique', 'UNIQUE (email)');
PERFORM data_migration.ensure_constraint('public.users', 'users_phone_unique', 'UNIQUE (phone)');
PERFORM data_migration.ensure_constraint('public.users', 'users_card_number_unique', 'UNIQUE (card_number)');
PERFORM data_migration.ensure_constraint('public.users', 'users_balance_non_negative', 'CHECK (balance >= 0)');
PERFORM data_migration.ensure_constraint('public.admins', 'admins_username_unique', 'UNIQUE (username)');
PERFORM data_migration.ensure_constraint('public.admins', 'admins_email_unique', 'UNIQUE (email)');
PERFORM data_migration.ensure_constraint('public.security_questions', 'security_questions_question_key_unique', 'UNIQUE (question_key)');
PERFORM data_migration.ensure_constraint('public.transactions', 'transactions_transaction_id_unique', 'UNIQUE (transaction_id)');
PERFORM data_migration.ensure_constraint('public.admin_actions', 'admin_actions_admin_id_admins_id_fk',
  'FOREIGN KEY (admin_id) REFERENCES public.admins(id) ON DELETE CASCADE');
PERFORM data_migration.ensure_constraint('public.failed_withdrawal_attempts', 'failed_withdrawal_attempts_user_id_users_id_fk',
  'FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE');
PERFORM data_migration.ensure_constraint('public.transactions', 'transactions_sender_id_users_id_fk',
  'FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL');
PERFORM data_migration.ensure_constraint('public.transactions', 'transactions_receiver_id_users_id_fk',
  'FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE SET NULL');
PERFORM data_migration.ensure_constraint('public.transactions', 'transactions_admin_id_admins_id_fk',
  'FOREIGN KEY (admin_id) REFERENCES public.admins(id) ON DELETE SET NULL');
PERFORM data_migration.ensure_constraint('public.transactions', 'transactions_reviewed_by_admins_id_fk',
  'FOREIGN KEY (reviewed_by) REFERENCES public.admins(id) ON DELETE SET NULL');
END $$;

CREATE INDEX IF NOT EXISTS users_reset_token_idx ON public.users USING btree (reset_token);
CREATE INDEX IF NOT EXISTS failed_login_log_email_idx ON public.failed_login_log USING btree (email);
CREATE INDEX IF NOT EXISTS login_attempts_email_ip_idx ON public.login_attempts USING btree (email, ip_address);
CREATE INDEX IF NOT EXISTS login_attempts_lockout_idx ON public.login_attempts USING btree (lockout_until);
CREATE INDEX IF NOT EXISTS sessions_expire_idx ON public.sessions USING btree (expire);
CREATE INDEX IF NOT EXISTS transactions_sender_created_idx ON public.transactions USING btree (sender_id, created_at);
CREATE INDEX IF NOT EXISTS transactions_receiver_created_idx ON public.transactions USING btree (receiver_id, created_at);
CREATE INDEX IF NOT EXISTS transactions_status_idx ON public.transactions USING btree (status);
CREATE INDEX IF NOT EXISTS transactions_fraud_idx ON public.transactions USING btree (fraud_prediction, fraud_score);
CREATE INDEX IF NOT EXISTS transactions_risk_idx ON public.transactions USING btree (risk_level);
CREATE INDEX IF NOT EXISTS transactions_type_idx ON public.transactions USING btree (transaction_type);
CREATE INDEX IF NOT EXISTS transactions_created_idx ON public.transactions USING btree (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS ussd_requests_session_text_uq ON public.ussd_requests USING btree (session_id, text_hash);
CREATE INDEX IF NOT EXISTS ussd_requests_created_idx ON public.ussd_requests USING btree (created_at);
CREATE INDEX IF NOT EXISTS ussd_requests_phone_idx ON public.ussd_requests USING btree (phone, created_at);
CREATE INDEX IF NOT EXISTS ussd_security_events_type_idx ON public.ussd_security_events USING btree (event_type, created_at);
CREATE INDEX IF NOT EXISTS ussd_sessions_phone_idx ON public.ussd_sessions USING btree (phone);
CREATE INDEX IF NOT EXISTS ussd_sessions_expires_idx ON public.ussd_sessions USING btree (expires_at);

-- Sequences can trail their table when rows were inserted with explicit ids; put each one past
-- the highest id already present before any new row is numbered.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'admins', 'transactions', 'admin_actions', 'login_attempts',
    'failed_login_log', 'security_questions', 'ussd_requests', 'ussd_security_events'] LOOP
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(%L, ''id''), greatest(coalesce(max(id), 0), 1), max(id) IS NOT NULL) FROM public.%I',
      'public.' || t, t);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------------------------------
--  2. Staging: the export's rows, loaded verbatim into a private schema.
-- -------------------------------------------------------------------------------------------------
DROP SCHEMA IF EXISTS _export_stage CASCADE;
CREATE SCHEMA _export_stage;

CREATE TABLE _export_stage.drizzle_migrations (id int, hash text, created_at bigint);
CREATE TABLE _export_stage.admin_actions (id int, admin_id int, admin_name text, action_type text,
  user_id int, user_name text, amount numeric(15, 2), reason text, details text, ip_address text,
  created_at timestamptz);
CREATE TABLE _export_stage.admins (id int, username text, email text, password_hash text,
  full_name text, is_active boolean, last_login timestamptz, created_at timestamptz, phone text,
  pin_hash text, pin_attempts int, pin_locked_until timestamptz);
CREATE TABLE _export_stage.failed_login_log (id int, email text, ip_address text, user_id int,
  attempted_at timestamptz);
CREATE TABLE _export_stage.failed_withdrawal_attempts (user_id int, attempt_count int,
  last_attempt_time timestamptz);
CREATE TABLE _export_stage.login_attempts (id int, user_id int, email text, ip_address text,
  attempt_count int, lockout_until timestamptz, created_at timestamptz, updated_at timestamptz);
CREATE TABLE _export_stage.security_questions (id int, question_key text, question_text text,
  is_active boolean);
CREATE TABLE _export_stage.sessions (sid text, sess json, expire timestamp(6));
CREATE TABLE _export_stage.transactions (id int, transaction_id text, sender_id int,
  receiver_id int, sender_name text, receiver_name text, amount numeric(15, 2),
  transaction_type text, status text, message text, fraud_score numeric(5, 2),
  fraud_prediction text, risk_level text, prediction_time timestamptz, model_version text,
  feature_data jsonb, transaction_location text, ip_address text, user_agent text, admin_id int,
  reviewed_at timestamptz, reviewed_by int, created_at timestamptz, tx_lat numeric(9, 6),
  tx_lng numeric(9, 6), fee numeric(15, 2));
CREATE TABLE _export_stage.users (id int, full_name text, email text, phone text,
  card_number text, password_hash text, balance numeric(15, 2), security_answers jsonb,
  is_approved boolean, is_active boolean, reset_token text, reset_token_expiry timestamptz,
  last_known_location text, location_updated_at timestamptz, created_at timestamptz,
  updated_at timestamptz, transaction_pin_hash text, pin_attempts int, pin_locked_until timestamptz,
  card_expiry text, card_cvc text, last_lat numeric(9, 6), last_lng numeric(9, 6));
CREATE TABLE _export_stage.ussd_requests (id int, session_id text, phone text, text_hash text,
  text text, response text, is_end boolean, scene text, actor_kind text, actor_id int,
  ip_address text, duration_ms int, created_at timestamptz);
CREATE TABLE _export_stage.ussd_security_events (id int, event_type text, phone text,
  session_id text, detail text, ip_address text, created_at timestamptz);
CREATE TABLE _export_stage.ussd_sessions (id text, phone text, actor_kind text, actor_id int,
  state jsonb, last_text text, created_at timestamptz, updated_at timestamptz,
  expires_at timestamptz);

-- @@EXPORT_DATA@@

-- -------------------------------------------------------------------------------------------------
--  3. Merge.
-- -------------------------------------------------------------------------------------------------

-- ---- admins --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_migration.admin_map (
  export_id int PRIMARY KEY, target_id int NOT NULL, matched_by text NOT NULL
);

DO $$
DECLARE
  e record;
  hit int;
  how text;
  new_id int;
BEGIN
  -- Ids the export uses stay reserved, so a freshly numbered row never takes one of them.
  PERFORM setval(pg_get_serial_sequence('public.admins', 'id'),
    greatest((SELECT coalesce(max(id), 0) FROM public.admins),
             (SELECT coalesce(max(id), 0) FROM _export_stage.admins), 1));

  FOR e IN SELECT * FROM _export_stage.admins ORDER BY id LOOP
    hit := NULL;
    SELECT id INTO hit FROM public.admins WHERE lower(username) = lower(e.username);
    how := 'username';
    IF hit IS NULL THEN
      SELECT id INTO hit FROM public.admins WHERE lower(email) = lower(e.email);
      how := 'email';
    END IF;

    IF hit IS NOT NULL THEN
      -- Existing administrator: keep your row, only fill USSD fields it does not have yet.
      UPDATE public.admins a SET phone = e.phone, pin_hash = coalesce(a.pin_hash, e.pin_hash)
       WHERE a.id = hit AND a.phone IS NULL AND e.phone IS NOT NULL;
      INSERT INTO data_migration.admin_map VALUES (e.id, hit, how)
        ON CONFLICT (export_id) DO UPDATE SET target_id = EXCLUDED.target_id, matched_by = EXCLUDED.matched_by;
      PERFORM data_migration.log('merge', 'admins', e.id::text, hit::text, 'matched_' || how,
        e.username || ' already present; existing row kept');
      CONTINUE;
    END IF;

    new_id := CASE WHEN EXISTS (SELECT 1 FROM public.admins WHERE id = e.id) THEN
      nextval(pg_get_serial_sequence('public.admins', 'id'))::int ELSE e.id END;
    INSERT INTO public.admins (id, username, email, password_hash, full_name, is_active, last_login,
      created_at, phone, pin_hash, pin_attempts, pin_locked_until)
    VALUES (new_id, e.username, e.email, e.password_hash, e.full_name, coalesce(e.is_active, true),
      e.last_login, coalesce(e.created_at, now()), e.phone, e.pin_hash, coalesce(e.pin_attempts, 0),
      e.pin_locked_until);
    INSERT INTO data_migration.admin_map VALUES (e.id, new_id, 'inserted')
      ON CONFLICT (export_id) DO UPDATE SET target_id = EXCLUDED.target_id, matched_by = EXCLUDED.matched_by;
    PERFORM data_migration.log('merge', 'admins', e.id::text, new_id::text,
      CASE WHEN new_id = e.id THEN 'inserted' ELSE 'inserted_remapped' END, e.username);
  END LOOP;
END $$;

-- ---- users ---------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_migration.user_map (
  export_id int PRIMARY KEY, target_id int NOT NULL, matched_by text NOT NULL
);

DO $$
DECLARE
  e record;
  hit int;
  how text;
  new_id int;
  card text;
  diff text;
BEGIN
  PERFORM setval(pg_get_serial_sequence('public.users', 'id'),
    greatest((SELECT coalesce(max(id), 0) FROM public.users),
             (SELECT coalesce(max(id), 0) FROM _export_stage.users), 1));

  FOR e IN SELECT * FROM _export_stage.users ORDER BY id LOOP
    hit := NULL;
    SELECT id INTO hit FROM public.users WHERE lower(email) = lower(e.email);
    how := 'email';
    IF hit IS NULL THEN
      SELECT id INTO hit FROM public.users WHERE phone = e.phone;
      how := 'phone';
    END IF;

    IF hit IS NOT NULL THEN
      -- Same customer already in your database.  Your row wins (balance, password, PIN, card);
      -- only profile fields you never had are filled in from the export.
      SELECT string_agg(f, ', ') INTO diff FROM (
        SELECT 'balance ' || u.balance || ' kept (export had ' || e.balance || ')' AS f
          FROM public.users u WHERE u.id = hit AND u.balance IS DISTINCT FROM e.balance
        UNION ALL
        SELECT 'card ' || u.card_number || ' kept (export had ' || e.card_number || ')'
          FROM public.users u WHERE u.id = hit AND u.card_number IS DISTINCT FROM e.card_number
           AND u.card_number ~ '^44[0-9]{14}$'
      ) d;
      UPDATE public.users u SET
        security_answers    = coalesce(u.security_answers, e.security_answers),
        last_known_location = coalesce(u.last_known_location, e.last_known_location),
        location_updated_at = CASE WHEN u.last_lat IS NULL AND u.last_known_location IS NULL
                                   THEN coalesce(u.location_updated_at, e.location_updated_at)
                                   ELSE u.location_updated_at END,
        last_lat            = CASE WHEN u.last_lat IS NULL AND u.last_lng IS NULL THEN e.last_lat ELSE u.last_lat END,
        last_lng            = CASE WHEN u.last_lat IS NULL AND u.last_lng IS NULL THEN e.last_lng ELSE u.last_lng END
      WHERE u.id = hit;
      -- If your row has no usable virtual card but the export holds this customer's card, adopt
      -- it: that is the number they already know and may have given to people who pay them.
      UPDATE public.users u SET
        card_number = e.card_number, card_expiry = e.card_expiry, card_cvc = e.card_cvc,
        updated_at = now()
      WHERE u.id = hit
        AND (u.card_number IS NULL OR u.card_number !~ '^44[0-9]{14}$')
        AND e.card_number ~ '^44[0-9]{14}$'
        AND NOT EXISTS (SELECT 1 FROM public.users o WHERE o.card_number = e.card_number);
      IF FOUND THEN
        PERFORM data_migration.log('merge', 'users', e.id::text, hit::text, 'card_adopted',
          'took the exported card ' || e.card_number || ' in place of an unusable one');
      END IF;
      INSERT INTO data_migration.user_map VALUES (e.id, hit, how)
        ON CONFLICT (export_id) DO UPDATE SET target_id = EXCLUDED.target_id, matched_by = EXCLUDED.matched_by;
      PERFORM data_migration.log('merge', 'users', e.id::text, hit::text, 'matched_' || how,
        e.email || ' already present; existing row kept' || coalesce('; ' || diff, ''));
      CONTINUE;
    END IF;

    -- New customer.  Keep the export's id and card number unless your database already uses them.
    new_id := CASE WHEN EXISTS (SELECT 1 FROM public.users WHERE id = e.id) THEN
      nextval(pg_get_serial_sequence('public.users', 'id'))::int ELSE e.id END;
    card := e.card_number;
    IF card IS NULL OR EXISTS (SELECT 1 FROM public.users WHERE card_number = card) THEN
      card := data_migration.new_card_number();
      PERFORM data_migration.log('merge', 'users', e.id::text, new_id::text, 'card_reissued',
        'export card ' || coalesce(e.card_number, 'NULL') || ' already belongs to another account; issued ' || card);
    END IF;

    INSERT INTO public.users (id, full_name, email, phone, card_number, password_hash, balance,
      security_answers, is_approved, is_active, reset_token, reset_token_expiry, last_known_location,
      location_updated_at, created_at, updated_at, transaction_pin_hash, pin_attempts,
      pin_locked_until, card_expiry, card_cvc, last_lat, last_lng)
    VALUES (new_id, e.full_name, e.email, e.phone, card, e.password_hash, coalesce(e.balance, 0),
      e.security_answers, coalesce(e.is_approved, false), coalesce(e.is_active, true), e.reset_token,
      e.reset_token_expiry, e.last_known_location, e.location_updated_at, coalesce(e.created_at, now()),
      coalesce(e.updated_at, now()), e.transaction_pin_hash, coalesce(e.pin_attempts, 0),
      e.pin_locked_until,
      CASE WHEN card = e.card_number THEN e.card_expiry END,
      CASE WHEN card = e.card_number THEN e.card_cvc END,
      e.last_lat, e.last_lng);
    INSERT INTO data_migration.user_map VALUES (e.id, new_id, 'inserted')
      ON CONFLICT (export_id) DO UPDATE SET target_id = EXCLUDED.target_id, matched_by = EXCLUDED.matched_by;
    PERFORM data_migration.log('merge', 'users', e.id::text, new_id::text,
      CASE WHEN new_id = e.id THEN 'inserted' ELSE 'inserted_remapped' END, e.email);
  END LOOP;
END $$;

-- Translate an export user/admin id; NULL when the export row referred to an account the export
-- itself no longer contains (e.g. a deleted user), so it can never point at the wrong person.
CREATE OR REPLACE FUNCTION pg_temp.map_user(p int) RETURNS int LANGUAGE sql STABLE AS
  $$ SELECT target_id FROM data_migration.user_map WHERE export_id = p $$;
CREATE OR REPLACE FUNCTION pg_temp.map_admin(p int) RETURNS int LANGUAGE sql STABLE AS
  $$ SELECT target_id FROM data_migration.admin_map WHERE export_id = p $$;
CREATE OR REPLACE FUNCTION pg_temp.map_actor(p_kind text, p_id int) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT CASE p_kind WHEN 'user' THEN pg_temp.map_user(p_id)
                     WHEN 'admin' THEN pg_temp.map_admin(p_id) END
$$;

-- ---- transactions --------------------------------------------------------------------------------
DO $$
BEGIN
  PERFORM setval(pg_get_serial_sequence('public.transactions', 'id'),
    greatest((SELECT coalesce(max(id), 0) FROM public.transactions),
             (SELECT coalesce(max(id), 0) FROM _export_stage.transactions), 1));
END $$;

WITH fresh AS (
  SELECT e.*,
         NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = e.id) AS id_free
    FROM _export_stage.transactions e
   WHERE NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.transaction_id = e.transaction_id)
), ins AS (
  INSERT INTO public.transactions (id, transaction_id, sender_id, receiver_id, sender_name,
    receiver_name, amount, transaction_type, status, message, fraud_score, fraud_prediction,
    risk_level, prediction_time, model_version, feature_data, transaction_location, ip_address,
    user_agent, admin_id, reviewed_at, reviewed_by, created_at, tx_lat, tx_lng, fee)
  SELECT CASE WHEN f.id_free THEN f.id ELSE nextval(pg_get_serial_sequence('public.transactions', 'id'))::int END,
         f.transaction_id, pg_temp.map_user(f.sender_id), pg_temp.map_user(f.receiver_id),
         f.sender_name, f.receiver_name, f.amount, f.transaction_type::public.transaction_type,
         f.status::public.transaction_status, f.message, coalesce(f.fraud_score, 0),
         f.fraud_prediction::public.fraud_prediction, f.risk_level::public.risk_level,
         f.prediction_time, f.model_version, f.feature_data, f.transaction_location, f.ip_address,
         f.user_agent, pg_temp.map_admin(f.admin_id), f.reviewed_at, pg_temp.map_admin(f.reviewed_by),
         coalesce(f.created_at, now()), f.tx_lat, f.tx_lng, coalesce(f.fee, 0)
    FROM fresh f
   ORDER BY f.id
  RETURNING id, transaction_id
)
INSERT INTO data_migration.merge_log (run_id, phase, entity, export_key, target_key, action, detail)
SELECT (SELECT id FROM _run), 'merge', 'transactions', i.transaction_id, i.id::text,
       CASE WHEN i.id = e.id THEN 'inserted' ELSE 'inserted_remapped' END, NULL
  FROM ins i JOIN _export_stage.transactions e USING (transaction_id);

-- ---- admin actions (no natural key: identical rows are treated as the same event) ---------------
WITH src AS (
  SELECT pg_temp.map_admin(e.admin_id) AS admin_id, e.admin_name, e.action_type,
         pg_temp.map_user(e.user_id) AS user_id, e.user_name, e.amount, e.reason, e.details,
         e.ip_address, e.created_at, e.id AS export_id
    FROM _export_stage.admin_actions e
), ins AS (
  INSERT INTO public.admin_actions (admin_id, admin_name, action_type, user_id, user_name, amount,
    reason, details, ip_address, created_at)
  SELECT s.admin_id, s.admin_name, s.action_type::public.admin_action_type, s.user_id, s.user_name,
         s.amount, s.reason, s.details, s.ip_address, coalesce(s.created_at, now())
    FROM src s
   WHERE s.admin_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.admin_actions a
        WHERE a.admin_id = s.admin_id AND a.action_type::text = s.action_type
          AND a.created_at IS NOT DISTINCT FROM s.created_at
          AND a.user_name IS NOT DISTINCT FROM s.user_name
          AND a.amount IS NOT DISTINCT FROM s.amount
          AND a.reason IS NOT DISTINCT FROM s.reason)
   ORDER BY s.export_id
  RETURNING id
)
INSERT INTO data_migration.merge_log (run_id, phase, entity, export_key, target_key, action, detail)
SELECT (SELECT id FROM _run), 'merge', 'admin_actions', NULL, NULL, 'inserted', count(*) || ' rows' FROM ins;

-- ---- security questions ----------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO public.security_questions (question_key, question_text, is_active)
  SELECT question_key, question_text, coalesce(is_active, true)
    FROM _export_stage.security_questions ORDER BY id
  ON CONFLICT (question_key) DO NOTHING
  RETURNING question_key
)
INSERT INTO data_migration.merge_log (run_id, phase, entity, export_key, target_key, action, detail)
SELECT (SELECT id FROM _run), 'merge', 'security_questions', question_key, NULL, 'inserted', NULL FROM ins;

-- ---- failed withdrawal counters ------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO public.failed_withdrawal_attempts (user_id, attempt_count, last_attempt_time)
  SELECT pg_temp.map_user(user_id), coalesce(attempt_count, 0), last_attempt_time
    FROM _export_stage.failed_withdrawal_attempts
   WHERE pg_temp.map_user(user_id) IS NOT NULL
  ON CONFLICT (user_id) DO NOTHING
  RETURNING user_id
)
INSERT INTO data_migration.merge_log (run_id, phase, entity, export_key, target_key, action, detail)
SELECT (SELECT id FROM _run), 'merge', 'failed_withdrawal_attempts', NULL, NULL, 'inserted', count(*) || ' rows' FROM ins;

-- ---- login attempts ----------------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO public.login_attempts (user_id, email, ip_address, attempt_count, lockout_until,
    created_at, updated_at)
  SELECT pg_temp.map_user(e.user_id), e.email, e.ip_address, coalesce(e.attempt_count, 1),
         e.lockout_until, coalesce(e.created_at, now()), coalesce(e.updated_at, now())
    FROM _export_stage.login_attempts e
   WHERE NOT EXISTS (
     SELECT 1 FROM public.login_attempts a
      WHERE a.email = e.email AND a.ip_address = e.ip_address
        AND a.created_at IS NOT DISTINCT FROM e.created_at)
   ORDER BY e.id
  RETURNING id
)
INSERT INTO data_migration.merge_log (run_id, phase, entity, export_key, target_key, action, detail)
SELECT (SELECT id FROM _run), 'merge', 'login_attempts', NULL, NULL, 'inserted', count(*) || ' rows' FROM ins;

-- ---- failed login log -----------------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO public.failed_login_log (email, ip_address, user_id, attempted_at)
  SELECT e.email, e.ip_address, pg_temp.map_user(e.user_id), coalesce(e.attempted_at, now())
    FROM _export_stage.failed_login_log e
   WHERE NOT EXISTS (
     SELECT 1 FROM public.failed_login_log a
      WHERE a.email = e.email AND a.ip_address = e.ip_address
        AND a.attempted_at IS NOT DISTINCT FROM e.attempted_at)
   ORDER BY e.id
  RETURNING id
)
INSERT INTO data_migration.merge_log (run_id, phase, entity, export_key, target_key, action, detail)
SELECT (SELECT id FROM _run), 'merge', 'failed_login_log', NULL, NULL, 'inserted', count(*) || ' rows' FROM ins;

-- ---- web sessions ------------------------------------------------------------------------------------
-- A session cookie names its principal by id.  Only live sessions whose principal kept the same id
-- are carried over; anything else would sign the cookie holder in as somebody else.
WITH ins AS (
  INSERT INTO public.sessions (sid, sess, expire)
  SELECT e.sid, e.sess, e.expire
    FROM _export_stage.sessions e
   WHERE e.expire > now()::timestamp
     AND (e.sess -> 'principal' IS NULL
          OR pg_temp.map_actor(e.sess -> 'principal' ->> 'kind', (e.sess -> 'principal' ->> 'id')::int)
             = (e.sess -> 'principal' ->> 'id')::int)
  ON CONFLICT (sid) DO NOTHING
  RETURNING sid
)
INSERT INTO data_migration.merge_log (run_id, phase, entity, export_key, target_key, action, detail)
SELECT (SELECT id FROM _run), 'merge', 'sessions', NULL, NULL, 'inserted', count(*) || ' rows' FROM ins;

-- ---- USSD ----------------------------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO public.ussd_sessions (id, phone, actor_kind, actor_id, state, last_text, created_at,
    updated_at, expires_at)
  SELECT e.id, e.phone,
         CASE WHEN pg_temp.map_actor(e.actor_kind, e.actor_id) IS NOT NULL THEN e.actor_kind END,
         pg_temp.map_actor(e.actor_kind, e.actor_id), e.state, coalesce(e.last_text, ''),
         coalesce(e.created_at, now()), coalesce(e.updated_at, now()), e.expires_at
    FROM _export_stage.ussd_sessions e
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
INSERT INTO data_migration.merge_log (run_id, phase, entity, export_key, target_key, action, detail)
SELECT (SELECT id FROM _run), 'merge', 'ussd_sessions', NULL, NULL, 'inserted', count(*) || ' rows' FROM ins;

WITH ins AS (
  INSERT INTO public.ussd_requests (session_id, phone, text_hash, text, response, is_end, scene,
    actor_kind, actor_id, ip_address, duration_ms, created_at)
  SELECT e.session_id, e.phone, e.text_hash, coalesce(e.text, ''), coalesce(e.response, ''),
         coalesce(e.is_end, false), e.scene,
         CASE WHEN pg_temp.map_actor(e.actor_kind, e.actor_id) IS NOT NULL THEN e.actor_kind END,
         pg_temp.map_actor(e.actor_kind, e.actor_id), e.ip_address, e.duration_ms,
         coalesce(e.created_at, now())
    FROM _export_stage.ussd_requests e
   ORDER BY e.id
  ON CONFLICT (session_id, text_hash) DO NOTHING
  RETURNING id
)
INSERT INTO data_migration.merge_log (run_id, phase, entity, export_key, target_key, action, detail)
SELECT (SELECT id FROM _run), 'merge', 'ussd_requests', NULL, NULL, 'inserted', count(*) || ' rows' FROM ins;

WITH ins AS (
  INSERT INTO public.ussd_security_events (event_type, phone, session_id, detail, ip_address, created_at)
  SELECT e.event_type, e.phone, e.session_id, e.detail, e.ip_address, coalesce(e.created_at, now())
    FROM _export_stage.ussd_security_events e
   WHERE NOT EXISTS (
     SELECT 1 FROM public.ussd_security_events a
      WHERE a.event_type = e.event_type
        AND a.session_id IS NOT DISTINCT FROM e.session_id
        AND a.detail IS NOT DISTINCT FROM e.detail
        AND a.created_at IS NOT DISTINCT FROM e.created_at)
   ORDER BY e.id
  RETURNING id
)
INSERT INTO data_migration.merge_log (run_id, phase, entity, export_key, target_key, action, detail)
SELECT (SELECT id FROM _run), 'merge', 'ussd_security_events', NULL, NULL, 'inserted', count(*) || ' rows' FROM ins;

-- -------------------------------------------------------------------------------------------------
--  4. Upgrade every account to the current feature set.
-- -------------------------------------------------------------------------------------------------

-- Virtual card number: every account needs a 16-digit, 44-prefixed number to receive transfers.
DO $$
DECLARE
  u record;
  card text;
BEGIN
  FOR u IN SELECT id, card_number FROM public.users
            WHERE card_number IS NULL OR card_number !~ '^44[0-9]{14}$' ORDER BY id LOOP
    card := data_migration.new_card_number();
    UPDATE public.users
       SET card_number = card,
           card_expiry = data_migration.new_expiry(),
           card_cvc = data_migration.new_cvc(),
           updated_at = now()
     WHERE id = u.id;
    PERFORM data_migration.log('upgrade', 'users', NULL, u.id::text, 'card_issued',
      'previous number ' || coalesce(nullif(u.card_number, ''), 'none') || ' → ' || card);
  END LOOP;
END $$;

WITH upd AS (
  UPDATE public.users
     SET card_expiry = data_migration.new_expiry(), updated_at = now()
   WHERE card_expiry IS NULL OR NOT data_migration.expiry_is_current(card_expiry)
  RETURNING id, card_expiry
)
INSERT INTO data_migration.merge_log (run_id, phase, entity, export_key, target_key, action, detail)
SELECT (SELECT id FROM _run), 'upgrade', 'users', NULL, id::text, 'card_expiry_set', card_expiry FROM upd;

WITH upd AS (
  UPDATE public.users
     SET card_cvc = data_migration.new_cvc(), updated_at = now()
   WHERE card_cvc IS NULL OR card_cvc !~ '^[0-9]{3}$'
  RETURNING id
)
INSERT INTO data_migration.merge_log (run_id, phase, entity, export_key, target_key, action, detail)
SELECT (SELECT id FROM _run), 'upgrade', 'users', NULL, id::text, 'card_cvc_set', NULL FROM upd;

-- PIN lockouts that already ran out are cleared, the way a successful entry would clear them.
UPDATE public.users SET pin_attempts = 0, pin_locked_until = NULL
 WHERE pin_locked_until IS NOT NULL AND pin_locked_until < now();
UPDATE public.admins SET pin_attempts = 0, pin_locked_until = NULL
 WHERE pin_locked_until IS NOT NULL AND pin_locked_until < now();

-- -------------------------------------------------------------------------------------------------
--  5. Sequences: next id is always past the highest one now in use.
-- -------------------------------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'admins', 'transactions', 'admin_actions', 'login_attempts',
    'failed_login_log', 'security_questions', 'ussd_requests', 'ussd_security_events'] LOOP
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(%L, ''id''), greatest(coalesce(max(id), 0), 1), max(id) IS NOT NULL) FROM public.%I',
      'public.' || t, t);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------------------------------
--  6. Drizzle history: 0000–0003 are now in place, so the migrator must skip them.
-- -------------------------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id serial PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT e.hash, e.created_at
  FROM _export_stage.drizzle_migrations e
 WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations d WHERE d.created_at = e.created_at)
 ORDER BY e.created_at;

-- -------------------------------------------------------------------------------------------------
--  7. Verify.  Any failure raises, and the whole transaction is rolled back.
-- -------------------------------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  n bigint;
BEGIN
  -- Nothing that was there before is gone.
  FOR r IN SELECT b.tbl, b.n FROM _before b LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', r.tbl) INTO n;
    IF n < r.n THEN
      RAISE EXCEPTION 'retention check failed: public.% had % rows, now %', r.tbl, r.n, n;
    END IF;
  END LOOP;

  -- Every exported account and transaction is present.
  SELECT count(*) INTO n FROM _export_stage.users e
   WHERE NOT EXISTS (SELECT 1 FROM data_migration.user_map m JOIN public.users u ON u.id = m.target_id
                      WHERE m.export_id = e.id);
  IF n > 0 THEN RAISE EXCEPTION '% exported users were not merged', n; END IF;

  SELECT count(*) INTO n FROM _export_stage.admins e
   WHERE NOT EXISTS (SELECT 1 FROM data_migration.admin_map m JOIN public.admins a ON a.id = m.target_id
                      WHERE m.export_id = e.id);
  IF n > 0 THEN RAISE EXCEPTION '% exported admins were not merged', n; END IF;

  SELECT count(*) INTO n FROM _export_stage.transactions e
   WHERE NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.transaction_id = e.transaction_id);
  IF n > 0 THEN RAISE EXCEPTION '% exported transactions were not merged', n; END IF;

  SELECT count(*) INTO n FROM _export_stage.security_questions e
   WHERE NOT EXISTS (SELECT 1 FROM public.security_questions q WHERE q.question_key = e.question_key);
  IF n > 0 THEN RAISE EXCEPTION '% exported security questions were not merged', n; END IF;

  SELECT count(*) INTO n FROM _export_stage.ussd_requests e
   WHERE NOT EXISTS (SELECT 1 FROM public.ussd_requests q
                      WHERE q.session_id = e.session_id AND q.text_hash = e.text_hash);
  IF n > 0 THEN RAISE EXCEPTION '% exported USSD requests were not merged', n; END IF;

  SELECT count(*) INTO n FROM _export_stage.ussd_sessions e
   WHERE NOT EXISTS (SELECT 1 FROM public.ussd_sessions q WHERE q.id = e.id);
  IF n > 0 THEN RAISE EXCEPTION '% exported USSD sessions were not merged', n; END IF;

  -- Every account carries a complete virtual card.
  SELECT count(*) INTO n FROM public.users
   WHERE card_number IS NULL OR card_number !~ '^44[0-9]{14}$'
      OR card_cvc IS NULL OR card_cvc !~ '^[0-9]{3}$'
      OR card_expiry IS NULL OR NOT data_migration.expiry_is_current(card_expiry);
  IF n > 0 THEN RAISE EXCEPTION '% users still lack a complete virtual card', n; END IF;
END $$;

-- -------------------------------------------------------------------------------------------------
--  Report
-- -------------------------------------------------------------------------------------------------
\echo
\echo '== Rows per table: before → after =='
CREATE FUNCTION pg_temp.row_count(p_table text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM public.%I', p_table) INTO n;
  RETURN n;
END $$;
SELECT tbl AS "table", n AS before, pg_temp.row_count(tbl) AS after, pg_temp.row_count(tbl) - n AS added
  FROM _before ORDER BY tbl;

\echo '== Decisions taken in this run =='
SELECT entity, action,
       sum(CASE WHEN detail ~ '^[0-9]+ rows$' THEN split_part(detail, ' ', 1)::int ELSE 1 END) AS rows
  FROM data_migration.merge_log WHERE run_id = (SELECT id FROM _run)
 GROUP BY entity, action ORDER BY entity, action;

\echo '== Accounts that matched an existing one (your row was kept) =='
SELECT export_key AS export_id, target_key AS your_id, action, detail
  FROM data_migration.merge_log
 WHERE run_id = (SELECT id FROM _run) AND entity IN ('users', 'admins') AND action LIKE 'matched_%'
 ORDER BY entity, export_key::int;

DROP SCHEMA _export_stage CASCADE;

COMMIT;

\echo 'Merge complete. Details: SELECT * FROM data_migration.merge_log ORDER BY id;'
