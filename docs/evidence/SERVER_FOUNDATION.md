# Authoritative server verification

Verified on October 1, 2026 using Node 24.21.0, the real HTTP/WebSocket server, built-in SQLite/WAL and the production Docker image. This evidence establishes the two-player server foundation. The browser's online driver is a separate integration; public-host verification and team/co-op/ranked/community services are not established by these checks.

`npm run test:server` passed nine network and observation tests. Independent authenticated clients create/join/edit/ready/start a lobby, receive their own filtered frames and issue real simulation commands. The tests verify current-revision readiness, same-origin browser requests, guest sessions, ownership rejection, paid-command deduplication and one database receipt, connection replacement, journal/resource-memory/session recovery, delayed spectator frames and command denial, redaction of unseen attackers, bounded deeply nested input and malformed unauthenticated upgrades.

`npm test` passed 404 tests before the final three server security checks were added. The final nine-test server suite passed after all server fixes. `npm run build` and `npm run build:server` passed on the final source. Core simulation and browser source were not changed by this server implementation.

The production image built with `docker compose -f deploy/server-compose.yml build server`. It ran as the nonroot `node` user with a read-only root filesystem and a dedicated writable data volume, using an isolated loopback port. The smoke script used actual same-origin HTTP headers and two independent WebSocket connections against that container. It reported:

```json
{"ok":true,"path":"production-two-clients","tick":4,"ownershipRejected":true,"fogFiltered":true,"duplicateSpentOnce":true}
```

After restarting that same container with its volume, the script verified the stored session, recovered match and original durable acknowledgement:

```json
{"ok":true,"path":"production-restart","tick":4,"receiptPreserved":true,"sessionPreserved":true}
```

The verified server bundle SHA-256 was `f5910fa3b0b6a19f6e8d2d171f107eb0b316bc11019bfbd9144f17dfc12c55ca`. The built image ID was `sha256:933ab7cb4b563b8ab70516aeb0f1a432c17b85661ae76b2950db0d07f8f4a36a`. These identify this verification build; later core or server edits require a new build and relevant checks. Recovery pins the full server/simulation fingerprint and compares the resumed full state and observation-memory hash to the durable value.

To repeat against a running service, use:

```sh
node scripts/server/smoke.mjs http://127.0.0.1:8787
node scripts/server/smoke.mjs http://127.0.0.1:8787 --save work/server-smoke-session.json
# Restart the same server build with the same data directory, then:
node scripts/server/smoke.mjs http://127.0.0.1:8787 --resume work/server-smoke-session.json
```

The optional session file contains a test session credential, uses mode 0600 and must remain private. Delete it after the test. The verification's isolated container, volume and session file were removed after success. No public deployment is claimed.
