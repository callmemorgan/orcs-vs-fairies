# Blender production integration

Ownership: common/environment agent owns common.py, environment.py, scenes/environment*, raw/environment/. Unit agent owns units.py, scenes/unit-*, raw/units/. Building agent owns buildings.py, scenes/building-*, raw/buildings/. Root owns packing scripts/public assets and manifest integration. No agent writes another output directory. No commits until root integrates.

common.py API provided by common/environment agent:
- reset_scene(): deletes factory objects and orphaned materials as needed, not reload factory settings.
- material(name,color,roughness=.8,metallic=0,emission=0): color accepts hex string or float RGB tuple. Painterly noise optional.
- mesh(name,vertices,faces,mat): mesh object, material attached.
- uv(name,loc,scale,mat,segments=12,rings=8): shaped UV sphere, smooth/weighted normals as appropriate.
- box(name,loc,scale,mat,bevel=.04): cube dimensions=scale (full size), bevel, applied scale.
- cone(name,loc,radius1,radius2,depth,mat,vertices=12): vertical mesh.
- beam(name,a,b,radius,mat,vertices=10): cylinder/cone between coordinates.
- curve(name,points,radius,mat): smooth bevel curve through points.
- setup_render(width,height,anchor, samples=32): orthographic camera + world + key/fill with fixed30deg elevation, projection64x32 and45.2548px/worldunit; transparent background. Returns scene.
- render(path): render at 2x, reduce with alpha-aware linear-color filtering, write final-size RGBA PNG and ensure parents.
- save(path): editable .blend.
No global rendering at import time. Blender scripts load common.py via sys.path directory. All model coordinates use simulation x,-y,height; model neutral forward Blender+X. Objects pose via transforms/parent empties, source .blend should contain named animated parts/keyframes or saved actions. Root packer will consume PNGs.

Raw unit files use `raw/units/{assetId}/{state}-{direction}-{frame:02}.png` and `raw/units/{assetId}/meta.json`. Orc canvases are 160 x 192 with anchor `[80,144]`; fairy canvases are 192 x 192 with anchor `[96,144]`. Death-pose clipping required these larger canvases. Camera density and world scale remain unchanged.

Each unit has four idle, eight walk, six attack and six death frames in each direction 0 through 7. This is 192 frames per unit, 1,536 frames total and 198 MiB untrimmed RGBA before padding. Direction 0 faces Blender +X; each subsequent direction rotates by -pi/4. Idle uses 5 fps and loops; walk uses 10 fps and loops; attack uses 10 fps without looping; death uses 6 fps without looping.

Raw metadata contains `id`, `kind: "unit"`, faction-appropriate `width`, `height: 192`, `anchor` and `animations`. Each animation entry contains `frames`, `fps` and `loop`; the packer adds direction frame lists. Sprites must fit without clipping. Initial representative review uses Ironjaw and Veilweaver, directions 0/1/2 idle frame 0 plus attack/death contact images, before the full batch. Save meaningful named model parts and actions. Support `--sample`, `--all` and targeted regeneration.

Buildings: raw/buildings/{id}/idle-0-00.png, construction-0-00.png ...02.png, death-0-00.png, meta.json. Size384x384 anchor[192,288] for hq/barracks,256x384 anchor[128,288] for depot/tower. Meta {id,kind:'building',width,height,anchor,animations:{idle:{frames:1,fps:1,loop:true},construction:{frames:3,fps:1,loop:false},death:{frames:1,fps:1,loop:false}}}. Use full-scale ground footprint3x3 or2x2, visual variety, mesh rubble death, staged scaffold construction. Sample first Iron Hall and Moonwell then expand. --sample and --all flags.

Environment: tile-grass-0..3, tile-dirt-0..2, tile-stone 64x32 anchor[32,16], tree-pine/tree-oak 192x256 anchor[96,208], ore 128x128 anchor[64,100], stump, ruin fragments etc. Raw environment/{id}.png and manifest.json listing entries {id,width,height,anchor,file}. Need game usable green terrain with low brushlike detail, taller detailed trees and ore, central ruin pieces. Avoid tiny visual noise.

Root will pack units into per-asset sheets and use manifest; do not pack independently. GPU renders should run one batch at a time to avoid monopolizing GPU/memory; notify root when scripts/models ready, root assigns batch execution. You may run small sample renders to verify own source but coordinate heavy jobs. User reference art/reference/factions-and-battlefield.png is required visual target. 'Final' only after root visual review.


Packed schema is authoritative in scripts/pack_assets.py and documented in docs/ASSET_RUNTIME.md. Runtime manifest schemaVersion1 contains projection, atlases[{key,image,data}] and assets keyed by content ID. Actor records contain kind,width,height,anchor,visualTop,pages,animations. Each animation contains frames,fps,loop,directions mapping to ordered frame names. Buildings use idle/construction/death entries; there are no separate constructionFrames or destroyedFrame fields. Environment records retain id,width,height,anchor,file and add kind:'environment',image. Atlas frame rectangles are untrimmed with two-pixel borders. Do not add mechanics to the manifest.

Source/export verification and browser completion are separate. The rendered calibration proves projection, and the packer checks image/metadata dimensions. The existing partial browser art check used buildings/environment with placeholder units. Corrected full unit export, complete final-asset packing, full browser matches and final performance/readability checks remain required; source or individual-render success does not prove them.
