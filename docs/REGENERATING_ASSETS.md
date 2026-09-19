# Regenerating game assets

Run `./scripts/generate_assets.sh` from the repository, or call it by absolute path from another directory. It runs environment, building and unit generation sequentially, then packs all three asset kinds into `public/assets` and validates the packed manifest. It does not launch the game, perform browser testing or publish anything.

The Blender model generators are the editable source of the meshes and poses. Generated `.blend` files preserve editable scenes and unit actions. Running generation overwrites scenes and PNGs at their existing paths. Preserve manual `.blend` edits elsewhere before regenerating; the generators do not import those edits. Source scripts are not modified by the wrapper. Old unrelated files are not deleted, and the packer replaces the manifest with the requested complete asset set.

## Dependencies

The current model scripts have been used with Blender 5.2.1 LTS. Blender must be on `PATH`. The shared renderer selects Cycles OptiX when available and otherwise can fall back to CPU; CPU rendering may take much longer. It renders at twice the final dimensions and reduces the result with alpha-aware filtering. Blender uses its bundled Python for modeling; the packer and validator use the repository `.venv` and Pillow.

Set up the Python environment if it is absent:

```bash
python -m venv .venv
.venv/bin/python -m pip install -r requirements-assets.txt
```

The shell wrapper also requires Bash and `flock` from util-linux. It checks these dependencies before generation. It does not install system software or change Blender preferences. See `art/blender/common.py` for the camera, material and render configuration.

## Commands and outputs

```bash
# Full generation, packing and validation:
./scripts/generate_assets.sh

# Repack an already complete raw export without rendering:
./scripts/generate_assets.sh --pack-only

# Usage only; no filesystem writes or dependency checks:
./scripts/generate_assets.sh --help
```

Logs are written under `work/asset-generation/`. Every Blender invocation uses `--python-exit-code 1`; the wrapper stops on a failed generator, pack or validation command. Its project lock prevents two wrapper instances from writing the same output simultaneously. Direct Blender commands do not acquire this lock, so stop other asset generators before running the wrapper. The lock is released by the operating system when the wrapper exits.

Raw environment images and their manifest go to `art/blender/raw/environment/`. Units and buildings use `art/blender/raw/{units,buildings}/{assetId}/` with `meta.json` and named animation frames. Editable scenes go to `art/blender/scenes/`. Packed PNGs, Phaser atlas JSON and the runtime manifest go to `public/assets/`. The wrapper does not rebuild Vite's `dist`; run the project's production build separately after asset generation.

The pack-only option requires complete raw frames for all six factions. It cannot turn representative samples into a complete export. Missing frames fail packing, and missing required IDs fail validation. A failed pack can leave partly updated output, so rerun after resolving the error before using the build.

For a targeted model revision, run the corresponding generator directly, then repack all assets:

```bash
blender --background --factory-startup --python-exit-code 1 \
  --python art/blender/environment.py -- --asset tree-oak
blender --background --factory-startup --python-exit-code 1 \
  --python art/blender/buildings.py -- --asset fairy-depot
blender --background --factory-startup --python-exit-code 1 \
  --python art/blender/units.py -- --asset orc-melee --state attack --direction 0
./scripts/generate_assets.sh --pack-only
```

Environment supports `--all`, `--sample` and `--asset`. Buildings also supports `--state` for idle, construction or death. Units supports `--state`, `--direction` (use 0 through 7) and `--models-only`. Sample exports contain incomplete frame coverage and must not be mistaken for a full build. Unit model-only generation saves metadata and `.blend` scenes without refreshing rendered frames.

## Expected size and verification limits

The current export contains 42 units in eight directions, with four idle, eight walk, six attack and six death frames per direction. That is 8,064 unit PNGs. Thirty-six buildings have one idle, three construction and one death frame; the six gates also have an open frame, giving 186 building PNGs. Twenty-two static environment images bring the total to 8,272 raw images and 100 editable gameplay scenes. Temporary supersampled PNGs are removed after successful renders.

The packed manifest contains 100 assets, 8,250 animation frames and 138 atlas pages. The complete atlas set decodes to 1,448.63 MiB before environment textures, render targets and other GPU overhead. A match loads only its participating factions, including one copy for a mirror match. The browser QA record reports the pages and decoded atlas size loaded for that match. These pixel counts are not a measurement of total process or GPU memory.

The validator checks required IDs, frame coverage, atlas bounds, nonempty alpha, changing frames for multi-frame animations, faction portraits and selection artwork for all 78 unit/building types. Visual review and browser play remain necessary to check direction, animation timing, readability and frame rate.

The original two-faction full-wrapper reproduction is retained in [historical asset reproduction evidence](evidence/ASSET_REPRODUCTION.md). The six-faction expansion rendered the new production set with `world_expansion.py --all`, then ran the pack-and-validation wrapper. It did not rerender every unchanged earlier faction during this expansion. Repeated Blender renders need not be byte-identical.

