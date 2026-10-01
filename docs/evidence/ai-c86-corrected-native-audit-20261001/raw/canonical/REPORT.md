# 108-game six-faction ladder

Run `six-factions-save401-ladder-c86e273-r1` uses seeds [4127] on small, medium, large maps, with all ordered faction pairings and mirrors. Both AI controllers think on the same simulation ticks; command order alternates each pulse. Cross-faction games determine the standings. Mirrors measure side effects separately.

These are deterministic AI matches on a small seed sample, not independent trials or evidence of competitive balance. Map changes, movement, economy, AI choices and combat stats all affect the results. The original [64-game baseline](../ladder-64/REPORT.md) uses different maps and scheduling, so its results are not a controlled comparison of unit stats.

## Standings

| Faction | Games | W–L–D | Timeouts | Win rate | Side 0 wins | Side 1 wins |
| --- | --- | --- | --- | --- | --- | --- |
| Fairies | 30 | 25–5–0 | 0 | 83.3% | 12 | 13 |
| Tideborn | 30 | 21–9–0 | 0 | 70.0% | 9 | 12 |
| Orcs | 30 | 16–14–0 | 0 | 53.3% | 9 | 7 |
| Undead | 30 | 15–15–0 | 0 | 50.0% | 6 | 9 |
| Automata | 30 | 7–23–0 | 0 | 23.3% | 2 | 5 |
| Dwarves | 30 | 6–24–0 | 0 | 20.0% | 2 | 4 |

## Matchups

Cells are row faction wins–losses–draws/timeouts.

| Faction | Automata | Dwarves | Fairies | Orcs | Tideborn | Undead |
| --- | --- | --- | --- | --- | --- | --- |
| Automata | — | 2–4–0 | 1–5–0 | 0–6–0 | 1–5–0 | 3–3–0 |
| Dwarves | 4–2–0 | — | 0–6–0 | 1–5–0 | 0–6–0 | 1–5–0 |
| Fairies | 5–1–0 | 6–0–0 | — | 5–1–0 | 4–2–0 | 5–1–0 |
| Orcs | 6–0–0 | 5–1–0 | 1–5–0 | — | 0–6–0 | 4–2–0 |
| Tideborn | 5–1–0 | 6–0–0 | 2–4–0 | 6–0–0 | — | 2–4–0 |
| Undead | 3–3–0 | 5–1–0 | 1–5–0 | 2–4–0 | 4–2–0 | — |

## Map size and starting side

| Size | Games | Side 0 wins | Side 1 wins | Draws | Timeouts | Median | Movement stalls |
| --- | --- | --- | --- | --- | --- | --- | --- |
| small | 36 | 12 | 24 | 0 | 0 | 9:34 | 1 |
| medium | 36 | 18 | 18 | 0 | 0 | 9:23 | 3 |
| large | 36 | 18 | 18 | 0 | 0 | 8:56 | 0 |

| Mirror faction | Side 0 wins | Side 1 wins | Draws/timeouts |
| --- | --- | --- | --- |
| Automata | 0 | 3 | 0 |
| Dwarves | 1 | 2 | 0 |
| Fairies | 2 | 1 | 0 |
| Orcs | 1 | 2 | 0 |
| Tideborn | 2 | 1 | 0 |
| Undead | 2 | 1 | 0 |

## Completion and movement

108/108 matches finished; 0 reached 45 minutes. Duration: 6:13 minimum, 9:12 median, 21:53 maximum. Economy violations: 0; non-finite/out-of-bounds samples: 0.

The movement diagnostic flagged 4 episodes in 2 games. It detects a movement order stuck for 20 seconds far from its destination without a nearby visible enemy. Crowding, blocked destinations and inaccessible routes can all trigger it. Individual reports retain positions, times and targets for reproduction. 0 games ended with at least 180 seconds since the last attack.

## Roster and resource use

| Faction | Armies | Missing combat-role hits | Missing building types | No crystal deposited | No special ability used |
| --- | --- | --- | --- | --- | --- |
| Automata | 36 | 0 | 36 | 0 | 0 |
| Dwarves | 36 | 0 | 36 | 0 | 0 |
| Fairies | 36 | 0 | 34 | 0 | 0 |
| Orcs | 36 | 0 | 35 | 0 | 4 |
| Tideborn | 36 | 0 | 34 | 0 | 0 |
| Undead | 36 | 0 | 35 | 0 | 0 |

Some short or losing games end before every roster role fights or every building finishes. The reports record that absence rather than treating it as evidence that the mechanic never works.

## Reproduce

Run `LADDER_RUN=six-factions-new-name npm run test:ladder`. Existing run names are refused to preserve evidence. Use `LADDER_SEEDS` and `LADDER_SIZES` for comma-separated subsets. To summarize an existing run, use `python3 scripts/ladder/report.py --run six-factions-save401-ladder-c86e273-r1`. Each run saves the simulation source and hashes in `source/` and `method.json`; replay an older version by copying that snapshot into a separate checkout.
