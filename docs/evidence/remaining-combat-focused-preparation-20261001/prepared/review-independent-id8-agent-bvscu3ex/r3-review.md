# Focused remaining combat preparation r3 review

No blocking defect remains identified in r3's static preparation. It fixes the panel-focus blocker and retains r2's selected-scope validation. This is a static integration recommendation, not a passing browser result, execution authorization, feature admission or timing guarantee.

The base is committed `7e80356c9564151749a7753971fba13eec349509`. The current candidate is an external uncommitted packet with executionSourceCommit=null. All three baseline files matched actual immutable Git blobs with GIT_NO_REPLACE_OBJECTS=1. All candidate bytes matched their r3 seals; the exact patch reconstructed all three candidates in memory. No Git patch was applied, and no candidate module was executed.

## Focus correction

The r2-to-r3 hunk in canonical-main-smoke.mjs, `@@ -126,7 +126,8 @@`, now calls ctx.closePanels before a needed KeyP toggle at line130. The earlier SessionTools closure and already-paused check at line128 remain in order. The new operation uses the existing public Close army tactics / Close faction powers buttons in immutable base native-context.mjs:21–24. It assigns no game, pause or DOM state through script.

At immutable base TacticsTools.ts:99, Close army tactics closes the section and focuses its launch button. Main.ts:378 appends that launch into sessionToolbar, outside the host that stops keydown at TacticsTools.ts:103. FactionTools.ts:120–121 has the same closure/focus and propagation shape; main 379 also supplies sessionToolbar. SessionTools.ts:311 closes its modal and restores focus, while its closed host only suppresses Enter/Space on buttons at line316. KeyP from the resulting toolbar focus can therefore reach the GameScene window keydown handler at line159. Controls.ts:18 declares KeyP as the default pause binding. The fresh browser context has no supplied control-profile storage. The plain pause overlay in Hud.ts:112 has no modal dialog role.

The early return when the requested paused state already matches leaves panels open; that is harmless for the intended flow because no key is sent in that branch. When the partial siege capture or ready ambush needs a toggle, closePanels moves focus before the key. The remaining cases reopen their Tactics panels at the existing inspection points. Their screenshots and behavioral assertions are unchanged.

R2's browser scope assertion remains at verify-main-smoke402.mjs:39. The history auditor retains hasCanonical selected-scope guards at lines121–126,215 and280. A selected null payload fails instead of skipping its completion/case/continuation/causal checks. The runner and auditor both reject canonical plus remaining-combat. The default still remains canonical,ruins; handoff and assignment.pending.json correctly require explicit remaining-combat in the future command.

## Assertion and filtering review

The selected remaining cases are siege-full-crew-capture, ambush-selected-trigger and morale-supported-full-fight. They run in that order. The formation loop at canonical line42 and charge loop at line58 use an empty iterable when remainingOnly=true, so they issue no formation or charge browser actions. The result caseNames uses the three-case array. The full canonical export remains available with its nine cases and its original default behavior.

The three remaining browser bodies remain byte-identical to base: 13,954 bytes, SHA-256 `c8f7b20d2259d6aedd6824056a4fdd54bb64a958de8f1cea822349f45682f8d4`. This preserves full crew and hull setup, actual crew defeat, ordinary capture channel, ownership/movement/new-owner shell assertions; dry-ground ambush rejection and ready wrong-role withholding plus selected-role hit; and full-health/morale 100 baseline, native attack-before-volley, real wounds/deaths, close live support, automatic retreat, continued movement and owned perspective inspection.

The three corresponding history causal bodies remain byte-identical to base: 9,907 bytes, SHA-256 `868850875662ea8dc6e61a0ac7af509999876fa624c2551f297ae7a0f4482748`. Their actual crew damage/capture/new-owner launch/hit, concealment/withholding/trigger, and accepted attack/launch/hit/death/retreat checks are retained. Formation and charge observations run only under selected canonical. Existing full save/replay/runtime verification still processes actual authenticated downloads, and continuation/export comparisons use the selected canonical payload.

The history manifest loop still authenticates every fixture in the supplied manifest. Keeping the full source-bound manifest is compatible with running only the three browser cases. This is static file authentication logic, not an unexpected formation/charge action. The unchanged eventEndpoints set contains charge filenames but only retains histories for actual downloaded filenames; it imposes no missing charge endpoint requirement on remaining-combat.

## Findings (risk)

