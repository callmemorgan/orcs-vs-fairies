#!/usr/bin/env bash
# Reference commands only. Replace the pin after root freezes and releases execution.
# Do not source or run this file during the hold.
set -euo pipefail
SCENARIO_FINAL_PIN='ROOT_SUPPLIED_FULL_FREEZE'
SCENARIO_FINAL_CHECKOUT='/home/morgana/.codex/worktrees/scenario-final-rules401/orcs-vs-Fairies'
SCENARIO_FINAL_OUTPUT='/tmp/ovf-scenario-rules401-final-run1'
SCENARIO_BROWSER_OUTPUT='/tmp/ovf-scenario-canonical-rules401-run1'
SCENARIO_CONTROLS_OUTPUT='/tmp/ovf-scenario-controls-rules401-run1'
SCENARIO_SERVER_BUILD="$SCENARIO_BROWSER_OUTPUT/server"
SCENARIO_OWNED_DB="$SCENARIO_BROWSER_OUTPUT/data"
SCENARIO_FIXTURE_DIR="$SCENARIO_FINAL_OUTPUT/browser-fixtures"
SCENARIO_FIXTURE_MANIFEST="$SCENARIO_FIXTURE_DIR/fixtures.json"
SCENARIO_BASE_URL='http://127.0.0.2:5307/index.html'
SCENARIO_ORIGIN='http://127.0.0.2:5307'
SCENARIO_FAILURE_BUILD="$SCENARIO_BROWSER_OUTPUT/server-verifier-unavailable"
SCENARIO_BROWSER_PACKAGE="$SCENARIO_BROWSER_OUTPUT/package"
SCENARIO_UI_EXPORTS="$SCENARIO_BROWSER_OUTPUT/ui-exports.json"
SCENARIO_RECIPE_ROOT='/tmp/ovf-scenario-rules401-readiness.UCDZqh'

# New checkout and native output. Keep both retained af44 checkouts unchanged.
git -C /home/morgana/Projects/orcs-vs-Fairies worktree add --detach \
  "$SCENARIO_FINAL_CHECKOUT" "$SCENARIO_FINAL_PIN"
ln -s /home/morgana/Projects/orcs-vs-Fairies/node_modules "$SCENARIO_FINAL_CHECKOUT/node_modules"
bash "$SCENARIO_RECIPE_ROOT/run-native.sh" "$SCENARIO_FINAL_CHECKOUT" \
  "$SCENARIO_FINAL_PIN" 4.0.1 "$SCENARIO_FINAL_OUTPUT"

# Fixture preparation uses the genuine completed native outputs. This generator
# is supplied/reviewed separately; it must authenticate its new-pin module inputs.
node "$SCENARIO_RECIPE_ROOT/generate-browser-fixtures.mjs" \
  "$SCENARIO_FINAL_CHECKOUT" "$SCENARIO_FINAL_PIN" \
  "$SCENARIO_FINAL_OUTPUT" "$SCENARIO_FIXTURE_DIR"

# Use a same-pin admitted controls build if root supplies one. Otherwise prepare
# a fresh one using the canonical producer, retaining source/dist inventories.
cd -- "$SCENARIO_FINAL_CHECKOUT"
node scripts/controls-proof/prepare.mjs "$SCENARIO_FINAL_PIN" "$SCENARIO_CONTROLS_OUTPUT"
mkdir -- "$SCENARIO_BROWSER_OUTPUT"
mkdir -- "$SCENARIO_OWNED_DB"
node scripts/build-server.mjs "$SCENARIO_SERVER_BUILD" \
  > "$SCENARIO_BROWSER_OUTPUT/server-build.log" 2>&1
ln -s "$SCENARIO_FINAL_CHECKOUT/node_modules" "$SCENARIO_SERVER_BUILD/node_modules"

# Run this foreground command in its own owned exec session. The wrapper sets
# frozen cwd/origin again, takes the exclusive DB lock and records PID/bundles.
bash "$SCENARIO_RECIPE_ROOT/start-server.sh" "$SCENARIO_FINAL_CHECKOUT" \
  "$SCENARIO_FINAL_PIN" "$SCENARIO_SERVER_BUILD" "$SCENARIO_CONTROLS_OUTPUT/dist" \
  "$SCENARIO_OWNED_DB" "$SCENARIO_BROWSER_OUTPUT/intact-server" intact

# Run pack after intact-server health and served-byte authentication, before
# the first CUA import. It supplies the extracted editorMapPackage fixture.
node "$SCENARIO_FINAL_CHECKOUT/scripts/scenarios/main-browser-proof.mjs" pack "$SCENARIO_FINAL_CHECKOUT" \
  "$SCENARIO_FINAL_PIN" "$SCENARIO_BASE_URL" "$SCENARIO_FIXTURE_MANIFEST" \
  "$SCENARIO_CONTROLS_OUTPUT/build-manifest.json" "$SCENARIO_BROWSER_PACKAGE"
