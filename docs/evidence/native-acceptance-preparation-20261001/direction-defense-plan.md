# Native direction and defense preparation

These are unexecuted candidate proof modules. They were prepared by reading production source and `tests/combat-tactics.test.ts` at `af44da406acf7ab44436e978cb1f571b93e28d23`, with no production edits, fixture generation, engine steps, browser run, or game build. The final production pin is pending. Generation and audit import `SAVE_VERSION` and `SIMULATION_REVISION` from that final source; they contain no hardcoded rules revision.

The files belong in `scripts/acceptance/` when the parent admits them. Their TypeScript imports use `../../src/core/`. The parent owns admission, the shared context, source freeze, all execution, and the canonical ledger and decision log.

| Candidate | Callable API |
| --- | --- |
| `direction-defense-fixtures.ts` | `buildDirectionDefenseFixtures(output, sourceCommit)` returns the group manifest and writes 22 native session fixtures plus `manifest.json` into a new group directory. Importing the module does not execute it. |
| `direction-defense.mjs` | `runDirectionDefense(ctx)` uses the parent's native context and returns exports, continuation pairs, and observations. No private scene, direct command, or game-state write is used. |
| `audit-direction-defense.ts` | `verifyDirectionDefenseNativeArtifacts({evidenceDir, fixturesDir, manifest, browserReceipt, outputPath, sourceCommit})` returns and writes a new report after replaying the retained native histories. Importing it does not execute an audit. |

The aggregator must retain the producer source, executed bundle and metafile, source-input Git-byte checks, generated file hashes, process stdout/stderr and exit codes. Its final frozen source must include the candidate proof modules. The generic browser runner must seal the fixture bytes and match served production HTML, JavaScript and CSS to that same build.

## Encounters and expected observations

| Fixtures | Public native actions | Expected evidence |
| --- | --- | --- |
| `flank-front`, `flank-side`, `flank-rear` | Select Boltspitter through the native owned-troop list; right-click the visible held enemy. | Independent first hits deal 12, 15 and 18 health damage. Target facing stays West. Core history checks the first impact follows the recorded public attack. |
| `shield-front`, `shield-turned`, `shield-rear` | Apply owned guard and ally facing through the Tactics panel before an authored enemy attack fires. | Frontal shot loses 6.8 ally health and 10.2 guard energy. Rear and turned shots lose 17 ally health and spend no guard energy. Facing-to-hit native checkpoints continue to the same complete games. |
| `shield-depletion` | Apply facing, then allow the same authored enemy attack to continue. | A normal 40-point guard absorbs three full interceptions and one partial interception. It reaches zero through four weapon hits; ally health is 67. The fifth hit loses the full 17 health. Empty-guard save continues into that hit. |
| `cover-none`, `cover-rock`, `cover-building` | Select Mothbow and issue a real attack. For the building case, withdraw Mothbow, attack the structure with the siege engine, withdraw siege, return Mothbow and attack again. | Ranged control damage is 15; covered first hit is 8.7. Siege damage destroys the starting structure without splashing the test target. The following ranged hit returns to 15. Save/replay and continuation retain the dead structure and native damage. |
| `friendly-fire-off`, `friendly-fire-on` | Public siege attack; export while its normal projectile remains in flight; resume. | Matching enemy impact loses 25 health. Off preserves allied health; on loses 19.6 allied health. Both original pending projectile saves must match full native replay and continuation. |
| `charge-stationary`, `charge-charge`, `charge-stop`, `charge-turn` | Attack; or native movement then Hold; or movement then a north turn, followed by attack. | Charged impact exceeds stationary impact by over 50%. Hold records existing charge of at least four tiles and decays it to zero before attack. A sharp turn resets prior heading charge; stop and turn impacts remain below uninterrupted charge. Moving/interrupted native saves retain those states. |
| `charge-pike-front`, `charge-pike-rear` | Public cavalry attack approaches the authored held spear unit. | Front pike cancels bonus, loses 17 health and deals over 10 return damage to the rider. Rear pike loses over 1.5 times frontal damage and deals no return damage. The front rider charge is consumed. |
| `formation-line`, `formation-wedge`, `formation-square`, `formation-loose` | F2 selects the complete six-member mixed combat army. Tactics selects facing East, spacing .8 and formation. Right-click orders the destination beyond the depot. | Melee, ranged, spear and cavalry roles reach independent expected slots around the building. A native enemy hit kills the wounded member after arrival; the enemy's authored queued withdrawal allows five survivors to repack at the same anchor. Each replay tick checks obstacle clearance and stable ID-based slots. Settled and casualty saves continue to full regroup. |

