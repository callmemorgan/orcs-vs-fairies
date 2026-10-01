# Scenario historical content test review

Verdict: admit test-only commit `25992978b77424154b60aaf4f5c5d919eb900fc9`. It adds honest coverage around unchanged genuine historical Lantern content inside explicitly synthetic SAVE3 scenario wrappers. I found no defect in this commit.

I performed this review with GPT-5.6 Sol. I pinned the parent at `91c371e118c83c574709273042fd08b524bf3337` and the tip at `25992978b77424154b60aaf4f5c5d919eb900fc9`.

## Findings (risk)

No findings. The comment and commit message state that only the content came from a genuine historical capture and that the SAVE3 checkpoint, bound session, and journal wrappers are synthetic. The tests do not present generated wrappers as historical gameplay evidence.

## Per-commit review

`2599297` adds one test file and changes no production source. It loads the retained historical Lantern content from `docs/evidence/content-root-integration-20261001/browser-save.json`, whose save version is 3 and content hash is `2fe954644f4b3a4d5b20e3d39b83744b9d39761869b325933446145304ba966a`.

The first case creates synthetic checkpoint and bound-session wrappers, requires definition and game content to migrate together, preserves the raw decoded file, verifies the Lantern duelist's damage, and rejects commands, stepping, and recording under historical rules without mutation. The second preserves the synthetic historical journal checksum but requires replay verification to remain inspection-only. Two parameterized cases reject a damaged original definition or game content hash before migration and preserve the rejected input. The current-rules case records one accepted move and requires native replay to reproduce the captured scenario.

## Independent verification

In detached checkout `/tmp/ovf-scenario-historical-content-review.REv430`, the new file passed all five checks in 568 ms. `git diff --check` passes. The committed test SHA-256 is `9086eb2798ca2cc376a2dd83b87144bdccec71a73536bc8be9325ab775a7de7f`.

## Behavioral interrogation

Ordering: none. This commit changes tests only and adds no concurrent or reordered production action.

Failure paths: the tests cover historical command refusal, step and recorder errors, replay-verification refusal, and damaged-content decode rejection. They also require rejected input bytes and restored scenario snapshots to remain unchanged.

Observability: none. No production log, event, or user-visible message changes.

Stale writes: none. The test builds in-memory wrappers and does not write application state.

Test delta: all five added cases passed independently. A regression in content migration, raw file preservation, rule compatibility, original-hash validation, accepted command recording, or replay equality fails this file.
