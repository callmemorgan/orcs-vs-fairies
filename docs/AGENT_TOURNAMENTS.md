# Agent tournaments

The tournament runner plays external terminal agents against one another through the shared simulation. Each match has two players, both controlled by separate child processes. The runner sends player observations, accepts ordinary game commands, advances the game, and records a replay and process evidence. Built-in AI does not control either player.

The modules provide a CLI, an HTTP handler, and a browser dashboard. The main game mounts the dashboard beside its session controls. The authoritative server registers `scripts/tournaments/smoke.json` and uses its account cookies for access. Sign in through Online, then open Tournaments. The tournament format is separate from the single-agent CLI protocol described in [Terminal agents](TERMINAL_AGENTS.md).

## Build and run

Run these commands from the repository root:

```sh
npm ci
npm run build:tournament
npm run tournament -- --config scripts/tournaments/smoke.json --output work/tournaments/smoke-001
npm run tournament -- --verify work/tournaments/smoke-001/tournament.json
```

The output directory must be new. The runner creates its parents but refuses to overwrite an existing directory. Each recorded match produces `match-NNN.replay.json` and `match-NNN.evidence.json`; the latter contains the result, decisions, checkpoints, and process statistics without duplicating the replay. `tournament.json` contains the complete report and embedded replays.

The run command writes progress JSON lines to stderr and a final summary to stdout. A complete run exits successfully even when matches end at their time limit or by forfeit. A canceled or failed run exits with code 1. SIGINT and SIGTERM request cancellation, stop the agents, and retain recorded match evidence. Failures during initial configuration, directory creation, or provenance collection can end the command before it writes a report.

`--cwd PATH` sets the directory used to launch agents and resolve engine and agent source files. It defaults to the process working directory. The config filename and output directory are resolved from the invoking process's working directory, independently of `--cwd`.

The supplied smoke configuration runs the observation-only `push` and `idle` styles in both seat orders on seed 4127. It exercises the agent protocol and replay path. It does not measure competitive strength or faction balance. The script also has `hang` and `crash` styles for testing timeouts and premature exits.

## Configuration and scheduling

A version 1 configuration registers agents and match limits. This is the supplied smoke configuration:

```json
{
  "version": 1,
  "id": "builtin-smoke",
  "name": "Observation-only push versus idle",
  "agents": [
    {
      "id": "push",
      "name": "Push",
      "faction": "orcs",
      "command": ["node", "scripts/agents/tournament-agent.mjs", "--style", "push"]
    },
    {
      "id": "idle",
      "name": "Idle",
      "faction": "fairies",
      "command": ["node", "scripts/agents/tournament-agent.mjs", "--style", "idle"]
    }
  ],
  "seeds": [4127],
  "mapSize": "small",
  "bothSeats": true,
  "maxSeconds": 1200,
  "decisionTicks": 100,
  "responseTimeoutMs": 2000,
  "maxCommandsPerTurn": 64
}
```

The runner visits seeds in their listed order, then every unordered agent pair in agent-list order. With `bothSeats: true`, it plays each pair in both seat orders on the same seed. Otherwise, the earlier agent in the list always occupies side 0. It runs matches sequentially and launches fresh processes for every match, including repeat pairings.

| Field | Accepted values |
| --- | --- |
| `id` and agent IDs | 1–64 letters, digits, underscores, or hyphens; the first character is a letter or digit. Agent IDs must be unique. |
| `name` and agent names | Nonblank strings of at most 80 characters. |
| `agents` | 2–16 agents with a known faction and an executable `command` array. |
| Agent `command` | 1–32 argv tokens, each at most 4,096 characters and without NUL. The executable token must be nonempty. |
| Agent `sourceFiles` | Optional array of up to 32 unique file paths to include in provenance. |
| `seeds` | 1–16 unique unsigned 32-bit integers. |
| `mapSize` | `small`, `medium`, `large`, or `huge`. |
| `bothSeats` | Required boolean. |
| `maxSeconds` | Integer from 1 through 2,700; the simulation limit, not a wall-clock deadline. |
| `decisionTicks` | Integer from 1 through 1,200; one tick is 0.05 simulation seconds. |
| `responseTimeoutMs` | Integer from 100 through 30,000; each agent's wall-clock response deadline. |
| `maxCommandsPerTurn` | Integer from 1 through 64. An agent may return no commands. |
| `startingAge` | Optional integer from 1 through 3; defaults to 1. |
| `startingResources` | Optional object with required `wood`, `ore`, and `crystal` values, each finite and from 0 through 1,000,000,000. Applied equally to both players. |

Unknown fields are rejected. The complete schedule may contain at most 128 matches, so a configuration can exceed the schedule limit even when its individual fields are valid. Matches use separate teams, external controllers, and `sharedVision: false`.

## Agent protocol

