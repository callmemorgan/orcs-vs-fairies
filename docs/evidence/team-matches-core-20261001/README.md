# Autonomous team matches

The source is frozen at `c1f22643fc3b73e16e58965f4e31bd10bfc08e04`. Each match starts through `createMatch`, uses public AI controllers and advances through `stepGame` in 0.05-second steps. There are no state injections, content overrides or economy bonuses. Seed 4127 uses shared vision and the mixed faction rosters recorded in each method file.

| Match | Map | Ticks | Simulated duration | Winner |
| --- | --- | ---: | ---: | --- |
| 2v2 | Large | 14,948 | 747.40 seconds | Team 0 |
| 3v3 | Huge | 16,923 | 846.15 seconds | Team 0 |
| 4v4 | Huge | 16,032 | 801.60 seconds | Team 0 |

Every player gathered wood, ore and crystal, completed buildings, trained units, fought and reached age three. The runner checks actual population plus paid recruitment reservations against hard limits, completed housing capacity, finite balances and positions, resource bounds and hostile-only attacks. No invariant failed. All completed surviving headquarters belong to the winning team. In 3v3, representative winner slot zero was eliminated while its allies won.

The final saves reload and round-trip exactly through the frozen loader. `provenance-and-save-verification.json` verifies all ten copied core files against the source commit and compares the executed bundle with a rebuild after removing standalone source-path comments. `verified-summary.json` contains the compact outcomes; per-match methods, results, final saves and progress records preserve the detail. The independent GPT-5.6 Sol review is in `trail-review.json`.

To verify the preserved source and saves from this repository:

```bash
node docs/evidence/team-matches-core-20261001/verify-provenance.mjs
node docs/evidence/team-matches-core-20261001/verify-config.mjs
```

The verifier finds the containing repository automatically. `TEAM_EVIDENCE_REPO` can select a repository containing the frozen commit when checking a copy outside Git. The original `entry.ts` records the original bundle construction; `rebuild-entry.ts` uses the copied source.

To rerun the matches without overwriting these reports, copy this directory into a new temporary directory and run `node run.mjs 4`, `node run.mjs 6` and `node run.mjs 8` there. The runner loads the preserved `frozen.mjs`. Rebuild from `rebuild-entry.ts` with the repository's esbuild when independently checking the bundle.

These checks cover one seed and the recorded rosters. They verify headless team behavior and save compatibility. Browser controls, rendering performance, network matches and public hosting require separate evidence.
