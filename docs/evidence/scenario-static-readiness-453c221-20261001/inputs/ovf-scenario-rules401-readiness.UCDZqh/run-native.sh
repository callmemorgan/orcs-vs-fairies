#!/usr/bin/env bash
# Preparation recipe only. Run after root supplies its combined freeze and releases CPU.
set -euo pipefail
SCENARIO_SOURCE="${1:?Pass the isolated frozen source checkout}"
SCENARIO_PIN="${2:?Pass the full combined frozen commit}"
SCENARIO_RULES="${3:?Pass the approved simulation revision}"
SCENARIO_PROOF_ROOT="${4:?Pass a new absolute proof output directory}"
SCENARIO_RECIPE_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
test "${SCENARIO_SOURCE:0:1}" = '/'
test "${SCENARIO_PROOF_ROOT:0:1}" = '/'
test "$SCENARIO_RULES" = '4.0.1'
cd -- "$SCENARIO_SOURCE"
test "$(git rev-parse HEAD)" = "$SCENARIO_PIN"
test ! -e "$SCENARIO_PROOF_ROOT"
mkdir -p -- "$(dirname -- "$SCENARIO_PROOF_ROOT")"
mkdir -- "$SCENARIO_PROOF_ROOT"
mkdir -- "$SCENARIO_PROOF_ROOT/bundles" "$SCENARIO_PROOF_ROOT/test-temporary"
cp -- "$SCENARIO_RECIPE_ROOT/run-native.sh" "$SCENARIO_PROOF_ROOT/executed-recipe.sh"
cp -- "$SCENARIO_RECIPE_ROOT/authenticate.py" "$SCENARIO_PROOF_ROOT/authenticate.py"
cp -- "$SCENARIO_RECIPE_ROOT/check-results.py" "$SCENARIO_PROOF_ROOT/check-results.py"
cp -- "$SCENARIO_RECIPE_ROOT/timed.py" "$SCENARIO_PROOF_ROOT/timed.py"
SCENARIO_PHASE='source authentication before'
trap 'printf "failed phase: %s; exit: %s\n" "$SCENARIO_PHASE" "$?" > "$SCENARIO_PROOF_ROOT/first-failure.txt"' ERR
python "$SCENARIO_RECIPE_ROOT/timed.py" "$SCENARIO_PROOF_ROOT/source-before.timing.json" \
  python "$SCENARIO_RECIPE_ROOT/authenticate.py" "$SCENARIO_PIN" "$SCENARIO_RULES" "$SCENARIO_PROOF_ROOT/source-before.json"
SCENARIO_PHASE='bundle proof runners'
for SCENARIO_ENTRY in prove-campaigns prove-alternate-profiles prove-conquest-review prove-persistent-army; do
  python "$SCENARIO_RECIPE_ROOT/timed.py" "$SCENARIO_PROOF_ROOT/bundles/$SCENARIO_ENTRY.build.timing.json" \
    node_modules/.bin/esbuild "scripts/scenarios/$SCENARIO_ENTRY.ts" \
    --bundle --platform=node --format=esm \
    --metafile="$SCENARIO_PROOF_ROOT/bundles/$SCENARIO_ENTRY.meta.json" \
    --outfile="$SCENARIO_PROOF_ROOT/bundles/$SCENARIO_ENTRY.mjs" \
    > "$SCENARIO_PROOF_ROOT/bundles/$SCENARIO_ENTRY.build.log" 2>&1
done
SCENARIO_PHASE='source archive'
python "$SCENARIO_RECIPE_ROOT/timed.py" "$SCENARIO_PROOF_ROOT/source-bundle-create.timing.json" \
  git bundle create "$SCENARIO_PROOF_ROOT/source.bundle" HEAD \
  > "$SCENARIO_PROOF_ROOT/source-bundle-create.log" 2>&1
git bundle verify "$SCENARIO_PROOF_ROOT/source.bundle" \
  > "$SCENARIO_PROOF_ROOT/source-bundle-verify.log" 2>&1
SCENARIO_PHASE='all 30 missions'
python "$SCENARIO_RECIPE_ROOT/timed.py" "$SCENARIO_PROOF_ROOT/all30.timing.json" \
  node "$SCENARIO_PROOF_ROOT/bundles/prove-campaigns.mjs" all "$SCENARIO_PROOF_ROOT/all30.json" \
  > "$SCENARIO_PROOF_ROOT/all30.log" 2>&1
