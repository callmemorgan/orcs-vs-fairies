# Static supplement for bounded PIDFD R4

The R4 supplement passes static review. Its seven added lines fix the PIDFD R3 lifecycle-budget finding. Before writing `driver-result.json`, the wrapper now sums the retained lifecycle files and the complete encoded result. If a capture that would otherwise pass exceeds 16 MiB, it changes the result to `FAIL_LIFECYCLE_OUTPUT_BUDGET_NO_RETRY`, records an `OutputBudget` first failure when needed, preserves the bytes, and returns failure.

The breach branch adds failure metadata after the size calculation, so an already-over-budget failed result can grow beyond the measured amount. This does not allow success over the cap. It follows the contract's instruction to preserve produced bytes after failure. The disclosed possibility that an unobserved descendant writes later also remains assigned to root's independent native-lifetime decision.

Both R4 specimens bind the R4 wrapper hash and the unchanged public R3, collector R7, and native R6 hashes. `README-r4.md` and `FINAL-CANDIDATE-CONTRACT-r3.md` name the current driver and specimens, supersede the earlier files, and preserve the bounded native-lifetime contract. They state that finite `/proc` scans cannot exclude every descendant, require `ownedNativeLifetimeIndependentlyAdmitted=true` before audit, make no global helper-session claim, and exclude the preserved cgroup option from the current recipe.

The retained Playwright 1.63.0 receipt at `dependency-review-r1/receipt.json` establishes for its reviewed bytes that URL CDP `Browser.close` disconnects the WebSocket and removes temporary files without a native browser-close command, OS signal, or external PID reap. It also establishes that closing each returned guest context disposes only its explicit context ID. The receipt reviewed PIDFD R3, and the parent retention record limits its R4 use to source portions unchanged by R4's final-result accounting change. It has no source pin and grants no runtime admission.

No new implementation blocker appears in the R4 change. The static supplement status is `PASS`, `approved` remains false, and runtime remains `HELD`. Root still needs to bind the source pin, tested build, executables and dependencies, protected socket set, exclusive slot, and native-lifetime disposition.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `driver/run-minimal63-pidfd-r4.py` | 40,975 | `e333b6386e4a48ac4194ef760a6ee605bc567252b8fdae832f0d65a630e687be` |
| `public-producer-r2/verify-human-wave-r3.mjs` | 48,578 | `d661329136041f8ccb15dfb9e94ae0556c303a6f995304c7f08889698b5a5f0f` |
| `passive-collector-r2/collect-launched-waves-r7.py` | 18,600 | `c6c768ad7d54696e5e1e8456881f038cd7b7bb70112cd9b8b17d86b0feaebd7f` |
| `native-auditor-r2/audit-human-wave-r6.py` | 64,185 | `4862672ef96aba39799d3ef9c6280be9fbeaa8194391b3f2b5acefb5e7cd76fb` |

This was a static supplement. It did not run packet scripts, Node, tests, builds, browsers, servers, SQLite, simulations, signals, or cgroup operations. The review records the reported harness and model name, but it does not claim independent provider authentication.
