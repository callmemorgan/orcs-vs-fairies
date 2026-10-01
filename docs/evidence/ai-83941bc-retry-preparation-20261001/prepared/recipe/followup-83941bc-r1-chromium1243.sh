#!/usr/bin/env bash
set -euo pipefail

# Held recipes. Root must assign each phase before invocation.
AI_PHASE=${1:?Choose build-web, build-server, serve, coop-ui, or online-ui}
AI_SOURCE_PIN=83941bc80ce9ec08840b0645d9b33e8018d5309a
AI_PROOF_OUT=work/ai-save401-final-83941bc-r1
AI_PROOF_WRAPPER=/home/morgana/.codex/worktrees/assembled-allied-ai/ai-83941bc-retry-prep-r1/recipe/proof-envelope.mjs
AI_PROOF_BASE=http://127.0.0.1:5371
AI_PLAYWRIGHT_ADAPTER=/home/morgana/.codex/worktrees/assembled-allied-ai/ai-83941bc-retry-prep-r1/recipe/playwright-chromium-1243.mjs
AI_PLAYWRIGHT_ADAPTER_SHA256=7fe266503ffb4a65da331e6ae3fa7ffa248f805595dcb5e417a7669fc73bbd6d
AI_PLAYWRIGHT_INDEX=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
AI_PLAYWRIGHT_INDEX_SHA256=a0f5715ea22354f922791a9c53dc012d5d5c067ff9cc4cd35ffb7cd272071a9f
AI_PLAYWRIGHT_PACKAGE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json
AI_PLAYWRIGHT_PACKAGE_SHA256=ca170ec143a88ed3043ac953eb3b2377b2b97304104f4e1e23316684ce2c35af
AI_PLAYWRIGHT_VERSION=1.62.1
AI_CHROMIUM_EXECUTABLE=/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome
AI_CHROMIUM_EXECUTABLE_SHA256=8c599d43aec53f2460a31ae2f4af6bd863f8258b34ff519564bc5d4726bfaa1e
AI_OWNED_CHECKOUT=/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies
[[ "$PWD" == "$AI_OWNED_CHECKOUT" ]] || exit 2
[[ "$(git rev-parse HEAD)" == "$AI_SOURCE_PIN" ]] || exit 2
case "$AI_PHASE" in build-web|build-server|serve|coop-ui|online-ui) ;; *) exit 2 ;; esac

python3 - "$AI_PROOF_WRAPPER" <<'HASH_CHECK'
from pathlib import Path
import hashlib,sys
assert hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest()=='bb8c80fc33ca6a25e044a5df60350030bb2177461d265025b9bfcffcdc3a1cd2'
HASH_CHECK

python3 - "$AI_PLAYWRIGHT_ADAPTER" "$AI_PLAYWRIGHT_INDEX" "$AI_PLAYWRIGHT_PACKAGE" "$AI_CHROMIUM_EXECUTABLE" <<'LAUNCHER_HASH_CHECK'
from pathlib import Path
import hashlib,json,sys
expected=(
 '7fe266503ffb4a65da331e6ae3fa7ffa248f805595dcb5e417a7669fc73bbd6d',
 'a0f5715ea22354f922791a9c53dc012d5d5c067ff9cc4cd35ffb7cd272071a9f',
 'ca170ec143a88ed3043ac953eb3b2377b2b97304104f4e1e23316684ce2c35af',
 '8c599d43aec53f2460a31ae2f4af6bd863f8258b34ff519564bc5d4726bfaa1e',
)
for path,digest in zip(sys.argv[1:],expected):
 assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==digest
assert json.loads(Path(sys.argv[3]).read_text())['version']=='1.62.1'
LAUNCHER_HASH_CHECK

case "$AI_PHASE" in
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
  coop-ui|online-ui)
    AI_BROWSER_ENV=(env \
      "OVF_PLAYWRIGHT_MODULE=$AI_PLAYWRIGHT_ADAPTER" \
      "OVF_AI_PROOF_PLAYWRIGHT_ADAPTER_SHA256=$AI_PLAYWRIGHT_ADAPTER_SHA256" \
      "OVF_AI_PROOF_PLAYWRIGHT_INDEX=$AI_PLAYWRIGHT_INDEX" \
      "OVF_AI_PROOF_PLAYWRIGHT_INDEX_SHA256=$AI_PLAYWRIGHT_INDEX_SHA256" \
      "OVF_AI_PROOF_PLAYWRIGHT_PACKAGE=$AI_PLAYWRIGHT_PACKAGE" \
      "OVF_AI_PROOF_PLAYWRIGHT_PACKAGE_SHA256=$AI_PLAYWRIGHT_PACKAGE_SHA256" \
      "OVF_AI_PROOF_PLAYWRIGHT_VERSION=$AI_PLAYWRIGHT_VERSION" \
      "OVF_AI_PROOF_CHROMIUM_EXECUTABLE=$AI_CHROMIUM_EXECUTABLE" \
      "OVF_AI_PROOF_CHROMIUM_EXECUTABLE_SHA256=$AI_CHROMIUM_EXECUTABLE_SHA256" \
      "OVF_AI_PROOF_DIST=$AI_PROOF_OUT/dist" "OVF_AI_PROOF_SERVER_DIST=$AI_PROOF_OUT/server" \
      "OVF_AI_PROOF_BUILD_ENVELOPE=$AI_PROOF_OUT/envelopes/build-web" \
      "OVF_AI_PROOF_SERVER_BUILD_ENVELOPE=$AI_PROOF_OUT/envelopes/build-server" \
      "OVF_AI_PROOF_BASE=$AI_PROOF_BASE" "OVF_ONLINE_BUILD_LABEL=$AI_SOURCE_PIN" \
      "OVF_AI_PROOF_ARTIFACTS=[\"$AI_PROOF_OUT/$AI_PHASE\"]")
    case "$AI_PHASE" in
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
