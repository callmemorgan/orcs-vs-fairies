# Canonical scenario binding checkpoint

The source checkpoint follows root `5645300`, with SAVE_VERSION 3 and simulation revision 3.2.0. Source hashes identify the five changed files. This is a focused root integration proof. Campaign exact-definition admission, authored mission solutions, main-game mounts, legacy journal policy and SAVE4 remain open. No additional features are counted verified here.

Canonical `issueCommand` enforces scenario restrictions before mutation, accounts accepted external commands once and notifies history afterward. Scripted commands run without external accounting or generic history entries. Canonical `stepGame` evaluates scripted state after ordinary simulation, with immediate ability hit resolution, before notifying replay observers. Generic saves preserve the binding and runtime; replay can reconstruct scripted effects and seek from tick 600.

Boss strikes now use the central combat and death path. The regression exercises a recruited commander with an equipped artifact and checks death animation, recovery cooldown, artifact drop, corpse creation, one scenario casualty and one replay-analysis loss. Final replay state equals the actual played state.

Reproduction:

```sh
npx vitest run tests/scenario-core-binding.test.ts tests/scenarios.test.ts tests/campaign.test.ts tests/conquest.test.ts tests/conquest-ui.test.ts tests/modes-combined.test.ts tests/specialist-bridge-expiry.test.ts tests/saves.test.ts
npm run build
npx tsc --noEmit
```

`scenario-bound-tests-6.log` records 127 passing tests in eight files. `scenario-bound-build-4.log` records the successful final type check and production build. Earlier passing runs remain recorded separately.

Independent review found two additional integration defects. Scenario observer exceptions could escape after command mutation but before generic history notification. Each observer now receives isolated exception reporting; the regression proves both generic and scenario journals retain accepted input and reproduce identical saves. The generic JSON copier's 128-key limit also rejected admitted 129-actor missions once their binding entered the save. Its dictionary budget now matches the 100,000-element array budget, retaining the two-million-node, 16-MiB and depth limits. Per-schema validation still rejects excess counters; the regression checks 129 labels/counters save and replay while 2,049 variables reject.

Prior attempts remain alongside the passing logs. `scenario-bound-tests.log` records the earlier 72-test binding run. `scenario-bound-tests-2.log` and `scenario-bound-build.log` retain test-author failures from using nonexistent MatchRecorder.archive and an invalid single-phase boss fixture. `scenario-bound-tests-3.log` retains the incorrect null assertion for a dropped artifact; the API deletes the holder field. That command also named nonexistent tests/scenario-campaign.test.ts and selected only two actual files. The final command uses tests/campaign.test.ts and the seven-file scope above.

The appended decision trail records the imported scenario chain separately from this root proof. Specialist/modes legacy replay projection failures are still reserved for the final migration.
