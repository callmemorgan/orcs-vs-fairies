# Porting the archived controls proof to SAVE4

This is a read-only review and a future rerun recipe. No verifier, browser, build, or simulation was run during this review. The captured originals under `/tmp/ovf-controls-6899f35.oZddGk` were not changed. Make every adaptation below in a fresh isolated checkout, and keep new evidence separate from the archived SAVE3 results.

The root checkout inspected during the review was `5c6a02219b723102124f9775040a78b205a52a7d`, with SAVE3 and simulation revision `3.2.0`. The separate SAVE4 migration checkout was `b8b2b202d55bcb91220530631ec7ba909c92df47`, with SAVE4 and revision `4.0.0`; it did not yet contain the imported minimap-level fix. Neither is the final combined SAVE4 pin. Set `OVF_FINAL_SAVE4_PIN` to the complete committed source that includes the migration and integrated controls before using this recipe.

The old Gamepad, Appearance, DisplaySettings and SessionTools application modules still matched the root Git blobs at the time of inspection. HUD and GameScene had changed. That comparison supports reusing the old verifier actions, but it does not prove those actions on the final combined build.

## Prepare a separate checkout

Run these commands from a terminal after the final combined SAVE4 commit exists. They are instructions, not commands executed by this review.

```sh
: "${OVF_FINAL_SAVE4_PIN:?Set this to the full final combined SAVE4 commit}"
proof_checkout="$(mktemp -d /tmp/ovf-controls-save4.XXXXXX)"
git -C /home/morgana/Projects/orcs-vs-Fairies worktree add --detach "$proof_checkout" "$OVF_FINAL_SAVE4_PIN"
cd "$proof_checkout"
printf '%s\n' "$proof_checkout"
source_pin="$(git rev-parse HEAD)"
test "$source_pin" = "$OVF_FINAL_SAVE4_PIN"
npm ci
mkdir -p control-evidence/gamepad control-evidence/saves/display control-evidence/minimap-accessibility
archive="$proof_checkout/docs/evidence/controls-historical-6899f35-20261001/control-evidence"
test -f "$archive/audit.json"
cp "$archive/gamepad/verify-primary-gamepad.mjs" control-evidence/gamepad/
cp "$archive/gamepad/verify-native.ts" control-evidence/gamepad/
cp "$archive/saves/verify-saves.mjs" control-evidence/saves/
cp "$archive/saves/display/verify-display.mjs" control-evidence/saves/display/
cp "$archive/minimap-accessibility/mounted-controls.test.ts" control-evidence/minimap-accessibility/
cp "$archive/minimap-accessibility/vitest.config.ts" control-evidence/minimap-accessibility/
```

Copy only the scripts and test/config files. Do not copy the old downloaded sessions, results, bundled native checker, manifests or screenshots into the new evidence directories. The relative `../../src/...` imports in the native checker and mounted test resolve correctly when the copies stay under this checkout's `control-evidence/gamepad` and `control-evidence/minimap-accessibility`. Moving them directly under a deeper `docs/evidence/...` directory requires adjusting those imports, including mocked module paths.

## Required browser-driver replacements

Use a common command-line contract in the copied browser scripts: URL in argv2, exact source pin in argv3, output directory in argv4. Create the output directory before launching Chromium. Add `execFileSync` from `node:child_process` and `mkdir` from `node:fs/promises` to their imports. Guard the pin and all staged/unstaged application changes:

```js
const checkedHead = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
const pin = process.argv[3] ?? checkedHead;
assert.match(pin, /^[0-9a-f]{40}$/);
assert.equal(pin, checkedHead);
assert.equal(execFileSync('git', ['diff', 'HEAD', '--name-only', '--', 'src'], {encoding:'utf8'}).trim(), '');
```

Use `sourcePin = pin` where the display driver's report expects that property. Replace every recorded `6899f35ae1e8d8b08781005bf766b9bcce2755b6` literal in these fresh copies with the checked pin. The original archive keeps its historical pin.

