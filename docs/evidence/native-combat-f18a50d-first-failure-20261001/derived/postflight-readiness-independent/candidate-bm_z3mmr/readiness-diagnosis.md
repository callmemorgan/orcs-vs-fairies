# Replay readiness diagnosis at f18a50d

This is a static candidate diagnosis of the first failed run at `f18a50d904c57ae1652f157b946ebd39d8d8923c`. It uses original files in `/tmp/ovf-native-combat-f18a50d-retry-20261001-zssa25k5` and immutable Git blobs. No checker, helper, compiler, build, fixture generator, freeze, browser, replay/history audit, simulation, or gameplay ran during this diagnosis. No root or owned source changed. This report is the only file written by this diagnosis.

The retained state directly disproves the `window.rts.art.loaded` term of the readiness predicate. It reports `mode="replay"`, tick/time zero, `paused=true`, and `art={enabled:true,loaded:false,assets:100,loadedAtlasPages:32,decodedAtlasMiB:366.5933837890625,renderedUnits:5}`. The readiness predicate at pinned `scripts/acceptance/native-context.mjs:18` requires the loading indicator hidden, a camera, a canvas, and loaded artwork. Its snapshot at lines 14–17 omits camera and DOM fields. A missing camera field is therefore not evidence that the camera was null. The pinned `window.rts` getter returns an object only when `scene.cameras.main` exists (`main.ts:453`); because the successful snapshot reads `r.state` and the other fields, that source guard establishes a camera existed at capture time. The retained state cannot establish the loading indicator or canvas terms.

Stage 06 timed out after 60,000 ms at `ready` (`native-context.mjs:18`), called by `persistence` at line 96 for `charge-stop-interrupted`. The stack and last check place this after the complete native save round trip and after replay-mode admission, but before the `Replay tick` End input, endpoint save, endpoint comparison, or return-to-local import. `direction-defense.mjs:137–159` establishes this position in the stop branch. The saved endpoint is tick 70; the captured replay remains at its initial tick zero. All game-state fields in retained `lastState`, excluding the explicitly added UI/art fields, equal the original replay's initial state.

## Original data and retention

The original interrupted save and `native-import-68-save.json` are byte-identical at 364,736 bytes and SHA-256 `6f9af6f29b31a1f0684df498ab73f54bee87c5523b99f1609e26a98e2520373f`. This includes the full session wrapper, game state, runtime, replay, and planning. The interrupted replay is 173,122 bytes and SHA-256 `25a6656c971a95e7b20e33dc85156601aaa6d992d39adcbae8201f16671d95f2`. Its format, version, initial game, full action array, final tick, final checksum, checksum version, and simulation revision equal the embedded saved replay, which are the original replay fields compared by `native-contract.mjs:58–61`. Its final tick is 70, checksum `070ce908`, SAVE4, and revision `4.0.1`.

The full retained action sequence is advance 10 ticks at dt 0.05; side-zero move of troop 51 to `(23.59375,24.5,level 0)` with `queued=false`; advance 31 ticks; side-zero hold of troop 51; advance 29 ticks. This is a static reading of retained actions, not a replay execution or an independent checksum verification.

A read/hash pass found all 303 first-sealed originals unchanged: 94,034,440 bytes, zero mismatches against `first-failure-artifact-manifest.json`. All 148 browser-registered native downloads also match their recorded bytes and SHA-256. The seal manifest itself has SHA-256 `922c604e7d17c015d878cfd4f1ce0f133df2c208ef5f7ad9ca8b0a9c2b8d9fba`. The main browser receipt has SHA-256 `7c24b87e4a1d8ef89e6164e86a544b29c272a5d00f2cf8d2c604b681a2fbd3a4`, 304,363 bytes. Its failure log is `logs/06-browser.stderr.log`, SHA-256 `6330a13f7724aa16618923654e077dddff876c1ccbeda41e52cc5a077ef1e759`.

