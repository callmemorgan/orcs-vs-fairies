# Additive static review: f5 history-helper compile failure

The prior static review missed a compile-blocking duplicate declaration. Its compile-readiness conclusion is withdrawn. The logical event/history review and the later supervisor integration correction do not prove that the helper bundle compiles.

The admitted r1 run stopped during `build-focused-helpers`, before fixture generation or any browser, simulation, or feature execution. [`build-focused-helpers.stderr.log`](/tmp/ovf-main402-native15-f5a9392-r1/build-focused-helpers.stderr.log) reports that `launches` is declared twice in the same block at lines 299 and 335 of `main-smoke402-history-audit.ts`. Committed proof pin `f5a9392bce8d817a02692c44dd8a2018defe3709` contains the failing 31,983-byte source with SHA-256 `5f4471498a48113a135207d9195cb9cf8b4504d56f448258812bdfe16e21389f`.

The proposed correction is approved. [`proposed-siege-launch-binding-rename.patch`](/tmp/ovf-main402-f5-launch-binding-review-NzCzpEsA/proposed-siege-launch-binding-rename.patch) renames only the siege-local binding at line 299 from `launches` to `siegeLaunches` and updates its references at lines 300-302. The `observations.siege` output key remains `newOwnerAbilities`. The value assigned to that key remains the same siege event array. The morale-local `launches` declaration at line 335 and its references at lines 337 and 347 remain unchanged.

Static use inspection found four references belonging to the siege binding: its declaration, two assertions, and the `newOwnerAbilities` value. The morale binding has its own declaration, ordering assertion, and `ordinaryLaunches` output. Applying the reviewed rename removes the same-block collision without changing either predicate, array construction, assertion order, output schema, or audit result data.

No additional admission gate is requested. The planned next step is to commit this exact binding rename at a new proof pin and compile all three helpers before any browser launch. This review approves the rename but does not claim that a corrected helper has compiled.

Root was clean when this review began. During final readback, the exact reviewed four-line rename appeared as the only unstaged root change from another actor. The resulting worktree source has SHA-256 `4897f625184615f55128b0d6b76fe7c40995d150763a71c242d1e5b8c253d393`; line 335 remains the original morale binding. This review did not create or modify that root change.

The retained compiler log is 1,742 bytes with SHA-256 `a68b5bcb2cdd9b3eb7e7a694970b90208da1a60cfb780bf6e8a441d9546edc84`. The failed run affected no runtime feature because it ended during helper compilation.

This was a bounded static correction. The reviewer made no root edits, imported no source modules, and ran no helper bundling, test, build, browser, simulation, database, or signal operation. Reviewer: OpenAI GPT-6.1 Sol in Codex.