| Copied file and original line | Required replacement |
| --- | --- |
| `gamepad/verify-primary-gamepad.mjs:5` | Keep the URL argument; change `out` to `process.argv[4] ?? 'control-evidence/gamepad'`, then `await mkdir(out,{recursive:true})`. |
| `gamepad/verify-primary-gamepad.mjs:6` | Record `commit:pin` rather than the archive commit. Keep the local HTML hash, and add the source build ID and hashes of the assets received by the browser. |
| `saves/verify-saves.mjs:5` | Replace the pin constant with the checked argv3/Git HEAD value. |
| `saves/verify-saves.mjs:7` | Change `out` to `process.argv[4] ?? 'control-evidence/saves'`; keep the storage key and create the directory. |
| `saves/verify-saves.mjs:29` | Remove the `index-` bundle assumption. Match `/\/assets\/[^/]+\.js$/`, compare the response bytes with `dist` as before, and ensure the response is a script from the tested origin. |
| `saves/verify-saves.mjs:35` | Derive the current game save version from the frozen source and compare `manual.game.version` with it. For this run, assert that the derived version is 4. Keep `manual.version === 1`; that is the session wrapper version. |
| `saves/display/verify-display.mjs:1` | Use `const {chromium}=await import(process.env.OVF_PLAYWRIGHT_MODULE ?? 'playwright')` instead of the fixed workstation import. |
| `saves/display/verify-display.mjs:6–8` | Use argv4 for the output directory, argv2 for the URL, and the checked pin. The existing absolute output path would overwrite the original archive. |
| `saves/display/verify-display.mjs:100` | Use `.minimap-alert-list button[data-kind="idle"][data-level="0"]` for the default surface idle action. The old accessible-name expression requires punctuation immediately after `12 seconds`; authored level titles now appear before that punctuation. |

For a pure `.mjs` driver, derive the schema from the frozen TypeScript source before browser launch rather than importing TypeScript directly:

```js
const saveSource = await readFile('src/core/saves.ts','utf8');
const currentSaveVersion = Number(saveSource.match(/export const SAVE_VERSION\s*=\s*(\d+)/)?.[1]);
assert.equal(currentSaveVersion,4,'This certification run requires the final SAVE4 source');
```

Record the current simulation revision too, either through a small bundled helper importing `src/core/versions.ts` or by reading its quoted constant from the same frozen source. The reviewed migration used `4.0.0`; derive and record the final value instead of copying that historical observation.

The session format/version, replay wrapper format/version, local-save store, and appearance preferences remain version 1 in the reviewed SAVE4 implementation. Keep `orcs-vs-fairies:sessions:v1`, `ovf.appearance.v1`, `manual.version === 1`, and the preference/store version assertions. Only the game envelope, replay initial-save version and replay checksum version become 4. The invalid session import still uses wrapper version 999 and should still preserve the current game.

Use the source-hash algorithm already in `verify-saves.mjs` for the gamepad and display reports: sort all `src` `.ts`/`.css` paths, hash the path relative to `src` followed by its bytes, and record each file's SHA256. This is the algorithm in the current multi-entry `vite.config.ts`. The served main script is now `assets/main-*.js`, and the build also emits `editor.html`; do not assume an `index-*.js` file or a single entry. Discover the main page's script URL from its HTML or the page's script response, compare actual response bytes with the matching `dist` file, and preserve HTML/CSS/JavaScript hashes for every compiled entry. The saves driver also downloads a bug report and compares its build ID with the source build ID; retain that check.

For the display alert assertion, read the current level title and assert it when a world exists:

```js
const idleButton = page.locator('.minimap-alert-list button[data-kind="idle"][data-level="0"]');
const levelTitle = await page.evaluate(() => window.rts.state.world?.levels[0].title);
if(levelTitle) assert((await idleButton.getAttribute('aria-label')).includes(levelTitle));
await idleButton.click();
await page.waitForFunction(() => window.rts.viewLevel === 0);
```

The old display camera click occurs after the idle alert row appears. Before using its fixed point, read `document.elementFromPoint` and confirm that it is the minimap canvas. If a button covers it, select an unobstructed canvas point or do the camera reference click before the idle row appears. Keep ordinary pointer input and read-only camera observations.

The saves driver's final artifact scan at line 66 excludes only `display` by name. Keep outputs flat within each feature directory, or use `readdir(...,{withFileTypes:true})` and hash regular files only. Otherwise newly added subdirectories can cause a directory-read failure. Its final manifest deliberately omits the still-open browser/preview logs; hash those logs after both processes close, and refresh the final evidence index. Record the adapted driver hashes as well as the core source and build configuration hashes.