## Expansion generators

The wrapper runs `environment`, `buildings`, `units`, `expansion`, then `world_expansion`, so additional terrain entries merge after the base environment manifest is generated. `expansion.py` supplies Dwarf and Undead models. `world_expansion.py` supplies Tideborn, Automata, crystal deposits, reeds and the water, shallows, mud, rock and bridge tiles.

```sh
blender --background --factory-startup --python-exit-code 1 \
  --python art/blender/world_expansion.py -- --all
# Or revise one complete asset:
blender --background --factory-startup --python-exit-code 1 \
  --python art/blender/world_expansion.py -- --asset automata-special
./scripts/generate_assets.sh --pack-only
npm run build
```

`--sample` renders only representative frames. It is useful for visual review but cannot replace a complete animation export. The packer also creates six faction portraits and 48 selection portraits by cropping the rendered idle frames. ImageGen references are design inputs; the delivered gameplay sprites are Blender renders.

## Command console artwork

The HUD reuses `selection-*.png` and `portrait-*.png` from the existing Blender renders. `art/blender/ui_orders.py` creates the brass Halt plaque and Hold shield, saves their editable scenes in `art/models/`, and renders `public/assets/ui-halt.png` and `ui-hold.png`. The full generation wrapper includes these icons. To regenerate only these two images, run `blender --background --factory-startup --python-exit-code 1 --python art/blender/ui_orders.py`. Check all 56 UI images with `.venv/bin/python scripts/check_ui_art.py`. The ImageGen layout reference and its prompt are in `art/reference/rts-ui-command-bar*`; they are not used as production sprites.


## Three-age assets

`art/blender/progression.py` renders faction pikes, mounted raiders and siege engines. Each has 192 frames across idle, walk, attack and death animations, on 224 × 224 canvases with a ground anchor at (112, 176). Run with `--asset orc-cavalry` to regenerate one model, `--sample` to inspect representative poses and all eight final death directions, or `--all` to regenerate all 18. The optional `--resume` skips existing frames; omit it after changing geometry or animation.

`art/blender/fortifications.py --all` renders walls and gates for all six factions. `--asset orc-gate` targets one building. Gates include a separate `open` animation with a raised portcullis. Editable scenes are saved alongside the existing scenes.

The main `scripts/generate_assets.sh` includes both generators. After rendering, use `.venv/bin/python scripts/progression/check_frames.py` to check every new unit frame for clipping, then run the normal packer and validator. The validator requires all seven unit roles, all six building roles, and the gate-open animation.

### Faction-specific progression models

`progression_models.py` builds all 18 progression units using the original faction bodies and palettes. Orcs ride tusked boars; Fairies ride antlered white stags; Dwarves ride curled-horn mountain rams; Undead ride skeletal horses; Tideborn ride shell crabs; Automata use four-legged Striders. The siege models use faction construction: iron-plated timber, a living-wood trebuchet, a riveted stone thrower, a coffin-and-bone catapult, a crab-mounted coral mangonel, and a crystal accelerator on six articulated legs. Pike troops retain their faction anatomy and carry distinct polearms and shields.

For a targeted revision, render complete units, then pass their IDs to the packer. `--assets` requires an existing runtime manifest and preserves unrelated atlas pages, environment records, and portraits. It does not require raw exports for unchanged assets. Omit `--resume` after changing models or animation. `--states death` (or several state names) limits a targeted render to those animation states; use it only when geometry is unchanged and the remaining frames already match the current source.

```sh
blender --background --factory-startup --python-exit-code 1 \
  --python art/blender/progression.py -- --asset fairy-cavalry
.venv/bin/python scripts/pack_assets.py --assets fairy-cavalry
.venv/bin/python scripts/validate_assets.py
```

For the complete progression roster, render `progression.py --all` and pack the 18 IDs:

```sh
.venv/bin/python scripts/pack_assets.py --assets \
  {orc,fairy,dwarf,undead,tideborn,automata}-{spear,cavalry,siege}
.venv/bin/python scripts/progression/check_frames.py --packed
.venv/bin/python scripts/progression/review_assets.py
.venv/bin/python scripts/check_asset_packer.py
.venv/bin/python scripts/validate_assets.py
```

The review script writes a lineup, pose sheets, and animated GIFs under `work/faction-assets/review/`. Run the Vite development server and open `/scripts/progression/art-review.html?faction=fairies` to inspect the production atlases through `ArtRuntime`. Its faction selector covers all six factions; animation and frame controls show all eight directions. The page checks every progression frame's runtime lookup, anchor, and alpha hit test, and displays the actual selection portraits. This is a rendering fixture, not a gameplay or balance test. `progression.py --all --models-only` refreshes editable scenes and their four sets of named actions without touching rendered PNGs; it does not replace rendering after a geometry change.
