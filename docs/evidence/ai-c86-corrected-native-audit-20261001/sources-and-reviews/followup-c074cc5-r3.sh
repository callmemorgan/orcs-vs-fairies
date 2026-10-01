#!/usr/bin/env bash
set -euo pipefail

# Held recipes. Root must assign each phase before invocation.
AI_PHASE=${1:?Choose natural-allied, build-web, build-server, serve, allied-ui, roster-ui, coop-ui, or online-ui}
AI_SOURCE_PIN=c074cc5e610fc128d7b6ac894a61258d418463d4
AI_PROOF_OUT=work/ai-save401-final-c074cc5-r1
AI_PROOF_WRAPPER=work/final-ai-prep/proof-envelope.mjs
AI_PROOF_BASE=http://127.0.0.1:5371
[[ "$(git rev-parse HEAD)" == "$AI_SOURCE_PIN" ]] || exit 2

python3 - "$AI_PROOF_WRAPPER" <<'HASH_CHECK'
from pathlib import Path
import hashlib,sys
assert hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest()=='bb8c80fc33ca6a25e044a5df60350030bb2177461d265025b9bfcffcdc3a1cd2'
HASH_CHECK

case "$AI_PHASE" in
  natural-allied)
    env -u OVF_ALLIED_EXPLORATORY \
      "AI_TEAM_OUTPUT=$AI_PROOF_OUT/natural-allied" \
      "OVF_AI_PROOF_ARTIFACTS=[\"$AI_PROOF_OUT/natural-allied\"]" \
      node "$AI_PROOF_WRAPPER" "$AI_SOURCE_PIN" "$AI_PROOF_OUT/envelopes/natural-allied" -- \
      npx --no-install vitest run --config vitest.ai-team.config.ts --reporter=verbose
    ;;
  build-web)
    env "OVF_AI_PROOF_ARTIFACTS=[\"$AI_PROOF_OUT/dist\"]" \
      node "$AI_PROOF_WRAPPER" "$AI_SOURCE_PIN" "$AI_PROOF_OUT/envelopes/build-web" -- \
      npx --no-install vite build --outDir "$AI_PROOF_OUT/dist"
    ;;
  build-server)
    env "OVF_AI_PROOF_ARTIFACTS=[\"$AI_PROOF_OUT/server\"]" \
      node "$AI_PROOF_WRAPPER" "$AI_SOURCE_PIN" "$AI_PROOF_OUT/envelopes/build-server" -- \
      node scripts/build-server.mjs "$AI_PROOF_OUT/server"
    ;;
  serve)
    env RTS_HOST=127.0.0.1 RTS_PORT=5371 RTS_SPECTATOR_DELAY_SECONDS=30 \
      "RTS_STATIC_DIR=$AI_PROOF_OUT/dist" "RTS_DATA_DIR=$AI_PROOF_OUT/server-data" \
      "RTS_ORIGIN=$AI_PROOF_BASE" node "$AI_PROOF_OUT/server/rts-server.js"
    ;;
  allied-ui|roster-ui|coop-ui|online-ui)
    AI_BROWSER_ENV=(env \
      OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs \
      "OVF_AI_PROOF_DIST=$AI_PROOF_OUT/dist" "OVF_AI_PROOF_SERVER_DIST=$AI_PROOF_OUT/server" \
      "OVF_AI_PROOF_BUILD_ENVELOPE=$AI_PROOF_OUT/envelopes/build-web" \
      "OVF_AI_PROOF_SERVER_BUILD_ENVELOPE=$AI_PROOF_OUT/envelopes/build-server" \
      "OVF_AI_PROOF_BASE=$AI_PROOF_BASE" "OVF_ONLINE_BUILD_LABEL=$AI_SOURCE_PIN" \
      "OVF_AI_PROOF_ARTIFACTS=[\"$AI_PROOF_OUT/$AI_PHASE\"]")
    case "$AI_PHASE" in
      allied-ui)
        AI_BROWSER_ENV+=("OVF_ALLIED_BROWSER_PROOF_OUTPUT=$AI_PROOF_OUT/allied-ui")
        "${AI_BROWSER_ENV[@]}" node "$AI_PROOF_WRAPPER" "$AI_SOURCE_PIN" "$AI_PROOF_OUT/envelopes/allied-ui" -- \
          node scripts/verify_assembled_allied.mjs "$AI_PROOF_BASE" "$PWD"
        ;;
      roster-ui)
        AI_BROWSER_ENV+=("OVF_ROSTER_PROOF_DIR=$AI_PROOF_OUT/roster-ui")
        "${AI_BROWSER_ENV[@]}" node "$AI_PROOF_WRAPPER" "$AI_SOURCE_PIN" "$AI_PROOF_OUT/envelopes/roster-ui" -- \
          node scripts/verify_assembled_roster.mjs "$AI_PROOF_BASE" \
          docs/evidence/roster-coop-integration-20261001/roster/historical-source-session-v1.json
        ;;
      coop-ui)
        AI_BROWSER_ENV+=("OVF_COOP_PROOF_DIR=$AI_PROOF_OUT/coop-ui")
        "${AI_BROWSER_ENV[@]}" node "$AI_PROOF_WRAPPER" "$AI_SOURCE_PIN" "$AI_PROOF_OUT/envelopes/coop-ui" -- \
          node scripts/verify_assembled_coop.mjs "$AI_PROOF_BASE"
        ;;
      online-ui)
        AI_BROWSER_ENV+=("OVF_ONLINE_MAIN_PROOF_DIR=$AI_PROOF_OUT/online-ui")
        "${AI_BROWSER_ENV[@]}" node "$AI_PROOF_WRAPPER" "$AI_SOURCE_PIN" "$AI_PROOF_OUT/envelopes/online-ui" -- \
          node scripts/verify_assembled_online.mjs "$AI_PROOF_BASE"
        ;;
    esac
    ;;
  *) exit 2 ;;
esac