The original freeze SHA-256 is `66f880c7ef685437e56b83708c03972c47cf5cbdb8f7846b243839b613e9fc31`. The original first dist/public receipt SHA-256 is `6994f890fc171dfa2f779aa0fea1d5dd7ac7f1986148f3e32f4171a13ffa79c9`, matching the retained digest recorded before preview/browser. This diagnosis does not rerun either acceptance stage. The original receipt contains 84 checks, 148 downloads, 39 PNGs, zero complete groups, and no page errors or recorded executable asset failures. Native history stage 07 and final dist/public stage 08 remain skipped. All 39 encounters remain open; this diagnosis promotes no feature.

## Source ordering and asset lifecycle

`src/main.ts:268–272` decodes/verifies the replay and passes its initial state to `launch`. `launch` at lines 201–225 replaces the whole Phaser game; if an existing game is present, line 203 schedules launch after retirement. `retireGame` sets `game` and `scene` to undefined before destruction at lines 183–186. `SessionTools.ts:135–137` clears the input and displays `Replay loaded.` after the callback returns, which may be before the scheduled replacement game preloads and creates. The acceptance script therefore waits for replay mode and then artwork readiness separately (`native-context.mjs:95–96`). The success notice alone does not establish render readiness.

Each fresh scene constructs a fresh `ArtRuntime` in `GameScene.ts:146`. `ArtRuntime.complete` starts false at line 16. Its schema-1 manifest handler stores the manifest and queues required faction atlas pages and all environment images at lines 26–33. `GameScene.create` calls `art.ready()` at line 149. `ArtRuntime.ready()` returns without changing completeness if no manifest exists (line 36); otherwise it collects frame names and computes the stored completeness result from uniqueness, required definitions/custom textures, environment textures, and complete animation-frame mappings (lines 38–41). `loaded` returns that stored result at line 43. The nonzero retained asset count establishes that a manifest was stored, and the five rendered units imply that usable frame mappings/custom textures existed for some actors. Neither establishes the complete set.

The pinned `public/assets/manifest.json` has 100 assets and 138 atlas entries, 465,759 bytes, SHA-256 `bdb079abfd27fc3a77364c0f1032d1b5326374dbe436fc8fca26a758dcdf4143`. This matches the registered full-dist manifest fingerprint in the original stage-05 receipt. The replay has Fairies and Orcs, with no content bundle. Their standard 26 unit/building asset IDs require 46 distinct atlas pages in this manifest. The definitions are established by `content.ts:8–25,74–83`; required IDs also include custom built-in artwork via `content-registry.ts:114,163–164`, and the atlas-page union follows `ArtRuntime.ts:23,29–30`.

The retained count of 32 loaded atlas pages is smaller than those 46 required pages. If the runtime used the pinned manifest, at least 14 required pages were absent from the texture manager when the snapshot was captured. The runner authenticated executable response bytes, but did not retain runtime manifest/PNG/atlas response bytes or per-key loader diagnostics. The pinned-manifest comparison therefore supports incomplete runtime atlas availability under that explicit assumption; it does not identify the missing page keys or the cause. It also cannot rule out a failed custom texture, environment texture, duplicate frame, or animation mapping conjunct in `ArtRuntime.ready()`.

When artwork fails completeness, `GameScene.create` emits an ordinary HUD notice at line 150 and continues to `onReady` at line 220. The callback hides the loading indicator (`main.ts:218`, `Hud.ts:189`). A hidden loading indicator, camera, and rendered actors can therefore coexist with `art.loaded=false`. Completeness is computed once on the inspected create path; these source files show no readiness polling or automatic retry that would make a later wait repair a false result.

Replay seeking uses the existing scene (`main.ts:302–310`), but this failure occurs before seek. `GameScene.restart` at line 262 calls `art.reset`, whose implementation at `ArtRuntime.ts:50` destroys only sprites. It preserves manifest, frames, and completeness. There is no inspected path where that reset changes previously loaded artwork to false. A claim that the hold command or replay seek disabled artwork would exceed this evidence.

