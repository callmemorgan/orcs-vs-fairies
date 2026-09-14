# Orcs vs Fairies

A browser RTS with six playable factions, seeded maps, three resources and a terminal interface for game-playing agents. Build a settlement, gather resources, recruit an army and destroy the enemy stronghold. Any faction can face any other, including itself.

The battlefield renders at the display pixel density (up to 2×), with crisp texture sampling when zoomed. Density is chosen when a match starts; start a new match after moving to a display with a different scale.

The game uses Phaser, TypeScript and Vite. Its simulation runs independently of the renderer. All factions have four unit types and four building types, with Blender-rendered models, eight-direction unit animations and selection artwork. ImageGen references and editable Blender sources are included.

## Run locally

Use Node.js 22 or later and npm.

```sh
npm ci
npm run build
npm run preview -- --port 4173
```

Open [the production preview](http://127.0.0.1:4173). Rebuild and reload after changing source. For development with live reload, run `npm run dev` and open [the development server](http://127.0.0.1:5173).

On this workstation, the preview is managed by the user service `orcs-vs-fairies.service`, which starts at login and restarts after failures. Use `systemctl --user status orcs-vs-fairies` to check it, `systemctl --user restart orcs-vs-fairies` to restart it, or `systemctl --user disable --now orcs-vs-fairies` to turn it off. Do not start a second preview on port 4173 while the service is running.

Choose your faction, AI opponent, map size and seed in the menu. Small maps are 36 × 36 tiles, medium 48 × 48 and large 64 × 64. A seed reproduces the terrain and resource layout. Starting locations and resource placement are rotationally symmetric.

## Factions and resources

| Faction | Defining behavior |
| --- | --- |
| Ironclad (Orcs) | Armored troops build Fury through sustained attacks. |
| Wild Court (Fairies) | Fast troops, temporary illusion doubles and healing Moonwells. |
| Deepforge (Dwarves) | Troops emplace for armor and damage; cannons also gain range. Moving packs up the position. |
| Ashen Host (Undead) | Cheap ranks protect Gravecallers, who consume nearby corpses to raise temporary warriors. |
| Tideborn | Troops cross mud and shallows quickly. Tidecallers heal nearby allies and grant a short movement burst. |
| Automata | Shields recharge after a break in combat. Ward Engines restore nearby friendly shields. |

Wood and ore fund the opening economy and basic troops. Crystal funds special units and defensive towers. Workers return all three resources to a completed headquarters or depot. The limited home crystal deposits give armies a reason to contest deposits farther out.

Roads speed movement; mud and shallows slow most factions. Bridges cross water, while deep water and cliffs block movement. Buildings require visible grass or road across their entire footprint. Fog hides unseen enemies and terrain; resource deposits retain their last observed amounts until seen again.

## Controls

Drag to select units, Shift to add to selection, and right-click to move, gather, repair or attack. A then click orders attack-move. F2 selects your combat units. X cancels orders; H holds position without pursuing enemies. Q activates selected abilities. Escape cancels placement or attack-move.

Use arrows or W/S/D to pan; A pans left when no units are selected. Middle-drag pans, the mouse wheel zooms, and Space centers the headquarters. Ctrl+number saves a control group; number recalls it. Click the minimap to center the camera. Select a headquarters or barracks and right-click open ground to set its rally point. A flag marks the destination while the building is selected; new recruits move there automatically. Use Clear rally to return to leaving recruits outside the building.

Construction and recruitment appear as illustrated commands when a worker or production building is selected. Z/C/B/V trigger the displayed construction slots; Z/C/B trigger recruitment slots. Mixed selections have Build and Recruit tabs. Hover or focus a command for its description, cost, shortcut and unavailable reason. The selection bar shows portraits, health, construction and recruitment progress. Click a recruitment queue portrait to cancel that entry for a full resource refund. Canceling the active entry resets progress for the next unit; canceling a waiting entry leaves active progress intact. Click a roster portrait to select that unit, or Shift-click to remove it. Saved groups also have clickable buttons.

A selected headquarters also researches worker upgrades under the Recruit tab: Harvest Drills gathers 30% faster and Courier Training moves 20% faster. Research runs alongside recruitment and costs are paid up front.

The resource bar shows wood, ore, crystal, population and places reserved by recruitment. Depots increase capacity. The sound toggle controls synthesized interface and combat cues and persists across reloads. The desktop UI supports 1280 × 720 and larger screens. See the [UI overhaul report and before/after screenshots](docs/UI_OVERHAUL.md).

## Terminal agents

The persistent CLI accepts newline-delimited JSON for starting, observing, commanding, advancing and obtaining results. It defaults to controlling side 1, the computer's usual side, against the built-in AI. Its observations omit hidden enemies and enemy economy or production details. Commands use the ordinary ownership, visibility, cost and population checks.

```sh
npm run build:cli
node dist-cli/rts.js --log work/my-match.ndjson
```

The Python example plays a complete match through those observations and commands:

```sh
python3 scripts/agents/example_agent.py \
  --faction automata --opponent tideborn --map-size small --seed 4127 \
  --log work/automata-match.ndjson
node dist-cli/rts.js --replay work/automata-match.ndjson
```

See [the protocol and examples](docs/TERMINAL_AGENTS.md). The [six-faction CLI evidence](docs/evidence/terminal-v6/summary.json) includes complete games and verified command replays.

## Verification and evidence

```sh
npm test
npm run build
npm run build:cli
LADDER_RUN=six-factions-my-run npm run test:ladder
```

The ladder covers all 36 ordered faction pairings on three map sizes and two seeds, for 216 games. Each run preserves its source snapshot and refuses to overwrite an existing run. `LADDER_SEEDS` and `LADDER_SIZES` accept comma-separated subsets. Reports include outcomes, lengths, side advantages, resource use, timeouts and suspected movement stalls. These deterministic AI samples do not establish competitive balance.

See [the expansion report](docs/EXPANSION_DAY.md), [the final ladder](docs/evidence/six-factions-final-v6/REPORT.md), and [remaining limitations](docs/KNOWN_LIMITATIONS.md). The original [64-game ladder](docs/evidence/ladder-64/REPORT.md) remains unchanged. Earlier four-faction and two-faction evidence is historical.

For local QA, `?qa=1` on the numeric loopback host records read-only snapshots through the Vite middleware to `work/browser-session.jsonl`. It does not issue commands or alter the economy. Ordinary play needs no backend. A snapshot alone does not prove the preceding player actions; browser observations and the evidence record provide that context.

## Assets and architecture

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-assets.txt
./scripts/generate_assets.sh
```

Use `--pack-only` to reuse complete rendered frames. The serial generator covers all six factions and terrain assets, then packs and validates the output. [Regeneration instructions](docs/REGENERATING_ASSETS.md) describe dependencies, targeted model revisions and expected outputs. Reference sheets are in `art/reference/`; source scripts and editable scenes are in `art/blender/`.

Faction data defines rosters, costs, stats, abilities, shields, terrain speed and AI composition. Core simulation positions use world coordinates; the isometric projection belongs to the renderer. Browser players, built-in AI and terminal agents share command validation. Only the two factions in a match load their animation atlases, reducing texture use compared with loading all six.

Multiplayer, campaign, heroes, save/load, mobile controls and public deployment are outside this build. Replay verifies a command history against the same simulation version; it is not a cross-version save format.
