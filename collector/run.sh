#!/bin/bash
# Roda o coletor e envia ao painel. Agendado no cron (1 min). Config em /root/.painel_env (fora do git).
LOG=/var/log/painel-coletor.log
[ -f "$LOG" ] && [ "$(stat -c%s "$LOG")" -gt 1000000 ] && tail -n 200 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
set -a; . /root/.painel_env; [ -f /root/.govc_env ] && . /root/.govc_env; set +a
exec 9>/run/painel-coletor.lock; flock -n 9 || exit 0
echo "$(date '+%F %T') $(python3 "$(dirname "$0")/collector.py" --post "$PAINEL_URL/api/ingest" 2>&1 | tail -n 1)" >> "$LOG"
