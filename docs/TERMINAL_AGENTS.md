# Terminal agents

The CLI runs the game without a browser. It controls one player through the same simulation, economy, fog and command functions used by the browser. The other player uses the built-in AI. The default controlled player is side 1, the computer's usual starting side.

Build and start it from the repository root:

```sh
npm install
npm run build:cli
node dist-cli/rts.js --log work/my-match.ndjson
```

The process accepts one JSON object per input line and returns one JSON object per output line. A successful reply is `{"ok":true,"result":...}`. An invalid request returns `{"ok":false,"error":"..."}` without ending the process. Gameplay commands return an `accepted` boolean; a well-formed order can still fail because of ownership, visibility, resources, capacity or placement.

A process hosts one match. Start a new process to play another. `--log` requires a new filename so it cannot overwrite earlier match evidence. Diagnostics go to stderr. Input lines are limited to 1 MiB.

## Start and observe

```json
{"op":"start","faction":"automata","opponent":"tideborn","side":1,"mapSize":"small","seed":4127}
{"op":"observe"}
```

`faction` is the controlled faction, regardless of side. Faction IDs are `orcs`, `fairies`, `dwarves`, `undead`, `tideborn` and `automata`. `side` is 0 or 1. Map sizes are `small` (36 × 36), `medium` (48 × 48) and `large` (64 × 64). The seed must be an integer from 0 through 4294967295. Defaults are Orcs versus Fairies, side 1, medium, seed 4127.

The start reply is an observation. Observations include the controlled player's resource bank and population, own living entities, currently visible living enemies, explored terrain, visible and explored cell indices, observed resource deposits, visible corpses, faction definitions, abilities and the current result. Coordinates use simulation tiles, not screen pixels. A cell index is `floor(y) * width + floor(x)`.

Unexplored terrain is `null`. Resource entries retain their last observed amount and `lastSeen` time; the `visible` flag distinguishes a current observation from memory. Depletion outside vision does not update that memory. Enemy entries omit orders, queues, cooldowns, carried resources and production progress. Enemy resource banks and population are not returned. Own orders and production queues are available, but internal pathfinding routes are omitted.

Map seed, dimensions, faction choices and starting locations are public match setup. An agent is expected to use the observations for its decisions; knowing a reproducible seed can theoretically let any player reconstruct the map. There is no hidden server secret in this local game.

## Commands

Wrap one ordinary game command in `{"op":"command","command":...}`. IDs refer to entities or resource nodes in observations. Only your living, non-illusion units accept unit orders. Commands cannot override the controlled side.

| Command | Fields | Behavior |
| --- | --- | --- |
| `move` | `ids`, `x`, `y` | Move to a point, using a formation for groups. Obstructed ground clicks choose nearby open ground. |
| `attackMove` | `ids`, `x`, `y` | Advance while engaging visible enemies. |
| `attack` | `ids`, `target` | Attack a currently visible enemy entity. |
| `gather` | `ids`, `target` | Workers gather a currently visible wood, ore or crystal node and return loads to a completed HQ or depot. |
| `build` | `ids`, `role`, `x`, `y` | Workers place and construct `hq`, `depot`, `barracks` or `tower`. Costs are paid on placement. The entire footprint must be visible and buildable. |
| `repair` | `ids`, `target` | Workers resume a friendly foundation or repair a damaged friendly building. Repairs consume wood. |
| `train` | `id`, `role` | A completed HQ trains `worker`; a completed barracks trains `melee`, `ranged` or `special`. Costs and population slots are reserved immediately. |
| `hold` | `ids` | Defend within weapon range without pursuing. |
| `stop` | `ids` | Cancel orders. Idle troops may pursue nearby enemies. |
| `ability` | `ids` | Activate eligible selected abilities, subject to cooldown and target requirements. |

Examples below use illustrative IDs; obtain real IDs from the start reply.

```json
{"op":"command","command":{"type":"gather","ids":[9,10],"target":25}}
{"op":"command","command":{"type":"train","id":8,"role":"worker"}}
{"op":"command","command":{"type":"attackMove","ids":[14,52,53],"x":7.5,"y":7.5}}
```

IDs must be integers, coordinates finite numbers, and group lists contain 1–100 IDs. Unknown command fields and roles are rejected. The CLI does not expose commands to spawn entities, alter banks, reveal fog or edit the world.

## Advance and results

```json
{"op":"advance","ticks":100}
{"op":"result"}
```

One tick advances 0.05 seconds. A request accepts 1–1200 ticks, up to 60 seconds. The reply contains the number advanced, player-visible events from those ticks and the resulting observation. Both players' units, production and economy advance together. The built-in opponent makes decisions once a second. No simulation time passes while the terminal agent thinks.

A match ends when a stronghold falls. Both falling in one exchange is a draw. Advance stops at the result. The result reply reports `finished`, `winner`, `draw`, `time`, `tick`, controlled `side` and `outcome` (`win`, `loss`, `draw`, or `null` while unfinished). The CLI has no artificial match timeout; agents can choose their own limit. The automated ladder uses 45 minutes and records unfinished matches separately.

## Example player and replay

The Python example starts the CLI as a subprocess, reads observations, balances workers across resources, constructs buildings, recruits an army and attacks. It imports no game code and reads no private state.

```sh
python3 scripts/agents/example_agent.py \
  --faction automata --opponent tideborn --side 1 \
  --map-size small --seed 4127 \
  --log work/automata-match.ndjson
node dist-cli/rts.js --replay work/automata-match.ndjson
```

The log contains each valid request and a SHA-256 hash of the resulting simulation state. It does not return private state to the agent. Replay reconstructs the match from the requests and checks every hash, including rejected gameplay orders. Malformed protocol requests do not enter the replay because they do not execute a game operation. Replays require the same simulation version: changing navigation, stats or scheduling can change the outcome. The verifier stops at the first divergent entry.

The example is a usable starting point, not a strong competitive player. Its five-second decision interval, fixed economy targets and simple formations leave room for better scouting, retreating, expansion and micro-management.
