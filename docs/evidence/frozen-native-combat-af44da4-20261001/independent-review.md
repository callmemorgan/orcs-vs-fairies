# Final native combat evidence review

GPT-5.6 Sol reviewed `/tmp/ovf-final-native-combat-20261001` as evidence-only output at source pin `af44da406acf7ab44436e978cb1f571b93e28d23`.

## Verdict

Admit the retained run. I found no product, proof-script, or evidence-integrity finding. The first released orchestration attempt did fail after the browser run with `NameError("name 'esbuild' is not defined")`. The archive preserves that failure. It occurred before the native-checker build, after the browser proof had passed, and the remaining stages resumed after restoring the local executable variable. The browser was not rerun and no source or admitted proof script changed.

## Independent checks

The independent audit is `/tmp/ovf-final-native-combat-audit.py`; its passing output is `/tmp/ovf-final-native-combat-audit.log`. I also ran `sha256sum -c artifact-hashes.sha256`: all 248 listed artifacts passed. The checksum manifest SHA-256 at review time was `3e0fcb6861f84921bd628ca75b03774129d2db26e5d50f97bf9470552d8df35f`.

The audit checked all 32 successful command receipts, the frozen source pin, all 29 browser checks and 27 retained downloads, and the absence of recorded browser or served-asset errors. It verified the browser source inventory against committed Git bytes at `af44da4`. All 21 native-export receipts passed their production decoder, complete native envelope round trip, and replay-envelope check.

The three executed helper bundles and their metafiles match their retained hashes. Their 144 input entries match committed Git bytes. The Dwarf native export advances from tick 0 to 76. Its projected CLI session accepts four commands. The real pending checkpoint continues from tick 42 to 76, accepts the remaining command, and matches the uninterrupted projected envelope.

Both packaged CLI results report `passed`, zero process exits, empty stderr, no cleanup errors, byte-identical source/build manifests before and after, and rejected-request state preservation. The full run checks 76 ticks and four commands; the pending run checks 34 ticks and one command. Both finish at projected native SHA-256 `a1d5f45422b69c7522d531b7fda664f7f5512f5654f4dd370aa528a43ec4e6f5`.

I inspected the retained montage of all 13 screenshots. It shows rendered Orc formation, morale and faction controls; Dwarf loaded-cannon, impact and replay states; and Automata relay construction, connection and replay states. Port 5397 had no listener after the intentional preview exit 143.

## Review questions

Ordering changed only in the external orchestration: preparation ran first, then the authorized browser/native/CLI release. The retained failure marks the missing resume-local variable, and the final receipts show the remaining commands ran serially. Errors are present in `orchestration-failure.json`; the final result does not overwrite them. The work writes only to the outside-checkout evidence directory, and source/build before-and-after manifests match. No stale browser write is possible after the recorded intentional preview shutdown. This evidence adds no production behavior or tests.

## Limits

The browser proof establishes the listed combined encounters and native persistence. The CLI adapter changes only controller zero from `human` to `external` and omits outer planning, so it makes no outer-planning parity claim. This run does not close the previously documented measured-flanking, real crew-capture, hero-recovery, or engineer crossing/expiry gaps.
