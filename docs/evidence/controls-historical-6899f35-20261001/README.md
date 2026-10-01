# Historical controls evidence at 6899f35

This directory preserves the controls, Display settings, and Saves evidence captured on 2026-10-01 at source `6899f35ae1e8d8b08781005bf766b9bcce2755b6`. The captures use SAVE3 and simulation revision `3.2.0`. They describe that source only; they do not certify the later SAVE4 source or change any feature status.

The original `control-evidence/` subtree contains 69 files, totaling 10,108,533 bytes. Every imported file matches its original archive byte-for-byte. Original JSON, logs, scripts, screenshots, absolute archive paths, recommendations, and the discarded verifier attempt remain unchanged. New import records live alongside that subtree.

The source build ID is `af7934a8bdcdb7e7e885f460a1215c8e7cc25f3bbaf8dcaf347c9332a946e9d7`. The archived [audit](control-evidence/audit.json) connects the feature results to the individual captures. The [independent hash audit](independent-hash-audit.json), [import manifest](import-manifest.json), and [hash table](import-hashes.tsv) record the checks performed during this import.

## Manifest counts

The original source manifest contains 118 paths: 115 files under `src/`, `package.json`, `vite.config.ts`, and `docs/features/requirements.json`. The 115 source files include three SVG assets.

The Saves manifest has 142 digest entries: 112 TypeScript/CSS source paths, three compiled files, 26 artifact files, and one ledger hash. The 112 source paths are a subset of the source manifest. The number 142 is a count of digest entries, not a count of artifacts. Display has a separate 14-file evidence manifest. These manifests overlap, so their counts must not be added as a distinct file total.

The 69-file import inventory covers every preserved file, including files outside those two artifact manifests. The Display source-integrity report separately records 115 source files, five build inputs, and 392 distribution files. The independent audit explains which files can be checked against archived bytes and which checks use the historical Git objects.

All listed digests match the original archive bytes. Source, configuration, ledger, and the five recorded test files also match the historical Git blobs. The recomputed source build ID matches Git and the archived compiled JavaScript. The recorded HTML/CSS/JavaScript response digests match their archived local bytes. The audit did not perform a new HTTP request or rebuild the app. The independent auditor needs the full original archive; only its evidence subtree is imported here.

## What the captures show

Feature 87 uses the ordinary production Display dialog to exercise alternative palettes, shape and outline settings, persistence after reopening and reload, and reset. Five mounted tests also instrument gameplay rendering with eight player seats. The production match has two factions. This evidence does not include a perceptual color-vision study or a contrast measurement.

Feature 89 exercises a fresh match in the ordinary primary production app. The driver substitutes only `navigator.getGamepads` with a virtual standard-mapped controller. The captures cover camera movement, shoulder selection edges, hold, stop, right-stick cursor movement, X movement orders, queued movement, trigger zoom, pause/resume, modal blocking, and reconnect safety. Physical controllers and other mappings were not exercised.

The Gamepad export contains six accepted commands: hold, stop, move, queued move, hold, and stop. The historical native checker reports complete replay equality at tick 100, checksum `a617077e`, SAVE3, and revision `3.2.0`. The `verifier-export-label-error.*` files preserve a discarded export-label typo in the verifier; the final proof and native verification passed.

Feature 90 has 13 checks driven by DOM, mouse, keyboard, and normal wall-clock simulation. A named save at tick 10 survives natural advancement to tick 21 and restores the complete game envelope. A rejected session version preserves the active game, and a fresh browser imports the native save without creating a fabricated local slot. Natural 30-second autosaves occur at ticks 610, 1211, and 1812. Reload captures a pagehide checkpoint at tick 1828, and loading it restores the complete envelope. With autosaves disabled, simulation advances for 31.45 seconds to tick 2457 without a new checkpoint. The disabled preference and 30-second interval persist and prevent a pagehide save.

The Saves browser proof reports no page or console errors and a closed browser. Its scope is local skirmish storage on one browser origin, with manual recovery through Saves. It does not exercise historical or online saves, campaign saves, quota exhaustion, all 12 manual slots, or a separate visibility-hidden event. Reload exercises pagehide.

## Older and later evidence

The 147-test baseline log comes from `45e4c63efd366bbe53d217e8875dc858b18fcb62`. That source had a startup build failure elsewhere in the app. The archived source comparison shows that the listed Display/minimap source and test files match the later `6899f35` source; the production build and browser startup were checked at `6899f35`. The baseline log does not certify a working production app at `45e4c63`.

The historical feature 81 report reproduces an off-layer alert navigation defect and recommends keeping the feature in progress. Commit `4440bc8a623cc103583b2d92f78b4aafd26e3ca3` subsequently fixed the defect. Its separate historical evidence is in `../minimap-levels-20261001/`. The old recommendation here remains part of the archive; it is not a current status assessment.

Seven PNGs were opened directly during this import. The [visual inspection record](import-visual-inspection.json) records the observed Display controls, production ownership rings and selection, autosave rows, recovery screen, and disabled preference. Full save and replay equality comes from the JSON checks rather than screenshots.

## Verify and rerun

Verify the preserved captures from the repository root:

```sh
python3 docs/evidence/controls-historical-6899f35-20261001/verify-import.py
```

When the original temporary archive remains available, also compare every file with it:

```sh
python3 docs/evidence/controls-historical-6899f35-20261001/verify-import.py \
  --original /tmp/ovf-controls-6899f35.oZddGk/control-evidence
```

The [SAVE4 rerun instructions](SAVE4-rerun.md) describe the required verifier changes and fresh-checkout commands for 81, 87, 89, and 90. The final integrated SAVE4 pin was pending when this import was prepared. This import does not rerun the browser or simulation and makes no new hardware claim.
