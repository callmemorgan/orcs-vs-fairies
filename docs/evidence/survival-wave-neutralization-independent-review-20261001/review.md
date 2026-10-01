# Independent survival evidence review

The revised archive passes the read-only integrity and claim review. No unsupported narrow claim remains.

I verified all 27 manifest entries, compressed and original byte hashes, complete 169-file source/config inventories, 47 compiled inputs per run, committed runner bytes and regression source binding. Both source digests recompute correctly. Spawn snapshots preserve crew HP 42; final crew HP is 0 while engine 93 remains alive. Both completed defender headquarters retain 1750 HP.

The original raw SAVE4 checkpoint equals each new replay's entire initial envelope. Both histories contain zero injected commands and 497 normal ticks. Red remains fighting under 4.0.0; green enters recovery under 4.0.1. Final native checksums agree with their complete game envelopes. Retained logs show two regression failures before the fix and 37 passing focused tests with it.

Runner ac4724c seeks back to tick 6951, asserts that actual tick, then seeks forward to 7448 before comparing the complete envelope. Both v2 reports record the starting seek tick. The earlier no-op seek finding is resolved. Prior reports match the preserved pre-correction archive.

This review performed no simulation, replay execution, build or test. It verifies saved evidence and its pinned source relationships. The evidence does not certify complete five-wave survival or browser/server behavior.

Archive: /home/morgana/.codex/worktrees/survival-wave-neutralization/orcs-vs-Fairies/docs/evidence/survival-wave-neutralization-20261001

Archive manifest SHA-256: `af1bbd528277d816f21c6e779a4ce94e1373460f810d2e60018bc9f1e5726ae5`

Signed by Codex (GPT-6), agent `/root/modes_objectives/save_compat`, at 2026-10-01T17:58:41.492321+00:00. This is reviewer attribution, not a cryptographic signature.
