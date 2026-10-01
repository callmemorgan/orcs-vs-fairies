# Native specialist and lifecycle acceptance preparation

This is unexecuted preparation. The source audit used production commit `af44da406acf7ab44436e978cb1f571b93e28d23` in `/home/morgana/.codex/worktrees/final-combat-proof/orcs-vs-Fairies`. The parent is assembling rules 4.0.1 while keeping SAVE4. The producer imports `SAVE_VERSION` and `SIMULATION_REVISION` from whichever frozen source is admitted and requires its full source commit as an argument. No production, root, ledger, or decision-trail file was edited.

`specialist-lifecycle-fixtures.ts` is intended for `scripts/acceptance/specialist-lifecycle-fixtures.ts`. Its imports are relative to that destination. Call `buildSpecialistLifecycleFixtures(fixturesDirectory, fullSourceCommit)` and merge the returned entries into the shared runner's `manifest.scenarios`. It writes twelve authored native session files and its own manifest. The producer creates starting conditions, calls the normal save encoder/decoder, and never steps the game or issues a command. Starting resources, cooldowns, injuries, corpse, weather and geography appear in each manifest entry.

`specialist-lifecycle.mjs` is intended for `scripts/acceptance/specialist-lifecycle.mjs`. Call `runSpecialistLifecycle(ctx)` with the parent's native context. It uses native imports, roster selection, mouse input, HUD buttons, keyboard controls, save exports and replay imports. `window.rts` is read only. Full state and runtime equality comes from the parent's `exportAndVerify`, which restores the original save into local mode before continuation. The module resumes after each replacement and selects a troop again before any action that requires a HUD selection.

## Prepared acceptance cases

| Fixture | Native action and measured result | Retained persistence |
| --- | --- | --- |
| `specialists-orcs` | Iron Command buffs; Impact Fury; 8-wood incendiary preparation; live pending shell then damage and burning | Separate pending and active full native save/replay |
| `specialists-fairies` | Queen's Step moves and heals; Forest Leap; 6-crystal rooting preparation; live pending shell then damage and root | Separate pending and active full native save/replay |
| `specialists-dwarves` | Thane's Ward heals; Armored Brace; 15-ore ammunition; live pending cannon then damage | Separate pending and active full native save/replay |
| `specialists-undead` | Soul Drain hurts hostile and heals commander; Dread Charge fears hostile; consumes visible corpse; live pending shell then damage | Separate pending and active full native save/replay |
| `specialists-tideborn` | Admiral's Wave heals; Wet-ground Surge requires authored mud; 6-crystal flood preparation; live pending shell then damage and slow | Separate pending and active full native save/replay |
| `specialists-automata` | Prime Shield restores; Shield Dash spends shield and moves; 8-crystal Power Beam preparation; live pending beam then damage | Separate pending and active full native save/replay |
| `specialists-veteran` | Unranked commander defeats hostile in gameplay, reaches rank 1, draws the rank chevron, receives one Bulwark promotion after a native double click | Complete native earned-promotion endpoint; recorder must contain one accepted promotion |
| `specialists-recovery` | Living commander recruitment lock; recover/equip Iron Aegis; move wounded commander into marksman range; death drops held item and one loot item; recovery blocks until its boundary; full-price recruitment queues and completes once | Death/recovery, paid queue, and recruited endpoints |
| `specialists-artifact-damage` | Two fresh imports of identical fixture; recover blade in each, equip in one; compare one real attack event and target health | Separate unequipped and equipped hit endpoints |
| `specialists-bridge-crossing` | Move order fails across full-height channel; spend 60 wood on bridge; traveler crosses; second worker holds on bridge; bridge survives before 60-second boundary then restores water and relocates occupant to shore | Crossed, before-expiry and expired endpoints |
| `specialists-barricade-obstruction` | Spend 35 wood/15 ore to block only corridor; move stays blocked; after 60-second expiry obstacle disappears and traveler crosses | Blocked and expired/crossed endpoints |
| `specialists-beacon-link` | Native connected status and invasion alert; far tile visible; enemy marksman destroys first link in gameplay; remote beacon disconnects; current sight disappears while exploration remains | Connected alert and destroyed-link endpoints |

The active Orc, Fairy and Tideborn save assertions inspect the saved burning, rooted and slowed records and their expiry times. They do not rely only on a pre-export browser wait. The remaining faction saves assert real target damage and accepted commander, cavalry, siege and attack commands in the native recorder.

## Visual and duplicate-promotion scope

The rank screenshot uses the real commander SVG anchor (`112`) and visual top (`20`) from `src/core/specialist-content.ts`, and the renderer's 15-pixel rank offset and rank-1 color `#dca676` from `src/game/GameScene.ts`. It captures a fresh native canvas crop while the pause overlay is closed, decodes its PNG bytes, and requires at least three matching chevron pixels. The test also reads native HUD rank and promotion text. A final proof must inspect the retained image as well as the automated pixel result.

Duplicate choice testing uses Playwright's normal pointer `dblclick({delay:0})`. It requires one promotion in saved state, one accepted promotion in the exported recorder, and disappearance of the native promotion choice. It does not claim that a removed button dispatched a rejected command, and it does not call scene methods or reuse detached DOM handlers.

## Verification and dispatch limits

The JavaScript module passed `node --check`. The TypeScript file has been read against the public source signatures but has not been bundled, typechecked, or executed. No browser, engine simulation, fixture generation, build, CLI, or test run has started. Parent-owned independent proof-script review, final source freeze, generator provenance, frozen browser assets, full endpoint comparisons, artifact hashing and native export verification remain required before any completion claim.

The expected browser runtime includes real 30-second commander recovery, 25-second paid training, and two 60-second field lifetimes. Those waits must run only in the parent's admitted proof slot after the AI matrix finishes. Any failure must retain actual state, screenshot, inputs and process output. Product edits require a reproduced failure and a new admitted source freeze.
