# Ranked seasons and daily challenges

Ranked play is opt-in at lobby creation. It supports two opposing human accounts, age 1 starts, and no handicaps. Accounts created through the existing guest flow are durable accounts and may participate. The server chooses ranked seeds. Elo uses a 400-point scale, K=32, and a monthly UTC reset to 1,000. Archived standings remain available. A match keeps the season in which it started, including when it finishes after a reset. Surrender counts as a loss and a draw counts as half a win. Participants cannot request the opponent's spectator perspective while their competition is unfinished or paused after persistence failure.

The daily challenge uses the server's UTC date. Its published configuration fixes the small map, seed, faction pair, age 1 starts and normal AI opponent. All accounts receive that same configuration. A daily start has no configurable request fields. Repeating a start resumes the account's current unfinished run for that date. Finished attempts may be repeated, and each account keeps its fastest hosted victory. A run that finishes after midnight counts for its original date. Losses record an outcome without creating a score.

`ServerStore.commitTick` writes the match checkpoint, command receipts, competition outcome and both players' ratings or daily score in one SQLite transaction. The admitted competition and immutable account roster are stored with the match configuration. `competition_results.match_id` prevents awards from being applied more than once. A failed award rolls back the final tick and receipts as well as the award. Recovery uses the existing original-engine compatibility and state-hash checks.

The main game mounts `mountCompetitionTools` in the shared session toolbar and connects it through the canonical `joinOnline` path. Its visibility uses the same pause and input coordinator as session tools and tournaments. Photo mode hides the launcher, and another open modal blocks it. The reusable browser entry is `mountCompetitionTools(root, { toolbar?, onJoinMatch, onVisibility? })` in `src/ui/CompetitionTools.ts`. `onJoinMatch` receives the existing `OnlineMatchRequest` and must connect the game to that authoritative match. The screen uses the account created by Online play. It includes active and archived standings, ranked lobby creation/join/readiness, owned match rejoin history, and daily start/resume. Dates, ratings and scores are fetched from the server. The modal owns its focus and Escape handling.

| Endpoint | Meaning |
| --- | --- |
| `GET /api/ranked/seasons` | Current season, archived seasons, published reset and eligibility policy. |
| `GET /api/ranked/standings?season=YYYY-MM` | Standings for a known season; defaults to the current UTC season. |
| `POST /api/lobbies { ranked: true, settings }` | Creates an eligible ranked lobby. Existing revisioned lobby actions apply. |
| `GET /api/challenges/daily` | Current authoritative challenge and its leaderboard. |
| `GET /api/challenges/daily/standings?date=YYYY-MM-DD` | A daily leaderboard, including past dates. |
| `POST /api/challenges/daily/start {}` | Starts or resumes the authenticated account's current daily run. |
| `GET /api/competitions/results/:matchId` | Participant-only durable outcome; includes persistence failure state. |

The server tests cover exact-once awards, duplicate and post-game receipts, two restarts, UTC season rollover, full rating resets, eligibility rejection, spectator authorization, immutable daily configuration, forged date/seed/winner rejection, loss scoring, award rollback, and overlapping partial-body start requests. The existing human and team server tests also pass.

The standalone browser proof uses normal account, lobby and competition screens with real authoritative callback connections. It verifies a ranked result through rollover and restart, rejoin after reload, matching daily configurations, duplicate daily resume and a recorded daily loss. Screenshots and the result report are in `docs/evidence/competitions-browser`. This older proof exercises standalone mounts. The canonical native proof below exercises the main Phaser entry and packaged server; public hosting remains separate.

The separate hosted proof uses an external human controller, normal HTTP and WebSocket commands, and the unchanged 20Hz simulation step. A trusted test timer runs those steps every 1ms. It recorded victories at tick 2,055 (102.75 seconds) and tick 2,159, retained the faster score, retried a paid command without another award, and preserved both outcomes and the score through a real server restart. Its captured inputs, receipts and results are in `docs/evidence/competitions-hosted/result.json`.

The canonical native proof builds the Vite app and production server, then uses two independent browser accounts and the main toolbar. Five real ranked matches finish through accepted guest surrender commands on the captured game WebSocket. The browser creates, joins, readies and enters those matches through the native UI. It checks unlock thresholds, same-faction equipment by side, reload/rejoin, daily entry/resume, local logout and a graceful packaged-server restart. Daily victory scoring remains covered by the separate hosted proof above.

The native driver delays real responses from the same server to check that an older hosted success or transport failure cannot replace newer equipment, and that an anonymous session poll cannot clear a later native login. It records source and built-package hashes and rejects source changes during verification. An output directory must be new.

Run from the repository root:

```sh
npx vitest run tests/server-competitions.test.ts tests/server.test.ts tests/server-teams.test.ts
OVF_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/competitions/verify-canonical-main.mjs work/competitions/native-new-run
OVF_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/verify_competitions.mjs
npx esbuild scripts/competitions/verify-hosted.ts --bundle --platform=node --format=esm --packages=external --outfile=work/competitions/verify-hosted.mjs
node work/competitions/verify-hosted.mjs
```
