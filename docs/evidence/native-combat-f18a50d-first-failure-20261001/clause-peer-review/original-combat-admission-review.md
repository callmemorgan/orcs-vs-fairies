# Original combat feature admission review

Reviewer: OpenAI GPT-6.1 Sol in Codex. This was an independent static review. No sub-agent contributed to it.

The original wording supports admitting IDs 2, 5, 7 and 8. ID 6 should remain pending because its explicit ruin-cover case is absent from the simulation and from both recorded evidence sets.

| ID | Original feature | Decision | Reason |
| ---: | --- | --- | --- |
| 2 | Flanking bonuses: reward attacks against an enemy’s sides and rear. | Admit | Native attacks against one held-facing target dealt 12 from the front, 15 from the side and 18 from the rear. The unchanged passing test records the same ordering through ordinary attacks. |
| 5 | Directional shields: shield units protect troops standing behind them. | Admit | A front-facing guard reduced the troop's loss from 17 to 6.8 and spent guard energy. Turning the guard or attacking from behind bypassed it. Depletion restored the full 17 damage. |
| 6 | Cover: rocks, ruins and buildings reduce incoming ranged damage. | Hold | Rocks and live buildings reduce ranged damage, but no ruin exists as simulation terrain or cover geometry. The only ruin references are presentation asset names. |
| 7 | Siege friendly fire: careless artillery placement can hurt your own army. | Admit | With friendly fire enabled, a normal siege shell damaged the allied troop beside its target by 19.6. The same placement caused zero allied loss when the rule was disabled. |
| 8 | Cavalry charges: build impact through movement, with pikes stopping the charge. | Admit | Native evidence shows movement building 4.9 charge distance and raising impact from 15 to 29.4 damage. The recorded passing test on identical core code shows a frontal holding pike cancels the charge bonus, resets charge to zero and damages the rider. |

## Review standard

I compared each clause with the original text in `/home/morgana/.codex/attachments/917bc3a6-a1e9-4a3e-b2eb-8682eb3c4ec4/pasted-text-1.txt`, not with later architecture examples. The file is 8,555 bytes and has SHA-256 `2cd629293a1b8e04c56ecb1909edd284409b4687895519bd67b28e192f6fd948`.

This review combines the completed native observations retained before the stage 06 failure with the immutable 2,920-pass suite where the relevant core and test code is unchanged. It does not require the failed 39-encounter batch to become a completed group, and it does not add movement immobilization, every-angle pike behavior, or native pike playback as new wording requirements.

The two supplied reports match their assigned hashes. `/tmp/ovf-f18-ids2-5-6-7-static-ahaqurz8/assessment.md` is 18,333 bytes with SHA-256 `bc5faa208b5fae5284f578ae9698cee81d94edb483f6630cff4bfa07378097fc`. `/tmp/ovf-f18-id8-combined-evidence-20261001-a35ds1nu/id8-combined-evidence-review.md` is 17,565 bytes with SHA-256 `a910ad0ceb253e151a64523ed7ca7b7fe9ceb708e51ff812d7a057e18ba0221d`. I checked their conclusions against the original receipt, retained saves, test result JSON and Git blobs rather than treating either report as proof by itself.

## Provenance

The native receipt at `/tmp/ovf-native-combat-f18a50d-retry-20261001-zssa25k5/browser/browser-native-acceptance.json` identifies runtime commit `f18a50d904c57ae1652f157b946ebd39d8d8923c`, SAVE version 4, simulation revision `4.0.1` and expected build ID `5e49e689af13d4eef08c0760f904ad0bce2c2eebaa1144dea5d89cadecf310c0`. Its source list contains 191 entries. The first-failure manifest seals 303 files totaling 94,034,440 bytes. It records 84 checks, zero complete groups, no native-history stage, no final asset gate, and all 39 encounters still open.

Stage 06 failed while verifying the replay endpoint for `charge-stop-interrupted`. The replay was at tick 0, paused, and `art.loaded` was false when the 60-second readiness wait expired. The failure occurred after checks 0 through 83 had been appended. It prevents treating the batch as complete, but it does not contradict the earlier retained saves and check values used for IDs 2, 5 and 7 or the two completed charge-impact observations used for ID 8.

The immutable suite at `/home/morgana/.codex/worktrees/final-combat-proof/orcs-vs-Fairies/docs/evidence/root-assembly-20261001/combined-rules401-passing-suite-4a71cd0` identifies tested commit `4a71cd07bacc12d214acaf5a0f95a7d9b486f52c`. `report.json` records command exit 0, input integrity passed, 2,920 of 2,920 tests passed, 157 test files and 377 passed suite entries. Its before and after source inventories are byte-identical. The `tests.json` artifact records the relevant `combat-tactics.test.ts` assertions as passed with empty failure messages.

