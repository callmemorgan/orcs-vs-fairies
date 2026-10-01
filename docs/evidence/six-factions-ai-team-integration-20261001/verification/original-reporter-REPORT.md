# 108-game six-faction ladder

Run `six-factions-ai-team-integration-20261001` uses seeds [4127] on small, medium, large maps, with all ordered faction pairings and mirrors. Both AI controllers think on the same simulation ticks; command order alternates each pulse. Cross-faction games determine the standings. Mirrors measure side effects separately.

These are deterministic AI matches on a small seed sample, not independent trials or evidence of competitive balance. Map changes, movement, economy, AI choices and combat stats all affect the results. The original [64-game baseline](../ladder-64/REPORT.md) uses different maps and scheduling, so its results are not a controlled comparison of unit stats.

## Standings

| Faction | Games | W–L–D | Timeouts | Win rate | Side 0 wins | Side 1 wins |
| --- | --- | --- | --- | --- | --- | --- |
| Fairies | 30 | 28–2–0 | 0 | 93.3% | 14 | 14 |
| Tideborn | 30 | 23–7–0 | 0 | 76.7% | 12 | 11 |
| Dwarves | 30 | 9–18–0 | 3 | 30.0% | 5 | 4 |
| Undead | 30 | 9–18–0 | 3 | 30.0% | 5 | 4 |
| Automata | 30 | 8–20–0 | 2 | 26.7% | 4 | 4 |
| Orcs | 30 | 8–20–0 | 2 | 26.7% | 2 | 6 |

## Matchups

Cells are row faction wins–losses–draws/timeouts.

| Faction | Automata | Dwarves | Fairies | Orcs | Tideborn | Undead |
| --- | --- | --- | --- | --- | --- | --- |
| Automata | — | 2–2–2 | 0–6–0 | 5–1–0 | 0–6–0 | 1–5–0 |
| Dwarves | 2–2–2 | — | 0–6–0 | 3–3–0 | 1–5–0 | 3–2–1 |
| Fairies | 6–0–0 | 6–0–0 | — | 5–1–0 | 5–1–0 | 6–0–0 |
| Orcs | 1–5–0 | 3–3–0 | 1–5–0 | — | 1–5–0 | 2–2–2 |
| Tideborn | 6–0–0 | 5–1–0 | 1–5–0 | 5–1–0 | — | 6–0–0 |
| Undead | 5–1–0 | 2–3–1 | 0–6–0 | 2–2–2 | 0–6–0 | — |

## Map size and starting side

| Size | Games | Side 0 wins | Side 1 wins | Draws | Timeouts | Median | Movement stalls |
| --- | --- | --- | --- | --- | --- | --- | --- |
| small | 36 | 19 | 14 | 0 | 3 | 12:00 | 0 |
| medium | 36 | 14 | 17 | 0 | 5 | 13:05 | 9 |
| large | 36 | 17 | 19 | 0 | 0 | 12:27 | 0 |

| Mirror faction | Side 0 wins | Side 1 wins | Draws/timeouts |
| --- | --- | --- | --- |
| Automata | 1 | 1 | 1 |
| Dwarves | 2 | 1 | 0 |
| Fairies | 1 | 1 | 1 |
| Orcs | 1 | 1 | 1 |
| Tideborn | 1 | 2 | 0 |
| Undead | 2 | 1 | 0 |

## Completion and movement

100/108 matches finished; 8 reached 45 minutes. Duration: 7:13 minimum, 12:53 median, 45:00 maximum. Economy violations: 0; non-finite/out-of-bounds samples: 0.

The movement diagnostic flagged 9 episodes in 6 games. It detects a movement order stuck for 20 seconds far from its destination without a nearby visible enemy. Crowding, blocked destinations and inaccessible routes can all trigger it. Individual reports retain positions, times and targets for reproduction. 8 games ended with at least 180 seconds since the last attack.

## Roster and resource use

| Faction | Armies | Missing combat-role hits | Missing building types | No crystal deposited | No special ability used |
| --- | --- | --- | --- | --- | --- |
| Automata | 36 | 0 | 36 | 0 | 0 |
| Dwarves | 36 | 0 | 36 | 0 | 0 |
| Fairies | 36 | 0 | 34 | 0 | 0 |
| Orcs | 36 | 0 | 34 | 0 | 36 |
| Tideborn | 36 | 0 | 36 | 0 | 0 |
| Undead | 36 | 0 | 36 | 0 | 0 |

Some short or losing games end before every roster role fights or every building finishes. The reports record that absence rather than treating it as evidence that the mechanic never works.

## Reproduce

Run `LADDER_RUN=six-factions-new-name npm run test:ladder`. Existing run names are refused to preserve evidence. Use `LADDER_SEEDS` and `LADDER_SIZES` for comma-separated subsets. To summarize an existing run, use `python3 scripts/ladder/report.py --run six-factions-ai-team-integration-20261001`. Each run saves the simulation source and hashes in `source/` and `method.json`; replay an older version by copying that snapshot into a separate checkout.
