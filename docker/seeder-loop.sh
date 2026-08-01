#!/bin/sh
# =============================================================================
# Seeder loop — runs scripts/run-seeders.sh on an interval inside the stack.
# =============================================================================
# Replaces the host cron that SELF_HOSTING.md documents for self-hosted
# installs. Coolify gives you no host to put that cron on, so the loop lives in
# a container next to the app.
# =============================================================================
set -eu

INTERVAL_MINUTES="${SEED_INTERVAL_MINUTES:-30}"
INTERVAL_SECONDS=$(( INTERVAL_MINUTES * 60 ))
HEARTBEAT=/tmp/seeder-alive

: "${UPSTASH_REDIS_REST_URL:?UPSTASH_REDIS_REST_URL is required}"
: "${UPSTASH_REDIS_REST_TOKEN:?UPSTASH_REDIS_REST_TOKEN is required}"

# run-seeders.sh prefers REDIS_TOKEN when present. Keep the two in sync so a
# stray REDIS_TOKEN in the Coolify env can't point the seeders at a different
# bearer than the one the REST proxy is actually checking.
REDIS_TOKEN="$UPSTASH_REDIS_REST_TOKEN"
export REDIS_TOKEN

terminating=0
trap 'terminating=1' TERM INT

log() { echo "[seeder] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }

# The REST proxy comes up a moment after Redis. Seeding before it answers just
# burns a full interval on 163 connection errors, so wait it out first.
log "waiting for REST proxy at ${UPSTASH_REDIS_REST_URL}"
attempt=0
until wget -q -O /dev/null \
      --header="Authorization: Bearer ${UPSTASH_REDIS_REST_TOKEN}" \
      "${UPSTASH_REDIS_REST_URL}/ping" 2>/dev/null; do
  attempt=$(( attempt + 1 ))
  if [ "$attempt" -ge 60 ]; then
    log "FATAL: REST proxy unreachable after 60 attempts"
    exit 1
  fi
  [ "$terminating" -eq 1 ] && exit 0
  sleep 5
done
log "REST proxy is up"

while :; do
  started=$(date +%s)
  log "starting seed pass (interval ${INTERVAL_MINUTES}m)"

  # A failing seeder must not take the container down — run-seeders.sh already
  # reports per-seeder OK/SKIP/FAIL and exits non-zero on aggregate trouble.
  # `set -e` would turn a single dead upstream into a crash loop.
  if ./scripts/run-seeders.sh; then
    log "seed pass finished"
  else
    log "seed pass finished with errors (rc=$?) — continuing"
  fi

  touch "$HEARTBEAT"

  elapsed=$(( $(date +%s) - started ))
  remaining=$(( INTERVAL_SECONDS - elapsed ))
  if [ "$remaining" -lt 60 ]; then
    # The pass outran its own interval. Sleeping the full interval anyway would
    # let it drift; a short floor keeps upstreams from being hammered back to
    # back while still catching up.
    log "pass took ${elapsed}s, longer than the ${INTERVAL_SECONDS}s interval — backing off 60s"
    remaining=60
  fi

  [ "$terminating" -eq 1 ] && { log "shutting down"; exit 0; }
  log "sleeping ${remaining}s"
  sleep "$remaining" &
  wait $! || true
done
