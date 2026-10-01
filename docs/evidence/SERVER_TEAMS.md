# Authoritative team server verification

Verified on October 1, 2026 with Node 24.21.0. This extends the [two-player foundation](SERVER_FOUNDATION.md) with dynamic human/AI rosters, server-assigned sides 0–7, team results, handicaps and delayed team spectators. The checks use the real HTTP/WebSocket service and SQLite records. The production smoke uses the bundled Node entry point as a separate process. They establish local server behavior; public hosting, ranked services and community services require their own evidence.

The implementation is `90fafea6cf0d89a8241bec3109aba69588acc3f2`, network tests are `f06a33a`, and the smoke script is `10223d259ebe5adbb35fd6b1a7c1a0d8a685b5f7`. The tested tree builds on `bf714bc`. `npm run test:server` passed all 16 tests. Targeted strict TypeScript passed for the server entry point and both server suites. The 27 core observation and terminal tests also passed after the optional event-identity callback was added. The callback leaves ordinary core/CLI event output unchanged.

Eight authenticated clients join an eight-human 4v4 roster, receive their assigned factions and sides, and issue commands on their own entities. The tests check shared allied vision while excluding other players' orders, queues, cooldowns, carried resources and damage history. Side 7's paid training command spends once and has one durable receipt. After restart, all eight sessions and lobby seats remain intact and the original receipt returns unchanged. A queued gather command followed by surrender verifies runtime cleanup; a second restart recovers the finished team result and surrender receipt.

The co-op test starts two human allies against two computer opponents without requiring AI readiness. Delayed AI team views show both computers training, gathering and building. Roster tests place the host after AI slots, preserve accounts when slots move, reject changes that would evict a participant, clear readiness after settings edits and reject stale revisions. Handicap tests check starting resources, age, population limits and persisted income factors, and reject malformed or out-of-range settings.

Spectator tests compare delayed team banks, visibility and exploration with teammate frames stored at the same historical tick. Spectators cannot issue commands or obtain another player's seat. Private gather, research and message events remain private even when their location is visible. An unseen attacker cannot disclose its source ID, side or text. Opaque event IDs merge differently redacted copies once, retain allowed owner details and preserve two distinct events with identical payloads. Team event buffers sort by tick. Independent code review also exercised permitted attacker-location merging and found no unresolved defect.

`npm run build:server` produced bundle SHA-256 `04c6dd069b2038ab4043026b1d024ba81d73cff9d03bcd42ecc70c1122a13dae`. The bundle ran at an isolated loopback origin with a fresh data directory and a 0.4-second spectator delay. The external smoke connected eight real WebSockets and reported:

```json
{"ok":true,"path":"production-eight-clients","tick":21,"connectedPlayers":8,"ownershipRejected":true,"alliedPrivateStateHidden":true,"duplicateSpentOnce":true,"teamSpectator":{"delayTicks":8,"spectatorTick":0,"authoritativeTick":8},"spectatorCommandsRejected":true,"winningTeam":0,"teamOutcomesVerified":8}
```

A separate active match saved a private smoke credential file:

```json
{"ok":true,"path":"production-eight-clients-saved","tick":4,"connectedPlayers":8,"ownershipRejected":true,"alliedPrivateStateHidden":true,"duplicateSpentOnce":true,"privateStateSaved":true,"matchLeftActive":true}
```

After stopping and restarting the same bundle with the same data directory, the resume check authenticated all eight saved sessions, reconnected all seats, replayed the original paid acknowledgement and surrendered the opposing team. It reported:

```json
{"ok":true,"path":"production-eight-client-restart","tick":505,"sessionsPreserved":8,"seatsPreserved":8,"receiptPreserved":true,"duplicateSpentOnce":true,"winningTeam":0,"teamOutcomesVerified":8}
```

To repeat against a running compatible server, use these commands. The save path must be new; the script creates it with mode 0600 and refuses an existing file.

```sh
npm run test:server
npm run build:server
node scripts/server/team-smoke.mjs http://127.0.0.1:8787
node scripts/server/team-smoke.mjs http://127.0.0.1:8787 --save work/team-smoke-session.json
# Restart the same bundle with the same data directory, then:
node scripts/server/team-smoke.mjs http://127.0.0.1:8787 --resume work/team-smoke-session.json
```

The smoke result is a team surrender outcome. Natural combat and balance need separate simulation or playtest evidence. This run did not rebuild the Docker image or verify a public TLS origin. The temporary server stopped cleanly, its listener closed, and its test data directory and private credential file were removed after verification.
