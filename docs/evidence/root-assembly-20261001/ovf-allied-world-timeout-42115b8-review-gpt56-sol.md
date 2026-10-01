# Review of 42115b802c53dd3f2ae06d95d2dc426908d8a86f

Verdict: admit this narrow fixture correction after `e162680cf2a5918d4285fa405e1a0e5c1548632b`. I found no behavioral or evidentiary defect.

I reviewed this with GPT-5.6 Sol. The pinned diff is `/tmp/ovf-42115b8.diff`.

The commit changes one line in `tests/allied-world-combined.test.ts` at the closing line of the case named `leaves surface troops unassigned to a cavern request and completes with real cavern movement after saving`. It adds a 20,000 ms Vitest timeout. No source or other test changes are present. `git diff --check` passes and the numstat is one insertion and one deletion.

I normalized only `},20_000);` back to `});` in the child file and compared the complete file with its parent. The files are identical. Both normalized SHA-256 values are `dbb4ac793b1bb37e49f3e8a4870e8c9813d1fef20818a48ba3f3fddffe501ada`. This independently confirms that the assertions, save/load path, and 180 resumed-tick comparison did not change.

The retained proof is `/home/morgana/.codex/worktrees/save4-den-resume/orcs-vs-Fairies/work/verification/allied-world-save4-timeout/proof.json`. It identifies the exact source pin and case, points to `/home/morgana/Projects/orcs-vs-Fairies/work/hundred-features/root-save4-corrected-full-tests.log`, and records the root failure at 5,058 ms against the default 5,000 ms budget. It also records the unchanged isolated case passing in 2.03 seconds and all eight cases in the file passing after the timeout change in 4.08 seconds. I did not rerun the full suite while the root assembly was running it.

Findings (risk): none.

Behavioral interrogation:

- Ordering: none. The test body and production execution order are unchanged.
- Failure paths: none. Assertions and thrown failures are unchanged; only the runner budget is larger.
- Observability: none. The commit adds no logs or telemetry.
- Stale writes: none. The commit changes no state writes.
- Test delta: the same eight-case file covers the changed case. The retained proof records the targeted case and whole file passing.

The commit message has the required Codex attribution and co-author trailer.
