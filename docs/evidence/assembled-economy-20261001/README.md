# Assembled economy evidence

This evidence covers economy features 11–20 merged onto root source 83b4db6, including the world, deterministic geometry, content registry, paid queues, starvation rules, terminal guards and tournament UI. Production source is frozen at 3d04a8b. The SHA-256 fingerprint over sorted source TypeScript and CSS paths and bytes is `eb4ba8b2843e810d145fa609c3ff32660bce14e2b46a6c1ccb13ec9bf23b6c1f`. `integration.json` lists the translated commits. The old f5ba3b9 layer fix was absorbed into actual-world layer validation in 0c25d5a. Evidence under `../economy-settlements-20261001/` belongs to the earlier isolated implementation and has its original scope.

The assembled implementation keeps the root's world-aware navigation, registry definitions, charged production costs, online command dispatcher and modal ownership. Generated world villages create strict economy IDs. Groves, resource-linked structures, warehouse assignments, events and visibility use actual map levels. Loaded caravans can traverse without losing their goods; fire, bridge collapse and thaw deaths drop physical cargo once. Caravans remain passive. Online clients consume filtered `EconomyView` without adding authoritative economy state to a rendering snapshot. Team spectators merge public markers from historical teammate frames while stocks, cargo jobs, accepted contracts and ledgers retain the selected seat's privacy rules.

Final review reproduced two additional failures. Placing an economic building beneath a caravan reassigned its order and cancelled its route, including allied routes. Placement now invalidates navigation while retaining jobs; commanded owned and allied routes still deliver, and displaced planters finish planting. Foreign cargo `origin` revealed whether a private trade or contract job had been assigned. Both player observation and team marker merging normalize foreign origin. The relevant checks failed before the fixes in `final-review-regressions-before.log`; `final-review-regressions.log` records 45 passing focused checks after them.

`focused-tests-final.log` records 406 passing tests across 26 affected files, including economy, generated worlds, interruptions, environment, neutral sites, mods, saves, replays, storage, online rendering, teams, HUD, availability, navigation, simulation and ordinary order queues. This is a focused suite. The full current repository suite was not run in this worktree. `focused-tests.log` preserves the earlier 362-test assembled pass. Initial mixed-world, UI-selector and resized-environment fixture failures remain in the three `*-first-failure.log` files. Browser, CLI, server and tournament builds all passed; their logs are included. The browser build retains the existing warning for a 1926 kB chunk above the configured 1600 kB threshold.

The mixed browser scenario uses a generated two-level forest world and the pinned Lantern Keepers mod. Its authored terrain is flat grass; monster encounters are removed and environmental intervals are long. Buildings and caravans are constructed through paid public commands. Finite initial warehouse stock, salvage, ore history and fresh contract offers are authored scenario setup. The proof exercises payment, construction, growth, harvesting, physical routes, finite market rewards, raids, salvage, contracts, cavern construction and save/report export through the normal application. Actual battlefield death and cargo conservation are checked separately in the simulation tests.

The browser proof contains 24 true checks and no page errors. It selects a worker and orders harvesting through native canvas input, verifies the hidden cavern crystal shares coordinates with a visible surface tile, verifies that an unclaimed surface deposit remains listed but disabled for a cavern worker, pays 100 wood, 90 ore and 15 crystal for a level 1 extractor, waits for completion, centers and selects the extractor through native input, and exports and reloads the same-build save and replay. `browser/proof.json`, `browser/report.json`, `browser/commanded-session.json` and the screenshots retain those observations. The source fingerprint must match the report's `versions.buildId` before the script succeeds.

`browser-first-failure/` preserves the mod worker harvest click miss after 18 passing checks. `browser-second-failure/` preserves the broad World summary selector failure after 20 checks and native harvesting. That screenshot also exposed Tournaments overlapping the World control; source 3d04a8b moves World below the tournament row. `browser-third-failure/` preserves the first strengthened cross-layer assertion reporting an enabled option after 3 checks. An isolated DOM probe in `option-disabled-observation.json` shows Playwright can report a disabled option correctly, so the reason for that earlier result remains uncertain. The verifier now waits up to 5 seconds for the selected cavern worker and its disabled surface option, then reads the option's native property. `browser-fourth-pass/` preserves the successful 24-check run before adding that bounded selection-state wait.

The source deliberately remains at save version 3 and simulation revision 3.2.0 for this intermediate integration. Root owns the version 4 migration and final rules revision. Old pinned content used the base hash over `{FACTIONS,UPGRADES,ECONOMY,ABILITIES}`; the new base also includes economic building and caravan definitions. Historical pinned bundles need validation against the recognized old body/base hash followed by re-pinning. Relabeling an envelope without that validation is insufficient. Root must rerun compatibility and application verification after merging the remaining work.

## Reproduce

Build each entry point, generate the mixed fixture and serve a free preview port:

```sh
npm run build
npm run build:cli
npm run build:server
npm run build:tournament
npx esbuild scripts/economy/generate-scenario.ts --bundle --platform=node --format=esm --loader:.svg=text --outfile=/tmp/assembled-economy-scenario.mjs
node /tmp/assembled-economy-scenario.mjs docs/evidence/assembled-economy-20261001/browser-scenario.json --mixed
npm run preview -- --port 5392 --strictPort
```

Run the native proof from the repository root, passing the preview URL and a fresh output directory:

```sh
OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs node scripts/verify_economy_ui.mjs http://127.0.0.1:5392 docs/evidence/assembled-economy-20261001/browser-scenario.json /tmp/assembled-economy-proof-new
```

The final focused command is preserved in `focused-test-command.txt`. `audit.md` records the evidence review and remaining limits. Decision rows are appended to `../../features/decisions.tsv`; retrospective rows use the time they were recorded, rather than invented execution timestamps. No workspace `agent-transcripts/` directory was available, so the audit uses the retained artifacts and accessible working context without searching unrelated global chats.
