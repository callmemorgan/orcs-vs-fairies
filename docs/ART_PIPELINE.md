# Blender art production plan

This is a production specification, not evidence of finished assets. The generated reference is `art/reference/factions-and-battlefield.png`. Blender 5.2.1 LTS is installed and responds to `blender --version`; disposable background renders passed in Eevee, Cycles CPU and Cycles OptiX GPU (see runtime verification below). Begin final modeling only after the root records a complete placeholder match with gathering, construction, recruitment, combat, and a result. Keep that evidence in the verification record.

## Scope and reference mapping

Use the IDs in `src/core/content.ts` as manifest keys. These IDs connect presentation to data; neither model scripts nor renderer code should choose mechanics by faction name. The illustration's printed labels differ from the game names below.

| ID / game name | Reference model and required silhouette |
| --- | --- |
| orc-worker / Scrapper | Worker: forward shoulders, exposed olive arms, red headband, tool harness, square hammer, large hands and boots. |
| orc-melee / Ironjaw | Axe infantry: broad plated shoulders, horned helmet, forward tusks, axe and round iron-bound shield. |
| orc-ranged / Boltspitter | Crossbow skirmisher: hunched torso, red hood, wide horizontal crossbow, bolt quiver. |
| orc-special / Wardrum | Drum berserker: largest body, large strapped drum, two beaters, shoulder spikes, red cloth. Keep the drum visible in side and rear views. |
| fairy-worker / Tender | Gardener: short leafy dress, watering vessel and hand tool, small swept wings, leaf crown. |
| fairy-melee / Thornblade | Spear guardian: long upright spear, pointed leaf armor, tall thin silhouette, long narrow wings. |
| fairy-ranged / Mothbow | Moth archer: curved bow, amber moth wings with segmented veins, pale hair and layered skirt. |
| fairy-special / Veilweaver | Illusion-weaver: purple trailing cape, wide violet wings, crown and floating hand lights. |
| orc-hq / Iron Hall | Great hall: layered red roofs, timber framing, iron braces, porch, chimney, horn finials and banners. |
| orc-depot / Timber Yard | Lumber depot: open shed, raised crane arm, pulley, stacked cut logs, uneven red roof. |
| orc-barracks / War Foundry | Barracks: fortified red roof, skull crest, furnace chimney, plated doors and weapon racks. |
| orc-tower / Watchtower | Watchtower: tall timber legs, ladder, braces, raised red-roofed firing platform. |
| fairy-hq / Elderheart | Ancient tree: twisting trunk, nested door and windows, roots, stepped entry and teal foliage crowns. |
| fairy-depot / Moonwell | Nectar grove: branching flower stems, open purple blossoms, hanging amber nectar lanterns and shallow root basin. This is a floral healing grove, not a stone well. |
| fairy-barracks / Bloomspire | Blossom pavilion: folded pale petals form a roof, gold ribs, leaf trim, open arches and small central spire. |
| fairy-tower / Thornwatch | Thorn spire: intertwined climbing thorn branches cradle an elevated violet crystal cluster. |

Wood nodes need two evergreen arrangements, one broadleaf arrangement, a partly harvested version and a stump/log remainder. Ore nodes need three irregular rock clusters with warm exposed veins and depleted rubble. Terrain needs seamless grass variation, dirt and worn path diamonds, edge overlays, low flowers, small stones and grasses. The central ruin needs a broken circular stone paving motif and several separate pillar fragments. Keep tall trees and pillars independently sortable; do not bake foreground occlusion into a flat terrain tile. Buildings need complete, construction and destroyed presentations. Units need all four simulation animation states in eight directions. Worker attack frames can also show a harvesting swing; use a resource-specific tool attachment if the gesture otherwise looks wrong.

## Coordinates and exported frames

The game uses ground projection `screenX=(x-y)*32`, `screenY=(x+y)*16` for 64 by 32 diamonds. Use Blender world `(X,Y,Z)=(simulationX,-simulationY,height)`, with one Blender unit per simulation tile. Camera location is proportional to `(1,-1,sqrt(2/3))`, looking at the ground origin: 45 degrees azimuth and 30 degrees elevation. This yields the required 2:1 ground diamond. Keep orthographic projection. Do not use the conventional 35.264-degree true-isometric elevation, which would mismatch the engine.

