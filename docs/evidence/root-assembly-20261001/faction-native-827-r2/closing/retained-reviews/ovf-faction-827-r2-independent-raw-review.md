# Independent retained r2 failure and cleanup review

Codex / GPT-6; finer model variant not exposed. This review used saved source, receipts, raw logs and retained download bytes. It did not execute the application, import application or orchestration modules, use ReplayPlayer, start services, run tests/builds/browser/simulation, or rehash installed packages or protected root trees. It wrote only this separate report and its data-only facts file in /tmp. Original evidence, source, root and log bytes were preserved.

The browser failed. Original feature IDs 21–30 remain pending. This attempt receives no native-history credit or late asset completion credit. The retained evidence is internally consistent with a terminal phase 07 failure followed by scoped cleanup; cleanup success does not establish feature acceptance. Screenshot inspection and causal source diagnosis are separate work.

## Authenticated execution and original failure

The current execution-plan.json hash remains `53feafc6b5d9bee15dd2c20ae0b85e2485410b5e8e88666ee49e9b45f8469893`. Both contemporaneously saved scripts match start.receipt.json: runtime-support.py is `7d0d491f6b4dc74fa23462cf3b241e47788170ecabbbe39f15b0dbb6f56f6618`; phase-runner.py is `abcaccac5d29e35390bcf9b29deb9acc1c0a22abbb4f14b904af0c64c4f323c9`. The fresh preflight hash also matches the start receipt.

Actual phase 01–07 receipt arguments, commands, cwd, pin, unit, bounds and log paths equal the authenticated plan. Each retained stdout/stderr fingerprint equals its receipt hash. Every phase records clean source at execution pin `827496b06bb660b6639257e5113ac2f199be29ba` afterward and retryPerformed=false. Active caps are unchanged: 600, 600, 300, 300, 600, 600, 3600 seconds for phases 01–07. All phases retain 30-second startup, 10-second stop grace and KillMode=control-group. Phase 08's three planned log/receipt paths are absent.

| Phase | Recorded exit | Observation |
| --- | ---: | --- |
| 01 focused tests | 0 | Raw log reports 21 test files and 367 tests passed. |
| 02 client build | 0 | Original admitted build command completed. |
| 03 CLI build | 0 | Original admitted CLI build command completed. |
| 04 helpers | 0 | Original admitted helper command completed. |
| 05 fixtures | 0 | Original admitted fixture command completed. |
| 06 freeze | 0 | Original admitted freeze command completed. |
| 07 faction browser | 1 | Strict Fury equality failure; 62.020189 seconds observed wall time. |

The unmodified raw phase 07 stderr and browser failure message both identify faction-powers.mjs:41:71, expected `49.97288`, actual `52.09508`, operator strictEqual. The authenticated source expression is `assert.equal(s.factionSystems.fury[0],beforeAssault.factionSystems.fury[0]-25)`. This is a Fury assertion, not an HP assertion. The retained browser lastState has tick 606, time 30.300000000000296, paused=true, and side-zero Fury 52.09508. No assertion was relaxed and no later paid-Assault checkpoint is retained.

## Browser evidence and partial limits

browser-native-acceptance.json is completed=false, selectedGroups=["factions"], with eight recorded checks and no completed group result. The checks contain the initial native import, the insufficient-Fury disabled chant observation, and native round-trip/replay-endpoint records for earned Fury, baseline hit and before Assault. They are preserved partial observations; they do not complete feature 21 or the original 21–30 scope. Empty errors and assetFailures lists do not override the terminal failure record.

All 16 recorded download files are regular retained files. Their actual byte counts and SHA-256 values match the browser receipt; 6,368,874 download bytes were read. At each of the three retained checkpoints, the exported save, corresponding reimport and replay endpoint save have identical full-file fingerprints. This checks retained bytes without independently running replay semantics. The separate facts file records every measured fingerprint.

The first-failure PNG is preserved as a regular 359,747-byte file, SHA-256 `cc79ee7ce1262127569594943ba5e794838b853a7376bc9638a7dd3a606a2fe8`. Its visual interpretation is outside this review. The first-failure receipt retains the original message and readable lastState.

The preview receipt has readiness=true and exit 0, the original preview argv and 4500-second active cap, and HTML hash equal to the built index. The previously reported preview HTML-mismatch receipt gap did not occur. Browser early HTML, executable and stylesheet fingerprints equal the saved built inventory. The terminal failure occurred before browser final acceptance/freeze checks and phase 08; these early matches receive no late asset completion credit.

## Complete inventory and scoped cleanup

complete-built-assets.json records 401 actual dist entries, including 398 regular files and all 394 public inputs, with no dist symlinks. Every recorded public copy matches its authenticated preflight bytes/hash. Cleanup's saved complete dist map equals the built map entry-for-entry. This is the complete actual dist orchestration record; native-freeze's HTML/JS/CSS-only dist rows remain a separate original proof boundary.

The saved protected baseline contains 8,852 installed-dependency entries and 400 root dist entries. Its retained maps and protected PID identity were compared with r1 during the preceding static review. The final cleanup receipt records these same counts, unchanged full-baseline comparisons, unchanged PID 1063 identity, 615 verified owned inputs, clean owned source, and no private dependency directory. Its source hash matches the preserved runtime-support.py. The support source compares complete dependency/root-dist maps and protected PID identity before saving success. This independent review authenticated that mechanism and receipt; it did not independently rehash those large live trees.

Cleanup acts only on the nine admitted r2 units and the owned private node_modules directory. It archives package links without following them and removes only that owned directory. The 2,086-byte archive matches the receipt fingerprint. Package symlinks do not provide read-only enforcement; the complete before/after protection comparisons are the retained package-write check. Root source/index/ledger checks remain outside this helper's scope.

The saved cleanup port output contains root port 4173 under PID 1063 and no owned port 5298. The preview stop has exit 0. No active owned runtime is recorded.

## Exact cgroup and process drain

The separate contemporaneous observer source hash is `fe3e07406c258fd2af1a44034b38f0afb06970867b47aa0a335a9393c5c2840b`, matching both before and after receipts. It checks cgroup.procs recursively and scans OWN/OUT/cgroup-associated processes without an executable-name restriction. Only its current PID and recorded ancestor chain are excluded.

Before cleanup, it captured preview Node PID 1513471 and esbuild PID 1513480 in the exact preview cgroup. At `2026-10-01T23:58:54.315467+00:00`, after cleanup, all nine admitted units were inactive with MainPID=0, all nine recorded cgroup paths were absent, membership was empty, and no non-observer associated process remained. The before snapshot SHA-256 is `632f866e1f95c5ca6247ec5494ed7cc52b21a1c4bb88425eae74ee771e7c29a1`; the after snapshot SHA-256 is `1eaed2ec06429f4a456e33e3fbc3030c87015e85bc84559777a74edc9b0c38ad`. These saved observations close the earlier executable-name scan limitation for this cleanup snapshot.

No discrepancy was found in the retained byte, argument, receipt or cleanup observations. Browser failure remains the outcome. Original IDs 21–30 remain pending, with no history or late asset completion credit.

Data-only measured facts: `/tmp/ovf-faction-827-r2-independent-raw-review.facts.json`, 16,673 bytes, SHA-256 `ac6776d987d0297dd17716b117102950d699f49031683c135aacf828d81504eb`.
