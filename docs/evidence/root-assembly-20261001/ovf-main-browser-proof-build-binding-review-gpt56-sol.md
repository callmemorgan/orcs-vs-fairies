# Main-browser proof build-binding review

GPT-5.6 Sol reviewed the helper chain `dda9f8f12e4e9236c48f9197301d70adba6d5373`, `465c6ade862cd5a6b56f371604cb253c9dc313bf`, and `5d3ea2d1341e2e06cbdb4eeaf755b53b02f2b865`. The last commit's helper SHA-256 is `c2e91adda307ad9727a86ce3693eee6d590879120556081b9f67bec925c6463a`.

## Verdict

Accept all three commits as the corrected main-browser proof helper. Do not stop after either earlier commit. The chain has not executed the canonical production build, server, gameplay, or browser sequence.

## Build admission

The final commit requires the raw `build-manifest.json` written by `scripts/controls-proof/prepare.mjs` and uses its sibling `dist` directory. It compares the manifest's source pin and source fingerprint with independently reconstructed frozen source. It then requires complete and exact maps for source, public assets, build configuration, shared proof scripts, and all seven canonical controls tests. Each input entry includes SHA-256, byte count, and Git blob. The manifest's `compiledFiles` map must equal the complete `dist` inventory.

The helper checks every tracked repository file against the frozen commit, requires complete `src` and `public` inventories, and authenticates its own bytes. It still requires the source fingerprint inside production JavaScript as an additional check. Served files must match the admitted compiled inventory before the package output directory is created.

The package archives the raw build manifest before inventorying package files. Its SHA-256 and length are recorded separately. `verifyPackage` reconstructs source from the retained Git bundle, rereads the archived manifest, and repeats every build-input and compiled-output comparison. Both `audit` and offline `verify` call `verifyPackage`, so later mutation or relabeling rejects.

The preceding `465c6ad` correction exclusively retains the UI export manifest and every available raw download before validation, writes a failed report on later errors, and makes audits append-only. The original `dda9f8f` helper supplies the browser workflow and native export auditor.

## Verification

The committed `5d3ea2d` diff is byte-for-byte the working diff reviewed before commit. `node --check` and `git diff --check` pass. I independently reran the seven-case disposable CLI harness. A matching synthetic input reaches the served-byte fetch, while same-label stale JavaScript, an altered source map, omitted configuration, a changed canonical-test Git blob, an untracked public asset, and a missing build manifest all reject before packaging. The retained five audit controls cover invalid downloads, overwrite refusal, partial retention, malformed manifest retention, and concurrent writers.

Ordering remains build admission, served-byte verification, exclusive package creation, archive verification, UI execution, raw-download retention, native audit, and a final package verification. Failures before package creation leave no package; audit failures preserve raw inputs and a failed report. The output directories prevent stale or concurrent writes. The seven build-admission cases and five retention cases cover the new failure paths.

## Findings

None within helper scope. The canonical production and browser executions remain pending.
