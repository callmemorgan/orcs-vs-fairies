# Native capture, ambush and morale preparation

This directory contains candidate source and an execution plan. It contains no generated fixtures, browser result, simulation result or acceptance claim. Preparation read production source at `af44da406acf7ab44436e978cb1f571b93e28d23`; its checkout now has an evidence-only descendant HEAD, and the inspected production source had no difference from that pin. Root is assembling a later SAVE4 source with another rules revision. The modules import `SAVE_VERSION` and `SIMULATION_REVISION` from the dispatched source, and the generator requires its full `sourceCommit` as an argument.

Only this `/tmp` directory is owned by this preparation. No production file, root checkout, ledger or canonical decision trail was edited. No browser, build, test, engine tick or fixture generator has run. Parent must wait for root dispatch and independent script admission before execution.

## Files and integration

| Candidate | Intended imported path | Entry |
| --- | --- | --- |
| `capture-ambush-fixtures.ts` | `scripts/acceptance/capture-ambush-fixtures.ts` | `buildCaptureAmbushMoraleFixtures(freshFixtureDirectory, fullSourceCommit)` |
| `capture-ambush.mjs` | `scripts/acceptance/capture-ambush.mjs` | `runCaptureAmbushMorale(ctx)` |
| `capture-ambush-native-checks.ts` | `scripts/acceptance/capture-ambush-native-checks.ts` | `observeNative(originalSession, side, level)` and `verifyCaptureAmbushNativeArtifacts(freshEvidenceDirectory, manifest)` |

TypeScript imports use `../../src/core/...` for these intended paths. Do not bundle them in place from `/tmp`; the parent imports them into the isolated final proof checkout first. The fixture function returns a manifest with `scenarios`. Merge that returned dictionary with the other owners' independent scenario dictionaries in the parent orchestrator. Existing files are never overwritten. The native-check function writes one fresh `capture-ambush-native-checks.json` result after all original downloads exist.

The browser module uses the prepared shared `native-context.mjs`. It needs `page`, `out`, `sessions`, `loadScenario`, `snap`, `selectTroop`, `openTactics`, `openWorld`, `entityClick`, `ground`, `closePanels`, `closeSessions`, `openSessions`, `exportAndVerify`, `importSave`, `resume`, `pause`, `runUntil`, `wait`, `ready`, `record`, `screenshot` and the `observeNative` hook. `runUntil` accepts a host predicate on the read-only snapshot and an options object, resumes the native clock, polls and pauses through the HUD. Commands therefore call `resume` first. `exportAndVerify` returns the original native SessionFile, checks complete native import and replay endpoint equality, and reimports the original into local mode for continuation.

`observeNative` must be supplied from a bundle built against the same frozen source as the production app and fixture generator. Its input is an original native download. It leaves the human controller and outer planning wrapper intact; it makes no packaged CLI projection and no claim of outer planning replay parity.

## Encounters and retained evidence

| Encounter | Native steps | Required artifacts |
| --- | --- | --- |
| Full crew capture | Attack a 42-health Orc siege crew with a Fairy melee troop; hold after the crew dies; choose the abandoned engine in Tactics; capture to an incomplete channel; export/import; finish capture; move the engine; attack an Orc depot; export/import its pending shell; observe impact | `siege-crew-defeated`, `siege-mid-capture`, `siege-new-owner`, `siege-new-owner-moved`, `siege-new-owner-pending-shot`, `siege-new-owner-impact` native saves and replay endpoints |
| Surrender | Native engine ticks resolve three opposing surrounding sectors around a wounded Deepforge ranged troop; export/import; move that troop through its new owner's controls | `surrounded-surrender`, `surrounded-surrender-moved` native saves and replay endpoints |
| Active retreat | Native morale loss starts an isolated wounded Orc's retreat; save while its retreat timer is active; restore; native ticks reach support and end the retreat | `morale-active-retreat`, `morale-retreat-recovered` native saves and replay endpoints |
| Chosen ambush | Dry-ground unit sees disabled native ambush control; arm woodland archer for melee within radius 2; wait until its weapon is ready while a wrong-role worker is already in radius; save/import while hidden; inspect side 1 native replay; resume until the authored marching melee reaches radius; save/import and inspect revealed side 1 replay | `ambush-concealed`, `ambush-triggered`, paired Player 2 native replay screenshots, disabled-control receipt |
| Scout/release/timber | Arm for buildings within radius 1 with a scout at 2.3 tiles; inspect native observer replay; release through Tactics; rearm; clear the last timber through native paid Forest work | `ambush-scout-spotted`, `ambush-manually-released`, `ambush-timber-cleared`, Player 2 screenshot |

