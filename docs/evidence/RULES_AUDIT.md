# Simulation rules audit

The earlier source revision passed all 54 tests on 2026-09-04 at 23:15:50 America/Los_Angeles, using `npm test -- --silent=false --reporter=verbose`. This comprised 52 focused rule cases and two complete AI-vs-AI matches. `npx tsc --noEmit` also passed. The audit changed tests only; runtime source, content and `dist` were not modified.

## Requirement mapping

Source references below refer to `src/core/simulation.ts` unless another file is named. Focused test references refer to `tests/simulation.test.ts`.

| Rule | Current implementation | Executed evidence |
| --- | --- | --- |
| Finite wood and ore | `createGame`, lines 23–25, creates finite mirrored reserves. `gather`, lines 132–141, clamps extraction to the remaining amount, harvesting rate and remaining carry capacity. | Two cases at test line 74 start with eight units of wood or ore, require cargo before income, exhaust the node, deposit exactly eight, then verify no further income. |
| Return deposits | `gather`, lines 133–139, returns full cargo or the final partial load to the nearest completed living friendly HQ/depot before crediting the player's matching resource. | The same two finite-resource cases require the return trip; full matches record hundreds of deposit events. The earlier deposit pathfinding failure is covered by these retained cases. |
| Construction and repair | `issueCommand`, lines 49–51, validates a worker, costs, sight and placement before one payment. `construct`, lines 143–147, requires proximity, advances progress, and charges wood for repair. | Tests at lines 86, 100 and 128 verify payment once, no unattended construction, completion/capacity, invalid placement rejection and bounded repair spending. Tests at line 292 remove the AI's builder and require completion of the same paid foundation by a survivor. |
| Recruitment | `issueCommand`, lines 43–45, validates ownership, completed production buildings, unit role, funds, queue length and capacity reservations. `production`, lines 149–152, advances the configured training time and finds a walkable spawn. | Tests at lines 37, 55, 62 and 108 verify foreign-building rejection, affordability, role restrictions, shared capacity reservation, training delay and one payment. Both full matches recruit combat units under current doubled training times. |
| Population | Lines 32–33 count living non-illusion units, completed HQ/depot capacity, and reservations across producers. Production pauses when population meets/exceeds remaining capacity. | Queue reservation test at line 62; new capacity-loss/recovery case at line 116; illusion population case at line 264. Both full matches require each player's population to stay at or below 100. |
| Movement and combat | Pathing/collision is implemented at lines 77–120. `damage`, `die`, `enemy` and `fight`, lines 121–131, apply damage/armor/cooldown, remove casualties, require visible acquisition and award a winner on HQ death. Explicit attack orders also lose invalid/hidden targets at line 164. | Tests at lines 138–182 cover actual displacement heading, exact waypoint arrivals, axis slides and eight attack headings. Lines 202 and 212 verify building and ore clearance plus arrival. Line 231 verifies damage, casualty removal, no win from a unit death, HQ victory and command rejection after victory. |
| Orc momentum | Content assigns `momentum` to the three orc combat roles. Lines 123–124 use it for damage and attack-rate bonuses, line 160 decays it, and lines 67–75 implement the manual boost/cooldown. | Line 242 verifies growth through combat and decay away from it. New line 250 compares real damage with/without War Cry against equivalent targets and rejects immediate repeat activation. |
| Fairy illusions | Content assigns `illusion` to Veilweaver. Lines 69–70 spawn two temporary doubles; population excludes them, damage is reduced at line 123, and line 160 expires them. | Line 264 verifies two doubles, no population consumption, cooldown rejection, expiry and later reuse. The content override case at line 330 verifies the same ability can be assigned to a worker. |
| Fairy healing grove | Content assigns `heal` to Moonwell. Line 161 heals nearby living friendly units only once the building is complete, capped at maximum HP. | Line 274 verifies nearby healing, distant non-healing and HP cap. New line 281 verifies an unfinished grove gives no healing and a nearby enemy remains unhealed. |
| Honest AI economy | `runAI`, lines 170–190, chooses actions and invokes the same `issueCommand` used by players. It has no separate resource grant, free spawn or accelerated production path. | Line 308 gives the AI zero funds and no resources, then requires unchanged entity count, no queues and zero income after 120 seconds. The same shared cost, production, construction and population rules run in both full matches. |
| Honest AI fog | Resource selection at line 173 and enemy selection at line 186 filter current visibility; target commands independently validate visibility at line 61. Unknown-map movement remains allowed for scouting. | Line 316 changes hidden enemy positions and requires identical AI orders/economy. New line 323 retains hidden resource nodes and proves AI workers do not gather them. Line 46 rejects a hidden attack target; line 195 verifies explored terrain persists while current vision disappears. |
| Editable faction content | Unit/building definitions resolve through player faction and semantic role, lines 10–17. Core behaviors use assigned ability names. Current rosters and their four building roles are in `src/core/content.ts`. | Line 330 changes worker health, cost, training and ability assignment, then exercises recruitment and ability through commands. `CONTENT_REPLACEMENT.md` separately records the actual browser artwork/name/stats/recruitment/ability replacement. |

