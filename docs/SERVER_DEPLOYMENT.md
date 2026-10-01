# Server deployment

The Node server serves the browser build, HTTP API and WebSocket endpoint from one origin. It uses Node 24's built-in `node:sqlite` and a writable data directory for persistent accounts and service records. `Dockerfile.server` builds the browser and server together; `deploy/server-compose.yml` runs that image with a persistent volume.

The server supports 2–8 player slots with human and computer controllers. Each slot has a faction and team; human participants receive server-assigned seats, and computer slots do not require an account or readiness. This supports 2v2, 3v3, 4v4 and human/AI cooperative rosters. Local build and service tests do not prove that a public deployment exists. Public online acceptance still requires a host, TLS, a durable volume and independent browsers exercising the hosted flows. See [the feature architecture](HUNDRED_FEATURE_ARCHITECTURE.md) for service and game integration requirements.

## Run without Docker

Use a checkout containing `src/server/main.ts` and the `build:server` and `server` package scripts. Node 24 and npm are required; no SQLite native addon or separate database process is needed. Run these commands from the repository root:

```sh
npm ci
npm run build
npm run build:server
RTS_HOST=127.0.0.1 RTS_PORT=8787 RTS_DATA_DIR=work/server RTS_STATIC_DIR=dist npm run server
```

The defaults are suitable for a local process. Open `http://127.0.0.1:8787` and use the same origin for `/api` and `/ws`. Serve the built browser through this process when testing the server; the Vite development origin is a separate origin unless a development proxy is configured.

The service provides registration and login through `POST /api/auth/register` and `POST /api/auth/login`, a generated guest identity through `POST /api/auth/guest`, session inspection through `GET /api/session`, and logout through `POST /api/auth/logout`. Lobby creation uses `POST /api/lobbies`; discovery uses `GET /api/lobbies`. Participants use the lobby's `/join`, `/settings`, `/ready` and `/start` endpoints. `POST /api/matches/:id/ticket` issues a short-lived connection ticket for `/ws?ticket=...`. Account identity and participant ownership come from the server session and ticket.

## Rosters and perspectives

Lobby creation and settings changes accept a `settings.players` array. Array position assigns side 0–7. Each slot specifies `factionId`, `teamId` (0–7) and `controller` (`human` or `ai`). A lobby needs at least one human slot and two teams. The server places the host in the first human slot and subsequent participants in the next empty human slot. Settings changes preserve present accounts and reject a roster with too few human slots. Every roster or seed change clears human readiness; the start endpoint requires all human slots to be occupied and ready at the current lobby revision.

For example, this settings object creates two human allies against two computer opponents:

```json
{
  "mapSize": "huge",
  "sharedVision": true,
  "startingAge": 1,
  "players": [
    {"factionId": "orcs", "teamId": 0, "controller": "human"},
    {"factionId": "fairies", "teamId": 0, "controller": "human"},
    {"factionId": "dwarves", "teamId": 1, "controller": "ai"},
    {"factionId": "automata", "teamId": 1, "controller": "ai"}
  ]
}
```

`startingAge` accepts 1–3 and `sharedVision` defaults to true. Each slot may include a `handicap` with complete `startingResources` (`wood`, `ore`, `crystal`, each 0–1,000,000,000), `incomeFactor` (0–10) and `populationCap` (integer 1–500). Unknown fields and invalid values are rejected. A legacy `factions` array remains supported and creates one human team per slot. When both arrays are provided, faction IDs must match.

A player ticket always uses the account's owned side. The server ignores a requested perspective or team view for player tickets. Player frames expose that player's economy and orders, visible entity data, shared team vision when configured, and filtered events. They do not disclose teammate or enemy production queues, banks or private economy events.

