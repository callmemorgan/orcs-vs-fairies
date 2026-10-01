# Survival wave completion after crew defeat and capture

The original frozen five-case SAVE4 run at `af44da406acf7ab44436e978cb1f571b93e28d23` failed because survival did not finish after 40,000 ticks. Its wave-2 recovery native session is the input here. Hill duel, relic duel, contested relic and 2v2 hill had passed, but the browser/server stages never started. The original run records and logs are preserved under `original-failed-run/`; the original preparation, runtime output and final manifest remain in `/tmp/ovf-modes-save4-proof.1RU1fI`.

The checkpoint reproduction identifies the cause through normal public steps, without injecting commands or editing state directly. Wave 3 spawned at tick 7251. Engine 93 started with 42 crew HP. Normal melee combat defeated its crew at tick 7348 while its engine HP remained `132.27615561427828`. The old survival predicate kept counting that neutral equipment. Under rules 4.0.0, another 100 public ticks left wave 3 fighting. Under fix commit `574ed5a6f1abc310dfda610954bba2e91bed6e10`, rules 4.0.1 enter recovery at tick 7348 and remain there at tick 7448. Both completed defender HQs retain 1750 HP in both runs.

The fix uses the same collection of live, hostile, crewed spawned actors for automatic wave orders and completion. A defender-owned captured engine is excluded even after its crew is replaced. Current `SIMULATION_REVISION` is 4.0.1; `LEGACY_SIMULATION_REVISIONS[4]` remains 4.0.0. The save schema remains SAVE4.

The final regression bytes fail twice against the unmodified 4.0.0 source: crew defeat does not enter recovery, and a captured defender engine receives an enemy attack-move order after an accepted stop. Against the fix, all 37 focused survival/objective/combat tests pass, and TypeScript passes. The regressions start full-health crews through the normal wave spawner, defeat them with real melee attacks, channel capture through the public command, check no early reward and one configured completion reward, and retain both living engine objects at final-wave victory. They compare complete saved envelopes after restoring, after accepted commands and after every subsequent tick. Restored recorder history and the replay endpoint also agree.

Both checkpoint runs compare 497 normal ticks with a restored native-session branch, equal recorder histories, full replay endpoint, analysis, technology timings and endpoint seek from the starting checkpoint. Each starts new history at the original raw SAVE4 game. The original session and its 4.0.0 replay remain intact as input; the fixed run does not attach historical replay history to new rules.

| Record | Source pin | Rules | Source/config digest | Result at tick 7448 |
| --- | --- | --- | --- | --- |
| `corrected-red/reproduction.json` | `af44da406acf7ab44436e978cb1f571b93e28d23` | 4.0.0 | `10eeb15b10a59d07e8c67533042e9f2e3567375c035a490f541062ea6e002688` | Wave 3 fighting |
| `green/reproduction.json` | `574ed5a6f1abc310dfda610954bba2e91bed6e10` | 4.0.1 | `519297594dc195b048f3303a33b2379f74bd66eba7b67273947a06969762f544` | Wave 3 recovery |

The committed runner compiles the core from pinned Git blobs, records every source/config hash and compiled input, embeds the source pin and digest, and hashes the executed bundle. Snapshots deep-copy nested crew and order values. The first diagnostic remains under `original-diagnostic/` with two known reporting defects: its spawn snapshot kept a reference to later-mutated crew state, and its `sourceDigest` field contained the source pin. Those defective fields are excluded from the proof; the fresh `corrected-red/` record replaces them. The original diagnostic directory `/tmp/ovf-survival-stall-repro-JjInAX` remains unchanged.

The live fresh outputs are `/tmp/ovf-survival-neutralization-corrected-red-v2-20261001` and `/tmp/ovf-survival-neutralization-green-v2-20261001`. This archive preserves their runner, input, final native session, report, metadata and executed bundle. Bundles and the original failed-run manifest are losslessly gzip-compressed. `archive-manifest.json` records both stored and original byte hashes. The read-only audit checks those hashes, source/config blobs, bundle binding, checkpoint snapshots and final native records:

```sh
python3 docs/evidence/survival-wave-neutralization-20261001/audit.py
```

To reproduce from a checkout containing the source pins, choose two output directories that do not exist:

```sh
node scripts/modes/reproduce-survival-neutralization.mjs af44da406acf7ab44436e978cb1f571b93e28d23 docs/evidence/survival-wave-neutralization-20261001/corrected-red/input.session.json /tmp/survival-red-new fighting
node scripts/modes/reproduce-survival-neutralization.mjs 574ed5a6f1abc310dfda610954bba2e91bed6e10 docs/evidence/survival-wave-neutralization-20261001/green/input.session.json /tmp/survival-green-new recovery
```

This evidence verifies the narrow fix. It does not certify the complete five-wave match or browser/server behavior after the fix. The assembled modes proof must run again after the combined production freeze, including the separate AI commander change that shares rules revision 4.0.1.

Independent archive review identified that the first corrected runner sought to the endpoint it had already reached. Runner correction `ac4724c` seeks back to tick 6951, asserts that tick, then seeks forward to 7448 before comparing the complete envelope. This archive contains fresh runs of that correction. The earlier outputs remain unchanged at `/tmp/ovf-survival-neutralization-corrected-red-20261001` and `/tmp/ovf-survival-neutralization-green-20261001`, with their prior archive retained at `/tmp/ovf-survival-neutralization-archive-before-seek-correction-20261001`. The same-tick seek result in those earlier reports does not prove seeking from another tick.
