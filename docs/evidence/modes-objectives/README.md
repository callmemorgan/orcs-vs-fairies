# Modes and objectives evidence

This directory records the isolated implementation of features 66–70: custom match rules, hill victory, relic victory, survival waves, and army drafting. The runtime proof names source commit `79261abf8ae5539b41972b2575d1e40804419ed6` in `provenance.json`. Its hashes match all 16 core TypeScript files, and each final save file matches the corresponding `authoritativeSha256` in `runtime-results.json`.

## Completed matches

`scripts/modes/verify-runtime.ts` runs the real simulation at 0.05 seconds per tick. It restores an ordinary save at tick 300, compares SHA-256 of the complete saved state and behavioral runtime on every later tick, and compares the replay endpoint to the final save. Survival also restores each recovery checkpoint. A mismatch or unfinished match fails the runner.

| Match | Final tick | Winning side / team | Outcome |
| --- | ---: | --- | --- |
| Hill duel, both AI | 714 | 0 / 0 | Hill held; both headquarters alive |
| Relic duel, AI against an external player | 911 | 0 / 0 | Two relics held; both headquarters alive |
| Contested relic duel, both AI | 783 | 1 / 1 | Two relics held; both headquarters alive |
| Hill 2v2, all AI | 823 | 2 / 1 | Hill held; all four headquarters alive |
| Five-wave survival, AI defender | 11831 | 0 / 0 | All five real waves defeated |

The survival attacker counts increase from one to five, and later waves include additional unit roles. Recovery saves are at ticks 7475, 7899, 8936, and 9468; the ordinary checkpoint is at tick 300. The final survival save has two surviving defender headquarters, one of which the AI constructed during the match.

`runtime-results.json` and `runtime.log` contain the final results. The `.save.json` and `.replay.json` files retain the real artifacts. The replay format's existing divergence checksum remains in the results alongside the complete-save SHA-256. `initial-runtime.log` is an earlier development run and does not establish the final comparison.

## Browser and regression checks

`browser/results.json` and `browser-proof.log` record 11 checks with no page errors. The Chromium fixture imports the real setup and objective components, issues commands to the real core, and hosts the real server. It checks local rule submission, relic collect/drop commands, survival defaults, a 390-pixel rules form, draft order and rejection paths, recovery after a browser reload, focused edits during polling, settings propagation and cleared readiness, and guest review of effective rules and handicaps. Two separate browser accounts complete the server-owned draft. Cleared readiness is asserted from both accounts after applying settings.

The final screenshots are `browser/relic-desktop.png`, `browser/rules-mobile.png`, `browser/online-draft.png`, and `browser/guest-received-rules.png`. The mobile image records the visible rules form; it does not prove the mobile objective panel layout. `browser/initial-results.json` and `browser/initial-online-draft.png` retain an earlier nine-check run.

`final-tests.log` records 323 passing tests across 10 files. The earlier test logs retain the development sequence and their smaller test sets. These tests cover strict rule and saved-state validation, hill contention, relic theft and carrier death, permitted observations, increasing waves and defeat, team rewards, bounded maximum waves, disabled units, eight-player draft history, server revision checks, draft persistence, and received rules. This is a targeted regression record, not a recorded whole-repository run.

`browser-build.log`, `cli-build.log`, and `server-build.log` record successful browser, CLI, and server builds. The browser build emits the existing large-chunk warning.

## Reproduction

Run these commands from the modes/objectives worktree with dependencies installed. The standard test command runs the repository suite; the dedicated browser and runtime scripts reproduce the retained proofs.

```sh
npm test
npm run build
npm run build:cli
npm run build:server
npx esbuild scripts/modes/verify-runtime.ts --bundle --platform=node --format=esm --outfile=/tmp/ovf-verify-modes-runtime.mjs
node /tmp/ovf-verify-modes-runtime.mjs
node scripts/verify_modes_ui.mjs
```

The browser runner loads `playwright` by default. If Playwright is supplied by the desktop runtime, set `OVF_PLAYWRIGHT_MODULE` to that runtime's `playwright/index.mjs`. Its generated fixture, server database, and screenshots are under `work/modes-ui-proof/`. The runtime runner replaces the final runtime artifacts in this directory.

## Integration still required

The browser fixture does not run the assembled main application or prove Phaser rendering. `mountObjectivePanel` still needs to be mounted in `src/main.ts`, refreshed with the normal UI loop, and disposed during teardown. Its observation getter must return the permitted online view, and its submission guard must exclude spectator, replay, photo, and other read-only modes.

`ObjectiveMarkers` is implemented but is not mounted in the main scene. It needs the scene's map projection, current rules, and permitted objective observations. Hidden enemy carrier coordinates are null and must stay hidden. Its default depth is 100002, above the existing fog and input layers. It should receive no objective data while photo mode hides overlays, and `destroy()` must run during scene teardown.

This branch uses the built-in `FACTIONS` and `UPGRADES` lookups. Integration must reconcile draft pools, disabled definition IDs, recruitment and research checks, starter units, survival units, and UI definition names with the pinned content bundle and its canonical registry helpers. This evidence does not prove custom content support.

The branch retains save version 3 with optional all-or-none rules, objectives, and draft groups for old saves. The combined integration must move these fields into the planned version-4 migration and retain historical replay checksum projections. Actual friendly-fire behavior comes from the combat changes; this branch stores and displays the rule.

The lobby ID label also contains the revision and mode. Browser helpers must extract the UUID instead of treating the whole label as an ID. An independent branch review and the combined application proof remain for root integration.
