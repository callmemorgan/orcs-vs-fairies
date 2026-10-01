# Root admission and archive review through c86e273

GPT-5.6 Sol accepts the imported code and retained evidence in `4a71cd07bacc12d214acaf5a0f95a7d9b486f52c..c86e273c70738f144a00fe75f5ecf39e7fa324d8`. One evidence-maintenance finding remains: append a durable correction row to `docs/features/decisions.tsv` before final handoff.

## Finding

`c86e273` adds the corrected v2 probe, output, receipt, audit source, and revised review under `docs/evidence/root-assembly-20261001`, but its new decision row at `docs/features/decisions.tsv:204` cites only `/tmp` paths. The row is true in this workspace, yet a future checkout cannot follow those evidence pointers. The prior root admission row at line 201 still cites the superseded non-v2 report. Preserve both existing rows and append one root evidence-retention row that cites `c86e273` and the committed v2 report, probe, output, and receipt paths. This is an audit durability defect; it does not change the native source admission.

## Imported commits

`13e05dabaad5b1681f63fc7af01bc3d795056182` is an exact import of `1b4f72c61ec7cfc25c051227a29a6509b49acda4`. All 25 changed paths have the same parent and result blob IDs, modes, and status. The complete binary patch SHA-256 is `987f15165975d07bbf17713ae92e78cd8cd8711b1913937dce763844a0cc704f` on both commits.

`95c98a8dd3b906e9c2be4a95f728a38871127e42` is an exact import of `c0a3b12f72d22a9da03e737245e36f2e8c416dde`. All seven changed paths have equal parent and result blobs. The binary patch SHA-256 is `26bdd0a65ca2f9887dc3102dcd9b2732003bc9d080e59794af35f2810d6a928a` on both commits.

`c7616eea316e0c99683dc79bea40acae6303a649` is an exact import of `4a13ca78b48fe476ce8fa5132dcc96efa006b975`. All ten changed paths have equal parent and result blobs. The binary patch SHA-256 is `639698053f8041e17c7483f5466bf49cd4d181b39d764f2f72cc25b16682a2fc` on both commits.

`2524b1b` adds the combined build, first failed suite, isolated replay, prior review, survival, and world-retention archives. It also appends fifteen decision rows. It changes no production or test source.

`c86e273` adds the corrected reader-probe files and revised review, then appends the sixteenth decision row. It changes no production, test, or proof-runner source. Its only finding is the temporary evidence pointer described above.

The machine-readable comparison is `/tmp/ovf-root-import-equivalence-c86e273.json`. The pinned zero-context and contextual review diffs are `/tmp/ovf-root-assembly-c86e273-review.diff` and `/tmp/ovf-root-assembly-c86e273-review-context.diff`.

## Retained runtime evidence

The four-build archive matches the original successful runner directory byte for byte for its four logs, report, and two source inventories. Its renamed first preparation failure also matches the original receipt. The archive-only README explains the two runs. All four commands exit zero. Every recorded artifact hash matches, the before and after inventories are identical, and all 917 recorded entries match Git at `0d4145cfa768fb47fe21d4d257c8e1ea5d07549a` by path, mode, blob ID, byte count, and SHA-256.

The first complete-suite failure archive and unchanged isolated team-replay archive match their original runner directories byte for byte. Their before and after inventories are identical and the same 917 entries match the pinned Git commit. The full run records 2,919 of 2,920 tests passing across 157 files, with only the eight-player replay exceeding the five-second default at 5,130.805032 ms. All 36 natural skirmishes pass. The isolated unchanged file records nine of nine tests passing, including the eight-player case at 2,001.160522 ms.

The corrected probe archive matches the reviewed `/tmp` files byte for byte. The v2 probe SHA-256 is `c2108c3a47abb494466c988bcc4e6d4c5bd50a7d6b2251bf29f00b4b4094a6db`; its output is `34d64011986fef235b29f3b48519d6edf5451540a610498b8bcc52752c0d5858`; and its receipt is `9452d3da81feadc088decd98f64b9c2af4ae88442e006b09a6d678d17f0d2c43`. The receipt's source hash matches the `4a13ca7` Git blob for `native-downloads.ts`, and the archived probe, output, and binding-audit hashes match the receipt.

The complete archive audit is `/tmp/ovf-root-archives-c86e273-audit.json`.

## Decision trail

The existing 76,626-byte decision prefix is preserved byte for byte at SHA-256 `790f1c29d64bb6d2880f8c39df04a53ee4c3b2191ec8efe22b67e7f9e2c5cae0`. Sixteen rows follow it through `c86e273`. The first five reviewer rows equal the saved reviewer subset at SHA-256 `4887cec250eafa0ec801d9b3eaeec71e1d5e80d016a21a4d4d19a5977d6667ed`; the native and timeout reviewer rows also equal their canonical one-row subsets. Every evidence pointer resolves in the current workspace. Root-owned admission rows provide committed evidence for the earlier reviewer rows except for the final corrected-probe row described in the finding.

The structural trail audit is `/tmp/ovf-root-trail-c86e273-audit.json`.

## Behavioral review

Ordering: the imported patches are byte-identical to the already reviewed source commits. Root assembly adds no new interleaving. The retained commands ran serially in separate evidence directories.

Failure paths: the import changes no failure behavior beyond the admitted source chain. The archive keeps the first dependency preparation failure and the first full-suite timeout rather than relabeling either as success. The corrected probe asserts rejection outside its catch block.

Observability: the imported source adds the same receipts and named browser checks reviewed at `4a13ca7`. Root assembly preserves those bytes. The evidence archives retain command logs, JSON reports, source identities, hashes, and exit codes.

Stale writes: no archive step writes product state. The imported native helpers require new output directories and recheck frozen inputs. Exact patch equivalence shows root assembly did not alter those guards.

Test delta: this range imports proof-source syntax and type checks plus historical runtime evidence. It does not claim a fresh native combat run. The bounded replay change now has a fresh complete-suite pass at `4a71cd0`, reviewed separately in `/tmp/ovf-team-replay-complete-suite-4a71cd0-review-gpt56-sol.md`.