The horizontal image density is `64/sqrt(2)` pixels per Blender unit. For a frame of height H, use orthographic scale `H/(64/sqrt(2))`. For the initial calibration render, include an exact one-unit ground square and confirm its projected corners span 64 by 32 pixels. Place the ground origin at the frame anchor through the camera offset, then remove the calibration geometry. Keep this calibration assertion in the exporter.

| Class | Frame width x height | Ground anchor in frame | Maximum normal footprint |
| --- | --- | --- | --- |
| Orc unit | 160 x 192 | (80,144) | Role-dependent radius, no baked base disc |
| Fairy unit | 192 x 192 | (96,144) | Role-dependent radius, no baked base disc |
| Building HQ/barracks | 384 x 384 | (192,288) | 3 x 3 ground tiles |
| Building depot/tower | 256 x 384 | (128,288) | 2 x 2 ground tiles |
| Resource tree | 192 x 256 | (96,208) | Match simulation node bounds |
| Ore | 128 x 128 | (64,100) | Match simulation node bounds |
| Terrain diamond | 64 x 32 | (32,16) | 1 x 1 tile |
| Ruin fragment | Asset-specific | Recorded ground contact | Match map placement |

These are the current production dimensions. Orc and fairy canvases were expanded after death poses clipped the earlier unit frames. The larger canvas preserves the same camera density and world scale; it does not enlarge the character. Increase a frame further if wings, weapons, falling bodies or roof tips clip. Do not shrink one animation independently. Export transparent RGBA, straight alpha, and two pixels of empty padding around each atlas frame. Preserve source size and anchor when packing; disable trimming initially. The renderer scales one source pixel to one world pixel at camera zoom 1. Depth-sort on ground position, never the sprite's top edge. A tall building can be split into separately sorted sections only if its footprint and units' passage require it.

Directions are simulation angles `atan2(dy,dx)`, quantized with `round(angle/(PI/4)) mod 8`. Direction 0 is +x, direction 2 is +y, direction 4 is -x, and direction 6 is -y. Rotate the model about Z by the negative simulation angle, starting with its forward axis along Blender +X. Label a contact sheet with world directions before exporting the full roster; this catches rotation and mirroring mistakes.

## Modeling and painting through materials

Build each character from a reusable anatomical rig with separately shaped torso, pelvis, upper/lower limbs, hands and feet. Shape meshes with several cross-sections so elbows, knees, cheeks and shoulders have intentional contours. Give orcs short legs, deep chests, heavy jaws and asymmetric armor. Give fairies long limbs, narrow shoulders, pointed ears and thin layered clothes. Enlarge faces, hands and weapons enough to survive at game scale. Cylinders and spheres may start meshes, but exposed joined spheres are not a finished character.

Armor uses overlapping curved plates, bevels, rivets, seams and thickness. Cloth has a curved hem, folds and layered panels. Wings are modeled as bordered membranes with visible branching veins; keep membrane opacity high enough to distinguish them against grass. Build weapon heads and crossbows from shaped mesh profiles, with separate handles, limbs and fasteners. Use actual curved branch meshes for the fairy architecture, varied roof plank/shingle lengths for orcs, and thickness on all roof and petal edges.

Choose muted olive, charcoal and rusty red for orcs; teal leaves, ivory, amber and violet for fairies. Keep saturation strongest near heads, weapons and functional building details. Use seeded object-space noise at broad and medium scales to vary roughness and base color. Add painted vertex-color patches to cheeks, cloth and wood. Broad color bands and bevel highlights should survive downsampling; high-frequency noise should not become grit. Keep metal rough, with narrow warm highlights. Use multiple irregular leaf clusters and modeled petals rather than a single green sphere canopy.

