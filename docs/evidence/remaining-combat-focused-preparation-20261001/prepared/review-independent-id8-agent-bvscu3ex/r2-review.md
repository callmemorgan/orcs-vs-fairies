# Focused remaining combat preparation r2 review

R2 corrects both receipt scope findings from r1. The keyboard focus blocker remains because canonical-main-smoke.mjs is byte-identical to r1. R2 is therefore not ready for execution.

The review pins preserved `draft-r2` against committed base `7e80356c9564151749a7753971fba13eec349509`. All three candidate hashes match its seals, and the exact patch reconstructed every candidate file in memory. R1 remains separately preserved; this conclusion uses archived r2 bytes rather than the subsequently changed current candidate path.

The browser's r1-to-r2 hunk `@@ -36,6 +36,7 @@`, at candidate line39, adds an assertion rejecting simultaneous canonical and remaining-combat scopes. It runs before browser launch and before the receipt claims a selected group. Existing invalid/duplicate-name handling and default canonical,ruins selection are retained.

The auditor's r1-to-r2 hunk `@@ -118,8 +118,9 @@`, at lines121–126, derives hasCanonical from selectedGroups and uses it to enter the existing completion, case-name and export-array assertions. The corresponding hunks `@@ -211,7 +212,7 @@` and `@@ -276,7 +277,7 @@` use the same selected-scope guard for continuations/exports and siege/ambush/morale causal histories. A selected null canonical payload now fails when reading its completed field, rather than bypassing validation. This preserves the previous fail-closed behavior. No malformed receipt was generated or executed during this review.

The original three browser and history case bodies remain byte-identical to base. Formation and charge observations remain restricted to selected canonical. The automatic event chronology, complete save/replay/runtime comparisons and command-suffix comparisons are not weakened by these corrections.

The unchanged helper still leaves Tactics focused before KeyP, so the r1 event-propagation finding remains at canonical lines127–130. Closing/focusing outside Tactics and faction panels through existing public UI is required before the key toggle. The dynamic sequence and timing remain unverified.

No candidate code or game module was executed or imported. No syntax check, test, build, browser, simulation, replay, DB, server, signals, new delegates or root/owned/Git/ledger writes occurred. Only the separate review reports were written.

| Candidate file | Bytes | SHA-256 |
|---|---:|---|
| `scripts/acceptance/canonical-main-smoke.mjs` | 26403 | `fc2a094f8441b3eb188a5aa6a3ac5c53c5ed75c7852e9076f8a9c3aeea6d97e9` |
| `scripts/acceptance/verify-main-smoke402.mjs` | 11432 | `4f6899905515d0df832b24902bb3ad3c49074abb0d0cfc0a2b5e4b81cb2cac42` |
| `scripts/acceptance/main-smoke402-history-audit.ts` | 32466 | `5acb76c728b0fb400eb38c97241cd3f6b706679c51cc82f4b666e34db0302533` |

Preserved r2 patch SHA-256 `f2639a72d2c989642bd7ec000aa878e704f9601f157029d086fded9d1703633d`; source-seals SHA-256 `fafe8ec998c84015514c03be36d728e8723a4a44516110b25adb46d4aec46ddf`. R2 files are under `/tmp/ovf-remaining-combat-preparation-7e-20261001-hcjileau/draft-r2`.
