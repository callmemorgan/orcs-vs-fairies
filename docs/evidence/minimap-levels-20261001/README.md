# Minimap alerts across map levels

The production browser proof passed all 12 checks at source `4440bc8a623cc103583b2d92f78b4aafd26e3ca3`. Raid, threatened-expansion and idle-production buttons display the authored map-level names, switch the WorldTools level control and center the selected target. Clicking the cavern idle group again selects the next building; clicking the surface idle group returns to the surface. Entity markers and alert markers stay on their own level, and hidden enemy markers remain absent.

The tested build ID is `e8829a83cb97acc0181aadc79b9e7957f2591bb02310b4da053bf5516b083a01`. The browser received `/assets/main-CWShajwg.js`, whose SHA256 is `fcec588e9a02572380a30f8d583c0907a84de617e029cb31d8cc23fe16eab265`. The downloaded native bug report contains the same build ID. `manifest.json` records the committed application source, build configuration, compiled files, verification scripts and evidence hashes. `hashes.tsv` contains repository-relative paths and SHA256 values; the manifest and TSV omit themselves to avoid circular hashes.

`browser-proof.json` records the assertions, read-only observations, camera references, pixel buffers and served bundle identity. The run recorded no page exceptions, console errors, failed requests or HTTP errors. Browser contexts closed normally. `cleanup.json` records that the owned preview processes stopped and port 5194 had no listener. The closed preview and browser logs are included in the final hashes.

## Native fixture and replay

`scripts/minimap-alerts/level-scenario.ts` authors a validated two-level 36 by 36 annihilation match through `createMatch(..., {scenario: true})`. Both levels use grass and zero elevation, with one entrance and no resource nodes or neutral sites. The human and external controllers prevent unrelated AI decisions. Buildings and troops use normal content definitions and `spawnDefinition`; enemy attacks use ordinary `issueCommand` orders. The serialized fixture starts at tick 0, time 0, with no events or damage history. A discarded decoded copy advances 260 normal ticks to prove that combat damage and idle-production alerts occur after 13 seconds. This copy never replaces the imported fixture.

The fixture places a surface headquarters at (6.5, 6.5), a cavern headquarters at (8.5, 8.5), a cavern barracks at (18.5, 8.5), and a cavern expansion headquarters at (25.5, 23.5). Two enemies attack the cavern headquarters and expansion. Separate hidden sentinels occupy the cavern and surface; the surface sentinel shares the expansion's XY position to test filtering between levels. `level-alerts-ids.json` records their IDs and positions. The fixture SHA256 is `2bd0a52d2f90940c4bb1f5e707deb5b164f9b5fc824316176282e4a08aaae15e`.

The browser imports the fixture through SessionTools and exports it before play. Its complete game envelope equals the generated fixture. Every subsequent action uses displayed controls, mouse or keyboard input. Page evaluation only reads runtime state, DOM values or canvas pixels. The driver does not issue commands, call scene methods, inject events, change time or write runtime state.

`native-final.json` is the final native SessionTools download at tick 386 and time 19.30000000000014. Its SHA256 is `0d101fce5a36e5e786f32b80ee37aa858e5ab954ca39564037936741961ad4c2`. `native-verification.json` and its log record strict native decoding, complete game-envelope roundtrip equality, and replay of ticks 0 through 386. The replay finishes at checksum `9d3446a3`, and `saveGame` of the replayed state equals the complete exported game envelope. The captured format is SAVE3 with simulation revision `3.2.0`. The reusable TypeScript checker uses the current core modules, records its own script hash, and takes an optional source pin after the output path; otherwise it records Git HEAD.

## Browser checks and screenshots

The 12 checks cover native import, minimap camera calibration, natural damage and idle timing, level names and live announcements, surface marker filtering, raid targeting, expansion targeting, idle headquarters targeting, idle cycling, cavern marker and fog filtering, returning to the surface, native final export, and downloaded build identity. Natural damage, names and announcements share one check.

