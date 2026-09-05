# Fairy Hold Position match

The final production build `index-9PMVYv2m.js` completed a normal Fairy skirmish through defeat at 805.05 game seconds (13:25), followed by a successful restart. The player used the browser controls, normal map, economy and AI. There were no pauses or unattended intervals; 164 retained snapshots span 2.65–805.05 seconds, with a maximum interval of 5.05 seconds. The source hashes matched before and after play, and the browser DOM identified the expected production script at 1920 by 1080. fairies-hold-provenance.json binds the session, outcome and restart artifacts.

## Play and recovery

Two workers began gathering wood while three built the first Bloomspire and Moonwell. Four additional workers brought the workforce to nine. The player assigned ore gatherers, maintained a wood economy, recruited each combat role, built two Thornwatches and a second Moonwell, and expanded to three production buildings. F2, drag selection, control groups, right-click orders, attack orders, H and the minimap were used during play.

The player held troops near the groves and towers, then issued movement and direct attacks when enemies remained outside the defensive line's weapon range. The first full wave destroyed the two outer producers but left an army and both towers. A replacement western Bloomspire and later a rear Bloomspire restored production. The original and replacement forward producers fell during later fighting. One final foundation was destroyed before completion. The third attack broke the remaining defense, and the headquarters fell at 13:25.

The trace records a peak of nine workers and thirteen real combat units. Five barracks completed, along with two towers and two Moonwells. Four completed barracks and an unfinished foundation were destroyed; the rear completed barracks survived the headquarters defeat. An attempted third tower placement did not create a tower and is not counted as construction. Several later recruitment clicks failed after the selected producer had been destroyed. The player also left production gaps and accumulated resources; this was not flawless play.

The player used repair orders successfully. Tower 50 recovered from about 497 to 650 HP early and from about 93 to 650 HP after the second defense, with builders assigned to it. Fifteen sampled positive unit-HP changes near completed Moonwells total 192.94 net HP. That is a lower bound on healing because damage between snapshots can conceal recovery. Some units received healing within both groves.

Hold appears in 561 live-unit observations, including attack animations with eligible nearby enemies. Thus its use during this match extends beyond merely assigning the order. The telemetry's five-second sampling does not count every attack or exact hold duration. Veil Doubles appeared during combat; most manual Q attempts encountered existing cooldowns. Clone presence alone is not attributed to manual activation. The read-only analysis and reproduction script are in work/hold-match-analysis/.

## Outcome, restart and limits

The browser displayed Defeat at 13:25. The outcome snapshot records zero Fairy population and capacity, about 1064 wood and 1325 ore; Orcs had 17 population and 32 capacity. New skirmish restored 00:00, 420 wood, 220 ore, 6/12 population and empty selection. The restarted match was paused at 8.50 seconds, with no winner.

Audio diagnostics recorded a running, unmuted graph with 29 recruitment, nine building, 559 attack and one defeat cue, plus a nonzero last output signal. This verifies audio scheduling and signal, not physical speaker output.

This is an uninterrupted, completed browser match within the 10–15 minute target, with defense, healing, repairs, rebuilding, defeat and restart. It does not establish equal faction strength, predict every match's duration or prove a Fairy victory on this build. Offline mixed-army diagnostics favor Orcs; the player's queue gaps, failed placements, exposed producers and slow reactions also affected the outcome. Earlier complete-art matches supply the other faction and victory evidence. The separate current 100-unit benchmark measured 58.5255 FPS; it is not inferred from this match's ordinary FPS snapshots.
