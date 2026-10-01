# Session tools verification

The first implementation group covers queued orders, recruitment queues, global production, saved controls, controller input, local saves, replays, analysis, photo mode and replay-backed report exports (82, 83, 84, 88, 89, 90, 91, 92, 93 and 100). The requirement ledger retains these as in-progress while their remaining integration contracts are tracked. This group does not establish completion of the 100-feature objective.

## Reproduce the checks

Start the real application with `npm run dev -- --port 5295 --strictPort`. The browser scripts use Playwright. Set `OVF_PLAYWRIGHT_MODULE` to the installed Playwright module path when it is provided by a workspace runtime rather than a project dependency.

```sh
npm test
npm run build
npm run build:cli
npx esbuild scripts/sessions/generate-replay.ts --bundle --platform=node --format=esm --outfile=work/hundred-features/generate-replay.mjs
node work/hundred-features/generate-replay.mjs
node scripts/verify_controls.mjs http://127.0.0.1:5295
node scripts/verify_sessions.mjs http://127.0.0.1:5295
```

`verify_sessions.mjs` drives displayed controls in the assembled application. Its read-only inspection of `window.rts` checks the resulting state. It saves a named match, restores its tick, exports it, rejects an incompatible import, recruits through the global panel, rebinds the camera, composes and downloads a photo, previews and downloads a report, imports a complete match, opens full analysis before playback, follows technology and chart timestamps, seeks to the end, inspects the second player's technology tree and checks playback intent when a modal closes. It writes `work/hundred-features/session-browser-proof.json` only after every check passes with no page errors.

The replay fixture is a complete AI match generated through normal simulation. The original two-player fixture finishes at tick 10469, with an Orc victory, 106 analysis samples and 14 technology completions. Imports recompute all samples and timings by playing the recording before replacing the current match; imported chart values are not trusted. Every 600 replay ticks, playback caches a validated state and its recording prefix, retaining at most 16 checkpoints. Seeking uses the nearest retained checkpoint and bounded batches to keep the browser responsive.

Charts distinguish current stockpiles from cumulative resource deposits. Army size counts real living units. Army recruitment value sums wood, ore and crystal costs for living combat units, excluding workers, illusions and temporary raised troops. Loss charts count destroyed real units, destroyed buildings and paid resource value plus lost carried resources. These are resource-value measures, not a prediction of combat strength. Technology timestamps record the completion tick rather than the next chart sample.

Local storage retains up to twelve named saves and three rotating autosaves in one atomic write. A failed write preserves the previous store. Saved game envelopes include behavioral runtime such as cooldowns, queued gathering, returning workers, navigation timing and AI memory. Report exports include the matching checkpoint/replay, a local report UUID, save/replay versions, a built-in content checksum and the Vite build's SHA-256 of source files. The preview shows the exported data before download.

## Remaining work

Production uses role arrays and guarded slot indices; stable entry IDs and stored purchase prices will be needed when modded costs can vary. The global recruitment panel does not yet contain research or rally editing. Report download and its local UUID are not hosted submission or a server report ID. Online replays, reconnects, spectator policy and photo behavior depend on the authoritative server and client driver. Team perspectives must expand alongside the new roster model. Existing local checks must be repeated after those foundations are integrated.
