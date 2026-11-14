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
#
# Alerts: after every attempt the exit code goes to scripts/backup-alert.ts, a separate process,
# so a backup the out-of-memory killer ends ("Killed", exit 137) is still counted. It emails
# BACKUP_ALERT_EMAIL (or PLATFORM_ADMIN_EMAILS) once a night after 3 failed attempts, or when no
# backup has worked for 26 hours (checked once an hour), and once more when a backup works again.
# State lives in BACKUP_ALERT_STATE_FILE (default /tmp/backup-alert.json).
set -eu

HOUR="${BACKUP_HOUR_UTC:-03}"
echo "backup-cron: will run scripts/backup-db.ts daily at ${HOUR}:00 UTC"

# Never lets the alert stop the loop.
alert() {
  bun run /repo/scripts/backup-alert.ts "$@" || echo "backup-cron: backup-alert.ts failed" >&2
}

last_run_date=""
last_check=""
while true; do
  now_hour=$(date -u +%H)
  now_date=$(date -u +%F)
  if [ "$last_check" != "$now_date $now_hour" ]; then
    last_check="$now_date $now_hour"
    alert check
  fi
  if [ "$now_hour" = "$HOUR" ] && [ "$now_date" != "$last_run_date" ]; then
    echo "backup-cron: $(date -u -Iseconds) running backup-db.ts"
    status=0
    bun run /repo/scripts/backup-db.ts || status=$?
    alert attempt "$status"
    if [ "$status" -eq 0 ]; then
      last_run_date="$now_date"
    else
      echo "backup-cron: backup-db.ts failed (exit $status), will retry in 5 minutes" >&2
    fi
  fi
  sleep 300
done
