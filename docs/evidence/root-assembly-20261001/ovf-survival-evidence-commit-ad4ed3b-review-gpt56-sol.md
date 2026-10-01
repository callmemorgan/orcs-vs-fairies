# Survival neutralization evidence commit review

Reviewed by GPT-5.6 Sol.

Verdict: accept evidence-only commit `ad4ed3bf1f40b8b82b7f75ab6796a1a6ac1c74a9` over tool correction `ac4724c1040fbb221051a375437cc0637150faae`. It preserves the admitted red/green survival evidence, resolves the earlier no-op endpoint-seek claim with fresh v2 runs, and states the remaining combined-run limits. I found no unsupported narrow claim.

## Commit scope

The commit adds 39 files under two `docs/evidence` directories and changes no production, test, build, or proof-runner source outside the archive. The frozen cumulative diffs are `/tmp/ovf-survival-evidence-ad4-review.diff` and `/tmp/ovf-survival-evidence-ad4-review-context.diff`. `git diff --check` passes.

The primary archive contains the original failed assembled run records; the final regression test and its red, green, and TypeScript receipts; the corrected 4.0.0 and 4.0.1 checkpoint runs; the executed bundles and build metadata; the corrected runner; and a read-only audit. The companion directory retains an independent artifact review and its checksums.

## Archive verification

I ran the committed `audit.py` from a detached checkout at `ad4ed3b`. It exits 0 and checks all 27 manifest entries, stored and decompressed hashes, pinned Git source/config blobs, source digests, bundle inputs and embedded bindings, tool bytes, checkpoint and final native sessions, red/green phases, crew state, HQ health, 497 recorded ticks, and regression binding. Its output is `/tmp/ovf-survival-evidence-ad4-independent-audit.json`.

I also reran the committed independent checker. Its output is byte-identical to `independent-checks.stdout.json` and is saved at `/tmp/ovf-survival-evidence-ad4-independent-checks.json`. It resolves 169 source/config files and 47 compiled inputs for each run, matches the committed tool at `ac4724c`, verifies zero recorded commands and 497 ordinary ticks, and confirms endpoint seeking from tick 6,951 to 7,448.

The archive manifest SHA-256 is `af1bbd528277d816f21c6e779a4ce94e1373460f810d2e60018bc9f1e5726ae5`. My review-record audit verifies all 31 archive hashes named by `review.json`, all seven files named by `review-checksums.json`, and both empty stderr logs. Its output is `/tmp/ovf-survival-evidence-ad4-review-record-audit.log`.

All 26 manifest entries that name an original live artifact still match those source bytes; `checks/binding.json` is generated inside the archive. This comparison is recorded in `/tmp/ovf-survival-evidence-ad4-original-source-audit.log`. The original failed-run TSV has 453 artifact rows and matches every size and hash in the compressed final manifest; `/tmp/ovf-survival-original-failed-manifest-audit.log` records that check.

## Supported result

The shared raw SAVE4 checkpoint starts at tick 6,951 under rules 4.0.0. Each fresh v2 run records 497 public `.05` ticks with no commands and reaches tick 7,448. Engine 93 spawns at tick 7,251 with crew HP 42. Normal combat reduces the crew to zero at tick 7,348 while engine HP stays `132.27615561427828` and both completed defender HQs stay at 1,750 HP.

The 4.0.0 source remains in `fighting` through tick 7,448. Fix `574ed5a` enters `recovery` at tick 7,348 and remains there through tick 7,448. Each run matches its restored native-session branch on every tick, recorder history, full replay endpoint, replay analysis, technology timings, and the corrected endpoint seek. The retained regression fails twice on the old source and passes 37 focused tests on the fix; the recorded TypeScript exit code is zero.

The first diagnostic and the first corrected runner remain identified as historical. The diagnostic's shared crew snapshot and mislabeled source digest do not support claims. The first corrected runner's same-tick endpoint seek does not support seeking. Only the v2 reports in this commit support the endpoint-seek statement.

## Findings (risk)

None in the retained evidence or its stated scope.

Ordering: this commit adds records and read-only auditors. It changes no runtime ordering. The reports preserve the order of all 497 advances.

Failure paths: both auditors use assertions and exit nonzero on a byte, Git binding, state, or claim mismatch. They do not catch and suppress failures.

Observability: the auditors emit JSON summaries and retain empty stderr logs. The archive keeps the original failed run, both obsolete diagnostics, and the corrected records, so supersession remains visible.

Stale writes: the auditors read the archive and Git objects without modifying either. The independent review records `archiveUnchangedDuringReview: true`; my reruns used a detached checkout.

Test delta: the retained regression covers crew defeat, captured-engine exclusion, reward count, save continuation, recorder history, and replay endpoint. The v2 runner covers corrected endpoint seek. Complete five-wave, browser, and server behavior are outside this evidence and still require the final combined proof.
