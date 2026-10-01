# Faction encounter evidence

This branch runs faction mechanics through `issueCommand`, `stepGame`, `saveGame`, `loadGame` and `PlayerView`. The 32 faction encounters exercise real attacks, payment, construction, transport, corpse conservation, decay, terrain restoration, visibility and shield networks. They include mid-operation saves and replay checks. The 27 faction UI tests click the mounted controls and issue real commands.

The latest retained regression result is 242 passing tests in nine files. Browser, CLI and server builds pass. The separate browser-fixture TypeScript check passes. `build.txt`, `cli-build.txt`, `server-build.txt`, `fixture-types.txt` and `encounters.txt` contain those outputs.

The mounted Phaser browser fixture passes 27 checks with zero page errors. `browser/results.json` contains the actual initial and final state, asserted checks and SHA-256 hashes of the simulation, panel, renderer and fixture sources. Screenshots show the mounted controls and battlefield markers. Screenshots ending in `battlefield` hide only the fixture's diagnostic card; the real faction panel remains open. The fixture uses placeholder art, scripted initial selection and documented initial resources, Fury, trophies and a Gravecaller cooldown. It proves commands and rendering in that fixture. The browser proof does not show how Fury or trophies were earned; the encounter tests do.

Rerun the retained regression command:

```sh
npx vitest run tests/faction-systems.test.ts tests/faction-tools.test.ts tests/combat-tactics.test.ts tests/tactics-tools.test.ts tests/factions.test.ts tests/saves.test.ts tests/replays.test.ts tests/team-observation.test.ts tests/online-render-state.test.ts --testTimeout=30000
```

Run the mounted browser fixture with Vite, then `OVF_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs OVF_FACTIONS_URL=http://127.0.0.1:5297 node scripts/verify_factions.mjs`.

The parent must combine registry definitions and authored art with the local fallback resolver, connect level-aware placement and terrain mutation, and invoke the world's ignition effect at incendiary impact. Incendiary fitting payment, ammunition payment, delayed damage and source-removal persistence are verified here; burning terrain is pending. Main-app mounting, combined save/replay rules, final multiplayer behavior and the current-source ladder require assembled-source verification. Online hydration now preserves disclosed owned tactics, faction state and queues while stripping undisclosed hostile fields. Remote rendering still needs to trust the server's actor visibility decision because enemy hit timestamps remain private.

## Attention

reviewed by GPT-5.6 Sol

The branch evidence supports these local encounters and authored browser fixtures. Treat world levels, registry art, actual ignition, the mounted final app, multiplayer snapshots, combined save/replay compatibility and the fresh AI ladder as pending until the assembled source is verified.
