# IDs 2, 5, 6 and 7 static evidence assessment

This report compares the original feature wording with retained native observations and the immutable passing combined suite. IDs 2, 5 and 7 have evidence for their stated behavior. ID 6 has evidence for rocks and buildings, but its ruin case lacks simulation geometry and a passed test. These are ID-specific candidates for root's decision. This report does not promote any feature or relabel the failed 39-encounter run.

The native run used `f18a50d904c57ae1652f157b946ebd39d8d8923c`. The historical suite tested `4a71cd07bacc12d214acaf5a0f95a7d9b486f52c`. The checker/docs pin was `37bf0e794e7f62cf33347d2e92c739d593bf1cc4`. Those identities are separate. Inspection time was 2026-10-02T00:07:46.263806+00:00.

Only static file reads, JSON inspection, Git blob comparisons and hashing were performed. No tests, builds, checker, simulation, native history, import, replay stepping, source edit or root write occurred. This file is the only derived artifact from this assignment. An independent read-only child reviewed the ruin case; its findings were checked against the source before inclusion.

## Original requirements

The wording below comes from `/home/morgana/.codex/worktrees/final-combat-proof/orcs-vs-Fairies/docs/features/requirements.json`, SHA-256 `6781568203c4737471c87c106d1b8acae6fd8fbb2e11dd885d66db146b9cfa26`. Its status is still `in-progress` for each of these IDs.

| ID | Title | Original requirement |
| --- | --- | --- |
| 2 | Flanking bonuses | reward attacks against an enemy’s sides and rear. |
| 5 | Directional shields | shield units protect troops standing behind them. |
| 6 | Cover | rocks, ruins and buildings reduce incoming ranged damage. |
| 7 | Siege friendly fire | careless artillery placement can hurt your own army. |

## Retained execution and source binding

The native receipt is `/tmp/ovf-native-combat-f18a50d-retry-20261001-zssa25k5/browser/browser-native-acceptance.json`. It has `completed: false`, 84 checks and `groups: {}`. Its stage 06 process exited 1 after `charge-stop-interrupted` replay readiness timed out at 60,000 ms. No complete group was admitted. Stage 07 native history and stage 08 final asset acceptance did not run. The original seal says `completeGroups: 0`, `nativeHistoryRan: false`, `finalAssetGateRan: false` and `all39EncountersRemainOpen: true`.

Checks 0 through 69 cover the observations relevant to these four IDs. The sealed stdout contains 84 `PASS` lines in the same order and with the same names as the receipt's 84 checks. The checks were recorded after the relevant assertions returned: `scripts/acceptance/native-context.mjs:19-20`. Semantic checks in `scripts/acceptance/direction-defense.mjs:46-135` follow their save round trip and replay endpoint comparisons. A later failure does not erase those earlier retained observations, and those observations do not make the batch complete.

The historical report has `head: 4a71cd07bacc12d214acaf5a0f95a7d9b486f52c`, `passed: true`, `inputIntegrityPassed: true` and command exit code 0. Its JSON reports 2,920 passed tests, zero failed tests, and 377 passed suite entries. `tests/combat-tactics.test.ts` has 22 passed assertion entries and empty failure messages. These are historical execution facts; no suite was rerun at f18.

`git diff --name-only 4a71cd07bacc12d214acaf5a0f95a7d9b486f52c f18a50d904c57ae1652f157b946ebd39d8d8923c -- src/core tests` is empty. All 55 tracked `src/core` files and all 190 tracked files under `tests` have the same blobs between those pins. Each matches the historical manifest's Git blob, byte count and SHA-256. The 55 core files also match the native receipt's source byte counts and SHA-256. All 191 entries in the receipt's source file list match the frozen-inputs source list; the receipt adds execution metadata to that section. This binds the historical core/test behavior to unchanged f18 code, not to a new f18 test execution.

| Relevant file | Git blob at both pins | SHA-256 at both pins |
| --- | --- | --- |
| `src/core/tactics.ts` | `b5052c62671aa875caa9215655683d40d2c8a5dd` | `31e5e81e058e83bf94181c1c7203e1022d64aa0d8f715fb1e0082f04173c9797` |
| `src/core/simulation.ts` | `66bd44db02798f07467f888ab1193b06b52f364d` | `e301c65d0352ffe648a5bc4ee6acbda1f562164deacdfe60f8f3b03e7bdccf35` |
| `src/core/types.ts` | `d396b72d5342db148a3c6e1af9dd95eed83a729d` | `9f2c6c337d2dd6669c1cd8dbee30c01c89c41de3d9caf962d57854310fe8dd33` |
| `tests/combat-tactics.test.ts` | `30aa05a184aeff9446e0d578ec4ed3154bdbe362` | `930e2db43072914103ae6ca8bed0b44a615e8f805d669abc7b211dfd589dc75d` |

