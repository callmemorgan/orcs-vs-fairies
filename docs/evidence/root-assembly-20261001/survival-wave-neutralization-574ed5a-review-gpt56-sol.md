# Survival wave neutralization review

GPT-5.6 Sol accepts `574ed5a6f1abc310dfda610954bba2e91bed6e10` over `af44da406acf7ab44436e978cb1f571b93e28d23`. I found no production finding. The root must assemble it with the 4.0.1 expectation updates and an explicit old-4.0.0 compatibility regression before treating the combined root as green.

## Production change

`src/core/objectives.ts` now derives one `attackers` set from spawned IDs, living non-illusion entities, non-defender teams, and non-crewless actors. Automatic idle orders and wave completion use that same set. A crewless hostile engine therefore stops holding the wave open. A captured engine changes to the defender team, so the objective neither reorders it nor counts it against completion. Phase changes still guard the reward block, so each defender receives the configured reward once.

`src/core/versions.ts` raises current deterministic rules from 4.0.0 to 4.0.1 while leaving `LEGACY_SIMULATION_REVISIONS[4]` at 4.0.0. This is the required compatibility shape: a raw old SAVE4 game can load, its old replay remains 4.0.0 and cannot run under 4.0.1, and a new recorder starts 4.0.1 history.

The new focused tests cover real melee damage reducing a siege crew from 42 to zero, a living crewless engine ending a wave, one-time rewards, a captured engine remaining under defender orders, another hostile crewed engine keeping the wave active, final-wave completion, native save/resume equality, recorder equality, and replay seek equality. The new reproduction runner bundles source directly from pinned Git bytes and rejects overwrite of an earlier result.

## Independent verification

In a detached checkout at `574ed5a`, 38 tests passed across `survival-wave-neutralization`, `modes-objectives`, `modes-combined`, and `replays`; TypeScript passed. The log is `/tmp/ovf-survival-fix-independent-tests.log`.

I reran the committed reproduction against the original checkpoint SHA-256 `1f524adce9f09dcc028bbe5f7d4bee709f8c739977dc4075ddce100a322f4484`. At `af44da4`, the real crew reaches zero at tick 7,348 and the match remains in `fighting` through tick 7,448. At `574ed5a`, the same checkpoint reaches `recovery` at tick 7,348 and remains there through tick 7,448. Both runs compare 497 ordinary 0.05-second ticks across independent continuations and pass complete-envelope equality, recorder equality, full replay, analysis, technology timing, and endpoint seek checks. The reports are under the two directories listed in `/tmp/ovf-survival-fix-independent-output-paths`.

The revision probe at `/tmp/ovf-survival-revision-probe.log` confirms that the old 4.0.0 replay is incompatible, the raw game loads, and new history is compatible at 4.0.1. The parent fails both new focused cases: it leaves the crewless engine fighting and reorders the captured engine.

## Assembly dependency

This commit intentionally makes nine existing assertions fail because they hard-code the former current revision. The failures are recorded in `/tmp/ovf-survival-fix-version-sensitive-tests.log`. Some expectations should become 4.0.1 for new records; genuine old SAVE4 artifacts must remain 4.0.0 and inspection-only. Do not describe `574ed5a` alone as an all-green root. Import it with the AI deterministic fix assigned to the same 4.0.1 revision, update current expectations, add the old SAVE4 regression, and run the combined suite and fresh gameplay proof.

## Behavioral review

Ordering remains serial and synchronous. No new error path, logging, telemetry, or asynchronous state write is introduced. The only state timing change is the intended wave transition and reward once no hostile combat-capable spawned actor remains. The tests exercise both crew defeat and ownership transfer, including save/replay continuation at the changed boundary.
