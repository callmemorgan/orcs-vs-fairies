# Current verification

`npm test` passes 179 tests across eight files, including 36 ordered six-faction matches at medium seed 4127 with a 45-minute limit. Focused tests cover navigation, simultaneous damage, AI scheduling and mirrored placement, generated maps, terrain, crystal, faction mechanics, terminal validation, observation fog and replay. Full matches enforce economy bounds and completion; aggregate faction coverage checks combat-role hits and building types.

`LADDER_RUN=my-new-run npm run test:ladder` runs 216 games across three sizes and two seeds. Results and source snapshots stay in a separate directory per run. Current measured outcomes and limits are in [the expansion report](../docs/EXPANSION_DAY.md). Browser interaction and art review are separate evidence; passing simulation tests does not verify rendering performance or competitive balance.

The notes below describe earlier milestones and retain their historical counts.

# Historical simulation verification

Run `npm test` for the rule and full-match suites. Run `npm test -- tests/simulation.test.ts` for the short rule checks alone.

The requirement mapping and historical 58-test update are in `docs/evidence/RULES_AUDIT.md`. The prior full-suite output in `docs/evidence/simulation-tests.txt` and the pacing run in `docs/evidence/PACING.md` retain their timestamps and source hashes. Earlier match timings in development notes or conversations are historical runs against earlier simulation revisions. Use the recorded hashes to determine which source a result verifies.

The rule fixtures retain both headquarters and use normal commands to exercise gathering, deposits, construction, repair, recruitment, movement and combat. Individual fixtures add units, reposition entities or set health/resources to isolate the rule described by the test. The opposing economy is disabled in these fixtures by removing its workers and starting money. The tests do not inject a winner or replace command validation.

The skirmish suite starts the normal map and starting economies, runs the public AI for both players, and allows up to 30 simulated minutes across all 16 ordered faction pairings. It requires both sides to gather and deposit resources, complete every building type, recruit every unit role and deal damage with every combat role. The match must finish through headquarters destruction, while resources remain nonnegative and the 100-unit per-side cap holds. No state is injected after initialization. This proves an automated complete match, not browser controls, visual quality, human difficulty or rendering performance.

The content test temporarily changes worker health, cost, training time and ability assignment in the faction definition, then recruits and uses that worker through the ordinary commands. Definitions are restored after each test. Artwork replacement still requires separate renderer verification.

The fog tests check target rejection, persistent exploration, and AI decisions remaining identical when unseen enemy positions change. They do not claim complete strategic fairness proof; the AI is allowed to scout the known opposing start location on this single fixed map.

Movement regressions check building footprints and an ore obstruction where both grid endpoints are clear but the connecting segment intersects the resource. The ore test checks every traveled segment for collision clearance and requires the unit to reach its destination. Further regressions remove an AI builder and require a survivor to finish the existing foundation, and check all eight attack-facing directions without movement.

Movement-facing checks compare the heading with actual displacement in all eight directions during direct approach and routed travel. The routed cases require exact waypoint arrivals. Two further fixtures obstruct a cached diagonal route and verify heading during horizontal and vertical collision slides. These checks exposed 17 failures before the facing fix; the already-east routed case happened to pass because the old zero-vector heading was east.

The earlier update also covers safe route connectors from off-center positions, closing unit attack range correctly, and keeping replacement scouts with their group. Historical automated outcomes are 546.80 / 538.20 seconds; these are below the 10–15-minute pacing target. See the dated audit appendix for exact source hashes and pre-fix failures.

The current suite has 102 tests: 59 existing rule tests, 27 faction tests and 16 complete matches. `docs/evidence/FACTION_MATCHES.json` records current source hashes, outcomes, building and recruitment coverage, attacks by role, emplacement hits and raised-unit hits.
