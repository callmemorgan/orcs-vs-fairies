# Static review of `473ab17` and `33d08ab`

No defect or retention discrepancy found. Commit `473ab17642211c3610aed648ae5f813b7680edc1` imports the two reviewed hosted verifier blobs over parent `83941bc80ce9ec08840b0645d9b33e8018d5309a`. Child `33d08ab0b2ae630a92cac1fa95576ea719733a1e` retains the preparation packet and the prior survival admission review without changing requirement status.

## `473ab17` import

The commit changes only `scripts/server/verify-hosted-teams-browser.mjs` and `scripts/server/verify-hosted-teams.mjs`, with numstat 16/2 and 4/4. Their Git blob IDs are `32e5ae7b40631f202d1611dce13f5f38b061456b` and `ea318e48d8b811560c52296318981c5a868f5f15`. The same blob IDs appear at prepared recipe `7fe049f3ad3c3dd8ab6ae32962e73d000219aab5` and original reviewed commit `a0aaa643de509d210b7879e796279a618c2cf290`. Their content hashes and sizes match the retained manifest: `d844ab8547cbfc186ab98f62f727f7df46317c8e86a603e70fe11966fe59a30a` at 48,236 bytes and `5343f858a62d76811536716e69d84c17f49a6bc8a8f34adccbecfe90e4036d4c` at 11,410 bytes.

The browser verifier keeps the spectator helper's 20-tick default and replaces the literal assertion with its parameter at hunks `@@ -293 +293 @@` and `@@ -301 +301 @@`. After all existing restart receipt, bank, and wire checks, it reuses the restarted host as a zero-delay side-1 spectator. It compares the spectator and live player public views at the initial tick and at a later common tick, then records a new check at hunks `@@ -482,0 +483,13 @@` and `@@ -484,0 +498 @@`.

The launcher keeps the first generation's one-second delay, makes delay an argument, and passes zero only to the restart at hunks `@@ -62 +62 @@`, `@@ -66 +66 @@`, and `@@ -116 +116 @@`. The result method adds the zero-delay observation at `@@ -126 +126 @@`. Every prior `checks.push` record remains. The two changed lines that also contain old assertions retain those assertions: the delay assertion now checks the parameter, and the restart protocol-version assertion is unchanged after `launch(port)` becomes `launch(port, 0)`.

All 568 product paths in the existing product manifest have the same Git modes, types, and blob IDs at product pin `453c2218af9973b9eca8fb78392435bd9d46a740`, parent `83941bc`, import `473ab17`, and retention tip `33d08ab`. The imported commit changes proof scripts only.

The retained independent review names `a0aaa64`, records the same two content hashes, reports no findings, and records that `node --check` passed for both immutable verifier blobs. That review also records that builds, tests, servers, browsers, simulations, and native execution did not run. This review authenticated that receipt but did not rerun syntax checks.

## `33d08ab` retention

The child commit changes 17 paths. The hosted retention manifest covers 11 Git blobs totaling 432,044 bytes. Every committed blob matches its manifest byte count and SHA-256 value, and the 11 entries are all hosted packet files other than the packet README and retention manifest.

The survival review retention manifest covers two Git blobs totaling 38,655 bytes. They match the original report and audit hashes: `f49055f75fdc09eaad6bcc7ec569a1e3321e59291a47ad52636c8b05f691eea4` and `5464f730539763e18dfa245692d6732300aee2ca980ce741cf0af93d87a0f2fd`. The remaining changed path is `docs/features/decisions.tsv`, which appends two rows at hunk `@@ -232,0 +233,2 @@`: `survival-root-static-admission` and `hosted-zero-delay-proof-import`.

`docs/features/requirements.json` is byte-identical between `473ab17` and `33d08ab`. Status totals remain 64 verified and 36 in progress. The hosted retention manifest states `runtimeExecuted: false`, and its status leaves runtime pending.

## Findings and limits

There are no findings. The original delayed generation still precedes the zero-delay restart. New failures reach the existing `verifyRestart` catch and finally cleanup. The new result object records initial and advancing public-view comparisons, while prior evidence records remain. The host changes role only after the existing player receipt and bank checks.

This was a Git-object and retained-record review. It ran no syntax command, build, test, simulation, browser, server, dependency, or checkout operation. Both commit diffs pass `git diff --check`.

The first audit artifact is preserved at `/tmp/ovf-root-473ab17-33d08ab-static-review-audit-first-gpt56-sol.json`. It reported a false failure because its expectation omitted the assert-bearing restart line whose launch call gained the zero-delay argument. The corrected audit records that the protocol-version assertion remains unchanged.

The machine-readable audit is `/tmp/ovf-root-473ab17-33d08ab-static-review-audit-gpt56-sol.json`.
