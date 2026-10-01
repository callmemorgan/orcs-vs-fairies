Admit source commits `1c8c83789b8944787f34e4348df211335810a6bc`, `bf53358e521c41d4718a99e81bf6239384c60c1e`, and `65839dff2c22a2ad6f88f1607a9e5535ab86754c`, corrected fixture commit `3adb13e88cbad3e35b2804d04c2784440bf62282`, and evidence commit `328f4f84cf18a43c20eaad57a15be934bd81aff7`. I found no remaining narrow defect in the final faction/economy runtime or fixture. Do not import superseded evidence commits `06d955d87fbf48a5b4585ec75fdbfec642df455f` or `70aba48ea65ab873caa248efff922c9057b8fc4d`.

## Review identity and pins

Reviewed by GPT-5.6 Sol.

Base: `115a537dd90d5e26ca04c7003f47310a71e67879`

Runtime source: `65839dff2c22a2ad6f88f1607a9e5535ab86754c`

Corrected fixture: `3adb13e88cbad3e35b2804d04c2784440bf62282`

Final evidence: `328f4f84cf18a43c20eaad57a15be934bd81aff7`

The fixture commit changes two test lines. Production bytes remain identical to `65839df`.

## Per-commit review

### `1c8c837` — Interrupt economy jobs when faction and tactical orders replace them

This commit changes four files, adding 193 lines and removing 14. Faction commands use the canonical interruption path and record paid faction structures (`src/core/faction-systems.ts:27-31, 78-82`; `src/core/simulation.ts:85-87`). The canonical interrupt clears economy jobs, queued orders, tactical modes, paths, and cached navigation before installing the replacement order (`src/core/simulation.ts:192-194, 872`). Surrender, retreat, recovery, and siege transfer call that interrupt before changing ownership or orders (`src/core/tactics.ts:142-171`).

This source fixed the main command paths but was incomplete. Review found grouped cross-level wagon application and historical competing-state gaps; the later source commits correct those cases. Do not import this commit alone.

### `bf53358` — Preserve unrelated wagon jobs and interrupt legacy tactical orders

This commit changes four files, adding 41 lines and removing eight. Grouped corpse commands now apply only to wagons on the target level (`src/core/faction-systems.ts:82`). Runtime cleanup removes stale formations from economy actors before formation refresh, while ambush trigger and capture completion invoke canonical interruption (`src/core/simulation.ts:541-551`; `src/core/tactics.ts:160-171`). The tests add cross-level collect/deliver cases and old formation, ambush, and capture combinations.

This pin was not sufficient by itself. Independent probes found that old tunnel, corpse, and construction orders could still coexist with economy tasks, and that uncrewed siege engines could keep moving. Commit `65839df` fixes those findings.

### `65839df` — Resume later faction orders and stop uncrewed economy activity

This commit changes four files, adding 54 lines and removing 13. It interrupts economy state when a crew dies and normalizes already-saved crewless actors before economy processing (`src/core/simulation.ts:481, 533`). It cancels old economy tasks before advancing a later saved tunnel, corpse, or build order, then restores that later explicit faction state (`src/core/simulation.ts:534-539`). It also resets a stale formation move to hold and invalidates its cached route while retaining the later economy task (`src/core/simulation.ts:541-543`).

Economy admission, task processing, and idle deposit now treat uncrewed engines as inactive (`src/core/economy-cargo.ts:7, 289-300`). The tests cover strict save/replay continuation for the historical faction combinations, hold and move variants of stale formation, real crew defeat, old crewless states with and without a task, unchanged banks, and visible-target command rejection (`tests/faction-economy-interruption.test.ts:126-180, 203-220`). The tunnel/capture fixture requires crew defeat to clear the tunnel and preserve the fitted engine through capture (`tests/faction-save-semantics.test.ts:401-417`).

### `3adb13e` — Keep legacy faction fixtures canonical on both source versions

This test-only commit replaces any task already present for the actor before restoring `oldTask`, then asserts that the actor has one task equal to `oldTask` immediately before recording and stepping (`tests/faction-economy-interruption.test.ts:134, 143`). This makes the fixture valid on both fixed and pre-fix source.

The baseline log proves causality. Tunnel, corpse collection, and corpse delivery pass the one-task assertion and recording admission, then fail because the route remains. Faction construction passes admission, then fails because the planting site remains active. No duplicate-task validation failure appears.

