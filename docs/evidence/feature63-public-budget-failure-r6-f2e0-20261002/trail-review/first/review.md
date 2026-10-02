# R6 retention trail review

The two rows describe the failed R6 result accurately, but the trail needs two corrections before it is a clean proof record.

The second row cites `custody-review/selected/review.json`. That file proves the selected script passed static review, and it records the three earlier review failures and their fixes. It also says `runtimeExecuted: false`. It therefore cannot prove the same row's claim that the selected script ran once and exited 0. That execution claim is proved by `root-custody-execution/execution.json`, SHA-256 `dfd5555a60e4b33c221ab118d3926c8ab9ef706761ec8e9533a1227ae83c78a7`, which records one execution, exit code 0, no retry, and candidate SHA-256 `69f96b73f080e9175f4b3f9a51847e16db65e238e8f5f40ebab99a2ee5e1afba`. The row should cite both artifacts or a retained combined receipt.

The first row's phrase `wrapper25heldPIDFDclosed` merges two separate facts. The packet records 25 registered native records with held-PIDFD exit evidence. It authenticates the wrapper separately. The concrete launcher is separate again, giving 27 finite absent PID and start-time readbacks in total. Replace the phrase with `25 held-PIDFD native exits; wrapper separately closed; 27 finite absent readbacks`.

Everything else needed to keep R6 failed is supported. The nine frozen public inputs total 67,178,035 bytes against a 67,108,864-byte limit, an excess of 69,171 bytes. There are no passing public windows. Owner 2 never supplied the two nearby live non-worker combat units required by the approach gate. One native checkpoint exists and remains unaudited. The raw database is a 129,224,704-byte, mode-0444, two-link inode with SHA-256 `4869210d07efbc2a94402958c8924800bb5cd867f9ff57b10af479f1b1a38e29`; the custody result records no SQL, extraction, or audit. The slot was released. The ledger remains 99 verified and 1 in progress, and feature 63 remains pending.

The protected-state wording should stay bounded to what was checked. The packet records the protected port-4173 process as PID 1063, start ticks 874, session 1063, fd 22, socket inode 3783, with the 397-file protected dist inventory unchanged. `protected unchanged` should not be read as a wider statement about every process or file.

The closure has two stated limits. Its 27 readbacks cover remembered identities and do not exclude missed forks or reparenting. The selected static review also says the utility requires 25 registration records and equal registration and closure key sets, but does not separately require 25 unique keys. The seven inventory checks passed during the successful custody execution before the raw inode was sealed, but they read members one at a time and therefore rely on the checked trees remaining quiescent during the pass.

The retention manifest has 137 records across 21 copied trees. A post-copy check in the permitted transcript at `2026-10-02T08:45:23.955Z` rehashed all 137 originals and copies and reported success. That compact result was not retained as its own packet receipt. Keeping such a receipt would make the packet easier to audit after temporary source directories disappear. The execution record also names temporary candidate and review paths; the packet contains retained copies with matching SHA-256 values, so those links are recoverable by digest.

The first row itself has SHA-256 `7d8f807bb60eca7c9015997ed882e1e5381b1149b9c1ff978d746b2432fcfb1d` when hashed with its trailing LF. The second has SHA-256 `07c5f84ee540a6d80821e0e1e44bac822ca39ffc846b631ea6613068e001a709`. The decision file reviewed was 136,488 bytes with SHA-256 `51ddf4cba0cc4a3cbf83f90b87cbceb927bb562c62316ea733cdba82a6ca6110`. The root retention manifest was 36,799 bytes with SHA-256 `ec2fc3aedc357ef079d3c3317173b9983e7e8b6853ccbf3ecb97da30380984a4`.

The requested reviewer model was `gpt-5.6-sol`. The serving provider, model, and model-family identity were not independently authenticated, and no Claude review was used. This review does not strengthen the packet's provider-identity claim.

No repository file, runtime, protected process, database, checkpoint, profile, or ledger was changed or queried by this review.
