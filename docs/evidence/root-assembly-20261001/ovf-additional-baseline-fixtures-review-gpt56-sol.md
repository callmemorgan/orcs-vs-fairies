# Additional baseline fixture review

Verdict: no findings. Admit `6567c829817f87271917f10ac58c3e9196b661f1`, then evidence commit `ae4f6128b4b9d982bddbe2a7119cb4da9e1efb60`.

I reviewed this test-only correction with GPT-5.6 Sol against `5c6a02219b723102124f9775040a78b205a52a7d`. The pinned test diff is `/tmp/ovf-additional-baseline-fixtures-review.diff`, and the context diff is `/tmp/ovf-additional-baseline-fixtures-review-context.diff`.

## Commit review

`6567c829817f87271917f10ac58c3e9196b661f1` changes only `tests/hud-health.test.ts`, `tests/allied-ai.test.ts`, and `tests/skirmish-roster.test.ts`.

The HUD fixture now spawns a registered Fairy Veilweaver and casts its public ability. It asserts two Fairy clones with the caster definition, then changes the HUD perspective for the owner check instead of changing the clone's side. The original disguised full and half health, health-bar percentage, group total, tooltip, and unchanged raw-health assertions remain. The added assertions make invalid ownership or definition state fail earlier.

The allied timer fixture now creates the hostile barracks from its registered definition and sets `friendlyFire:false` through match rules for only the two timer cases. It still leaves the emergency active for 25 seconds, destroys the threat with public attack commands, observes a new arrival time after 25 seconds, and requires another 20 seconds for defend or three seconds for attack. It also asserts the assigned defender keeps full health. The eight-case attribution probe shows native spawning is unrelated to the old failure: with friendly fire on, queued allied shells kill the assigned defender; with friendly fire off, both native and prior building fixtures resume at 26.05 seconds and complete after the full required interval.

The 4v4 economy case still executes 400 quarter-second ticks, or 100 simulated seconds, and retains its worker, deposit, training, and bank assertions. Its per-test wall-time allowance rises from 30 to 90 seconds because the same case took about 40 seconds. The markup case now passes a hash-validated imported faction through `setContent`, selects it, checks the literal faction name, and confirms the roster creates no image or script elements. It no longer relies on mutating the immutable built-in registry.

`ae4f6128b4b9d982bddbe2a7119cb4da9e1efb60` adds evidence only. Its manifest pins the baseline and fixture commits, records the five red failures and 120 green tests, lists all corrections, preserves the eight-case attribution probe and reproducer, and states that no full-suite, browser, or CLI proof is claimed. Independent committed-byte verification reports 168 source, test, and configuration hashes, 18 evidence hashes, all 19 evidence blobs, and an empty production `src` diff.

## Behavioral interrogation

Ordering: production execution order is unchanged. The tests still drive the HUD, public ability and attack commands, AI emergency handling, and 100-second economy simulation in the same order. The HUD owner assertion changes only the viewer. The timer setup changes one public match rule before the match starts.

Failure paths: no production branch or error path changed. The revised fixtures fail if native spawning, ability admission, clone identity, viewer-dependent health, timer restart, defender survival, imported-content hashing, faction selection, or markup escaping regresses.

Observability: no production logs or telemetry changed. The fixture adds direct assertions for clone identity and defender health. The evidence retains the exact red and green test names and the attribution output.

Stale writes: the HUD case no longer leaves a Fairy definition on an actor whose side was mutated to Orcs. The markup case no longer mutates an exported built-in object that the pinned registry has already copied. Teardown still destroys mounted rosters and restores DOM and mocks.

Test delta: the baseline checkout at `5c6a022` independently reproduced 115 passes and the same five failures. The pinned evidence tip independently passed all 120 affected tests. The eight attribution variants passed and distinguish friendly-fire behavior from building construction. No production source changed.

## Verification

The independent green run is `/tmp/ovf-additional-baseline-fixtures-120.log`. The detached baseline provenance is `/tmp/ovf-additional-baseline-red-provenance.txt`, and its 115-pass, five-failure run is `/tmp/ovf-additional-baseline-red-rerun.log`. Hash checks are `/tmp/ovf-additional-baseline-source-hashes.log` and `/tmp/ovf-additional-baseline-evidence-hashes.log`. The attribution rerun is `/tmp/ovf-additional-baseline-emergency-reproducer.log`.

`git diff --check` reports trailing blank lines in retained console logs. These are evidence formatting only; source and test hunks are clean.
