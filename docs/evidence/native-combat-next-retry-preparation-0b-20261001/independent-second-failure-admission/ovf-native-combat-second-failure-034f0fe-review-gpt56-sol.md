# Review of native combat second-failure archive 034f0fe

Reviewed by GPT-5.6 Sol.

Commit `034f0fe1b25ed1bfadad025773300e45b4dc3244` is accepted as an evidence-only archive with no findings. It preserves the failed run and later repair records without claiming runtime acceptance.

## Commit and archive scope

The pinned base is `0b697f781fb718752a554c6884b352b995311c06`. The tip has that exact parent and merge base, and the range contains one commit, `Retain second native combat failure and admitted fixture repair evidence`.

Git reports 212 added files, all below `docs/evidence/native-combat-second-failure-287583c-20261001/`. No product, test, acceptance-script, requirements-ledger, or feature-status path changes in this commit.

The archive has seven control files and 205 files under `run/`. I compared the complete `run/` inventory with `/tmp/ovf-native-combat-287583c-retry-20261001`: both contain the same 205 paths, and all 55,884,786 bytes are equal. The original failed-run manifest seals 182 of those files; the remaining 23 are the later diagnosis, screenshot review, repair proposal, independent review, and retention records.

The archive manifest covers 210 files and excludes only itself and its derived retention audit. Every recorded byte count and SHA-256 matches. All 153 JSON files parse, and all 28 PNG files have valid PNG signatures.

## Failed-run record

The run is labeled with proof commit `287583c6bf90b0df76475f8541e6694df1d5f901` and product source `c86e273c70738f144a00fe75f5ecf39e7fa324d8`. Its browser report has `completed: false`, 46 checks, 79 authenticated downloads, no completed groups, and an exit-1 receipt. It stops in the native direction encounters on a 15-second attack-order wait for the rock-cover case.

The retained partial results match the README: front, side, and rear damage are 12, 15, and 18; no-cover damage is 15; and the shot after natural shield depletion deals 17. The final check only confirms that the rock fixture imported. It does not record a completed rock attack, capture group, specialist group, offline history audit, or CLI acceptance.

The preview cleanup receipt records SIGTERM for the owned process group, a successful direct bind on port 5397, and protected port 4173 untouched.

## Later repair record

The later repair commit is `0b697f781fb718752a554c6884b352b995311c06`. Compared with the failed proof pin, it changes only `direction-defense-fixtures.ts`, `direction-defense.mjs`, and `native-context.mjs` under `scripts/acceptance/`.

The retained independent repair review and audit match their accepted SHA-256 values: `d78e0023cd63a04ba5d83a63dec2f04a9fe153481aea64544d599b4dc256d139` and `c28680a61fff355bc05dac3dfaf94bb5c9bbf01601c234e2f3c3166d3aa3687b`. The bridge records `runtimeRetryExecuted: false`. The archive therefore preserves the admitted repair for a future run without relabeling the failed evidence.

The committed verifier passed against the isolated checkout. It confirmed 567 product inputs and all 19 acceptance-proof inputs match Git bytes and modes at `0b697f7`. It also rechecked the archive manifest, 182 original files, all 205 copied files, 79 downloads, and 22 screenshot hashes.

## Findings and risk

No findings.

The full diff whitespace check returns the seven recorded diagnostics: six CRLF lines in the original `run/decisions.tsv` and one context line in the original proposed patch. The output matches `archive-checks.json` byte for byte, and the newly authored control files pass their scoped whitespace check. Preserving those raw bytes is correct for this archive.

Ordering, failure handling, runtime logging, and stale writes are unchanged because this commit adds evidence only. No tests or runtime acceptance are added. All 39 combat encounters still need a fresh complete native run at the next released product and proof pins.

I ran read-only Git, JSON, hash, PNG-signature, manifest, and retention-verifier checks. I did not run a build, fixture producer, game, browser, server, simulation, or test.

## Artifacts

The machine-readable audit is `/tmp/ovf-native-combat-second-failure-034f0fe-review-audit-gpt56-sol.json` with SHA-256 `ddf161f60e5b7fdfb49ea8748bc6d5502ef86682655b4b93efa41f3482cb36fa`.

The direct 205-file comparison is `/tmp/ovf-combat-second-failure-034f0fe-external-byte-audit.json` with SHA-256 `248fc07cb176fdaca8106df098f44bbb91d3b677ce52cb4e6869c26b21434540`.