Use one shared lighting scene: large warm key from image upper-left, weaker cool fill and soft contact lighting. Use a transparent world for exported sprites. Keep emission localized to windows, lanterns, crystals and hand lights. Render shadows to a separate reusable shadow asset or pass; the ground color must not be baked into sprites. Pin color-management values and render seed in the script. Render at twice the delivery resolution and downsample once with alpha-aware filtering. Inspect both the large render and the final game-size result before approving materials.

## Animation and packing

Use deterministic scripted rig poses with smooth interpolation. Idle has four frames over 0.8 seconds; walk has eight over 0.8 seconds; attack has six over 0.6 seconds; death has six over 1.0 seconds and holds its final frame. These are visual clocks; simulation cooldowns remain authoritative. Synchronize the attack's contact frame with the simulation attack event rather than applying damage from the animation. Keep all clips in-place. Feet should plant during walks, wings should move at the shoulders, and carried equipment should follow the relevant bones.

Attacks need anticipation, contact/release and recovery. Scrappers swing tools, Ironjaws swing axes behind shields, Boltspitters release and reload, Wardrums strike the drum with a body lunge. Fairies use tool, spear thrust, bow draw/release and casting poses. Death changes the silhouette and ends on the ground; a fade alone is insufficient. Wing motion and idle breathing must not move the ground anchor. The current building export has one idle frame, three construction stages and one rubble frame. Render smoke and magical bursts as separate effects to avoid rerendering buildings for every effect timing change.

Use atlas pages no larger than 2048 x 2048 to reduce loading spikes. The untrimmed unit set is 1,536 frames: 768 orc frames at 160 x 192 and 768 fairy frames at 192 x 192. These total 198 MiB RGBA before atlas padding and mipmaps; compression of PNG files does not reduce decoded GPU memory. Record actual page count and texture memory after packing. Load only assets required by the match, use atlas animation frame names, and batch by atlas. If memory or loading is excessive, trim with verified per-frame offsets or use smaller unit frames after inspecting readability. Keep all eight directions; do not mirror asymmetric shields or weapons to save space.

The implemented schema is defined by `scripts/pack_assets.py` and documented in `docs/ASSET_RUNTIME.md`. The packer writes `public/assets/manifest.json` with `schemaVersion: 1`, `projection: {tileWidth: 64, tileHeight: 32}`, an `atlases` array and an `assets` object keyed by content ID. Each atlas entry has `key`, `image` and `data`; the latter two are `/assets/` URLs to the PNG and Phaser hash-atlas JSON.

| Record | Current fields and meaning |
| --- | --- |
| Unit/building asset | `kind`, `width`, `height`, pixel `anchor`, `visualTop`, `pages` and `animations`. `visualTop` is the smallest occupied alpha-row index among non-death frames. |
| Animation | `frames` (count), `fps`, `loop` and `directions`. Each direction key maps to its ordered list of frame names. |
| Frame name | `{assetId}/{state}/{direction}/{frameIndex}`, such as `orc-melee/attack/0/2`. Unit directions run 0 through 7; buildings use direction 0. |
| Phaser atlas frame | `frame: {x,y,w,h}`, `rotated: false`, `trimmed: false`, `spriteSourceSize: {x:0,y:0,w,h}` and `sourceSize: {w,h}`. Atlas-page membership comes from the containing atlas, not a per-frame page field. |
| Environment asset | The raw entry's `id`, `width`, `height`, `anchor` and `file`, plus `kind: "environment"` and an `/assets/` `image` URL. Static environment images are not packed into actor atlases. |

The current manifest has no `scale`, `contactFrame`, static `frame`, `constructionFrames` or `destroyedFrame` fields. The renderer uses width and height to normalize the ground anchor and uses one source pixel per world pixel at zoom 1. Building construction and destruction use the `construction` and `death` animation entries. Frame rectangles preserve the full canvas and receive two pixels of empty padding on every side. File hashes and renderer settings belong in separate build evidence; game damage, costs and abilities remain outside the asset manifest.

## Reproducible implementation and approval

