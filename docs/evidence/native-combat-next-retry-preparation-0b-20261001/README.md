# Next native combat retry preparation

This recipe targets root's runtime product/proof freeze `c074cc5e610fc128d7b6ac894a61258d418463d4` after UI regression admission. It has not run. Heavy execution remains held by root. The original admitted proof source is `0b697f781fb718752a554c6884b352b995311c06`; the c074 freeze retains its 19 acceptance modules. The second failed run remains separately retained at `docs/evidence/native-combat-second-failure-287583c-20261001/` and root imported it as `25fbfbd6c9a81b26bdd5c9a19908c745906a356a`.

The previous c86/0b plan named `/tmp/ovf-native-combat-0b697f7-retry-20261001`. That directory was never created and that retry never ran. Use a fresh parent named for c074 and the actual retry date. Every helper, fixture manifest, frozen contract, browser receipt and history audit must identify the c074 runtime pin. Retain the original 0b proof identity as its source applicability reference. Evidence-only metadata descendants do not redefine the runtime freeze or its production build identity.

Root's product commit changes only `src/main.ts`: `accountChanged` refreshes cosmetic inventory only when an account ID exists. The retained exact patch and `candidate-product-applicability-c074.json` record a static comparison. The candidate has the same 567 accepted product paths and modes; the other 566 product blobs and all 19 proof modules equal the admitted 0b inputs. The supplemental `editor.html` entry also remains unchanged and receives its own gate because native freeze includes it. This establishes source applicability. Fresh UI regression and runtime acceptance remain required. Check the actual isolated checkout against c074 and retain its own production build ID.

`verify-product-applicability.py` reads Git and live bytes without executing game code. It authenticates its external executing bytes against a separate full docs commit, then reads and authenticates the baseline footprint from that immutable docs commit. It requires the c074 runtime pin to equal product checkout HEAD, the complete accepted product/proof path sets, unchanged 0b proof modules and editor entry, and only the reviewed c074 version of `src/main.ts` as a product difference. Its checks remain active under Python optimization. It writes a fresh external receipt containing every actual Git mode/blob, hash and byte count plus the build ID derived by the same source calculation as native freeze. Any additional product change requires a new admitted runtime freeze and applicability policy. Root's explicit execution release and successful UI regression remain separate requirements.

## Serial recipe

After root admits UI regression and releases execution, preserve this preparation's full docs commit in Git, then update only the owned isolated checkout to the c074 runtime pin. Verify no uncommitted or hidden-index source changes exist through the applicability script and existing helper/freezer byte checks. Resolve external output paths physically and confirm they are outside both source roots. Create a fresh evidence parent, its `logs` directory and an unchanged copy of the retained `launch-step.py`. That launcher runs commands in `/home/morgana/.codex/worktrees/final-combat-proof/orcs-vs-Fairies` and retains argv, raw output, exit, executable identity and the actual HEAD. Check its copied SHA-256 against the retained `3ea6c74f53dddf6a10361c791f231200c5e33468cfa7a6db1aace9573cc81f14`. Copy the checker to the external parent from its full docs commit; its first gate requires those executing bytes to equal that committed source.

Set `ACCEPTANCE_ROOT` to the owned checkout, `ACCEPTANCE_PIN` to the full c074 runtime pin and `ACCEPTANCE_RUN` to the fresh external parent. Set `ACCEPTANCE_DOCS_ROOT` to a repository containing this preparation commit and `ACCEPTANCE_DOCS_PIN` to that separate full commit. The docs root may be the same Git repository; its checkout HEAD does not redefine the runtime pin. Use the following argument order. The shell snippets are reference material; none has been executed for this retry.

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
```

Root must release owned port 5397 and the heavy slot before starting the production preview. Verify that port is free. Start the preview separately, retain its argv, PID/process group, source pin and stdout/stderr, and confirm readiness. Keep protected port 4173 untouched.

```sh
cd "$ACCEPTANCE_ROOT"
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5397 --strictPort
```

Use the retained browser paths, then run all three native groups serially through the same browser stage. The first passing rock case must show target visibility/level, retained pointer context, the accepted native attack and replay command, and 8.7 first-hit damage. No later gameplay command may bypass native DOM, pointer or keyboard controls. `window.rts` remains observation-only.

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
```

The offline history stage must receive the original frozen-input contract as its final argument. It requires completed browser evidence and compares complete original native `.game` envelopes, including runtime. A failure ends the serial recipe; preserve raw artifacts and the first screenshot/state before any repair or rerun. Close only the owned preview, retain cleanup and direct port checks, inspect every screenshot and bind all final artifacts. Submit complete native results for independent admission before requesting root's separate packaged CLI projection stage. Do not add an outer-planning CLI equality claim.

The acceptance scope remains 39 authored encounters: 22 direction/defense, five capture/ambush/morale and 12 specialist/lifecycle. SAVE4 and simulation revision 4.0.1 remain required. Record the actual selected Playwright package and Chromium version for the new run rather than carrying forward the second run's browser version.

## Attention

Reviewed rock proof source and second-failure archive: GPT-5.6 Sol. Fresh runtime acceptance of all 39 encounters remains open. The candidate product comparison and this recipe do not admit the pending UI regression or release the heavy execution slot. Independent admission of this preparation remains pending.
