# Balance findings from 64 AI games

Dwarves lead at 17–7 (70.8%) and have a winning record against every opponent. Their 7–1 record against Orcs is the strongest advantage after Orcs versus Undead. Undead finish last at 6–18 (25%) and lose all eight games against Orcs, across every timing phase and both starting sides. These two matchups are the first candidates for a focused balance pass.

The results are sensitive to timing. Fairies won five of six ranked games in the zero-offset round, but only one of six in the 0.25-second round. Dwarves recorded 4, 3, 5 and 5 wins by round; Orcs 2, 5, 4 and 3; Fairies 5, 1, 2 and 3; Undead 1, 3, 1 and 1. Dwarf strength and Undead weakness persist in aggregate, while the middle rankings are less stable.

Side 0 won 12 of 16 mirrors, including three of four for every faction. It won only 23 of 48 cross-faction games. The mirror result warrants checking decision scheduling, entity iteration order and spatial symmetry before attributing it to map position alone. The experiment cannot separate those causes. The four decision phases are deterministic variations, not independent random samples, and are not centered on side 1's first decision.

Every Dwarf army landed emplaced attacks (17–805 per army), and every Undead army landed raised-unit attacks (2–266). Both mechanics are active even in losing matchups. Every army completed every building type and used all three combat roles. Attack counts alone do not establish whether cannons are too efficient or raised troops are too weak; testing those hypotheses needs damage, losses and resource-cost measurements.

One game exceeded 30 minutes: Orcs versus Dwarves at the 0.75-second offset, won by Dwarves at 32:41. The median was 12:09, so this is a pacing outlier rather than a general stall. All 64 games reached an ordinary HQ-destruction outcome with nonnegative resources and population at or below 100.

No game stats were changed during this ladder. A follow-up should first isolate Orc–Undead and Dwarf–Orc fights at matched resource costs and inspect mirror symmetry, then rerun this same schedule after any adjustment.

See [the generated standings and method](REPORT.md). This interpretation applies to the reports and source hashes in this directory; regenerate it if a later ladder replaces those reports.