No additional blocking static finding is identified. Timing remains unverified: public panel closure and KeyP can advance the live clock before a pause, and native Hold still attacks in range. The unchanged full-hull, partial capture, health, before-volley and replay/runtime assertions must decide the real outcome. The browser polling may miss transient events; the retained history auditor must still derive them from actual source-bound replay.

The new wrapper records nativePauseInputs only after a successful toggle and wait. A failure before that record propagates to the existing canonicalProgress failure and browser failure receipt, rather than producing a successful group. This preserves failure propagation but is not an executed failure-path test.

No regression test was added for the new group selector, malformed receipt guard or panel-focus path. The retained assertions are the future runtime checks; none ran here. Syntax, imports, build compatibility, actual pause behavior, all eleven checkpoint exports, the five continuation pairs, complete causal histories and cleanup remain unverified until root integrates and performs the authorized source-bound run.

| Changed area | Ordering | Failure paths | Observability | Stale writes | Test delta |
|---|---|---|---|---|---|
| Canonical filtering and remaining wrapper; patch hunks -19/+20,-38/+39,-54/+55,-115/+116 | Three retained cases stay serial. Session closure, paused observation, public panel closure, KeyP and observed wait are sequential. No new concurrency. | Needed-toggle failures reject and reach the unchanged case/browser catches; predicate timeout still rejects. No error is swallowed. | New caseNames/scope and successful nativePauseInputs describe the focused scope. Existing trace/check/download ordering is retained. | No browser state assignment. Existing private output directory and wx artifact writes remain. No new retry/supersession writer. | None added; future retained assertions and real native sequence must run. |
| Browser group dispatch; patch hunks -6/+6,-22/+22,-33/+33 | New scope selection guard rejects before launch. Group runner loop stays serial. | Duplicate canonical scopes fail before a browser is owned; existing group and cleanup failures still propagate. | selectedGroups and groups['remaining-combat'] use the same receipt schema and filename. No existing emitted check is removed. | No new shared writer. Fresh out directory and source/helper/freeze bindings retained. | None added; malformed-selector rejection not executed here. |
| History group compatibility; patch hunks -16/+16,-113/+114,-208/+212,-272/+276 | Selected-scope payload validation precedes rederivation; formations/charges gated to full canonical, three causal bodies gated to either canonical scope. | Null/missing declared payload now rejects. Existing authenticated download, complete envelope, observer and continuation errors still reject. | Focused observations contain siege/ambush/morale without false formation/charge observations. Output's broad explanatory scope string remains unchanged and does not claim admission. | Existing wx audit output and supplied-receipt equality binding retained. No new superseded writer. | None added; null payload behavior is statically derived and original assertions unchanged. |

## Compliance notes and byte identities

The packet is preparation only. Global AGENTS and writing style were read. The unslop and code-review-diff instructions informed report wording and diff references. Exact quotes and added symbols were checked against packet source/diff; a known-negative invented symbol was absent. There is no candidate commit, so the review pins the actual base and sealed external bytes rather than inventing a TIP commit or per-commit history.

No runtime, candidate import, syntax check, test, build, browser, simulation, replay, DB, server, signals, new delegates, root/owned/Git/ledger writes or protected-preview operation occurred. Only these independent reports are written beneath this new review directory. Root alone integrates, pins future execution and admits features.

| Candidate file | Bytes | SHA-256 |
|---|---:|---|
| `scripts/acceptance/canonical-main-smoke.mjs` | 26531 | `30302db2b09027326dfe811b924085580dfbf3ca7a3d24979e83b3c8d1329216` |
| `scripts/acceptance/verify-main-smoke402.mjs` | 11432 | `4f6899905515d0df832b24902bb3ad3c49074abb0d0cfc0a2b5e4b81cb2cac42` |
| `scripts/acceptance/main-smoke402-history-audit.ts` | 32466 | `5acb76c728b0fb400eb38c97241cd3f6b706679c51cc82f4b666e34db0302533` |

R3 patch SHA-256 `345c7735ee2450cf4e4684e685bfccd4434628ff93d2e332aa7d7baf3604ec8b`; r3 source-seals SHA-256 `81083b6cca1915637ed6b75f5fae629e1492dbf3880e0eb27da27389b8e13721`. The three baseline hashes are canonical `09d1eaecb6722e2b2eabf4330e203e3db80d507a7e4462575cbace695df1e2e1`, wrapper `1e0758ad72de4b40eb65a725676596d77fe142f5040ed7215932bd93ee6dd40c`, and auditor `4897f625184615f55128b0d6b76fe7c40995d150763a71c242d1e5b8c253d393`.
