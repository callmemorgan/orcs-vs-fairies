# Failed native combat archive admission review

No discrepancy found in commit `57c11c5bcf3f8bdefbecc9222da8c26f5c506372` against parent `a144ad3f3dddd0003f9553541908e2254f2444c6`. I admit this archive only as evidence of the first failed browser run. It does not admit a complete combat group, a native-history result, a final asset gate, or a feature promotion.

This was a static read and hash review by GPT-5.6 Sol in Codex. I did not run product code, a compiler, build, test, simulation, browser, server, dependency command, checkout operation, archive extraction, or retry.

## Commit scope and retained bytes

The commit changes 273 paths. It adds 272 files under `docs/evidence/native-combat-charge-failure-453c221-20261001/` and appends one row to `docs/features/decisions.tsv`. It changes no `src/`, `scripts/`, `tests/`, or `public/` path. The fixture file is the same Git blob, `3c25e9c72d0e7b4ab8f330f6be20cb04dfb450a3`, at the parent and reviewed commit.

`retention.json`, SHA-256 `a3f34b041cf6f213ccbb3435d44b5e8e74e9a9401455206705ce11759750e33d`, inventories 270 files totaling 82,599,774 bytes. The split is exact: 251 original non-tar files totaling 76,425,524 bytes and 19 postflight or derived QA files totaling 6,174,250 bytes. I read all 270 blobs from the reviewed Git commit and all 270 named source files. Every mode is `100644`; every size and SHA-256 value matches. The evidence directory also contains the 104,298-byte manifest itself and a 1,551-byte README, giving 272 committed evidence files totaling 82,705,623 bytes.

The retained bounded index and TSV each match the same 251 original path, size, and hash records. The sealed first-failure manifest contains those 251 records plus the external historical tar. Its SHA-256 is `59c62dbefae028c59c6aa126fa497d72102cd621273ca0ddcf18f9283427f67b`, matching the retention record.

## External tar and earlier failures

The external tar remains outside Git at `/tmp/ovf-native-combat-453c221-retry-20261001-85q9lr0g/preserved-87273ff-source-and-combat-evidence.tar`. I read that file at the recorded path: it is 127,692,800 bytes with SHA-256 `723929d66c764bd717118c4f9817b7a52f62c15ac3441e22b1e77c9244966e05`. The retained path map names the source, public, acceptance, configuration, and three prior evidence trees. The anchor ref `refs/heads/codex/native-combat-preparation-87273ff` still resolves to `87273ff035a7fe7342f37785d5e5274ebd9dde4f`. I did not list or extract the tar.

The two earlier failed packets remain unchanged at their external roots. I rehashed all 90 files in `/tmp/ovf-native-combat-c86e273-20261001` against manifest `c7e53b7388b3a5cf59bec2db1845665751c61b8d06ba33fde83a8fcf9ebab816` and all 182 files in `/tmp/ovf-native-combat-287583c-retry-20261001` against manifest `a4e9eab3df8b3deb5320175e1b6bf0ff5e4701dd57ca7259356327993daacfc4`. Both comparisons passed.

## Actual run and failure semantics

Receipts 00 through 05 all record exit code 0 at product pin `453c2218af9973b9eca8fb78392435bd9d46a740`. The first asset receipt authenticates 398 dist files, 394 copied public assets, and four frozen executable assets. This is the pre-browser stage-05 check. Reading that receipt and its three captured JSON objects after the failure does not execute or replace stage 08.

The actual browser invocation is retained in `raw/logs/06-browser.receipt.json`, SHA-256 `474fa3adf6c1255e6e5ae58dfd57f4fa67eaa48b1d5675e5ea67de56c7f3b5f1`. It records the exact argv, checkout, runtime, start and end times, and exit code 1 after 243.8 seconds. Its stdout is SHA-256 `06bb6a3277636e1dc6c2374a06b0c71be4f12123aeec463b8e4eb60b4d4f937b`; its stderr is SHA-256 `0be74e1be7df38c4a43b58b715a19b42691569cfcf48a793ccc3aac21ea70294`. The stderr is the actual run transcript for the failure and records `Native attack target #52 must be visible before pointer input`.

The browser receipt is incomplete, contains 75 passed checks and 129 native downloads, and has no completed groups, asset failures, or unrelated browser errors. Its last state is tick 4 at time 0.2. Cavalry 51 is holding at `(18.5, 24.5)` and melee 52 is holding at `(26, 24.5)`; target tile 890 is absent from both visible and explored sets. This agrees with the retained failure message and the independently reviewed fixture geometry. The run stopped before pointer input.

Stage 07 native history and stage 08 final dist/public verification are explicitly false in the archive metadata and have no receipts. Completed groups and feature promotions are both zero. The later static diagnosis, visual review, cleanup readback, and retained file inspection do not change those facts. Eleven local screenshots have the pause overlay, and 23 replay screenshots frame actors near or behind the lower HUD, so the archive correctly limits visual claims.

## Trails, status, and cleanup

The three-row original `raw/decisions.tsv` is a byte prefix of the seven-row `postflight/decisions-after-first-failure.tsv`. The four appended rows cover cleanup, first failure, static diagnosis, and visual review. The root `docs/features/decisions.tsv` at `57c11c5` is the parent file plus one 430-byte row. Both trails are append-only in the reviewed snapshots.

`docs/features/requirements.json` has the same Git blob, `a4baf0938a9dd3acb8d8a0ae3c280a0f60cf7406`, at the parent and reviewed commit. It remains 64 verified and 36 in progress. No feature status changed.

The retained cleanup receipt records that the owned preview ended, port 5397 became empty, the selected browser processes were absent, protected PID 1063 and port 4173 were unchanged, and all 397 protected root dist files remained unchanged. The later external handoff records the owned checkout still at `453c221` with only untracked `node_modules`; no candidate was applied or executed there.

## Records outside the commit

Two final follow-up records exist outside Git. `/tmp/ovf-native-combat-453c221-retry-20261001-85q9lr0g/handoff-453-native-failure.json` is SHA-256 `0c1d275af3bd6578a858e2eeb07e0d513292745b606a18e3d28a9bce10fdaa54`. `/tmp/ovf-native-combat-453c221-first-failure-retention-20261001.json` is the read-only verifier result, SHA-256 `493d491233a01f3edc33889e46d1e9d221298db108674aea8d013593f01a4450`. They corroborate the retained archive but are not part of `57c11c5`; any durability claim for those two records requires a later retention commit.

The accepted fixture candidate and its later integration at `f18a50d` are outside this review. This archive records no retry after the first failure.

One first-pass audit result is preserved at `/tmp/ovf-root-57c11c5-byte-readback-gpt56-sol.json`, SHA-256 `0dd6acf1f461c91b9e03b50e698708735e6021110eefd5e71bd50ebc14caa573`. Its broad tar-object equality field is false only because `retention.json` adds a `path` key; the common `bytes` and `sha256` fields match, and the tar itself passed the independent hash readback.
