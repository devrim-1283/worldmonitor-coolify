#!/bin/sh
# Liveness probe for the seeder container.
#
# seeder-loop.sh touches /tmp/seeder-alive after every pass. If a pass wedges
# (a seeder ignoring its own AbortSignal, a hung DNS lookup) the heartbeat goes
# stale and Docker restarts the container instead of leaving a silent no-op
# sidecar running for days.
#
# Tolerance is two intervals plus a grace window: one interval of sleep, one of
# work, and slack for a slow pass. Kept in a script rather than inline in
# HEALTHCHECK so SEED_INTERVAL_MINUTES is read at runtime — Docker would try to
# substitute it at build time, where it is not yet set.
set -eu

HEARTBEAT=/tmp/seeder-alive
INTERVAL_MINUTES="${SEED_INTERVAL_MINUTES:-30}"
MAX_AGE=$(( INTERVAL_MINUTES * 60 * 2 + 900 ))

# Absent on the very first pass — start-period covers that window.
[ -f "$HEARTBEAT" ] || exit 1

age=$(( $(date +%s) - $(stat -c %Y "$HEARTBEAT") ))
[ "$age" -lt "$MAX_AGE" ] || exit 1