## Native checker replacement and rebuild

The old `gamepad/verify-native.ts` hardcodes its input/output paths and source pin. Its `../../src/...` imports are usable in the copied location. Replace the copied checker with the following current-source verifier. It keeps the accepted controller-command checks and compares the full exported envelope, so normalization of two states cannot hide an export difference.

```ts
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {dirname,join} from 'node:path';
import {decodeSessionFile} from '../../src/core/session-storage';
import {ReplayPlayer,replayChecksum} from '../../src/core/replays';
import {saveGame,SAVE_VERSION} from '../../src/core/saves';
import {SIMULATION_REVISION} from '../../src/core/versions';

const inputPath=process.argv[2]??'control-evidence/gamepad/gamepad-native-session.json';
const outputPath=process.argv[3]??'control-evidence/gamepad/native-verification.json';
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const pin=process.argv[4]??head;
assert.equal(pin,head);
assert.equal(execFileSync('git',['diff','HEAD','--name-only','--','src'],{encoding:'utf8'}).trim(),'');
assert.equal(SAVE_VERSION,4);
const bytes=readFileSync(inputPath),file=JSON.parse(bytes.toString());
assert.equal(file.version,1);
assert.equal(file.game.version,SAVE_VERSION);
assert.equal(file.replay.initial.version,SAVE_VERSION);
assert.equal(file.replay.checksumVersion,SAVE_VERSION);
assert.equal(file.replay.simulationRevision,SIMULATION_REVISION);
const decoded=decodeSessionFile(file);
assert.deepEqual(decoded.file.game,file.game);
assert.deepEqual(saveGame(decoded.state),file.game);
const replay=new ReplayPlayer(file.replay);
try{
  replay.seek(file.replay.finalTick);
  assert(replay.finished);
  assert.equal(replay.state.tick,file.game.state.tick);
  assert.deepEqual(saveGame(replay.state),file.game);
  assert.equal(replayChecksum(replay.state),file.replay.finalChecksum);
  const commands=file.replay.actions.filter((a:any)=>a.type==='command').map((a:any)=>a.command);
  const browserProof=JSON.parse(readFileSync(join(dirname(inputPath),'gamepad-primary-proof.json'),'utf8'));
  assert.equal(browserProof.source.commit,pin);
  assert.deepEqual(commands,browserProof.commands);
  assert.equal(commands.length,6);
  for(const type of ['hold','stop','move'])assert(commands.some((c:any)=>c.type===type));
  assert(commands.some((c:any)=>c.type==='move'&&c.queued));
  const hash=(data:Buffer)=>createHash('sha256').update(data).digest('hex');
  const result={sourcePin:pin,inputPath,inputSha256:hash(bytes),
    checkerScriptSha256:hash(readFileSync('control-evidence/gamepad/verify-native.ts')),
    tick:replay.state.tick,checksum:replayChecksum(replay.state),saveVersion:SAVE_VERSION,
    simulationRevision:SIMULATION_REVISION,acceptedCommands:commands,
    nativeDecoderPassed:true,completeEnvelopeRoundtripPassed:true,completeReplayEnvelopePassed:true};
  writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
}finally{replay.dispose();}
```

Rebundle this TypeScript checker against the final source. Never run the old captured `verify-native.mjs` against a fresh SAVE4 download. The reviewed migration preserves the original game envelope when decoding historical sessions while returning migrated state separately. It permits historical replay archives to be inspected but requires the current save version and simulation revision for `ReplayPlayer`. Consequently, an archived SAVE3 session is migration evidence, not a substitute for fresh SAVE4 gamepad or save/reload certification. Do not edit old JSON version numbers or checksums to make it pass.

The generic current `scripts/minimap-alerts/verify-native-export.ts` can independently check new save-driver downloads as well. Rebundle it from the same frozen checkout and use each newly downloaded native file as input. Retain the separate command-history assertions for gamepad certification.

## Mounted minimap/accessibility test replacements

Keep the original test and its five-test SAVE3 report intact. Apply these changes only to the fresh copied test:

