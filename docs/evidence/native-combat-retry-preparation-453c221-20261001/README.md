# Native combat retry preparation for 453c221

This separate preparation targets runtime product/proof freeze `453c2218af9973b9eca8fb78392435bd9d46a740`. It preserves the twelve files admitted at `ae84897614db94dd2b107b9a47e2bfc5e1821c46`, the original proof source `0b697f781fb718752a554c6884b352b995311c06`, and both failed native runs. It contains no new checker, build, fixture, browser, history or gameplay execution. Session UI owns the heavy slot; owned port 5397 remains held until root admits the fresh UI proof and releases execution. Protected port 4173 remains untouched.

Compared with c074, the only product addition is the reviewed `public/favicon.ico`: mode 100644, Git blob `82fa500660fbf8a022166b806cb5cdb372ad83d5`, 32,038 bytes, SHA-256 `5e0bf0f72488bc693d779cd7a3ebc7fdfca8db9916a6e3e0811fff59113253c2`. The authorized product set is now the former 567 paths plus that file, for 568 paths. All former product inputs keep their c074 modes and blobs. Relative to original 0b proof source, the only differences are the reviewed c074 guard in `src/main.ts` and the favicon addition. All nineteen native acceptance modules and supplemental `editor.html` remain equal to 0b.

The root static bridge is retained byte-for-byte as `root-static-applicability-453c221.json`. It records equality of the prior 918 input entries and 556 prior `src`/`public` entries against c074, with no runtime execution. `candidate-product-applicability-453c221.json` independently records the narrower accepted product/proof policy. These static comparisons do not admit the pending UI proof or the complete native suite.

The source-derived build ID hashes `src` TypeScript and CSS. The favicon does not affect it, so it can remain equal to c074. The actual 453 pin and fresh dist asset fingerprints must identify this run. The native freezer includes complete source/proof/config fingerprints and dist HTML/JS/CSS, but omits public files and the ICO. The new checker therefore has a post-freeze `--dist` mode that reads the original contract, checks its actual pin and complete source/executable fingerprints, compares all 394 copied public assets against pinned product bytes, and records fingerprints for every actual dist file. It calls no fixture producer or native freeze function and executes no game code. The recipe's fresh production build establishes when those dist files were produced; byte fingerprints alone do not prove a fresh build occurred.

The external executing checker authenticates itself against this preparation's separate full docs commit. It reads the original baseline footprint through that same immutable docs pin and checks its accepted SHA-256 `f9d5fada4c3eb7572576370dec34c7cdf67ec75bce7ff620bb3c7e8fe78f653d`. Both Git helpers disable replacement objects. Explicit checks remain active under Python optimization. Product checkout HEAD must equal the fixed 453 runtime pin before and after each inspection. The complete live input sets, modes, Git blobs, byte counts and hashes must match the admitted policy. Metadata descendants do not redefine the runtime freeze.

## Serial recipe after release

Keep this preparation's full docs commit in Git, then update only the owned isolated checkout to the fixed 453 runtime pin after root releases execution. Create a fresh external evidence parent named for that pin and the actual retry date, its `logs` directory, a retained copy of this checker from the docs commit, and an unchanged copy of the earlier raw-output `launch-step.py`. Resolve paths physically and keep output outside both source roots. The launcher runs commands in `/home/morgana/.codex/worktrees/final-combat-proof/orcs-vs-Fairies`; its SHA-256 is `3ea6c74f53dddf6a10361c791f231200c5e33468cfa7a6db1aace9573cc81f14`.

Set `ACCEPTANCE_ROOT` to the owned checkout, `ACCEPTANCE_PIN` to the full 453 runtime pin and `ACCEPTANCE_RUN` to that fresh parent. Set `ACCEPTANCE_DOCS_ROOT` to a repository containing this preparation and `ACCEPTANCE_DOCS_PIN` to its separate full docs commit. The docs repository may share Git objects with the product checkout; its HEAD does not change the runtime pin. These commands are unexecuted reference material.

```sh
set -e
python3 "$ACCEPTANCE_RUN/launch-step.py" 00-applicability \
  python3 "$ACCEPTANCE_RUN/verify-product-applicability.py" \
  "$ACCEPTANCE_DOCS_ROOT" "$ACCEPTANCE_DOCS_PIN" \
  "$ACCEPTANCE_ROOT" "$ACCEPTANCE_PIN" "$ACCEPTANCE_RUN/product-applicability.json"
python3 "$ACCEPTANCE_RUN/launch-step.py" 01-helpers \
  node scripts/acceptance/build-native-helpers.mjs \
  "$ACCEPTANCE_ROOT" "$ACCEPTANCE_RUN/helpers" "$ACCEPTANCE_PIN"
python3 "$ACCEPTANCE_RUN/launch-step.py" 02-fixtures \
  node scripts/acceptance/generate-native-fixtures.mjs \
  "$ACCEPTANCE_ROOT" "$ACCEPTANCE_RUN/helpers/fixtures.mjs" \
  "$ACCEPTANCE_RUN/fixtures" "$ACCEPTANCE_PIN"
python3 "$ACCEPTANCE_RUN/launch-step.py" 03-product-build npm run build
python3 "$ACCEPTANCE_RUN/launch-step.py" 04-freeze \
  node scripts/acceptance/verify-native-acceptance.mjs --freeze \
  "$ACCEPTANCE_ROOT" "$ACCEPTANCE_RUN/fixtures" \
  "$ACCEPTANCE_RUN/frozen-inputs.json" "$ACCEPTANCE_PIN"
python3 "$ACCEPTANCE_RUN/launch-step.py" 05-dist-public-assets \
  python3 "$ACCEPTANCE_RUN/verify-product-applicability.py" --dist \
  "$ACCEPTANCE_DOCS_ROOT" "$ACCEPTANCE_DOCS_PIN" \
  "$ACCEPTANCE_ROOT" "$ACCEPTANCE_PIN" "$ACCEPTANCE_RUN/frozen-inputs.json" \
  "$ACCEPTANCE_RUN/dist-public-assets.json"
```

