#!/usr/bin/env bash
# Foreground service recipe. Run only after root releases execution.
set -euo pipefail
SCENARIO_SOURCE="${1:?Pass frozen checkout}"
SCENARIO_PIN="${2:?Pass full frozen commit}"
SCENARIO_BUILD="${3:?Pass authenticated server bundle directory}"
SCENARIO_STATIC="${4:?Pass same-pin controls dist}"
SCENARIO_DB="${5:?Pass exclusive owned database directory}"
SCENARIO_RECEIPT="${6:?Pass fresh absolute receipt prefix}"
SCENARIO_STAGE="${7:?Pass intact, unavailable, or restored}"
SCENARIO_RECIPE_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
for SCENARIO_PATH in "$SCENARIO_SOURCE" "$SCENARIO_BUILD" "$SCENARIO_STATIC" "$SCENARIO_DB" "$SCENARIO_RECEIPT"; do
  test "${SCENARIO_PATH:0:1}" = '/'
done
cd -- "$SCENARIO_SOURCE"
test "$(git rev-parse HEAD)" = "$SCENARIO_PIN"
test -d "$SCENARIO_DB"
test -f "$SCENARIO_BUILD/rts-server.js"
test -f "$SCENARIO_BUILD/canonical-campaign.mjs"
case "$SCENARIO_STAGE" in
  intact|restored) test -f "$SCENARIO_BUILD/campaign-runtime.mjs" ;;
  unavailable) test ! -e "$SCENARIO_BUILD/campaign-runtime.mjs" ;;
  *) exit 2 ;;
esac
test ! -e "$SCENARIO_RECEIPT.launch.json"
test ! -e "$SCENARIO_RECEIPT.log"
# Every recipe-owned instance holds the same lock across exec. Root also confirms
# the preceding owned process is stopped; no other service may use this DB.
exec 9> "$SCENARIO_DB/.scenario-service.lock"
flock -n 9
python3 "$SCENARIO_RECIPE_ROOT/record-server-launch.py" "$SCENARIO_PIN"   "$SCENARIO_BUILD" "$SCENARIO_STATIC" "$SCENARIO_DB" "$SCENARIO_RECEIPT"   "$SCENARIO_STAGE" "$$"
set -o noclobber
exec env RTS_HOST=127.0.0.2 RTS_PORT=5307 RTS_DATA_DIR="$SCENARIO_DB"   RTS_STATIC_DIR="$SCENARIO_STATIC" RTS_ORIGIN='http://127.0.0.2:5307'   RTS_SECURE_COOKIE=0 RTS_TRUST_PROXY=0 node "$SCENARIO_BUILD/rts-server.js"   > "$SCENARIO_RECEIPT.log" 2>&1
