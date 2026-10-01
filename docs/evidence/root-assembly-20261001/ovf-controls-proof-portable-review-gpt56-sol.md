# Review of 74acab04bf4f10eddd8deb40117c47bda95f7c9a

Verdict: hold this portable proof commit for one evidence-integrity correction. It changes no production source, and its preparation checks are useful, but the combined runner can certify a source pin while executing modified canonical regression files.

I reviewed this with GPT-5.6 Sol against parent `b2e8e6daa87dc38d0d37e547afe465052103a436`. The pinned diffs are `/tmp/ovf-controls-74acab0-u0.diff` and `/tmp/ovf-controls-74acab0-context.diff`.

## Finding

`scripts/controls-proof/canonical.vitest.config.ts` runs seven canonical files: appearance, display settings, gamepad, minimap alerts, minimap level focus, session storage, and session tools. The frozen-source contract in `scripts/controls-proof/browser-common.mjs:10-48` inventories `src`, `public`, seven build configuration files, and proof scripts, but no canonical test path. `scripts/controls-proof/run.mjs:54-55` then executes the mounted and canonical configurations under the asserted source pin. The mounted test separately authenticates only `tests/minimap-level-focus.test.ts` at `scripts/controls-proof/mounted.test.ts:92-96`.

I reproduced the gap in an isolated detached checkout at the exact reviewed commit. After appending an uncommitted line to `tests/appearance.test.ts`, `sourceProvenance('74acab04bf4f10eddd8deb40117c47bda95f7c9a')` still passed and returned no provenance entry for that test. The machine-readable result is `/tmp/ovf-controls-unpinned-canonical-test-probe.json`.

Include all seven referenced canonical test files in the Git/blob and inventory provenance, record them in the preparation and final manifests, and compare them before and after the combined run. A clean detached checkout makes accidental drift unlikely, but the verifier currently claims committed provenance without enforcing it for the tests whose passing result it cites.

## Other review results

The earlier static orchestration review at `/tmp/ovf-controls-orchestration-review-wdbk5xbb/review.json` found two issues while the files were uncommitted. Both are fixed in the reviewed commit. `prepare.mjs:11-12` requires an empty output root. `run.mjs:20-24` compares module and build inventories before execution, and `run.mjs:98-101` repeats those checks after preview shutdown.

`browser-common.mjs` binds tracked source, public assets, configuration, proof scripts, schema module, build manifest, compiled output, served HTML and discovered JavaScript/CSS, browser response bodies, and the native bug-report build/version fields to the source pin. `finishProof` waits for recorded response-body checks, repeats source/build/served checks, requires clean browser diagnostics and closed browsers on passing runs, writes a failure report when finalization fails, and inventories feature artifacts.

`prepare.mjs` derives wrapper and simulation versions from bundled current source, requires SAVE4 for the final run, builds into the fresh output root, runs strict TypeScript, generates the layered fixture, and writes module/build manifests. `run.mjs` refuses a prior `run.json`, uses exclusive log creation, runs the mounted and canonical configurations, owns an unused strict preview port, runs each browser driver serially, verifies every retained native download, terminates the preview on success or failure, checks for a remaining listener, and takes the final inventory after logs and preview close.

`verify-native.ts` compares the complete raw game envelope after decode/resave and replay playback, recomputes analysis and technology timing, binds its bundle to the source/config digest, and continues both loaded and replay-derived states through the same six commands and 100 natural steps. It compares complete envelopes and recorder histories throughout and replays both extended archives to the final continued envelope. The gamepad sidecar must match accepted command sides, values, and replay action indices.

The browser drivers use the production menu and SessionTools controls. Display uses mouse and keyboard actions; gamepad replaces only `navigator.getGamepads` and clearly excludes physical hardware; saves uses fresh browser contexts and real wall-clock waits; minimap imports the regenerated native layered fixture and now uses the common provenance/finalizer. Their README states the remaining limits without broadening the claims.

The mounted configuration runs the five new mounted cases plus all seven canonical minimap-level-focus cases with one worker and no file parallelism. The canonical configuration names the seven relevant existing test files, totaling 83 syntactic `it`/`test` cases by source count. The test-selection issue is provenance, not omission from the Vitest includes.

Preparation evidence remains scoped to SAVE3 at `b2e8e6d` and rules revision `3.2.0`. `/tmp/ovf-mounted-preparation.0cqrD3/mounted-tests.log` records 12 of 12 mounted and level-focus cases passing. `/tmp/ovf-controls-native-preparation-Ly2mFG/preparation-report.json` records two continuation passes and five intended verifier rejections. JavaScript syntax and diff whitespace checks pass on the reviewed commit. No final SAVE4 browser run is claimed or was run during this review.

## Behavioral interrogation

- Ordering: preparation, mounted tests, canonical tests, preview startup, four browser drivers, native checks, preview shutdown, and final inventory run serially. Browser response-body checks within a driver may finish concurrently, but `finishProof` awaits all of them before passing.
- Failure paths: child command errors are written into `run.json`; browser drivers retain failed reports and screenshots where possible; cleanup and provenance failures turn the run result to failed. The unpinned canonical tests are the finding above.
- Observability: the commit adds proof logs and JSON manifests only. Each command records arguments, timestamps, outcome, and a dedicated log. No production telemetry changes.
- Stale writes: a prior `run.json` or exclusive log blocks reuse. The output root must be empty at preparation, and each feature directory must be fresh. Source, modules, build bytes, served bytes, listeners, and browser closure are rechecked before final inventory. Canonical test bytes remain the uncovered mutable input.
- Test delta: the new mounted cases exercise display rendering and minimap alert behavior, and the canonical configs run the existing focused regression files. Preparation evidence covers the native verifier and mounted tests on SAVE3. The final SAVE4 browser and native execution remains intentionally pending.

The commit message has the required Codex attribution and co-author trailer.
