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

The pack-only option requires complete raw frames for both factions. It cannot turn representative samples into a complete export. Missing frames fail packing, and missing required IDs fail validation. A failed pack can leave partly updated output, so rerun after resolving the error before using the build.

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

The current animation metadata specifies 4 idle, 8 walk, 6 attack and 6 death frames per unit direction. Eight units in eight directions therefore require 1,536 unit PNGs. Eight buildings with one idle, three construction and one death frame require another 40 PNGs. The environment generator declares 15 static images. A full export produces 1,591 final raw PNGs, plus 31 editable scenes. Temporary supersampled PNGs are removed by successful renders; an interrupted render may leave one behind.

At the current unit generator's dimensions (160×192 for orcs and 192×192 for fairies), and the building metadata's 384×384 or 256×384 dimensions, the uncompressed unit/building frame pixels total approximately 216.75 MiB. Applying the current packer's two-pixel borders and page layout projects 24 atlas pages and approximately 230.59 MiB of decoded atlas pixels, before environment textures, mipmaps or other GPU overhead. These are calculations from generator dimensions and animation metadata, not measured browser memory. PNG disk sizes vary with the render content. Existing raw metadata can describe older sample dimensions until a full export refreshes every unit; do not use a mixed sample directory as a final memory measurement.

The validator prints the measured decoded atlas size after packing. It checks required IDs, frame coverage, atlas bounds, nonempty alpha and changing frames for multi-frame animations. It does not establish visual quality, correct movement direction, gameplay readability, animation timing or the target frame rate. Those require visual inspection and browser play with the final assets loaded.

The complete wrapper ran to exit code 0 and validated all 31 assets. See [Asset reproduction evidence](evidence/ASSET_REPRODUCTION.md) for the command, logs, hashes and decoded-pixel comparison. Repeating the process produced the same IDs and metadata, with small rendered pixel differences even on this computer; byte-identical PNG output is not guaranteed.
