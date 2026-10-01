# Native combat acceptance preparation review

GPT-5.6 Sol accepts the cumulative source-only chain `12c2943f39f176e234f848af7ee4a96fa726e18a..4a13ca78b48fe476ce8fa5132dcc96efa006b975`. This admits the fixture producers, frozen helper build, native browser runners, and offline history audits for a new 39-encounter run. It does not claim that any encounter passes in production. Fixture generation, builds, simulation, browser execution, and CLI execution remain pending at the final combined source pin.

## Reviewed commits

`1b4f72c61ec7cfc25c051227a29a6509b49acda4` adds 25 preparation files with 2,585 lines. It defines 22 direction/defense encounters, 5 capture/ambush/morale encounters, 12 specialist/lifecycle encounters, the common native browser context, the fixture aggregator, deterministic helper provenance, the source/fixture/dist freeze, and the offline history audit.

`c0a3b12f72d22a9da03e737245e36f2e8c416dde` changes seven files. It rejects null selected-group receipts, dispatches specialized audits from the requested group list, and binds the configured esbuild JavaScript module and native binary to the lock and retained receipt. I did not admit this pin on its own: specialized history files were still read outside the top-level download fingerprint inventory, and plain `resolve` calls allowed an export filename to escape the evidence directory.

`4a13ca78b48fe476ce8fa5132dcc96efa006b975` changes ten files. It adds a shared authenticated download reader, requires the exact 47 direction exports, 24 direction continuations, and 15 capture saves, and passes the browser's top-level fingerprint map into both specialized audits. It also requires the offline wrapper to load the same frozen-input contract recorded by the browser and rechecks that contract before and after history verification.

## Corrected finding

At `c0a3b12`, `native-audit.ts:63-79` authenticated only files named in `receipt.downloads`. `audit-direction-defense.ts:39-44` then opened nested `receipt.groups.direction.exports[].file` values directly, and `capture-ambush-native-checks.ts:79-90` opened 15 fixed filenames directly. The direction path used `resolve(evidenceDir, item.file)` without containment. An edited receipt could omit a specialized artifact from the authenticated map or point a direction export outside the evidence directory.

The retained probes reproduce the defect against the exact rejected source bytes. `/tmp/ovf-native-receipt-binding-audit.json` identifies all unbound read sites and their SHA-256 hashes. `/tmp/ovf-native-direction-path-semantics.log` shows `../outside.json` resolving to and reading `/tmp/ovf-native-path-probe/outside.json`. The commit preserves byte-identical copies under `docs/evidence/native-acceptance-preparation-20261001/`.

The correction closes the defect. `native-downloads.ts:8-25` accepts only a lower-case hyphenated JSON basename, checks lexical containment, rejects symlinks and non-files, requires an original browser fingerprint, and checks both byte count and SHA-256 before returning bytes. `native-audit.ts:63-66`, `audit-direction-defense.ts:79-107`, and `capture-ambush-native-checks.ts:80-101` use this reader. My fault probe accepted the valid control and rejected relative traversal, an absolute path, a symlink, a missing fingerprint, a changed byte count, and a changed hash.

The direction inventory matches every runner branch: 47 unique exports and 24 unique continuation triples. The audit now selects each case endpoint by its declared expected name rather than receipt order. The capture receipt must contain exactly the 15 fixed save names once each. Specialist admission still requires its fixed 25 endpoints through the top-level authenticated map.

## Source review

The fixture path covers 39 authored starting states. The generators use production constructors and strict session decoding, advance no direction/defense ticks, and start native recording only after setup. Capture's hostile march is an authored initial order before recording; later recorded commands must belong to human side zero. The preparation documents disclose wounds, cooldowns, resources, terrain, and other setup exceptions.

The browser runners mutate gameplay only through DOM, pointer, keyboard, import, export, and replay controls. Browser evaluation reads public `window.rts` state or computes canvas coordinates. Canvas input checks the physical canvas hit target after camera, zoom, bounding-box, and CSS scale conversion. Each retained endpoint is exported, imported, replayed to its endpoint, compared as a complete `.game` envelope including runtime, and restored before continuation.

The offline audit strictly decodes every authenticated save, requires SAVE4 and the current simulation revision, checks a complete save round trip, and replays the unprojected native history to the same full endpoint. Direction adds per-command and per-tick checks. Capture resumes four checkpoint suffixes. Specialist resumes pending/active, recovery, expiry, and destruction pairs through public commands and `.05` steps.

The helper path compares the complete `src` and `scripts/acceptance` inventories to Git, pins config and package files, checks the locked compiler module and binary, rebuilds deterministic bundles, and compares the output bytes and actual esbuild input graph. Fixture freeze requires the complete generated inventory and reproduces it in a new directory. The browser runner checks same-origin executable response bytes against the frozen production dist and blocks service workers. The offline history wrapper now requires the browser's frozen-input file and rechecks source, proof, fixture, and dist bytes around the audit.

## Behavioral review

The new work is serial. Fixture groups are generated in fixed order, selected browser groups run one at a time, and each encounter waits for a native condition before it records the next artifact. No new concurrent write path exists.

Assertions and filesystem errors propagate to the invoking process. The browser wrapper records its current phase, failure, last readable state, and a failure screenshot when a context exists. Output directories and reports must be new, and reports use exclusive creation. Preflight provenance failures occur before the history wrapper's report-writing `try` block, so their command stderr and exit code remain the required record.

Browser observations append named checks to the receipt. Each download records its byte count and SHA-256. The final receipt records served executable assets, the frozen source identity, the selected groups, and all output fingerprints. The correction does not reorder gameplay or browser observations; it adds fail-closed checks before the offline audit reads evidence.

No superseded or retried operation writes shared product state. Fixture reproduction uses a fresh temporary directory, helper and evidence outputs require fresh paths, and the browser rechecks frozen inputs before completion. The offline history wrapper repeats the freeze check after all history work.

No production behavior changes in this chain. The proof scripts have syntax and type coverage now; their behavioral test is the scheduled native run itself. The admission therefore remains conditional on fresh fixture generation, the production build, all 39 browser encounters, the offline audit, screenshot inspection, and any separately scheduled packaged CLI comparisons.

## Verification

I independently ran all 11 `node --check` commands and the retained strict `tsc --noEmit` command at `4a13ca7`; both passed. The logs are `/tmp/ovf-native-combat-4a13-independent-node-check.log` and `/tmp/ovf-native-combat-4a13-independent-tsc.log`.

I verified all 12 retained check results and all 19 input fingerprints in `preparation-checks-download-binding.json`. The fixed-source structural audit is `/tmp/ovf-native-binding-fix-audit.json`. The six-case authenticated-reader fault probe is `/tmp/ovf-native-download-auth-probe.json`. Its reproducible source is `/tmp/ovf-native-download-auth-probe.mjs`; `/tmp/ovf-native-review-probe-receipt.json` records a second exit-zero run against the `4a13ca7` Git blob for `native-downloads.ts`. The pinned review diffs are `/tmp/ovf-native-combat-4a13-review.diff` and `/tmp/ovf-native-combat-4a13-review-context.diff`.

No correctness finding remains in the reviewed source. The next acceptance decision must use the new combined source commit and fresh runtime evidence; this review does not admit an older native combat run under rules 4.0.0 as proof for rules 4.0.1.