An agent executable reads one JSON object per stdin line and writes one JSON object per stdout line. It stays alive until the runner closes stdin or terminates it. Put logs on stderr. The runner passes the executable and arguments directly to `spawn` without a shell.

Every request has this envelope:

```json
{
  "protocol": "orcs-vs-fairies/tournament-agent",
  "version": 1,
  "type": "turn",
  "requestId": 1,
  "observation": {},
  "receipts": []
}
```

`observation` is the complete player view described below. `requestId` starts at 1 and increments once per decision round; both players receive the same ID. `receipts` contains that player's commands from the preceding round and their `accepted` booleans. The first request has an empty receipt array.

Return only `requestId` and `commands`, followed by a newline. Copy the request ID and return ordinary game commands without the single-agent CLI's `op` wrapper:

```json
{"requestId":1,"commands":[{"type":"train","id":8,"role":"worker"}]}
```

The ID above is illustrative; use an owned entity ID from the observation. `{"requestId":1,"commands":[]}` is a valid idle decision. The runner permits blank stdout lines, but nonblank output must be a response to the outstanding request. Extra response fields, an incorrect request ID, invalid command shapes, too many commands, invalid JSON, or buffered stdout exceeding 64 KiB cause a process fault. Timeouts, process or stdin errors, and exit before the match finishes also cause faults.

The runner captures both observations before applying either response. It requests both decisions concurrently and waits for both. It applies side 0 first on odd request IDs and side 1 first on even IDs, preserving each agent's command order. If either process faults in that round, neither player's commands take effect. Cancellation also prevents those commands from taking effect.

