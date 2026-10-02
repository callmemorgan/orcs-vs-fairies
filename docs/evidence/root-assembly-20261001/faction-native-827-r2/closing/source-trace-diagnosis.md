# Fury assertion diagnosis at retained 827 r2

Codex / GPT-6. This report uses retained JSON and the unchanged source at `827496b06bb660b6639257e5113ac2f199be29ba`. It does not execute or import the application, run tests/builds/browser/simulation, alter the checkout, relax assertions, authorize a retry or promote a feature.

The first failure is a strict equality on `factionSystems.fury[0]` after Assault in `scripts/acceptance/faction-powers.mjs:41`, with expected 49.97288 and actual 52.09508. The earlier HP description was wrong. Target health supplies evidence about new Fury earnings; it is not the failed assertion.

## Recorded state and command boundary

The retained before-Assault save and matching native-import-7 end at tick 579, time 28.950000000000276, Fury 74.97288. Failure lastState is tick 606, time 30.300000000000296, paused, Fury 52.09508. This is 27 ticks or about 1.35 seconds from the retained checkpoint to the failure snapshot. The browser's live `beforeAssault` snapshot was not separately retained, so its tick cannot be inferred to equal 579. Its Fury is supported by the strict assertion's reported expected value plus 25.

The retained replay ends at tick 579 with no warChant action. Its nine accepted command records are attacks by earners 51/52/53 at tick 71; move and Hold for 51 at ticks 362 and 390; move and Hold for 52 at 414 and 444; move and Hold for 53 at 466 and 496; soldier 55 attacks target 56 at 522 and holds at 571. The final recorded action advances eight ticks to 579. There is no post-cast session/replay archive because the assertion failed before the next checkpoint. The actual post-checkpoint command prefix and instantaneous debit are therefore not directly available.

Target 56 loses 17.685 HP, from 150.226 to 132.541. Decimal arithmetic gives `52.09508 - (74.97288 - 25) = 2.12220`, equal to `17.685 * 0.12`. Failure target 56 records lastAttacker 55 and lastDamagedAt 30.200000000000294; soldier 55 records that same lastCombatAt. The preserved states are consistent with a normal paid chant plus fresh damage credit. They do not independently establish every transaction between snapshots. Side-one damage against defender 61 earns side-one Fury and cannot explain this side-zero difference.

Soldier 55 remains at (18.32752396715319, 21.480523950925516), distance 6.494439459172267 from held target 56 at (24.5, 23.5). Its normal range is 6.5 (`src/core/content.ts:11`). Before-cast cooldown is 1.2215259724334133. The raw final chant is assault until 42.050000000000296. Under the unchanged source's 12-second expiry rule, this implies cast time about 30.050000000000296; that is a conditional source derivation rather than a recorded command tick.

Both retained checkpoint projectile arrays are empty, and the before-Assault save's runtime.hits is empty. Ordinary Boltspitter damage follows `queueWeaponHit`, then `resolveHits` within a simulation step (`src/core/simulation.ts:401–423,471–489,570`). This soldier does not use the delayed siege-shell branch. Empty final events do not establish that no earlier hit occurred, because event clearing happens during stepping.

## Source behavior

`select` resumes the simulation, and `action` calls panel/select, opens the panel, clicks the enabled button, waits for its ordered notice and pauses (`faction-powers.mjs:18,20,22`). `native-context.mjs:81–86` implements pause/resume through visible controls; runUntil also resumes and pauses. Those UI operations allow completed simulation ticks before the final snapshot. Hold means attack in range without pursuing (`src/game/GameScene.ts:263`; `src/core/simulation.ts:562–563`). It does not suppress Fury earnings while the shooter remains within range.

`issueFactionCommand` subtracts 25 synchronously for an accepted warChant and writes a 12-second chant (`src/core/faction-systems.ts:75–77`). Eligible resolved damage adds actual amount × .12, capped at 100 (`:88`; `simulation.ts:474,483–489`). The raw equality assumes no additional eligible damage across the live snapshot interval; the native preparation does not establish that assumption.

Keeping the native game paused cannot cast. `GameScene.canCommand` requires !paused (`src/game/GameScene.ts:133–134`), and FactionTools uses canIssueCommands and the scene.command path (`src/main.ts:379`). The disabled final buttons visible in the actual PNG agree with this source contract.

## Unexecuted candidate and limits

The candidate inserts `await move(ids.soldier,ids.startingPoint);await stop(ids.soldier);` between the unchanged baseline-hit checkpoint and before-Assault checkpoint. It uses the existing native controls and retains every original assertion, including exact cost checks and native-history auditing. The patch and full derived script are separate /tmp artifacts; owned source remains untouched.

The authored return point is (16.5,20.5), distance 8.54400374531753 from target 56. The existing move near predicate accepts less than .8 error, so that predicate alone leaves a minimum target distance greater than 7.744, above the 6.5 range on this flat clear map. Earners 51–53 are already held near their original points, and bank target 54 is absent. Defender 61 has a long cooldown and an independent enemy encounter. Before-state player upgrades are age unlocks, world elevation is zero on both layers, and soldier rank is zero with no promotions. These source and retained facts support withdrawal as a preparation change; they do not prove its runtime result.

Travel and UI delay may alter momentum, target health, defender timing, later baseline/Assault comparisons and the duration left on the chant. Future enemies could enter range while held. A new run must preserve the original full gate, all assertions and original failure bytes, then collect the accepted chant in the native replay and matching paid checkpoint. The current packet grants no feature credit.
