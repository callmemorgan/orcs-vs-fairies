# Match save format

`src/core/saves.ts` exports `saveGame(state)` and `loadGame(input)`. Saving returns a detached JSON envelope. Loading accepts that envelope or its JSON text and returns a new `GameState`. The caller replaces the current match only after loading succeeds. The loader throws an `Error` for invalid input and never changes an existing match or the input object.

The envelope has four required fields:

| Field | Value |
| --- | --- |
| `format` | `"orcs-vs-fairies-save"` |
| `version` | `1` |
| `state` | The complete game state, with fog sets encoded as arrays |
| `runtime` | The simulation memory encoded by `captureRuntime` |

Only version 1 is supported. A bare `GameState`, a future version, an unknown property, or a missing required field is rejected. New game fields must be added to the validator and tests; an incompatible representation requires a new version and an explicit migration. An old save must never load with omitted runtime state or substituted defaults.

## State and simulation memory

`state` includes controllers, map size and version, all terrain cells, starting positions, seed, elapsed time, tick, next entity ID, entities, resources, players, corpses, current events, winner and draw status. Entity snapshots preserve position, health, shields, orders, waiting orders, movement paths, recruitment and research progress, rally points, carried resources, animation and facing, ability deadlines, entrenchment, illusions and raised units. `visible` and `explored` contain two arrays of unique tile IDs. Loading rebuilds the sets and preserves their insertion order.

`runtime` contains fog and AI countdowns, AI turn ordering, route keys and recomputation times, ability cooldowns, returning worker IDs, finite queued-gather worker IDs, attack-wave times, scouting flags and scout IDs, remembered enemy buildings, cleared enemy-start flags, and searched tiles. Maps become `[key, value]` arrays; sets become value arrays. Loading restores the original map and set insertion order because AI decisions can depend on it. Historical route and cooldown entries may reference retired entities; IDs must still be below `nextId`.

`captureRuntime(state)` and `restoreRuntime(state, snapshot)` are exported for the save codec. `restoreRuntime` accepts a snapshot already checked by the loader. Pending hits use entity IDs and event indices, and restoration reconnects those references. Normal snapshots taken between ticks have no pending hits because `resolveHits` clears settled attacks. The temporary `stepping` flag and replay subscribers are not gameplay state and are not saved. Navigation grids are derived from terrain and obstacles and rebuild on demand.

## Validation and limits

The codec copies data before validation and restoration. It accepts plain JSON objects and arrays and rejects class instances, accessors, array gaps, unsafe property names, cycles, nonfinite numbers and deeply nested input. The object-copy pass does not invoke getters. Undefined optional object fields are omitted, matching JSON serialization. Strings have a 16 MiB input limit; the copy pass also limits nesting to 32 levels, visited values to 500,000, individual arrays to 100,000 entries and total string content to 16 MiB.

Maps must have integer dimensions from 8 through 256, the matching number of terrain cells, known terrain kinds and valid positions. Seeds must be unsigned 32-bit integers. IDs must be positive 31-bit integers below `nextId`; live entity and resource IDs cannot collide. The state permits at most 4,096 entities, 8,192 resources, 8,192 corpses and 16,384 current events. Numbers must be finite and within explicit limits, including nonnegative resource balances and time no greater than 10¹². Health cannot exceed maximum health, shields cannot exceed capacity, carried stock cannot exceed 18, and progress values must be within the simulator's ranges.

The validator checks faction, role, upgrade, event and order variants. Recruitment queues permit at most five entries and must belong to an eligible producer. Orders require either valid coordinates or an ID appropriate to their variant. A target ID may refer to an object that has since disappeared, because queued attacks and repairs can lose their targets before activation. The simulation skips those orders. Fog IDs must be unique and within the map, and visible tiles must also be explored. Runtime timers, tuples, map entries, remembered building roles and pending hit references are checked before restoration. Route creation and attack-wave timestamps cannot be later than the saved time. A living player cannot research a completed upgrade or research the same upgrade in two buildings. The finite-gather marker must reference a living worker with a gather order.

## Queued orders and recruitment

A movement, attack-move, attack, gather or repair command with `queued: true` adds one waiting order per eligible selected unit. Idle or holding units start it immediately. Each unit can have 32 waiting orders. A refused queued command leaves the current order and waiting list unchanged. Ordinary orders replace the waiting list; stop and hold also clear it.

Movement advances when the unit reaches its waypoint. Attack-move reaches its waypoint after any intervening combat. Attack advances when its target dies or becomes hidden. Repair waits for construction and repair to finish. Gather continues until its chosen deposit is exhausted, delivers any carried stock, and then advances. A final queued gather also finishes its chosen deposit instead of choosing another. Its active status is stored separately from the waiting list, so saving after the preceding orders finish preserves this behavior. Ordinary gathering still finds another deposit automatically. Orders with lost or completed targets are skipped when activated.

`{type: "reorderTrain", id, from, to}` moves one waiting recruitment entry to another waiting position. Both indices must be integers between 1 and the current queue's last index, and they must differ. Index 0 is the active recruit. Reordering preserves active progress, paid costs and population reservations. The producer must be owned, alive, complete and eligible to recruit. Missing, stale, hostile or invalid commands return `false` without changing the state.

## Verification

`tests/saves.test.ts` round-trips the actual codec, then compares complete saved state and runtime after every tick. Its AI test runs 600 continuation ticks with scouting and economic memory; its worker test runs another 500 with a returning worker, partial recruitment and waiting orders. Ability tests verify illusions, cooldown rejection, reactivation and paid research across restoration. Malformed-input tests cover versions, missing memory, invalid variants, duplicate IDs, nonfinite or unbounded values, queue limits, fog and hit references, getters, cycles and oversized input.

`tests/order-queue.test.ts` drives mixed orders through `stepGame`, including resource delivery, repair completion, combat, hidden or dead targets and the queue limit. `tests/production-reorder.test.ts` observes recruit spawn order and timing, resource balances and population reservations, and checks refusal of invalid and stale indices.