The implemented generators are `art/blender/environment.py`, `buildings.py` and `units.py`, with shared model/render helpers in `common.py`. They save editable `.blend` files under `art/blender/scenes/` and raw images under `art/blender/raw/`. `scripts/pack_assets.py` writes the runtime assets. `scripts/generate_assets.sh` runs all three generators sequentially, packs and validates; `--pack-only` reuses a complete raw export. Units support targeted asset, direction and state exports. See `docs/REGENERATING_ASSETS.md` for dependencies and exact commands. The full wrapper still needs a recorded end-to-end run; source inspection and its help/syntax checks do not prove clean regeneration. Avoid runtime downloads or external proprietary models.

First produce an Ironjaw, Veilweaver, Iron Hall, Moonwell and one grass/tree/ore group. Review their game-size contact sheet beside crops of the reference. Reject crude bodies, featureless roofs, uniform spheres as foliage, muddy alpha fringes and unreadable faction colors. Put the approved samples into a running placeholder match to verify alignment, overlap, selection rings and contrast. Only then expand the same quality to the remaining roster. Finally play both factions with completed assets, verify animation direction and timing in combat, and measure the requested 100-unit frame rate with the final textures loaded.

Tooling risks remain for complex production scenes: shader/API differences from older scripts, alpha downsampling, camera direction conventions, texture memory and the cost of the full directional render batch. A short background render proves the first path; it does not prove the art quality or the complete asset build. Record failures and actual timings without substituting simpler final models to meet a deadline.


## Runtime verification on this computer

A disposable 128 x 128 sphere scene in `work/blender-smoke/smoke.py` produced actual RGBA PNG files with Eevee, Cycles CPU and Cycles OptiX. This fixture is not game art. All three commands exited with code 0. The Eevee and OptiX images were visually inspected, and all three PNGs were decoded to verify dimensions, color format and alpha data. Each has fully transparent background pixels and fully opaque object pixels. The report JSON and full log for each engine remain beside the images.

Run these commands from the repository root:

```bash
blender --background --factory-startup --python-exit-code 1 --python work/blender-smoke/smoke.py -- eevee
blender --background --factory-startup --python-exit-code 1 --python work/blender-smoke/smoke.py -- optix
blender --background --factory-startup --python-exit-code 1 --python work/blender-smoke/smoke.py -- cpu
```

Use engine ID `BLENDER_EEVEE` on this Blender 5.2.1 installation. The older `BLENDER_EEVEE_NEXT` ID failed with an enum error. `--python-exit-code 1` is required so script exceptions fail the command; Blender otherwise returned code 0 after the failed initial script. The fixture deletes factory scene objects without calling `read_factory_settings` again, which avoids a second extension registration attempt.

For OptiX, set the Cycles addon preference `compute_device_type='OPTIX'`, call `get_devices()`, enable only devices whose type is `OPTIX`, then set `scene.render.engine='CYCLES'` and `scene.cycles.device='GPU'`. The enumerated GPU is NVIDIA GeForce RTX 5090. The script requires an OptiX device and fails if none is present, so this result does not conceal a CPU fallback. CUDA and CPU devices were enumerated but disabled for this render. Cycles used eight samples with denoising disabled. Eevee used its factory settings. Both used orthographic projection and `film_transparent=True`.

Measured time inside the render call was 6.19 seconds for Eevee, 1.02 seconds for OptiX and 0.06 seconds for CPU. These are single tiny-scene measurements with different initialization costs, not production throughput comparisons. Output sizes were 12,465, 12,950 and 12,950 bytes respectively. Each PNG is 128 x 128 RGBA8 with alpha range 0 through 255.

The installed package logs `ModuleNotFoundError: No module named 'cattrs'` while initializing its remote-asset extension. Rendering still succeeds; no extension downloading was needed or tested. Device enumeration also logs a missing HIP library, which did not prevent NVIDIA OptiX rendering. No system dependencies or user Blender preferences were changed for this test. Future build verification must check script exit status and actual output files, rather than treating startup warnings as the sole render result.


## Implemented common library and environment samples

