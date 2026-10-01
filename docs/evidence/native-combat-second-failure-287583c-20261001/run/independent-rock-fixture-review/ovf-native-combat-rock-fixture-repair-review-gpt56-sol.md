Accept the proposed three-file rock-fixture repair for a fresh runtime retry. The failed browser run remains partial evidence and does not prove the complete combat suite.

# Scope and pins

This is a static and lightweight review. I did not run fixture generation, a product build, the game engine, or a browser. The parent proof pin is `287583c6bf90b0df76475f8541e6694df1d5f901`; the frozen product source commit recorded by the proposal is `c86e273c70738f144a00fe75f5ecf39e7fa324d8`.

The three retained original files match Git at the parent proof pin byte for byte. Applying `proposed.patch` with `patch -p1` to fresh copies of those files exits zero and produces all three candidate files byte for byte. The patch hash is `57971936f170a40288cb3b52c82f0cdbfd9aeab5d3951e63978f47681c41e443`.

The independent audit is `/tmp/ovf-native-combat-rock-fixture-repair-audit-gpt56-sol.json`, SHA-256 `c28680a61fff355bc05dac3dfaf94bb5c9bbf01601c234e2f3c3166d3aa3687b`.

# Failure diagnosis

The retained browser report is incomplete with 46 passing checks and 79 authenticated downloads before a 15-second attack-order wait timed out in the rock-cover encounter. Its cover-rock fixture and native import both omit target fog key 889 from side zero's visible and explored sets. The equivalent cover-none fixture includes the same key.

The original Mothbow at `(20.5, 24.5)` and Ironjaw at `(25.5, 24.5)` produce a 15-step sight and firing ray through terrain cell `(23, 24)`, which is the rock. `terrainLineOfSight` rejects that ray. `GameScene.hit` rejects invisible entities before pointer hit testing, so the click can fall through to a ground order. These facts account for the missing attack order without treating the later combat state as proof of what the first click did.

The report remains preserved as a failed partial run. Its final state shows source 51 idle at `(24.0760857096, 23.4532937838)` and target 52 at 40 health while retreating. That state does not prove the required first native attack command was accepted.

# Patch review

The fixture change at `direction-defense-fixtures.ts:117-127` applies only to the rock case. It keeps the rock tile at `(23, 24)` and changes the source and target y coordinate to `23.9`. It also records the authored geometry in fixture metadata. The none and building cases keep their prior coordinates and setup.

The proposed firing ray stays in terrain row 23 and does not cross the rock. The target's new fog key is 853. The Mothbow's sight is 9 tiles, while the source-to-target distance is 5. The visibility ray from the source to the target cell center also stays in row 23.

The rock center is `(23.5, 24.5)`, 0.6 tiles from the shot segment. Every `rangedCoverFactor` condition passes: the shot is longer than 1.8 tiles, the rock is within 3.55 tiles of the target, more than 0.95 tiles from the source, more than 0.3 tiles from the target, and inside the strict 0.65 segment-distance threshold. With a raw Mothbow hit of 18, cover factor 0.65, and Ironjaw armor 3, the health loss remains 8.7. The existing expected-damage assertion is unchanged.

The runner change at `direction-defense.mjs:31-38` checks the target's displayed level and visibility before native pointer input. It retains the right-click, the strict wait for an attack order on the requested target, the replay command check, and the damage check. A future bad fixture now fails at the missing precondition instead of timing out after a click that could not hit the target.

The context change at `native-context.mjs:60-71` records the selected IDs, view side and level, target world position and fog key, target visibility, camera, canvas bounds, and computed hit point. The coordinate formula and `page.mouse.click` call are unchanged. This closes the observation gap from the failed run without changing input behavior.

# Findings (risk)

No defect was found in the proposed patch.

The required runtime evidence is still open. Static geometry proves that the proposed lane is visible and satisfies the cover predicate, but it does not prove fixture generation, pointer hit testing, attack execution, save and replay continuation, or the remaining encounters. Accept only a fresh complete native browser envelope produced from these admitted files.

# Behavioral interrogation

For `direction-defense-fixtures.ts`, ordering changes: none. The same generation loop writes the same three cover fixtures in the same order. Failure paths: none are added; the rock branch only changes authored coordinates and metadata. Observability changes: generated rock metadata now states the lane geometry. Stale writes: none; fixture generation is a single local write path. Test delta: the fresh rock native encounter must fail if the new lane does not remain visible, covered, and damaging for 8.7 health.

For `direction-defense.mjs`, ordering changes: the runner now snapshots and checks level and visibility before the existing native click. Failure paths: either precondition throws with a named assertion; the existing attack-order timeout remains for clicks that reach a visible target but fail to create the order. Observability changes: no log order changes. Stale writes: none; the new code reads one pre-click snapshot and does not mutate game state. Test delta: there is no separate unit test for these assertions; the next native browser run exercises them on every direction-group attack. That missing fresh run is an acceptance condition rather than a patch defect.

For `native-context.mjs`, ordering changes: evidence is appended after canvas reachability is checked and before the existing mouse click. Failure paths: if the click later fails, its pre-click context remains in the report; the canvas assertion still prevents a click outside the battlefield. Observability changes: entity clicks now retain camera, canvas, target, selection, view, fog, and screen data in causal order before input. Stale writes: the evidence object is run-local and append-only; no async game write is added. Test delta: no separate unit test covers the evidence record. The fresh native browser run must show pointer records for entity clicks and still satisfy replay and damage checks.

# Compliance notes

Both changed `.mjs` candidates pass independent `node --check` runs. The source worktree was not edited. The original failure archives remain byte-identical according to the retained preservation check. No runtime acceptance is inferred from syntax, geometry, or the patch application comparison.
