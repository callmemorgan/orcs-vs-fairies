# Final world and content proof

Run these checks in an isolated checkout at the final reviewed source pin. The
drivers authenticate source, public assets, build configuration and proof inputs
against that commit. Preparation records the compiler inputs and bundle hashes.
The current unbundled launcher checks the retained preparation receipt, rebuilds
the selected module from authenticated inputs, and compares its bytes before
execution. It executes that private rebuild and retains a launcher-written
`launches/*/binding.json` receipt. Commit and digest labels alone cannot authenticate a stale bundle.
Historical SAVE3 captures remain migration controls; they do not certify SAVE4.

The world browser drivers retain the existing menu, traversal, village, den,
relic, fire, bridge, calendar and thaw assertions. They now retain current native
exports and build reports. Native verification compares the complete `.game`
envelope after decode, replay and 20 continued steps, then replays the extended
history. The CLI driver compares ordinary traversal and restored continuation
against the same native simulation, and verifies its terminal log.

## Prepare and run world checks

Set `OVF_PRODUCTION_SOURCE_COMMIT` to the full final SHA and
`OVF_PLAYWRIGHT_MODULE` to the installed Playwright module when it is outside the
project. Choose a new `world_proof_out` directory and an unused strict preview
port. Port 4173 belongs to the user's preview and must remain untouched.

```sh
export OVF_PRODUCTION_SOURCE_COMMIT="$(git rev-parse HEAD)"
world_proof_out="$PWD/work/verification/world-save4-final"
mkdir -p "$world_proof_out/logs"
export OVF_WORLD_MODULES="$world_proof_out/modules"
npm run build
npm run build:cli
npm run build:server
npm run build:tournament
node scripts/world/prepare.mjs "$OVF_PRODUCTION_SOURCE_COMMIT" "$OVF_WORLD_MODULES" > "$world_proof_out/logs/prepare-modules.json"
export OVF_WORLD_PREPARATION_SHA256="$(node -p "JSON.parse(require('node:fs').readFileSync(process.argv[1],'utf8')).preparationSha256" "$world_proof_out/logs/prepare-modules.json")"
node scripts/world/run-native.mjs "$OVF_PRODUCTION_SOURCE_COMMIT" "$OVF_WORLD_MODULES" "$OVF_WORLD_PREPARATION_SHA256" generate "$world_proof_out/fixtures"
node scripts/world/run-native.mjs "$OVF_PRODUCTION_SOURCE_COMMIT" "$OVF_WORLD_MODULES" "$OVF_WORLD_PREPARATION_SHA256" cli "$world_proof_out/cli"
npm run preview -- --port 5391 --strictPort
```

Run the browser commands in another terminal while the owned preview is alive.

```sh
node scripts/verify_world.mjs http://127.0.0.1:5391 "$world_proof_out/browser"
node scripts/verify_world_actions.mjs http://127.0.0.1:5391 "$world_proof_out/actions" "$world_proof_out/fixtures"
```

Run the authenticated native launcher on each of the four generated
fixtures, `cli/cli-world-session.json`, the four `browser/*-world-save.json`
downloads, the four `actions/native-*-imported.json` downloads, and
`actions/{world-browser-save,surface-world-save,thaw-world-save}.json`. Native bug
report sessions also contain the matching current replay, and their build ID must
equal the Vite source fingerprint. Stop the owned preview before collecting the
final log hashes. Keep logs outside feature output directories. Each browser or
fixture output must be new or empty, including on retries. Modules have a separate
fresh preparation directory and cannot contain extra files.

```sh
node scripts/world/run-native.mjs "$OVF_PRODUCTION_SOURCE_COMMIT" "$OVF_WORLD_MODULES" "$OVF_WORLD_PREPARATION_SHA256" native INPUT_JSON NEW_REPORT_JSON
```