The placeholder gate is recorded in `docs/evidence/PLACEHOLDER_GATE.md`. `art/blender/common.py` now implements the shared modeling API and uses 32-sample denoised Cycles OptiX renders when the GPU is available. It includes a CPU fallback; production provenance must record the selected device. Materials convert supplied sRGB colors to linear values and use broad procedural color variation. The shared scene uses Standard color management and the same warm key, cool fill and rim lights for every asset.

Camera calibration now uses Blender's actual projection after resolving sensor-fit behavior for the requested dimensions. Each setup asserts that the anchor is correct within 0.01 pixels and that unit ground-axis steps produce `(32,16)` and `(-32,16)` pixels. `common.calibration_image(path)` additionally renders an exact one-tile square and checks the loaded PNG's alpha bounds, four diamond points and transparent corners. The actual calibration render passed with a 64 x 32 image and alpha bounds `(0,0,63,31)`; see `art/blender/raw/environment/calibration.log` and `calibration.png`.

`art/blender/environment.py -- --sample` generated oak, ore, grass and ruin-pillar samples with editable `scenes/environment-*.blend` files. The oak has a branched trunk with bark ridges, layered leaf clusters and root ferns. The ore uses fractured rocks with warm mineral chips. The ruin has offset worn masonry, carved marks, rubble and moss. Samples were visually inspected at exported size; final battlefield approval remains with the integrating agent. The source also defines pine, stump, flowers, grass/dirt variants and stone paving. Its `--all` batch must be coordinated with other Blender jobs. `--asset ID` regenerates one model and image. The environment manifest lists only output images that exist and excludes the calibration fixture.

```bash
blender --background --factory-startup --python-exit-code 1 --python art/blender/environment.py -- --sample
blender --background --factory-startup --python-exit-code 1 --python art/blender/environment.py -- --asset tree-oak
```

The production integration contract specifies eight walk frames per unit (the earlier planning draft proposed six). With four idle, eight walk, six attack and six death frames in eight directions, the eight-unit set has 1,536 frames. At the current expanded canvases, that is 198 MiB untrimmed RGBA before padding. The renderer and packer must use the written metadata rather than infer these counts.


The full environment batch now produced 15 manifest entries and 15 matching editable scene files. Every PNG header was checked against its declared dimensions. Root feedback requested darker slate ore and darker sage/moss grass; those changes are rendered. Pine foliage was expanded into overlapping branches and pointed needle sprays. The manifest now includes `ruin-ring`, a broken circular paving assembly, alongside `ruin-pillar`. Renderer IDs remain `tile-grass-0` through `tile-grass-3` and `tile-dirt-0` through `tile-dirt-2`.

`common.render` now renders at 200 percent and downsamples with alpha weighting in linear color using Python's standard library. The installed Blender Python lacks NumPy. An initial version applied the color transfer twice and washed out the result; visual inspection caught it before delivery. The corrected implementation reads encoded byte-image pixels, linearizes RGB for filtering, encodes the result and saves a byte-buffer PNG without a second display transform. All environment files were regenerated after this correction. The rendered calibration passed again. Final approval still requires inspection in the game with fog, unit sprites and UI overlays.


## Current verification boundary

Unit canvases are now 160 x 192 with anchor `(80,144)` for orcs and 192 x 192 with anchor `(96,144)` for fairies. `units.py` writes those dimensions into raw metadata. The corrected full unit batch is still being completed at this documentation update; older raw or packed samples do not prove that all 1,536 frames use the new dimensions. Packing rejects a PNG whose dimensions disagree with its metadata. After the corrected batch, record the complete pack and validation output before treating its asset count, frame count or decoded atlas size as measured evidence.

The renderer's asset lookup, atlas schema, projection calibration, complete environment export and individual Blender scenes are source/export evidence. `docs/evidence/ART_INTEGRATION_CHECK.md` separately records a partial browser check with eight buildings and 15 environment images, while units were placeholders. It proved visible placement and normal selection/gathering actions for that build. It did not prove completed unit animation integration, a full final-art match, both factions' results or 1080p performance. Full final-asset browser matches, animation/readability review and the 100-unit performance measurement remain pending.