A spectator ticket accepts `perspective` for any configured side and `view: "player"` or `view: "team"`. Team views merge only stored teammate observations at the delayed tick, including their private player data in `teamPlayers`. They never read current match state to fill gaps. The configured delay applies to both spectator views, and spectators cannot issue commands. The online command `{ "type": "surrender" }` removes the owning player's forces through the authoritative match; teammates may continue until the core determines the team result. The receipt and result use the same journal and checkpoint recovery as other commands.

The [team server verification](evidence/SERVER_TEAMS.md) records the eight-client, co-op, handicap, spectator and restart checks. Run `node scripts/server/team-smoke.mjs ORIGIN` for the external eight-client service check. Its `--save` and `--resume` modes verify the same sessions and receipt after restarting a compatible build with the same data directory.

## Configuration

Paths are relative to the server process's working directory unless they are absolute. Keep the data directory separate from the build outputs so a release cannot replace persistent data.

| Variable | Process default | Container setting | Purpose |
| --- | --- | --- | --- |
| `RTS_HOST` | `127.0.0.1` | `0.0.0.0` | Listen address. The container must listen on all container interfaces. |
| `RTS_PORT` | `8787` | `8787` | HTTP and WebSocket port. |
| `RTS_DATA_DIR` | `work/server` | `/data` | Writable persistent service data. |
| `RTS_STATIC_DIR` | `dist` | `/app/dist` | Built browser assets. |
| `RTS_ORIGIN` | Unset | Empty for local use | Exact external origin, such as `https://rts.example.com`, with no path or trailing slash. Set it when a TLS proxy serves a different origin. |
| `RTS_SECURE_COOKIE` | Unset | `0` for local HTTP | Set `1` for browser access over HTTPS. |
| `RTS_TRUST_PROXY` | Unset | `0` | Set `1` only behind a loopback reverse proxy that appends the real client address to `X-Forwarded-For`; this preserves per-client authentication rate limits. |
| `RTS_SPECTATOR_DELAY_SECONDS` | `30` | `30` | Server-enforced spectator delay in seconds. |

Compose also accepts `RTS_PUBLISHED_PORT` (default `8787`), `RTS_IMAGE_TAG` (default `local`) and `RTS_VOLUME_NAME` (default `orcs-vs-fairies-server-data`). Use a distinct volume name for each independent environment. Record these values in the host's deployment configuration so subsequent releases use the same volume.

## Run with Docker Compose

Run from the repository root. The build context includes the package lockfile, source and public assets. The existing `.dockerignore` excludes local dependencies, build outputs, work files and documentation.

```sh
docker compose -f deploy/server-compose.yml config --quiet
docker compose -f deploy/server-compose.yml build server
docker compose -f deploy/server-compose.yml up -d server
docker compose -f deploy/server-compose.yml ps
docker compose -f deploy/server-compose.yml logs --tail=100 server
curl --fail http://127.0.0.1:8787/api/health
```

The container runs as the `node` user with a read-only root filesystem. `/data` is a writable named volume; `/tmp` is temporary. A new volume takes its initial ownership from the image's `/data` directory. If using an existing volume or bind mount, give the container's `node` user write access before startup. The published port binds to the host's loopback interface. Place the TLS proxy on that host, or adapt the network configuration for a proxy container.

`docker compose down` preserves the named volume. `docker compose down --volumes` removes it and its accounts and records. Build outputs and a container's writable layer are not backups.

## TLS and the external origin

Run a TLS reverse proxy on the deployment host. Configure its hostname and certificate, forward every path to `127.0.0.1:8787`, and support the WebSocket upgrade on `/ws`. Browser assets, `/api` and `/ws` must retain the same external origin. The server port remains private.

For example, a host-installed Caddy proxy can use:

```caddyfile
rts.example.com {
    reverse_proxy 127.0.0.1:8787
}
```

Replace the example hostname with the deployed hostname and configure DNS and the proxy's certificate handling. Set the server's external origin and cookie setting before starting it:

