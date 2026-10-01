# Frozen AI and team-core ladder

This run tested gameplay from `3f376c9ea75b9bcaed6643ea678ce3c4e5e80f77`, including the updated AI policy and save version three. It used an isolated checkout and preserved all 14 core TypeScript files, the exact instrumented runner, original reporter, Vitest configuration and dependency files. Every copied core file matches the frozen commit. The earlier `six-factions-team-foundation-20261001` baseline remains separate.

All 108 ordered games were executed: six factions against all six opponents, including mirrors, on small, medium and large maps at seed 4127. Both players use normal difficulty, balanced personality and the infantry-rush opening. This checks those default settings; it does not test every difficulty, personality or team roster.

| Result | Count |
| --- | ---: |
| Matches ending with a winner | 100 |
| Matches reaching 45 simulated minutes | 8 |
| Draws | 0 |
| Side zero wins / side one wins | 50 / 50 |
| Save-v3 serialization round trips passing | 108 |
| Reported economy / position violations | 0 / 0 |
| Movement diagnostic episodes / affected games | 9 / 6 |

Vitest passed 107 of 108 cases. Large-map Orcs versus Undead finished at 713.25 simulated seconds and wrote a valid result, but its 123.129-second execution exceeded the 120-second wall-clock limit. The command exited with status one, so its automatic report step did not run. Both the original and corrected reports were generated afterward from the complete recorded data. This was one game run; no game was rerun to obtain a passing test count.

All eight simulation timeouts ended with more than 180 seconds without combat. A separate reproduction of small-map Orcs versus Undead produced exactly the same final-save SHA-256 as this ladder. The preserved original save contains 17 living troops, zero workers, no paid queues and 17 expired retreat records. Both banks contain less than the 50 wood needed for a worker. That proves the retreat deadlock for this case. Two other timeout reports retain workers, so the same explanation cannot be assumed for every timeout. The later AI fallback and its validation require their own source and evidence; they were not included here.

`REPORT.md` and `summary.json` contain the results. `verification/ladder-provenance.json` verifies the exact 108-input matrix, all source hashes, normalized AI settings, finite parsed metrics, outcome relations and independently aggregated standings. The runner performs real save/load serialization comparisons and records their hashes, but full final envelopes for every match were not exported. The single reproduced timeout envelope is preserved in `verification/timeout-original-save.json`. No behavioral continuation is inferred from serialization equality.

The original reporter incorrectly required the building set to equal four essential types, so legitimate walls and gates appeared as missing buildings. The preserved corrected reporter checks that the required types are present, counts missing hits across all six combat roles and labels special-ability coverage as recorded events. The original reporter outputs remain in `verification/original-reporter-REPORT.md` and `verification/original-reporter-summary.json`; the original source snapshot is unchanged.

An independent review checked the matrix, frozen source, reporter hash and checker. It ran the checker in memory with file writes intercepted and rejected altered seed, duration, AI configuration, outcome and save-hash inputs. Its only report finding was a reproduction command missing the single-seed setting; that command has been corrected.

To recheck these artifacts without running games:

```bash
node docs/evidence/six-factions-ai-team-integration-20261001/verification/verify-results.mjs
python3 docs/evidence/six-factions-ai-team-integration-20261001/verification/report-corrected.py --run six-factions-ai-team-integration-20261001
```

To reproduce gameplay, use a separate checkout of the frozen commit, copy the instrumented runner from `source/scripts/ladder/ladder.test.ts` into its runner path, install the pinned dependencies and choose a new evidence name. The exact command shape is:

```bash
LADDER_SEEDS=4127 LADDER_SIZES=small,medium,large LADDER_RUN=six-factions-new-name npm run test:ladder
```

`verification/runner-instrumentation.patch` records the instrumentation added to the committed runner. It expands provenance, records actual AI settings and checks final save-v3 round trips; the gameplay loop remains unchanged. `verification/runtime.json` identifies the Node and tool versions. `verification/execution.json` records the actual wall-clock test failure separately from simulation timeouts.
