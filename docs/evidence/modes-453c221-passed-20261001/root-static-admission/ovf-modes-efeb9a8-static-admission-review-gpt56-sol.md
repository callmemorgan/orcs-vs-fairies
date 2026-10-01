# Static admission review of `efeb9a8`

No admission discrepancy found. Commit `efeb9a8e1363e3360774699ba3facc82ccf3f836` is a documentary import over parent `1f39b577144331ca42915fb1f828c0becef917ef`. Its tree is `a3e6a0d817f2c07ddf1f5514ef9eb1441d39a70a`, its footer names Codex and GPT-6, and it changes no product path or proof script.

## Commit breakdown

The commit adds 210 paths under `docs/`: 153 raw packet files, 17 index files, 30 review files, six retention-decision files, the packet README and retention manifest, plus `docs/features/requirements.json` and `docs/features/decisions.tsv`. The packet additions are visible in the commit as new files, including `retention.json` at `@@ -0,0 +1,894 @@`, the current runtime result at `@@ -0,0 +1,641 @@`, and the browser result at `@@ -0,0 +1,3427 @@`.

The requirements hunk changes only original requirement 69. Its status moves from `in-progress` to `verified`, and four packet evidence paths are appended at `docs/features/requirements.json`, hunks `@@ -794 +794 @@` and `@@ -800 +800,5 @@`. The totals move from 63 verified and 37 in progress to 64 verified and 36 in progress. The ledger is an append-only edit with one `survival-current-original69-admission` row at `docs/features/decisions.tsv`, hunk `@@ -231,0 +232 @@`.

The preceding commit `1f39b577144331ca42915fb1f828c0becef917ef`, reviewed against `827496b06bb660b6639257e5113ac2f199be29ba`, changes 32 paths. They are faction packet documents, combat preparation documents and reviews, and two appended ledger rows. It changes no requirement, product path, or `scripts/` path.

## Retention integrity

All 153 committed raw blobs match the byte counts and SHA-256 values in `retention.json`. They also match the files in `/tmp/ovf-modes-complete-packet-453c221.dgl9yk4w` byte for byte. Their computed total is 26,216,711 bytes. All 53 auxiliary files match both their manifest hashes and their recorded external source files.

The omission index contains 989 unique packet paths: 596 source-input copies and 393 public-dist copies. None is committed under the retained raw directory. Every record resolves to the stated mode, type, blob ID, byte count, and SHA-256 value in immutable product commit `453c2218af9973b9eca8fb78392435bd9d46a740`. The index is added at `docs/evidence/modes-453c221-passed-20261001/index/git-preserved-omissions.json`, hunk `@@ -0,0 +1,10292 @@`.

The embedded faction import manifest lists 568 product paths. Every one still has the recorded mode, blob ID, byte count, and SHA-256 value at both product pin `453c2218af9973b9eca8fb78392435bd9d46a740` and review tip `efeb9a8e1363e3360774699ba3facc82ccf3f836`.

## Recorded acceptance evidence

The retained survival result records a natural team-0 win at tick 8190 after five waves with one, two, three, four, and five attackers. Recovery checkpoints occur at ticks 6554, 6951, 7348, and 7793. The result compares 7,890 continuation ticks, records no first difference, and marks complete envelope roundtrip, replay envelope, continued recorder history, and replay seek envelope checks as passed. This is existing evidence in `raw/proof/runtime/runtime-results.json`, added at `@@ -0,0 +1,641 @@`; this review did not rerun it.

The retained browser result has 13 checks, a passed result, a closed browser, and empty page-error, console-error, failed-request, HTTP-error, and general error arrays. It names product pin `453c2218af9973b9eca8fb78392435bd9d46a740`.

Both retained native verification files report SAVE4, replay version 1, simulation revision `4.0.1`, final tick 40, two accepted session commands, and successful complete-envelope and replay-envelope checks. Each continuation starts at tick 40, ends at tick 140 after 100 advanced ticks, contains six commands, and passes envelope equality, recorder equality, accepted-command recording, and extended replay equality. The files are added at `raw/proof/native/local-build-report.session.verification.json`, hunk `@@ -0,0 +1,1394 @@`, and `raw/proof/native/local-custom-hill.session.verification.json`, the same hunk range.

The original launcher receipt records four passed steps and the runtime receipt records complete-envelope continuation as passed. The separate temporary-bind observation remains a failed `errno 98` result with no cause assigned and no retry recorded.

## Findings and risk review

There are no findings. The commit changes evidence and requirement metadata, so it creates no new runtime ordering, promise failure path, log ordering, or stale-write behavior. The requirement edit changes the documented status of requirement 69 and adds one ledger record. The static audit checks that promotion, the four evidence pointers, the status totals, and the append-only ledger change.

This review authenticated Git objects, committed bytes, external source copies, and recorded JSON fields. It did not run builds, tests, simulations, browsers, servers, dependency operations, or checkout changes. `git diff --check` reports no whitespace diagnostics for the reviewed commit.

The machine-readable audit is `/tmp/ovf-modes-efeb9a8-static-admission-review-audit-gpt56-sol.json`.
