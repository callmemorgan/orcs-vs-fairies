# 36-game six-faction ladder

Run `six-factions-balance-v3` uses seeds [4127] on small maps, with all ordered faction pairings and mirrors. Both AI controllers think on the same simulation ticks; command order alternates each pulse. Cross-faction games determine the standings. Mirrors measure side effects separately.

These are deterministic AI matches on a small seed sample, not independent trials or evidence of competitive balance. Map changes, movement, economy, AI choices and combat stats all affect the results. The original [64-game baseline](../ladder-64/REPORT.md) uses different maps and scheduling, so its results are not a controlled comparison of unit stats.

## Standings

| Faction | Games | W–L–D | Timeouts | Win rate | Side 0 wins | Side 1 wins |
| --- | --- | --- | --- | --- | --- | --- |
| Orcs | 10 | 10–0–0 | 0 | 100.0% | 5 | 5 |
| Tideborn | 10 | 7–3–0 | 0 | 70.0% | 4 | 3 |
| Dwarves | 10 | 5–5–0 | 0 | 50.0% | 3 | 2 |
| Automata | 10 | 3–7–0 | 0 | 30.0% | 2 | 1 |
| Fairies | 10 | 3–7–0 | 0 | 30.0% | 1 | 2 |
| Undead | 10 | 2–8–0 | 0 | 20.0% | 2 | 0 |

## Matchups

Cells are row faction wins–losses–draws/timeouts.

| Faction | Automata | Dwarves | Fairies | Orcs | Tideborn | Undead |
| --- | --- | --- | --- | --- | --- | --- |
| Automata | — | 0–2–0 | 1–1–0 | 0–2–0 | 1–1–0 | 1–1–0 |
| Dwarves | 2–0–0 | — | 2–0–0 | 0–2–0 | 0–2–0 | 1–1–0 |
| Fairies | 1–1–0 | 0–2–0 | — | 0–2–0 | 0–2–0 | 2–0–0 |
| Orcs | 2–0–0 | 2–0–0 | 2–0–0 | — | 2–0–0 | 2–0–0 |
| Tideborn | 1–1–0 | 2–0–0 | 2–0–0 | 0–2–0 | — | 2–0–0 |
| Undead | 1–1–0 | 1–1–0 | 0–2–0 | 0–2–0 | 0–2–0 | — |

## Map size and starting side

| Size | Games | Side 0 wins | Side 1 wins | Draws | Timeouts | Median | Movement stalls |
| --- | --- | --- | --- | --- | --- | --- | --- |
| small | 36 | 21 | 15 | 0 | 0 | 9:30 | 0 |

| Mirror faction | Side 0 wins | Side 1 wins | Draws/timeouts |
| --- | --- | --- | --- |
| Automata | 1 | 0 | 0 |
| Dwarves | 1 | 0 | 0 |
| Fairies | 0 | 1 | 0 |
| Orcs | 1 | 0 | 0 |
| Tideborn | 1 | 0 | 0 |
| Undead | 0 | 1 | 0 |

## Completion and movement

36/36 matches finished; 0 reached 45 minutes. Duration: 7:04 minimum, 9:30 median, 14:33 maximum. Economy violations: 0; invalid positions: 0.

The movement diagnostic flagged 0 episodes in 0 games. It detects a movement order stuck for 20 seconds far from its destination without a nearby visible enemy. Crowding, blocked destinations and inaccessible routes can all trigger it. Individual reports retain positions, times and targets for reproduction. 0 games ended with at least 180 seconds since the last attack.

## Roster and resource use

| Faction | Armies | Missing combat-role hits | Missing building types | No crystal deposited | No special ability used |
| --- | --- | --- | --- | --- | --- |
| Automata | 12 | 0 | 0 | 0 | 0 |
| Dwarves | 12 | 0 | 0 | 0 | 0 |
| Fairies | 12 | 0 | 0 | 0 | 0 |
| Orcs | 12 | 0 | 0 | 0 | 12 |
| Tideborn | 12 | 0 | 0 | 0 | 0 |
| Undead | 12 | 0 | 0 | 0 | 0 |

Some short or losing games end before every roster role fights or every building finishes. The reports record that absence rather than treating it as evidence that the mechanic never works.

## Reproduce

Run `LADDER_RUN=six-factions-new-name npm run test:ladder`. Existing run names are refused to preserve evidence. Use `LADDER_SEEDS` and `LADDER_SIZES` for comma-separated subsets. To summarize an existing run, use `python3 scripts/ladder/report.py --run six-factions-balance-v3`. Each run saves the simulation source and hashes in `source/` and `method.json`; replay an older version by copying that snapshot into a separate checkout.
