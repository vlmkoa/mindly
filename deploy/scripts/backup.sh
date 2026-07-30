#!/usr/bin/env bash
# Nightly logical backup, run on the EC2 HOST by cron (not in a container):
#   mkdir -p /opt/backups
#   crontab -e ->  15 8 * * * /opt/mindly/deploy/scripts/backup.sh >> /var/log/mindly-backup.log 2>&1
#
# pg_dump (transaction-consistent) is THE restore path; the daily EBS snapshot
# is only the crash-consistent secondary net. S3 upload uses the instance role
# — no keys on disk. Reads MINDLY_BACKUP_BUCKET from /opt/mindly/.env.
#
# Restore drill (quarterly — an untested backup is a hope, not a backup):
#   docker compose -f /opt/mindly/docker-compose.prod.yml cp <dump> db:/tmp/r.dump
#   docker compose -f /opt/mindly/docker-compose.prod.yml exec db sh -c \
#     'createdb -U koan restore_test && pg_restore -U koan -d restore_test /tmp/r.dump \
#      && psql -U koan -d restore_test -c "select count(*) from users;" \
#      && dropdb -U koan restore_test'
set -euo pipefail

REPO=/opt/mindly
OUT=/opt/backups
STAMP="$(date +%F)"
FILE="${OUT}/mindly-${STAMP}.dump"

# shellcheck disable=SC1091
. "${REPO}/.env" # provides MINDLY_BACKUP_BUCKET (and DOMAIN, unused here)
: "${MINDLY_BACKUP_BUCKET:?set MINDLY_BACKUP_BUCKET in ${REPO}/.env}"

mkdir -p "${OUT}"
docker compose -f "${REPO}/docker-compose.prod.yml" exec -T db \
  pg_dump -Fc -U koan -d koan > "${FILE}"

aws s3 cp "${FILE}" "s3://${MINDLY_BACKUP_BUCKET}/pg/"

# Keep a week locally; S3 lifecycle handles the 30-day remote retention.
find "${OUT}" -name 'mindly-*.dump' -mtime +7 -delete

echo "backup ok: ${FILE} -> s3://${MINDLY_BACKUP_BUCKET}/pg/"
