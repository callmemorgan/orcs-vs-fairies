# Economy, scenario and specialist integration evidence

This evidence covers the economy chain translated onto tested root checkpoint `1a1c46d9b33b481e097350be6148cf49f906401c`. Production source is frozen at `cf5cb85f15fcc628d2ba19d9f49afb66a788fe04`, with source fingerprint `40c26aabab43370a1ff1e12ad4e13b1a4c0e55367ea129913baf35fbceba822b`. `integration.json` lists the translation, peer imports, commands and source association. The fingerprint hashes sorted source TypeScript and CSS paths and bytes; it excludes public assets, configuration, dependencies and verifier scripts. `source-manifest.json` records each source file, and `artifact-sha256.json` records the retained evidence and verifiers.

The integration preserves canonical specialist movement, shared death, paid queues, scenario gates, observer isolation and bounded save validation. Economic actors use the pinned definitions and actual map level. Fear interrupts their economic order before moving once; root and flood movement modifiers apply to cargo. Extractor fatalities use shared death, including equipped commander recovery, artifact drops, corpses and cargo salvage. Successful specialist relocation interrupts old economic jobs. Charged engineer barricades record their paid cost only after debit; free authored or survival spawns remain free.

Authored missions do not receive implicit markets or resource contracts. Fixed armies reject paid construction, engineer construction, caravans and village recruitment through canonical input. Accepted ordinary training, caravan recruitment and one village squad transaction consume the authored reinforcement allowance. Separate histories survive save and replay. Subsequent scenario, AI and combat changes remain root-owned and are outside this source checkpoint.

The final focused suite passed 872 tests across 47 files. `focused-test-command.txt` contains the exact command and `focused-tests.log` contains the result. Browser, CLI, server and tournament builds passed. The browser build retains a 2066.98 kB chunk warning above the configured 1600 kB threshold. The logs do not embed HEAD; the source association is recorded in `integration.json`, while the browser bug report independently confirms the source fingerprint. This worktree did not run the full final repository suite.

The economy browser proof passed 25 checks with no page errors. It used native controls to pay for buildings and caravans, complete construction and grove growth, harvest income through canvas input, complete physical trade and stock deliveries, earn finite market and contract rewards, raid supply, collect salvage, select specialist controls and build a cavern extractor. The generated two-level forest fixture pins Lantern Keepers content. Flat terrain, finite starting warehouse stock and salvage, depleted ore history, contract offers, specialist actors and long environmental intervals are authored setup. The proof does not claim those setup values were earned during play. Battlefield death and cargo conservation are exercised separately by simulation tests.

The full exported save equals the bug report's session at tick 8524, including runtime, replay and planning data. Its replay final tick is also 8524. `completed-state.json` is an earlier observation at tick 8517, taken before the export. All saved data remains session version 1, save version 3, replay version 1, checksum version 3 and simulation revision 3.2.0. The commander screenshot retains Queen Lyra's native commands; the engineer's three controls are asserted in the verifier but are not shown in a retained screenshot. The cavern screenshot shows the completed 650/650 extractor selected through native input.

The combined modal proof passed 12 recorded checks with no page errors. It verifies Objectives owns input while draft ticks remain live, accepts a native Lantern Duelist draft pick, clicks every shared launcher at 1280×720 and 520×720, checks enabled launcher centers and World placement, and checks Economy pause, keyboard suppression, focus trapping, Escape restoration and session-modal gating. Planning and Economy now use the shared session toolbar. The Practice Coach uses its measured lower edge at narrow widths. Production source remains `cf5cb85`; the modal verifier runs from script-only commit `4f986688916025065dc5242e02cab21774cc3f5e`.

Earlier failures and observations remain named separately. `modal-first-failure` used the default classic map while assuming World controls; the setup now selects a forest world. `modal-layout-failure` exposed Planning covering narrow Saves on `7dccf0e`, which led to the shared-toolbar change. `modal-gating-observation-failure` preserves an immediate disabled-state read that failed at 520 pixels on `cf5cb85`; the final verifier waits up to five seconds for the native disabled state before asserting. The exact cause of the first observation is unproven. `browser-before-review-fixes` and `focused-before-review-fixes.log` belong to source `7dccf0e`. The other first-failure logs preserve corrected test fixtures and event observations. The older `../assembled-economy-20261001` evidence retains its original scope and hashes.

Root still owns save version 4, strict historical envelope and pinned-content migration, the final simulation revision, later scenario/AI/combat assembly, and the full combined suite and native application verification. Historical pinned content must validate against its recognized old body and base hash before re-pinning. This intermediate evidence does not establish that migration. Final root browser verification should repeat cross-layer deposit admission and narrow modal gating. No workspace `agent-transcripts/` directory exists, so the audit covers retained artifacts and source without searching unrelated global chats.

## Reproduce

Use this frozen source for a matching build, then run each build command and the focused command in `focused-test-command.txt`. Generate a new fixture and serve a free preview port:

```sh
npx esbuild scripts/economy/generate-scenario.ts --bundle --platform=node --format=esm --loader:.svg=text --outfile=/tmp/economy-scenario-integration.mjs
node /tmp/economy-scenario-integration.mjs /tmp/economy-scenario-integration.json --mixed
npm run preview -- --port 5393 --strictPort
```

Run the verifiers into fresh directories, preserving the committed evidence:

```sh
OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs node scripts/verify_economy_ui.mjs http://127.0.0.1:5393 /tmp/economy-scenario-integration.json /tmp/economy-browser-new
OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs OVF_PRODUCTION_SOURCE_COMMIT=cf5cb85f15fcc628d2ba19d9f49afb66a788fe04 node scripts/verify_economy_combined_ui.mjs http://127.0.0.1:5393 /tmp/economy-modal-new
python3 scripts/audit_economy_integration.py
```

The artifact audit checks the frozen Git source, retained file hashes, browser claims, full exported session equality, versions, ticks, focused counts and build log results. It reports whether the current checkout's source matches the frozen source; later root changes do not relabel this checkpoint. `--write` refreshes manifests only when the current source still matches. `audit.md` records the independent review and remaining limits. Decision rows append to `../../features/decisions.tsv` at the time they are recorded.
