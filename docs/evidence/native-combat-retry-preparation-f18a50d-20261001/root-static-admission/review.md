# File-only admission of the docs37 combat-f18 packet and faction-827 retention

Reviewer: GPT-5.6 Sol in Codex

Result: pass. I found no defect that blocks root from admitting the combat retry preparation and, after its own serial-slot check, dispatching the fresh 39-encounter run.

## Scope

I reviewed the retained bytes at commit `37bf0e794e7f62cf33347d2e92c739d593bf1cc4`, the external combat import manifest and Git readback, the checker source, the bound stage 00-08 invocation, the faction-827 readiness packet, and the later faction r1 stop/cleanup receipts. I did not execute or import the product checker. I did not run a build, test, helper, fixture, freezer, browser, server, native-history stage, or gameplay stage. I made no repository or checkout change.

The moving root HEAD was `e665ab5bc9150a67147455a537ee470d8c0016f9` when the audit completed. Both reviewed packet directories were clean and had no byte difference from the docs commit. The later root HEAD is not the checker/docs identity and must not replace `37bf0e7` in the checker arguments.

## Findings

None.

## Retained bytes and identities

The two packet directories contain 27 retained non-index files: 25 files named by the two `root-retention.json` indexes plus two root readback notes. The combat index has ten records and the faction index has fifteen. I read and hashed every indexed file and matched its recorded byte count and SHA-256. I also compared all 29 files, including both retention indexes, to their bytes at `37bf0e7`; all matched.

The combat external manifest contributes nine sealed files totaling 222,448 bytes. The root retention index adds the unchanged external manifest as its tenth record. The independent Git readback matches all nine packet records to the sealed external source and matches the archived manifest itself. The checker SHA-256 is `0b0ffee14fec657bd15c91ee910ba791e1791d706ca5f98cf1bd2183d2074f9b` in the retained file, import records, docs readback, and bound recipe.

The identities remain separate:

- Checker/docs commit: `37bf0e794e7f62cf33347d2e92c739d593bf1cc4`
- Runtime proof pin: `f18a50d904c57ae1652f157b946ebd39d8d8923c`
- Fixed product pin: `453c2218af9973b9eca8fb78392435bd9d46a740`
- Faction execution pin: `827496b06bb660b6639257e5113ac2f199be29ba`

The docs readback records all 591 sealed source identities at docs37 as equal to f18: 568 fixed product inputs, 22 proof modules, and one supplemental config file. The product set is unchanged from 453. Relative to the original proof, seven reviewed proof paths differ. Relative to its parent, f18 changes only `scripts/acceptance/direction-defense-fixtures.ts`.

## Checker and combat recipe

The checker requires full 40-character docs and runtime pins and rejects equal docs/runtime identities. It resolves the docs pin as a commit, requires the pinned checker to be a regular non-executable blob, and compares the executed external checker byte-for-byte with that blob. It reads the baseline and current footprint seals through the same docs commit and verifies their fixed SHA-256 values. Its Git helpers use `--no-replace-objects`.

The checker then requires the owned checkout HEAD to equal f18, verifies the complete 591-path Git and live-file inventories, proves all 568 product blobs equal 453, and limits the f18 parent difference to the reviewed fixture. In dist mode it binds the frozen-input file, complete source/proof/config inventory, actual HTML/JS/CSS assets, and all 394 copied public assets. The final mode authenticates the first dist receipt against the digest retained before preview/browser, then requires all source, public, dist, and frozen-input fingerprints to remain equal. Output receipts must be fresh, regular, and outside both source roots.

The bound future recipe uses docs37 for checker authentication and f18 for runtime source in stages 00, 05, and 08. Its nine steps remain serial and stop on the first failure. It requires fresh full-22 helpers and the complete 62 generated scenarios. Browser selection remains `direction,capture,specialists`, which covers the original 39 mandatory encounters. The original frozen-input file is the final argument of stage 07 native history and is reused by the final asset gate. The run must use a fresh external directory and owned preview port 5397. The root dist, port 4173, and PID 1063 remain protected.

The earlier 57c11c5 run remains failed: zero complete groups, no native history, no final dist gate, and all 39 encounters open. This review did not repeat the already retained independent review of that failure. The three charge-fixture review artifacts, including the first-failure record, match their recorded hashes.

## Faction readiness and later stop

The faction readiness retention stays pinned to 827, integrated tree `0ba9d13ae4c7de9819cec4150e5085e0daf6752d`, with product bytes frozen at 453. Its static receipt covers 568 product inputs, 394 public assets, 22 proof modules, seven imported files, and three approved helpers. It records the later root-only f18 fixture difference instead of treating the moving root as the execution source. The first failed static observation remains preserved and points to the corrected receipt.

The retained faction execution plan has eight held phases. Each phase fixes the 827 source pin and owned checkout, uses a bounded systemd unit, writes to the fresh evidence parent, and records startup, runtime, and stop limits. Original feature IDs 21-30, screenshots, independent admission, and the frozen-input native-history stage remain mandatory.

The later faction r1 attempt stopped at focused tests because sparse preparation omitted two tracked historical docs inputs. Its receipt reports exit code one with no retry. Cleanup records that phases 02-08 never started, preview never started, original IDs 21-30 remain unexecuted, the 590 checked source/proof files stayed unchanged, protected root dist/PID stayed unchanged, no owned runtime remained, port 5298 was free, and the private dependency links/cache were removed. That infrastructure failure requires the fresh r2 repair already authorized by root; it is not faction acceptance evidence and does not alter this combat preparation.

## Admission boundary

This result admits only the retained preparation and the bound future invocation. It accepts no combat encounter and no faction feature. Root must still confirm the current serial slot is free, move only the owned combat checkout to f18, create a fresh run, copy the checker and launcher from docs37, verify their hashes, and preserve the first failure if any stage stops.

Two review-tool failures are preserved in `first-failures.json`. Neither started a checker or runtime command, and neither changes the admission result.
