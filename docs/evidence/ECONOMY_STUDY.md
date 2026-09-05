# Shared harvest-rate diagnostic

The single tested override lowers gathering from **3.8 to 2.28 units per second**, for both wood and ore and both factions. Carry capacity remains 18, and travel speed, starting resources, building costs, recruitment times, AI thresholds, combat and the game clock are unchanged. The existing shared `gather` function uses one rate for both resource types. A full load therefore takes approximately 7.89 seconds of harvesting instead of 4.74 seconds; the trip home still takes its normal time.

`node work/economy-study/run.mjs` reproduces the diagnostic from the project root. An esbuild load hook replaces exactly one harvest expression in memory and refuses to run if that expression is missing or duplicated. It imports current content without overrides, initializes each normal faction-start map, calls the public AI for both sides, and advances ordinary `stepGame` at 0.05 seconds. The diagnostic ceiling is 1,200 seconds; no test deadline was edited. Source and dist are untouched. Repeated runs of this same candidate while refining casualty instrumentation produced identical durations and outcomes; no other rate was tested.

| Start | Current-rate verified baseline | 60% harvest result | First HQ damage | Trained units, side 0 / 1 | Real unit casualties, side 0 / 1 |
| --- | --- | --- | --- | --- | --- |
| Orcs | 546.80s, side 0 orcs | **650.30s, side 0 orcs** | 617.00s | 28 / 38 | 17 / 44 |
| Fairies | 538.20s, side 1 orcs | **616.35s, side 1 orcs** | 595.35s | 30 / 27 | 36 / 12 |

Both diagnostics finish within 600–900 seconds, through ordinary HQ destruction. Production counts include workers and combat units. Real-unit casualty counts exclude temporary illusions and buildings. The JSON also retains all death-event totals, which include those other entities. No health, resources, units or winner were injected after initialization.

The orc-start match shows repeated engagements and replenishment: at 360 seconds cumulative attacks are 44/113 and armies contain 6/5 combat units; at 420 armies recover to 9/8; at 480 attacks reach 158/245 and armies fall to 4/3; by 540 armies have recovered to 8/5. Final attack totals are 401/392. The fairy-start match has 138/40 attacks and armies 7/5 at 360 seconds, armies 9/8 by 420, and 236/100 attacks with armies 3/10 at 480. Final attack totals are 313/407. First scout exchanges still occur at roughly 77–78 seconds. The longer durations contain real army losses and rebuilding, not an added no-rush timer or the previously observed permanently stalled combat pair.

The proposed causal explanation is only partly supported. The final winning orc banks are still **3,089 wood / 1,824 ore** in the orc-start match and **3,274 wood / 1,913 ore** in the fairy-start match. Before decisive losses, players still accumulate substantial unused funds: at 420 seconds both starts show roughly 1,838–2,144 wood and 1,122–1,418 ore per player. The defeated fairies eventually reach 36 wood / 1,330 ore or 445 wood / 24 ore after their economy is disrupted and workers are replaced. Thus lower harvest changes match trajectories and reduces income, but does not make normal reinforcement production broadly resource-limited. These results cannot establish that tighter income caused the improved pacing rather than small timing changes altering engagements.

Recommendation: **2.28 per second is a reasonable single shared-rate candidate for the next browser check**, because both unchanged-rule automated scenarios land in the target window without extra waiting rules, free AI resources or HQ health inflation. Adopt it provisionally only with the existing full rule suite and a normal human match. Do not claim it solves unused banks or faction balance: orcs still win both starts, and recruitment throughput remains a likely constraint when banks are large. No additional economic or combat tuning was tested here, and no further coefficient should be selected from this evidence alone.

Every 60-second checkpoint, plus the final state, is saved in `work/economy-study/harvest-60-percent.json`: HQ health, attacks, all death events, real unit casualties, recruitment counts, deposit counts, army sizes and both players' resource banks. This is a bounded simulation observation, not proof of human pacing, UI behavior or renderer performance.

The baseline is the existing verified result recorded in `RULES_AUDIT.md`; it was not rerun because source hashes still match. Diagnostic source SHA-256 values:

```text
7fa4f329b58157493508128ee1938ebed2f335e718c199354b2d598a4ef70d4f  src/core/simulation.ts
ff84c20e0f0badec8c3194c20cc4bb5aba7b82189ea94a8eacd0cd8b60e5a3bf  src/core/content.ts
```

## Adopted configuration confirmation

After the diagnostic above, the main project adopted `ECONOMY.harvestPerSecond = 2.28` in `src/core/content.ts`, with the shared gather function reading that value. The script now recognizes either the historical literal expression or this adopted configuration. For adopted source it verifies the configured rate is exactly 2.28, runs it unchanged, and records `override: null`; it never multiplies the reduced value by 60% again. Unsupported expressions or a different configured value fail explicitly.

One rerun of the adopted source reproduced **650.30 seconds / side 0 orcs** and **616.35 seconds / side 1 orcs** exactly. First HQ damage, attack counts, production, real-unit casualty counts and deposit counts also match the original candidate run. The adopted record is saved separately at `work/economy-study/adopted-harvest-2.28.json`; the original `harvest-60-percent.json` remains unchanged with its historical source hashes. This confirms integration of the rate, not a new pacing experiment or a human-match result. The earlier statement that source was untouched describes the isolated diagnostic, before this subsequent adoption by the parent task.

Adopted-source SHA-256 values:

```text
3c333e2a86d013f056781014edcd9f55abe24a6fb9922c299970eef5689025fd  src/core/content.ts
377ecfa6c53057003771a3c2adf57114b09170e817cb2db6fe8084f9f5b23388  src/core/simulation.ts
```