A command can pass shape validation and still be refused by `issueCommand` because of ownership, visibility, resources, capacity, or placement. That produces `accepted: false` and does not forfeit the match. [Terminal agents](TERMINAL_AGENTS.md#commands) describes the game commands and coordinates; `src/core/commands.ts` is the strict shape validator. Queued orders and recruitment reordering are described in [Match save format](SESSION_FORMAT.md#queued-orders-and-recruitment).

After applying commands, the runner advances up to `decisionTicks` ticks, stopping early when the game ends or reaches `maxSeconds`. No simulation time passes while agents think. There is no final observation or shutdown message after the last round.

## Observations

`PlayerView.observe` in `src/core/observation.ts` creates the same filtered player data used by the terminal game. It includes tick and time, side and team, public match setup, the controlled player's resource bank and population, own living entities, visible living enemies, explored terrain, visible and explored cell indices, resource memory, visible corpses, content definitions, and result fields.

Coordinates use simulation tiles. Terrain cells outside explored ground are `null`; cell indices are `floor(y) * width + floor(x)`. Resource memory preserves the last observed amount and `lastSeen` time, with `visible` indicating a current sighting. Depletion outside vision does not update that memory.

Own entities include orders, waiting orders, recruitment queues, research and production progress, rally points, carried resources, and ability timing. Enemy entities omit those private fields, and enemy resource banks and population are absent. Visible enemy illusions use their apparent health values and omit the illusion marker. Internal pathfinding routes are absent from every entity observation.

Map seed, dimensions, factions, and starting positions are public. The example tournament agent imports no game implementation and makes its decisions from this input. Child processes inherit the host environment and filesystem/network access; observation filtering does not restrict those operating-system permissions.

## Outcomes and standings

A battle win earns 3 points and a battle draw earns 1 point per agent. A single process fault ends that match as a forfeit, with 3 points and a win for the other agent. If both processes fault, the match is a double forfeit. A fault affects that match; subsequent scheduled matches start new processes.

Time-limit matches, aborted matches, and double forfeits count as incomplete and award no points. They do not count as wins, losses, or draws. `played` includes every recorded match, including incomplete ones. `forfeits` counts matches in which that agent has a recorded process fault. Rankings sort by points, then wins, then agent ID; there is no Elo, head-to-head tiebreaker, or resource-based adjudication.

A report with status `complete` has processed the whole schedule. Some or all of those matches can still be incomplete. Results compare the selected agents, factions, seeds, decision intervals, and response deadlines. They do not establish general agent strength, and the scoring does not compensate for a single seat order or unequal unfinished-match counts.

Each process record contains its PID, turn and command counts, fault, exit code or signal, and the first 16,384 UTF-16 code units of stderr with a truncation flag. At match shutdown the runner closes stdin, allows 250 ms for exit, then sends SIGTERM and allows another 250 ms before SIGKILL if needed. On POSIX systems it signals the process group; on Windows it signals the direct child. A shutdown signal in the statistics does not itself mean the agent forfeited.

## HTTP integration

`src/server/main.ts` registers the built-in smoke configuration from the repository working directory. Its run directories are stored beneath `RTS_DATA_DIR/tournaments`. The canonical router checks account authentication and the existing origin rule before dispatching tournament requests, and server shutdown disposes the service. Programmatic hosts can supply `ServerOptions.tournaments` with a working directory, registered configurations and an optional output root; omitting it disables these routes.

`createTournamentService` in `src/tournament/service.ts` returns an async `handle(request, response)` function and `dispose()`. Mount it in the host's existing Node HTTP router. The host owns the registered configurations, working directory, output root, and authorization rule. The names below stand for those host values and functions:

```ts
import { createTournamentService } from './tournament/service';

const tournaments = createTournamentService({
  cwd: repositoryRoot,
  outputRoot: tournamentOutputRoot,
  configs: registeredConfigs,
  authorize: request => authorizedForTournaments(request),
  principal: request => trustedAccountId(request),
});

async function route(request, response) {
  if (await tournaments.handle(request, response)) return;
  await routeOtherRequests(request, response);
}

```

The handler returns `false` for paths outside `/api/tournaments`. It authorizes every tournament route, including read requests. HTTP clients select a registered config ID; they cannot supply commands, source paths, or replacement configuration fields. The start body is limited to 4 KiB. The service permits one active tournament per instance and returns 409 if another start arrives while it is running.

For a shared account server, supply the optional trusted `principal(request)` callback with the stable account ID. It may return an ID or a promise of one. Starting and canceling a run require a nonempty ID of at most 1,024 characters; a missing ID returns 403. The service captures the creator ID once at creation, and only that creator may cancel the run. Other authorized accounts can read public configuration choices, progress, results and replays. Keep the host's origin checks on mutation requests. A trusted standalone service that supplies only `authorize` retains its previous behavior: every authorized caller may cancel.

| Request | Response |
| --- | --- |
| `GET /api/tournaments/configs` | Configuration choices with agent names and factions, seeds, map size, seat setting, and time limit. |
| `GET /api/tournaments` | Progress records for known runs. |
| `POST /api/tournaments` with `{"configId":"builtin-smoke"}` | 202 with `{"id":"run-..."}`. |
| `GET /api/tournaments/:id` | Run status, recorded-match count, standings, and current matchup tick/time. |
| `GET /api/tournaments/:id/result` | Final report; 409 while running. An initialization failure without a report returns 500. |
| `POST /api/tournaments/:id/cancel` | 202 after requesting cancellation; 403 for another account when `principal` is configured. Poll status to see when cleanup finishes. |
| `GET /api/tournaments/:id/matches/:matchId/replay` | Replay from the final report; unavailable while that report is absent. |

The service stores each run in a new `run-...` directory. On startup it reads non-running reports from matching directories under the output root. It validates their structure but does not replay-verify them at startup. It retains unfinished directories without inventing a result or restarting their agents. `dispose()` requests cancellation and waits for active jobs and their children to finish.

Account ownership is stored separately in `owners/run-....json` under the output root, with version, run ID and principal fields. The service reserves the run before writing and flushing that record, then launches the runner without precreating its output directory. A failed ownership write launches no agents and releases the reservation; shutdown waits for pending ownership preparation and removes a record whose run was never launched. Completed and canceled runs retain their creator across restart. Missing, malformed or mismatched ownership records still permit authorized public reads, but cannot grant cancellation in account mode. Ownership IDs are not added to public progress or runner reports.

## Dashboard integration

`src/main.ts` mounts the dashboard with the shared replay importer. Opening it pauses local play and blocks game input through the existing modal owner set. Opening another modal blocks its launch control, and photo mode hides the dashboard. Inspecting a verified match installs the archive in the ordinary replay viewer.

`createTournamentDashboardSource` in `src/tournament/client.ts` implements the dashboard's `choices`, `start`, `status`, `result`, and `cancel` methods over HTTP. Its default base URL is empty for same-origin requests, which include same-origin authentication cookies. The service supplies no authentication UI or cross-origin credential handling.

Mount `mountTournamentDashboard` alongside the host's session tools:

```ts
import { createTournamentDashboardSource } from './tournament/client';
import { mountTournamentDashboard } from './ui/TournamentDashboard';

const dashboard = mountTournamentDashboard(root, {
  source: createTournamentDashboardSource(),
  onReplay: async (archive, match, report) => {
    await installVerifiedReplay(archive, match, report);
  },
  onVisibility: open => setTournamentModalOpen(open),
});

dashboard.update({ blocked: anotherModalIsOpen });
```

The host supplies `installVerifiedReplay` to install the selected archive in its replay/session controls and `setTournamentModalOpen` to coordinate input blocking and pause behavior. `onReplay` receives the archive, match evidence, and verified report. The dashboard closes after that callback succeeds. It keeps the report open and displays an error if the callback fails.

The dashboard lists registered choices, starts and cancels runs, and polls live status once a second while open. Live standings describe the service's progress; final report display, download, and replay inspection require report verification. Imported reports have a 64 MiB limit. Closing the dashboard stops polling but does not cancel a run; reopening resumes polling for the run started through that dashboard.

Omit `source` to provide report import and inspection without run controls. `loadReport(input)` supports host-provided reports and verifies them before display. `update({ blocked })` prevents opening while another host modal is active. Call `dispose()` to remove the component and its listeners. An optional `download(filename, report)` callback can replace the default JSON download.

## Provenance and verification

The runner collects provenance before the first match. The report records SHA-256 checksums of built-in faction, ability, upgrade, and economy definitions; the immediate `.ts` files in `src/core`, `src/tournament`, and `src/cli`; each agent executable; explicit agent `sourceFiles`; and an existing direct script argument at `command[1]`. It also records argv, Node version, platform, architecture, and save version. The source-list checksum is `engineSha256`. This collection does not include a complete dependency tree or prove that a compiled executable came from the listed source files.

Each decision records an observation checksum, command receipts, and any fault. Each match records a decision-transcript checksum and saved-state checksums at tick 0, decision boundaries, and the final tick. Saved-state hashing includes simulation memory and sorts visible and explored cell arrays. The runner replays each match through the same `ReplayPlayer` implementation used by the browser, in the runner's Node process, and compares its final state before publishing that match.

`verifyTournamentReport` validates the config, schedule, initial replay state, report structure, current content checksum, source-list checksum, transcript checksum, and equality between accepted commands and replay commands. It replays every checkpoint and checks the battle or external-outcome rules and command totals. The browser dashboard runs this verification in the browser; `--verify` runs it in Node.

Verification recomputes `engineSha256` from the source list inside the report. It does not compare those source files or agent executables against the local build. It does not rerun agents, recompute observation checksums, prove that rejected commands were illegal, or authenticate timeout and process-fault claims. Process evidence, timestamps, and runtime metadata remain recorded claims. These checksums establish internal consistency and help identify versions; they are not signatures or proof of authorship.

Replay compatibility depends on simulation behavior as well as the JSON format. A content, navigation, scheduling, or numeric change can make an earlier recording diverge. A Node verification pass does not establish browser parity. To compare both runtimes, use the supplied checker with a new evidence directory:

```sh
OVF_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node scripts/tournaments/verify-runtime-parity.mjs \
  work/tournaments/smoke-001/tournament.json \
  work/tournaments/smoke-001-parity
```

Playwright and its Chromium browser must be available in that environment; Playwright is not a project dependency. The checker builds Node and browser bundles from the current source, compares saved-state SHA-256 values at every replay tick, checks continuation after saving/loading, and checks seeks at selected checkpoints. It writes per-match runtime evidence and writes `summary.json` only after all matches pass. Its evidence applies to that report and the Node and Chromium versions it records.

## Dashboard and service proof

`scripts/tournaments/verify-dashboard-service.mjs` builds the two proof entry points and runs the dashboard in headless Chromium against a temporary loopback HTTP server. It mounts the real `createTournamentService`, `createTournamentDashboardSource`, and `mountTournamentDashboard` with cookie authorization supplied by the fixture. Run it from the repository root on Linux, where it uses `/proc` to identify agent processes. The evidence directory must be new:

```sh
OVF_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node scripts/tournaments/verify-dashboard-service.mjs \
  work/tournaments/dashboard-service-001
```

Set `OVF_PLAYWRIGHT_MODULE` to the bundled workspace runtime's Playwright module or another installed module. Without that variable, the script imports `playwright` through normal module resolution. Its Chromium browser must be available. This fixture verifies the service's authorization callback and same-origin client cookies; it does not exercise the authoritative server's account sign-in flow.

The proof rejects unauthorized requests and extra command fields, starts the smoke tournament through the displayed controls, observes HTTP progress and standings, downloads its report, and verifies both matches in Node and the browser. It checks the replay HTTP response against the report. Each match's replay callback plays the whole archive in the browser, compares the final state, seeks to the midpoint and back to the end, and compares the final state again.

The cancellation check starts two hanging agents, identifies both live PIDs through a unique `/proc` command-line marker, rejects an unauthorized cancel request, and clicks Stop tournament. It verifies the canceled partial report in Node and the browser, confirms that its recorded PIDs match the two observed live PIDs, and checks that both have exited with no marked agent processes remaining.

The directory contains the Node and browser bundles and stylesheet, `smoke-report.json`, `canceled-report.json`, the service's `runs` directory, and `dashboard-complete.png` and `dashboard-canceled.png`. `summary.json` records bundle checksums, the served browser bundle checksum, runtime versions, run results, browser callback evidence, and passing checks. The cleanup path closes the service, browser, and HTTP server and writes `cleanup.json` with their final state and remaining agent PIDs. A failed assertion makes the command fail; retained files can still show partial evidence, so check both the exit result and cleanup record.
