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

The current export contains 24 units in eight directions, with four idle, eight walk, six attack and six death frames per direction. That is 4,608 unit PNGs. Twenty-four buildings have one idle, three construction and one death frame, adding 120 PNGs. Twenty-two static environment images bring the total to 4,750 raw images and 70 editable scenes. Temporary supersampled PNGs are removed after successful renders.

The packed manifest contains 70 assets, 4,728 animation frames and 72 atlas pages. The complete atlas set decodes to 737.90 MiB before environment textures, render targets and other GPU overhead. A match loads only its participating factions, including one copy for a mirror match. The browser QA record reports the pages and decoded atlas size loaded for that match. These pixel counts are not a measurement of total process or GPU memory.

The validator checks required IDs, frame coverage, atlas bounds, nonempty alpha, changing frames for multi-frame animations, faction portraits and selection artwork for all 48 unit/building types. Visual review and browser play remain necessary to check direction, animation timing, readability and frame rate.

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