## Starting conditions

Fixture generation uses production `createMatch`, `spawnDefinition`, `initializeTactics`, `MatchRecorder`, `createSessionFile` and `decodeSessionFile`. It advances zero engine ticks. The recorder starts after all starting conditions are authored. Each file has a zero-action native history that records the current source's save version and rules revision. Its entire native game must round-trip before it is written.

Seed zero starts with clear daylight. Both world layers use flat grass and zero elevation. There are no resources, neutral actors or transitions. Day, season and weather durations are authored as 1,000,000 seconds to keep direction comparisons independent of wind or rain. One owned worker remains underground, and every native import retains the complete layered world. Non-firing actors start with cooldown 1,000; first-hit shooters start with cooldown three. No health, cooldown, order, tactics field, controller or resource value is edited after recording.

The shield cases author one external enemy Mothbow's initial attack order on the owned Thunderlock. The proof controls the owned guard and ally through real facing commands. Normal guard energy starts at 40; depletion is earned through combat. The cover building starts with 100 remaining health and its native maximum health, so a real siege hit can destroy it without a long siege. The formation casualty starts with one health and full morale. Its enemy starts with an 18-second cooldown, a legal attack order and a queued withdrawal. These are disclosed starting conditions, not claims that damage or orders were created through the browser before recording.

The formation army is the entire owned combat army, so F2 selects only the six requested units. Owned workers and headquarters stay away from the encounter. The shared context's single-unit roster selection centers the camera. Additive selection elsewhere uses native Shift-click; WorldTools roster buttons replace selection.

## Native history and continuation audit

`runDirectionDefense` uses `loadScenario`, `pause`, `resume`, `snap`, `wait`, `runUntil`, `selectTroop`, `openTactics`, `closePanels`, `ground`, `entityClick`, `exportAndVerify`, `record` and `screenshot` from the parent context. `runUntil` accepts a host predicate over the complete read-only snapshot and options `{timeout,label}`. The browser module assumes snapshots contain all state fields plus native UI flags. The context's `exportAndVerify` must export through SessionTools, import that save, export its replay, reach the full endpoint, compare the complete game and runtime, and reimport the original save into local mode before returning.

The native UI has no single-tick input. The browser waits for a read-only state condition and pauses through the HUD. It records actual tick numbers rather than claiming a chosen number of simulation steps. The history audit then replays every retained action through public `issueCommand` and `stepGame`, checking all fixed .05-second ticks and the complete final native game. Every recorded command must belong to the human side zero. Its initial game must equal the generated authored input in full.

Every continuation is tested against the complete checkpoint and endpoint games at the corresponding original history positions, including every command boundary at the same tick and every partial coalesced advance. The audit requires both games to occur in the final retained history. It excludes no native state or runtime fields. It also verifies first impacts, native shield interception events, collateral events, charge interruption commands, real combat casualties and formation obstacle clearance on every replay tick.

For the separately labeled packaged CLI claim, feed the actual final native session and each listed checkpoint to the admitted `prepare_combat_cli_projection.ts`, then run the existing packaged driver on both derived sessions. The original browser histories stay unchanged; the adapter's explicit controller-zero projection and planning scope remain separate. Do not substitute a fixture-page demo or core-test result for the native browser records.

## Dispatch and failure handling

The parent must freeze and dispatch the final source, admit the scripts independently, and finish its competing AI matrix before running generation or any engine/browser work. Retain failures and process records. If native proof fails, inspect the retained original session and reproduced core history before changing product code. A fixture or selector correction is a proof change; a reproducible product defect requires a separately reviewed production fix and a new freeze.

These candidates do not cover surrender, ambush, capture, faction specialists, promotions, heroes, artifacts, beacons or engineers. Other owners prepare those cases. Syntax preparation is not a behavior pass, and no feature acceptance should be marked from this directory until the final native runs and history audits pass.
