# World verification

This branch implements the terrain and neutral-world group, features 41–50, with elevation support for feature 3. Its production checks exercise four procedural biomes, two connected levels, neutral battles and services, world commands, checkpoint export, fire, destructible bridges and seasonal crossings. This evidence applies to the isolated world branch before the combined SAVE4, registry, combat and online integration.

## Reproduce

The shared `src/core/geometry.ts` comes from root numeric commit `d1171b9`; world commit `df9fecd` uses its fixed distance and direction exports. Weather selects one fixed direction from the saved seed and weather interval. Older SAVE3 recordings use the previous implicit wind schedule; the combined foundation owns their version policy.

```sh
npx vitest run tests/world-interruptions.test.ts tests/environment.test.ts tests/world-map.test.ts tests/neutral-world.test.ts tests/neutral-world-integration.test.ts tests/navigation.test.ts
npm run build
npm run build:cli
npm run build:server
npm run preview -- --port 5365
npx esbuild scripts/world/generate-browser-fixtures.ts --bundle --platform=node --format=esm --outfile=work/world-browser/generate.mjs
node work/world-browser/generate.mjs
OVF_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/verify_world.mjs http://127.0.0.1:5365
OVF_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/verify_world_actions.mjs http://127.0.0.1:5365
```

All 94 tests in the focused command pass. They include 48 generated biome/seed/roster combinations, level-aware navigation and combat, high-ground damage/reach/sight, actual bridge destruction and paid reconstruction, finite neutral rewards, village defenders and raids, relic recapture, fire, thaw rescue/drowning, exact resumed checksums and replay traversal. Eight interruption regressions start from validated checkpoints, use public commands and ordinary ticks, then require valid saves and 20 identical resumed ticks. The environmental regression destroys, freezes, rebuilds, destroys and re-freezes a crossing during one winter before saving and restoring it.

Browser, CLI and server production builds pass. The Vite build reports the existing large-bundle warning. The default full test command reported two 5-second timeout failures in the Tideborn/Automata AI recruitment tests; those timeouts reproduce in a separate checkout with unchanged `b7b3ba9` core. They are recorded separately from the 94 passing world checks. Combined integration must repeat its required checks with an appropriate simulation-test timeout.

## Production evidence

`docs/evidence/world-systems-20261001/browser-world.json` contains 12 successful checks. Each biome launches through the ordinary menu, selects a displayed troop, traverses a real entrance, explores independently underground and returns. The script uses displayed controls and read-only inspection of the resulting game state.

`docs/evidence/world-systems-20261001/browser-world-actions.json` contains 13 successful checks. It imports authored valid checkpoints through the normal Save UI, then uses displayed controls, keyboard input and recorded controller input. It verifies level following during controller selection and stronghold centering; the 80 wood/20 ore village request; finite supplies and a recruited defender; two real den creature deaths and the exhausted reward; cavern relic capture; a native exported checkpoint; finite timber burning and worker firebreak work; bridge collapse and paid rebuilding; dusk; a visible winter countdown; and spring rescue of an injured worker. Both scripts finish with an empty page-error list.

Screenshots show the cave army and owned relic, surface fire and rebuilt bridge, and the rescued worker beside the thawed lake. The final worker has 63.75 of 85 health, an idle order, a legal bank position and no remaining seasonal ice entries. Earlier action-script failure files are uncommitted scratch evidence from a corrected selector that expected "Save imported" instead of the application's "Save loaded" notice.

## Integration contracts

The central simulation must invoke the environment and bridge interruption callbacks through its ordinary assignment cleanup. Attack completion must check levels even when the target remains visible through another friendly troop. Bridge rebuilding must claim and charge reconstruction after a previously live repair target collapses, and release paid abandoned claims without refunds.

The combined combat implementation owns projectile launch costs and calls `igniteWorldAt` at a saved incendiary impact, including a removed launcher. It must apply height, weather and relic modifiers once. The economy integration owns sapling destruction through `burnEconomyAt` during fire and firebreak exposure. The authoritative online view must carry filtered world layers and visible world objects to the renderer. AI entrance choice and combined online world behavior have not been proved by this branch's local browser checks.
