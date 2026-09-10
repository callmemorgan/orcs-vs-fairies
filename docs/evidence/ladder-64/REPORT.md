# 64-game AI ladder

This is a balanced round robin on the current Elderwood map: four timing rounds across all 16 ordered pairings. The 48 non-mirror games determine faction standings; the 16 mirrors check starting-side and scheduling effects. A win earns one point, a draw half a point. Each faction plays 24 ranked games, 12 on each side.

The simulation does not use its stored random seed. These rounds vary side 0’s first decision by 0, 0.25, 0.5 or 0.75 seconds, then think every second. Side 1 retains the production scheduler and first acts at about 0.05s, so these offsets are not centered around its first decision. Every faction receives the same timing exposure on both sides. Stats, starting resources, map and AI logic are unchanged. These are controlled timing variations, not independent randomized trials or human games. Matches use the real economy and combat rules, at 0.05-second steps, with a 45-minute draw limit.

See [balance findings](FINDINGS.md) for interpretation of this run.

## Standings

| Faction | W–L–D | Points / 24 | Win rate | Side 0 wins / 12 | Side 1 wins / 12 |
| --- | --- | --- | --- | --- | --- |
| Dwarves | 17–7–0 | 17 | 70.8% | 10 | 7 |
| Orcs | 14–10–0 | 14 | 58.3% | 7 | 7 |
| Fairies | 11–13–0 | 11 | 45.8% | 4 | 7 |
| Undead | 6–18–0 | 6 | 25.0% | 2 | 4 |

## Matchups

Cells show row faction wins–losses–draws over eight games, four from each starting side. Mirrors are excluded.

| Faction | Orcs | Fairies | Dwarves | Undead |
| --- | --- | --- | --- | --- |
| Orcs | — | 5–3–0 | 1–7–0 | 8–0–0 |
| Fairies | 3–5–0 | — | 3–5–0 | 5–3–0 |
| Dwarves | 7–1–0 | 5–3–0 | — | 5–3–0 |
| Undead | 0–8–0 | 3–5–0 | 3–5–0 | — |

## Timing and starting side

| Side 0 decision phase | Side 0 wins | Side 1 wins | Draws |
| --- | --- | --- | --- |
| 0s | 11 | 5 | 0 |
| 0.25s | 9 | 7 | 0 |
| 0.5s | 8 | 8 | 0 |
| 0.75s | 7 | 9 | 0 |

| Mirror faction | Side 0 wins | Side 1 wins | Draws |
| --- | --- | --- | --- |
| Orcs | 3 | 1 | 0 |
| Fairies | 3 | 1 | 0 |
| Dwarves | 3 | 1 | 0 |
| Undead | 3 | 1 | 0 |

## Completion and roster use

64/64 games ended through headquarters destruction; 0 reached the draw limit. Duration: 7:44 minimum, 12:09 median, 32:41 maximum.

| Faction | Armies checked (including mirrors) | Missing combat-role hits | Missing building types | Mechanic failed to hit |
| --- | --- | --- | --- | --- |
| Orcs | 32 | 0 | 0 | not measured |
| Fairies | 32 | 0 | 0 | not measured |
| Dwarves | 32 | 0 | 0 | 0 |
| Undead | 32 | 0 | 0 | 0 |

Attack counts establish use, not cost efficiency: they do not measure damage dealt or survival per resource spent. Matchup outcomes reflect these AI compositions and movement decisions as well as unit stats.

## Reproduce

Run `npm run test:ladder`. To summarize existing reports only, run `python3 scripts/ladder/report.py`. Source hashes and timing settings are in `method.json`; the 64 individual JSON reports preserve roster use, economy peaks, survivors and outcomes. The original 16-match evidence is unchanged.
