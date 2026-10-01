# Root retention review at 01b5ae6

GPT-5.6 Sol accepts `01b5ae61a365a45447df7aa548f7bfde9ed6cc22`. The durable native-reader-probe row resolves the only finding from the prior root-assembly review. The commit changes no product, test, or proof-runner source.

## Decision trail

The commit preserves the complete `c86e273` decision file as an exact prefix and appends three rows. Every commit and repository path cited by those rows resolves at `01b5ae6`.

The `native-reader-probe-retention` row cites `c86e273` and the committed v2 probe, output, receipt, and revised review. Those are the durable pointers requested in the prior finding. The old probe, original review, and temporary-path correction row remain intact, so the append-only history records both the flaw and its correction.

The complete-suite row cites the actual passing source pin, the committed report, and the independent audit. The runtime-freeze row cites the immutable `c86e273` gameplay pin and its dispatch bridge.

## Passing-suite archive

The five historical runner files in `combined-rules401-passing-suite-4a71cd0` match the original run directory byte for byte. The report's four artifact hashes recompute successfully. Its before and after source inventories are identical. The JSON reporter records 2,920 passed tests, zero failures, zero pending tests, and zero todo tests. The archive-only README gives the source-pin and dispatch context without changing the retained runner files.

The committed independent audit and complete-suite review match their accepted `/tmp` copies byte for byte. The three committed root audit JSON files also match their original `/tmp` copies. The previously archived root report remains the earlier valid version; the later per-commit expansion is intentionally reserved for a new filename at the next archive checkpoint.

## Runtime bridge

I independently reconstructed both bridge counts. All 917 inputs recorded by the passing suite at `4a71cd0` have the same path, mode, and blob ID at the `c86e273` runtime freeze. The 567 product inputs from the four-build source inventory also have the same Git entries at the freeze. The bridge's 19 proof-only files equal the Git path difference from `4a71cd0` to `c86e273` under `scripts/acceptance`, and the bridge points to their admitted source commit `4a13ca7`.

The bridge's passing-suite report hash matches the committed report. Its `cpuReleased: false` and `releasedRecipe: "economy-only"` fields record that the CPU is not generally released while economy alone receives the execution slot, consistent with its note and the appended decision row.

## Behavioral review

Ordering: none. The commit retains completed files and appends rows; it does not execute or reorder product work.

Failure paths: none. No executable source changes. The archive keeps both the first failed suite and the later passing suite under their actual pins.

Observability: the new archive preserves the default and JSON reporters, command exit code, source inventories, and artifact hashes. The decision rows add durable evidence pointers.

Stale writes: none. The commit adds immutable evidence files and appends to the trail. Existing artifacts and rows are unchanged.

Test delta: none in this commit. It retains the already accepted 157-file, 2,920-test complete-suite run at `4a71cd0`; no test was rerun for this review.

The independent retention audit is `/tmp/ovf-root-retention-01b5ae6-audit.json`. No finding remains.
