# Original clauses 4, 9, and 10: retained native assessment

This assessment is limited to the original text of feature clauses 4, 9, and 10. It reads the closed retained run at `/tmp/ovf-main402-remaining-2e5-r1` and existing source and test records. It does not run the product, import source modules, build, test, open a browser, simulate, query a database, edit the root checkout, or send signals.

The admitted scripts are pinned at `2e5d8780565ede9432e3950052e7a5c4fc635570`. The tested product is pinned at `f7f3e187ea40079492589a6fce39f0b33f77f04a`. A static Git comparison returned exit code 0 for `src` and `tests/combat-tactics.test.ts` between those commits. The retained full-suite execution reports 160 files and 2,942 of 2,942 tests passed. The relevant retreat, surrender, crew capture, and ambush tests each report `passed`. The root requirements file at the scripts pin still labels clauses 4, 9, and 10 as `in-progress`; this report does not edit it.

## Clause 4

The original requirement is: "isolated or badly damaged squads can retreat or surrender."

The retained native run supports this clause. The morale fixture imported seven full-health siege units and six full-health opposing troops with morale 100 and no recent loss. The recipe timed out while waiting for every selected siege engine to retain an explicit attack order. The game continued during that wait. At the retained native last state, tick 317, cavalry 61 had 62.116 of 210 HP and morale 24.886. Cavalry 62 had 48.773 of 210 HP and morale 20.756. Both had active retreat state and move orders toward the side-1 HQ at 42.5, 42.5. This is direct product evidence of badly damaged squad members retreating automatically.

The failed attack-order wait is a supplemental recipe condition. The original clause does not require a pre-volley checkpoint, a particular attack-order chronology, a fixed endpoint, or a completed batch. Its "retreat or surrender" wording permits the retreat branch shown in the native last state. The unchanged passing tests add both branches: an isolated wounded fighter retreats and moves from its starting point, while a surrounded broken fighter surrenders without healing and becomes controllable by the captor.

Decision: the retained evidence supports original clause 4.

## Clause 9

The original requirement is: "defeat their crews and claim the equipment."

The completed native siege case supports this clause. Engine 55 began with a full crew at 42 of 42 HP and a full 185-HP hull. Public attack input produced 15 and 12 crew damage. At tick 69 the crew reached zero, the engine became uncrewed, the hull remained at 185 HP, and the game emitted "Siege crew defeated: engine uncrewed." The public Tactics capture command then recorded an incomplete channel at tick 129. At tick 174 the engine changed from side 1 to side 0, its crew returned to 42 of 42, and the game emitted "Siege crew replaced: engine captured." The captured engine then moved under the new owner and fired a shell that dealt 109 damage at tick 382.

The receipt records complete native save/runtime round trips and replay endpoint equality for crew defeated, mid-capture, new owner, new-owner movement, the pending shot, and the impact. In every checkpoint pair, the downloaded native save and replay-endpoint save have the same byte count and SHA-256 hash.

Decision: the retained evidence supports original clause 9.

## Clause 10

The original requirement is: "conceal troops and set conditions for revealing them."

The completed native ambush case supports this clause. The main Tactics panel rejected ambush on dry ground, then accepted a public `Set ambush` command for archer 55 in woodland with trigger radius 2 and target type `melee`. The retained concealed checkpoint at tick 153 preserved that radius, target type, and concealed state. A hostile worker already inside the radius remained at its full 85 HP because it did not match the selected role. When the authored melee target entered the radius, tick 311 recorded "Ambush triggered," cleared concealment, assigned the attack order, and dealt 15 damage. The final checkpoint was saved at tick 314.

The receipt records complete native save/runtime round trips and replay endpoint equality for both the concealed and triggered checkpoints. Each native save has the same byte count and SHA-256 hash as its replay-endpoint save. The concealed panel screenshot also shows the applied command, radius 2, and "Melee troops" trigger selection.

Decision: the retained evidence supports original clause 10.

## Failure qualification and limits

The browser receipt has `completed: false` because the morale case timed out at `canonical-main-smoke.mjs:99` while waiting for all seven siege units to show an attack order against the primary target. The receipt records `cleanup.completed: true`, no cleanup errors, no browser errors, no asset failures, 22 successful checks, and SHA-256 plus byte metadata for all 43 downloads. The siege and ambush cases completed before the morale failure. The normal history phase did not run.

The missing history phase does not leave a concrete part of the three original sentences unproved. Clauses 9 and 10 have native commands, observer chronology, authenticated complete checkpoints, and replay endpoint equality. Clause 4 has the actual retained native retreat state plus unchanged passing retreat and surrender tests. No partial history audit is required for this narrow clause assessment. Overall receipt completion, a pre-volley morale download, the later morale recipe conditions, or completion of the whole remaining-combat batch are not additional feature requirements.

Only the root agent may admit these findings after direct authentication and closure.