The launcher's fresh compilation also rejects a stale executable with current
labels and rewritten sidecars. It authenticates its own unbundled helpers against
Git before importing them, and checks source and prepared bytes again after the
child exits. Each successful launch retains its own binding receipt beside the
prepared modules; native reports record the expected hash supplied by the launcher.
Retain the original `logs/prepare-modules.json`; changing its recorded
receipt hash would lose the preparation chain. Direct execution of a module is
not an accepted proof command.

The focused native coverage is reproducible with:

```sh
NEUTRAL_PROOF_OUTPUT="$world_proof_out/neutral-runtime-proof.json" npx vitest run tests/world-interruptions.test.ts tests/environment.test.ts tests/world-map.test.ts tests/neutral-world.test.ts tests/neutral-world-integration.test.ts tests/navigation.test.ts tests/world-combined.test.ts tests/allied-world-combined.test.ts tests/team-world-observation.test.ts tests/economy-world-integration.test.ts tests/joint-world-ignition.test.ts tests/specialist-world-integration.test.ts
```

These tests cover weather and night modifiers, high ground, bridge and thaw
interruptions, resource conservation and finite rewards, custom cavern production
and recruitment, planning and delivery, filtered authoritative views, allied
levels, specialist effects and paid incendiary impacts. The parent integration
owns the full suite and combined online browser acceptance.

## Run mod and editor checks

Use the same frozen checkout and production build. Choose distinct fresh output
directories beneath `world_proof_out`.

```sh
node scripts/world/run-native.mjs "$OVF_PRODUCTION_SOURCE_COMMIT" "$OVF_WORLD_MODULES" "$OVF_WORLD_PREPARATION_SHA256" mod-fixture "$world_proof_out/mod-fixtures"
OVF_MOD_FIXTURE_DIR="$world_proof_out/mod-fixtures" OVF_MOD_EVIDENCE_DIR="$world_proof_out/mods" node scripts/verify_mods.mjs http://127.0.0.1:5391
OVF_EDITOR_EVIDENCE_DIR="$world_proof_out/map" OVF_EDITOR_PLAY=1 node scripts/verify_editors.mjs http://127.0.0.1:5391
OVF_EDITOR_EVIDENCE_DIR="$world_proof_out/flat" node scripts/verify_scenario_editor.mjs http://127.0.0.1:5391
OVF_EDITOR_EVIDENCE_DIR="$world_proof_out/layered" OVF_EDITOR_MAP_FIXTURE="$world_proof_out/map/two-level-map.json" node scripts/verify_layered_scenario_editor.mjs http://127.0.0.1:5391
OVF_EDITOR_EVIDENCE_DIR="$world_proof_out/community-map" node scripts/verify_community_browser.mjs
OVF_EDITOR_EVIDENCE_DIR="$world_proof_out/community-mod" node scripts/verify_community_mod.mjs
```

The community drivers own temporary loopback servers, data directories and
browser accounts. They exercise publication, installation, restart and immutable
old revisions with the production application. They do not use the user's
preview. Pass `OVF_COMMUNITY_MOD_FIXTURE` and exact dependency file paths through
`OVF_COMMUNITY_MOD_DEPENDENCIES` for a second package proof when required.

Run the native verifier on the mod browser's `browser-save.json` and
`browser-replay-final.save.json`, the map editor's `edited-map-in-play.save.json`,
the flat scenario's `convoy-playing.save.json`, the layered scenario's
`cave-scenario-playing.save.json`, the community mod's
`community-mod-trained.save.json`, and every community map
`browser-replay-*.save.json` and `browser-played-complete.save.json` download.
Content package engine version remains 3. Save version 4 and simulation revision
4.0.2 belong to current native saves and recordings.

Preparation syntax, bundle and lightweight native checks do not establish final
browser acceptance. Keep failure captures and use a new output directory for each
retry. A final result requires all commands to pass at the approved source pin,
the retained screenshots to be inspected, and the parent to review fresh native
and browser evidence.
