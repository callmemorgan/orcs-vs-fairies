# Group-size pacing study

This bounded diagnostic tested two in-memory content overrides against the fixed movement core. It did not change runtime source, content files, tests, build output or the ordinary 900-second test deadline. Each diagnostic started the normal map, invoked the public AI for both sides, advanced at 0.05 seconds, and allowed at most 1,200 simulated seconds for observation. No units, income, damage or outcomes were injected. Run from the project root with `node work/pacing-study/run.mjs 12` or `node work/pacing-study/run.mjs 14`.

| AI army threshold | Orc-start outcome | Fairy-start outcome |
| --- | --- | --- |
| Current 9 orcs / 10 fairies, prior verified baseline | 546.80s, orcs win | 538.20s, orcs win |
| 12 both | 455.00s, orcs win | 777.15s, orcs win |
| 14 both | 500.15s, orcs win | 684.30s, orcs win |

The first experiment used 12 for both sides. Because it shortened the orc-start game but lengthened the fairy-start game, the single follow-up used 14 to observe whether larger defending groups changed the early breakthrough. No search grid was run. Neither candidate puts both starts into the requested 600–900-second range.

These durations include normal gathering and assembly, followed by actual combat. At threshold 12, the orc-start game's cumulative attacks rise from 7/7 at 360 seconds to 146/140 at 420 seconds; both armies had 11 units at 360 seconds. First HQ damage occurs at 435.45 seconds, and the game ends at 455.00. The fairy-start game has three distinct engagements: attack totals are 221/87 at 420 seconds, 409/177 at 660, and 485/494 at victory. First HQ damage occurs at 766.30 seconds. The final trained counts are 20/22 and 37/36, with 464/490 and 849/903 resource deposits respectively.

At threshold 14, armies reach 14/13 (orc-start) and 14/14 (fairy-start) at 420 seconds. Orc-start attacks grow to 216/179 at 480 seconds; the HQ takes its first damage at 474.35 and falls at 500.15. Fairy-start attacks grow from 240/100 at 480 seconds to 370/252 at 660; HQ damage starts at 669.55 and victory follows at 684.30. Final trained counts are 21/24 and 31/33, with 514/552 and 748/791 deposits. Quiet intervals show replenishing armies, not the previously reproduced permanently stuck combat pair. The saved one-minute samples contain HQ health, army sizes, attacks, deaths and economy; this is a bounded activity check, not proof that no individual unit ever stalls.

Recommendation: do not treat a group-size increase as a demonstrated pacing fix. If one scoped threshold change is desired for browser evaluation, use **14 for both faction `ai.armySize` values**, leaving aggression and all economy/combat values unchanged. Of the two experiments it has the narrower start-position spread and produces a larger initial field engagement; however, its orc-start match is still only 8m20s and faster than the baseline. It is a provisional group-combat change, not fulfillment of the 10–15-minute requirement. Retaining current thresholds until another balance hypothesis is tested is also justified by these results. All four experiments favor orcs, and the losing HQ falls within approximately 11–26 seconds of first damage; increasing the wait for a larger army alone does not produce longer contested battles.

Any accepted content change needs the unchanged full suite and a real browser match. A human can build additional barracks or attack before the AI's group threshold, so these automated results cannot establish human match pacing. No source change is recommended solely to hide a failing duration assertion.

Machine-readable results: `work/pacing-study/army-12.json` and `work/pacing-study/army-14.json`. Both record source hashes and UTC timestamps. Source SHA-256 values remained:

```text
7fa4f329b58157493508128ee1938ebed2f335e718c199354b2d598a4ef70d4f  src/core/simulation.ts
ff84c20e0f0badec8c3194c20cc4bb5aba7b82189ea94a8eacd0cd8b60e5a3bf  src/core/content.ts
```
