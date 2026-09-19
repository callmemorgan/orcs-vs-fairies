# Faction progression artwork

The three-age roster had separate Blender scenes and atlas IDs, but its pikes, cavalry, and siege engines shared most geometry. This revision replaces those 18 models with faction-specific designs, preserving their gameplay definitions and asset IDs. The original shared-model implementation is pinned to [`bed3c77:art/blender/progression.py`](https://github.com/callmemorgan/orcs-vs-fairies/blob/bed3c77/art/blender/progression.py).

| Faction | Pike infantry | Cavalry | Siege |
| --- | --- | --- | --- |
| Orcs | Pikejaw with orc anatomy, hooked iron pike, red shield | Boar Rider on a tusked, bristled boar with iron barding | Iron Catapult with spiked plates and a timber frame |
| Fairies | Winged Briar Pike with living briar polearm and leaf buckler | Winged Stag Rider on a white stag with branching gold antlers | Thorn Trebuchet made from growing trunks, vines, and leaves |
| Dwarves | Bearded Deep Pike with brass-bound armor and a square shield | Mountain Rider on a woolly ram with curled horns | Stone Thrower with riveted chassis, winding cranks, and stone reserves |
| Undead | Skeletal Bone Pike with bone shaft and a coffin shield | Dread Rider on an exposed-rib skeletal horse | Grave Catapult with a coffin bed, giant rib supports, and skull payload |
| Tideborn | Amphibian Reef Pike with a barbed harpoon and spiral shell shield | Shell Rider on a six-legged clawed crab | Coral Mangonel on a shell crab platform |
| Automata | Ceramic Lance Sentinel with a crystal pike | Four-legged Strider with twin crystal lances | Six-legged Siege Engine with a crystal accelerator |

The character models reuse the original faction sculpting functions and palettes. Mounted characters have seated legs; mount legs, mechanical limbs, wheels, wings, and weapons have named animation pivots. Siege death poses collapse low rather than tipping the carriage vertically.

## Review

`before-lineup.png` records the previous selection artwork. `lineup.png` shows the new Blender idle renders at the game's pixel density. The six `*-animations.gif` files play idle, walk, attack, and death frames for each faction. Browser screenshots show all eight directions through the production `ArtRuntime` and include the regenerated selection portraits.

The renderer fixture is `/scripts/progression/art-review.html` on the Vite development server. It checks every selected faction's progression frame for successful runtime lookup and alpha hit testing. The scene is synthetic; these screenshots are not gameplay or balance evidence.

## Reproduction

See [asset regeneration](../../REGENERATING_ASSETS.md#faction-specific-progression-models) for render and pack commands. Run `scripts/progression/check_frames.py --packed` after packing to reconstruct all trimmed atlas frames and compare their exact RGBA pixels with the raw exports. `scripts/validate_assets.py` checks the complete shipped asset set.

The final export passed the following checks:

| Check | Result | Evidence |
| --- | --- | --- |
| Raw and packed progression frames | 3,456 exact RGBA reconstructions; no missing or clipped frames; minimum visible-alpha margin 12 pixels | [Frame checks](packed-frame-check.json) |
| Complete runtime asset set | 100 assets, 8,250 frames, 138 atlas pages | [Asset validation](asset-validation.json) |
| Unrelated assets | 258 files unchanged; no unrelated asset changes; atlas index, 224 × 224 canvases, and (112, 176) anchors preserved | [Preservation check](preservation.json) |
| Editable Blender scenes | 18 scenes contain their faction features and only their own four animation sets | [Scene checks](scene-validation.json) |
| Browser renderer | All six factions; 576 frames per faction; zero load, lookup, or alpha-hit errors | [Browser results](browser-results.json) |
| GameScene integration | 100 rendered units, including every role, with Orcs and Fairies loaded | [Synthetic scene results](game-scene-check.json) |
| Tests | 239 passed in 16 files with `npm test -- --testTimeout=20000` | [Final test log](tests-final.log) |
| Build and packing regression | Production build and targeted-packer checks passed | [Build](build-final.log), [packer](packer-check.log) |

The first default-timeout run passed 237 tests and timed out on the two AI roster tests. Both five-second timeouts reproduced against unchanged commit `bed3c77`; the subsequent full run passed with a 20-second default timeout. No test timeout configuration or gameplay source was changed. The full skirmish tests keep their existing 120-second limit. After rendering stopped, all eight tests in that roster test file passed with the normal five-second limit. See [initial run](tests.log), [baseline reproduction](baseline-roster-tests.log), and [post-render default-timeout run](roster-tests-after-render.log).

The preview uses software-rendered headless Chromium. It proves asset loading and presentation, not hardware frame rate. No new balance or human-play claim is made. [Source hashes](source-hashes.json) identify the generator, scene, and integration files used for this export.

The local decision trail remains in `work/faction-assets/decisions.tsv`. The initial sample sheets were overwritten by the completed exports; final frame and browser checks supersede those intermediate sample observations.

The [independent decision-trail review](trail-review.md) found the final evidence consistent. Its remaining notes concern the unretained intermediate previews, synthetic browser coverage, and the explicit timeout used for the complete test run.
