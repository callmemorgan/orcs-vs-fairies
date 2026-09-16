# Known limitations

The three-age build passed the 237-test complete suite and 15 focused progression/interface tests after its final HUD change, including 36 complete AI matches covering all ordered faction pairings on the default map and seed. Additional full matches cover small, large and huge maps on different seeds. Every faction reached Citadel Age and used all combat roles across the main regression sample. This verifies progression and completion, not competitive balance. Orcs won all ten cross-faction games in that sample; Automata and Dwarves each won one of ten. More seeds and human play are needed before tuning around those results.

The full atlas set now decodes to 1,448.63 MiB. Matches selectively load the two participating factions. Observed pairings decode 467.50–490.57 MiB of atlases. The final maintained 100-unit scene averaged 58.48 FPS at 1920 × 1080 and approximately 1× density, slightly below 60 FPS. This is not a high-DPI or low-memory-device result. Earlier measurements below apply to earlier artwork and render settings.

AI scouts reached the new flank camps in the large-map diagnostic but did not mine them; the player expansion-and-delivery sequence passes a focused test. AI expansion favors nearer observed resources.

New pikes, cavalry and siege have faction names and artwork but share their role's base combat statistics. The original rosters and faction mechanics still distinguish armies. Military research currently upgrades melee infantry; there are no branching exclusive technologies, naval units, trading, formations, diplomacy or save/load. Gates open manually and admit both sides while open. Wall construction is placed one segment at a time.

See [three-age progression](THREE_AGES.md) for controls, rules and the current verification record.

## Six-faction baseline before three-age progression

The earlier six-faction build passed 179 regression tests and completes all 216 games in the [final ladder](evidence/six-factions-final-v6/REPORT.md). Automata won 5 of 60 cross-faction games and Tideborn 21 of 60. These factions need further balance and AI work. Mirror results favor side 0 by 24–12; opposing Gravecallers can claim the same corpse in entity order. Simultaneous damage and alternating AI decisions do not remove that remaining ordering risk.

One large-map Dwarf mirror triggered a 20-second movement-stall diagnostic. No game timed out at 45 minutes, but the longest lasted 30:47. The ladder checks coordinates for finite values and map bounds every five seconds; it does not prove that every move avoids every obstacle. Navigation regressions separately exercise collision and crowd cases.

The complete atlas set decodes to 737.9 MiB. Selective loading reduced the observed Automata–Fairies match to about 253.65 MiB of atlases, still substantial. No new controlled 100-unit performance benchmark was run. Browser checks do not constitute a complete human match for each faction and size.

Terminal replay compares post-request simulation state hashes on the same version, not response bytes, runtime caches or a cross-version save format. The local decision trail retains its original malformed rows separately; repaired and reconstructed entries should not be treated as exact action timestamps. The [expansion report](EXPANSION_DAY.md) describes current evidence. Everything below is historical.

## Original two-faction milestone (historical)

The current production build is `index-9PMVYv2m.js`. All 61 rule tests pass, and an isolated build reproduced all 67 output files. The final Fairy browser match ended in defeat at 13:25 with uninterrupted telemetry, no pauses, healing, tower repairs, rebuilding and restart. See evidence/FAIRIES_HOLD_MATCH.md and evidence/COMPLETION_AUDIT.md for acceptance evidence and its limits.

The current maintained 100-unit scene measured 58.5255 FPS at a 1920 by 1080 viewport, canvas and drawing buffer, slightly below the 60 FPS target. Exactly 100 living, visible, on-screen final sprites remained throughout the valid 60-second sample. The reported device pixel ratio was 1.5. The earlier 144 FPS result was not reproduced. See evidence/PERFORMANCE_CURRENT.md.

Orcs have a substantial advantage in the tested comparable-cost grouped fights. Fairies benefit from positioning, Hold Position, illusions and overlapping Moonwells, but the tests do not establish equal win rates. The 13:25 match supports the target duration for a normal defensive game; earlier losses were shorter. Poorly placed buildings, recruitment gaps and slow responses affected the browser matches. Diagnostic increases to building HP and Thornblade HP, and lower Orc base damage, were not adopted. These are balance limits for this milestone, not hidden bonuses or different AI rules.

The latest completed Orc match on the preceding harvest build reached victory at 11:24, but about 6:10–10:20 was unattended and telemetry stopped early. It is outcome/restart evidence, not normal pacing evidence. Other complete-art browser matches include Orc defeat and Fairy victory on their documented earlier revisions. The additive Hold Position order has focused browser checks for both factions; existing stats, artwork and ordinary orders remain unchanged. See evidence/HOLD_POSITION.md and the faction match records.

Tall trees and roofs can obscure units; health bars and selection cues help, but the overlap can make clicking and recognition harder. Fairy workers and melee share body and palette features. The Wardrum's drum is obscured in the exact rear view, although it is visible from other directions. See evidence/VISUAL_REVIEW.md. Middle-button dragging and release outside the canvas have source review but lack browser input verification; arrow taps, ordinary camera control, zoom, minimap and home centering have browser evidence.

The complete Blender render and packaging command passed for all 31 scoped assets. Repeated PNG renders are not pixel-identical: most differences are 1–2 channel values, with larger differences confined to a small number of partially transparent Veilweaver pixels. The separate production build is byte-reproducible. The generated flower decoration is retained but not placed on the map. See evidence/ASSET_REPRODUCTION.md and REGENERATING_ASSETS.md.

Audio graph activity and nonzero output are recorded; physical speaker output was not independently verified. The local QA recorder is optional and records read-only snapshots. It is not needed for ordinary production play and does not inject orders or resources. Multiplayer, campaign, heroes, save/load, mobile controls and public deployment are outside this milestone.
