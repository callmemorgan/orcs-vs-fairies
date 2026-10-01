# Server deployment

The Node server serves the browser build, HTTP API and WebSocket endpoint from one origin. It uses Node 24's built-in `node:sqlite` and a writable data directory for persistent accounts and service records. `Dockerfile.server` builds the browser and server together; `deploy/server-compose.yml` runs that image with a persistent volume.

The initial server foundation supports two human seats. Team battles and cooperative rosters require the planned `createMatch` integration. Local build and service tests do not prove that a public deployment exists. Public online acceptance still requires an actual host, TLS, a durable volume and independent browsers exercising the hosted flows. These deployment files do not claim those steps have happened. See [the feature architecture](HUNDRED_FEATURE_ARCHITECTURE.md) for service and game integration requirements.

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
