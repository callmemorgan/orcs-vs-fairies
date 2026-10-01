# Native combat acceptance preparation

This is script preparation for a new production run. It contains no new gameplay results. The historical rules 4.0.0 archive at `docs/evidence/frozen-native-combat-af44da4-20261001/` remains separate. Root is fixing two AI defects under rules 4.0.1 and owns the next combined source freeze and execution slot. No fixture generation, production build, engine simulation, browser proof or CLI proof may start before that dispatch.

The new scripts prepare 39 authored encounters. Each group declares its setup exceptions in its manifest and the retained plan. All later player commands use native HUD, Tactics, World, Faction, pointer or keyboard controls. Browser evaluation observes state and computes coordinates; it does not change simulation state or call scene methods.

| Group | Authored encounters | Native acceptance |
| --- | ---: | --- |
| Direction and defense | 22 | First front/side/rear hits; directional shields and natural depletion; terrain/building cover and siege demolition; friendly fire on/off; charge, stopping, turning and pike direction; four mixed-role formations routing around an obstruction and reforming after a real casualty. |
| Capture, ambush and morale | 5 | Full 42-point crew defeat; incomplete capture restored and completed; new owner moves and fires the original engine; pending-shot continuation; surrender and movement; active retreat and recovery; native ambush role/radius, observer concealment, scout disclosure, release and timber removal. |
| Specialists and lifecycle | 12 | Six factions' commander/cavalry/siege abilities and pending/active exports; earned veteran insignia and one accepted promotion; commander death, artifact drop, recovery and paid rerecruitment; artifact combat damage; paid crossing/obstruction and expiry; beacon alert, combat link destruction and sight loss. |

`native-context.mjs` checks the complete `.game` envelope, including runtime, at fixture import, save round trip and replay endpoint. It restores the original live save after replay inspection so later native controls continue the same history. The browser captures original downloads with hashes and screenshots. Its final native bug report must name the source build ID and current save/rules identity.

`build-native-helpers.mjs` compares the complete `src` and `scripts/acceptance` inventory and raw bytes to the full Git pin before bundling. It retains both esbuild input graphs, bundle hashes, source/config fingerprints, resolved compiler JavaScript/native binary hashes and the locked compiler version. The fixture and observer launchers independently rebuild each helper from those pinned inputs and require identical bundle bytes and dependency graphs before import. The freeze checks the full generated fixture inventory and reproduces its files from the verified producer in a fresh temporary directory. It also checks committed source/proof/config bytes, dynamic rules revision and production HTML/JavaScript/CSS. The browser requires observed script/style responses, including JavaScript MIME types, to match sealed same-origin production files and blocks service workers. This proves the observed network responses; it does not claim a general audit of arbitrary code evaluation.

`verify-native-history.mjs` validates every original native save download through the strict decoder, full round trip, checksum and unprojected replay endpoint. It also executes retained specialist checkpoint suffixes, the capture group's four checkpoint continuations and the direction group's per-command/per-tick audit. No controller projection occurs in those comparisons. Packaged CLI parity remains a separate scheduled step through the already admitted projection adapter and packaged driver; no new driver or outer-planning CLI equality claim is included.

The initial preparation passed `node --check` for all eleven JavaScript modules and this type check:

```sh
node_modules/.bin/tsc --noEmit --strict --esModuleInterop \
  --target ES2022 --module ESNext --moduleResolution Bundler \
  --lib ES2022,DOM --types node --skipLibCheck \
  scripts/acceptance/native-fixtures.ts scripts/acceptance/native-audit.ts
```

These checks establish syntax and types. Native behavior, producer execution, bundled helper loading and the new provenance checks remain unexecuted. Independent script admission and root's combined rules 4.0.1 pin are required before the following recipe is run.

## Scheduled execution recipe

Run from an isolated checkout at the full combined pin that includes these admitted scripts. Use a fresh evidence parent and retain command stdout, stderr, exit codes and executed binary identities. Helper bundles, generated fixtures and evidence belong outside the checkout. The production build writes its ignored `dist` directory inside the isolated checkout. Root assigns the preview slot and ensures another heavy proof is not running.

```sh
ACCEPTANCE_ROOT="$PWD"
ACCEPTANCE_PIN="$(git rev-parse HEAD)"
ACCEPTANCE_RUN=/tmp/ovf-native-acceptance-new-run
mkdir "$ACCEPTANCE_RUN"

node scripts/acceptance/build-native-helpers.mjs \
  "$ACCEPTANCE_ROOT" "$ACCEPTANCE_RUN/helpers" "$ACCEPTANCE_PIN"
node scripts/acceptance/generate-native-fixtures.mjs \
  "$ACCEPTANCE_ROOT" "$ACCEPTANCE_RUN/helpers/fixtures.mjs" \
  "$ACCEPTANCE_RUN/fixtures" "$ACCEPTANCE_PIN"
npm run build
node scripts/acceptance/verify-native-acceptance.mjs --freeze \
  "$ACCEPTANCE_ROOT" "$ACCEPTANCE_RUN/fixtures" \
  "$ACCEPTANCE_RUN/frozen-inputs.json" "$ACCEPTANCE_PIN"
```

Start the owned production preview on root's assigned port. Set `OVF_PLAYWRIGHT_MODULE` to the verified installed Playwright module and `OVF_CHROMIUM_EXECUTABLE` to its matching Chromium executable. The browser recipe below shows the previously used port; root must release that slot first.

```sh
node scripts/acceptance/verify-native-acceptance.mjs \
  http://127.0.0.1:5397 "$ACCEPTANCE_ROOT" \
  "$ACCEPTANCE_RUN/browser" "$ACCEPTANCE_RUN/fixtures" \
  "$ACCEPTANCE_RUN/frozen-inputs.json" "$ACCEPTANCE_RUN/helpers/audit.mjs"
node scripts/acceptance/verify-native-history.mjs \
  "$ACCEPTANCE_ROOT" "$ACCEPTANCE_RUN/helpers/audit.mjs" \
  "$ACCEPTANCE_RUN/fixtures" "$ACCEPTANCE_RUN/browser" "$ACCEPTANCE_PIN" \
  "$ACCEPTANCE_RUN/frozen-inputs.json"
```

An optional final comma-separated browser argument selects `direction`, `capture` or `specialists`. Each selected run requires a fresh browser output directory and receives its own history audit. A failed run retains its first receipt, last readable state and failure screenshot; diagnose it before changing production or rerunning. Close the owned preview, check the port has no listener, inspect every screenshot, retain source/download/artifact hashes and submit the final archive for independent admission. Root alone updates the canonical feature ledger and decision trail.

## Attention

GPT-5.6 Sol is assigned to independent admission, which remains pending. The preparation checks do not prove any of the 39 new encounters works in production.
