Admitted for the corrected full hosted rerun. No admission-blocking concern found in the read-only review.

Reviewed BASE af44da406acf7ab44436e978cb1f571b93e28d23 and TIP e200a5ae1f4bd090ede83525baf0571f3319fbe6. BASE is TIP's merge base and parent. The range contains one commit, "Capture hosted renderer and HUD together", changing one file with 8 additions and 4 deletions. The changed hunk is scripts/server/verify-hosted-teams-browser.mjs, BASE lines 273–276 / TIP lines 273–280. Saved unified and context diffs are review.diff and review-context.diff; the commit's own diff is commit.diff.

The old renderer performed a waitForFunction predicate and then a separate evaluate capture. The changed hunk instead polls one synchronous evaluate callback. It reads window.rts once, reads the three HUD bank labels once, applies the same floor(bank) equality predicate, and returns the capture only when that predicate succeeds. Snapshot or HUD updates cannot run between that callback's predicate and returned capture. The callback contains no await, DOM write, game-state write, application callback invocation, socket send, injected winner or inventory award. Local object allocation does not modify the application.

The entire renderer suffix from the exact captured-wire-tick lookup through its return is byte-identical to BASE (TIP lines 281–291). It still finds the captured native frame by value.tick, compares private banks to that frame, requires undisclosed banks to be zero, compares all HUD labels to that frame's disclosed player, verifies foreign entity private fields, and checks online mode, simulation disabled, absent diagnostic setter, seed redaction, team IDs and privateSides. Spectator readOnly assertions and authenticated command receipt checks are unchanged outside the hunk.

All production bytes are unchanged. The sole repository diff path is the proof driver. The src and public Git trees, package files, Docker configuration, build-server script, TypeScript config, Vite config and Vitest config are identical at BASE and TIP; object IDs are retained in production-manifest.json. The canonical competition browser driver and runner are outside the changed path.

Findings (risk)

There are no admission-blocking findings. No dedicated automated regression fixture was added for a snapshot arriving between the previous wait and capture. This review does not prove the corrected hosted run succeeds; that full run remains the next evidence requirement. The retained failed run supports the inter-call sampling-race explanation, rather than proving the application lacked a stable HUD failure.

Behavioral interrogation

1. Ordering: TIP hunk lines 275–280 combines two browser evaluations into one read/capture task and serially retries that task. It introduces no concurrent writer. The coherent renderer may wait for a later tick, but the unchanged suffix binds its result to that exact native wire tick.
2. Failure paths: missing player or mismatched/missing HUD labels return null and retry. The existing poll helper has a 20-second deadline and 40 ms retry interval (source lines 35–39), matching the prior configured 20-second waitForFunction budget (source line 109). Browser evaluation errors propagate, and deadline expiry throws the new coherence label. The deadline is checked between evaluations; it does not interrupt an unresponsive evaluation. A separate unbounded evaluate existed before this change too. No rejection or downstream assertion is swallowed.
3. Observability: no success log, report schema, request identifier or event ordering changes. Only a coherence timeout's error label changes. The normal capture fields and renderer return fields remain the same.
4. Stale writes: none. The callback only reads and builds a returned capture. There is no superseded operation that can write application state. Current-wire collection and connection-boundary handling remain unchanged.
5. Test delta: no tests changed. node --check scripts/server/verify-hosted-teams-browser.mjs exited 0. No browser, server or proof was launched. A corrected full hosted run must still exercise cooperative AI player/team spectator views and the existing privacy/receipt assertions.

Retained evidence read back

work/final-freeze-proof-20261001/hosted-af44da4-run1/result.json reports failed at source af44da406acf7ab44436e978cb1f571b93e28d23 with 4 completed grouped checks, a renderer HUD assertion of 9740 versus 9758, and cleanupErrors []. Its native-browser/summary.json retains the same failure through the cooperative player spectator call.

work/final-freeze-proof-20261001/canonical-af44da4-run1/result.json reports passed at the same BASE with 18 checks and cleanupErrors []. This canonical result remains historical evidence for those unchanged production bytes; it is not a successful corrected hosted result.

Compliance notes

All symbol claims were checked against the saved changed-line diff, with a known-negative symbol returning zero matches. Production identity was checked using Git object IDs. The downstream suffix was compared byte-for-byte. Review outputs were written only to /tmp/hosted-renderer-admission-e200a5. Source, root checkout, ledger and retained proof outputs were untouched. The owned checkout remains at TIP with only the pre-existing untracked node_modules entry.
