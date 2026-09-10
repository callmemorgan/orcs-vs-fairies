# 216-game six-faction ladder

Run `six-factions-v1` uses seeds [4127, 91873] on small, medium, large maps, with all ordered faction pairings and mirrors. Both AI controllers think on the same simulation ticks; command order alternates each pulse. Cross-faction games determine the standings. Mirrors measure side effects separately.

These are deterministic AI matches on a small seed sample, not independent trials or evidence of competitive balance. Map changes, movement, economy, AI choices and combat stats all affect the results. The original [64-game baseline](../ladder-64/REPORT.md) uses different maps and scheduling, so its results are not a controlled comparison of unit stats.

## Standings

| Faction | Games | W–L–D | Timeouts | Win rate | Side 0 wins | Side 1 wins |
| --- | --- | --- | --- | --- | --- | --- |
| Orcs | 60 | 55–5–0 | 0 | 91.7% | 25 | 30 |
| Dwarves | 60 | 35–25–0 | 0 | 58.3% | 12 | 23 |
| Fairies | 60 | 33–27–0 | 0 | 55.0% | 10 | 23 |
| Undead | 60 | 23–37–0 | 0 | 38.3% | 5 | 18 |
| Tideborn | 60 | 22–38–0 | 0 | 36.7% | 3 | 19 |
| Automata | 60 | 12–48–0 | 0 | 20.0% | 2 | 10 |

## Matchups

Cells are row faction wins–losses–draws/timeouts.

| Faction | Automata | Dwarves | Fairies | Orcs | Tideborn | Undead |
| --- | --- | --- | --- | --- | --- | --- |
| Automata | — | 4–8–0 | 1–11–0 | 0–12–0 | 5–7–0 | 2–10–0 |
| Dwarves | 8–4–0 | — | 8–4–0 | 1–11–0 | 8–4–0 | 10–2–0 |
| Fairies | 11–1–0 | 4–8–0 | — | 2–10–0 | 8–4–0 | 8–4–0 |
| Orcs | 12–0–0 | 11–1–0 | 10–2–0 | — | 11–1–0 | 11–1–0 |
| Tideborn | 7–5–0 | 4–8–0 | 4–8–0 | 1–11–0 | — | 6–6–0 |
| Undead | 10–2–0 | 2–10–0 | 4–8–0 | 1–11–0 | 6–6–0 | — |

## Map size and starting side

| Size | Games | Side 0 wins | Side 1 wins | Draws | Timeouts | Median | Movement stalls |
| --- | --- | --- | --- | --- | --- | --- | --- |
| small | 72 | 23 | 49 | 0 | 0 | 8:53 | 174 |
| medium | 72 | 24 | 48 | 0 | 0 | 9:27 | 406 |
| large | 72 | 16 | 56 | 0 | 0 | 9:56 | 432 |

| Mirror faction | Side 0 wins | Side 1 wins | Draws/timeouts |
| --- | --- | --- | --- |
| Automata | 1 | 5 | 0 |
| Dwarves | 3 | 3 | 0 |
| Fairies | 0 | 6 | 0 |
| Orcs | 0 | 6 | 0 |
| Tideborn | 1 | 5 | 0 |
| Undead | 1 | 5 | 0 |

## Completion and movement

216/216 matches finished; 0 reached 45 minutes. Duration: 6:17 minimum, 9:14 median, 27:32 maximum. Economy violations: 0; invalid positions: 0.

The movement diagnostic flagged 1012 episodes in 183 games. It detects a movement order stuck for 20 seconds far from its destination without a nearby visible enemy. Crowding, blocked destinations and inaccessible routes can all trigger it. Individual reports retain positions, times and targets for reproduction. 0 games ended with at least 180 seconds since the last attack.

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

Run `LADDER_RUN=six-factions-new-name npm run test:ladder`. Existing run names are refused to preserve evidence. Use `LADDER_SEEDS` and `LADDER_SIZES` for comma-separated subsets. To summarize an existing run, use `python3 scripts/ladder/report.py --run six-factions-v1`. Each run saves the simulation source and hashes in `source/` and `method.json`; replay an older version by copying that snapshot into a separate checkout.
