# Campaign reward HTTP proof helper review

GPT-5.6 Sol reviewed `b679f8e4c5a4e73f34961f6c62721302585def2d` against parent `25992978b77424154b60aaf4f5c5d919eb900fc9`. The commit changes only `scripts/scenarios/prove-campaign-cosmetic-reward.mjs`, adding 66 lines and removing 27. The reviewed helper SHA-256 is `b6e490b5f8cf06c36b453570b16c18fa98e8e45d44fe5d7d14f0752790e14f1f`.

## Verdict

Accept the helper as the corrected frozen-source HTTP reward proof driver. Its final canonical four-chapter execution remains deferred, so this review admits the driver and its negative controls rather than claiming the reward proof has run.

## Diff review

The source-admission hunk at lines 14–37 requires a full 40-character pin, the matching HEAD, exact inventory for all files under `src`, Git-blob equality for every tracked file under `src`, `scripts`, and both package manifests, and equality between the executing module and the frozen helper. Untracked files elsewhere under `scripts` do not enter the build or execution path: the authenticated helper directly invokes the authenticated `scripts/build-server.mjs`, while the complete `src` tree is the only recursively resolved production input.

The output hunk at lines 48–50 claims a previously nonexistent directory before writing proof files. A build failure retains the copied profile, combined build log, and final report inside that claimed directory. The child-process hunk at lines 52–80 waits for `close`, rejects nonzero and unrequested exits, sends `SIGTERM` only to a running child, bounds shutdown, and drains the serialized stdout/stderr write chain before returning.

The HTTP assertion hunk at lines 98–112 checks unauthenticated rejection, the complete first reward profile, duplicate idempotence, forged and wrong-finale rejection without inventory changes, the complete equipment revision-one response, and persistence plus duplicate protection after a graceful restart. The final source pass detects source changes during execution. The `finally` block records errors and makes the process fail after writing its report.

## Verification

The candidate parses as an ES module. The independent admission harness reran six real CLI faults: wrong pin, preexisting output, hidden modified source, untracked source, missing build dependencies, and append-only retry. All rejected, and the build-failure directory remained available at `/tmp/ovf-reward-admission-ZcWzhZ/missing-build-dependencies`. The retained direct stop-function harness covers an already-exited nonzero child, an unrequested clean exit, repeated requested cleanup, and a running child that receives `SIGTERM` and waits for `close` plus final logs.

Ordering stays sequential across build, first server, shutdown, second server, final source check, and final cleanup. All new promise failures either reject the proof or set the recorded error. Log writes preserve arrival order through one promise chain. A failed or concurrent run cannot reuse the output directory. The six admission controls and four stop controls exercise the new failure paths. No production application behavior changes in this commit.

## Findings

None. The canonical HTTP request sequence and browser controls still need their final frozen execution.
