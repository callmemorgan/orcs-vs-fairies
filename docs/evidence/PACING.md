# Recruitment pacing adjustment

The earlier normal browser matches finished in 346.2 seconds for the fairy victory and 405.75 seconds for the orc defeat. Earlier AI-vs-AI fixtures finished in 503.8 and 537.0 seconds. These are historical results from the original recruitment times, shorter than the requested 10–15 minute target.

Combat recruitment times are now doubled for both factions. Worker training remains 12 seconds. Costs, starting resources, gathering, construction, movement, combat, headquarters health, AI decisions and the simulation clock are unchanged. The Moonwell description now explicitly states that healing is passive, at 2.5 HP/s within six tiles; its behavior is unchanged.

| Unit | Previous training | Current training |
| --- | ---: | ---: |
| Ironjaw | 18 s | 36 s |
| Boltspitter | 20 s | 40 s |
| Wardrum | 28 s | 56 s |
| Thornblade | 17 s | 34 s |
| Mothbow | 20 s | 40 s |
| Veilweaver | 28 s | 56 s |

The intent is to make army production and replacement a longer commitment while retaining responsive movement and combat. The earlier human fairy session had two barracks by 57.6 seconds and ended with over 1,600 wood and 900 ore, supporting recruitment throughput as a useful pacing variable. More barracks can counter the lower throughput, so this does not guarantee every human match reaches ten minutes. There is no enforced minimum match duration or protection timer.

## Verification

At 2026-09-05 05:37:06 UTC, `npm test -- --silent=false --reporter=verbose` passed all 50 tests, including the unchanged two complete AI-vs-AI fixtures. No assertion, deadline, fixture economy or game rule was weakened. `npx tsc --noEmit` also passed. The full console output for this run is retained in `work/pacing-verification.txt`.

| Player 0 faction | Duration | Winner | Units trained, sides 0 / 1 | Deposits, sides 0 / 1 | Attacks, sides 0 / 1 |
| --- | ---: | --- | --- | --- | --- |
| Orcs | 893.55 s (14:53.55) | Side 1, fairies | 41 / 41 | 804 / 1,048 | 196 / 1,554 |
| Fairies | 649.85 s (10:49.85) | Side 0, fairies | 29 / 34 | 718 / 653 | 1,134 / 137 |

Both sides completed all four building roles, gathered and deposited resources, recruited and fought. Both fixtures ended through headquarters destruction under normal commands. Both durations fall within the target, but fairies won both fixtures and the orc-start match is close to the 15-minute test limit. These are two fixed-map automated outcomes, not broad balance evidence.

Source SHA-256 hashes for the verified run:

```text
ff84c20e0f0badec8c3194c20cc4bb5aba7b82189ea94a8eacd0cd8b60e5a3bf  src/core/content.ts
b259c9e3a8a5f9459898fd672b1b04e581c95db8bbea62dd09de92cae982a000  src/core/simulation.ts
7f7f2b3febeb7f002242bb132746649e549c2ac2d1383873470e94b45e60761b  tests/simulation.test.ts
8d8a1b7ad480a563ab7d4cfa9096abf7141a9c829dc56cff99d7b2cc27b28793  tests/skirmish.test.ts
```

Temporary in-memory comparisons showed that 1.5× recruitment produced 1,036.8 / 611.75 second matches, while adding 25% combat costs or 20% headquarters health to that variant changed little. Intermediate recruitment multipliers also produced non-monotonic outcomes, as battle timings and army compositions changed. The selected 2× values are a bounded tuning step, not a proven universal optimum.

Fresh normal browser matches with these exact recruitment values are still required. In particular, check whether building additional barracks makes human victories too short, whether the opening has too much waiting, and whether the longer replacement times make a first lost fight unrecoverable. Earlier browser victory, defeat and restart evidence remains valid for its recorded build but does not prove the pacing of this revision. This task did not rebuild or modify `dist`.
