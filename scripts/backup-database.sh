#!/usr/bin/env bash
# Weekly database backup, run by .github/workflows/weekly-backup.yml.
#
#   1. pg_dump of the whole database, in Postgres' custom format
#      (compressed, and pg_restore can restore all of it or one table).
#   2. Restored into an empty database, and every table's row count
#      compared with the original: a backup that can't be restored is no
#      backup, and the only time to find out shouldn't be the day it's
#      needed.
#   3. Encrypted with age for the public key in AGE_RECIPIENT. The
#      repository is public, and so are its workflow artifacts: only the
#      encrypted file leaves this machine, and only the private key,
#      kept by its owner outside GitHub, can open it.
#
# Environment:
#   SOURCE_URL     database to back up (Neon's direct connection, not the pooler)
#   RESTORE_URL    an empty database to try the restore in
#   AGE_RECIPIENT  age public key (age1…)
#   OUT_FILE       where to write the encrypted backup (….dump.age)
#   PG_BIN         folder with pg_dump, pg_restore and psql of the server's
#                  major version or newer (optional)
#
# Nothing it prints contains data or credentials: workflow logs are public.
set -euo pipefail

: "${SOURCE_URL:?SOURCE_URL is not set}"
: "${RESTORE_URL:?RESTORE_URL is not set}"
: "${AGE_RECIPIENT:?AGE_RECIPIENT is not set}"
: "${OUT_FILE:?OUT_FILE is not set}"
bin="${PG_BIN:+${PG_BIN%/}/}"

if [[ "$AGE_RECIPIENT" != age1* ]]; then
  echo "AGE_RECIPIENT is not an age public key (it should start with age1)" >&2
  exit 1
fi

# Neon's URLs ask to check its certificate (sslmode=verify-full). libpq
# needs to know which authorities to trust: the system's. Only for the
# source: the local restore database has no TLS at all.
on_source() {
  if [[ "$SOURCE_URL" == *sslmode=verify-full* && "$SOURCE_URL" != *sslrootcert=* ]]; then
    PGSSLROOTCERT=system "$@"
  else
    "$@"
  fi
}

work="$(mktemp -d)"
# The plain dump never outlives the script, whatever happens.
trap 'rm -rf "$work"' EXIT
dump="$work/backup.dump"

echo "Dumping the database…"
on_source "${bin}pg_dump" --format=custom --no-owner --no-privileges \
  --file="$dump" --dbname="$SOURCE_URL"
echo "Dump: $(du -h "$dump" | cut -f1)"

# Row count of every table of the public schema, one "table count" per line.
count_rows() {
  "${bin}psql" --no-psqlrc --quiet --tuples-only --no-align --field-separator=' ' \
    --dbname="$1" --set=ON_ERROR_STOP=1 <<'SQL'
SELECT format('SELECT %L, count(*) FROM public.%I', tablename, tablename)
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
\gexec
SQL
}

echo "Restoring it into an empty database…"
"${bin}pg_restore" --exit-on-error --no-owner --no-privileges \
  --dbname="$RESTORE_URL" "$dump"

source_counts="$(on_source count_rows "$SOURCE_URL")"
restored_counts="$(count_rows "$RESTORE_URL")"
if [[ -z "$source_counts" ]]; then
  echo "The database has no tables: refusing to keep an empty backup" >&2
  exit 1
fi
if [[ "$source_counts" != "$restored_counts" ]]; then
  echo "The restored copy doesn't match the original:" >&2
  diff <(echo "$source_counts") <(echo "$restored_counts") >&2 || true
  exit 1
fi
echo "Restore checked, rows per table:"
while IFS= read -r line; do
  echo "  $line"
done <<<"$source_counts"

echo "Encrypting…"
age --encrypt --recipient "$AGE_RECIPIENT" --output "$OUT_FILE" "$dump"
echo "Backup ready: $(basename "$OUT_FILE") ($(du -h "$OUT_FILE" | cut -f1))"
