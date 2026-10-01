# Independent review of 87273ff

Verdict: admit commit `87273ff035a7fe7342f37785d5e5274ebd9dde4f` as docs-only preparation for the held 453 native combat retry. I found no blocking or advisory defect in the final checker or recipe. This does not admit the checker, build, browser, native history, or gameplay because none ran in this review.

The reviewer was `gpt-5.6-sol` with high reasoning. I pinned base `ae84897614db94dd2b107b9a47e2bfc5e1821c46` and tip `87273ff035a7fe7342f37785d5e5274ebd9dde4f`. The exact three-dot diff has SHA-256 `687e14bfc4fad5581a83a3a718bf0bc473631a1d62769662656012edad692b38`. The commit adds eleven files and 7,071 lines, all under `docs/evidence/native-combat-retry-preparation-453c221-20261001/`; it changes no product, proof, test, prior-evidence, or status path.

## Findings (risk)

None.

Ordering: the new recipe is serial. It adds the first dist/public gate after the fresh product build and the final comparison after browser and native-history execution. No existing runtime ordering changes because the commit only adds preparation documents. Evidence: `README.md` lines 19-42 and 55-75.

Failure paths: the checker uses 66 `require` calls rather than Python `assert`, so optimization does not remove its gates. Invalid argument shapes, pins, path sets, special files, byte mismatches, stale receipts, and changed contracts terminate before writing a receipt. JSON and Git errors propagate. The output uses exclusive binary creation and verifies the written bytes before printing their digest. Evidence: `verify-product-applicability.py` lines 22-50, 71-130, 137-205.

Observability: the first asset gate prints its receipt path and SHA-256 before its summary. The retained launcher captures that stdout, argv, cwd, executable identity, environment, and exit. The README requires retaining that digest before native execution and passing it to the final gate. Evidence: `verify-product-applicability.py` lines 201-208; `README.md` lines 44-46 and 69-77.

Stale writes: the checker rejects an existing or symlink receipt, writes with `xb`, and rereads it. The final gate hashes the first receipt before parsing it, binds it to the same product root, runtime pin, docs pin, checker bytes, original proof pin, source/build identity, frozen contract, complete dist fingerprints, and public fingerprints, then rereads the reference bytes. Evidence: `verify-product-applicability.py` lines 47-50 and 183-204.

Test delta: there is no runtime test delta in this docs-only commit. `preparation-checks.json` records syntax parsing only, and the README keeps all execution held. The later serial run is the test of the prepared gates and native assertions. Evidence: `preparation-checks.json` lines 1-16; `README.md` lines 3, 79-83.

## Compliance notes

The source policy is internally consistent. The sealed 0b baseline contains 567 product paths and 19 proof paths. Git at 453 contains 557 `src`/`public` files, including 394 public files; the eleven root product paths produce the stated 568 total. Endpoint comparison from c074 to 453 adds only `public/favicon.ico`. Endpoint comparison from 0b to 453 changes only `src/main.ts` and the favicon under `src`/`public`; the complete `scripts/acceptance` tree and `editor.html` blob are byte-identical to 0b. The checker enforces those sets, modes, blobs, live bytes, SAVE4, rules 4.0.1, and the reviewed favicon identity. Evidence: `verify-product-applicability.py` lines 76-135; `candidate-product-applicability-453c221.json` lines 1-35.

The dist policy closes the favicon gap without weakening the original freeze. It checks the actual frozen contract pin, SAVE/rules identity, source-derived build ID, complete frozen source/config/proof inventory, complete actual HTML/JS/CSS set, every actual dist fingerprint, and all 394 copied public assets. The final gate compares those complete fingerprints with the authenticated first receipt. Evidence: `verify-product-applicability.py` lines 137-197.

The preview working directory is explicit at `README.md` lines 46-51. The retained launcher's SHA-256 is `3ea6c74f53dddf6a10361c791f231200c5e33468cfa7a6db1aace9573cc81f14`, and its source sets the child cwd to `/home/morgana/.codex/worktrees/final-combat-proof/orcs-vs-Fairies`. The browser recipe names Chromium revision 1243 by full executable path and tells the operator to record the actual Playwright package and Chromium version.

The artifact manifest excludes itself and authenticates the other ten files. I recomputed every listed byte count and SHA-256 with no mismatch. The retained root bridge records 918 prior inputs and 556 prior `src`/`public` entries equal to c074, an empty mismatch list, and the exact favicon as the sole addition. The commit leaves the accepted ae848 preparation and both failed-run archives untouched.

The remaining limits are stated rather than hidden. Static equality does not establish a fresh build, browser compatibility, native behavior, or completion of the 39 encounters. The checker and recipe must still run from fresh external output after root releases the slot and port, and the first unexpected failure must stop the sequence.
