# Orc victory with revised recruitment times

The normal orc match on production bundle `index-DBgkXH8x.js` ended in player victory at 400.30 seconds (6:40). This build includes all regenerated Blender assets, doubled combat recruitment times, sound, additive selection and paused-hotkey fixes. The match ran through the actual browser controls at 1920×1080. No units, money, commands, clock changes or outcomes were injected through diagnostics.

The opening assigned five workers to wood, recruited six more workers, and moved workers to ore. Three workers formed construction group 4. Headquarters was group 1; two War Foundries were groups 2 and 3. The first Foundry was ordered within the first minute, followed by a Timber Yard and the second Foundry. A Watchtower was ordered shortly after two minutes and completed under attack. A second Timber Yard raised capacity to 32. All four building roles were present and completed.

Both Foundries recruited Ironjaws, Boltspitters and Wardrums. The initial defender and first ranged recruit died to early raids. Subsequent mixed troops defended the tower, gathered through F2, and received right-click attacks, attack-move destinations and repeated War Cry activations. Minimap clicks moved the camera along the advancing front. The army fought in the central ruins, then attacked visible fairy defenses and the stronghold. Nine combat units remained selected at victory.

At gameplay zoom, the orc shield infantry, crossbow units and larger heavy infantry had different silhouettes. The fairy winged defenders and purple translucent illusions were visually distinct from the orcs. Construction progressed from foundations to complete roofs and structures; units moved and fought with directional sprites. Fog covered unexplored ground and dimmed the cleared ruins after the army advanced. Tall trees and buildings sometimes obscured troops; F2 and ground-based drag selection made regrouping possible. The Wardrum's exact rear-view drum visibility remains the documented art limitation.

The end screen displayed Victory at 6:40. Clicking New skirmish reset time to 0:00, resources to 420 wood/220 ore, population to 6/12 and selection to empty. The fresh match was paused at 6.2 seconds for further development. The exact pause time is in `orcs-paced-restart.json`.

`orcs-paced-session.jsonl` contains 100 snapshots, beginning at 2.75 seconds and continuing through the result. `orcs-paced-victory.json` records the final state and audio counters: 18 recruitment cues, five construction cues, 237 attack cues and one victory cue. The output analyser recorded a nonzero signal after the result cue. These are graph/cue observations, not a claim about listening quality or physical speakers.

The earlier interrupted orc run ended at 427.45 seconds (7:07). Its final state and defeat audio cue are retained in `orcs-paced-interrupted-defeat.json`. Play stopped after approximately 2:28 while the match continued, so that run is not normal pacing evidence.

The uninterrupted 6:40 victory is below the requested 10–15 minute target. Doubling training times did not establish that target in human play, despite the longer automated fixtures. The pacing requirement remains open. Subsequent camera and AI changes are not covered by this bundle's match.
