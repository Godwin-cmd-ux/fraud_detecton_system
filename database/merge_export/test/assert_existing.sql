-- Checks run after merge_export.sql on the fixture database. Any failed check raises.
\set ON_ERROR_STOP on
DO $$
DECLARE
  n bigint;
  v text;
  christian int;
  franco int;
BEGIN
  -- 1. Your rows are untouched (identity, credentials, balances).
  SELECT count(*) INTO n FROM fixture.users f JOIN users u USING (id)
   WHERE (u.full_name, u.email, u.phone, u.password_hash, u.balance)
         IS NOT DISTINCT FROM (f.full_name, f.email, f.phone, f.password_hash, f.balance);
  IF n <> 4 THEN RAISE EXCEPTION 'existing users changed: % of 4 intact', n; END IF;
  SELECT count(*) INTO n FROM fixture.admins f JOIN admins a USING (id)
   WHERE (a.username, a.email, a.password_hash, a.full_name)
         IS NOT DISTINCT FROM (f.username, f.email, f.password_hash, f.full_name);
  IF n <> 2 THEN RAISE EXCEPTION 'existing admins changed: % of 2 intact', n; END IF;
  SELECT count(*) INTO n FROM fixture.transactions f JOIN transactions t USING (id)
   WHERE (t.transaction_id, t.sender_id, t.receiver_id, t.amount)
         IS NOT DISTINCT FROM (f.transaction_id, f.sender_id, f.receiver_id, f.amount);
  IF n <> 2 THEN RAISE EXCEPTION 'existing transactions changed: % of 2 intact', n; END IF;
  SELECT attempt_count INTO n FROM failed_withdrawal_attempts WHERE user_id = 4;
  IF n <> 2 THEN RAISE EXCEPTION 'existing withdrawal counter overwritten'; END IF;
  SELECT question_text INTO v FROM security_questions WHERE question_key = 'primary_school';
  IF v <> 'My own wording of the primary school question' THEN RAISE EXCEPTION 'question overwritten'; END IF;
  SELECT phone INTO v FROM ussd_sessions WHERE id = 'ATUid_0f204186c5d379992cb5a252bdcb6e9f';
  IF v <> '+255711000001' THEN RAISE EXCEPTION 'ussd session overwritten'; END IF;

  -- 2. Everything from the export is in: 17 exported users, 2 of them already yours.
  SELECT count(*) INTO n FROM users;
  IF n <> 4 + 17 - 2 THEN RAISE EXCEPTION 'expected 19 users, found %', n; END IF;
  SELECT count(*) INTO n FROM admins;
  IF n <> 2 + 3 - 1 THEN RAISE EXCEPTION 'expected 4 admins, found %', n; END IF;
  SELECT count(*) INTO n FROM transactions;
  IF n <> 2 + 99 - 1 THEN RAISE EXCEPTION 'expected 100 transactions, found %', n; END IF;
  SELECT count(*) INTO n FROM admin_actions;
  IF n <> 1 + 10 THEN RAISE EXCEPTION 'expected 11 admin actions, found %', n; END IF;
  SELECT count(*) INTO n FROM failed_login_log;
  IF n <> 1 + 129 THEN RAISE EXCEPTION 'expected 130 failed logins, found %', n; END IF;
  SELECT count(*) INTO n FROM ussd_requests;
  IF n <> 74 THEN RAISE EXCEPTION 'expected 74 ussd requests, found %', n; END IF;
  SELECT count(*) INTO n FROM ussd_sessions;
  IF n <> 23 THEN RAISE EXCEPTION 'expected 23 ussd sessions, found %', n; END IF;
  SELECT count(*) INTO n FROM security_questions;
  IF n <> 11 THEN RAISE EXCEPTION 'expected 11 questions, found %', n; END IF;

  -- 3. Matching and remapping.
  SELECT target_id INTO n FROM data_migration.user_map WHERE export_id = 4;
  IF n <> 4 THEN RAISE EXCEPTION 'COSMA not matched to existing #4'; END IF;
  SELECT target_id INTO n FROM data_migration.user_map WHERE export_id = 19;
  IF n <> 30 THEN RAISE EXCEPTION 'Amina not matched by phone to #30'; END IF;
  SELECT id INTO christian FROM users WHERE email = 'godwinfranklin419@gmail.com';
  IF christian IS NULL OR christian = 5 THEN RAISE EXCEPTION 'Christian not remapped off id 5'; END IF;
  SELECT id INTO franco FROM admins WHERE username = 'Franco';
  IF franco IS NULL OR franco = 2 THEN RAISE EXCEPTION 'Franco not remapped off id 2'; END IF;

  -- Christian's transactions followed him to his new id: compare with the export's own counts.
  SELECT count(*) INTO n FROM transactions WHERE sender_id = christian OR receiver_id = christian;
  IF n = 0 THEN RAISE EXCEPTION 'Christian has no transactions after remap'; END IF;
  SELECT count(*) INTO n FROM transactions WHERE (sender_id = 5 OR receiver_id = 5)
     AND transaction_id <> 'TXN-LOCAL-0001';
  IF n <> 0 THEN RAISE EXCEPTION '% exported transactions still point at the wrong user #5', n; END IF;
  -- Amina's exported transactions now point at your #30.
  SELECT count(*) INTO n FROM transactions WHERE sender_id = 19 OR receiver_id = 19;
  IF n <> 0 THEN RAISE EXCEPTION 'transactions still reference Amina''s export id 19'; END IF;
  SELECT count(*) INTO n FROM transactions WHERE sender_id = 30 OR receiver_id = 30;
  IF n = 0 THEN RAISE EXCEPTION 'Amina''s exported transactions not remapped to #30'; END IF;
  -- Sender/receiver names agree with the account they point at for every imported transfer.
  SELECT count(*) INTO n FROM transactions t JOIN users u ON u.id = t.sender_id
    JOIN data_migration.user_map m ON m.target_id = u.id AND m.matched_by = 'inserted'
   WHERE t.sender_name IS DISTINCT FROM u.full_name;
  IF n <> 0 THEN RAISE EXCEPTION '% transfers point at the wrong sender', n; END IF;
  SELECT count(*) INTO n FROM admin_actions WHERE admin_name = 'FRANK GODWIN' AND admin_id <> franco;
  IF n <> 0 THEN RAISE EXCEPTION 'Franco''s admin actions not remapped'; END IF;

  -- 4. Every account has a complete, current virtual card; reissued ones pass Luhn.
  SELECT count(*) INTO n FROM users
   WHERE card_number !~ '^44[0-9]{14}$' OR card_expiry !~ '^(0[1-9]|1[0-2])/[0-9]{2}$'
      OR card_cvc !~ '^[0-9]{3}$' OR card_expiry IS NULL OR card_cvc IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION '% users without a complete card', n; END IF;
  SELECT card_number INTO v FROM users WHERE id = 1;
  IF NOT data_migration.is_luhn_valid(v) THEN RAISE EXCEPTION 'issued card % fails Luhn', v; END IF;
  -- Matched customers without a usable card took the card the export holds for them.
  SELECT card_number || ' ' || card_expiry INTO v FROM users WHERE id = 4;
  IF v <> '4400000000000004 10/29' THEN RAISE EXCEPTION 'COSMA did not adopt exported card (%)', v; END IF;
  SELECT card_number INTO v FROM users WHERE id = 30;
  IF v <> '4400000000000019' THEN RAISE EXCEPTION 'Amina did not adopt exported card (%)', v; END IF;
  SELECT card_number INTO v FROM users WHERE email = 'godwinfranklin415@gmail.com';
  IF v = '4400000000000006' OR NOT data_migration.is_luhn_valid(v) THEN
    RAISE EXCEPTION 'Marie Curie card collision not resolved (%)', v;
  END IF;
  SELECT card_number INTO v FROM users WHERE id = 5;
  IF v <> '4400000000000006' THEN RAISE EXCEPTION 'your user #5 lost card 4400000000000006'; END IF;

  -- 5. New columns defaulted for old rows.
  SELECT count(*) INTO n FROM transactions WHERE fee IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'fee not defaulted'; END IF;

  -- 6. Sequences are past every id.
  IF (SELECT last_value FROM users_id_seq) < (SELECT max(id) FROM users)
     OR (SELECT last_value FROM transactions_id_seq) < (SELECT max(id) FROM transactions)
     OR (SELECT last_value FROM admins_id_seq) < (SELECT max(id) FROM admins) THEN
    RAISE EXCEPTION 'a sequence trails its table';
  END IF;

  -- 7. Drizzle sees 0000-0003 as applied.
  SELECT count(*) INTO n FROM drizzle.__drizzle_migrations;
  IF n <> 4 THEN RAISE EXCEPTION 'expected 4 drizzle rows, found %', n; END IF;

  RAISE NOTICE 'all checks passed';
END $$;
