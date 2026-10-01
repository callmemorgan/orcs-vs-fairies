Verdict: admit `7c66a7c1497b3bdda9080c37c79c01e9613b2fef` and `5e7a606aff7a4fd27f6d36fcff9a9c38c25b5166` over `115a537dd90d5e26ca04c7003f47310a71e67879`. Both commits change tests only, and I found no weakened contract or new product risk.

`7c66a7c` projects synthetic version 1 and version 2 saves onto the field sets emitted by historical commits `2c8c79a` and `b538995b6ee8b398f5724a5bb8a0d89cf18a49fc` (`tests/helpers/historical-save.ts:6-28`). It checks the complete migrated envelope against an independently assembled expected value (`tests/helpers/historical-save.ts:31-41`), keeps exact malformed-input paths, verifies that migration does not mutate its input, and continues a native current-version checkpoint. The combat corrections use public facing commands for directional armor and relic assertions (`tests/progression.test.ts:128-134` and the matching neutral/technology tests). Siege and bridge tests assert the projectile is pending before waiting for its bounded impact (`tests/progression.test.ts:118-126`, `tests/environment.test.ts:219-231`).

`5e7a606` closes the remaining ownership timing gap. It launches a fitted incendiary shell through public commands, causes an actual three-sector surrender before impact, confirms the shell retains side 0 while the gun transfers to side 1, saves at that point, and checks old-side ignition plus full native and replay equality on levels 0 and 1 (`tests/joint-pre-impact-surrender-ignition.test.ts:19-63`). The direct helper test now also proves that a successful ignition creates one world fire (`tests/environment.test.ts:259-266`).

The changed code introduces no concurrent work, new product failure path, telemetry change, or product write. The tests exercise the relevant delayed state explicitly: the projectile remains pending across transfer, the restored state retains both ownership identities, and replay seeking reaches the same complete save. No stale-write finding remains.

I independently reran the two final files: 33/33 tests passed. I also reran the historical producer/consumer proof. Both complete expected envelopes, input immutability, historical consumer round trips, forged-field rejection, and the 16,777,152-byte migration boundary passed. The 169-file SHA-256 manifest passed. Earlier independent review reran all six fixture suites at 202/202.

The main remaining limits are integration checks. This branch is pinned to production source `115a537`; the historical proof refuses to certify a later source tree. SAVE4 changes the expected migrated envelope, so its owner must extend and rerun the helper after integration. Whole-suite, browser build, and the 108-match ladder remain parent-owned. The direct ignition helper uses an authored ownership change, while the separate two-level integration supplies the public surrender proof. The evidence directory was untracked when I reviewed it and needs its own committed identity if it is to be retained in the final branch.

## Attention

reviewed by GPT-5.6 Sol

- Rerun the historical envelope proof after SAVE4 updates its defaults.
- Run the parent-owned whole suite, browser build, and 108-match ladder on the final combined commit.
- Retain the evidence directory under a pinned commit if reviewers will rely on it.
