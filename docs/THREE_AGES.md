# Three-age skirmishes

The game now has three ages, seven unit roles per faction, military research, expansion headquarters and fortifications. The previous six-faction ladder predates this progression; the new verification record below establishes functional coverage, not competitive balance.

Players begin in Settlement Age. Headquarters research Town Age for 260 wood and 180 ore over 65 seconds, then Citadel Age for 420 wood, 320 ore and 60 crystal over 90 seconds. Research runs alongside recruitment, but each building researches only one technology at a time. A technology cannot be purchased concurrently in different buildings.

The Technologies button opens the technology tree. Its age columns show available troops, research costs, prerequisite technologies and remaining research time. Research is paid up front. Losing the building before completion loses that research. Completed technologies apply to existing and future eligible troops.

Settlement troops include workers, melee infantry, ranged troops and pikes. Town Age adds faction specialists and mounted raiders, walls, gates and expansion headquarters. Citadel Age adds siege engines. Pikes deal triple damage to cavalry; cavalry deals 70% extra damage to ranged troops. Siege has long range, slow movement and attacks, and quadruple damage against buildings. It needs a screening army.

Harvest Drills and Courier Training improve the economy. Forged Weapons and Tempered Armor improve melee damage and armor in Town Age. Veteran Arms requires Citadel Age and Forged Weapons. Players can invest in these technologies or spend the same resources on more troops and faster advancement.

Walls can join without the normal building clearance. Gates are controlled explicitly: select one and choose Open gate or Close gate. Open gates admit both sides, and gates cannot close on a unit. The final completed headquarters determines defeat, so an established expansion keeps a player alive after losing the starting base. Unfinished foundations do not prevent defeat.

Huge maps are 88 × 88 tiles. They retain symmetric starting resources and have additional outer wood, ore and crystal clusters connected to the road network. Expansion headquarters recruit workers, accept all resource deliveries and provide population capacity.

The AI grows its workforce as it advances, researches economic and military technologies, chooses pikes against visible cavalry and cavalry against visible ranged troops, recruits siege in Citadel Age, expands near observed outer deposits, and builds a defensive screen with a gate near its tower. Its observations obey ordinary fog rules.

## Verification

The [evidence directory](evidence/three-ages/README.md) preserves results, screenshots, the decision trail and a source fingerprint. The complete suite passed 237 tests in 16 files, including 36 ordinary AI matches covering every ordered faction pairing on medium map seed 4127. After the final HUD change and expansion-delivery test, the 15 focused progression/interface tests passed. Two tests were added after the full run, so this is not a claim that all 239 tests were rerun together.

All six factions reached Citadel Age in every appearance in the 36-match sample. Each faction used all six combat roles and completed all six building types across its matches. Additional complete matches covered Orcs–Fairies on small seed 58319 (8:24), Tideborn–Automata on large seed 72931 (12:19), and Dwarves–Undead on huge seed 91873 (13:44). A side can lose before producing siege; reaching every unlock is not a condition of match completion.

The large-map diagnostic records both AI scouts reaching flank camps. Neither side mined those camps in that match. A focused test separately proves the full player sequence: travel to a huge-map camp, construct an expansion headquarters, gather its ore and deposit it locally. AI expansion currently favors nearer observed resources and needs more work to exploit distant camps consistently.

Browser input verified the technology tree at 1280 × 720, timed Town Age completion, worker rally, recruitment cancellation with a 50-wood refund, gate opening/closing and an adjoining wall. The normal Orc huge-map match ended in defeat at 6:33 after under-investment in defenders. Citadel research was interrupted by that loss. Citadel unlocks, research effects and all-unit recruitment have simulation coverage; this run does not claim a complete human victory or browser recruitment of every late-game unit.

All six factions' required artwork loaded across Orc–Fairy, Dwarf–Undead and Tideborn–Automata browser pairings, with no captured console warnings or errors. Asset validation passed 100 assets, 8,250 frames and 138 atlas pages. The 3,456 new unit frames have no missing or clipped frames, with at least 23 pixels of canvas margin. Editable models and generation scripts are included.

The final 100-unit synthetic scene held exactly 100 living, visible, on-screen units for a valid 60-second sample at 1920 × 1080. It averaged 58.48 FPS with a 18.7 ms 95th-percentile frame interval. It used a 1920 × 1080 drawing buffer at approximately 1× pixel density. This is a measured desktop result, slightly below 60 FPS, and does not predict performance on high-DPI or low-memory devices. The first valid run overlapped tests; the final recorded repeat ran after tests and match diagnostics completed.

The full atlas set decodes to 1,448.63 MiB, but matches load only their participating factions. Observed decoded atlas sizes were 467.50 MiB for Orc–Fairy and 490.57 MiB for each of the other two tested pairings. These are texture estimates, not total process or GPU memory measurements.

The observation-only terminal agent completed an Automata–Tideborn small-map game at 7:42. Replaying all 222 logged requests reproduced its simulation hashes. Replay is tied to this simulation version.

## Reproduce

Run `npm test`, `npm run build`, and `npm run build:cli`. Bundle `scripts/progression/playtest.ts` using esbuild for additional full matches:

```sh
npx esbuild scripts/progression/playtest.ts --bundle --platform=node --format=esm --outfile=work/progression.mjs
node work/progression.mjs tideborn automata large 72931 work/progression-results
python3 scripts/progression/report.py work/three-ages/regression-matches --out work/progression-summary.json
```

The report script summarizes the regression-test format; the playtest script also records timed age milestones and flank-camp visits/extraction. Its preserved bundle contains the simulation that produced the final large-map diagnostic. See [asset regeneration](REGENERATING_ASSETS.md) for Blender rendering and validation. To repeat rendering performance, open `http://127.0.0.1:4173/?qa=1&benchmark=1` at a 1920 × 1080 viewport and leave it foregrounded through completion. This synthetic scene is performance evidence only.

## Limits

Orcs won all ten cross-faction matches in the single-seed sample; Automata and Dwarves each won one. The new roles share base statistics across factions, with distinct names and artwork. The existing faction abilities still differ. Technology choices currently mean spending priorities and prerequisite order; there are no mutually exclusive branches. Military upgrades affect melee infantry. Naval combat, trading, diplomacy, formations, save/load and multiplayer remain outside this build.
