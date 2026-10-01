# Final modes acceptance recipe

This plan was prepared read-only against provisional root `e82b04292bb77c2cde4852bccbff766ab4b397a6`. Root must supply the final source pin after the full suite and release CPU before either preparation or execution. No dependency installation, build, simulation, browser or server operation occurred while preparing this plan. The old `af44da4` failure and narrow red/green evidence remain unchanged.

The admitted `scripts/modes/prepare.mjs` and `run.mjs` still apply to the combined survival and commander repairs under SAVE4/rules 4.0.1. Historical SAVE4 rules remain 4.0.0. The source pin must be a full 40-character commit, and all runtime/build inputs must come from a fresh detached checkout at that pin. Each dependency installation and output root is independent. Do not reuse the old build, prepared root, raw recovery input or narrow checkpoint run as complete acceptance evidence.

The isolated cancellation probe passed under root's separate lightweight CPU release. Exact reviewed source, command/environment, logs, exits, cleanup and direct postflight liveness checks are retained in `/tmp/ovf-modes-cancellation-dispatch.o9zzidsu`; raw fixture output is `/tmp/ovf-modes-cancellation-probe.5tb4bpp7`. Its four cases returned 130/143/143/0 in 10.46 seconds. The resistant leader/grandchild required KILL after 10.07 seconds, and the natural descendant exited/reaped without a signal. All six PIDs and four groups were absent at postflight. Heavy preparation/execution remains held.

The probe command below is retained for reproduction. Reuse the passing result for these unchanged controller bytes; repeat only if they change or an unresolved concern requires it:

```sh
OVF_MODES_CPU_RELEASE=1 python3 /tmp/ovf-modes-final-acceptance-plan.c0rsxvtx/cancellation-probe-after-release.py
```

The probe extracts the controller's functions and exercises INT before construction, TERM after process-group creation but before caller registration, a TERM-resistant leader/grandchild pair, and a naturally exiting descendant. It requires 130/143 where applicable, KILL escalation after 10 seconds, group removal, descendant reaping and a successful natural drain. Its fixtures only sleep; it does not invoke the preparation entry point, Git, npm, builds or gameplay. Allow 15–30 seconds. Preserve its fresh output. The probe does not test terminal-receipt finalization; that completion point received independent source review.

After root supplies the final pin and releases heavy CPU, run preparation once:

```sh
OVF_MODES_CPU_RELEASE=1 bash /tmp/ovf-modes-final-acceptance-plan.c0rsxvtx/prepare-after-release.sh "$OVF_FINAL_SAVE4_PIN"
```

The helper emits a receipt with the new frozen checkout, fresh prepared root and launch directory. Its commands are commit validation, `git worktree add --detach`, independent `npm ci`, then `node scripts/modes/prepare.mjs FULL_PIN FRESH_ROOT`. Bash replaces itself with a Python controller. Each stage uses `Popen(start_new_session=True)` so its process group exists before registration returns. Signal handlers record cancellation without exiting during launch or registration. The controller sends TERM, escalates after 10 seconds, allows 10 seconds for KILL/reaping, and verifies that the group is gone; incomplete cleanup returns 125. Linux subreaper adoption lets it reap orphaned descendants. A completed leader gets up to one second for children to finish after EOF; a stage fails if descendants remain after that grace. Cancellation skips the grace. The receipt contains stage commands, working directories, PIDs/groups, wall times, exit codes and cleanup results. Cancellation returns 130 for INT or 143 for TERM and preserves partial files and logs.

After group cleanup, the controller blocks INT/TERM and takes a cancellation snapshot before writing its terminal receipt. That snapshot is the completion point. Signals received later remain blocked until exit, so the receipt and exit status agree.

Preparation rebuilds the pinned schema/native/runtime modules, typechecks, builds the ordinary production Vite app and canonical server, and records the external `ws` dependency link. Logs and receipts remain outside the initially empty prepared root. Preparation does not run gameplay or start a server/browser. Its entry point remains unexecuted; the completed probe exercised only its controller functions with dummy fixtures.

When root releases CPU for the acceptance run, pass those receipt paths verbatim:

```sh
OVF_MODES_CPU_RELEASE=1 bash /tmp/ovf-modes-final-acceptance-plan.c0rsxvtx/run-once-after-release.sh "$OVF_FINAL_SAVE4_PIN" "$OVF_MODES_FINAL_CHECKOUT" "$OVF_MODES_FINAL_OUTPUT" 9241
```

The helper launches exactly `node scripts/modes/run.mjs FULL_PIN PREPARED_ROOT 9241` with `OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`. The selected installed package is Playwright 1.62.1. Port 9241 was free when planning; both the helper and admitted launcher recheck it. The wrapper replaces itself with Node so cancellation reaches the launcher's existing active-child/browser/server cleanup. Root should run this as a yielding command, poll its actual session/logs, and preserve any failed or interrupted output. A retry needs a new prepared root.

Execution is serial: five natural matches, owned canonical server startup, one main-browser driver with three fresh profiles, native verification of both real browser exports, owned server shutdown, then final source/build/artifact checks and inventory. Native matches keep the existing seeds, rosters, rules and tick limits:

