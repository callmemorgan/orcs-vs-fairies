# World verification in the main application

The main checkout at `83b4db6`, with the retained `source-diff.patch`, passed twelve menu and traversal checks plus thirteen world action checks on the existing production preview at port 4173. Both browser error arrays are empty. `served-build.json` compares the served HTML, JavaScript and CSS bytes with the built files and pins the application source hash. This run includes the canonical tournament dashboard and shared session toolbar, unlike the earlier isolated world proofs.

The normal controls launched four biomes, traversed both directions between surface and cave, selected troops with a controller, centered the stronghold on its level, bought village services and defenders, cleared a monster den, captured a cavern relic and exported that progress. Native controls also consumed finite timber through fire, cleared a firebreak, destroyed and rebuilt a bridge, advanced the calendar to dusk, and warned of a winter crossing before rescuing its injured worker on thaw. The cavern relic screenshot was inspected. The exported SAVE3 checkpoint is preserved byte-for-byte in `world-browser-save.json.gz`; regenerate fixtures after the combined SAVE4 migration.

`tests.log` records 264 passing integration tests across world, content, planning, saves, replays, server and tournament paths. `toolbar-tests.log` records the dashboard component regressions. The production build passed. This is a focused integration result, not a whole-branch regression pass.

Two earlier root browser attempts failed because the Tournaments launch control intercepted the World summary. Their reports and logs are retained under `failures/`. Moving the button into the session toolbar still allowed a wrapped row to overlap World. The final fix measures the toolbar and positions the World panel below it. The same feature assertions passed on the third attempt.

Repeat with a current production build, freshly generated `scripts/world/generate-browser-fixtures.ts` fixtures and a new evidence directory:

```sh
OVF_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/verify_world.mjs http://127.0.0.1:4173 NEW_DIRECTORY
OVF_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/verify_world_actions.mjs http://127.0.0.1:4173 NEW_DIRECTORY
node scripts/verify_served_build.mjs http://127.0.0.1:4173 NEW_DIRECTORY/served-build.json
```

Final SAVE4, combat, economy and modes integration will require another assembled run.
