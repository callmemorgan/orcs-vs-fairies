The production browser proof runs the normal HUD, battlefield clicks, technology tree, and Session Tools against an authored encounter imported as a native save. The scripts read `window.rts` to check results; they do not write game state or invoke game commands through JavaScript in the page.

`browser-proof.json` records each action's ticks and the observed result. It covers all six factions' cavalry and siege abilities, targeted commander abilities, paid Queen Lyra recruitment, the queued commander limit, earned combat experience and promotion, artifact recovery/equipment/drop controls, Ranged Arms research, the Focused Volleys branch lock, connected beacon status, temporary engineer construction and paid repair. The exported save and replay preserve the final tick, promotion, equipped artifact, research, and both temporary structures. `native-save-import-proof.json` checks the exported save in a fresh browser, including the alive commander limit and the completed branch lock. These browser checks exercise the surface map; the simulation and save tests cover the other rejection and timing paths.

The tested game source is isolated commit `1aa0f24433289627b4e931d064328a1c505db587`, with the UI and core changes cherry-picked onto `27a7e99`. `source-manifest.json` records the source, build, script, fixture and exported-file hashes. The PNGs are browser screenshots inspected after capture. The assembled root checkout needs its own run after integration.

To reproduce from the repository root, build the encounter and production bundle, start an isolated preview, then run both checks. `OVF_PLAYWRIGHT_MODULE` can point to another installed Playwright module.

```sh
npx esbuild scripts/specialists/scenario.ts --bundle --platform=node --format=esm --loader:.svg=text --outfile=work/hundred-features/specialists/scenario.mjs
node work/hundred-features/specialists/scenario.mjs
npm run build
npm run preview -- --port 5187
```

In another terminal:

```sh
OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs node scripts/verify_specialists.mjs http://127.0.0.1:5187
OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs node scripts/verify_specialists.mjs http://127.0.0.1:5187 --verify-exported-save
```

The encounter starts in Citadel Age with resources and completed buildings. Engineers, cavalry, siege engines, and the five non-Fairies commanders are authored starting units. Queen Lyra is recruited through the barracks at the normal cost and training time. Experience, promotion choices, research completion, equipment changes, ability effects and temporary construction occur during the browser run.