SCENARIO_PHASE='primary connected routes'
python "$SCENARIO_RECIPE_ROOT/timed.py" "$SCENARIO_PROOF_ROOT/primary.timing.json" \
  node "$SCENARIO_PROOF_ROOT/bundles/prove-alternate-profiles.mjs" "$SCENARIO_PROOF_ROOT/primary.json" primary \
  > "$SCENARIO_PROOF_ROOT/primary.log" 2>&1
SCENARIO_PHASE='alternate connected routes'
python "$SCENARIO_RECIPE_ROOT/timed.py" "$SCENARIO_PROOF_ROOT/alternate.timing.json" \
  node "$SCENARIO_PROOF_ROOT/bundles/prove-alternate-profiles.mjs" "$SCENARIO_PROOF_ROOT/alternate.json" alternate \
  > "$SCENARIO_PROOF_ROOT/alternate.log" 2>&1
SCENARIO_PHASE='five conquest journals'
python "$SCENARIO_RECIPE_ROOT/timed.py" "$SCENARIO_PROOF_ROOT/conquest.timing.json" \
  node "$SCENARIO_PROOF_ROOT/bundles/prove-conquest-review.mjs" corrected "$SCENARIO_PROOF_ROOT/conquest.json" \
  "$SCENARIO_PROOF_ROOT/conquest-journals" "$SCENARIO_PIN" > "$SCENARIO_PROOF_ROOT/conquest.log" 2>&1
SCENARIO_PHASE='earned persistent army and equipment'
python "$SCENARIO_RECIPE_ROOT/timed.py" "$SCENARIO_PROOF_ROOT/persistent-army.timing.json" \
  node "$SCENARIO_PROOF_ROOT/bundles/prove-persistent-army.mjs" "$SCENARIO_PROOF_ROOT/persistent-army" \
  > "$SCENARIO_PROOF_ROOT/persistent-army.log" 2>&1
SCENARIO_PHASE='scenario regression and deterministic persistent army checks'
TMPDIR="$SCENARIO_PROOF_ROOT/test-temporary" python "$SCENARIO_RECIPE_ROOT/timed.py" "$SCENARIO_PROOF_ROOT/tests.timing.json" \
  node_modules/.bin/vitest run --maxWorkers=1 --no-file-parallelism \
  tests/scenario-recording-compatibility.test.ts tests/scenario-save4-wrapper-migration.test.ts \
  tests/scenario-historical-content.test.ts tests/profile-rules-migration.test.ts \
  tests/session-scenario-profile.test.ts tests/scenario-core-binding.test.ts \
  tests/scenario-content.test.ts tests/scenario-tools-readonly.test.ts \
  tests/scenario-campaign-host.test.ts tests/scenario-demo-compatibility.test.ts \
  tests/authored-commanders.test.ts tests/campaign-persistent-army.test.ts \
  tests/campaign.test.ts tests/conquest.test.ts tests/scenario-campaign-reward.test.ts \
  > "$SCENARIO_PROOF_ROOT/tests.log" 2>&1
SCENARIO_PHASE='source authentication after'
python "$SCENARIO_RECIPE_ROOT/timed.py" "$SCENARIO_PROOF_ROOT/source-after.timing.json" \
  python "$SCENARIO_RECIPE_ROOT/authenticate.py" "$SCENARIO_PIN" "$SCENARIO_RULES" "$SCENARIO_PROOF_ROOT/source-after.json"
cmp -- "$SCENARIO_PROOF_ROOT/source-before.json" "$SCENARIO_PROOF_ROOT/source-after.json"
SCENARIO_PHASE='retained result and source-binding audit'
python "$SCENARIO_RECIPE_ROOT/timed.py" "$SCENARIO_PROOF_ROOT/native-admission.timing.json" \
  python "$SCENARIO_RECIPE_ROOT/check-results.py" "$SCENARIO_PROOF_ROOT"
trap - ERR
printf 'Native scenario proof completed at %s; evidence: %s\n' "$SCENARIO_PIN" "$SCENARIO_PROOF_ROOT"