## Full matches

`tests/skirmish.test.ts` starts normal game state and calls the public AI for both sides. It injects no units, resources, damage or outcomes after initialization. Both sides must gather, recruit, complete barracks and depots, fight and remain within resource/population bounds; a headquarters must die within the unchanged 15-minute fixture deadline.

The orc-start match ended at 893.55 seconds with side 1, fairies, winning. The fairy-start match ended at 649.85 seconds with side 0, fairies, winning. These match the existing pacing evidence. Both sides completed all four building roles. The fixtures prove complete automated rule execution for this fixed map, not broad balance or every possible human strategy.

## Coverage added and remaining limits

This audit added four cases where source rules previously had only indirect coverage: recruitment after capacity loss, the actual damage effect of War Cry, incomplete/enemy healing exclusion, and rejection of hidden resource gathering by the AI. All four passed without runtime changes. No failing rule was found in this bounded audit.

The suite does not exhaustively exercise every transition involving cargo and interrupted orders, such as redirecting a partially loaded worker between resource kinds after a drop-off is destroyed. The finite-node test directly proves an HQ deposit; it does not separately isolate every possible nearest-depot choice. The illusion test proves creation, expiry, cooldown and population treatment, but does not isolate its reduced damage multiplier or every enemy target-selection interaction. These are coverage limits, not observed failures.

AI visibility proof combines current-source inspection with specific behavioral cases; it is not a universal proof over every generated state. The AI knows the fixed opposing starting coordinate and may issue a scouting/attack-move there without seeing an enemy. Players can likewise order movement into unexplored terrain; target-specific attacks still require visibility.

No test in this suite proves rendered fog, mouse/keyboard controls, readable faction art, audio, browser frame rate or human match pacing. Those requirements need their separate browser evidence. The suite also does not validate arbitrary malformed future content definitions; the current typed definitions and one valid replacement are the tested scope.

Verified SHA-256 hashes:

```text
ff84c20e0f0badec8c3194c20cc4bb5aba7b82189ea94a8eacd0cd8b60e5a3bf  src/core/content.ts
b259c9e3a8a5f9459898fd672b1b04e581c95db8bbea62dd09de92cae982a000  src/core/simulation.ts
8c5859c57d03825eb0b982a1ac32f4939c27eab04c10386020dadfddd7fc344e  tests/simulation.test.ts
8d8a1b7ad480a563ab7d4cfa9096abf7141a9c829dc56cff99d7b2cc27b28793  tests/skirmish.test.ts
```

## Prior revision: scouting and movement corrections (2026-09-04, 23:35 PDT)

The 54-test result and line-number mapping above describe the earlier recorded revision. Subsequent grouped-scout testing exposed failures that were not covered by that audit. The current suite has **58 passing tests** (56 focused rules and two complete automated matches); `npm test` took 4.36 seconds at 23:34:51 PDT, and `npx tsc --noEmit` passed. The full-match deadline remains 900 simulated seconds.

The AI now dispatches its initial scout only once per side per match. Two regressions kill that scout, recruit its replacement through the paid production queue, and require the replacement to wait for a group. They also verify that a visible headquarters threat and a sufficiently large army still trigger dispatch. No resources, training times, damage or content values changed.

Before the movement fixes, the grouped orc-start match had no winner at 900 seconds. A diagnostic continuation to 1,200 seconds still left both headquarters at full health (1,800 / 1,650), despite active economies and new recruits. `work/grouped-scout-diagnostic.json` preserves that historical diagnostic. Two concrete stalls were reproduced:

