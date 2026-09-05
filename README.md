# Orcs vs Fairies

A fantasy real-time strategy game with visually and mechanically distinct orc and fairy factions.

The local skirmish includes the complete Blender-rendered world assets and both factions against AI. Browser verification covers victory, defeat, restart and the RTS controls. The current Fairy defensive match ended at 13:25 with continuous telemetry; earlier faction matches provide additional outcome evidence. All 61 rule tests pass, and the production build reproduces byte-for-byte. The current 100-unit/1080p measurement is 58.53 FPS against the 60 FPS target. Orc-favored combat balance and visual overlap remain documented limitations. See docs/KNOWN_LIMITATIONS.md and docs/REQUIREMENTS.md for the evidence and scope.

## Agreed direction

- Browser delivery, single player against AI.
- Warcraft-style base building, resource gathering, and small armies.
- Painterly 2D artwork with a fixed isometric camera.
- Generated images establish visual references before production assets.
- Make the gameplay work with placeholders first, then create and render the game assets in Blender and integrate them.

## Technology

Phaser 4.2.1 with TypeScript and Vite. Keep the simulation independent from rendering so economy, combat, pathfinding, and AI can be tested without a browser. Browser tests must also exercise the actual player controls.

Blender source scenes and Python scripts produce transparent sprite sheets from a consistent orthographic camera, lighting setup, scale, and ground anchor. Moving units use eight facing directions and idle, movement, attack, and death animations. Export metadata alongside the images. Use stylized materials and lighting to match the generated painterly references; inspect the sprites at actual gameplay size.

## First milestone

One complete skirmish map, either faction playable against the other, with a target match length of 10–15 minutes. Each faction has a worker, three combat unit types, and four building types: headquarters, resource drop-off, production, and defense.

Include resource gathering, construction, production queues, population limits, selection and drag selection, right-click orders, attack-move, control groups, camera pan and zoom, minimap, fog of war, win/loss, and restart. The AI must gather, build, recruit, and attack using the same economy and visibility rules as the player.

Agreed initial identity: orcs use armored industrial silhouettes and gain momentum through sustained combat; fairies use woodland silhouettes, mobility, illusions, and healing groves. These are initial content choices, not permanent engine constraints. The milestone roster is one worker and three combat roles per faction.

## Architecture requirements

Keep faction definitions separate from the core RTS systems. Define rosters, costs, stats, construction rules, ability assignments, presentation references, and AI preferences as validated content data with stable identifiers. Core movement, economy, production, targeting, and combat must not branch on faction names.

Implement abilities through reusable behaviors and effects, with explicit code extensions for mechanics that existing behaviors cannot express. Avoid building a general-purpose ability language in the first milestone. Changing faction identity should primarily change content definitions and assets; a genuinely new mechanic may still require code.

Separate simulation state and player/AI commands from Phaser presentation. Both human and AI players use the same command validation and game rules. Simulation positions and navigation use world coordinates; isometric projection belongs to presentation. Asset manifests map content identifiers to sprite sheets, animation clips, facing directions, and anchors, so replacing art does not change gameplay rules.

Use a fixed simulation step and seeded randomness to make core behavior reproducible in tests. This supports debugging and later features but does not promise multiplayer compatibility. Verify that an alternate faction configuration can change a roster, an ability assignment, and its artwork without modifying core systems, then verify the resulting behavior in the running game.

## Milestone scope

Build a complete browser-playable skirmish of Orcs vs Fairies in this directory using Phaser and TypeScript. Follow the agreed art and gameplay direction. Generate reference sheets for both factions and the battlefield, then implement and verify a full match with placeholder assets. After the gameplay works, create reproducible Blender sources and render scripts for the scoped world assets, integrate the rendered sprites, and visually inspect both factions in play. Deliver a local playable build, editable sources, asset regeneration instructions, and evidence from real browser matches as both factions. Verify selection, orders, harvesting, construction, recruitment, combat, fog of war, AI, victory, defeat, and restart. Target 60 FPS at 1080p with 100 total units on this computer and report measured performance. Do not call the milestone complete with placeholder world assets or failed core gameplay checks.

Exclusions for this milestone: multiplayer, campaign, heroes, save/load, mobile controls, and public deployment. Basic combat and interface audio is in scope. These exclusions define this milestone, not the eventual game.

## Sources

- Phaser: https://phaser.io/
- Phaser documentation: https://docs.phaser.io/
- Blender CLI: https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html

## Local development

Use Node.js 22 or later and npm.

```bash
npm ci
npm run dev
```

Open http://127.0.0.1:5173 in a desktop browser. Both factions use the complete Blender-rendered artwork.

```bash
npm test
npm run build
npm run preview -- --port 4173
```

The production preview at http://127.0.0.1:4173 does not reload when source changes. Rebuild and reload it to test updated source. Browser verification uses this fixed build so an in-progress match is not interrupted by development updates.

For local QA only, adding `?qa=1` on the numeric loopback host records read-only game snapshots in `work/browser-session.jsonl` through the local Vite middleware. It does not grant resources, issue commands or change outcomes. Production builds need no backend for ordinary play. The latest snapshot is not a standalone proof of the actions that preceded it; use the browser observations and gate record together.

## Controls

Drag to select units, Shift to add to selection, and right-click to move, harvest, repair or attack. Press A then click for attack-move. Use arrows or W/S/D to pan; A pans left when no units are selected. Middle-drag pans, mouse wheel zooms, and Space centers the headquarters. Ctrl+number saves a control group; number recalls it. X stops current orders (units may pursue nearby enemies); H holds position and attacks only within weapon range. Q activates their available abilities, and Escape cancels placement or attack-move. Build and recruitment commands appear in the bottom-right panel for the selected worker or production building.

## Asset tools

The image reference is in `art/reference/`. Blender model scripts and editable scenes are in `art/blender/`; the production process and export coordinates are documented in `docs/ART_PIPELINE.md`.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-assets.txt
.venv/bin/python scripts/check_asset_packer.py
.venv/bin/python scripts/pack_assets.py
.venv/bin/python scripts/validate_assets.py
```

Packing requires complete rendered input under `art/blender/raw/`. The validator checks all scoped assets and animations. The full generation command has completed successfully; see docs/evidence/ASSET_REPRODUCTION.md for validation and measured render differences.

The complete serial Blender render and packing command is documented in [Regenerating assets](docs/REGENERATING_ASSETS.md).

Press F2 to select all living combat units without selecting workers. Mute sound toggles the synthesized interface and combat cues; the preference persists across reloads. Sound starts after a player gesture.
