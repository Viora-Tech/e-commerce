#!/bin/sh
# Runs scripts/backup-db.ts once a day at BACKUP_HOUR_UTC (default 03:00 UTC, off-peak for an
# Indian storefront). Used as the `backup` service's command in
# deploy/docker-compose.prod.yml, built from deploy/Dockerfile.tasks.
#
# This is a plain sleep loop, not real cron — the image is Alpine without a cron daemon
# installed, and a loop is enough for one job a day on one server. If you run this on Dokploy,
# prefer its own Scheduled Job feature instead (it starts a fresh container per run and needs
# no long-lived service at all) — see
# apps/docs/content/developer-docs/operations/deployment.mdx, "Backups". This script is the
# docker-compose-only fallback.
set -eu

HOUR="${BACKUP_HOUR_UTC:-03}"
echo "backup-cron: will run scripts/backup-db.ts daily at ${HOUR}:00 UTC"

last_run_date=""
while true; do
  now_hour=$(date -u +%H)
  now_date=$(date -u +%F)
  if [ "$now_hour" = "$HOUR" ] && [ "$now_date" != "$last_run_date" ]; then
    echo "backup-cron: $(date -u -Iseconds) running backup-db.ts"
    if bun run /repo/scripts/backup-db.ts; then
      last_run_date="$now_date"
    else
      echo "backup-cron: backup-db.ts failed, will retry next hour tick" >&2
    fi
  fi
  sleep 300
done