| Original copied-test lines | Required adaptation |
| --- | --- |
| 42–43 | Derive the reported source pin from Git HEAD and write observations to the fresh checkout's output directory. Do not retain the old literal. |
| 116 | Change the idle camera expectation to `toHaveBeenLastCalledWith(hq.x,hq.y,0)`. Current HUD passes an explicit level. |
| 143–144 | Change the expansion and raid camera expectations to three arguments, using `entity.level ?? 0`. |
| 150 | Rename the case to describe correct off-level navigation rather than reproducing the old limitation. |
| 161 | Use `callbacks.center=(x,y,level)=>{if(level!==undefined)scene.setViewLevel(level);scene.centerOn(x,y);}`. This is the current main-host callback contract. |
| 163 | Expect `scene.viewLevel === 1`; keep the projected coordinate assertion. |
| 164 | Assert that the alert aria label includes `state.world!.levels[1].title`. The old assertion that it omits the cavern title describes the fixed bug. |
| 165 | Record `proof.layerNavigation` with the correct level/title and `sameCoordinatesWrongLayer:false`; remove the historical limitation claim from the new result. |
| 173 | Replace `(scene as any).graphics[4]` with `(scene as any).overlay`, or select the mocked graphic by depth 100001. `cosmeticLayer` was inserted before fog, so array index 4 now identifies fog rather than the ownership overlay. |

Keep the archived assertions for palette choices, eight player shapes, own/ally/enemy outlines, preference persistence and unchanged game save/checksum. Their wrapper versions and palette values did not change in the reviewed source. These are instrumented rendering tests with controlled fixtures, not raster or fresh-browser evidence. Revalidate exact draw-call counts when running against the final source; do not describe a static review as a pass.

The copied `vitest.config.ts` has three fixed paths on line 2: `cacheDir`, `test.include`, and JSON `outputFile`. They work as written when run from the new checkout root under `control-evidence/minimap-accessibility`. If the output tree changes, update all three plus the test's observation path and every relative source/mock import. Keep caches out of the preserved final artifact index. Run the frozen canonical `tests/minimap-level-focus.test.ts` too; it tests the integrated level switch, labels, cycling and hidden/off-level behavior through the current HUD/scene contract.

## Regenerate feature 81 from the frozen source

Feature 81 already has reusable current-source scripts. Generate a fresh native session with `scripts/minimap-alerts/level-scenario.ts`, which calls the frozen source's `createMatch`, `spawnDefinition`, `createSessionFile`, `MatchRecorder`, and native decoder. These constructors populate new entity and runtime fields. The exported save, replay initial envelope, and checksums therefore come from the SAVE4 implementation. Do not change version numbers in the archived SAVE3 fixture.

The generator's feasibility check must pass with current simulation rules before the new fixture goes into the production browser. If it fails, inspect the new rule's effect on the authored scenario and adapt the generator in a separate working copy. Keep natural simulation damage, visibility, alerts, and accepted orders; do not fill damage or alert timers into a captured session. Record any changed generator and its hash as part of the rerun.

Create the new fixture before building the production app:

```sh
minimap_proof="$proof_checkout/control-evidence/minimap-levels"
mkdir -p "$minimap_proof"
node_modules/.bin/esbuild scripts/minimap-alerts/level-scenario.ts \
  --bundle --platform=node --format=esm --loader:.svg=text \
  --outfile="$minimap_proof/level-scenario.mjs"
node "$minimap_proof/level-scenario.mjs" "$minimap_proof"
```

The production driver imports this newly generated native session through the normal Saves dialog. Rebundle `scripts/minimap-alerts/verify-native-export.ts` against the same frozen source for its complete decoder/resave and ReplayPlayer comparisons. Both scripts accept explicit output paths; retain that contract. The browser driver's JavaScript asset matching already accepts the current multi-entry build. It currently checks an unstaged source diff, so keep the detached checkout's tracked source/configuration clean and audit every source file against the pin before and after the run.

## Run after the adaptations

These commands assume the argv contract and replacements above have been applied to the copied scripts. They do not alter the archived originals. Run each browser proof sequentially with a fresh context against one frozen preview.