## Cause limits and candidate follow-up

The established failure is artwork readiness after fresh replay import. Partial atlas availability is supported by the count comparison with the pinned manifest. Failed image/atlas loading, incomplete loader processing, and resource pressure after repeated game replacement are possible causes. The 366.59 MiB reported decoded atlas count describes available texture dimensions; it does not measure total browser/GPU memory or prove exhaustion. No original artifact records loader errors, missing texture keys, failed PNG responses, browser console warnings, or memory/context-loss events, so this report does not select one cause.

Empty `errors` and `assetFailures` are narrow evidence. The runner registers JavaScript `pageerror` at `verify-native-acceptance.mjs:53`; its response/request-failure monitor at lines 55–71 records script/stylesheet executable assets. It does not record all image, atlas JSON, manifest, or data-URL SVG failures. These empty arrays cannot prove complete artwork loading.

A future reviewed diagnostic candidate could retain every readiness term, the manifest identity, required/loaded atlas keys, missing environment/custom texture keys, failed loader events, and failed completeness subconditions for each fresh game. That would distinguish a failed load from a bad readiness computation without weakening the artwork requirement. No candidate patch is applied or supplied here. Root retains control of any changes and runtime release.

## Immutable source identities

All paths below were read with `git show f18a50d904c57ae1652f157b946ebd39d8d8923c:<path>`. The first nine source fingerprints match the original freeze inventory. The public manifest fingerprint matches the original full-dist/public receipt.

| Pinned path | Relevant lines | SHA-256 |
| --- | --- | --- |
| `scripts/acceptance/native-context.mjs` | 13–18, 89–102 | `f205338dd00ec7d8f75dcc0dc3c0415a31bac6b47b3e1dfbe45f5b9e517447dd` |
| `scripts/acceptance/verify-native-acceptance.mjs` | 53–71, 100–104 | `39a3f38d2bfca72870002ff94b2aede9f6b6c44babfc93f2ff60b89b830428c6` |
| `scripts/acceptance/direction-defense.mjs` | 137–159 | `53469400135b8dbc7cc1e0a8644e23e05aeee431aac6b9aeccc5d4cc8473c259` |
| `scripts/acceptance/native-contract.mjs` | 53–61 | `20c07d13d2d2cabf633d225335b707446aa8d6a73d19cf8840bdea0e583f2da1` |
| `src/game/GameScene.ts` | 64, 146–150, 220, 262 | `2f6372937635cdb54367445eb22355d79f33a94ff75604180ff9b2848422cdec` |
| `src/game/ArtRuntime.ts` | 16, 21–50, 77–94 | `ac0df5d1203a4dc44b905b5791a8c447f19e7aabb1b388b50e6abc950c1ff239` |
| `src/main.ts` | 177–186, 201–225, 268–272, 302–310, 453 | `4b3de6a2c62517819e56d81e20f96aa10c8bfde8cd58ea70aa516fd84f0abda7` |
| `src/ui/SessionTools.ts` | 111–137 | `e1e36fec742ba8fb0533abdb6a908ab2a8c9574649e435068efbf5d53575db1a` |
| `src/ui/Hud.ts` | 188–189 | `827031c3c49dab942e00a11cd6531d633f351c9c2884ab1c704e187f81368828` |
| `src/core/content.ts` | 8–25, 74–83 | `4495966583a38f122f23f40c8cfbc0c7655b00cc463b37efdf26a0c9b0a86160` |
| `src/core/content-registry.ts` | 114, 163–164 | `4f3b9211160320723f18264d7c6ca4719ce3988c68a4c50facb5d3c610d368d6` |
| `public/assets/manifest.json` | asset/atlas data | `bdb079abfd27fc3a77364c0f1032d1b5326374dbe436fc8fca26a758dcdf4143` |
