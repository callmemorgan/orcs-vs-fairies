# Dwarves and Undead

This expansion adds two factions to the existing skirmish map and allows any player faction to face any AI faction, including itself. The scope is four units and four buildings per faction, one defining mechanic each, complete artwork, AI support, browser controls and initial balance verification. Multiplayer, campaigns, maps, game modes and competitive balance are excluded.

## Dwarves: Deepforge

Masons gather resources and build Mountain Keeps, Supply Vaults, Gunsmith Halls and Gun Bastions. Shieldguards protect Thunderlocks and Siege Cannons. The cannon deals extra damage to buildings.

Emplace / Pack up (Q) changes a combat unit to hold position. After three seconds it gains three armor and 25% damage; cannons also gain three range. A move, attack-move, direct attack or halt order packs the unit up immediately. Q also packs up. The gold ground frame and preparation bar show the state. Holding an already emplaced unit preserves preparation. The AI prepares within its potential firing range and packs up when no visible target remains. Its recruitment preferences reserve a larger share of the army for cannons.

## Undead: Ashen Host

Gravediggers gather resources and construct Necropolises, Ossuaries, Crypts and Soul Spires. Boneguards and Gravebows screen the Gravecallers.

Raise Fallen triggers automatically when an eligible corpse is available, or through Q. It consumes up to two visible corpses within six tiles to summon half-health Boneguards for 35 seconds, with a 22-second cooldown after a successful cast. Each summon occupies one population slot; queued recruits retain their reserved slots. Corpse use is exclusive. Buildings, illusions and raised troops do not leave reusable corpses. Ordinary unit corpses expire after 45 seconds. The battlefield marks them with crossed bones; raised units have a teal ring and a remaining-lifetime status in the selection panel.

## Artwork

ImageGen produced `art/reference/dwarves-and-undead.png`, using the existing faction concept sheet as a style reference. The exact prompt is in `art/reference/expansion-prompt.md`. Preliminary Blender geometry existed before this sheet; work paused for the reference and the geometry was revised against it before production rendering.

`art/blender/expansion.py` creates named editable Blender models, baked actions and rendered animation frames through the existing common projection, lighting and supersampling pipeline. The image reference is not used as a game sprite. Selection portraits are crops of the Blender renders produced by the asset packer.

Generate only the new faction renders:

```bash
blender --background --factory-startup --python-exit-code 1 --python art/blender/expansion.py -- --all
.venv/bin/python scripts/pack_assets.py
.venv/bin/python scripts/validate_assets.py
```

Use `--sample` for idle, attack and death samples, or `--asset dwarf-melee` to regenerate one asset. The existing full `scripts/generate_assets.sh` command includes the expansion. Run generators sequentially; do not pack while rendering is in progress.

## Verification status

All 102 tests pass: 59 existing rule regressions, 27 faction tests and 16 complete AI matches. Every ordered pairing, including mirrors, ends through headquarters destruction. Both sides complete all building types, recruit all unit roles and deal damage with every combat role. Every Dwarf army lands emplaced attacks; every Undead army lands attacks with raised troops. [Match evidence](evidence/FACTION_MATCHES.md) includes results, balance adjustments and remaining matchup advantages. The source hashes and detailed role counts are in `evidence/FACTION_MATCHES.json`.

The final asset validator passes for 47 world assets, 3,152 frames and 48 atlases, with four Blender-derived faction portraits. See `evidence/FACTION_ASSETS.json`. All 47 assets loaded in the browser. The complete atlases decode to 484.25 MiB, which is a memory concern; this expansion has no new 100-unit performance benchmark.

Browser play exercised Dwarves against Undead through defeat at 6:03, and Undead against Dwarves through defeat at 7:15. Both matches used ordinary UI commands for gathering, construction, recruitment and combat. The Dwarf command panel showed preparation and emplacement; the Undead match showed raised troops, ability cooldown and enemy Dwarf emplacement. The Undead tower foundation was destroyed before completion. Both new rosters recruited all three combat types. Restart returned to faction selection after each defeat. These are two human-controlled matches, not 16 human-controlled match completions or balanced human difficulty evidence.

Separate browser smoke checks started both new mirror pairings, Orcs against Undead and Fairies against Dwarves. Orc and Fairy workers accepted gather orders and deposited wood. Telemetry summaries are in `evidence/FACTION_BROWSER.json`; detailed local traces are in `work/faction-browser/`. The production build passes. The append-only decision trail is `work/faction-expansion-decisions.tsv`.
