# Final economy native rerun recipe

Prepared from root checkpoint `5c6a02219b723102124f9775040a78b205a52a7d` and the completed intermediate economy evidence. This remains a preparation document for the final native rerun. No final fixture or browser run has executed. Targeted runtime tests now pass against root checkpoint `4e737ea58bd094de1b65792e5a0c2b228b797e87`, SAVE4 and simulation revision 4.0.0; their separate evidence is in `settlement-runtime-gap-20261001`. Root must still supply the final source commit and rules revision after the remaining reviews are complete. Neither preparation checkpoint `5c6a022` nor faction cleanup `65839df` is that freeze; both contain save version 3 and revision 3.2.0.

The existing generator exports through the source's `createSessionFile`, so rebundling it from the frozen source produces the current save schema. It must succeed through paid public construction and caravan commands and final save validation. Do not change a historical fixture's version field. Session wrapper version 1, game save version 4, replay wrapper version 1, replay checksum/save version 4, simulation revision and content engine version are separate values. Record the actual final contracts rather than changing all of them to 4.

Use the owned isolated checkout for all builds, fixture generation and evidence. The root checkout stays read-only. Include the driver addition, `scripts/verify_settlement_runtime_ui.mjs`, in the final tree before root declares the freeze. Once root supplies that pin, synchronize this checkout under root's coordination; verify HEAD and clean tracked source before proceeding. The prior economy and modal verifiers are unchanged, so their intermediate artifact hashes remain valid at their original checkpoint. The historical `audit_economy_integration.py` checks `cf5cb85`, SAVE3, revision 3.2.0 and 872/47; it is not a final SAVE4 audit.

## Freeze and build

Set `OVF_FINAL_SOURCE_COMMIT` to the full root-approved SHA and `OVF_EXPECT_SIMULATION_REVISION` to the approved final revision. Choose a new absolute `OVF_FINAL_EVIDENCE` directory and a free local preview URL/port. Use the bundled Playwright module through `OVF_PLAYWRIGHT_MODULE`. These variables must be supplied at the freeze; no prospective SHA or revision is invented here.

```sh
test "$(git rev-parse HEAD)" = "$OVF_FINAL_SOURCE_COMMIT"
test -z "$(git status --porcelain --untracked-files=no)"
mkdir -p "$OVF_FINAL_EVIDENCE"
git rev-parse HEAD > "$OVF_FINAL_EVIDENCE/source-commit.txt"
npm run build > "$OVF_FINAL_EVIDENCE/browser-build.log" 2>&1
npm run build:cli > "$OVF_FINAL_EVIDENCE/cli-build.log" 2>&1
npm run build:server > "$OVF_FINAL_EVIDENCE/server-build.log" 2>&1
npm run build:tournament > "$OVF_FINAL_EVIDENCE/tournament-build.log" 2>&1
npx --no-install esbuild scripts/economy/generate-scenario.ts --bundle --platform=node --format=esm --loader:.svg=text --outfile="$OVF_FINAL_EVIDENCE/generate-scenario.mjs" > "$OVF_FINAL_EVIDENCE/scenario-generation.log" 2>&1
node "$OVF_FINAL_EVIDENCE/generate-scenario.mjs" "$OVF_FINAL_EVIDENCE/browser-scenario.json" --mixed >> "$OVF_FINAL_EVIDENCE/scenario-generation.log" 2>&1
```

Run the commands separately and stop on failure; do not let a later success hide an earlier nonzero exit. Serve this newly built `dist` from a strict free preview port in the same isolated checkout. Port 5393's intermediate server and `cf5cb85` build are historical and must not be reused as the final application.

Before the browser, inspect the generated fixture. `game.version` must be 4 and its pinned content must be the final bundle. It must contain the paid original/expansion HQs, an owned stocked warehouse, a hostile warehouse, completed extractor, three empty caravans, five surface workers, cavern worker, the explicit fairy engineer and commander, visible/open offers and separate cavern resources. Pinned specialists are required for the final 25-check scope; their check is conditional in the existing driver. The terrain, stock, salvage and offers are authored setup, while construction and recruitment are public paid commands. Keep the generator log and full fixture; a rejected final validation is a finding, not a reason to relabel the data.

## Native and runtime commands

Run all three browser drivers against the same frozen preview, using separate new directories:

