The final scenario proof must run from the committed combined source after the
root freezes SAVE4, simulation rules and content identity. The earlier native
proofs at `e5cf87e` are SAVE3 evidence. Keep them unchanged.

Set the pin to the commit supplied by the root and choose a new absolute output
directory. The commands below are preparation only; they have not run against
the final source.

```sh
SCENARIO_PIN='<root final commit>'
SCENARIO_PROOF_ROOT='/absolute/path/to/new/scenario-final-proof'
test "$(git rev-parse HEAD)" = "$SCENARIO_PIN"
git diff --quiet HEAD -- src scripts/scenarios tests/fixtures
test ! -e "$SCENARIO_PROOF_ROOT"
mkdir -p "$SCENARIO_PROOF_ROOT/bundles"

npx esbuild scripts/scenarios/prove-campaigns.ts --bundle --platform=node --format=esm --outfile="$SCENARIO_PROOF_ROOT/bundles/prove-campaigns.mjs"
npx esbuild scripts/scenarios/prove-alternate-profiles.ts --bundle --platform=node --format=esm --outfile="$SCENARIO_PROOF_ROOT/bundles/prove-alternate-profiles.mjs"
npx esbuild scripts/scenarios/prove-conquest-review.ts --bundle --platform=node --format=esm --outfile="$SCENARIO_PROOF_ROOT/bundles/prove-conquest-review.mjs"
npx esbuild scripts/scenarios/prove-persistent-army.ts --bundle --platform=node --format=esm --outfile="$SCENARIO_PROOF_ROOT/bundles/prove-persistent-army.mjs"

node "$SCENARIO_PROOF_ROOT/bundles/prove-campaigns.mjs" all "$SCENARIO_PROOF_ROOT/all30.json" > "$SCENARIO_PROOF_ROOT/all30.log" 2>&1
node "$SCENARIO_PROOF_ROOT/bundles/prove-alternate-profiles.mjs" "$SCENARIO_PROOF_ROOT/primary.json" primary > "$SCENARIO_PROOF_ROOT/primary.log" 2>&1
node "$SCENARIO_PROOF_ROOT/bundles/prove-alternate-profiles.mjs" "$SCENARIO_PROOF_ROOT/alternate.json" alternate > "$SCENARIO_PROOF_ROOT/alternate.log" 2>&1
node "$SCENARIO_PROOF_ROOT/bundles/prove-conquest-review.mjs" corrected "$SCENARIO_PROOF_ROOT/conquest.json" "$SCENARIO_PROOF_ROOT/conquest-journals" "$SCENARIO_PIN" > "$SCENARIO_PROOF_ROOT/conquest.log" 2>&1
node "$SCENARIO_PROOF_ROOT/bundles/prove-persistent-army.mjs" "$SCENARIO_PROOF_ROOT/persistent-army" > "$SCENARIO_PROOF_ROOT/persistent-army.log" 2>&1

npx vitest run tests/scenario-recording-compatibility.test.ts tests/profile-rules-migration.test.ts tests/session-scenario-profile.test.ts tests/scenario-core-binding.test.ts tests/scenario-content.test.ts tests/scenario-tools-readonly.test.ts tests/scenario-campaign-host.test.ts tests/scenario-demo-compatibility.test.ts tests/authored-commanders.test.ts tests/campaign-persistent-army.test.ts tests/campaign.test.ts tests/conquest.test.ts > "$SCENARIO_PROOF_ROOT/tests.log" 2>&1
test "$(git rev-parse HEAD)" = "$SCENARIO_PIN"
git diff --quiet HEAD -- src scripts/scenarios tests/fixtures
```

Run each line with shell error handling enabled, retaining the first failed
output. The campaign generators also save their full recordings and profiles
under `work/campaign-content`; retain those referenced files and record their
hashes. The persistent-army regression runs the proof twice and compares its
deterministic fingerprint. Record the final save version, simulation revision,
content base hash, source commit, source hashes and bundle hashes with the output.

The main browser verification belongs to the final production build. Use the
canonical menu to start a campaign, issue an ordinary HUD command, save it through
the ordinary save panel, reload it, and inspect the retained strategic profile
and journal. Complete a mission from a freshly verified final journal and check
the result label and reason. Exercise mission, objective, session and native
dialog pause restoration, then photo mode. Repeat historical import checks
through both the mission/profile controls and ordinary session saves. An
incompatible scene must keep its tick, outcome, profile and exported historical
recording unchanged while reset, commands and progression remain unavailable.
The root's newer async import fences and objective modal guards must be included.

Wrapper migration checks should use the genuine files in
`tests/fixtures/scenario-save3-3.2` and the preserved native SAVE3 session in
`docs/evidence/campaigns/native-save3-20261001`. Do not recapture those fixtures
with the new writer. A legacy scenario recording retains its original initial
save, format, command prefix, checksum version and final checksum. Its raw
checkpoint checksum must still match, and verification or continued recording
must reject it before stepping. Imported checkpoints and generic scenario
bindings may load a migrated battlefield for inspection while their missing or
old simulation pin remains old. Capture must not grant a current rules pin.

Historical campaign and conquest profiles retain recorded outcomes, branches,
armies, casualties, equipment, artifact ownership and diplomacy. Empty profiles
also remain incompatible when their outer rules pin is missing. Every writer,
claim, reset and resume path must reject incompatible history before shortcuts
or duplicate-result handling. Validate generic session ownership against the
matching checkpoint without replaying historical recordings. Current SAVE4
profiles and generic session files must still checkpoint, reload, continue the
same journal, apply a verified result once and preserve native carryover.

Include a pinned Lantern definition in a scenario checkpoint and ordinary bound
session. Authenticate the old content bundle before migration, preserve the raw
historical recording, and check that the migrated definition and battlefield
refer to the same admitted content identity. Recheck older actor health,
footprints and owned artifact references against their admitted historical data
so current balance changes do not erase valid inspection data. A fresh SAVE4
Lantern recording should resolve the same-role alternative and replay normally.
Also retain the width-16 authored-map save regression after all map integrations.