The first asset gate emits the exact receipt SHA-256 into its captured stdout. Retain that original value before proceeding, and set `ACCEPTANCE_FIRST_DIST_SHA256` from it for the final gate. Do not derive the expected digest again from the first receipt after native execution. The final gate requires that retained digest before parsing the reference receipt. Source and dist inventories reject FIFOs, sockets, symlinks and other nonregular entries.

After root releases owned port 5397, verify it is free and start the production preview separately with retained argv, PID/process group, runtime pin and raw output. The working directory is explicit:

```sh
cd "$ACCEPTANCE_ROOT"
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5397 --strictPort
```

Run all three native groups and the original unprojected history audit serially. The first passing rock case must retain visible/displayed-level preconditions, pointer context, the accepted native attack and replay command, and 8.7 first-hit damage. All gameplay after initial fixture authoring uses native DOM, pointer and keyboard controls. `window.rts` is observation-only.

```sh
export OVF_PLAYWRIGHT_MODULE=/home/morgana/.t3/worktrees/orcs-vs-Fairies/t3code-f8849e6c/work/faction-assets/browser/node_modules/playwright-core/index.mjs
export OVF_CHROMIUM_EXECUTABLE=/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome
python3 "$ACCEPTANCE_RUN/launch-step.py" 06-browser \
  node scripts/acceptance/verify-native-acceptance.mjs \
  http://127.0.0.1:5397 "$ACCEPTANCE_ROOT" \
  "$ACCEPTANCE_RUN/browser" "$ACCEPTANCE_RUN/fixtures" \
  "$ACCEPTANCE_RUN/frozen-inputs.json" "$ACCEPTANCE_RUN/helpers/audit.mjs" \
  direction,capture,specialists
python3 "$ACCEPTANCE_RUN/launch-step.py" 07-native-history \
  node scripts/acceptance/verify-native-history.mjs \
  "$ACCEPTANCE_ROOT" "$ACCEPTANCE_RUN/helpers/audit.mjs" \
  "$ACCEPTANCE_RUN/fixtures" "$ACCEPTANCE_RUN/browser" "$ACCEPTANCE_PIN" \
  "$ACCEPTANCE_RUN/frozen-inputs.json"
python3 "$ACCEPTANCE_RUN/launch-step.py" 08-final-dist-public-assets \
  python3 "$ACCEPTANCE_RUN/verify-product-applicability.py" --dist \
  "$ACCEPTANCE_DOCS_ROOT" "$ACCEPTANCE_DOCS_PIN" \
  "$ACCEPTANCE_ROOT" "$ACCEPTANCE_PIN" "$ACCEPTANCE_RUN/frozen-inputs.json" \
  "$ACCEPTANCE_RUN/final-dist-public-assets.json" \
  "$ACCEPTANCE_RUN/dist-public-assets.json" "$ACCEPTANCE_FIRST_DIST_SHA256"
```

The frozen-input contract remains mandatory as the last history argument. Compare complete native `.game` envelopes including runtime. The final asset gate receives the first receipt and its previously retained digest as the final optional pair. It requires identical source/proof/public fingerprints, checker provenance, native contract SHA and complete actual dist fingerprints. A failure stops the recipe. Preserve its first raw receipt, readable state and screenshot before any repair. Close only the owned preview and retain direct port/cleanup checks. Inspect every screenshot, hash all artifacts and request independent admission of the complete native results. Packaged controller-zero CLI projection remains a separate later stage; no outer-planning CLI equality claim is included.

The scope remains 39 authored encounters: 22 direction/defense, five capture/ambush/morale and twelve specialist/lifecycle. SAVE4 and rules 4.0.1 remain required. The failed 287/c86 run remains 46 checks and 79 downloads with zero complete groups. The original 0b proof repair and the old c074 retry preparation never received fresh runtime acceptance. Record the actual Playwright package and Chromium version for the new run.

## Attention

The old recipe and failed-run archive were reviewed by GPT-5.6 Sol. This new 453 preparation needs its own independent light admission. Neither static source equality nor a shared build ID admits UI regression or any of the 39 native encounters. Execution and owned port 5397 remain held by root.