```sh
OVF_PLAYWRIGHT_MODULE="$OVF_PLAYWRIGHT_MODULE" node scripts/verify_economy_ui.mjs "$OVF_FINAL_PREVIEW" "$OVF_FINAL_EVIDENCE/browser-scenario.json" "$OVF_FINAL_EVIDENCE/browser" > "$OVF_FINAL_EVIDENCE/browser-proof.log" 2>&1
OVF_PLAYWRIGHT_MODULE="$OVF_PLAYWRIGHT_MODULE" OVF_PRODUCTION_SOURCE_COMMIT="$OVF_FINAL_SOURCE_COMMIT" node scripts/verify_economy_combined_ui.mjs "$OVF_FINAL_PREVIEW" "$OVF_FINAL_EVIDENCE/modal-browser" > "$OVF_FINAL_EVIDENCE/modal-browser.log" 2>&1
OVF_PLAYWRIGHT_MODULE="$OVF_PLAYWRIGHT_MODULE" OVF_PRODUCTION_SOURCE_COMMIT="$OVF_FINAL_SOURCE_COMMIT" OVF_EXPECT_SAVE_VERSION=4 OVF_EXPECT_SIMULATION_REVISION="$OVF_EXPECT_SIMULATION_REVISION" node scripts/verify_settlement_runtime_ui.mjs "$OVF_FINAL_PREVIEW" "$OVF_FINAL_EVIDENCE/browser-scenario.json" "$OVF_FINAL_EVIDENCE/settlement-runtime" > "$OVF_FINAL_EVIDENCE/settlement-runtime.log" 2>&1
```

The existing economy proof expects 25 true checks, no page errors, exact caravan and specialization debits, completed physical routes and rewards, native worker harvesting, inherited specialist controls, cross-layer deposit admission, hidden cavern filtering, paid cavern construction and save/report/reload. Its source fingerprint must equal the report's build ID. The combined modal proof expects 12 recorded checks at 1280×720 and 520×720, including actual launcher clicks, live Objectives draft ticks, native draft pick, Economy pause/focus/Escape and the bounded native disabled-state observation. Its source-commit field alone is an execution association, so bind it to the same frozen preview and the independently verified build/report fingerprint.

The added settlement driver expects eight recorded checks. It imports the fresh SAVE4 mixed fixture, pays for research specialization through native controls, verifies a second choice is disabled, and queues two HQ technologies through the normal Technology tree. It records the actual producer IDs and definitions, then measures authoritative research progress over at least 40 ticks. Normalized by the durations displayed in the native UI, the ordinary HQ rate must be 1 and the specialized expansion rate 1.35. A native bug report must match the source fingerprint, SAVE4 and the approved final revision. This driver measures the research branch of feature 19. Mining and military branches need the affected simulation tests; it does not claim native ore/training comparisons or foreign-producer rejection.

Run the final root-owned full suite from the freeze. For the economy runtime subset, use the final versions of `economy-settlements`, `settlement-mining-runtime`, `settlement-military-runtime`, `economy-cargo`, `economy-cargo-integration`, `economy-cancellation`, `economy-regressions`, `economy-world-integration`, `economy-specialist-core`, `specialist-economy-integration`, `economy-scenario-integration`, `faction-economy-interruption`, `faction-save-semantics`, `allied-modes-binding`, saves and replays tests. The new mining tests compare public gathering and physical owned deposits against a full-state control, including the earlier first banked deposit, repeated deposits, ore conservation, ordinary-region isolation and full save/session/replay continuation. The new military tests compare paid matching recruits at legitimate local and ordinary producers, prove earlier completion, preserve foreign/disabled/draft admission gates and compare full in-flight save and replay continuation. The draft case verifies paid admitted recruits and a final save roundtrip; its replay scope is the separate non-draft case. These tests close the prior helper-only mining gap and extend military benefit coverage. Do not substitute their targeted counts or the old 872/47 count for the final root full suite.

The modes owner is validating exact registered definition IDs under the current owner's picks/exclusions, including pending spawn completion and fixed-army gates. The native drivers exercise legitimate owned HQs and registered support actors but do not prove foreign-producer or draft-support rejection. Use that owner's final contract tests and reported pin; do not duplicate its cleanup or decide permission from a shared worker/depot role. Faction cleanup `65839df` concerns later faction orders and uncrewed economy activity; the generated native fixture does not reproduce those conditions, so retain its final runtime regressions separately.

## Final artifact comparison

After all drivers succeed, compare retained values directly. Recompute the sorted `src` TypeScript/CSS fingerprint, verify it equals the economy proof, economy report and settlement report build IDs, and check their final save/replay versions and simulation revision. The full `browser/commanded-session.json` must equal `browser/report.json.session`, with game tick equal to replay final tick. Preserve the earlier `completed-state.json` tick separately; it is a pre-export observation. Confirm 25 true economy checks, 12 modal checks, eight settlement checks and empty error arrays. Inspect final screenshots and the measured research before/after states.

Record the final source SHA, driver SHA, exact commands and exits, fixture hash, source fingerprint, build output/assets, configuration, lockfile and verifier hashes. Write a new final audit; keep the existing intermediate manifests and failures unchanged. A source or driver change after the freeze requires a new source association and only the affected reruns justified by that change. Preserve any failed attempt in a separate directory before a repair, especially cross-layer option admission and the first narrow disabled-state observation.

The settlement browser driver's preparation validation remains limited to read-only source/driver review and JavaScript syntax checking. The added mining/military runtime tests and pinned-definition test correction have separate executed SAVE4 evidence. The browser driver has not been exercised against a browser; that execution remains gated on the final freeze.
