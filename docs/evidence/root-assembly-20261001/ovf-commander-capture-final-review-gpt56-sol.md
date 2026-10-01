# Commander ownership admission review

Reviewed by GPT-5.6 Sol.

Verdict: accept `745aa09450b664fc37a8cb03b34ae42bd3f22de9` plus follow-up `f17acf8996c31c5dfe215421e11c4b68ced015a0` over base `af44da406acf7ab44436e978cb1f571b93e28d23`. I found no correctness defect in the final chain. The root should import both commits in order, or an equivalent cumulative patch, and run the final combined suite at the assembled root.

## Scope and pinned diff

The review used the frozen cumulative diffs `/tmp/ovf-commander-final-review.diff` and `/tmp/ovf-commander-final-review-context.diff`. The range adds `src/core/commander-rules.ts`, changes `src/core/specialist-systems.ts` and `src/core/tactics.ts`, adds `tests/commander-capture.test.ts`, and adds two complete SAVE4 checkpoints plus their provenance record. `git diff --check af44da4...f17acf8` passes.

Commit `745aa09` adds the shared admission helper and uses it for recruitment and surrender. The helper counts living real heroes, heroes in every living production queue, and every unexpired recovery entry (`src/core/commander-rules.ts:5-12`). `commanderDied` now records recovery only when the dead hero definition is recruitable by its current owner, so a foreign captured commander releases the recipient's slot while a same-faction captured commander keeps the existing 30-second recovery (`src/core/specialist-systems.ts:39-43`). The surrender transfer checks the selected recipient immediately before ownership changes (`src/core/tactics.ts:153-158`).

Commit `f17acf8` extends the same rule to siege capture. A foreign hero-tagged siege engine requires an empty recipient slot when the command begins, and `updateSiegeCapture` calls the same predicate every tick, so a commander queued during the channel cancels it (`src/core/tactics.ts:62-64,169-171`). Re-crewing an engine already owned by the captor bypasses the ownership-transfer check. The follow-up adds living, queued, recovering, queued-during-channel, empty-slot, and same-owner cases (`tests/commander-capture.test.ts:96-120`).

## Fixture provenance

The medium and large fixtures are complete native SAVE4 envelopes from ordinary AI matches at `af44da4`. Their committed SHA-256 values are `fe1b5bfe8ccc71ef9a1a899c8888884c9050f368f51ec8d133a592babc5a2b5c` and `1594b64b169ec15c8c7c704291c205f3e86d8985efa01e957f06aa8c4c453c85`, matching both `tests/fixtures/commander-surrender-provenance.json` and the retained `preceding-valid.save.json` files.

I audited the retained runs under `work/commander-diagnosis/natural-medium-af44da4-r2` and `natural-large-af44da4-r1`. Each has equal before/after manifests, 40 archived executed TypeScript inputs, and every archived core input equals its Git blob at `af44da4`. The raw invalid envelope hashes also match the provenance record. The medium checkpoint advances from tick 8,795 to the invalid tick 8,796; the large checkpoint advances from tick 12,852 to 12,853. The audit output is `/tmp/ovf-commander-fixture-provenance-audit.log`.

The earlier medium r1 diagnostic is not part of the admitted lineage because its projected `before.tactics` shared a reference. The retained medium r2 run cloned the projection and produced the committed fixture. The native checkpoint and raw invalid envelope were unaffected.

## Independent verification

In a detached checkout at `f17acf8`, the five focused files pass 278 of 278 tests in 5.64 seconds. The log is `/tmp/ovf-commander-f17-independent-278.log`. The 14 commander cases also pass alone in `/tmp/ovf-commander-f17-independent-test.log`. `./node_modules/.bin/tsc --noEmit` exits 0 with no output; the command receipt is `/tmp/ovf-commander-f17-independent-typecheck-receipt.log`.

The owner's stable rerun independently reports the same 278 of 278 result in `work/commander-diagnosis/final-focused-green-r2.log`, SHA-256 `2e78e7804ec307b9e7ce25267cf316b6a714edd05908a90191d843d19bc80c57`. Its five files are `commander-capture`, `specialist-gameplay`, `specialist-saves`, `combat-tactics`, and `faction-save-semantics`. The corresponding TypeScript run exits 0. I did not use `final-focused-green.log`: it overlapped a source swap, and the owner retained and superseded it with the r2 run after restoring and hashing the candidate source.

The red checks establish that the tests exercise the changed behavior. Running the natural checkpoint cases against `af44da4` fails both because the enemy commander transfers into an occupied slot (`/tmp/ovf-commander-af44-natural-red.log`). The owner's wider base run fails seven of eight cases and retains source hashes in `focused-red-source.json`. Running the final 14-case test against `745aa09` fails the four new siege conditions while the other ten pass (`/tmp/ovf-commander-745-with-f17-tests.log`); the owner's matching receipt is `siege-red.log` with source hashes in `siege-red-source.json`.

## Findings (risk)

None.

Ordering: the code adds no asynchronous work or reordered loop. Recruitment, surrender, command admission, and per-tick siege capture read the current commander state at their existing decision point.

Failure paths: the new branches return the existing recruitment reason, leave a surrendering hero under its current owner, reject a siege-capture command, or cancel a running channel by deleting its capture state. Errors from definition lookup still propagate as before; no promise or exception is swallowed.

Observability: no log or telemetry emission changed. A blocked surrender emits neither of the two transfer messages because ownership did not change. Successful transfers keep the existing event order and source identifiers.

Stale writes: surrender checks the slot immediately before transfer. Siege capture checks at command admission and on every channel tick, which prevents a later queue or recovery state from allowing a stale ownership write. `queued-during-channel` is the regression test for this guard.

Test delta: natural medium and large fixtures cover the original AI failure; living, queued, and recovering cases cover surrender; foreign and same-faction death cases cover recovery; the imported ranged hero covers definition-independent admission; five imported siege cases cover command and channel checks; same-owner re-crewing covers the bypass. Every production behavior changed by this chain has a failing predecessor case and a passing final case.

## Remaining gate

This review admits the commander chain itself. It does not replace the new combined full suite, builds, or final frozen runtime proofs after the root imports this chain alongside the 4.0.1 survival correction.
