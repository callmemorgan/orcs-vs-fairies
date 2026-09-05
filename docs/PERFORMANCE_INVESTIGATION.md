# Final-art rendering investigation

The recorded final-art baseline is 58.56 FPS with 100 units at 1920×1080. This investigation inspected the installed Phaser 4.2.1 source and existing atlas pixels without opening a browser or rebuilding the game. It identifies removable work; it does not establish a measured speedup.

## Atlas trim

`scripts/pack_assets.py:41` previously described every frame as untrimmed, with a full 160×192 or 192×192 draw rectangle. The RGBA atlas images contain much smaller subjects. Pixel inspection of the six attack frames in the benchmark directions, east for orcs and west for fairies, found the following average alpha-bounding area as a percentage of the full rectangle. These measurements precede the added one-pixel filtering border.

| Unit | Alpha bounds / full rectangle |
| --- | ---: |
| Fairy melee | 15.29% |
| Fairy ranged | 14.55% |
| Fairy special | 20.38% |
| Fairy worker | 12.67% |
| Orc melee | 22.62% |
| Orc ranged | 19.82% |
| Orc special | 21.00% |
| Orc worker | 16.04% |

The raw measurements are saved in `work/performance-investigation/alpha-bounds.json`. They measure pixel bounds, not GPU time. They support reducing the submitted sprite rectangle because Phaser's `TexturerImage.js:114` uses `frame.cutWidth` and `frame.cutHeight`, and `TransformerImage.js:115–122` applies the frame's source offset relative to the original display origin. `textures/parsers/JSONHash.js:62–71` already reads `trimmed`, `sourceSize` and `spriteSourceSize`. `Size.js:135–136` retains the original logical width and height through `frame.realWidth` and `frame.realHeight`. `TextureManager.js:1577–1588` adjusts pixel-hit coordinates for trim offsets.

The approved implementation changes only packing metadata. Sheet pixels and page layout remain unchanged; each atlas frame uses its alpha bounds plus a one-pixel transparent border. The original canvas dimensions remain in `sourceSize`, and the trimmed rectangle's original position remains in `spriteSourceSize`. This reduces transparent fragment processing while preserving the existing anchor and image scale. It does not reduce atlas GPU memory or texture count because the sheets remain unchanged.

`scripts/check_asset_packer.py` now packs 16 distinct synthetic frames with different offsets, a transparent hole and a faint alpha-1 edge pixel. Each trimmed frame reconstructs the exact original RGBA canvas. The check also compares alpha at every original pixel coordinate and verifies ground-relative pixel positions through the trim offset and anchor. The test passes. Public assets have not been repacked and browser performance has not been remeasured by this task.

## Repeated sprite setters

`src/game/ArtRuntime.ts:51–56` calls `setTexture`, `setOrigin`, `setPosition`, `setDepth`, `setAlpha` and `setData` on every retained sprite every render frame. Animation changes occur at 5–10 FPS, while rendering is around 60 FPS; stationary units keep the same position and depth between frames. The installed `components/Texture.js:74–78,102–141` resolves the texture/frame and updates size and origin even if the input is unchanged. `components/Depth.js:55–63` queues a scene depth sort even when the value is identical, and `DisplayList.js:185–191` performs that sort before rendering.

The approved `ArtRuntime.ts` change compares the existing texture key and frame name before calling `setTexture`; compares the current origin, position, depth and alpha before their setters; and updates `visualTop` only when its value changes. Sprite creation, destruction, animation selection and hit testing remain unchanged. `setDepth` still runs whenever the projected depth changes, so moving units continue to sort. TypeScript and the packer reconstruction test pass. A mock control-flow check confirmed that 100 identical placements invoke no setters, while changed frame, position, depth and alpha still apply. This is not browser rendering evidence. Its frame-time benefit requires an A/B browser measurement and is not quantified here.

## Texture upload and batching

The inspected Image path does not upload a PNG when `setTexture` changes an animation frame. `SubmitterQuad.js:187–190` submits the existing `frame.source.glTexture`. The default image nodes use `BatchHandlerQuad`, whose multi-texture branch (`BatchHandlerQuad.js:966–999`) reuses a texture's batch unit and starts a new sub-batch only when the texture limit is reached. Texture uploads occur in `WebGLTextureWrapper` resource creation/update, not the frame setter. No evidence was found for a per-frame atlas upload, so changing image-loading behavior is not proposed.

The scene also retains and renders the placeholder ground Graphics underneath the final ground RenderTexture. Phaser's Graphics renderer traverses its command buffer every frame. That is extra work, but removing it could expose tile-edge gaps; it also exists in the placeholder comparison. It is not the first proposed change. Apply the atlas trim and repeated-setter optimization separately, preserve the benchmark conditions, then compare full frame-time summaries before pursuing further changes.
