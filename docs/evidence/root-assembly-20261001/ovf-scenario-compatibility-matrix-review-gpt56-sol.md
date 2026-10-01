# Scenario compatibility matrix test review

GPT-5.6 Sol reviewed `b1e58954eee29d6eda6b763c6769717039db90ae` against parent `b679f8e4c5a4e73f34961f6c62721302585def2d`. The commit adds 65 test lines across `tests/conquest-persistent-equipment.test.ts` and `tests/scenario-demo-compatibility.test.ts`; it changes no production source.

## Verdict

Accept the test-only commit. It closes the explicit old-profile-pin import cases and adds disclosed synthetic conquest equipment coverage without claiming a natural artifact donor or victory.

## Per-file review

The new conquest test prepares a disposable profile with one synthetic armor artifact, verifies the deployed entity and remapped artifact IDs, accepts one hold command and one step, checkpoints to SAVE4, verifies the recording against the live save, resumes the checkpoint, and redeploys the surviving army. It also checks that both caller-owned profile inputs remain byte-stable. The comments state that canonical conquest maps have no artifact donor and that the test is not evidence of earned equipment, a canonical conquest result, or a historical capture.

The demo compatibility addition runs the same old-pin path for campaign and conquest imports. Each case checks the historical diagnostic, read-only and simulation-disabled scene flags, rejected commands, unchanged export bytes, no storage writes, and no observed mutations.

## Verification

The detached worktree at `/tmp/ovf-scenario-matrix-review.h2eSRp` passed both changed files: 22 tests across two files. `tsc --noEmit` also passed, and `git diff --check` reported no whitespace errors.

There is no concurrency or changed logging in this test-only commit. Failure paths are assertion failures. The tests copy or create their inputs and destroy scenario recorders in `finally` blocks, so failed assertions do not leave a recorder active. The added assertions are the test delta for every behavior claimed above.

## Findings

None.
