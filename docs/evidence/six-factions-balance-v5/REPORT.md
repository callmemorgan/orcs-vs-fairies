# 216-game six-faction ladder

Run `six-factions-balance-v5` uses seeds [4127, 91873] on small, medium, large maps, with all ordered faction pairings and mirrors. Both AI controllers think on the same simulation ticks; command order alternates each pulse. Cross-faction games determine the standings. Mirrors measure side effects separately.

These are deterministic AI matches on a small seed sample, not independent trials or evidence of competitive balance. Map changes, movement, economy, AI choices and combat stats all affect the results. The original [64-game baseline](../ladder-64/REPORT.md) uses different maps and scheduling, so its results are not a controlled comparison of unit stats.

## Standings

| Faction | Games | W–L–D | Timeouts | Win rate | Side 0 wins | Side 1 wins |
| --- | --- | --- | --- | --- | --- | --- |
| Dwarves | 60 | 44–16–0 | 0 | 73.3% | 23 | 21 |
| Fairies | 60 | 40–20–0 | 0 | 66.7% | 20 | 20 |
| Undead | 60 | 36–24–0 | 0 | 60.0% | 19 | 17 |
| Orcs | 60 | 28–32–0 | 0 | 46.7% | 15 | 13 |
| Tideborn | 60 | 25–35–0 | 0 | 41.7% | 13 | 12 |
| Automata | 60 | 7–53–0 | 0 | 11.7% | 2 | 5 |

## Matchups

Cells are row faction wins–losses–draws/timeouts.

| Faction | Automata | Dwarves | Fairies | Orcs | Tideborn | Undead |
| --- | --- | --- | --- | --- | --- | --- |
| Automata | — | 1–11–0 | 3–9–0 | 0–12–0 | 3–9–0 | 0–12–0 |
| Dwarves | 11–1–0 | — | 10–2–0 | 11–1–0 | 7–5–0 | 5–7–0 |
| Fairies | 9–3–0 | 2–10–0 | — | 11–1–0 | 12–0–0 | 6–6–0 |
| Orcs | 12–0–0 | 1–11–0 | 1–11–0 | — | 8–4–0 | 6–6–0 |
| Tideborn | 9–3–0 | 5–7–0 | 0–12–0 | 4–8–0 | — | 7–5–0 |
| Undead | 12–0–0 | 7–5–0 | 6–6–0 | 6–6–0 | 5–7–0 | — |

## Map size and starting side

| Size | Games | Side 0 wins | Side 1 wins | Draws | Timeouts | Median | Movement stalls |
| --- | --- | --- | --- | --- | --- | --- | --- |
| small | 72 | 38 | 34 | 0 | 0 | 10:59 | 8 |
| medium | 72 | 35 | 37 | 0 | 0 | 12:24 | 16 |
| large | 72 | 39 | 33 | 0 | 0 | 9:36 | 8 |

| Mirror faction | Side 0 wins | Side 1 wins | Draws/timeouts |
| --- | --- | --- | --- |
| Automata | 3 | 3 | 0 |
| Dwarves | 3 | 3 | 0 |
| Fairies | 6 | 0 | 0 |
| Orcs | 3 | 3 | 0 |
| Tideborn | 2 | 4 | 0 |
| Undead | 3 | 3 | 0 |

## Completion and movement

216/216 matches finished; 0 reached 45 minutes. Duration: 5:59 minimum, 10:43 median, 31:10 maximum. Economy violations: 0; invalid positions: 0.

The movement diagnostic flagged 32 episodes in 15 games. It detects a movement order stuck for 20 seconds far from its destination without a nearby visible enemy. Crowding, blocked destinations and inaccessible routes can all trigger it. Individual reports retain positions, times and targets for reproduction. 0 games ended with at least 180 seconds since the last attack.

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

Run `LADDER_RUN=six-factions-new-name npm run test:ladder`. Existing run names are refused to preserve evidence. Use `LADDER_SEEDS` and `LADDER_SIZES` for comma-separated subsets. To summarize an existing run, use `python3 scripts/ladder/report.py --run six-factions-balance-v5`. Each run saves the simulation source and hashes in `source/` and `method.json`; replay an older version by copying that snapshot into a separate checkout.