All scene positions, health, morale, starting resources, long hostile cooldowns, timber and the hostile march are authored before recording. The siege crew stays at its full production 42 health. Long hostile cooldowns prevent an acceptance encounter from killing the actor before the required UI interaction; the manifest discloses each one. The surrender troop begins with 30 health and 1 morale. These are acceptance encounters, not evidence that players earned those initial conditions in a normal match.

The native browser records all later command receipts. The hostile march is an initial order created through `issueCommand` before `createSessionFile`; no recorder exists and no later hostile command is injected. All later ownership, crew damage, capture progress, morale, concealment, timber destruction, movement, projectile flight and impact come from native UI commands and normal `.05` ticks. The browser module contains no private scene state writes or fixture page.

The original-download verifier checks every saved native game with strict SAVE4 decoding and a complete save round trip. It replays every original, unprojected history and compares every saved game/runtime field. It also resumes the actual mid-capture, pending captured shell, active retreat and hidden ambush checkpoints through the retained action suffix, accounting for a checkpoint in a coalesced advance, and compares the complete endpoint game/runtime with uninterrupted replay. It verifies abandoned engine ownership is `null`, recovered ownership is side 0, and hostile observations omit private ambush trigger data.

## Observer proof and renderer prerequisites

The local app has no native live perspective switch. The candidate imports an exported native replay, seeks to the original save tick, and selects `Replay perspective` through Session tools. It centers the same own worker for the concealed and triggered screenshots, and the scout for its detection screenshot, using the native Owned troops roster. The replay remains paused. It checks that the ambusher's tile is already in side 1 sight, so concealment is distinguished from ordinary fog.

`GameScene.drawActors` enumerates entities using `visible`, which requires the active map level and `canObserveTacticalEntity`. It does not cull this list by camera position. `ArtRuntime.begin` resets `renderedUnits`, and `ArtRuntime.entity` increments it for living units after resolving their loaded builtin atlas frames or loaded custom art. Resources, buildings and dead units do not increment it. The candidate therefore requires loaded builtin art and compares that real renderer count with PlayerView-visible living units on level 0 from the original download. It retains known observed unit IDs, actual count, atlas status and screenshots. This comparison is valid only while those atlas prerequisites hold; a missing sprite is a failing proof prerequisite, not successful concealment.

The native UI view and original-download observation check each other's expected count. The module does not access private Phaser sprite maps or set `viewSide`, `selected`, camera values or game state through script evaluation.

## Execution and review

After root dispatch and admission, the parent builds one fresh fixture generator wrapper that calls this fixture entry with the dispatched commit. It retains its executed bundle, metafile, command stdout/stderr/exit, and every input hash matched to the frozen Git blobs. The parent serves the frozen native production build through the existing sealed runner, passes the shared context with this module's `observeNative` hook, and retains all requested downloads and screenshots in a fresh output directory. The original-download verifier runs afterward on those real native exports. The parent can feed the saved capture checkpoint and final native capture history to the existing projection adapter and packaged CLI driver if cross-engine continuation is in scope; these candidates do not create another CLI driver.

Do not claim the scripted encounters pass from syntax or parse checks. The first real run must retain any failure and demonstrate its cause before a product edit. Fixture mistakes should be corrected in candidate source with a new evidence directory and new source/generator receipt. Product changes require a reproduced product failure and a new source freeze.

Current preparation checks are JavaScript syntax and TypeScript parsing only. Final source import, focused type checking, fixture strict decoding, native app execution, exact replay/continuation comparisons and independent reviewer admission remain pending.
