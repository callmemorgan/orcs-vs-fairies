The production browser proof passed ten checks with no page errors on the campaign foundation at `2094365`. It uses `scenario-demo.html`, the shared `ScenarioTools`, the ordinary `GameScene` and HUD, `issueScenarioCommand`, and `afterScenarioStep(session, .05)`. Every player action comes from a visible button, file input, keyboard, or native canvas pointer input. `window.scenarioDiagnostics` supplies copied observations.

The practice proof lists all thirty authored missions and six campaign cards. It plays the fixed-army dwarf puzzle, verifies ability and control-group input, moves the cannon to its firing shelf, observes real weapon damage, downloads a checkpoint, resets to the complete original checkpoint, imports the downloaded checkpoint, and finishes the restored mission. The finale proof moves the army into the boss's sight and reads red warning-rim pixels at all four sides of the rendered ellipse.

The campaign proof starts a new dwarf campaign and completes its first chapter through normal play. It exports the verified command recording, reloads the page, resumes the stored profile, and continues with the original five survivor IDs. It fights the second chapter's authored waves and retreats the wounded commander behind the fortress. The fortress retains 1,800 HP; the commander finishes with 92.4056 HP. Both route buttons appear after the verified victory. The proof chooses the northern works, exports and imports the profile, and continues into `dwarves-3-alt` with commander ID 1.

`proof.json` contains actions, source hashes, observed values, accepted commands, and assertions. The screenshots, mission checkpoints, and campaign exports are the artifacts used by those assertions. `sources/` preserves the exact code used by the frozen build. The local palette patch supplies the four biome colors added by world integration commit `e475008`; those central file edits are omitted from the browser harness commit. The main application's assembled integration must run its own proof after merging later core or UI changes.

The first campaign attempt found a real UI defect: repeated unchanged updates hid the Continue button. Its failure snapshot and screenshot remain under `regressions/continue-hidden.*`. The corrected parent code is included in `2094365`. The second attempt exposed the commander to the ranged wave and lost through normal combat. That loss remains under `regressions/exposed-commander.*`; the final run uses visible attacks, emplacement in weapon range, and a commander retreat. No simulation state was edited to obtain a victory.

The three complete Playwright traces remain in the isolated worktree's ignored `work/scenarios/` folders. `build-and-trace-provenance.json` records their absolute paths, sizes, and SHA-256 hashes, along with the production bundle hashes. They are omitted from Git because the final trace alone is 352 MiB.

To repeat the standalone production proof from an installed checkout, create its temporary Vite config and build it:

If reproducing the frozen `2094365` foundation before world integration, first apply its palette dependency with `git apply --unidiff-zero docs/evidence/scenario-mission-browser-20261001/local-palette.patch`.

```sh
mkdir -p work/scenarios
cat > work/scenarios/vite.config.mjs <<'EOF'
import { defineConfig } from 'vite';
export default defineConfig({server:{host:'127.0.0.1',port:5276,strictPort:true},build:{outDir:'work/scenarios/dist',rollupOptions:{input:'scenario-demo.html'},chunkSizeWarningLimit:1600}});
EOF
npx tsc --noEmit
npx vite build --config work/scenarios/vite.config.mjs
npx vite preview --config work/scenarios/vite.config.mjs --host 127.0.0.1 --port 5276 --strictPort
```

In another terminal, run `node scripts/verify_scenarios.mjs http://127.0.0.1:5276 work/scenarios/repeated-proof`. Set `OVF_PLAYWRIGHT_MODULE` to the installed Playwright module path when it is supplied by the workspace runtime instead of local dependencies.
