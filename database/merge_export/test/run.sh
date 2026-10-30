#!/usr/bin/env bash
# End-to-end test of merge_export.sql on scratch databases (never touches your real one).
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=… database/merge_export/test/run.sh
set -euo pipefail
cd "$(dirname "$0")"
MIGRATION=../merge_export.sql
PSQL=(psql -X -q -v ON_ERROR_STOP=1)
counts() {
  "${PSQL[@]}" -d "$1" -Atc "SELECT string_agg(t || '=' || n, ' ' ORDER BY t) FROM (
    SELECT 'users' t, count(*) n FROM users UNION ALL SELECT 'admins', count(*) FROM admins
    UNION ALL SELECT 'transactions', count(*) FROM transactions
    UNION ALL SELECT 'admin_actions', count(*) FROM admin_actions
    UNION ALL SELECT 'failed_login_log', count(*) FROM failed_login_log
    UNION ALL SELECT 'login_attempts', count(*) FROM login_attempts
    UNION ALL SELECT 'ussd_requests', count(*) FROM ussd_requests
    UNION ALL SELECT 'ussd_sessions', count(*) FROM ussd_sessions
    UNION ALL SELECT 'ussd_security_events', count(*) FROM ussd_security_events
    UNION ALL SELECT 'security_questions', count(*) FROM security_questions) c"
}
cards() { "${PSQL[@]}" -d "$1" -Atc "SELECT string_agg(id || ':' || card_number || ':' || card_expiry || ':' || card_cvc, ' ' ORDER BY id) FROM users"; }

echo '== 1. empty database =='
dropdb --if-exists merge_t_empty && createdb merge_t_empty
"${PSQL[@]}" -d merge_t_empty -f "$MIGRATION" > /dev/null
echo "   $(counts merge_t_empty)"

echo '== 2. existing database on the older schema, with colliding data =='
dropdb --if-exists merge_t_existing && createdb merge_t_existing
"${PSQL[@]}" -d merge_t_existing -f fixture_existing.sql > /dev/null
"${PSQL[@]}" -d merge_t_existing -f "$MIGRATION"
"${PSQL[@]}" -d merge_t_existing -f assert_existing.sql

echo '== 3. re-running changes nothing =='
for db in merge_t_empty merge_t_existing; do
  before="$(counts $db) $(cards $db)"
  "${PSQL[@]}" -d $db -f "$MIGRATION" > /dev/null
  after="$(counts $db) $(cards $db)"
  [ "$before" = "$after" ] || { echo "   $db changed on re-run"; diff <(echo "$before" | tr ' ' '\n') <(echo "$after" | tr ' ' '\n'); exit 1; }
  echo "   $db: identical after second run"
done
"${PSQL[@]}" -d merge_t_existing -f assert_existing.sql

echo '== 4. a failing check rolls everything back =='
dropdb --if-exists merge_t_rollback && createdb merge_t_rollback
"${PSQL[@]}" -d merge_t_rollback -f fixture_existing.sql > /dev/null
# A balance below zero cannot be imported (CHECK users_balance_non_negative) → the run must abort.
bad="$(mktemp)"
sed 's/^\(4\tCOSMA COSMA VICTORINI\t[^\t]*\t[^\t]*\t[^\t]*\t[^\t]*\t\)22387000.00/\1-1.00/' "$MIGRATION" > "$bad"
sed -i 's/^\(25\tFRANK GODWIN\t[^\t]*\t[^\t]*\t[^\t]*\t[^\t]*\t\)1904000.00/\1-1.00/' "$bad"
if "${PSQL[@]}" -d merge_t_rollback -f "$bad" > /dev/null 2> "$bad.err"; then
  echo '   expected failure did not happen'; exit 1
fi
grep -q users_balance_non_negative "$bad.err" || { echo '   failed for another reason:'; cat "$bad.err"; exit 1; }
rm -f "$bad" "$bad.err"
"${PSQL[@]}" -d merge_t_rollback -Atc "SELECT 'users=' || count(*) FROM users" | grep -qx 'users=4'
"${PSQL[@]}" -d merge_t_rollback -Atc "SELECT to_regclass('public.users') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='card_expiry')" | grep -qx t
echo '   failed run left the database exactly as it was'

echo 'ALL MERGE TESTS PASSED'
