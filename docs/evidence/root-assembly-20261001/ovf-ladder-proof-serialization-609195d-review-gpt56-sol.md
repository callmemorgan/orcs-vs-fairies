# Ladder proof serialization review

Reviewed by GPT-5.6 Sol.

Verdict: accept `609195d1753d324548e9486821c4379571b880b2` as a narrow proof-runner correction over `f17acf8996c31c5dfe215421e11c4b68ced015a0`. The commit changes only the 108-case scheduling policy and its documentation. The serial 108-case rerun remains the required runtime evidence.

## Changed behavior

The sole executable change is `it.concurrent.each(games)` to `it.each(games)` at `scripts/ladder/ladder.test.ts:126`. Vitest now starts each synchronous game case after the previous case finishes, so waiting cases no longer spend their 120-second wall-time budget while another synchronous simulation blocks the shared JavaScript event loop.

The test body is otherwise byte-identical. The 45-minute simulation limit, 20-step save proof, 120,000 ms per-case timeout, full save and replay comparisons, terminal-state checks, economy and position assertions, losing-HQ assertion, output paths, source manifests, and reporter contract did not change. The only other changed file is `scripts/ladder/README.md:29-32`, which documents serial execution and the reason for it.

The mechanical audit is `/tmp/ovf-ladder-serialization-static-audit.log`. It proves that replacing the one scheduling token in the parent source produces the complete candidate test source, checks the retained limits and assertions, and confirms that the README paragraph is the only other edit. The owner's independent byte receipt is `work/commander-diagnosis/serial-runner-diff.json`; it records parent hash `2d4eaab7502854191bfacbe971508ed0107d2faebe1fcb2e6bf31205416417d0`, candidate hash `ce793275f13b4642f957b084f39ed9339de7caaa27bbc0818cf2e9db2078b76f`, and equality of every other runner byte. The frozen diffs are `/tmp/ovf-ladder-serialization-review.diff` and `/tmp/ovf-ladder-serialization-review-context.diff`. `git diff --check` passes.

## Verification

In a detached checkout at `609195d`, `./node_modules/.bin/tsc --noEmit` exits 0 with no output. The receipt is `/tmp/ovf-ladder-serialization-types-receipt.log`.

I did not run the full ladder during this review. The retained concurrent run finished with 97 passes and 11 failures, including nine real wall-watchdog failures. It remains historical evidence and cannot support final ladder admission. A fresh 108-case run from the combined frozen source must execute this serial runner and pass its native save checks, source-before/source-after equality, test exit status, and reporter audit.

## Findings (risk)

There is no source defect in this commit. The remaining verification gap is that no small automated test asserts Vitest's timer-start behavior across two synchronous table cases. The exact one-token source change proves the intended scheduling configuration, while the fresh serial 108-case run must prove that it resolves the observed watchdog failures in the real workload.

Ordering: the games now run in the deterministic matrix order rather than under concurrent test scheduling. This removes overlap; it adds no new interleaving.

Failure paths: the commit adds no promise, branch, early return, or exception handling. A case failure remains a Vitest failure, and the reporter still runs only after Vitest succeeds.

Observability: per-game console lines and result-file creation now follow matrix order. Their fields, filenames, source identifiers, hashes, and final reporter input are unchanged.

Stale writes: cases already use distinct game/save filenames inside one new run directory. Serial execution prevents simultaneous case writes; source manifest checks before and after the run remain unchanged.

Test delta: no gameplay assertion changed. The final 108-case execution is the regression check for the scheduling correction.
