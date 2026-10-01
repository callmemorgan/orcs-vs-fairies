# Fresh controls proof

These scripts capture features 81, 87, 89, and 90 from one committed source and one isolated production build. The final source must include SAVE4 and the current rules revision. Preparation bundles the current native code, generates the layered minimap session, typechecks the app, and builds both Vite entries. The combined runner then exercises Display, Gamepad, Saves/recovery, and layered minimap alerts in fresh browser contexts against its owned preview.

Browser actions use the ordinary primary app, its DOM, pointer and keyboard controls, and native SessionTools import/export. The Gamepad driver substitutes only a virtual standard controller at `navigator.getGamepads`. Browser evaluation reads game state; gamepad evaluation may also update the virtual controller sample. There is no physical-controller claim.

## Run from a frozen checkout

Wait for the final source pin before running this sequence. Replace `OVF_FINAL_SAVE4_PIN` with the full committed pin supplied for the proof. Use an independent dependency installation and a new output root.

```sh
: "${OVF_FINAL_SAVE4_PIN:?Set the final full source pin}"
proof_checkout="$(mktemp -d /tmp/ovf-controls-frozen.XXXXXX)"
git -C /home/morgana/Projects/orcs-vs-Fairies worktree add \
  --detach "$proof_checkout" "$OVF_FINAL_SAVE4_PIN"
cd "$proof_checkout"
npm ci
proof_root="$(mktemp -d /tmp/ovf-controls-proof.XXXXXX)"
export OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
node scripts/controls-proof/prepare.mjs "$OVF_FINAL_SAVE4_PIN" "$proof_root"
node scripts/controls-proof/run.mjs "$OVF_FINAL_SAVE4_PIN" "$proof_root" 5195
```

Choose an unused local port. The runner refuses an occupied port and owns the preview process. It closes each browser, stops the preview on success or failure, and records the remaining listeners. Repeating a proof requires a fresh output root; partially completed preparations and captures cannot be overwritten.

## What the scripts verify

`browser-common.mjs` compares every source, build configuration, proof script, and public asset with its committed Git blob. It records all compiled file hashes and compares primary HTML and its discovered JavaScript/CSS entries with the actual served bytes before and after each browser proof. Browser response bodies receive the same comparisons. The native bug report supplies the running app's build ID, save version, and rules revision. Module/build manifests and their file inventories remain bound to the same pin.

`schema.ts` derives game, session, and replay versions from the frozen core's constructors and exported constants. `verify-native.ts` requires the source pin and source/config digest embedded by esbuild. It compares the raw native game envelope with the decoder output, resaved loaded state, and full ReplayPlayer endpoint. It also checks recomputed replay analysis and technology timings.

The native checker independently continues loaded state and the warm replay endpoint through 100 normal 0.05-second steps. It issues hold, stop, movement, queued movement, hold, and stop, checks every command and step, proves movement during the movement phase, compares both recorder histories, and plays their extended archives back to the complete continued envelope. These core continuation commands are separate from the browser controls proof and do not mutate any captured native file.

`mounted.test.ts` covers eight-seat colors/shapes/ownership outlines and current alert navigation with instrumented graphics. Its config also runs the canonical level-focus regressions. The browser Display example preview has eight markers; its ordinary production match has two factions. These checks do not measure color perception or contrast.

`saves.mjs` captures named save/load, rejection preservation, fresh-context native import, three natural 30-second autosave rotations, pagehide/reload recovery, and persisted disabled preferences. It compares the complete game before pagehide, the forced checkpoint, and recovered export. It records normal wall-clock and simulation elapsed time. Its scope is local skirmishes on one browser origin, with recovery through Saves. Campaign/online saves, old imports, quota exhaustion, all 12 slots, and a separate visibility-hidden event remain outside this browser run.

`gamepad.mjs` checks camera pan/zoom, shoulder selection edges, hold/stop, cursor movement, queued movement, pause/resume, modal suppression, and reconnect safety. The exported native history must contain the six accepted worker commands in order. The native checker compares their sides and replay action indices with the browser report.

`scripts/verify_minimap_levels.mjs` imports the regenerated strict layered session through Saves and exercises natural damage, idle alerts, layer labels/navigation, cycling, and fog/level marker privacy. It now uses the common schema, build directory, provenance and finalizer. Running it alone requires the prepared module/build environment; the combined runner supplies that environment.

## Output and review

The output root contains the prepared native modules, isolated `dist/`, generated minimap inputs, mounted/current test results, feature screenshots and native downloads, native verification records, process logs, `run.json`, `final-manifest.json`, and `final-hashes.tsv`. Final inventories are written after browsers and preview close, including completed logs. A passing script result still requires opening the captured PNGs and auditing the actual manifest bytes before certifying the features.

The historical captures under `docs/evidence/controls-historical-6899f35-20261001/` and `docs/evidence/minimap-levels-20261001/` remain unchanged. Preparation tests for these tools ran on `b2e8e6d` / SAVE3 / rules `3.2.0`; those preparation results do not certify the final SAVE4 browser behavior.