| Case | Roster/controllers | Rules beyond defaults | Limit |
| --- | --- | --- | --- |
| hill-duel | Orc AI vs Fairy AI | Age 3, resources 1400/1000/500, capture 40 ticks, hold 400 | 20,000 ticks |
| relic-duel | Orc AI vs Fairy external | Age 3, 3 relics, require 2, hold 400 | 20,000 ticks |
| relic-contested | Orc AI vs Fairy AI | Age 3, resources 1400/1000/500, 3 relics, require 2, hold 400 | 20,000 ticks |
| hill-2v2 | Orc/Fairy AI team 0 vs Orc/Fairy AI team 1 | Age 3, resources 1400/1000/500, capture 40, hold 400 | 20,000 ticks |
| survival-five-waves | Automata AI defender vs Orc external | Age 3, resources 2400/1800/600, 5 waves, initial interval 2400, recovery 300, base wave size 1 | 40,000 ticks |

Every case uses seed 4127, small map and ordinary .05-second steps. Require all four launcher steps to pass, all five runtime results, a complete tick-300 recovery for every case, positive compared ticks and advancing saved segments, equal continued histories, complete raw-save/session roundtrips, full replay/analysis/technology equality, and an endpoint seek using the separate fresh player. Survival must win for team 0 at wave 5 with four recovery save/session pairs and five resume ticks. Hill/relic must retain a living opposing HQ.

The browser driver uses the main app. It checks Lantern rules/starter/draft, objective-modal input blocking while ticks advance, minimap/Phaser movement, hill marker/HUD, replay export/import, photo launcher hiding, two real online guests, both lobby picks and accepted relic collect/drop receipts. It downloads `local-custom-hill.session.json`, `local-build-report.json`, `local-build-report.session.json` and `local-custom-hill.replay.json`. Accept `browser/browser-proof.json` and `browser/manifest.json`; the historical `browser/results.json` name is obsolete. Inspect all six PNGs: `local-custom-draft`, `local-hill-marker`, `hosted-relic-lobby`, `hosted-relic-collected`, `hosted-relic-marker`, `guest-relic-objectives`.

Both native outputs must pass: `native/local-custom-hill.session.verification.json` and `native/local-build-report.session.verification.json`. Each compares the complete loaded game/replay endpoint and analysis/technology values, then six accepted hold/stop/move/queued-move/hold/stop commands and 100 normal ticks with equal complete envelopes and recorder histories. The recorded movement must displace the actor. Finished natural-match sessions cannot substitute for these browser exports because the continuation needs an unfinished match with a completed draft.

After the launcher exits, run the read-only structural/hash audit and keep its output outside the inventoried proof root:

```sh
python3 /tmp/ovf-modes-final-acceptance-plan.c0rsxvtx/verify-results.py "$OVF_MODES_FINAL_OUTPUT" "$OVF_FINAL_SAVE4_PIN" > "$OVF_MODES_FINAL_OUTPUT-postflight.json"
```

Require browser closure, no browser/finalization/cleanup errors, owned server alive before planned shutdown, clean exit 0, closed listener, unchanged source/scripts/verifier modules/dist bytes, and the complete final manifest/TSV. Those two files exclude themselves, so the postflight receipt records their own hashes. Keep dependency/install logs, preparation/build logs, per-step logs, server PID/path/hash, verifier input metadata, native files, screenshots and server data. Full installed dependencies and the machine environment are outside the source pin. The browser run proves presentation and authoritative command handling; natural core matches prove the five victories.

Reserve 15–20 minutes after CPU release for the complete run and artifact review. Preparation should take roughly 1–2 minutes; the previous dependency install took 1 second and Vite build 2.81 seconds, but pinned bundling/source checks and typecheck add work. Allow 3–10 minutes for native matches/replays, 1–3 minutes for the browser flow, and 1–2 minutes for native continuations/hash audit/screenshot inspection. These are scheduling estimates, not a promise: the previous natural-match stage took 7 minutes 45 seconds before survival reached its 40,000-tick failure. Do not shorten limits or alter fixtures to meet the reservation.

The independent `save_compat` read-only recipe audit confirmed stage order, output names, checkpoint obligations and fresh-player seeking at the provisional pin. It found two Bash cancellation startup races, prompting the Python controller above. A second independent review found no remaining controller/probe defect after correcting the natural-drain, terminal-receipt and probe fallback/readiness cases. Dummy runtime cancellation verification passed. Final gameplay certification requires successful execution and inspection at root's final pin.

The durable independent final review is `/tmp/ovf-modes-independent-static-review.Wvl8c4gN/review.json` with adjacent `review.md`. It separates source review from retained runtime evidence. A separate read-only exact-status receipt at `/tmp/ovf-modes-exact-leader-postflight.ebp_oftv/postflight.json` requires leader exit codes -15/-15/-9/0 and cancellation statuses 130/143/143/0 from the original report. This adds the stricter value check recommended for a future harness revision while preserving the accepted/executed source and original receipts.