- An orc at `(30.63155634063932, 29.404596376336357)` could not leave a resource corner. Its containing cell center `(30.5, 29.5)` was walkable, but the connector from its actual position passed within approximately 0.698303 tiles of the resource at `(31, 30)`, inside the 0.7-tile clearance. Another resource stood at `(30, 29)`. Repeated routes demanded this same blocked connector. Route initialization now validates the entire connector against resource circles and building rectangles. When the containing center cannot be reached safely, A* starts from safely reachable neighboring centers; travel remains incremental at normal unit speed.
- A ranged attacker 7.18 tiles from a stationary unit accepted a movement stopping distance of 7.2 while its attack check required distance at most 7. The movement stopping distance incorrectly included a unit radius that the attack check excludes. It now includes target extent only for buildings, matching the attack check.

Both new regression cases failed before those fixes and pass afterward. The resource-corner regression issues an ordinary move command from the exact reproduced coordinates, checks every traveled segment remains at least 0.7 tiles from both resources, checks displacement never exceeds normal speed times timestep, and requires arrival. The combat case orders an attack against a stationary target just beyond weapon range and requires movement followed by actual damage. Existing building-clearance, resource-edge, movement-facing, construction and economy cases also pass.

On the current revision, the normal orc-start automated match ends at **546.80 seconds**, side 0 orcs winning; the fairy-start match ends at **538.20 seconds**, side 1 orcs winning. These are roughly nine-minute matches, below the requested 10–15-minute target. The tests prove the fixed scenarios finish without the observed stalls; they do not establish target human pacing or broad balance. The older 893.55 / 649.85-second outcomes above are historical and must not be presented as current pacing evidence. No deadline was loosened, and no artificial outcome or bonus economy was introduced.

Current SHA-256 hashes:

```text
7fa4f329b58157493508128ee1938ebed2f335e718c199354b2d598a4ef70d4f  src/core/simulation.ts
ff84c20e0f0badec8c3194c20cc4bb5aba7b82189ea94a8eacd0cd8b60e5a3bf  src/core/content.ts
799bbb46cf37d43174ba287adcc97de290b13a46e569a1669163f457fcf18b1a  tests/simulation.test.ts
8d8a1b7ad480a563ab7d4cfa9096abf7141a9c829dc56cff99d7b2cc27b28793  tests/skirmish.test.ts
```

Root verification also ran `npm test` on the corrected source: all58 tests passed with exit0. The retained output is `docs/evidence/current-tests.txt`. `npm run build` also produced `index-6tDjccOB.js` successfully. These establish current tests/build; complete browser pacing remains open.

The corrected production build received a separate fairy browser smoke check. Drag-selected workers accepted a right-click ore order and completed return deposits (220 starting ore increased to652 by pause). F2 selected the Thornblade; A plus a ground click moved it to the destination and returned it to Ready. All31 assets loaded, and browser error/warning logs were empty. `corrected-build-fairy-smoke.json` retains the paused state. This short check is not a complete match or pacing proof.

`current-verification.json` binds the retained test output to hashes of all current TypeScript source/tests and package inputs, checked before and after a further58-test run. The inputs did not change during that run.


## Current revision: shared harvest pacing (2026-09-05)

The shared harvest rate is now exported as `ECONOMY.harvestPerSecond` in content and set to 2.28 resources per second, replacing the previous literal 3.8. Both sides and both resource kinds call the same gather implementation. Capacity, travel, prices, training, army thresholds, combat and clock are unchanged. All 58 existing tests pass in 5.11 seconds; no test deadlines or assertions changed. `current-tests.txt` and `current-verification.json` retain this run and its source hashes. The preceding movement audit's retained manifest/output are now `pre-harvest-current-verification.json` and `pre-harvest-current-tests.txt`.

The adopted-source automated runs reproduce 650.30 and 616.35 seconds, both orc victories, with actual casualties and reinforcement cycles. See ECONOMY_STUDY.md for the original diagnostic, adopted rerun and remaining causal uncertainty. `npm run build` succeeds and produces `index-BbPjUpKo.js`. Full human matches and performance on this economy revision remain separate completion checks.

The adopted production bundle received a normal-browser harvest check. Five drag-selected Scrappers took right-click wood orders, then ore orders. The HUD rose from 420 wood / 220 ore to 713 wood / 814 ore by pause at 173.60 seconds, with no purchases. Two stationary five-second wood-harvest intervals measured 2.28 carried resources per second. Saved evidence: `harvest-rate-observation.json`, `harvest-smoke-session.jsonl`, and `harvest-browser-smoke.json`. Browser script URL was `/assets/index-BbPjUpKo.js`; error/warning logs were empty. This is an integration smoke check, not a complete match.
