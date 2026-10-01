# Review of 80628d73047041bfd796ab23a9073cb1c7110c1a

Verdict: admit the portable controls helper as `c3e563ed012be11ddb84dff0411538ae6ea7f84a` followed by this correction. The correction closes the only finding in `/tmp/ovf-controls-proof-portable-review-gpt56-sol.md`; I found no new issue.

I reviewed this with GPT-5.6 Sol. The correction parent is `c3e563ed012be11ddb84dff0411538ae6ea7f84a`. The pinned diffs are `/tmp/ovf-controls-correction-80628d7-u0.diff` and `/tmp/ovf-controls-correction-80628d7-context.diff`.

The three-file delta adds exactly the seven paths named by `canonical.vitest.config.ts` to `sourceProvenance`. It checks the config-derived list against the fixed pinned list, requires the Git tree to contain that exact list, compares every file with its pinned Git blob, and records the resulting `testFiles` map. Preparation carries that map through its module, build, and run manifests. Browser preparation checks both manifests, the combined runner checks the prepared map before any command, `finishProof` checks it again after browser closure, and the feature manifest retains it.

I repeated the original failing probe in an isolated detached checkout at `80628d7`. `sourceProvenance` first returned seven test records. After I dirtied `tests/appearance.test.ts`, it rejected the checkout with the changed path. Restoring the file restored byte-identical provenance. The result is `/tmp/ovf-controls-correction-independent-probe.json`.

The owner's retained proof at `/home/morgana/.codex/worktrees/save4-den-resume/orcs-vs-Fairies/work/verification/controls-canonical-pin/proof.json` records the same seven hashes and Git blobs, the intended rejection, and identical provenance before and after restoration. JavaScript syntax and diff whitespace checks pass. No production source, test body, timeout, or browser behavior changed, so the final SAVE4 browser run remains a separate assembly task.

Findings (risk): none.

Behavioral interrogation:

- Ordering: none. The combined proof order is unchanged.
- Failure paths: a dirty, missing, additional, or config-mismatched canonical test now rejects during provenance collection before proof execution. The same check runs at browser finalization.
- Observability: `testFiles` is newly retained in preparation, build, browser, and final manifests. No production logging changes.
- Stale writes: canonical test bytes can no longer drift before or during a passing proof; exact Git-blob comparison and before/after provenance checks guard them.
- Test delta: no test logic changed. The independent negative probe proves the rejected path that was previously accepted.

The commit message has the required Codex attribution and co-author trailer.
