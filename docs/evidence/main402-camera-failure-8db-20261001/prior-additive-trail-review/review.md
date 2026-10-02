# Additive review of the f67 formation-selection failure

This review adds to the prior external receipts and does not modify them. Requested reviewer model: `gpt-5.6-sol`. This sub-agent runtime did not expose a provider model identifier, so I do not claim that exact model or a finer actual family identity.

The r2 failure is preserved and correctly classified. The run compiled all three helpers, generated and sealed the fifteen fixtures, started the browser against the tested build, imported `formation-line`, then failed while selecting the six troops. The expected army was IDs 54 through 59. The final selected set was 54, 55, 57, 58 and 59, omitting spear 56. The native pointer trace records the attempted click on 56 while 54 and 55 were selected, followed by the click on cavalry 57 with 54, 55 and 57 selected. No formation command was accepted, the observation event list is empty, and no formation case completed. This is not evidence that feature 1 failed.

The run packet supports its scope. `raw/run-artifact-manifest.json` seals 539 files and 92,868,971 bytes. The control manifest seals 12 files and 176,763 bytes. The preliminary `root-retention.json` records 564 retained files and 93,272,269 bytes. The final `root-retention-v2.json` adds the completed architecture review and final metadata, for 582 originals and 93,631,927 bytes. The commit authenticates 583 packet blobs when the v2 metadata file itself is included. Browser cleanup completed, the history phase and placeholder capture did not run, and no runtime retry occurred.

The proposed correction changes one call in the four formation cases. It replaces `ctx.resume(); ctx.selectMany(ids.army)` with the existing `selectEntireOwnedArmy(ids.army)` helper. The helper resumes the match, clears selection through a native left ground click, presses the public F2 "Select army" shortcut, then waits until the selected array has the expected length and contains every expected ID. It does not open tactics until that check passes.

The candidate keeps every formation assertion unchanged: all four kinds, the six-unit status text, movement anchor and slots, obstacle detour, full-health checks, save/export, continuation and later replay audit. It also leaves the general `selectMany` helper unchanged for cases that need targeted subsets. The correction is an alternative public selection path for these fixtures rather than a weakening of the proof.

All four retained formation fixtures have the same expected IDs 54-59 and exactly those six F2-eligible owned living combat units on level 0. Workers and buildings are excluded by the public F2 behavior. The independent architecture review, completed after the initial request, found no static blocker and authenticated candidate SHA-256 `b08b45bd2d51278a599f453cd2a791a699d7ec4bb85d570ad1dc01060466899f` against base `f67ee00f50b159a5e236abe72956b2938d567515`.

Static evidence does not prove that F2 will work in a fresh browser run. It also does not establish a product defect in overlapping sprite hit testing; the failed trace shows the wrong selected set but does not isolate timing, projection overlap and hit testing. Root imported the exact candidate and committed it with the packet and three append-only trail rows at `8db0f2dd0b38302f0f588c80316db082bc49e9b3`. The committed helper has the reviewed SHA-256 `b08b45bd2d51278a599f453cd2a791a699d7ec4bb85d570ad1dc01060466899f`. A fresh run remains necessary for runtime evidence. No new feature gate follows from this correction.

The packet also preserves an operational copy failure: the first retention attempt hit `FileExistsError` after raw copying and before control copying. The correction authenticated the existing raw path set and bytes, copied the remaining sources, and left originals unchanged. The append-only trail should disclose that preparation correction alongside the r2 selection failure.

The ledger remains 94 verified and six pending. I ran no runtime, application import, build, database, checkout mutation or signal operation and made no repository edit.

## Attention

reviewed by requested `gpt-5.6-sol`; actual provider identity was not exposed to this sub-agent

- Record the r2 result as a selection timeout before any accepted formation command. It supplies no feature 1 pass or failure.
- The one-call F2 candidate has no static blocker and preserves all assertions, but runtime success remains unverified.
- The append-only trail now preserves `root-retention-copy-first-failure.json`; its correction changed no original evidence.
- Do not turn pointer hit testing, F2, the full wrapper, or supplemental visuals into new original-feature gates.