# Perform primary CUA imports/gameplay now; preserve every actual raw download.

# Real verifier-unavailable/retry case, later during the visible reward flow.
# First stop the owned intact process gracefully and record its exit. These are
# separate foreground tool sessions; never invoke while the prior writer lives.
mkdir -- "$SCENARIO_FAILURE_BUILD"
cp -- "$SCENARIO_SERVER_BUILD/rts-server.js" "$SCENARIO_SERVER_BUILD/canonical-campaign.mjs" "$SCENARIO_FAILURE_BUILD/"
ln -s "$SCENARIO_FINAL_CHECKOUT/node_modules" "$SCENARIO_FAILURE_BUILD/node_modules"
cmp -- "$SCENARIO_SERVER_BUILD/rts-server.js" "$SCENARIO_FAILURE_BUILD/rts-server.js"
cmp -- "$SCENARIO_SERVER_BUILD/canonical-campaign.mjs" "$SCENARIO_FAILURE_BUILD/canonical-campaign.mjs"
test ! -e "$SCENARIO_FAILURE_BUILD/campaign-runtime.mjs"
bash "$SCENARIO_RECIPE_ROOT/start-server.sh" "$SCENARIO_FINAL_CHECKOUT" \
  "$SCENARIO_FINAL_PIN" "$SCENARIO_FAILURE_BUILD" "$SCENARIO_CONTROLS_OUTPUT/dist" \
  "$SCENARIO_OWNED_DB" "$SCENARIO_BROWSER_OUTPUT/unavailable-server" unavailable
# After the UI captures true503/no award/pending end/retry availability, stop the
# owned unavailable process gracefully and record its exit before this restart.
bash "$SCENARIO_RECIPE_ROOT/start-server.sh" "$SCENARIO_FINAL_CHECKOUT" \
  "$SCENARIO_FINAL_PIN" "$SCENARIO_SERVER_BUILD" "$SCENARIO_CONTROLS_OUTPUT/dist" \
  "$SCENARIO_OWNED_DB" "$SCENARIO_BROWSER_OUTPUT/restored-server" restored

# After all CUA cases and raw downloads are complete, fill the retained
# export manifest before auditing. Preserve every failed attempt unchanged.
cp -- "$SCENARIO_BROWSER_PACKAGE/exports-template.json" "$SCENARIO_UI_EXPORTS"
node "$SCENARIO_FINAL_CHECKOUT/scripts/scenarios/main-browser-proof.mjs" audit "$SCENARIO_BROWSER_PACKAGE" "$SCENARIO_UI_EXPORTS"
node "$SCENARIO_BROWSER_PACKAGE/helper.mjs" verify "$SCENARIO_BROWSER_PACKAGE"

# Separate authoritative HTTP reward proof: input is the actual completed new-pin
# Orc profile emitted by native primary route or the later genuine browser finale.
SCENARIO_COMPLETED_ORC_PROFILE="$(python3 - "$SCENARIO_FINAL_OUTPUT" "$SCENARIO_FINAL_PIN" <<'PYPROFILE'
import hashlib,json,pathlib,sys
root=pathlib.Path(sys.argv[1]).resolve()
admission=json.loads((root/'native-admission.json').read_text())
assert admission['status']=='passed' and admission['simulationRevision']=='4.0.1'
assert admission['sourceCommit']==sys.argv[2]
primary_raw=(root/'primary.json').read_bytes()
primary_receipt=admission['artifacts'][str((root/'primary.json').resolve())]
assert hashlib.sha256(primary_raw).hexdigest()==primary_receipt['sha256'] and len(primary_raw)==primary_receipt['bytes']
primary=json.loads(primary_raw)
assert primary['sourceCommit']==admission['sourceCommit']
profile=next(item for item in primary['profiles'] if item['campaignId']=='campaign-orcs')
entry=admission['artifacts'][str(pathlib.Path(profile['profilePath']).resolve())]
retained=root/entry['retainedPath'];data=retained.read_bytes()
assert hashlib.sha256(data).hexdigest()==entry['sha256']
owner=json.loads(data)
assert owner['campaignId']=='campaign-orcs' and owner['simulationRevision']=='4.0.1'
assert len(owner['history'])==4 and owner['active'] is None
print(retained)
PYPROFILE
)"
cd -- "$SCENARIO_FINAL_CHECKOUT"
node "$SCENARIO_FINAL_CHECKOUT/scripts/scenarios/prove-campaign-cosmetic-reward.mjs" "$SCENARIO_FINAL_PIN" \
  "$SCENARIO_COMPLETED_ORC_PROFILE" "$SCENARIO_FINAL_OUTPUT/reward-http"
