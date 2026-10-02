# Static R2 review of the feature 63 dedicated wrapper

R2 fixes the collector slot mismatch and the collector's catch-up cadence. It also prevents the stale session-ID reuse found in R1 by retaining each authenticated direct child as an unreaped session leader. The packet is still not ready for runtime admission because session closure is inferred from two non-atomic `/proc` scans, a launch can leave a live process without an admitted root, and the new native-audit output cap lacks a final check. The dependency proof and current packet entry points also remain unresolved. The review status is **FAIL** and runtime remains held.

The reviewed primary bytes were:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `driver/run-minimal63-r2.py` | 37,033 | `611715dfafc6d2b15c624f055b773b702a93a5b116e6d3a639c55ffa5d63f946` |
| `passive-collector-r2/collect-launched-waves-r7.py` | 18,600 | `c6c768ad7d54696e5e1e8456881f038cd7b7bb70112cd9b8b17d86b0feaebd7f` |
| unchanged `public-producer-r2/verify-human-wave-r3.mjs` | 48,578 | `d661329136041f8ccb15dfb9e94ae0556c303a6f995304c7f08889698b5a5f0f` |
| unchanged `native-auditor-r2/audit-human-wave-r6.py` | 64,185 | `4862672ef96aba39799d3ef9c6280be9fbeaa8194391b3f2b5acefb5e7cd76fb` |

## Findings

### High: two `/proc` scans are not an atomic empty-session check

R2 improves ownership discovery at [run-minimal63-r2.py:277](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:277). It removes PPID admission, requires the direct child to retain its original start ticks and session ID, and keeps that direct child unreaped. This prevents the old session number from being reassigned before cleanup.

The final proof at [run-minimal63-r2.py:372](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:372) through [run-minimal63-r2.py:390](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:390) still relies on two sequential directory scans. A scan of `/proc` is not an atomic session-membership snapshot. A live member can fork after its directory was passed and exit before the wrapper inspects it. Its new child remains in the same session but may not appear in that scan. A descendant can repeat the handoff during the second scan. The empty `survivors` list therefore does not prove the comment that no live parent can fork, and `wait()` can occur while an unregistered descendant survives.

The exact cleanup claim needs a kernel-backed ownership boundary with an authoritative empty state. A dedicated cgroup, `cgroup.kill`, and `cgroup.events` `populated=0` would provide that property. A fixed number of `/proc` scans cannot.

### High: failed launch authentication can leave a live process outside cleanup custody

`start()` stores a successful `Popen` object in `self.children` at [run-minimal63-r2.py:311](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:311) through [run-minimal63-r2.py:317](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:317). It waits up to two seconds for matching argv and cwd, checks the new session, and only then writes `self.roots[label]` at [run-minimal63-r2.py:327](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:327).

If the identity or session check fails while the process remains live, final cleanup calls `stop_family()`, which rejects the family because it has no authenticated root at [run-minimal63-r2.py:343](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:343) through [run-minimal63-r2.py:347](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:347). The wrapper records a cleanup failure but has no pidfd resource or full identity receipt for the process it launched. `manager.finish()` then closes the handles it does have and the wrapper can exit while that process continues.

The wrapper needs custody of every successful `Popen`, including the interval before full admission. If it cannot safely signal a process whose exact executable, cwd and argv never authenticate, it must retain a concrete manual-custody record and stop the run without abandoning the live child. A kernel-backed launch boundary established before the child runs would solve both this case and the final-membership problem.

### Medium: the two MiB native-audit output bound misses final writes

The new audit size check runs only inside `while not manager.exited('native-audit')` at [run-minimal63-r2.py:597](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:597) through [run-minimal63-r2.py:606](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:606). If the auditor writes a final chunk that crosses the limit and exits before the next loop body, the check does not run again. `stop_family()` then appends its closure event, and the wrapper renames the logs and adds `driver-result.json` at [run-minimal63-r2.py:607](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:607) through [run-minimal63-r2.py:623](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:623). A zero exit code can therefore produce a PASS directory larger than two MiB.

Check the complete retained output after child closure and before PASS. Either reserve space for the closure event and final result or define which files the limit covers and check that set after all writes.

### Medium: the README still points to the R1 packet

R2 preserves the old driver, collector and assignment specimens and adds new files. README.md still says the frozen R6 collector is authoritative at [README.md:5](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/README.md:5), and it tells root to use `capture-assignment.pending.json` and `audit-assignment.pending.json` at [README.md:21](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/README.md:21). Those specimens bind R1 and R6. The current specimens are `capture-assignment-r2.pending.json` and `audit-assignment-r2.pending.json`, which bind R2 and R7.

Name the R2 files as the current entry points and mark R1 historical. A current manifest containing the four candidate hashes would remove the ambiguity.

### Blocking prerequisite: browser close and child-session semantics remain unproved

R2 adds `reviewedNativeChildrenRemainOwnedSession` beside `reviewedCdpDisconnectHasNoNativeSignals` at [run-minimal63-r2.py:226](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:226) through [run-minimal63-r2.py:238](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:238). Both are receipt booleans. The R2 pending browser binding and dependency inventory remain null, so this review had no dependency bytes from which to verify either claim.

Root must bind and inspect the exact Playwright and Chromium inputs. The review must prove that `browser.close()` on the `connectOverCDP()` object only disconnects, and that the admitted Chromium arguments keep every native child in the original wrapper-owned session.

## R1 corrections that pass statically

R2 keeps the direct child unreaped and checks its start ticks and session on every refresh at [run-minimal63-r2.py:268](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:268) through [run-minimal63-r2.py:309](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:309). This fixes the R1 path that could reuse a dead direct child's PID as an unrelated session ID. Descendant admission no longer uses PPID.

The collector assignment now requires its complete `heavySlot` object to contain the wrapper's admitted slot token at [run-minimal63-r2.py:518](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:518) through [run-minimal63-r2.py:523](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:523). Collector R7 replaces the absolute catch-up deadline with one second after the preceding SELECT completes at [collect-launched-waves-r7.py:267](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/passive-collector-r2/collect-launched-waves-r7.py:267) through [collect-launched-waves-r7.py:270](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/passive-collector-r2/collect-launched-waves-r7.py:270). The 300-second lifetime, 300-query maximum, four-record/wave maximum and 8 MiB complete-output limit remain unchanged.

The registered signal path still compares PID, start ticks, executable, cwd and argv, calls the PID 1063/start 874/port 4173 protection check immediately before the signal, rechecks the target, and sends through its pidfd at [run-minimal63-r2.py:333](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:333) through [run-minimal63-r2.py:341](/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1/driver/run-minimal63-r2.py:341). Fresh ports, source/tested 4.0.2/build/dependency binding, first-failure retention, no retry, and the one-shot post-seal audit remain in place.

The unchanged public R3 and native R6 candidates still require both human source owners and targets belonging to both AI owners in the same authenticated selected wave. No public result claims feature qualification before the closed native audit.

## Review limits

This review was static. It did not run packet scripts, Node, tests, builds, browsers, servers, SQLite, simulations, or signals. The runtime exposed the Codex harness and GPT-6 model name; no independent evidence authenticated the model provider.
