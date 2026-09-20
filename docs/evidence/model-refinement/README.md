# Model refinement

This pass refines the 100 gameplay assets (42 units, 36 buildings and 22 terrain/prop models) and the two Blender command icons. The procedural sources and editable `.blend` scenes are updated together with their production sprites.

The original silhouettes guide the finish work. Smooth anatomical surfaces, rolled armor borders, fasteners, cloth hems and material relief improve the existing models. Dwarves have braided beards and domed helmets; Undead have modeled cheekbones and bone fittings; Tideborn have gill folds and shell growth ridges; Automata have panel seams and telescoping pistons. Mounts and siege machinery receive bridles, fleece locks, tension bindings and joinery. Walls and gates have faction-specific crowns, crests, buttresses and roof structures. Cut stumps, foliage and mineral edges receive geometry detail. Command shields have thickness and raised edging.

A full export exposed six clipped Ward Engine collapse frames. Its death pose now recenters the chassis around the ground anchor. Pose review also caught inherited Orc and Fairy ear profiles rotating around the world origin; their pivots now sit at the head attachment. Construction stages hide curves above the same height cutoff as meshes, preventing floating skull cheekbones. Sprite dimensions, projection, animation timing and gameplay rules remain unchanged. The saved unit scenes also discard unused animation actions from previously generated units.

The [model gallery](gallery.png) shows four larger portraits per faction. The [before/after comparison](before-after.png) uses the same scale within each pair. Pose and construction sheets accompany the machine-readable verification reports in this directory.

## Source and reproduction

The main finish pass is in [refinement.py](../../../art/blender/refinement.py), with material and primitive changes in [common.py](../../../art/blender/common.py). Faction work is in [units.py](../../../art/blender/units.py), [expansion.py](../../../art/blender/expansion.py), [world_expansion.py](../../../art/blender/world_expansion.py), [progression_models.py](../../../art/blender/progression_models.py), [fortifications.py](../../../art/blender/fortifications.py), [environment.py](../../../art/blender/environment.py) and [ui_orders.py](../../../art/blender/ui_orders.py).

Run `scripts/generate_assets.sh` for a complete regeneration. [Regeneration instructions](../../REGENERATING_ASSETS.md) describe the scene inventory, larger model portraits, before/after sheets and packed-frame review. Run `.venv/bin/python scripts/refinement_gallery.py` after the reviews to rebuild the delivery galleries.

## Verification

The [asset report](asset-report.json) records 100 changed gameplay assets and all 8,250 packed actor frames reconstructed against the raw RGBA renders. No frame is clipped or empty; the smallest actor margin is 5 pixels. Atlas count remains 138, with 1,448.63 MiB of decoded atlas pixels across the complete manifest. The [model inventory](model-inventory.json) covers all 102 editable scenes and verifies action ownership, nonempty keyframes, parented finishing details and finish-pass idempotence. The [construction check](construction-check.json) covers all 24 Dwarf/Undead construction stages.

All six factions pass the [browser ArtRuntime checks](browser-checks.json), with 1,375 frames checked per faction and no failures. The final [skirmish check](skirmish-check.json) verifies army selection, movement and Hold Position in an Undead-versus-Fairies match. The preview required a timer animation clock, so these checks make no frame-rate claim. Browser screenshot capture failed with `PreviewAutomationExecutionError`; the gallery and production-frame sheets provide the visual review record.

The [239-test suite](tests.log), [packer regression checks](packer-tests.log) and [production build](final-build.log) pass. Pose sheets cover all six factions; building sheets include construction, collapse and raised gates. The terrain and command sheets compare the production images before and after refinement.

GPT-5.6 Sol independently reviewed the final source, decision trail, galleries and verification evidence. It reported no flags.
