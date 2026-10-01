# Assembled objective modes proof

This evidence covers features 66–70 after integration with admitted content, team rosters, layered worlds, the main game and hosted observation. Browser source is `8e79b06dc6b4acb4fbdf049a2eec23e3afbce322`. Natural-match runtime source is `6e79e7a53a0d06debde2bd36ef63c17e4156c867`; every core file in that runtime manifest still has the same SHA-256 at the browser pin. `provenance.json` records the source pins and hashes of the served JavaScript and CSS. The browser assets were fetched from the live proof server and compared with the local build bytes.

The historical evidence in `../modes-objectives/` remains intact. It proves the earlier isolated branch and component fixture. This directory contains the later assembled application proof.

## Natural objective matches

`scripts/modes/verify-runtime.ts` finished five games through ordinary simulation and AI commands. The runner compared the complete authoritative save SHA-256 at every resumed tick and at each replay endpoint. Every comparison matched. Survival resumed at tick 300 and at all four recovery periods.

| Case | Final tick | Winning team |
| --- | ---: | ---: |
| Hill duel | 713 | 0 |
| Relic duel | 867 | 0 |
| Contested relic duel | 1045 | 0 |
| Hill 2v2 | 826 | 1 |
| Five survival waves | 11768 | 0 |

The completed saves, replays, recovery checkpoints, source hashes and result records are in `runtime/`. These games establish victory, wave progression and continuation behavior. The browser checks establish the production controls and network command path.

## Production browser

`scripts/verify_assembled_modes.mjs` passed 12 checks against the built production app served by the real game server on isolated port 9241. It used the normal main menu, mod installation and launch, Phaser canvas input, replay session tools, guest profiles, online lobby and server command receipts. It did not mutate match state.

The local custom hill match retains its configured rules and the chosen `lantern:duelist` definition. Opening Objectives blocks F2 battlefield selection while ticks continue. The AI draft turn finishes. A normal canvas order moves the selected duelist, the HUD displays the hill mode, and the hill marker appears. Exported replay JSON imports through session tools and opens for read-only inspection. Photo mode hides the objective launcher.

The hosted relic lobby retains both picks (`orc-ranged` and `fairy-melee`) and gives each player that exact starting unit. The host moves through normal canvas input, then collects and drops a relic through the main Objectives controls. Both actions have accepted server receipts whose `clientSeq` matches the sent command. The guest sees the received relic mode and public progress. All three profiles have zero page errors.

The retained screenshots were opened and checked for readable text, visible markers and toolbar overlap. `browser/results.json` contains the assertions and receipts; `browser/browser.log` contains the run output. The hill browser check does not complete a hill victory, and the photo browser check covers the launcher. Natural matches prove victories; modal tests cover photo and other-modal blockers.

An earlier movement attempt read camera coordinates immediately after minimap centering and timed out. The runner now waits for two animation frames before projecting its canvas input, accounts for camera zoom origin and holds the pointer click for 100 ms. The final run is pinned after that correction.

## Tests and builds

The browser, CLI and server builds pass. `modal-tests.log` records 37 passing objective, lobby and tournament UI tests. `combined-gameplay-tests.log` records the final combined gameplay checks. `combined-tests.log` preserves the earlier 23 passing combined gameplay/UI checks before the extra modal tests.

`regressions-pinned.log` records 1,363 passing tests and two failures across 69 files at the gameplay pin. The failures are historical v1/v2 replay checksum projection tests in `tests/team-replays.test.ts`. SAVE4 migration and its historical projection are owned by the root assembly. This branch retains save version 3 and simulation revision 3.2.0. It does not claim full-suite success. The long natural-game `tests/skirmish.test.ts` was excluded from this broad run.

Focused independent audit reruns confirm that raised units and illusions retain the permitted custom duelist definition through save/load. A raise with no permitted melee definition returns false and leaves corpses and cooldown state intact. Invalid survival saves reject a missing opposing attacker, one team or a missing defender. A legitimate pending survival draft still roundtrips. The audit outputs are retained as `audit-*.log`; the permanent combined tests cover the admission and definition regressions.

## Reproduce

Build the application and hosted server, then run the server against an isolated temporary data directory with `RTS_PORT=9241` and `RTS_STATIC_DIR` pointing at this checkout's `dist` directory. Run the production proof with a Playwright installation available through `OVF_PLAYWRIGHT_MODULE` if it is outside this project's dependencies.

```sh
npm run build
npm run build:cli
npm run build:server
OVF_MODES_BROWSER_EVIDENCE=docs/evidence/assembled-modes-20261001/browser node scripts/verify_assembled_modes.mjs http://127.0.0.1:9241
npx esbuild scripts/modes/verify-runtime.ts --bundle --platform=node --format=esm --outfile=/tmp/ovf-modes-runtime.mjs
OVF_MODES_EVIDENCE=docs/evidence/assembled-modes-20261001/runtime node /tmp/ovf-modes-runtime.mjs
npm test -- tests/modes-combined.test.ts tests/modes-combined-ui.test.ts tests/online-lobby.test.ts tests/tournament-dashboard.test.ts
npm test -- --exclude tests/skirmish.test.ts --testTimeout=30000 --reporter=dot
```

Root must rerun relevant checks after importing into its SAVE4 and specialist-unit assembly. These artifacts pin the modes integration checkout and do not prove later root-only changes.
