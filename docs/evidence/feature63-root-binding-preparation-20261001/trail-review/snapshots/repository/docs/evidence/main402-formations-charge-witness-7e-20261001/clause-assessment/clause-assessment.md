# Original clauses 1 and 8: retained r4 assessment

This assessment is limited to the original text of feature clauses 1 and 8. It reads existing files only. It does not run the product, import source modules, build, test, open a browser, simulate, query a database, edit the root checkout, or send signals.

The admitted acceptance scripts are pinned at `7e80356c9564151749a7753971fba13eec349509`. The tested product is pinned at `f7f3e187ea40079492589a6fce39f0b33f77f04a`. A static Git comparison returned exit code 0 for `src` and `tests/combat-tactics.test.ts` between those commits. The retained full-suite execution reports 160 files and 2,942 of 2,942 tests passed with no failed or pending tests. The root requirements file at the scripts pin still labels clauses 1 and 8 as `in-progress`; this external assessment does not edit that file.

## Clause 1

The original requirement is: "arrange troops into lines, wedges, squares or loose skirmish groups."

The retained r4 artifacts support this clause. The browser receipt lists line, wedge, square, and loose as completed cases at ticks 168, 180, 167, and 161. Each case records a native fixture import, a public main Tactics formation command for six troops, an accepted move to the requested destination, a complete native save/runtime round trip, and replay endpoint equality. The observation files show all six troops moving from their starting positions and reaching a formed state with the requested formation kind, stable group identity, slots 0 through 5, count 6, spacing 0.8, facing 0, and the accepted anchor. The fixture contains a depot in the direct route, and the retained browser check states that each formation moved and persisted all six troops.

The later charge failure does not invalidate these completed formation cases. It occurred after the four cases had completed and after their save and replay checks had been recorded.

Decision: the retained r4 artifacts support original clause 1.

## Clause 8

The original requirement is: "build impact through movement, with pikes stopping the charge."

The retained native front-charge trace supports the public path and the pike stop. A public right-click attack sent cavalry 54 at held spear 55 from the front. Charge distance grew with movement from 3.675 at tick 47 to 3.85 at tick 48 and 4.025 at tick 49. At tick 49 the rider still had 210 HP, the pike had 125 HP, and their separation was about 2.512. At tick 56 the impact left the rider at 192 HP and the pike at 108 HP, reset charge distance to 0, recorded attacks for 17 and 18 damage, and emitted "Charge stopped by braced pikes." The receipt had already recorded a complete native save/runtime round trip and replay endpoint equality for the tick-56 state.

The current source test adds the comparison needed by "build impact through movement." The test named "moving cavalry gains impact while stops and sharp turns lose the charge" requires charge damage to exceed stationary damage by more than 1.5 times and requires stopped and turned attacks to do less damage than the charge. The test named "frontal braced pikes cancel charge and hurt the rider; a rear charge retains impact" requires about 17 front damage, more than 10 rider damage, a reset charge, rear damage above 1.5 times the front damage, and no rear rider damage. These tests are unchanged between the tested product pin and the scripts pin and passed in the retained 2,942-test suite. The source readback shows movement accumulating charge distance, stops aging it, sharp turns clearing it, movement distance increasing the impact factor, frontal held spears returning pike damage and clearing the charge, and the simulation applying that damage while emitting the stop message.

Decision: the retained r4 artifacts support original clause 8.

## Failure qualification and limits

The r4 browser receipt has `completed: false` because `canonical-main-smoke.mjs:60` required the downloaded file named `charge-pike-front-moving-save.json` to retain charge distance of at least 4. The UI/download timing saved the state at tick 56, after impact had reset the charge to 0. The native trace had already recorded charge distance above 4 at tick 49 and the pike stop at tick 56. The failing assertion is an extra checkpoint condition and is not part of the original clause.

The receipt also records `cleanup.completed: true`, no cleanup errors, no browser errors, no asset failures, 19 successful checks, and authenticated metadata for 30 downloads. The history batch did not run, and rear and later native cases were not executed. This assessment does not treat overall receipt completion, history-batch completion, a native rear case, or a pre-impact downloaded checkpoint as requirements for these two original clauses. It also does not assess any other feature clause or the batch as a whole.

Only the root agent may admit these findings after direct authentication and closure.
