# Match save format

`src/core/saves.ts` exports `saveGame(state)` and `loadGame(input)`. Saving returns a detached JSON envelope. Loading accepts that envelope or its JSON text and returns a new `GameState`. The caller replaces the current match only after loading succeeds. The loader throws an `Error` for invalid input and never changes an existing match or the input object.

The envelope has four required fields:

| Field | Value |
| --- | --- |
| `format` | `"orcs-vs-fairies-save"` |
| `version` | `3` |
| `state` | The complete game state, with fog sets encoded as arrays |
| `runtime` | The simulation memory encoded by `captureRuntime` |

Version 3 saves support one through eight players. The loader also accepts complete version 1 and version 2 saves through the explicit migration below. A bare `GameState`, a future version, an unknown property, or a missing required field is rejected. New game fields must be added to the validator and tests; an incompatible representation requires a new version and an explicit migration. Missing simulation memory is never replaced with defaults.

## State and simulation memory

`state` includes AI configurations, controllers, teams, income factors, population limits, shared vision, player elimination flags, the winning team, map size and version, all terrain cells, starting positions, seed, elapsed time, tick, next entity ID, entities, resources, players, corpses, current events, winner and draw status. Entity snapshots preserve position, health, shields, orders, waiting orders, movement paths, recruitment and research progress, rally points, carried resources, animation and facing, ability deadlines, entrenchment, illusions and raised units. `visible` and `explored` contain one array of unique tile IDs per player. Loading rebuilds the sets and preserves their insertion order.

All player arrays must have the same length as `players`: `aiConfigs`, `controllers`, `starts`, `teams`, `incomeFactors`, `populationLimits`, `eliminated`, `visible` and `explored`. Player sides are contiguous indices from 0 through `players.length - 1`. Team IDs are integers from 0 through 7 and may differ from player indices. Income factors range from 0 through 10; population limits are integers from 1 through 500. `sharedVision` and each elimination flag are booleans. A winner must belong to `winningTeam`; both are null during an unfinished match or a draw. A winning team must have a player in the match.

`runtime` contains fog and AI countdowns, AI turn ordering, route keys and recomputation times, ability cooldowns, returning worker IDs, finite queued-gather worker IDs, attack-wave times, scouting flags and scout IDs, remembered enemy buildings, cleared enemy-start flags and player IDs, and searched tiles. Each of `aiWave`, `initialScoutDispatched`, `expansionScout`, `expansionScoutDispatched`, `knownEnemyBuildings`, `enemyStartCleared`, `clearedEnemyStarts` and `searched` has one entry per player. Each `clearedEnemyStarts` row contains unique player indices within the match. Maps become `[key, value]` arrays; sets become value arrays. Loading restores the original map and set insertion order because AI decisions can depend on it. Historical route and cooldown entries may reference retired entities; IDs must still be below `nextId`.

`captureRuntime(state)` and `restoreRuntime(state, snapshot)` are exported for the save codec. `restoreRuntime` accepts a snapshot already checked by the loader. Pending hits use entity IDs and event indices, and restoration reconnects those references. Normal snapshots taken between ticks have no pending hits because `resolveHits` clears settled attacks. The temporary `stepping` flag and replay subscribers are not gameplay state and are not saved. Navigation grids are derived from terrain and obstacles and rebuild on demand.

## Validation and limits

The codec copies data before validation and restoration. It accepts plain JSON objects and arrays and rejects class instances, accessors, array gaps, unsafe property names, cycles, nonfinite numbers and deeply nested input. The object-copy pass does not invoke getters. Undefined optional object fields are omitted, matching JSON serialization. The complete envelope has a 16 MiB UTF-8 limit for both object and text input. The copy pass also limits nesting to 32 levels, visited values to 2,000,000, individual arrays to 100,000 entries and total string content to 16 MiB of UTF-16 storage. The node limit permits full fog and AI search memory for eight players on a 256 by 256 map.

Maps must have integer dimensions from 8 through 256, the matching number of terrain cells, known terrain kinds and valid positions. Seeds must be unsigned 32-bit integers. IDs must be positive 31-bit integers below `nextId`; live entity and resource IDs cannot collide. Version 3 permits at most 8,192 entities, 8,192 resources, 16,384 corpses and 32,768 current events. Player population capacity cannot exceed 500. Numbers must be finite and within explicit limits, including nonnegative resource balances and time no greater than 10¹². Health cannot exceed maximum health, shields cannot exceed capacity, carried stock cannot exceed 18, and progress values must be within the simulator's ranges.

The validator checks faction, role, upgrade, event and order variants. Recruitment queues permit at most five entries and must belong to an eligible producer. Orders require either valid coordinates or an ID appropriate to their variant. A target ID may refer to an object that has since disappeared, because queued attacks and repairs can lose their targets before activation. The simulation skips those orders. Fog IDs must be unique and within the map, and visible tiles must also be explored. Runtime timers, array lengths, map entries, remembered building roles and pending hit references are checked before restoration. Route creation and attack-wave timestamps cannot be later than the saved time. A living player cannot research a completed upgrade or research the same upgrade in two buildings. The finite-gather marker must reference a living worker with a gather order.

