The 16 baseline failures reproduced at production source `115a537dd90d5e26ca04c7003f47310a71e67879` are corrected by fixture commit `7c66a7c1497b3bdda9080c37c79c01e9613b2fef`. The additional real surrender-before-impact regression is `5e7a606aff7a4fd27f6d36fcff9a9c38c25b5166`. Neither commit changes production source, SAVE3 or rules 3.2.0. `source-sha256.txt` identifies 169 source and affected test files at the final test commit.

The initial six-file run has 185 passing and 16 failing tests in `affected-red.txt`. The same six files pass 202 tests in `affected-green.txt`: the original 201 plus one direct historical-provenance unit test. `corrected-tests.tsv` retains every original failing name and its correction, including the three separate HQ cases. The final environment file and two new public surrender cases pass 33 tests in `pre-impact-green.txt`. Six existing ownership, ignition, save and replay files pass 229 tests in `ownership-regressions-green.txt`. Final TypeScript checking exits 0; its empty output is retained in `typecheck.txt`. These runs overlap on the environment file and should not be added as distinct test counts.

Legacy fixtures now project onto named historical fields rather than relabeling current saves. The shared helper independently constructs the full migrated envelope, and tests retain exact malformed-input paths, old memory, unchanged inputs and native continuation. `historical-fixture-proof.mjs` also runs genuine v1/v2 producers from `2c8c79a` and `b538995b6ee8b398f5724a5bb8a0d89cf18a49fc`. It verifies both full expected native envelopes and original input bytes. Current projected fixtures round-trip through both original historical consumers. The retained producer JSON files have SHA-256 values `422848dc062c0c61faec255dc94db6b44b7441a935f67518a0990d3aa58af880` and `187b23ac0a754741c0eef74ee9ce8f2156e93be7b2e73765b832dde10a3a755b`. A 16,777,152-byte v2 input passes its original consumer, exceeds the current byte budget after migration, and loads after the existing 1,500-character shortening. Neither the UTF-8 serialized byte budget nor the UTF-16 aggregate string-storage budget was changed.

Combat damage expectations remain exact. Public face commands set defenders toward western attackers, isolating the existing research and relic effects. Registered siege and tower definitions preserve both headquarters and assert an undamaged target while the shot is pending, then 109 impact damage. The bridge case proves a pending shell before bounded impact waiting and retains rebuilding, the second collapse, unique ice tiles, strict loading and 20 paired checksum ticks. The direct ignition helper test labels its authored owner transfer. The new integration separately drives a public launch, actual surrender at time 0.1 while its shell remains pending until 0.7166667, native checkpoint restoration, old-side ignition and full replay parity on both levels.

`pre-impact-owner-guard-probe.mjs` is an in-memory fault probe, not a Vitest run. It executes the same new two-level integration with lightweight assertions, then restores the obsolete current-owner guard only in memory. Both normal cases pass; both injected-guard cases fail to create their world fire. The real Vitest run is the separate `pre-impact-green.txt` result.

The additional online-rendering failure was investigated but excluded from these commits. `additional-online-red.txt` reproduces the inherited friendly-fire fixture failure. Correcting the public rule exposes an injected unknown rule field in `additional-online-rules-red.txt`. The parent owns the production projection and fixture correction. The original unknown-field assertion was preserved; no permissive replacement was imported.

The SAVE4 owner will extend expected migrated defaults on its branch. Original historical input stays literal version 1 or 2. Whole-suite, browser-build and 108-match ladder verification belong to the parent; this evidence covers the isolated targeted checks only. The parent exclusively owns the canonical append-only `docs/features/decisions.tsv`; this workstream sends facts and never edits it.

Reproduce from the repository root with the dependencies installed:

```sh
node_modules/.bin/vitest run tests/ai-saves.test.ts tests/team-saves.test.ts tests/progression.test.ts tests/technology-branches.test.ts tests/environment.test.ts tests/neutral-world-integration.test.ts --testTimeout=30000 --maxWorkers=2
node_modules/.bin/vitest run tests/joint-world-ignition.test.ts tests/joint-special-surrender-fire.test.ts tests/joint-trophy-ownership.test.ts tests/joint-combat-integration.test.ts tests/specialist-gameplay.test.ts tests/specialist-saves.test.ts --testTimeout=30000 --maxWorkers=2
node_modules/.bin/vitest run tests/environment.test.ts tests/joint-pre-impact-surrender-ignition.test.ts --testTimeout=30000 --maxWorkers=2
node_modules/.bin/tsc --noEmit
node docs/evidence/baseline-fixtures-20261001/historical-fixture-proof.mjs
node docs/evidence/baseline-fixtures-20261001/pre-impact-owner-guard-probe.mjs
sha256sum -c docs/evidence/baseline-fixtures-20261001/source-sha256.txt
```

The historical proof requires production source to match `115a537`; it refuses to claim that pin after a source change. The later SAVE4 helper extension requires fresh expected defaults and verification on that source.

Independent review by GPT-5.6 Sol admitted both source commits. Its final-pin reruns pass 202/202 affected tests, 33/33 environment and surrender tests, the historical producer/consumer proof and all 169 source hashes. The full report and four rerun logs are retained here. The reviewer reported no weakened contracts or new product risk and retained the integration limits above.

Console logs retain their recorded content with trailing blank lines removed. Producer JSON bytes are unchanged.
