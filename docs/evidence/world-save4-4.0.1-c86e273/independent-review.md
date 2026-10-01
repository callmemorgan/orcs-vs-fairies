# Independent review of the fresh world archive

Verdict: admit `world-save4-final-4.0.1-c86e273` as passing evidence at source `c86e273c70738f144a00fe75f5ecf39e7fa324d8`. I found no artifact, provenance, native-state, browser-result, cleanup, or visual-integrity defect. The recorded screenshot limits remain part of the admission.

## Provenance and archive integrity

The archived source is SAVE4 with simulation revision `4.0.1` and content engine version 3. Its source digest is `f8412883e1d8c3f6fa47f74c8c7bf608fa472cabe05503bab51ffd13d1101af5`; its build ID is `af4b40282bb086e0dccf5aad4e8c38819b2d2eb80370fb749e728a9f33cdb87a`. The preparation receipt SHA-256 is `70e6dd3d283e07eb26549ac7df1c2bf441785bff526668099bfc0c056df347c0`. The retained frozen-pin wrapper hashes to `8ef9ca35d73f8fdda36b899898e2ef3c0cbf870f958a56c225c895a06563a87c`.

I reran the retained read-only audit against the immutable owner worktree. It matched all 602 source inputs to Git by mode, blob, byte count, and SHA-256; recomputed the source digest and build ID; matched the four archived build trees to their manifests and the worktree outputs; and verified 709 declared artifact hashes with no missing file or mismatch. The archive currently has 724 files. The 15 files outside the run manifest are the manifest files themselves and the later audit script, receipts, wrapper, and contact sheets; the machine-readable audit names each one.

The rerun audit is `/tmp/ovf-world-c86e273-independent-audit.json`, SHA-256 `7fe6c91687d1e023bd67d2347e955421d40b0c6eb1514563664c02ce72caa019`. The admission audit is `/tmp/ovf-world-c86e273-admission-audit-gpt56-sol.json`.

## Runtime evidence

All 57 recorded recipe steps have result `passed` and exit code 0. The browser result groups have no recorded errors and contain 12 world checks, 17 world-action checks, 13 mod checks, 17 map-editor checks, nine flat-scenario checks, eight layered-scenario checks, 14 community-map checks, and 11 community-mod checks.

All 35 native reports pass complete-envelope decoding and resaving, complete replay-envelope verification, 20 identical continuation steps and ticks, and an extended replay-envelope verification. Their continued tick is the saved final tick plus 20. The inputs cover fixtures, CLI resume, four generated worlds, world actions, mod save and replay, map and scenario play, four community-map replay positions and completion, community-mod play, and all eight bug-report sessions.

All 38 launcher bindings pass and bind the source pin, source digest, preparation receipt, module manifest, compiler settings, fresh inputs, prepared bundle hash, private executed-bundle hash, and exit code. Each private rebuild directory is absent after execution.

Cleanup passes. The preview PID is absent; ports 5183, 35123, and 41683 have no listener and accept a direct bind; no world helper, community backend directory, or private rebuild directory remains. The recipe did not touch protected port 4173.

## Visual inspection

I inspected the eight original-resolution contact sheets containing all 30 feature screenshots. The captures agree with the retained visual receipt. The biome pairs show the named surface and `Contested caverns` views, world actions show the repaired bridge, relic and neutral services, and thaw rescue, and the editor/community captures show authored maps and scenarios, replayed pinned revisions, custom units and art, and victory overlays.

The cavern and edited-map play captures show mostly fog and a small explored area. They prove the selected level and transition notice, while the browser assertions, native exports, and continuation reports prove the authored geometry and state. `flat/scenario-failure.png` was taken before the defeat overlay; `flat/result.json` proves the protected-convoy runtime loss. Neither image should be cited alone for the stronger behavior.

## Feature recommendation

This archive directly supports IDs 41 and 44 through 50, plus 94 through 97. ID 42 has direct production evidence for the day-to-dusk transition, but its visibility and unit-usefulness modifiers still require the parent-owned focused behavior tests. IDs 3 and 43 also require the parent tests for their full attack, vision, movement, sight, and projectile effects.

The native saves, replay equality, continuation, and bug-report sessions support IDs 90, 91, and 100 within the broader parent acceptance. The archive alone should not replace the parent tests for autosaves, replay controls and perspectives, or the complete bug-report attachment behavior.

## Findings

None. The capture limits above restrict how two screenshots may be described; they do not contradict the runtime and native evidence.

## Scope

I kept the owner worktree read-only. I reran only the retained read-only audit and inspected existing JSON, hashes, bindings, reports, cleanup state, and contact sheets. I did not build, simulate, start a browser or server, or rerun any feature phase.
