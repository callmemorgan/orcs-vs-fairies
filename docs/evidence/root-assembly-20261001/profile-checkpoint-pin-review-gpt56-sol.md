# Profile checkpoint pin repair review

Verdict: admit `6a634b200bbc978e0bd8abe2e9ba55833190d129`. It makes current campaign and conquest profiles inspection-only when a contained checkpoint has a missing or historical simulation revision. I found no unresolved defect in this commit.

I performed this review with GPT-5.6 Sol. I pinned the parent at `84baecb27425dee71b42e8756abf345a20142192` and the tip at `6a634b200bbc978e0bd8abe2e9ba55833190d129`.

## Findings (risk)

No findings.

The remaining limit is broader product acceptance. This review proves the checkpoint guard and its immediate callers. It does not replace the final assembled full suite or the frozen browser and packaged runs.

## Per-commit review

`6a634b2` changes campaign compatibility to check every completed and active battle checkpoint before its journal (`src/core/campaign.ts`, changed hunk at lines 50-54). A missing or old checkpoint revision now returns the same inspection reason used by standalone scenarios. Existing campaign writers and canonical reward verification call `requireCampaignRules`, so they reject the profile before replay, mutation, duplicate-completion shortcuts, or reward authorization.

The same commit checks an active conquest checkpoint before checking battle journals (`src/core/conquest.ts`, changed hunk at lines 32-38). Completed conquest history stores battle recordings rather than checkpoints, so there is no historical checkpoint field to inspect there. Existing conquest proposal, wait, preparation, checkpoint, and completion paths call `requireConquestRules` before changing the profile.

The regression file adds completed-campaign coverage using a real solved and completed mission. It then changes only the disclosed checkpoint pin and matching recording checksum. The tests require raw decode preservation and rejection by mission preparation, branch choice, duplicate completion, and canonical victory verification without profile mutation (`tests/profile-checkpoint-rules-compatibility.test.ts`, changed hunk at lines 28-47). Existing active campaign and conquest cases cover missing and `3.2.0` pins across their writers. The reward UI test requires the claim button to remain disabled for both incompatible completed-checkpoint forms (`tests/scenario-campaign-reward.test.ts`, changed hunk at lines 52-59).

The commit also retains the parent-red, green, expanded-green, and TypeScript logs plus a manifest. The manifest hashes match the four tested source/test files and all four logs. `git diff --check` passes.

## Independent verification

I checked out the parent in `/tmp/ovf-profile-checkpoint-review.Y1etbC`. The four original regression cases all failed because compatibility returned true. I applied the final reviewed code patch and ran `tests/profile-checkpoint-rules-compatibility.test.ts`, `tests/profile-rules-migration.test.ts`, and `tests/scenario-campaign-reward.test.ts`; all 28 checks passed. `tsc --noEmit` also passed with empty output. The committed code/test diff is byte-identical to the independently tested context diff, whose SHA-256 is `4e3d0cd39194e97ca62ee1451a6dd6d23d0fac73770f9228b6b759eb74ecf010`.

The root's retained expanded run records 10 passing files and 77 passing checks. Its earlier green run records 10 files and 73 checks. The retained TypeScript log is empty with a recorded zero exit. I verified each retained log hash against the committed manifest.

## Behavioral interrogation

Ordering: campaign compatibility now checks each checkpoint immediately before that battle's journal. Conquest checks the active checkpoint before any historical or active journal. All operations are synchronous; the change adds no concurrency or new interleavings.

Failure paths: the compatibility functions return the checkpoint's inspection reason. Existing `requireCampaignRules` and `requireConquestRules` turn that result into the same caller-visible error used for incompatible outer profiles and journals. No promise, catch, or swallowed error was added.

Observability: no log, telemetry, or event emission changed. The only new user-visible value is the existing inspection reason for the incompatible contained checkpoint.

Stale writes: guarded campaign and conquest actions call the compatibility requirement before mutation. The regression tests serialize each profile before every rejected action and require identical bytes afterward. The reward UI test requires no claim request when compatibility fails.

Test delta: active campaign guards regress under `keeps a campaign checkpoint with rules %s inspection-only before writers or replay`; completed campaign and reward shortcuts regress under `checks completed campaign checkpoint rules %s before duplicates or reward claims`; active conquest guards regress under `keeps a conquest checkpoint with rules %s inspection-only before writers or replay`; UI authorization regresses under `disables reward claims when a completed checkpoint has rules %s`.
