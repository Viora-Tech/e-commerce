#!/usr/bin/env bash
# Dokploy schedule `server-threshold-alerts` (server schedule on koomerce-app, every 5 minutes).
# Paste into the schedule's script and set URL to the monitor's /dokploy URL with its token
# (keep the token in Dokploy only, never in git).
#
# CPU is posted on every hot run with no dedupe here: the monitor wants consecutive readings and
# decides itself (3 in a row, then quiet for an hour; apps/monitor/src/server.ts). `cpu` is summed
# over the cores, the way top and docker stats count it, and `cores` tells the monitor what to
# divide by. Memory and disk still dedupe here, one email per kind per hour.
set -u
URL='<monitor /dokploy URL with ?token=...>'
SERVER='koomerce-app'
LIMIT=85
STAMPS=/tmp/server-threshold-alerts
mkdir -p "$STAMPS"

cores=$(nproc)
read -r _ u1 n1 s1 i1 w1 q1 sq1 st1 _ < /proc/stat
sleep 5
read -r _ u2 n2 s2 i2 w2 q2 sq2 st2 _ < /proc/stat
busy=$(( (u2 + n2 + s2 + q2 + sq2 + st2) - (u1 + n1 + s1 + q1 + sq1 + st1) ))
idle=$(( (i2 + w2) - (i1 + w1) ))
total=$(( busy + idle ))
[ "$total" -gt 0 ] || total=1
cpu=$(( 100 * cores * busy / total ))
mem=$(awk '/^MemTotal:/ {t=$2} /^MemAvailable:/ {a=$2} END {printf "%d", 100 * (t - a) / t}' /proc/meminfo)
disk=$(df --output=pcent / | tail -1 | tr -dc '0-9')

alert() {
  local kind=$1 value=$2
  curl -fsS -m 10 -X POST -H 'content-type: application/json' \
    -d "{\"kind\":\"$kind\",\"title\":\"$kind at ${value}% on $SERVER\",\"server\":\"$SERVER\",\"cpu\":\"${cpu}%\",\"cores\":$cores,\"memory\":\"${mem}%\",\"disk\":\"${disk}%\",\"threshold\":\"${LIMIT}%\"}" \
    "$URL" >/dev/null
}

once_an_hour() {
  local stamp="$STAMPS/$1"
  [ -n "$(find "$stamp" -mmin -60 2>/dev/null)" ] && return 1
  touch "$stamp"
}

[ "$cpu" -ge $(( LIMIT * cores )) ] && alert CPU $(( cpu / cores ))
[ "$mem" -ge "$LIMIT" ] && once_an_hour memory && alert Memory "$mem"
[ "$disk" -ge "$LIMIT" ] && once_an_hour disk && alert Disk "$disk"
exit 0
