# Completion evidence

This checklist tracks the full objective. Unchecked items are not complete.

- [x] Local repository and Phaser/TypeScript project foundation.
- [x] Generated visual reference before production assets (art/reference/factions-and-battlefield.png).
- [x] One complete playable isometric map with painterly final artwork (docs/evidence/DELIVERABLE_AUDIT.md, VISUAL_REVIEW.md, ORCS_HARVEST_MATCH.md and current FAIRIES_HOLD_MATCH.md; known tree/roof overlap remains documented).
- [x] Both factions playable against AI in real browser matches (docs/evidence/ORCS_FINAL_ART_MATCH.md and FAIRIES_FINAL_ART_MATCH.md).
- [x] Worker and three combat units per faction; four building types per faction (content definitions, packed asset validation and both final-art browser matches).
- [x] Finite harvesting, deposits, construction, recruitment, supply, combat and distinct faction abilities verified (docs/evidence/current-verification.json:61 tests; RULES_AUDIT.md and hold behavior in HOLD_POSITION.md; normal faction matches and content fixture).
- [x] Selection, drag selection, context orders, attack-move, control groups, camera controls, minimap verified in browser (normal matches, CONTROLS_AND_AUDIO.md and CAMERA_FIX.md; middle-drag outside release remains a documented verification limit).
- [x] Fog and AI obey visibility and economic rules (current source/rule tests in RULES_AUDIT.md and advancing-front fog observations in VISUAL_REVIEW.md).
- [x] Normal matches support 10–15 minute target; current uninterrupted Fairy match ended at 13:25 (docs/evidence/FAIRIES_HOLD_MATCH.md), with shorter historical matches and balance limits documented.
- [x] Full placeholder gameplay gate, including match end, verified before Blender production (docs/evidence/PLACEHOLDER_GATE.md; final-source browser validation remains separate).
- [x] All scoped world assets rendered in Blender; sources, scripts, metadata and animation sheets retained (docs/evidence/packed-assets.json; art/blender/raw/units/validation.json).
- [x] Final silhouettes, lighting, animation and battlefield visibility inspected at gameplay size (docs/evidence/VISUAL_REVIEW.md and both faction match records; overlap and rear-view limits documented).
- [x] Browser matches as both factions, including victory, defeat and restart (orc defeat, fairy victory and end-screen restart; the goal does not require every outcome with each faction).
- [x] 1080p / 100 total units performance measured against 60 FPS target (docs/evidence/PERFORMANCE_CURRENT.md). Current result:58.53 FPS, slightly below target; historical144FPS result not reproduced.
- [x] Faction content replacement verified without editing core simulation (docs/evidence/CONTENT_REPLACEMENT.md; altered worker stats, recruitment, ability and artwork in an isolated browser fixture).
- [x] Reproducible production build and local launch instructions (docs/evidence/BUILD_REPRODUCTION.md; all 67 files matched from a separate locked dependency install; current economy revision also reproduced all 67 files).
- [x] Final source tests, browser evidence and remaining defects saved and reconciled against the original objective (docs/evidence/COMPLETION_AUDIT.md; current 61-test manifest, current Fairy match and benchmark, and documented applicability of earlier faction outcomes).

No campaign, multiplayer, heroes, save/load, mobile controls or public deployment in this milestone.