### `328f4f8` — Record canonical legacy faction fixture comparison

This evidence-only commit adds nine files under `docs/evidence/faction-economy-fixture-correction-20261001`. Its README withdraws `70aba48`, names fixture `3adb13e`, runtime source `65839df`, and baseline `115a537`, and states the remaining integration limits.

All eight artifact hashes verify. The supplied verifier reports 318 source, test, and configuration hashes, 397 built-artifact hashes, and 161 pinned production Git bytes with zero mismatches. The bundle records 32/32 focused tests, 391/391 tests across 16 files, a passing TypeScript/client build, and 29 baseline failures with three expected rejection passes.

## Findings (risk)

Ordering: no serial operation became concurrent. New cleanup runs before faction and economy advancement. Crew defeat interrupts during hit resolution. Surrender and capture interrupt before ownership changes. Ambush interruption restores the ambush record before installing attack. Tests at `tests/faction-economy-interruption.test.ts:126-180, 197-220` exercise these order-sensitive paths.

Failure paths: there are no new promises or thrown error paths. Invalid faction and economy commands still return before mutation. The crewless admission branch rejects the command without changing the save, tested at `tests/faction-economy-interruption.test.ts:176-180`.

Observability: no log or telemetry type changed. Existing message events remain after their state transitions and retain side, location, source, and target fields. Crew cleanup precedes the crew-defeat message; ownership cleanup precedes the capture message.

Stale writes: canonical interruption removes tasks, queues, paths, entrenchment, route cache, and competing tactical or faction state. Legacy cleanup restores only the later explicit tunnel, corpse, or build action. Stale formation movement resets to hold and drops cached navigation. Grouped out-of-level wagons retain entity state, task, cargo, and route. Tests at `tests/faction-economy-interruption.test.ts:115-148, 203-220` cover these guards.

Test delta: every changed behavior has a regression. The 32 focused cases include successful and rejected commands, grouped selection, old-save combinations, automatic transitions, crew defeat, cargo retention, replay continuation, and one-time salvage. The corrected fixture now proves its baseline failures reach the behavior assertions.

## Independent verification

The corrected tip `328f4f8` passed 32/32 focused tests and 391/391 across the 16 surrounding files:

- `/tmp/ovf-faction-economy-328f4f8-focused.log`
- `/tmp/ovf-faction-economy-328f4f8-surrounding.log`

TypeScript passed at runtime source `65839df`: `/tmp/ovf-faction-economy-65839df-tsc.log`.

Three independent strict-save probes passed after failing on `bf53358`:

- Tunnel and corpse channels cancel the old raid and advance: `/tmp/ovf-faction-legacy-faction-economy-final-probe.log`.
- Faction construction cancels planting and reaches 0.1142857 progress: `/tmp/ovf-faction-legacy-build-economy-final-probe.log`.
- An uncrewed loaded engine keeps the same coordinates and loses its route: `/tmp/ovf-uncrewed-economy-movement-final-probe.log`.

The final evidence verifier independently passed all four manifest classes. A first parallel surrounding run had one timeout in an unchanged stress test, which passed 7/7 alone. A later run completed while HEAD advanced, so I discarded it. Stable pinned runs supply the admitted results.

The cross-family review found that the evidence bundle's baseline log did not record its checkout commit or copied fixture hash. I repeated that run in a detached checkout at `115a537` with the test blob from `3adb13e`. Git blob `35d25aabf43236f736ba407f2b6bc56ea350d52d` matched on both sides, and the run produced 29 failures with three expected rejection passes. The provenance record is `/tmp/ovf-faction-economy-corrected-baseline-provenance.txt`; the full output is `/tmp/ovf-faction-economy-corrected-baseline-rerun.log`.

## Integration limits

This is isolated proof over `115a537`. Root still needs combined SAVE4 validation, the simulation-revision bump required by replay-visible behavior changes, the complete suite, production builds, browser verification, and the 108-match ladder. The historical fixtures author reachable old combinations through current constructors and strict load; they are not archived release files.

## Attention

reviewed by GPT-6 Luna

The reviewer found that the committed baseline evidence did not independently bind its checkout and fixture, and that the withdrawal row cited an owner finding rather than a file. The detached rerun above resolves the first gap. The corrected README and the withdrawn baseline log resolve the second; the decision trail now points to both.
