# Simulation verification

Run `npm test` for the rule and full-match suites. Run `npm test -- tests/simulation.test.ts` for the short rule checks alone.

The requirement mapping and current 58-test update are in `docs/evidence/RULES_AUDIT.md`. The prior full-suite output in `docs/evidence/simulation-tests.txt` and the pacing run in `docs/evidence/PACING.md` retain their timestamps and source hashes. Earlier match timings in development notes or conversations are historical runs against earlier simulation revisions. Use the recorded hashes to determine which source a result verifies.

The rule fixtures retain both headquarters and use normal commands to exercise gathering, deposits, construction, repair, recruitment, movement and combat. Individual fixtures add units, reposition entities or set health/resources to isolate the rule described by the test. The opposing economy is disabled in these fixtures by removing its workers and starting money. The tests do not inject a winner or replace command validation.

The skirmish suite starts the normal map and starting economies, runs the public AI for both players, and allows up to 15 simulated minutes. It requires both sides to gather and deposit resources, complete a barracks and depot, recruit troops and attack. The match must finish through headquarters destruction, while resources remain nonnegative and the 100-unit per-side cap holds. No state is injected after initialization. This proves an automated complete match, not browser controls, visual quality, human difficulty or rendering performance.

The content test temporarily changes worker health, cost, training time and ability assignment in the faction definition, then recruits and uses that worker through the ordinary commands. Definitions are restored after each test. Artwork replacement still requires separate renderer verification.

The fog tests check target rejection, persistent exploration, and AI decisions remaining identical when unseen enemy positions change. They do not claim complete strategic fairness proof; the AI is allowed to scout the known opposing start location on this single fixed map.

Movement regressions check building footprints and an ore obstruction where both grid endpoints are clear but the connecting segment intersects the resource. The ore test checks every traveled segment for collision clearance and requires the unit to reach its destination. Further regressions remove an AI builder and require a survivor to finish the existing foundation, and check all eight attack-facing directions without movement.

Movement-facing checks compare the heading with actual displacement in all eight directions during direct approach and routed travel. The routed cases require exact waypoint arrivals. Two further fixtures obstruct a cached diagonal route and verify heading during horizontal and vertical collision slides. These checks exposed 17 failures before the facing fix; the already-east routed case happened to pass because the old zero-vector heading was east.

The current update also covers safe route connectors from off-center positions, closing unit attack range correctly, and keeping replacement scouts with their group. Current automated outcomes are 546.80 / 538.20 seconds; these are below the 10–15-minute pacing target. See the dated audit appendix for exact source hashes and pre-fix failures.
