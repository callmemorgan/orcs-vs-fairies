# Assembled roster SAVE4 helper review

GPT-5.6 Sol reviewed `d9dc02a72acc490bdfd5cb8fbb6399f49d9f15c5` against parent `5cc251b2c1cf80e2012ff120f32a2712de252ddd`.

## Verdict

Accept the proof-helper correction. It changes no production code and does not claim that the browser helper has been executed after the change.

## Diff review

The single changed hunk updates the expected migrated envelope from save version 3 to version 4. It preserves whole-state comparisons for every field except entities. Entities now receive a stricter per-entry check: count, IDs, and ordering must remain unchanged; every original field must remain equal; units may gain only `tactics`; and that required field must equal `{ morale: 100, recentLoss: 0 }`. Non-unit entities may gain no field. Runtime and replay checks remain unchanged. The recorded evidence message now describes SAVE4 and includes the migrated tactics defaults.

This matches the SAVE4 migration contract in `src/core/saves.ts`, which initializes tactics for historical units and completes the envelope at the current version. The all-green suite includes the SAVE4 corpus assertion that every migrated unit has tactics. The helper parses as an ES module and `git diff --check` passes.

There is no new concurrency, promise, logging order, or application write. Assertion failures stop the proof and the helper's existing outer failure handler retains its result and screenshots. The changed assertions are the test delta for the behavior claimed by this helper.

## Findings

None. Final assembled-roster browser execution remains pending.
