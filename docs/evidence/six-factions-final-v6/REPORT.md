# 216-game six-faction ladder

Run `six-factions-final-v6` uses seeds [4127, 91873] on small, medium, large maps, with all ordered faction pairings and mirrors. Both AI controllers think on the same simulation ticks; command order alternates each pulse. Cross-faction games determine the standings. Mirrors measure side effects separately.

These are deterministic AI matches on a small seed sample, not independent trials or evidence of competitive balance. Map changes, movement, economy, AI choices and combat stats all affect the results. The original [64-game baseline](../ladder-64/REPORT.md) uses different maps and scheduling, so its results are not a controlled comparison of unit stats.

## Standings

| Faction | Games | W–L–D | Timeouts | Win rate | Side 0 wins | Side 1 wins |
| --- | --- | --- | --- | --- | --- | --- |
| Dwarves | 60 | 41–19–0 | 0 | 68.3% | 21 | 20 |
| Undead | 60 | 39–21–0 | 0 | 65.0% | 20 | 19 |
| Orcs | 60 | 38–22–0 | 0 | 63.3% | 18 | 20 |
| Fairies | 60 | 36–24–0 | 0 | 60.0% | 21 | 15 |
| Tideborn | 60 | 21–39–0 | 0 | 35.0% | 9 | 12 |
| Automata | 60 | 5–55–0 | 0 | 8.3% | 2 | 3 |

## Matchups

Cells are row faction wins–losses–draws/timeouts.

| Faction | Automata | Dwarves | Fairies | Orcs | Tideborn | Undead |
| --- | --- | --- | --- | --- | --- | --- |
| Automata | — | 1–11–0 | 1–11–0 | 0–12–0 | 2–10–0 | 1–11–0 |
| Dwarves | 11–1–0 | — | 9–3–0 | 7–5–0 | 9–3–0 | 5–7–0 |
| Fairies | 11–1–0 | 3–9–0 | — | 7–5–0 | 11–1–0 | 4–8–0 |
| Orcs | 12–0–0 | 5–7–0 | 5–7–0 | — | 9–3–0 | 7–5–0 |
| Tideborn | 10–2–0 | 3–9–0 | 1–11–0 | 3–9–0 | — | 4–8–0 |
| Undead | 11–1–0 | 7–5–0 | 8–4–0 | 5–7–0 | 8–4–0 | — |

## Map size and starting side

| Size | Games | Side 0 wins | Side 1 wins | Draws | Timeouts | Median | Movement stalls |
| --- | --- | --- | --- | --- | --- | --- | --- |
| small | 72 | 38 | 34 | 0 | 0 | 10:38 | 0 |
| medium | 72 | 35 | 37 | 0 | 0 | 10:40 | 0 |
| large | 72 | 42 | 30 | 0 | 0 | 9:24 | 1 |

| Mirror faction | Side 0 wins | Side 1 wins | Draws/timeouts |
| --- | --- | --- | --- |
| Automata | 4 | 2 | 0 |
| Dwarves | 4 | 2 | 0 |
| Fairies | 5 | 1 | 0 |
| Orcs | 5 | 1 | 0 |
| Tideborn | 3 | 3 | 0 |
| Undead | 3 | 3 | 0 |

## Completion and movement

216/216 matches finished; 0 reached 45 minutes. Duration: 6:02 minimum, 10:23 median, 30:47 maximum. Economy violations: 0; non-finite/out-of-bounds samples: 0.

The movement diagnostic flagged 1 episodes in 1 games. It detects a movement order stuck for 20 seconds far from its destination without a nearby visible enemy. Crowding, blocked destinations and inaccessible routes can all trigger it. Individual reports retain positions, times and targets for reproduction. 0 games ended with at least 180 seconds since the last attack.

## Roster and resource use

| Faction | Armies | Missing combat-role hits | Missing building types | No crystal deposited | No special ability used |
| --- | --- | --- | --- | --- | --- |
| Automata | 72 | 0 | 0 | 0 | 0 |
| Dwarves | 72 | 0 | 0 | 0 | 0 |
| Fairies | 72 | 0 | 0 | 0 | 0 |
| Orcs | 72 | 0 | 0 | 0 | 72 |
| Tideborn | 72 | 0 | 0 | 0 | 0 |
| Undead | 72 | 0 | 0 | 0 | 0 |

Some short or losing games end before every roster role fights or every building finishes. The reports record that absence rather than treating it as evidence that the mechanic never works.

## Reproduce

Run `LADDER_RUN=six-factions-new-name npm run test:ladder`. Existing run names are refused to preserve evidence. Use `LADDER_SEEDS` and `LADDER_SIZES` for comma-separated subsets. To summarize an existing run, use `python3 scripts/ladder/report.py --run six-factions-final-v6`. Each run saves the simulation source and hashes in `source/` and `method.json`; replay an older version by copying that snapshot into a separate checkout.