The acceptance scripts are f18 execution evidence; they are not the historical suite's unchanged tests. The sealed source list authenticates `direction-defense.mjs` as SHA-256 `53469400135b8dbc7cc1e0a8644e23e05aeee431aac6b9aeccc5d4cc8473c259`, `native-context.mjs` as `f205338dd00ec7d8f75dcc0dc3c0415a31bac6b47b3e1dfbe45f5b9e517447dd`, and `direction-defense-fixtures.ts` as `3d53ed12a4eb2ad1ab9777b44e4f0eda0d3229085b4083e0e18b28095d908703`. They match their f18 Git bytes.

## ID 2: Flanking bonuses

The original requirement is supported by the retained native attacks. Receipt `checks[3]` is `Native front attack measures held-facing damage`, with `damage: 12`, `tick: 66`. `checks[7]` is `Native side attack measures held-facing damage`, with `damage: 15`, `tick: 65`. `checks[11]` is `Native rear attack measures held-facing damage`, with `damage: 18`, `tick: 65`. The same target definition, full initial health and held facing 4 are used in independent fixtures. The source positions are front `(20.5,24.5)`, side `(24.5,20.5)` and rear `(28.5,24.5)` around a target at `(24.5,24.5)`. These are native Boltspitter attacks on an Ironjaw, not calls to the damage-factor helper.

The native runner asserts the target's full initial health, expected first-hit health loss and unchanged target facing at `scripts/acceptance/direction-defense.mjs:48-52`. It checks the recorded public attack at line 54 and the combined `[12,15,18]` result at line 58. All three save round trips and replay endpoints are recorded at checks `[1,2]`, `[5,6]`, and `[9,10]`. Their replay endpoint checks retain an accepted side-zero attack command. Static inspection of the retained native saves confirms the observed losses against each fixture's initial health.

The unchanged implementation at `src/core/tactics.ts:94-98` chooses front, side or rear from the target's facing and source direction. `TACTICS` at line 32 defines `sideDamage: 1.2` and `rearDamage: 1.4`; `src/core/simulation.ts:405` applies this factor before armor to weapon damage. The historical passed test at `tests/combat-tactics.test.ts:39-42` asserts `[12,15,18]`, verifies held facing, and verifies that a public facing command changes the rear shot back to front damage. No wording-specific behavior gap was found for ID 2.

## ID 5: Directional shields

The original requirement is supported by a native Dwarf melee guard protecting a Dwarf ranged troop behind it. Both are side zero; the guard is at `(23.5,24.5)` facing 4, and the protected troop at `(25.5,24.5)`. Public facing commands are retained. The enemy Mothbow is at `(20.5,24.5)` for the front and turned trials, and at `(29.5,24.5)` for the rear trial.

Receipt `checks[17]`, `Native shield front records health and directional energy`, records `firstDamage: 6.799999999999997`, `guardEnergy: 29.8`, `tick: 66`. The turned control at `checks[23]`, `Native shield turned records health and directional energy`, and rear control at `checks[29]`, `Native shield rear records health and directional energy`, each record `firstDamage: 17`, `guardEnergy: 40`, `tick: 66`. The direction therefore changes whether the bearer protects its troop. The runner asserts these health and energy values at `scripts/acceptance/direction-defense.mjs:63-69`; facing and first-hit round trips and replay endpoints passed for each trial.

The depletion trial records the same initial reduction at `checks[35]`. `checks[40]`, `Native guard reaches zero through combat and the next shot deals full damage`, records `depletedHealth: 67.00000000000001` and `unprotectedDamage: 17`. The retained empty checkpoint has guard value 0 at tick 150 and troop health `67.00000000000001`. The next retained checkpoint at tick 177 has health `50.000000000000014`, a loss of 17, while guard value remains 0. Checks `[36,37]` and `[38,39]` record both checkpoints' round trips and replay endpoints. `scripts/acceptance/direction-defense.mjs:75-83` asserts depletion and the following full hit.

The unchanged implementation at `src/core/tactics.ts:112-123` selects an allied bearer on the same level, checks that the protected troop is behind it and the attacker is in front, then spends shield/guard energy. `src/core/simulation.ts:483` applies it to ranged engine hits. The historical passed tests at `tests/combat-tactics.test.ts:55-60` cover front protection, rear/turned bypass, allied-player support and depletion. Their numeric values differ from the native trials because the historical tests use an Orc shooter rather than the native Fairy shooter. They establish behavior in unchanged tested code; they are not native measurements. No wording-specific behavior gap was found for ID 5.

## ID 6: Cover

