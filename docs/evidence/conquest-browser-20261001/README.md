# Conquest and diplomacy browser proof

The standalone production demo passed ten conquest checks with no page errors. The browser created a dwarf realm, transferred tribute, negotiated a two-turn truce, moved the commander beside the protected garrison, restored the active battle, completed passage, expired the treaty, and captured the grove with paid allied aid. All player commands used visible controls, native file inputs, keyboard input, or canvas pointer input. `scenarioDiagnostics` supplied copied observations.

The protected commander moved from `(8,15)` to `(23,16)` with full health while inside the enemy archer's range. During the later hostile battle, the funded `aid-undead` actor dealt attributed weapon damage and took returning fire before the rest of the detachment advanced. The battle completed its real objective at 25 seconds. The commander retained its ID in the deployed army and survived. The captured grove increased connected income to 310 wood, 60 ore, and 24 crystal per turn.

The ally paid 85 wood and 40 ore for its dwarf ranged reinforcement. Its treasury changed from 150 wood / 350 ore / 20 crystal to 65 wood / 310 ore / 20 crystal. The player received no resource bonus. Allied aid uses the player's faction unit definition according to the preserved engine source. The runner's `aidUsesPlayerFactionStats` label records that inspected contract; the browser assertions establish combat participation and payment.

Active export, reload/Resume, and file import preserved the full checkpoint and profile. Completed export and reload/Resume preserved ownership, army, diplomacy, treasury, and verified battle history. The completed-file import first replaced the realm with a different new profile, then required the original ID and the full serialized profile to return. It cannot pass through a no-op import.

TypeScript, the standalone production build, and 34 targeted tests passed. Eight UI tests cover callbacks without profile mutation, connected routes, active battle restrictions, and cancellation of delayed imports after a newer decision, host cancellation, or destruction. The build's bundle-size warning comes from the existing Phaser bundle.

The existing mission browser script also passed ten production checks on this build with no page errors. `mission-regression/` preserves its screenshots, checkpoints, campaign exports, log, and result. Its checks include physical cannon movement and tower damage, checkpoint reset/restore, mission victory, red boss-warning rim pixels, campaign reload/Resume, defense victory, and branch continuation.

`proof.json`, the downloaded profiles, screenshots, logs, and `sources/` preserve the successful run. The frozen core is local commit `3ab7820`, corresponding to parent commit `031dd2f`, after the campaign carryover update `6d1cab7` (local `d16bb45`). The build also includes the parent-owned `geometry.ts` from `d1171b9` and the four biome palette colors preserved in `local-palette.patch`. Those central source edits are omitted from the UI commit. The assembled application needs its own verification after combining the other workstreams.

The first attempt won the real battle, then failed because its runner compared serialized JSON against memory containing optional `undefined` keys. `regressions/` preserves that failure and the old runner. Later attempts tightened reachability, deployed-identity, and import assertions. The final attempt also verifies the corrected aid funding. The earlier mission browser evidence directory remains unchanged.

The final audit row resolves the earlier log's working-file pointers to committed copies. `regressions/pre-funding-proof.json` preserves the second attempt; `proof.json`, `tests.log`, and `build.log` preserve the final checks. No active workspace transcript was available for a chronology audit.

`build-and-trace-provenance.json` records production bundle hashes, copied-source hashes, and the paths, sizes, and hashes of complete Playwright traces. The traces remain in ignored `work/scenarios/` directories because each is over 100 MiB. No trace is represented as committed evidence.

To repeat the proof from an integrated checkout, use the retained standalone Vite configuration and run:

```sh
mkdir -p work/scenarios
cp docs/evidence/conquest-browser-20261001/sources/work/scenarios/vite.config.mjs work/scenarios/vite.config.mjs
npx tsc --noEmit
npx vite build --config work/scenarios/vite.config.mjs
npx vite preview --config work/scenarios/vite.config.mjs --host 127.0.0.1 --port 5276 --strictPort
```

Then run `node scripts/verify_conquest.mjs http://127.0.0.1:5276 work/scenarios/repeated-conquest-proof` in another terminal. Set `OVF_PLAYWRIGHT_MODULE` to the installed Playwright module path when it is supplied by the workspace runtime. The runner preserves a failure screenshot, state, hashes, and trace when an assertion fails.
