# Four-faction match verification

All 16 ordered faction pairings completed through headquarters destruction on the fixed Elderwood map. Both armies deposited resources, completed all four building types, recruited every unit role and dealt damage with all three combat roles. Every Dwarf army dealt damage while emplaced; every Undead army dealt damage with raised units. The full suite passed 102 tests.

These are deterministic AI-versus-AI matches through the production simulation, not browser input tests or a statistical balance study. Each pairing ran once with seed 4127. Browser verification is recorded separately. The slowest match was Undead versus Fairies at 26:43; the test window was expanded to 30 minutes after a diagnostic established that it finished normally.

| Player | Opponent | Duration | Winner | Emplaced hits (P / AI) | Raised hits (P / AI) |
| --- | --- | --- | --- | --- | --- |
| dwarves | dwarves | 16:40 | dwarves | 471 / 179 | 0 / 0 |
| dwarves | fairies | 12:23 | dwarves | 376 / 0 | 0 / 0 |
| dwarves | orcs | 13:05 | dwarves | 425 / 0 | 0 / 0 |
| dwarves | undead | 11:07 | dwarves | 235 / 0 | 0 / 15 |
| fairies | dwarves | 22:50 | fairies | 0 / 299 | 0 / 0 |
| fairies | fairies | 17:31 | fairies | 0 / 0 | 0 / 0 |
| fairies | orcs | 16:58 | fairies | 0 / 0 | 0 / 0 |
| fairies | undead | 8:50 | fairies | 0 / 0 | 0 / 7 |
| orcs | dwarves | 12:14 | dwarves | 0 / 455 | 0 / 0 |
| orcs | fairies | 14:48 | fairies | 0 / 0 | 0 / 0 |
| orcs | orcs | 8:11 | orcs | 0 / 0 | 0 / 0 |
| orcs | undead | 13:09 | orcs | 0 / 0 | 0 / 41 |
| undead | dwarves | 11:18 | undead | 0 / 120 | 264 / 0 |
| undead | fairies | 26:43 | fairies | 0 / 0 | 80 / 0 |
| undead | orcs | 7:56 | orcs | 0 / 0 | 17 / 0 |
| undead | undead | 16:04 | undead | 0 / 0 | 60 / 266 |

## Initial balance pass

The first run favored Orcs in every cross-faction pairing. Orc melee health, damage and armor and heavy-infantry health, damage and armor were reduced through content definitions. Dwarven cannons gained building damage and earlier AI emplacement, followed by a reduction in cannon range, damage and recruitment share when they became too dominant. New factions now recruit according to content-defined proportions. After seven minutes, an AI with more than 500 wood and 180 ore can add a third barracks to use its stockpile.

The final results include cross-faction wins for every faction. Dwarves won both orientations against Orcs; Fairies won both against Orcs and Undead; Orcs won both against Undead. Dwarf–Fairy and Dwarf–Undead outcomes depend on starting side in this sample. These matchup and orientation advantages remain balance concerns. This pass fixes the observed all-opponent dominance and production bottlenecks; it does not establish competitive balance.

Re-run with `npm test`. `SKIRMISH_MAX_MINUTES` can extend the diagnostic window. Source hashes and detailed metrics are in `FACTION_MATCHES.json`; fresh reports are written to `work/faction-matches/`.