Camera references come from ordinary minimap clicks before idle buttons add an overlapping row. The driver verifies that the clicked element is the canvas. Integer mouse coordinates quantize those references, so the camera comparison allows six pixels. Observed X differences are 0 for the headquarters, 1.1636363636362148 for the expansion and 0.5818181818181074 for the barracks; all Y differences are 0. Enemy probes count the ownership outline because the white raid icon can cover the small marker fill. Final pixel counts are 4 visible enemy outline pixels, 88 cavern idle pixels, 0 hidden enemy pixels and 0 off-level surface idle pixels.

All seven final screenshots were opened and visually inspected. They show readable alert labels and WorldTools selection, the correct selected level, and the changed target locations.

| Screenshot | Observed behavior |
| --- | --- |
| `surface-alerts.png` | Surface view shows the grouped alerts with authored level names. |
| `raid-selects-cavern.png` | Raid button selects the cavern and centers its headquarters. |
| `expansion-selects-cavern.png` | Expansion button selects the cavern expansion. |
| `idle-selects-cavern-hq.png` | Cavern idle group selects the headquarters first. |
| `idle-cycles-to-cavern-barracks.png` | Repeating the cavern idle action centers the barracks. |
| `cavern-marker-privacy.png` | Cavern markers appear while hidden enemies and surface markers remain absent. |
| `surface-idle-return.png` | Surface idle button returns the WorldTools selection and camera to the surface. |

## Reproduce on current source

Run from the repository root with dependencies installed and committed application source. Use a fresh evidence directory so this captured proof stays intact. Bundle the TypeScript generator and checker against the current core source. Regenerate the fixture before every run, including after migration to SAVE4; the captured SAVE3 bundle, fixture and final export are historical artifacts and must not substitute for regeneration.

```sh
mkdir -p work
proof_dir="$(mktemp -d work/minimap-levels.XXXXXX)"
source_pin="$(git rev-parse HEAD)"
node_modules/.bin/esbuild scripts/minimap-alerts/level-scenario.ts --bundle --platform=node --format=esm --loader:.svg=text --outfile="$proof_dir/level-scenario.mjs"
node "$proof_dir/level-scenario.mjs" "$proof_dir"
npm run build
npm run preview -- --port 5194
```

In another terminal, use the same `proof_dir` and `source_pin` values while the preview runs. Set `OVF_PLAYWRIGHT_MODULE` to an installed Playwright module when it is outside the project dependencies. The captured run used `/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`.

```sh
OVF_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/verify_minimap_levels.mjs http://127.0.0.1:5194/ "$source_pin" "$proof_dir"
node_modules/.bin/esbuild scripts/minimap-alerts/verify-native-export.ts --bundle --platform=node --format=esm --loader:.svg=text --outfile="$proof_dir/verify-native-export.mjs"
node "$proof_dir/verify-native-export.mjs" "$proof_dir/native-final.json" "$proof_dir/native-verification.json" "$source_pin"
```

Stop the preview after the browser and native checks finish, and inspect the saved screenshots. The browser driver rejects an incorrect source pin, dirty application source or a fixture whose save version differs from the current `SAVE_VERSION`. The native checker also rejects application source that differs from its recorded pin and rejects an outdated exported save version.

## Limits and historical attempts

This proof uses an authored native match to reach the two-level alert conditions. It does not establish the fresh-menu match path or public online behavior. Initial hidden sentinels prove fog filtering here; loss of visibility after troop movement belongs to the core and mounted regression checks. Earlier control and session proofs remain historical and do not establish behavior at this source pin.

The flat `attempt-1-*` through `attempt-4-*` files retain failed verifier runs. They failed on an outdated bundle-path expression, an ambiguous Map level locator, an alert overlay intercepting a camera reference click, and a marker-fill probe covered by the raid icon. Their old manifests contain the paths used at the time, before the files received their historical prefixes. These attempts are diagnostic history; the current passing browser proof and final manifest identify the verified result.
