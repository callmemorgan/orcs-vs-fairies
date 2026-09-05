# Asset reproduction evidence

Recorded 2026-09-05T05:31:05.997848+00:00 in `/home/morgana/Projects/orcs-vs-Fairies`.

## Full command

```bash
./scripts/generate_assets.sh > work/asset-generation-wrapper.log 2>&1
```

The original execution session `58811` ran to terminal exit code **0**. It was polled throughout; no replacement render process was started. The wrapper generated environment, buildings and units sequentially, packed all asset kinds, and ran the validator. No production `dist` rebuild occurred during this run or comparison.

The validator reported **31 assets, 1,576 atlas frames, 24 atlas pages and 230.59 MiB of decoded atlas pixels**, with `status: pass`. This verifies structural output coverage and changing animation frames, not browser performance or art quality. The current packer trims frame metadata while retaining its existing atlas page allocation; the decoded page memory figure includes that allocation.

Logs: `work/asset-generation-wrapper.log`, `work/asset-generation/blender-version.log`, `work/asset-generation/environment.log`, `work/asset-generation/buildings.log`, `work/asset-generation/units.log`, `work/asset-generation/pack.log`, and `work/asset-generation/validate.log`.

## Byte and pixel comparison

Before/after SHA-256 and byte sizes for every public PNG and JSON are preserved in `work/reproduction-before.json` and `work/reproduction-after.json`. Both snapshots contain 64 files. There were no additions or removals: 35 files were byte-identical and 29 PNGs changed. Every atlas JSON and the manifest remained byte-identical. Combined PNG/JSON disk size changed from 13,887,959 to 13,888,183 bytes, an increase of 224 bytes.

For each changed PNG, the corresponding `dist/assets/` file's SHA-256 was checked against the before snapshot and matched. These production files therefore provide a verified baseline for the following pixel comparison. Both files were decoded through Pillow to RGBA8, dimensions were checked equal, and absolute component differences were measured. A mismatched pixel has at least one differing RGBA channel. Maximum and mean deltas below use the 0–255 channel scale; the mean includes every component of every pixel, including transparent atlas padding.

| PNG | Mismatched pixels | Maximum channel delta | Mean absolute channel delta |
| --- | ---: | ---: | ---: |
| fairy-barracks-0.png | 7 | 1 | 0.000002325 |
| fairy-depot-0.png | 6 | 1 | 0.000002974 |
| fairy-hq-0.png | 8 | 1 | 0.000002657 |
| fairy-melee-0.png | 31 | 1 | 0.000002017 |
| fairy-melee-1.png | 74 | 1 | 0.000004816 |
| fairy-ranged-0.png | 48 | 1 | 0.000003124 |
| fairy-ranged-1.png | 72 | 2 | 0.000004881 |
| fairy-special-0.png | 15,218 | 29 | 0.001170150 |
| fairy-special-1.png | 9,848 | 12 | 0.000743310 |
| fairy-tower-0.png | 2 | 1 | 0.000000991 |
| fairy-worker-0.png | 51 | 1 | 0.000003319 |
| fairy-worker-1.png | 58 | 1 | 0.000003970 |
| orc-barracks-0.png | 14 | 1 | 0.000004650 |
| orc-depot-0.png | 6 | 1 | 0.000002974 |
| orc-hq-0.png | 11 | 1 | 0.000003653 |
| orc-melee-0.png | 46 | 1 | 0.000002981 |
| orc-melee-1.png | 27 | 1 | 0.000002917 |
| orc-ranged-0.png | 42 | 1 | 0.000002722 |
| orc-ranged-1.png | 23 | 1 | 0.000002484 |
| orc-special-0.png | 41 | 1 | 0.000002657 |
| orc-special-1.png | 26 | 1 | 0.000002809 |
| orc-tower-0.png | 9 | 1 | 0.000004461 |
| orc-worker-0.png | 45 | 1 | 0.000002917 |
| orc-worker-1.png | 25 | 1 | 0.000002701 |
| ruin-ring.png | 3 | 1 | 0.000018311 |
| tile-grass-1.png | 1 | 1 | 0.000122070 |
| tile-grass-2.png | 1 | 1 | 0.000122070 |
| tree-oak.png | 3 | 1 | 0.000015259 |
| tree-pine.png | 2 | 1 | 0.000010173 |

Across the 29 compared PNGs, 25,748 of 60,591,232 pixels differed; the aggregate mean absolute RGBA component delta was 0.000124156. None of these 29 byte differences can be explained solely by PNG metadata or compression, because each also has decoded pixel differences.

Veilweaver has the largest difference counts. Its two pages have no alpha-channel differences. All 15,218 and 9,848 changed pixels have nonzero alpha; only 71 and 36 pixels respectively have a channel delta above 2. Among pixels with alpha above 240 in both images, the maximum RGB delta is 2. The larger maxima of 29 and 12 therefore occur in partially transparent pixels. This distribution is consistent with small render/downsampling variation, but this comparison does not isolate a specific cause. It does not establish pixel-identical GPU determinism.

## Current file hashes

These hashes identify the inspected generator, packer, validator and snapshot files. The after snapshot contains the full per-output hash list. Hashing current source after the run identifies the checked source state; it is not a substitute for a source snapshot taken before execution.

| File | SHA-256 |
| --- | --- |
| `scripts/generate_assets.sh` | `8ad1fca4648b6df04cada27797a339187adb0a076f168d0ba84202068480f94c` |
| `art/blender/common.py` | `959372a9f78bd77ab5eafd40dcdcddae9af4def17aaa72ca660caba1a2807918` |
| `art/blender/environment.py` | `51018e76caaa84525f72a76e236b48478a505eb40ec7588b1f021a27c6527685` |
| `art/blender/buildings.py` | `03dd563ed4fa3e82e6af297e43f57038c8097a36eb81dcd8456fc2a65149fa6c` |
| `art/blender/units.py` | `4e0bb84664da3e8d25647aab7f4416de4d8ee92f08c602f63d7510e543735b4e` |
| `scripts/pack_assets.py` | `156b7371a7aeb72a1e667feb79b040b62edd048efe4d52312d79a73f05e60f61` |
| `scripts/validate_assets.py` | `d20e49782245d9421811b238e15a1f17c8075e509cf14880efade5bc2e43d333` |
| `public/assets/manifest.json` | `e36aeb0ac411470b32229e19712aa887eb337a2a003e881d32aeb24ad408dee3` |
| `work/reproduction-before.json` | `74b629dba21e7d1d436ad2a81b3d55a8d1470ee750276a272838b7be68631a52` |
| `work/reproduction-after.json` | `ba7e7d6f52d2ebec44d6caf9ef0fb0c2641c9191622e71e9640106a2be8ca10f` |
| `work/asset-generation/validate.log` | `e6cfe1694227e27bede9a1ff38c67744dedaf82818650eb8088b7407a76d0cdd` |

The full documented command reproduced a complete structurally valid asset set with unchanged IDs, atlas layout and JSON metadata. Byte-identical and pixel-identical rendered PNG output are not established. Visual and gameplay conclusions require the separate browser evidence, and this run did not test clean-machine dependency installation.
