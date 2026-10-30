#!/usr/bin/env bash
# Back up your database, then merge database_export.sql into it.
#   database/merge_export/run.sh postgres://user:pass@host:5432/fraud_detection
# With no argument, DATABASE_URL from the environment (or the repo's .env) is used.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
url="${1:-${DATABASE_URL:-}}"
if [ -z "$url" ] && [ -f "$here/../../.env" ]; then
  url="$(grep -E '^DATABASE_URL=' "$here/../../.env" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
fi
[ -n "$url" ] || { echo 'usage: run.sh <database url>   (or set DATABASE_URL)'; exit 1; }

backup="$here/backup-$(date +%Y%m%d-%H%M%S).dump"
echo "1/2  Backing up to $backup"
pg_dump --format=custom --file="$backup" "$url"

echo '2/2  Merging database_export.sql'
psql -X -v ON_ERROR_STOP=1 -d "$url" -f "$here/merge_export.sql"

echo
echo "Done. To undo: pg_restore --clean --if-exists -d \"$url\" \"$backup\""
