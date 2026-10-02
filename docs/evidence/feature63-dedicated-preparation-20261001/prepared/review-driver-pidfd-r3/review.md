# Static review of bounded PIDFD R3

PIDFD R3 fixes the R2 launch-custody and cross-family cleanup defects under its smaller stated contract. It no longer claims that finite `/proc` scans prove global descendant closure. It proves closure of direct unreaped roots and descendants whose complete identities were observed and bound in the original session, then requires root to admit the remaining native-lifetime risk before the audit. I did not treat the disclosed global limitation as another feature 63 gate.

The packet is still not ready for admission. Capture can pass after its last 16 MiB lifecycle check and then exceed the cap when it writes its final result. The current README also names the R2 specimens and describes a stronger Chromium-session proof than this variant claims. The Playwright CDP-close proof remains an external prerequisite. The review status is **FAIL** and runtime remains held.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `driver/run-minimal63-pidfd-r3.py` | 40,397 | `eabf3048df363f397275021886fcd831176d8de9e0e5bfc9f7fccc659a0a0fee` |
| `passive-collector-r2/collect-launched-waves-r7.py` | 18,600 | `c6c768ad7d54696e5e1e8456881f038cd7b7bb70112cd9b8b17d86b0feaebd7f` |
| `public-producer-r2/verify-human-wave-r3.mjs` | 48,578 | `d661329136041f8ccb15dfb9e94ae0556c303a6f995304c7f08889698b5a5f0f` |
| `native-auditor-r2/audit-human-wave-r6.py` | 64,185 | `4862672ef96aba39799d3ef9c6280be9fbeaa8194391b3f2b5acefb5e7cd76fb` |

## Findings

### Medium: capture does not include its final result in the 16 MiB cap

The success path checks all lifecycle files with `runtime_budget()` at [run-minimal63-pidfd-r3.py:580](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-pidfd-r3.py:580). The `finally` block later adds `driver-result.json` at [run-minimal63-pidfd-r3.py:594](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-pidfd-r3.py:594) through [run-minimal63-pidfd-r3.py:600](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-pidfd-r3.py:600), with no reservation or final aggregate check. If the directory is just below 16 MiB at line 580, the result file can cross the cap while the wrapper returns capture success.

Construct the final result before deciding PASS, include its encoded size in the aggregate limit, and change the result to failure if the complete retained directory would exceed 16 MiB.

### Medium: the documentation still describes R2 and a different lifetime contract

README-r2.md names `capture-assignment-r2.pending.json` and `audit-assignment-r2.pending.json` at [README-r2.md:21](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/README-r2.md:21). The current specimens are the R3 files, which bind PIDFD R3's hash. The same README says root must authenticate that the fixed Chromium launch keeps children in the owned session at [README-r2.md:11](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/README-r2.md:11) through [README-r2.md:13](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/README-r2.md:13). PIDFD R3 removed that boolean and instead requires root native-lifetime disposition after disclosing that unobserved descendants are not excluded.

Add a current PIDFD R3 README or manifest. It should name `run-minimal63-pidfd-r3.py`, the R3 specimens, and the four current candidate hashes. It should repeat the capture result's finite evidence scope and root-disposition requirement without claiming every native helper is observed in the original session.

### Blocking prerequisite: CDP disconnect behavior is not yet bound

The guard requires `reviewedCdpDisconnectHasNoNativeSignals` at [run-minimal63-pidfd-r3.py:226](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-pidfd-r3.py:226) through [run-minimal63-pidfd-r3.py:238](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-pidfd-r3.py:238). Public R3 calls `browser.close()` on the CDP-attached browser during emergency and normal cleanup at [verify-human-wave-r3.mjs:163](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/public-producer-r2/verify-human-wave-r3.mjs:163) and [verify-human-wave-r3.mjs:537](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/public-producer-r2/verify-human-wave-r3.mjs:537). The packet did not yet contain the completed Playwright 1.63.0 source review and authenticated dependency hashes. Runtime must remain held until root binds that receipt.

## Bounded native-lifetime result

R3 establishes custody earlier than R2. Immediately after `Popen`, it records the direct child's PID and start ticks, then registers the first observable complete identity before checking the intended command at [run-minimal63-pidfd-r3.py:317](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-pidfd-r3.py:317) through [run-minimal63-pidfd-r3.py:343](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-pidfd-r3.py:343). If command validation fails, `stop_family()` retries binding against the reserved start ticks and performs guarded cleanup at [run-minimal63-pidfd-r3.py:355](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-pidfd-r3.py:355) through [run-minimal63-pidfd-r3.py:420](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-pidfd-r3.py:420). Cleanup refreshes only the selected family, so another family's failure cannot block valid cleanup.

Every explicit signal still checks the complete PID/start-ticks/executable/cwd/argv identity, verifies PID 1063/start 874 and the admitted port 4173 holder immediately before signaling, rechecks the target, and uses the retained pidfd at [run-minimal63-pidfd-r3.py:345](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-pidfd-r3.py:345) through [run-minimal63-pidfd-r3.py:353](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-pidfd-r3.py:353).

The capture result states its evidence scope and requires root disposition at [run-minimal63-pidfd-r3.py:482](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-pidfd-r3.py:482) through [run-minimal63-pidfd-r3.py:485](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-pidfd-r3.py:485). The audit rejects admission unless the root extraction receipt sets `ownedNativeLifetimeIndependentlyAdmitted` at [run-minimal63-pidfd-r3.py:603](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-pidfd-r3.py:603) through [run-minimal63-pidfd-r3.py:612](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-pidfd-r3.py:612). This is an explicit handoff to root, not proof that no unobserved descendant survives.

The audit's 2 MiB pass cap now includes final stdout, stderr, driver events and the encoded result at [run-minimal63-pidfd-r3.py:644](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-pidfd-r3.py:644) through [run-minimal63-pidfd-r3.py:668](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-pidfd-r3.py:668). The slot token, collector cadence, source/tested 4.0.2/build bindings, fresh ports, first-failure preservation, no retry, one-shot post-seal audit, and both-human/both-AI-owner predicate remain intact.

## Review limits

This review was static. It did not run packet scripts, Node, tests, builds, browsers, servers, SQLite, simulations, signals, or cgroup operations. The runtime exposed the Codex harness and GPT-6 model name; no independent evidence authenticated the model provider.
