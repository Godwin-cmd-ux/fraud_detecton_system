-- A database that is "yours": on the older schema (drizzle 0000 + 0001 only, so no virtual-card or
-- fee columns yet) with its own customers, and deliberate collisions with database_export.sql.
-- Every password here is User@123 (admins: Admin@123).
\set ON_ERROR_STOP on
\i ../../../apps/api/drizzle/0000_init.sql
\i ../../../apps/api/drizzle/0001_ussd.sql

CREATE SCHEMA drizzle;
CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES
  ('a725d45da2affb1043f258aa6321f5c5e344ab94bbf73dd732bd15ad83a47411', 1793304713709),
  ('c0d7b9ca995e5dc15c399db3d7b064180ffb668d51501fd8eee0f4006d4aa338', 1793352743060);

INSERT INTO admins (id, username, email, password_hash, full_name) VALUES
  -- same username as the export's admin #1: must be matched, this row kept
  (1, 'admin', 'admin@frauddetection.com', '$2b$10$S5U.lcbweRLieAb74GMWcuo54GgJkEyT4r0.wJa1DpPOGtsDbdv3K', 'My Own Admin'),
  -- takes id 2, which the export's admin "Franco" uses: Franco must be remapped
  (2, 'local_ops', 'ops@local.test', '$2b$10$S5U.lcbweRLieAb74GMWcuo54GgJkEyT4r0.wJa1DpPOGtsDbdv3K', 'Local Ops');

INSERT INTO users (id, full_name, email, phone, card_number, password_hash, balance, is_approved) VALUES
  -- legacy card number, no expiry/CVC columns at all yet
  (1, 'Old Customer', 'old@local.test', '+255711000001', 'ABC-123', '$2b$10$QlDHPKWun90/c.6HOEp5HOGIymQYAbJwMCWJ72HKT73zx79V85CJy', 1000, true),
  -- same email as export user #4 (COSMA) with a different balance and card: this row must win
  (4, 'Cosma (mine)', 'GodwinFranklin418@gmail.com', '0757071967', '5500000000000004', '$2b$10$QlDHPKWun90/c.6HOEp5HOGIymQYAbJwMCWJ72HKT73zx79V85CJy', 999, true),
  -- takes id 5 (export: Christian Mahuve) and card 4400000000000006 (export: Marie Curie)
  (5, 'Someone Else', 'someone@local.test', '+255711000005', '4400000000000006', '$2b$10$QlDHPKWun90/c.6HOEp5HOGIymQYAbJwMCWJ72HKT73zx79V85CJy', 50, true),
  -- same phone as export user #19 (Amina) under another email: matched by phone
  (30, 'Amina (mine)', 'amina.h@local.test', '+255700000019', '', '$2b$10$QlDHPKWun90/c.6HOEp5HOGIymQYAbJwMCWJ72HKT73zx79V85CJy', 7000, true);

INSERT INTO transactions (id, transaction_id, sender_id, receiver_id, sender_name, receiver_name, amount, transaction_type, status, created_at) VALUES
  -- id 4 is also the export's first transaction id: that one must be renumbered
  (4, 'TXN-LOCAL-0001', 1, 5, 'Old Customer', 'Someone Else', 250, 'transfer', 'SUCCESS', '2026-01-02 10:00+03'),
  -- same transaction_id as the export's transaction #4: must not be duplicated, this row wins
  (50, 'TXN202605200654457096', 4, 1, 'Cosma (mine)', 'Old Customer', 123, 'transfer', 'SUCCESS', '2026-05-20 07:54:45+03');

INSERT INTO admin_actions (admin_id, admin_name, action_type, user_id, user_name, amount, reason)
VALUES (2, 'Local Ops', 'add_balance', 1, 'Old Customer', 1000, 'opening balance');

INSERT INTO failed_withdrawal_attempts VALUES (4, 2, '2026-10-01 09:00+03');
INSERT INTO login_attempts (user_id, email, ip_address) VALUES (1, 'old@local.test', '10.0.0.1');
INSERT INTO failed_login_log (email, ip_address) VALUES ('old@local.test', '10.0.0.1');
INSERT INTO security_questions (question_key, question_text) VALUES ('primary_school', 'My own wording of the primary school question');
INSERT INTO ussd_sessions (id, phone, state, last_text, expires_at) VALUES
  ('ATUid_0f204186c5d379992cb5a252bdcb6e9f', '+255711000001', '{"scene":"guest.main"}', '', now());

-- Sequences left behind their tables, as happens after inserts with explicit ids.
SELECT setval('users_id_seq', 1), setval('admins_id_seq', 1), setval('transactions_id_seq', 1);

-- Snapshot of every row above, to prove later that none of them changed.
CREATE SCHEMA fixture;
CREATE TABLE fixture.users AS SELECT id, full_name, email, phone, password_hash, balance FROM users;
CREATE TABLE fixture.admins AS SELECT id, username, email, password_hash, full_name FROM admins;
CREATE TABLE fixture.transactions AS SELECT id, transaction_id, sender_id, receiver_id, amount FROM transactions;
