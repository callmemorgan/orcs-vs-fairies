# Minimap and display verification

The checked source is `6899f35ae1e8d8b08781005bf766b9bcce2755b6`, archived at `/tmp/ovf-controls-6899f35.oZddGk`. Twelve relevant requirement, source, CSS and test files were compared directly with the pinned Git objects; every byte matches. `pinned-source.json` contains their SHA-256 hashes. The alert, appearance, HUD and GameScene files are also identical to the previous `45e4c63efd366bbe53d217e8875dc858b18fcb62` snapshot (`source-comparison.json`). The earlier snapshot could not build because of unrelated merge errors; the production browser evidence uses the corrected pin.

The pinned ledger calls feature 81 "Minimap alerts" and requires "clearly mark raids, idle production and threatened expansions." Feature 87, "Accessible faction colors," requires "provide alternative palettes, patterns and unit outlines." Both remain `in-progress`, with empty evidence arrays. This verification made no source, ledger, save-version or repository changes.

Feature 87 has working controls and presentation integration. The normal Display button opens a labeled modal. Its native palette selector provides Default, Deuteranopia and Tritanopia. Shape and outline checkboxes update the preview, minimap and GameScene presentation. The non-color cues are eight different player polygons and own/ally/enemy outlines; GameScene draws ownership ellipses beneath units and outlined player badges. They are not hatched sprite fills or contours of the artwork. Settings persist on the device, survive reopening and browser reload, and reset through the normal button. Mounted checks also compared a complete save and replay checksum before and after control use; neither changed.

Feature 81 produces all three alert kinds on the active map layer, with different shapes and labeled buttons. The mounted idle check advanced the real simulation to 12.05 seconds, observed the square/pause marker and Idle 1 button, clicked its camera action, then recruited a Scrapper through the normal HUD action and observed the alert disappear. The combat check issued an accepted depot build, completed construction through simulation steps, issued an accepted attack command, observed 14 damage and a recorded damage time, then observed expansion diamonds and raid circles. Both corresponding camera buttons used the correct coordinates. Removing the test raider and advancing 8.1 seconds cleared the threat markers. Fog checks confirmed that a hidden raider did not enter the alert list or minimap draw calls.

There is a reproduced layer navigation defect. `src/ui/Hud.ts:151` draws markers only for the active layer, but `src/ui/Hud.ts:161` groups alerts from every layer and calls `center(alert.x, alert.y)` without passing `alert.level`. `src/main.ts:115` forwards only those coordinates, and `src/game/GameScene.ts:249` pans without switching layers. The mounted check placed a known owned-damage alert on level 1 while viewing level 0. The Raid 1 button appeared, no raid circle appeared on the current minimap, and clicking the button left `scene.viewLevel` at 0 while centering the surface camera at the underground alert's coordinates. The button's accessible name did not identify the layer. This is an implementation defect rather than missing proof. Feature 81 should not be certified without this limitation; keeping it in progress until layer navigation or layer labeling is handled is reasonable.

## Verification artifacts

Run the additional mounted checks from the archive root:

```sh
./node_modules/.bin/vitest run --config control-evidence/minimap-accessibility/vitest.config.ts > control-evidence/minimap-accessibility/mounted-tests.log 2>&1
```

The final run passed all five tests. The rerunnable script is `mounted-controls.test.ts`; `mounted-tests.log`, `vitest-results.json` and `mounted-observations.json` contain results and captured draw/camera observations. The first attempt is retained as `mounted-tests-first-attempt.log`: its failures were verification fixture errors (missing explored tiles, an incorrect worker label, unrevealed construction terrain, and a browser-style URL passed to Node file output), corrected before the passing run.

The existing browser proof agent ran an independent production Chromium context at `http://127.0.0.1:5193/`, using only ordinary DOM/keyboard/mouse controls and read-only runtime observations. I reviewed its script, JSON and four screenshots, checked all nine screenshot hashes, and verified its source-integrity report. The browser result passed with no page errors, console errors, failed requests or HTTP errors. A fresh match reached 13 seconds and showed Idle 1. Clicking the minimap moved camera scroll from `(800, -9.5)` to `(911.709..., 600.027...)`; clicking the idle alert restored `(800, -9.5)`. The browser also exercised both alternative palettes, both cue toggles, reopen, reload persistence and reset. `browser-review.json` records the inspected observations and artifact hashes.

The production script and original artifacts are owned by the browser proof agent under `control-evidence/saves/display/`:

```sh
node control-evidence/saves/display/verify-display.mjs > control-evidence/saves/display/browser.log 2>&1
```

Useful browser artifacts are `display-proof.json`, `source-integrity.json`, `01-default-game-idle.png`, `04-deuteranopia-display.png`, `05-deuteranopia-game.png`, `07-tritanopia-shapes-outlines-off.png`, `08-reloaded-persistence.png` and `09-reset-display.png`. The source-integrity report ties all source bytes to the pin and served HTML/JavaScript/CSS bytes to the production build. It does not claim an independently reproducible build.

## Limits

The mounted checks instrument canvas calls and mock Phaser graphics, artwork and audio. They prove the controls call the real HUD and GameScene presentation methods; they do not prove rendered pixels or artwork contrast. Their eight-seat fixtures isolate presentation by choosing one visible unit per seat; the construction fixture supplies resources and known terrain, and relocates a starting enemy beside the completed expansion. Build completion and damage still run through the real simulation. The layer defect uses an owned entity moved to the cavern as a bounded fixture.

The production screenshots show a real fresh duel and the eight-player example preview. No natural raid or threatened expansion occurred during that short browser run, so those two alert kinds have mounted/simulation proof but no production screenshot. Eight simultaneous armies were not compared in production gameplay. No user study or color-vision simulation established perceptual distinguishability across all battlefield backgrounds; unique palette values alone do not establish that. No additional missing implementation was found for feature 87's stated requirement.