With replacement objects disabled, `src/core` has Git tree `d73253481ba0cb85afdf71bc09948a710981902f` at both commits, and `tests` has Git tree `dc095381fd75be2a6b54dc1d6d4bc9dfd733a488` at both commits. A path-limited Git diff across `src/core` and `tests` is empty. The relevant blobs also match at both commits: `src/core/tactics.ts` is `b5052c62671aa875caa9215655683d40d2c8a5dd`, `src/core/simulation.ts` is `66bd44db02798f07467f888ab1193b06b52f364d`, and `tests/combat-tactics.test.ts` is `30aa05a184aeff9446e0d578ec4ed3154bdbe362`. This supports applying the recorded test behavior to the native runtime commit without claiming that the full suite ran again there.

## ID 2

The native saves show one Boltspitter attacking an Ironjaw whose facing remained 4. The front save ends with 163 of 175 health at tick 66, the side save with 160 at tick 65, and the rear save with 157 at tick 65. Receipt checks 3, 7 and 11 therefore record 12, 15 and 18 damage. Each case has a preceding native round trip and replay endpoint check with the public attack command.

The unchanged implementation classifies the source relative to the target facing and applies factors of 1, 1.2 and 1.4 before armor. The passing test named `combat tactics encounters retains held facing and resolves front, side and rear damage through real attacks` records the same 12, 15 and 18 losses. Side and rear attacks receive a clear benefit, so the original clause is satisfied.

## ID 5

The native front case places a same-side ranged troop behind a Dwarf melee guard relative to the attacker. The troop ends at 88.2 of 95 health, a loss of 6.8, while guard energy falls from 40 to 29.8. When the guard faces away, or when the attack comes from the rear, the troop loses 17 and guard energy stays at 40. The depletion sequence records guard energy reaching zero and the following shot dealing the full 17 damage.

The implementation only intercepts when the protected ally is behind the bearer and the attacker is in front. The passing assertions cover frontal protection, rear and turned bypass, allied-player protection and depletion. This is the directional protection described in the original clause.

## ID 6

Native evidence establishes rock and building cover: an uncovered ranged hit deals 15, while rock and live-building cases each deal 8.7. Destroying the building restores 15 damage. The historical suite has passing checks for the same rock and building behavior.

The missing noun matters because the original clause enumerates rocks, ruins and buildings. `TerrainKind` contains rock but no ruin. The cover function accepts live completed buildings or rock terrain and nothing else. Destroyed buildings are excluded. The fixture generator and the tests enumerate only `none`, `rock` and `building`. `ruin-pillar` and `ruin-ring` occur as presentation asset names in `src/game/ArtRuntime.ts`; no simulation geometry maps them to cover. ID 6 should remain pending until a ruin has a legitimate simulation representation and a passing ranged-damage observation.

## ID 7

The retained off and on trials use the same ordinary Thorn Trebuchet placement, enemy target and allied Thornblade one tile from impact. At tick 82, both enemy targets have lost 25. With friendly fire disabled, the ally remains at 140 health. With it enabled, the ally ends at 120.4 and has lost 19.6. The projectile is present before impact and absent after impact in the retained sequence.

The implementation skips allied splash targets only when the match rule is off. Both rule values have passed tests, including a mid-flight save continuation. The enabled rule demonstrates that artillery placement can hurt the player's army, which is what the original clause requires. The fact that a match can disable friendly fire does not negate the mechanic.

## ID 8

The native stationary rider deals 15 damage at tick 66. The moving rider has accumulated `4.899999999999992` charge distance at tick 39 and deals `29.400000000000006` damage at tick 47. Both use the public attack path and both riders retain full health. This establishes that movement builds impact.

The pike half comes from the immutable passing suite because the browser run stopped before either pike fixture. The test `combat tactics encounters frontal braced pikes cancel charge and hurt the rider; a rear charge retains impact` issues a normal move, advances the game, issues a normal attack, and advances the game again. It asserts that a frontal holding spear receives about 17 damage, the rider receives more than 10 damage, and stored charge becomes zero. A rear-facing control keeps the extra impact and causes no rider damage.

The source explains that result. `cavalryImpact` treats a charged cavalry attack against the front of a holding spear as braced, returns an impact factor of 1 instead of the movement bonus, returns pike damage proportional to charge distance, and consumes the charge. The normal weapon path applies that result and emits `Charge stopped by braced pikes` when it queues the pike return hit.

In the original sentence, “stopping the charge” describes the pike counter to the charge mechanic. Canceling its impact bonus, consuming its stored charge and hurting the rider satisfies that meaning. A forced halt or timed movement lock would be an additional mechanic absent from the wording. ID 8 should therefore be admitted. The evidence limitation remains explicit: the pike behavior is a recorded passing simulation test on byte-identical core and test code, not a completed native pike encounter.

## Limits

This was static inspection only. I did not run a build, test, simulation, browser, replay, checker, native-history stage or asset gate. I did not hash the large raw evidence set or any source tree. I read selected retained JSON and source blobs, compared Git identities, checked the two supplied report hashes and the small original text file, and wrote only this report and its machine-readable companion in a new `/tmp` directory.

The admission decisions are per original feature sentence. They do not relabel the failed native batch, convert any encounter group to complete, or say that stages 07 and 08 passed. ID 6 remains the one wording gap in this group.
