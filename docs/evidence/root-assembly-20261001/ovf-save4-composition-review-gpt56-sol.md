# SAVE4 composition review

Verdict: no findings in `78b9fd7a690a91439b882784c4ec2e2f7d432fe4` against `3e2c2af`. Admit the seven commits in order.

I reviewed this composition with GPT-5.6 Sol. The pinned diff is `/tmp/ovf-save4-composition-review.diff`; the context diff is `/tmp/ovf-save4-composition-review-context.diff`; the inventory is `/tmp/ovf-save4-composition-review-inventory.txt`.

## Commit review

`770abb862920e4bad10ea0ad49e607a9680f9b6b` adds a frozen SAVE3 built-in content registry and verifies its content hash before historical entity, queue, research, rule, or scenario validation. Current publications still use the current registry. The save decoder validates a disposable copy, so historical bytes remain available for checksums and inspection. Risk: the frozen registry must match published SAVE3 content. `tests/historical-content.test.ts` and `tests/save-envelope-source.test.ts` exercise the admitted hash and reject altered built-ins.

`1cc774abba7d9017c15396934b5e9d795917849f` introduces SAVE4, simulation revision `4.0.0`, raw historical save envelopes, authenticated session pairing, and V3 migration. Historical checksum calculation uses the original JSON field order and UTF-16 code units. V3 content is authenticated before repinning; pending production, paid costs, banks, scenario bindings, rules, objectives, and draft progress remain intact. Old replay history remains inspectable but cannot play or continue under current rules. Fresh SAVE4 history can start from the migrated state. Risk: migration must not normalize the archived source or allow old rules to resume. `tests/save4-corpus.test.ts`, `tests/save-envelope-source.test.ts`, and `tests/team-replays.test.ts` cover these boundaries.

`6edf9a14f0f591609ac210a8044897698445900d` lets the historical validator inspect an admitted old summon whose current owner lacks raising ability, then rejects migration when the dead caster makes its origin ambiguous. Current SAVE4 admission still requires a valid raising faction and current owner rule. Risk: archived invalid state could become playable. `tests/captured-summon-rules.test.ts` and the captured Gravecaller corpus case prove inspection succeeds while load, session import, and continuation reject.

`81c35c40dbbd22c35afe9754ef66f11c6208a70d` rebuilds the migrated draft pool from current content while preserving rules, choices, turn state, timer, and objective progress. Risk: stale pools could omit current definitions or a rebuild could overwrite draft progress. The off, active, and complete draft cases in `tests/save4-corpus.test.ts` cover both.

`16264860f00c3af17c2f72b713f441e495ad277f` and `55aaa46bf33696c86ee11912e4649f3e9a65f263` reject array symbols, accessors, gaps, extra properties, and noncanonical numeric spellings before copying save envelopes. Canonical nonenumerable indices preserve their serialized meaning. Risk: getters could run or ignored properties could create a mismatch between validated and hashed data. `tests/save-envelope-source.test.ts` covers data keys, accessors, symbols, source immutability, and canonical indices.

`78b9fd7a690a91439b882784c4ec2e2f7d432fe4` applies the same array-own-property rules to session and scenario wrapper copying. `src/core/saves.ts` is byte-identical to `55aaa46`, so this final commit does not change the previously reviewed core save migration. Risk: a wrapper could discard a hidden array property before its nested game or replay reaches the save decoder. `tests/save4-corpus.test.ts` covers game and replay-initial arrays, enumerable and nonenumerable data keys, accessors, symbols, unchanged descriptors, and canonical indices.

## Behavioral interrogation

Ordering: no serial work became concurrent and there are no new asynchronous operations. Historical content authenticates before definition validation and migration. A session wrapper copies and rejects executable or extra array properties before decoding the nested game and replay. V3 migration validates the old envelope, rejects ambiguous or prohibited summons, repins content, refreshes the draft pool, completes new runtime state, and only then validates SAVE4.

Failure paths: new failures are synchronous validation errors. Unsupported base hashes, altered package hashes, invalid historical definitions, mixed save and checksum versions, changed final checksums or ticks, ambiguous summons, prohibited current summons, and invalid array properties all stop before returning a live state. The original input remains unchanged. There are no swallowed exceptions or new promises.

Observability: replay archives now identify simulation revision `4.0.0`; old versions retain their mapped historical revision. No log or telemetry order changes. The composed simulation records carried cargo in the death event before economy cleanup, and replay analysis reads that event amount. The owner probe observed `amount: 12`, `lostValue: 62`, and matching playback.

Stale writes: decoding works on copied JSON. The raw original envelope is returned separately from the migrated live state, and save, replay, session, and scenario tests compare source text and property descriptors before and after rejection. Old replay actions cannot write into a migrated match because playback and continuation require both SAVE4 and simulation revision `4.0.0`.

Test delta: each changed behavior has a focused regression. I reran five affected files at the pinned tip: 85/85 tests passed. The owner reports 1,072/1,072 tests across 46 files and all four builds passed. A separate read-only review also passed historical pairs, all three draft migrations, ambiguous-summon inspection and resume rejection, scenario restoration, continued SAVE4 playback, death accounting, and strict-array probes.

## Verification

The independent focused log is `/tmp/ovf-save4-composition-focused.log`. `git diff --check 3e2c2af...78b9fd7` passed. The checkout remained pinned at `78b9fd7a690a91439b882784c4ec2e2f7d432fe4`; its only untracked entry was the existing `node_modules` link or directory.

Admit in this order:

1. `770abb862920e4bad10ea0ad49e607a9680f9b6b`
2. `1cc774abba7d9017c15396934b5e9d795917849f`
3. `6edf9a14f0f591609ac210a8044897698445900d`
4. `81c35c40dbbd22c35afe9754ef66f11c6208a70d`
5. `16264860f00c3af17c2f72b713f441e495ad277f`
6. `55aaa46bf33696c86ee11912e4649f3e9a65f263`
7. `78b9fd7a690a91439b882784c4ec2e2f7d432fe4`
