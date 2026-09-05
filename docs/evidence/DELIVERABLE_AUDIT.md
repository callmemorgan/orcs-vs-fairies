# Deliverable audit

This read-only audit inspected the local project and the frozen `index-BbPjUpKo.js` production revision. It did not change source, assets, the production build or the active browser match. This document records the checks afterward.

## Map and current source

`src/core/simulation.ts` implements one 48 x 48 map with two headquarters starts, five workers and one melee unit per side, and 22 mirrored resource deposits. `src/game/ArtRuntime.ts` draws the 2,304 ground tiles using the final grass, dirt and stone textures. `src/game/GameScene.ts` places resource trees, ore, exhausted-tree stumps and central ruin pieces. The map exists as executable game data and presentation; no separate map-construction task was found missing.

Every current file listed in `docs/evidence/current-verification.json` was hashed again and matched its recorded source hash. That record identifies `index-BbPjUpKo.js`, an exit-0 `npm test` run and unchanged source during the run. `current-tests.txt` reports 58 passing tests. The audit read the skirmish test itself: it creates the normal map, uses public AI commands for both sides, advances the shared simulation and checks resource deposits, recruitment, construction, combat and a destroyed headquarters. Those tests support map operation. They do not prove current human match duration or replace browser play.

Key recorded source hashes that matched during this audit:

| File | SHA-256 |
| --- | --- |
| src/core/content.ts | 3c333e2a86d013f056781014edcd9f55abe24a6fb9922c299970eef5689025fd |
| src/core/simulation.ts | 377ecfa6c53057003771a3c2adf57114b09170e817cb2db6fe8084f9f5b23388 |
| src/game/ArtRuntime.ts | 879a4fe601b3437809fb0944173798dd425f738e228b4592e6875262e0fa7254 |
| src/game/GameScene.ts | 7572a255b5318c631a43e5c32cf9f855e71d087e68cddb0decd1ec6d082c3fd5 |

## Exported assets and editable scenes

The audit counted eight unit entries, eight building entries and 15 environment entries in `public/assets/manifest.json`. The raw actor directories contain 1,536 unit PNGs and 40 building PNGs. There are 31 `.blend` scene files. The public and production manifests are equal, and all 63 referenced atlas PNG/JSON and environment PNG files are byte-identical between `public/assets/` and `dist/assets/`.

The following command was run fresh during the audit:

```bash
.venv/bin/python scripts/validate_assets.py
```

It exited 0 and reported 31 assets, 1,576 atlas frames, 24 atlas pages, 230.59 MiB of decoded atlas pixels and `status: pass`. The validator checks required IDs, frame coverage, atlas bounds, nonempty alpha and changing multi-frame animations. It does not establish visual quality, gameplay readability or browser performance.

Three representative files were opened in Blender in background mode without rendering or saving. This verifies their actual editable contents; the audit did not open all 31 scenes.

| Scene | Objects | Meshes | Actions | Camera present |
| --- | ---: | ---: | ---: | --- |
| art/blender/scenes/unit-orc-melee.blend | 115 | 91 | 72 | Yes |
| art/blender/scenes/building-orc-hq.blend | 437 | 425 | 0 | Yes |
| art/blender/scenes/environment-tree-oak.blend | 685 | 658 | 0 | Yes |

The eight-unit roster contact image was also inspected. It contains the distinct orc and fairy silhouettes and equipment. The broader visual review and actual previous-match observations remain in `VISUAL_REVIEW.md`; the contact sheet alone is insufficient evidence of readability during combat.

## Provenance and local delivery

The retained generated reference is `art/reference/factions-and-battlefield.png`, with a provenance summary in `art/reference/prompt.md`. The summary does not claim to preserve the exact original prompt. The decision record places reference generation before the placeholder match gate and authorizes final Blender production only after that gate. `PLACEHOLDER_GATE.md` records normal gathering, building, recruitment, combat, defeat and restart. The later production and full regeneration evidence is in `ASSET_REPRODUCTION.md`. This chronology supports the required reference-first, placeholder-first process.

The audit inspected the actual `common.py`, `environment.py`, `buildings.py` and `units.py` generator files, the asset wrapper and packaging/validation tools. `ASSET_REPRODUCTION.md` records a completed full wrapper run. Rendered PNGs showed small measured pixel differences on repetition; byte-identical image generation is not promised. `BUILD_REPRODUCTION.md` separately records all 67 current production files reproduced byte-for-byte from isolated matching inputs and dependencies, including `index-BbPjUpKo.js`.

README commands for `npm ci`, development, production build and preview match `package.json`. Asset dependency setup and regeneration instructions match the available scripts. The current isolated reproduction did not repeat its HTTP launch check; its earlier launch evidence is identified as historical. The root's current browser match is separate evidence of serving the frozen current build.

The stated exclusions remain multiplayer, campaign, heroes, save/load, mobile controls and public deployment. The inspected code has no required external game service. Local storage is used for the mute preference, not saved matches; the optional QA request records local telemetry.

## Remaining gates and limitations

The one-map structural deliverable is present. Current-revision complete human matches and the 10–15 minute human pacing target remain pending at this audit. Automated durations must not be substituted for those observations. The latest measured 100-unit performance remains below the 60 FPS target.

The flower image is loaded and validated but has no placement call in the map renderer. It is an unused decoration, not missing terrain or a missing playable map. Avoid claiming every generated decoration appears in play.

The Wardrum's drum is hidden in the exact rear view. Tall trees and roofs can obscure units, and the fairy worker and melee unit share body/palette features. These known overlap and recognition limits are documented in `VISUAL_REVIEW.md`. This audit does not certify perfect visibility or close the final browser review.
