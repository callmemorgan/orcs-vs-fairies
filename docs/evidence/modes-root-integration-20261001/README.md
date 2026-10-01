# Root objective modes proof

This proof ran on canonical root `ff009bf`, after the specialist, layered-world and scenario binding integrations, with SAVE_VERSION 3 and simulation revision 3.2.0. The earlier `assembled-modes-20261001` evidence remains pinned to its original isolated source. Final SAVE4 and whole-branch certification remain open.

The canonical production browser passed 12 recorded checks in three browser profiles, with no page errors. The local Lantern Keepers hill game accepts the exact custom draft pick, keeps ticks advancing while Objectives owns battlefield input, accepts normal canvas movement and reimports its exported replay through session tools. Photo mode hides the objective launcher. The actual hosted lobby preserves both selected starting definitions. Host collect and drop requests have matching accepted server receipts; the guest sees the public relic objective. Root opened the local draft, collected relic and guest objective screenshots and checked readable controls and toolbar placement.

Five objective fixtures finish through the actual simulation. Complete authoritative save SHA-256 comparisons match on every resumed tick and at each replay endpoint. Hill duel finishes at tick 713, relic duel at 867, contested relic at 1045 and hill 2v2 at 826. Five survival waves finish at tick 11097, with continuation from tick 300 and recovery checkpoints 7119, 7569, 8328 and 10075. These results establish objective victories separately from the browser controls. The relic-duel opponent is external; contested relic uses two active AIs.

`served-build.json` records hashes of the served JavaScript/CSS, the server bundle and the source files. Root fetched served assets and compared them byte-for-byte with the local build. The isolated root proof server used port 9284 and a dedicated data directory, then stopped; a direct socket check confirmed that port closed. The user preview on 4173 and existing root server on 8788 were untouched.

The production and server builds pass; `tests.log` records 56 passing tests across five mode/modal/scenario files. These focused tests do not establish full-suite success. Historical replay projection remains open.

Reproduce from the source checkpoint:

```sh
npm run build
npm run build:server
node_modules/.bin/esbuild scripts/modes/verify-runtime.ts --bundle --platform=node --format=esm --outfile=work/modes-root-runtime.mjs
OVF_MODES_EVIDENCE=work/modes-root-runtime node work/modes-root-runtime.mjs
RTS_PORT=9284 RTS_DATA_DIR=work/modes-root-server RTS_STATIC_DIR=dist node dist-server/rts-server.js
OVF_MODES_BROWSER_EVIDENCE=work/modes-root-browser node scripts/verify_assembled_modes.mjs http://127.0.0.1:9284
```

Set OVF_PLAYWRIGHT_MODULE to an available Playwright module when it is outside the project dependencies. Run the server and browser verifier in separate terminals, then stop only that proof server. The runtime verifier enforces all save/replay comparisons. Browser receipt and profile data are retained in `browser/results.json`.