Rocks and buildings have native evidence. `checks[44]`, `Native ranged attack measures none cover`, records `damage: 15`, `tick: 66`. `checks[48]`, `Native ranged attack measures rock cover`, records `damage: 8.699999999999989`, `tick: 66`. `checks[52]`, `Native ranged attack measures building cover`, records `damage: 8.699999999999989`, `tick: 65`. Each first-hit checkpoint has a passed native round trip and replay endpoint. The retained saves' health losses agree with these receipt values.

The rock setup uses terrain tile `(23,24)` and a grazing firing lane at `y=23.9`; this permits a visible target and an unblocked shot while remaining within the cover threshold. The building setup is an authored enemy Timber Yard with 100 health. A public siege attack destroys it. `checks[57]`, `Native siege destruction removes the cover reduction on the following ranged hit`, retains `damage: 8.699999999999989`, `tick: 65`, and `uncoveredDamage: 15`. The destroyed and subsequent uncovered checkpoints also have passed native round trips and replay endpoints. The runner checks the health loss at `scripts/acceptance/direction-defense.mjs:91` and the post-destruction loss at line 110.

The ruin case remains missing. In unchanged `src/core/tactics.ts:102-109`, the only eligible cover is a live completed building (`e.hp>0`, `e.kind==='building'`, `e.progress===1`, line 107) or rock terrain (line 108). Destroyed buildings are excluded; the native destruction observation agrees with that behavior. `src/core/types.ts:18` has no ruin terrain kind. Both the native fixtures (`scripts/acceptance/direction-defense-fixtures.ts:112`) and runner (`direction-defense.mjs:87`) enumerate only `none`, `rock` and `building`. The historical test does the same at `tests/combat-tactics.test.ts:62-64`. Neither evidence set contains a ruin-cover assertion.

`src/game/ArtRuntime.ts:40` lists `ruin-pillar` and `ruin-ring` art assets, while line 9 identifies that class as presentation only. Those art names do not establish ruin simulation geometry or a damage-reduction path. The independent static review found no game-scene call placing those IDs. There is no demonstrated mapping of ruins to the tested rock/building cases. ID 6 cannot be supported in full by this packet: its remaining requirement is that a ruin provides ranged cover, with a legitimate simulation representation and a passed behavior observation. The historical tests establish only the rock/building cases, with 12 uncovered damage and 6.75 covered damage, plus restoration to 12 after destruction.

## ID 7: Siege friendly fire

The original requirement is supported by a native Thorn Trebuchet shell hurting a side-zero Thornblade standing one tile from the enemy impact. The trebuchet is at `(18.5,24.5)`, enemy Ironjaw at `(25.5,24.5)`, and own Thornblade at `(25.5,25.5)`. The friendly-fire switch is part of the authored match rules. A native attack launches the shell; neither enemy nor ally loses health before impact.

Receipt `checks[63]`, `Native pending shell obeys friendly fire off`, records `enemyLoss: 25`, `allyLoss: 0`, `flightTick: 66`, `impactTick: 82`. `checks[69]`, `Native pending shell obeys friendly fire on`, records `enemyLoss: 25`, `allyLoss: 19.599999999999994`, `flightTick: 67`, `impactTick: 82`. Static inspection of the retained impact saves confirms those losses against the initial fixtures. Checks `[59,60]` and `[61,62]` record the off trial's in-flight and impact round trips and replay endpoints; `[65,66]` and `[67,68]` record the on trial's equivalents.

The runner verifies the rules value, actual pending projectile, no pre-impact damage, and ally damage or immunity at `scripts/acceptance/direction-defense.mjs:121-129`. It compares matching enemy losses at line 135. The unchanged implementation at `src/core/simulation.ts:425-435` resolves splash and skips an allied entity only when friendly fire is off. The historical passed tests at `tests/combat-tactics.test.ts:69-70` cover both rule values and saved pending-shell continuation. No wording-specific behavior gap was found for ID 7.

## Historical passed assertions

The following are the byte-exact `fullName` values from the immutable `tests.json`. Every listed entry has `status: passed` and `failureMessages: []` in the suite at the actual tested pin. The index is within the `assertionResults` array for `/home/morgana/.codex/worktrees/assembled-rules401/orcs-vs-Fairies/tests/combat-tactics.test.ts`.

| Assertion index | Relevant ID | Passed fullName |
| --- | --- | --- |
| 5 | 2 | `combat tactics encounters retains held facing and resolves front, side and rear damage through real attacks` |
| 8 | 5 | `combat tactics encounters a frontal shield consumes guard energy; rear and turned shields leave the ally exposed` |
| 9 | 5 | `combat tactics encounters shield support also protects an allied player, and depletion restores full damage` |
| 10 | 6, rock/building only | `combat tactics encounters buildings and rocks reduce ranged hits; cover does not reduce melee damage` |
| 11 | 6, building removal only | `combat tactics encounters destroying a covering structure through combat restores unprotected ranged damage` |
| 12 | 7 | `combat tactics encounters siege shell impact obeys friendlyFire=true and survives a mid-flight save` |
| 13 | 7 | `combat tactics encounters siege shell impact obeys friendlyFire=false and survives a mid-flight save` |

