# Original combat IDs 1, 4, 9 and 10 assessment

Reviewer: OpenAI GPT-6.1 Sol in Codex. The spawn requested `gpt-5.6-sol`, but the active model was GPT-6.1 Sol. `modelIdentitySource` is the trusted active orchestration message from the parent/root host, which reported the requested and active models separately. The active identity controls this attribution. No sub-agent contributed.

All four original sentences are met by recorded executed behavior on code and tests that remain unchanged through root HEAD `9024c59674c4bbe471b5d0dbb467ce69b20d1584`.

| ID | Original feature | Decision | Executed behavior |
| ---: | --- | --- | --- |
| 1 | Army formations: arrange troops into lines, wedges, squares or loose skirmish groups. | Admit | Four passing encounter cases issue each formation command, move mixed troops to their formation destinations and regroup survivors after a casualty. Four passing mounted-panel tests dispatch the same formation kinds. |
| 4 | Morale: isolated or badly damaged squads can retreat or surrender. | Admit | A passing encounter makes an isolated fighter at half health retreat, while allied support prevents retreat and restores morale. Another passing encounter makes a badly damaged, low-morale fighter surrounded from three directions surrender and accept only its new owner's commands. |
| 9 | Capturable siege engines: defeat their crews and claim the equipment. | Admit | A passing encounter kills a siege crew without destroying the engine, observes neutral ownership, captures it through the normal channel, preserves its original definition, restores its crew and moves it under the new owner. |
| 10 | Ambush orders: conceal troops and set conditions for revealing them. | Admit | A passing encounter issues an ambush order with a melee target and radius, verifies enemy observations cannot see or target the concealed troop, then reveals it and attacks when a melee enemy enters the selected radius. |

## Evidence standard

The wording comes directly from `/home/morgana/.codex/attachments/917bc3a6-a1e9-4a3e-b2eb-8682eb3c4ec4/pasted-text-1.txt`, 8,555 bytes, SHA-256 `2cd629293a1b8e04c56ecb1909edd284409b4687895519bd67b28e192f6fd948`. Later architecture examples and fixture extras are not requirements.

The execution record is the retained suite at `/home/morgana/.codex/worktrees/final-combat-proof/orcs-vs-Fairies/docs/evidence/root-assembly-20261001/combined-rules401-passing-suite-4a71cd0`. Its `report.json` identifies tested commit `4a71cd07bacc12d214acaf5a0f95a7d9b486f52c`, command exit 0, input integrity passed, 2,920 of 2,920 tests passed, 157 test files and 377 passed suite entries. The selected `tests.json` assertions all have `status: passed` and empty failure messages.

With replacement objects disabled, `src/core` has Git tree `d73253481ba0cb85afdf71bc09948a710981902f` and `tests` has tree `dc095381fd75be2a6b54dc1d6d4bc9dfd733a488` at the tested commit, native commit `f18a50d904c57ae1652f157b946ebd39d8d8923c` and root HEAD `9024c59674c4bbe471b5d0dbb467ce69b20d1584`. Git diffs across `src/core` and `tests` are empty. The executed assertions therefore apply to the root code without claiming a new root test run.

The current tactics panel also has executed linkage. `src/ui/TacticsTools.ts` has blob `300edac6a1d55c3f7f714e6729b91b5b7da3ab25` and `tests/tactics-tools.test.ts` has blob `035ae73ce08dfb2e2d6a62f56fb7ad8b79985108` at all three commits. The suite records all 19 panel assertions as passed. Root `src/main.ts:378` mounts this component against the live scene state, selection, player side, command path and command permission. The main entry point changed between the suite and native commits, but its blob `2035c932e7c2b9fc1bfa00c5881050ac7f036986` is identical at the native and root commits.

The requested nested evidence path was not present. The mounted evidence is tracked at `/home/morgana/Projects/orcs-vs-Fairies/docs/evidence/combat-tactics-20261001`. Its `browser/results.json` blob is `4c999947625a331162e8092de639593a076f2b6b` at both its last-modifying commit `317e47ba0c9e41f1529bb36f90e7356dd88446ad` and root. It records accepted panel commands for line, wedge, square, loose, ambush, ambush release and siege capture, with no browser errors. The retained screenshots visibly show the mounted Phaser scene and panel states.

That browser run is corroboration rather than an exact current-source proof. `TacticsTools.ts`, `src/main.ts` and `tests/tactics-tools.test.ts` changed after its capture commit. The current suite's passing panel assertions and the exact UI/test blobs through root provide the current component linkage. The original feature sentences require the behaviors, not completion of every native encounter group or a new browser capture.

