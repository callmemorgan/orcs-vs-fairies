# Static retention import admission

Reviewer: `gpt-5.6-sol`

## Decision

Admit the bounded retention import described by `full-native-retention-plan.json`. No flags.

Root may copy the 323 listed files under:

`docs/evidence/native-combat-f18a50d-first-failure-20261001/`

using each plan row's `targetRelativePath` exactly:

- `raw/`: 303 original files, 94,034,440 bytes, in the 13 listed batches. Each batch is at most 8,388,608 bytes; the largest is 8,348,314 bytes.
- `seal/first-failure-artifact-manifest.json`: the unchanged original seal, 49,635 bytes, SHA-256 `922c604e7d17c015d878cfd4f1ce0f133df2c208ef5f7ad9ca8b0a9c2b8d9fba`.
- `derived/`: 19 cleanup, release, visual-QA, and independent-diagnosis files, 5,523,479 bytes.

The source path for every copy is the plan's `sourceRunPath`, `/tmp/ovf-native-combat-f18a50d-retry-20261001-zssa25k5`, joined to the row's `sourceRelativePath`.

## Static findings

The plan itself is 97,054 bytes with SHA-256 `b99cddba8cc57724f1508af4559219c9b2b560225f6e4e55748c5907f11cc7e3`. It contains 303 unique source paths and 303 unique lossless `raw/` targets. All source and target paths are normalized relative paths; the combined raw and additional target set has no collision. Every listed source currently exists as a regular file, no listed source is a symlink, and every file size matches the plan. The 20 additional files were hashed during this review and all match their plan digests. The 94,034,440-byte raw payload was not rehashed.

The unchanged seal contains the same 303 logical paths, sizes, and SHA-256 values as the raw plan. The browser receipt's 148 registered download names, sizes, and hashes all match corresponding raw plan rows. The raw set also contains all 39 screenshots. This preserves the original file identities without omission, substitution, or collision.

The retained status remains a failed stage-06 attempt: 84 recorded checks, zero completed groups, all 39 encounters open, browser completion false, native history false, and the final asset gate false. Cleanup and release records state that stages 07 and 08 did not run and the heavy slot was released. These files do not establish a completed combat group or authorize a feature-status change.

The provenance pins remain distinct: fixed product `453c2218af9973b9eca8fb78392435bd9d46a740`, runtime proof `f18a50d904c57ae1652f157b946ebd39d8d8923c`, and checker/docs `37bf0e794e7f62cf33347d2e92c739d593bf1cc4`. The protected-root baseline is anchored by `raw/protected-root-before.json` at root HEAD `829e2d9f18a08ed5874694a24620221a4d2eda88`, protected PID 1063 with start time 874, port 4173, and 397 distribution files; the cleanup receipt records that PID, port, and all 397 fingerprints unchanged.

This admission is limited to retention. It introduces no feature gate and makes no ID-specific combined admission. After copying, root should perform the plan's post-import verification against the copied seal and preserve the resulting verification separately.