```sh
RTS_ORIGIN=https://rts.example.com RTS_SECURE_COOKIE=1 RTS_TRUST_PROXY=1 \
  docker compose -f deploy/server-compose.yml up -d --build server
curl --fail https://rts.example.com/api/health
```

Keep those environment values in the host's deployment configuration. Secure cookies require HTTPS; they will not support a browser signing in through a plain HTTP test address. The proxy must preserve the browser's `Origin` header so the service can validate WebSocket connections against `RTS_ORIGIN`.

## Readiness and hosted acceptance

The image healthcheck requests `/api/health` inside the container. Its response contains `ok: true`, `protocolVersion: 1`, `tickRate: 20` and the current `activeMatches` count. A healthy process shows that the HTTP service answers; it does not prove TLS, browser asset delivery, authentication persistence or an online match. Check the public origin after each deployment and open the page in a browser to confirm that the browser assets load from the server.

Use independent browser sessions to register or sign in, exercise the connected API and WebSocket flows, then restart the container and sign in again. Confirm that persisted records remain. Exercise a participant reconnect and a delayed spectator through the external proxy. The server's integration tests must establish the expected results, ownership checks and delay behavior before declaring those hosted flows complete. Keep the tested commit, origin and results with deployment evidence.

If the healthcheck fails, inspect the server logs, confirm Node 24, check the configured paths and verify write access to `/data`. If local HTTP works but the public origin fails, check the proxy, certificate, DNS and WebSocket upgrade. If WebSocket connections fail origin validation, compare the browser's external origin with `RTS_ORIGIN`.

## Backup and recovery

The database is `RTS_DATA_DIR/server.sqlite` and uses WAL journaling. Back up the entire data directory, including SQLite journal files and any other service records. The following stopped-service backup avoids copying a live database with an inconsistent journal. It briefly interrupts service. Run from the repository root and store the archive outside the container and volume:

```sh
mkdir -p backups
docker compose -f deploy/server-compose.yml stop server
docker compose -f deploy/server-compose.yml run --rm --no-deps -T \
  --entrypoint tar server -czf - -C /data . > backups/rts-data.tar.gz
docker compose -f deploy/server-compose.yml start server
tar -tzf backups/rts-data.tar.gz
```

Restart the service even if the archive command fails, and do not treat a failed or empty archive as a backup. Protect backup files because they contain authentication and account records. Keep a copy on storage independent of the deployment host. Also retain the deployed image or exact commit and package lockfile needed to run the recorded data and replay versions.

Restore into a new volume to preserve the old data for inspection. Choose an unused name, use the same image version as the backup, and run:

```sh
docker compose -f deploy/server-compose.yml stop server
export RTS_VOLUME_NAME=orcs-vs-fairies-server-restored
docker volume create "$RTS_VOLUME_NAME"
docker compose -f deploy/server-compose.yml run --rm --no-deps -T \
  --entrypoint tar server -xzf - -C /data < backups/rts-data.tar.gz
docker compose -f deploy/server-compose.yml up -d --no-build server
curl --fail http://127.0.0.1:8787/api/health
```

Record the new volume name in the deployment configuration before future restarts. Check an existing account and persisted records through the service after recovery. The server's recovery records contain a complete `saveGame` checkpoint, commands and ticks, filtered view memory and history. Matches pin the server/simulation build fingerprint and full durable state hash. Recovery rejects a different build or diverging replay. Retain the original image for unfinished matches; source-development and bundled-production fingerprints differ, so do not copy live development match data into a production build. A database backup alone does not prove an interrupted match can resume; verify the resumed match through the service after restoring it.

## Releases

Back up data before updating the deployed image. Build the browser and server from the same commit, keep the existing data volume and external-origin settings, then replace the service with `docker compose -f deploy/server-compose.yml up -d --build server`. Repeat the public readiness and persistence checks. Rolling back code may require restoring a matching data backup if its database format has changed; check compatibility before starting an older image against current data.