## ID 1

Assertion indices 0 through 3 in `combat-tactics.test.ts` are separate passing cases for line, wedge, square and loose. Each creates six mixed combat troops, issues the real formation command, verifies stable slots, issues a real move, advances the simulation, checks every survivor is within the formation destination tolerance and facing the formation direction, kills one member through a weapon hit, then verifies the remaining five receive compacted slots and regroup at the saved anchor. Index 4 also verifies that arbitrary entity-array and command-ID order produces the same destinations.

The panel assertion indices 1 through 4 click Line, Wedge, Square and Loose controls. They verify that the panel sends a real formation command for the selected owned combat army and that each unit receives the chosen kind and facing. The mounted browser result separately records all four accepted commands and `lineFormationReachesArmy`, `wedgeFormationReachesArmy`, `squareFormationReachesArmy` and `looseFormationReachesArmy` as true.

This is enough for the original sentence. Routing around a depot, casualty regrouping, deterministic ordering, facing and custom spacing are useful coverage, not extra admission conditions.

## ID 4

Assertion index 6 creates a melee fighter at half health with morale 28, no nearby ally and a nearby enemy. After two seconds it has a retreat destination, a move order and a changed position. A control with a nearby allied spear does not retreat and its morale rises. The retreating state also continues to the same checksum after save and resume.

Assertion index 7 creates a Dwarf ranged fighter at 30 health and morale 1, surrounded by three enemy melee troops in distinct directions. After a simulation step, the fighter changes side without healing or changing its original faction definition, records `surrenderedTo`, rejects its former owner's move command and accepts its new owner's command.

The game applies morale to each controllable combat unit. The original sentence does not require a separate multi-entity squad object or every possible route to morale loss. The executed wounded-isolation retreat and surrounded low-morale surrender satisfy the two outcomes it names. The panel and battlefield overlay display morale and retreat state, but this automatic behavior does not need a manual command.

## ID 9

Assertion index 16 starts an enemy siege engine with one crew health, then attacks through the normal command and simulation path. The engine remains at full equipment health while the crew becomes defeated and uncrewed. The prior owner observes no owner and cannot move it. A normal capture command reaches about half progress after two seconds, survives save and resume, completes after the four-second channel, changes the engine to the captor's side, restores its crew, preserves the original Orc definition, accepts movement from the new owner and rejects commands from the old owner.

Assertion index 17 adds an enemy guard. Capture progress remains zero while contested and completes after the guard leaves. Panel assertion index 7 captures a visible abandoned engine through real channel completion, while index 8 displays live halfway progress. The mounted browser result begins with an authored uncrewed Fairy engine, records an accepted capture command and ends with side 0, a restored 42/42 crew and the Fairy definition preserved.

The browser fixture does not defeat the crew, so it cannot prove that clause by itself. The executed encounter does. Together, the record covers both actions in the original sentence: defeat the crew, then claim the intact equipment.

## ID 10

Assertion index 18 places a ranged troop beside standing wood, issues an ambush command with radius 2 and target `melee`, and verifies the troop holds fire. The enemy player cannot observe it and cannot issue an attack against it. When a melee enemy moves into the selected radius, the ambush becomes exposed, the target takes damage and the troop becomes observable.

Assertion index 19 covers other reveal paths: close cavalry scout detection, manual release and loss of the concealing wood. It also verifies that an enemy observation does not disclose the private ambush condition. Index 20 records formation, ambush and combat history replaying to the same checksum.

Panel assertion index 6 chooses radius 2.75 and target `cavalry`, dispatches the ambush only to selected troops in real tree concealment, verifies their concealed hold state and releases it through the panel. The mounted browser result records the same accepted command, shows the selected trigger values and records `ambushConditionReachesConcealedArmy` and `ambushReleaseReachesArmy` as true.

The selected target and radius are conditions for revealing through an attack trigger, so the original sentence is met. Scout detection, manual release, damaged concealment, private observation filtering and replay stability are additional behavior rather than admission requirements.

## Limits

This was static inspection. I did not run a build, test, simulation, browser, replay, database operation or checker. I did not hash the large suite artifact or any source tree. I read the original wording, suite report and selected assertion records; inspected the corresponding test, source and mounted UI artifacts; compared Git trees and blobs; and wrote only this new `/tmp` assessment and its machine-readable companion plus the separate model-attribution addendum requested for the prior review.

These are per-sentence admission findings. Root owns ledger and status changes. The findings do not relabel the failed 39-encounter batch or claim that every fixture example is required.