## Version 1 migration

The loader first validates the entire old schema. Version 1 requires exactly two players and two entries in every player and AI memory array. Entity sides, event sides and winners must be 0 or 1; player capacity cannot exceed 100. It retains the old limits of 4,096 entities, 8,192 corpses and 16,384 events. All original runtime fields, including `queuedGather`, are required. Supplying any of the six new team fields in a version 1 state is an unknown-field error.

After validation, the loader adds `teams: [0, 1]`, `incomeFactors: [1, 1]`, `populationLimits: [100, 100]` and `sharedVision: true`. Each player is eliminated only when it has no living, completed headquarters. `winningTeam` receives the old winner value. The new `runtime.clearedEnemyStarts` rows derive from the original `enemyStartCleared` flags: side 0 receives `[1]` when cleared, and side 1 receives `[0]` when cleared. Uncleared rows are empty. The loader preserves all original state and runtime data, validates the resulting version 2 envelope and restores a new match. The caller's input remains unchanged. The version 2 result is then migrated to version 3. Saving a migrated match always produces version 3.

## Version 2 migration and AI memory

Version 3 adds one `aiConfigs` object per player with validated difficulty, personality and opening choices. Runtime adds an `aiBatchTurns` count for rotating actual decision batches, while the original global `ai` and `aiTurns` clocks retain their one-second cadence. It also adds the per-player arrays `aiDecisionAt`, `aiDecisionTurns`, `knownEnemyUnits`, `retreating` and `producedFighters`. Unit observations contain role, last observed coordinates, observation time and health fraction; they retain only visible sightings and expire after 90 seconds. Retreat records contain a deadline, the number of fighters produced, and the greatest assigned entity ID when the retreat began. A soldier rejoins after the deadline, a real new fighter has been recruited and reached the rally point, and the retreating soldier has returned near it. Both memories preserve insertion order.

The loader validates a complete version 2 envelope before adding normal, balanced AI configurations with infantry openings. Decision deadlines start at saved match time, decision and production counts start at zero, and the new unit/retreat memories start empty. Older building and scout memories remain intact. AI decision rules changed in this version; importing the old state does not promise identical future behavior or historical replay playback.

## Queued orders and recruitment

A movement, attack-move, attack, gather or repair command with `queued: true` adds one waiting order per eligible selected unit. Idle or holding units start it immediately. Each unit can have 32 waiting orders. A refused queued command leaves the current order and waiting list unchanged. Ordinary orders replace the waiting list; stop and hold also clear it.

Movement advances when the unit reaches its waypoint. Attack-move reaches its waypoint after any intervening combat. Attack advances when its target dies or becomes hidden. Repair waits for construction and repair to finish. Gather continues until its chosen deposit is exhausted, delivers any carried stock, and then advances. A final queued gather also finishes its chosen deposit instead of choosing another. Its active status is stored separately from the waiting list, so saving after the preceding orders finish preserves this behavior. Ordinary gathering still finds another deposit automatically. Orders with lost or completed targets are skipped when activated.

`{type: "reorderTrain", id, from, to}` moves one waiting recruitment entry to another waiting position. Both indices must be integers between 1 and the current queue's last index, and they must differ. Index 0 is the active recruit. Reordering preserves active progress, paid costs and population reservations. The producer must be owned, alive, complete and eligible to recruit. Missing, stale, hostile or invalid commands return `false` without changing the state.

## Verification

`tests/saves.test.ts` round-trips the actual codec, then compares complete saved state and runtime after every tick. Its AI test runs 600 continuation ticks with scouting and economic memory; its worker test runs another 500 with a returning worker, partial recruitment and waiting orders. Ability tests verify illusions, cooldown rejection, reactivation and paid research across restoration. Malformed-input tests cover versions, missing memory, invalid variants, duplicate IDs, nonfinite or unbounded values, queue limits, fog and hit references, getters, cycles and oversized input.

`tests/team-saves.test.ts` checks one through eight player snapshots, 500-tick continuation of 2v2, 3v3 and 4v4 matches with AI, finite worker queues and active illusions, and all eighth-player runtime fields. It rejects inconsistent array lengths, invalid player sides, malformed team rules, winner mismatches and bad eighth-player research or memory. Dense eight-player fog and search arrays exercise the largest supported dimensions. Legacy tests derive version 1 fixtures from real two-player matches, preserve AI and ability memory through continuation, verify elimination defaults, and reject missing runtime data before migration.

`tests/order-queue.test.ts` drives mixed orders through `stepGame`, including resource delivery, repair completion, combat, hidden or dead targets and the queue limit. `tests/production-reorder.test.ts` observes recruit spawn order and timing, resource balances and population reservations, and checks refusal of invalid and stale indices.