```sh
node --check control-evidence/gamepad/verify-primary-gamepad.mjs
node --check control-evidence/saves/verify-saves.mjs
node --check control-evidence/saves/display/verify-display.mjs
node_modules/.bin/vitest run --config control-evidence/minimap-accessibility/vitest.config.ts > control-evidence/minimap-accessibility/mounted-tests.log 2>&1
node_modules/.bin/vitest run tests/appearance.test.ts tests/display-settings.test.ts tests/gamepad.test.ts tests/minimap-alerts.test.ts tests/minimap-level-focus.test.ts tests/session-storage.test.ts tests/session-tools.test.ts > control-evidence/current-controls-tests.log 2>&1
npm run build > control-evidence/build.log 2>&1
npm run preview -- --port 5195 --strictPort > control-evidence/preview.log 2>&1
```

Leave that preview terminal running. In a second terminal, set `proof_checkout` to the printed/retained directory from the preparation step and run:

```sh
: "${proof_checkout:?Set this to the directory printed by the preparation step}"
cd "$proof_checkout"
source_pin="$(git rev-parse HEAD)"
export OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
node control-evidence/gamepad/verify-primary-gamepad.mjs http://127.0.0.1:5195/ "$source_pin" control-evidence/gamepad > control-evidence/gamepad/browser.log 2>&1
node_modules/.bin/esbuild control-evidence/gamepad/verify-native.ts --bundle --platform=node --format=esm --loader:.svg=text --outfile=control-evidence/gamepad/verify-native.mjs > control-evidence/gamepad/native-build.log 2>&1
node control-evidence/gamepad/verify-native.mjs control-evidence/gamepad/gamepad-native-session.json control-evidence/gamepad/native-verification.json "$source_pin" > control-evidence/gamepad/native-verification.log 2>&1
node control-evidence/saves/verify-saves.mjs http://127.0.0.1:5195/ "$source_pin" control-evidence/saves > control-evidence/saves/browser.log 2>&1
node control-evidence/saves/display/verify-display.mjs http://127.0.0.1:5195/ "$source_pin" control-evidence/saves/display > control-evidence/saves/display/browser.log 2>&1
minimap_proof="$proof_checkout/control-evidence/minimap-levels"
node scripts/verify_minimap_levels.mjs http://127.0.0.1:5195/ "$source_pin" "$minimap_proof" > "$minimap_proof/browser.log" 2>&1
node_modules/.bin/esbuild scripts/minimap-alerts/verify-native-export.ts --bundle --platform=node --format=esm --loader:.svg=text --outfile="$minimap_proof/verify-native-export.mjs" > "$minimap_proof/native-build.log" 2>&1
node "$minimap_proof/verify-native-export.mjs" "$minimap_proof/native-final.json" "$minimap_proof/native-verification.json" "$source_pin" > "$minimap_proof/native-verification.log" 2>&1
node_modules/.bin/esbuild scripts/minimap-alerts/verify-native-export.ts --bundle --platform=node --format=esm --loader:.svg=text --outfile=control-evidence/saves/verify-native-export.mjs > control-evidence/saves/native-build.log 2>&1
for native_name in native-manual native-loaded native-after-rejected-import native-pagehide-autosave native-recovered-autosave native-imported-fresh-browser
do
  node control-evidence/saves/verify-native-export.mjs "control-evidence/saves/$native_name.json" "control-evidence/saves/$native_name-verification.json" "$source_pin" > "control-evidence/saves/$native_name-verification.log" 2>&1 || exit 1
done
```

Use only the virtual standard-controller API supplied through `navigator.getGamepads`, including its axes, buttons, timestamp, disconnect and reconnect samples. Keep the existing `__certpad` object isolated from game runtime. Do not write `window.rts`, issue commands through evaluation, override clocks or inject game state. The native recorder must retain the orders accepted through the ordinary production GameScene.

After the browser contexts close, stop the owned preview with Ctrl+C in its terminal and inspect `ss -ltnp '( sport = :5195 )'` for a remaining listener. Open the new screenshots and inspect the actual controls, selections and rendering. Finalize hashes after logs close, recording the exact frozen pin, current save/rules versions, served and compiled bytes, adapted scripts, native downloads/results and screenshots. The old archive remains historical proof at `6899f35`; this recipe does not mark any feature verified on SAVE4.
