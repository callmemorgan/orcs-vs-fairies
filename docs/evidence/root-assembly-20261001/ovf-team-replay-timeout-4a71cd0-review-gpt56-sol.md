# Team replay timeout review

GPT-5.6 Sol accepts `4a71cd07bacc12d214acaf5a0f95a7d9b486f52c`. The commit changes only the timeout on the existing 3-player and 8-player replay simulation table from Vitest's 5,000 ms default to 20,000 ms and adds a two-line explanation. Every command, 900-tick run, replay endpoint comparison, seek, restored continuation, and disposal call remains byte-identical after removing the comment and timeout argument.

The retained full suite at source `0d4145cfa768fb47fe21d4d257c8e1ea5d07549a` ran 2,920 tests. It passed 2,919 and failed only `replays high-side commands, gathering and research in a 8-player match` at 5,130.805032 ms against the default 5,000 ms limit. All 36 natural skirmishes passed. The same unchanged `tests/team-replays.test.ts` passed 9 of 9 cases in isolation; the eight-player case took 2,001.160522 ms.

My independent audit verifies both test-file blob hashes recorded in `team-replay-budget-change.json`, normalizes the candidate back to the parent bytes by removing only the comment and `20_000` timeout, checks all four first-failure artifact hashes, and reads both JSON test reports. It is saved at `/tmp/ovf-team-replay-timeout-4a71cd0-independent-audit.json`. The pinned diff is `/tmp/ovf-team-replay-timeout-4a71cd0-review.diff`.

The test still runs in the same table order and executes the same synchronous simulation work. No new interleaving exists. Assertion failures still fail immediately; only the wall-clock cutoff changes for these two cases. Vitest reports the same test names and durations. The commit writes no state and adds no stale-write path. The retained isolated run proves the unchanged behavior passes, while the first full run proves that the old wall budget was the only observed failure.

No correctness finding remains. I did not run another test process because root's fresh full suite owns the CPU slot. Acceptance of this test-only commit does not substitute for that fresh complete-suite result.