## Artifact authentication

The first-failure manifest seals 303 original files and is unchanged. The checks in this assignment authenticated the receipt, frozen inputs, source inventory, direction manifest, stage 06 receipt/stdout/stderr, the 12 relevant initial fixtures, and 66 named scenario downloads for the flanking/shield/cover/friendly-fire trials against their sealed byte counts and SHA-256. There were no mismatches. This is retention inspection, not the skipped stage 07 native-history run or stage 08 final asset gate.

| Artifact | SHA-256 |
| --- | --- |
| `/tmp/ovf-native-combat-f18a50d-retry-20261001-zssa25k5/first-failure-artifact-manifest.json` | `922c604e7d17c015d878cfd4f1ce0f133df2c208ef5f7ad9ca8b0a9c2b8d9fba` |
| `/tmp/ovf-native-combat-f18a50d-retry-20261001-zssa25k5/browser/browser-native-acceptance.json` | `7c24b87e4a1d8ef89e6164e86a544b29c272a5d00f2cf8d2c604b681a2fbd3a4` |
| `/tmp/ovf-native-combat-f18a50d-retry-20261001-zssa25k5/frozen-inputs.json` | `66f880c7ef685437e56b83708c03972c47cf5cbdb8f7846b243839b613e9fc31` |
| `/tmp/ovf-native-combat-f18a50d-retry-20261001-zssa25k5/fixtures/direction/manifest.json` | `6c681bd8568a7be99160053bee7cd007d195294d1564272a31e14332125ef4ee` |
| `/tmp/ovf-native-combat-f18a50d-retry-20261001-zssa25k5/logs/06-browser.receipt.json` | `dc3475a0ddcc1899ce824e57784f7e35fe995d6df15100114e31c8f700413140` |
| `/tmp/ovf-native-combat-f18a50d-retry-20261001-zssa25k5/logs/06-browser.stdout.log` | `bed2b64d4275abc0bb2ee6bb6bdbb575f0c473ce9898172e35289995e6192147` |
| `/tmp/ovf-native-combat-f18a50d-retry-20261001-zssa25k5/logs/06-browser.stderr.log` | `6330a13f7724aa16618923654e077dddff876c1ccbeda41e52cc5a077ef1e759` |
| `/home/morgana/.codex/worktrees/final-combat-proof/orcs-vs-Fairies/docs/evidence/root-assembly-20261001/combined-rules401-passing-suite-4a71cd0/report.json` | `8711be82822ba830200c91af9936e476c3db3617a6ce6b33089cf329da0590e5` |
| `/home/morgana/.codex/worktrees/final-combat-proof/orcs-vs-Fairies/docs/evidence/root-assembly-20261001/combined-rules401-passing-suite-4a71cd0/tests.json` | `ced75e92e6e198d8bad063fc0e4b276bfd7ee1936bf1849830cafcd21f7a11a9` |
| `/home/morgana/.codex/worktrees/final-combat-proof/orcs-vs-Fairies/docs/evidence/root-assembly-20261001/combined-rules401-passing-suite-4a71cd0/source-before.json` | `53a7006baf049eba955a8cb382ce6355ba3cb6b9e7816848363b386b82df7694` |
| `/home/morgana/.codex/worktrees/final-combat-proof/orcs-vs-Fairies/docs/evidence/root-assembly-20261001/combined-rules401-passing-suite-4a71cd0/source-after.json` | `53a7006baf049eba955a8cb382ce6355ba3cb6b9e7816848363b386b82df7694` |

Retained native payloads for each named checkpoint are in `/tmp/ovf-native-combat-f18a50d-retry-20261001-zssa25k5/browser/`, using the original `<checkpoint>-save.json`, `<checkpoint>-replay.json` and `<checkpoint>-replay-endpoint-save.json` names. Their hashes are in the original first-failure manifest and the receipt's `downloads` map. Initial scenarios are in `/tmp/ovf-native-combat-f18a50d-retry-20261001-zssa25k5/fixtures/direction/` and described by its sealed manifest. No artifact was renamed, overwritten or regenerated.

The candidate decision is narrow. Original IDs 2, 5 and 7 have passed native behavior observations plus relevant historical assertions in unchanged tested code. ID 6 lacks the ruin behavior. Examples from an architecture discussion and unrelated selected encounters are not additional wording requirements. Root owns admission and the shared ledger; this report leaves all existing statuses and the failed batch record unchanged.
