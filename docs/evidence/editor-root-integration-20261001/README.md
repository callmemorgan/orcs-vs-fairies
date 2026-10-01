# Editor and community integration verification

Features 94 (map editor), 95 (scenario editor), and 97 (community browser) run in the canonical game host at source checkpoint `2915e37`. The editor page imports `src/main.ts`; map, scenario, and community play controls retain the normal commands, content definitions, modal pause behavior, and replay recorder. Community mod play selects the root publication's faction and launches its pinned dependency closure.

The production build and 407 focused tests pass. The five native browser proofs pass 55 checks with no page errors. `verification-manifest.json` records source, script, test, and configuration hashes and checks that all three served-build receipts share the same source hash. Screenshots were inspected after each complete run.

| Proof | Result | Evidence |
| --- | --- | --- |
| Map editor painting, undo/redo, drafts, export/import, eight starts, layered map play and traversal | 16 checks passed | `map-current/result.json` |
| Flat scenario graph authoring, undo/redo, tamper rejection, escort, timed waves, custom victory, relaunch and protected actor defeat | 8 checks passed | `scenario-current/result.json` |
| Layered scenario authoring, level-aware movement and conditions, cave reinforcements and unique object IDs | 7 checks passed | `layered-current/result.json` |
| Two-account map publication, exact revision download, changed and original launches, restart, native replay seek and playback | 14 checks passed | `community-map-current/result.json` |
| Recursive mod publication/install, exact root faction and bundle, custom producer construction/recruitment, authored stats/art, changed and original launches, pinned custom scenario publication/install/play | 10 checks passed | `community-mod-final/result.json` |

The map replay proof exports the complete session save at ticks 20, 40, 0, and 40 and compares `.game` against the Node replay player's `saveGame` result. It also plays the recording naturally to completion, checks for caught replay errors, and compares the full final save. The custom mod fixture has a three-package dependency chain whose root is not the first bundle package. The custom scenario uses the original closure after a revised Lantern manifest is installed.

## Reproduction

Use a fresh output directory for every run. After `npm run build`, start `npm run preview -- --port 5374 --strictPort` or choose another unused port. The two community scripts start and clean up their own temporary canonical server and account profiles.

```sh
OVF_EDITOR_EVIDENCE_DIR=docs/evidence/editor-next/map OVF_EDITOR_PLAY=1 node scripts/verify_editors.mjs http://127.0.0.1:5374
OVF_EDITOR_EVIDENCE_DIR=docs/evidence/editor-next/scenario node scripts/verify_scenario_editor.mjs http://127.0.0.1:5374
OVF_EDITOR_EVIDENCE_DIR=docs/evidence/editor-next/layered OVF_EDITOR_MAP_FIXTURE=docs/evidence/editor-next/map/two-level-map.json node scripts/verify_layered_scenario_editor.mjs http://127.0.0.1:5374
OVF_EDITOR_EVIDENCE_DIR=docs/evidence/editor-next/community-map node scripts/verify_community_browser.mjs
OVF_EDITOR_EVIDENCE_DIR=docs/evidence/editor-next/community-mod node scripts/verify_community_mod.mjs
node scripts/verify_served_build.mjs http://127.0.0.1:5374/editor.html docs/evidence/editor-next/served-build.json
```

`editor-community-tests.json` records all 407 passing cases; `build-attempt-2.log` records the successful production build. Earlier test and browser attempts remain in this directory with their original results. The focused suite used:

```sh
npm test -- tests/editor-document.test.ts tests/editor-map-package.test.ts tests/editor-tools.test.ts tests/editor-scenario-package.test.ts tests/editor-scenario-authoring.test.ts tests/community-client.test.ts tests/server/community-packages.test.ts tests/server/community-http.test.ts tests/scenarios.test.ts tests/scenario-content.test.ts tests/scenario-core-binding.test.ts tests/session-storage.test.ts tests/replays.test.ts tests/saves.test.ts
```

## Preserved failures and limits

`assembled-tests-attempt-1.json` records 400 passes and 15 failures. Thirteen scenario package cases shared an obsolete arbitrary actor ID; the fixture now uses the registered built-in melee ID and the scenario validator admits registered ordinary IDs as well as namespaced IDs. The two remaining historical v1/v2 team replay checksum failures are owned by the root migration work. They are not included in the 407 passing focused tests, and this directory does not claim a passing complete application suite.

`community-mod-current/result.json` records eight passing checks followed by a render timing failure: scenario runtime reached victory before the HUD refreshed. Its failure screenshot shows the correct mission victory text. Commit `2915e37` waits for rendered outcome text and compares full HUD stat values; the corrected run is `community-mod-final`. Earlier `map/` evidence predates the built-in actor ID followup; `map-current/` is the current run.

This checkpoint uses save version 3 and simulation revision 3.2.0. Final root SAVE4, combined combat/economy/world integration, and the final simulation revision require regenerated evidence and the full application suite. These runs do not establish public deployment behavior. No workspace `agent-transcripts/` directory was available; review uses the source, decision trail, and preserved artifacts.

## Integration order

Owned editor commits are `5ffd84a → 251def3 → 1a2167f → 7397bb8 → 2915e37`, based on root `1a1c46d`. Scenario-owner dependencies `b087d62 → 7c16d3a` are locally translated as `cb7f94f → 19c6b66`; do not apply both original and translated copies. They must be present before compiling the editor main callbacks. Preserve both the incoming scenario API/diagnostics and editor/community mounts when merging `src/main.ts`.
