# Improvement host API

The ten lanes own `src/improvements/<lane>/client.ts` and `rules.ts`. The browser loads every lane's `client.ts` through an eager Vite glob, in path order. Each client entry exports a default `ClientImprovement` or array of improvements from `src/improvements/host.ts`. The initial lane arrays are empty. Add imports to your lane entry for each completed feature; keep one feature's implementation in its own file so draft PRs remain separate.

The simulation imports `src/improvements/rules.ts`, which statically imports all ten lane rule entries. Those entries load in both browser and terminal builds. Import a core rule from its lane's `rules.ts`; importing it only from `client.ts` would exclude it from headless games. Core rule files must use browser-free imports. Types-only imports and `registerGameImprovement` from `src/core/improvements.ts` avoid initialization cycles. Functions from `simulation.ts` can be called inside hooks, after initialization; do not call simulation functions at module load time.

## Client controls

A `ClientImprovement` has an `id` and `mount(context)`. IDs must be unique across all lanes. Use the feature ID, for example `feature-001`, for both the client and core rule. Mount returns a `ClientInstance`. Its optional methods are:

| Method | When it runs |
| --- | --- |
| `update()` | On selection changes and the 100 ms HUD refresh; also before `matchStart` |
| `matchStart()` | After the new scene has finished `create` and its camera is ready |
| `matchEnd(reason)` | Once the result is detected (`result`) or the active match returns to the menu (`menu`) |
| `menu()` | At initial menu display and when returning to the menu |
| `readOptions()` | Before starting a match; JSON value enables the matching core rule, `undefined` leaves it disabled |
| `dispose()` | When the host is disposed; remove any listeners or timers you created |

`context.menu` and `context.hud` are feature-owned DOM containers inside the menu and HUD. `context.root` is the shell root. Add your own controls, scoped classes and accessible labels; do not replace the shared shell's markup. Containers are empty unless a feature adds content. The HUD parent has `pointer-events: none`; give interactive controls `pointer-events: auto` and position them with feature-scoped CSS. Listen to controls in `mount`, then update their contents in `update`.

`context.state` is the latest detached player observation, or `null` in the menu. It includes visible entities, observed resource memory, explored terrain, owned player data, the result, player-visible events, and any core rule data exposed through `observe`. It follows `PlayerView`'s field names (`state.player`, `state.map`, `state.result`), rather than the raw simulation shape. Hidden enemies, enemy private orders and unobserved resource changes are absent. Do not read `window.rts` or import raw state from the scene to display information the player cannot see. Mutating the observation does not change the simulation. `state.events` contains only the latest tick batch when the host refreshes; it is not a complete event stream. Features that require every event should collect relevant events in a core `step` hook and expose a side-safe history through `observe`.

`context.selected` and `context.paused` read the current scene each time. `command(command)` sends a side-0 command through ordinary `issueCommand`, returning `false` while paused or without a match. `select(ids)` uses the scene's visible-entity selection checks. `center(x,y)` centers the camera for finite coordinates. `setPaused(value)` synchronizes the scene and shell pause state, except after a match ends. `notice(text)` uses the existing status message. These methods refer to the current scene, so handlers survive a restart without retaining the previous match.

## Core rules

`registerGameImprovement(rule)` accepts an ID and `initialState(options)`, plus optional `start(game, options, state)`, `step(game, dt, state)`, `validate(game, side, command, state)`, `command(game, side, command, state)`, and `observe(game, side, state)` hooks. Registration alone changes no match behavior. The registration function returns a disposer for test isolation.

Pass `GameOptions.improvements: { [id]: jsonOptions }` to opt into a registered rule. The browser collects these entries from each client's `readOptions`; terminal `start` accepts the same `improvements` object. Unknown IDs do not activate a rule. Match state stores each activated rule as `GameState.improvements[id] = { options, state }`. These values must contain JSON data (finite numbers, strings, booleans, null, dense arrays and plain objects). Sparse array holes are invalid because a JSON save would turn them into null. Keep functions, Maps, Sets and browser objects out of them. Initialization clones both options and initial state. Later hooks mutate the stored state in place and must keep it serializable. Ordinary matches omit the `improvements` field entirely.

`start` runs after the normal map, entities, resources, visibility and population are initialized. `step` runs after an accepted simulation tick's ordinary combat and cleanup, using the same capped `dt`; it includes the final accepted tick and its HQ-death events, and skips invalid ticks or calls made after the match has already ended. Rules that change derived values must update those values themselves. Rules do not run through browser timers. Active rule IDs run in sorted order for initialization, stepping and observation, so JSON key order does not change browser or terminal results.

A custom command is `{ type: 'improvement', improvement: id, action: string, ids: number[], payload?: jsonValue }`. Both `validate` and `command` must exist. `issueCommand` checks the match result, activation, payload format, and ownership of every living entity in `ids` before calling the validator. `ids` must be a dense array of safe integers. Anything else, including holes, `undefined`, `NaN`, infinities and fractions, is rejected before the validator runs. Empty `ids` support actions that do not target an entity. The validator must check the action, costs, prerequisites, visibility, target eligibility and payload bounds before `command` mutates anything. Use ordinary commands inside handlers for ordinary movement, training, construction and research. Clients never receive a core mutation callback.

`observe` explicitly chooses which feature state a side may see. Without this hook, that rule's state stays absent from player observations. Return only information the side is entitled to know; the host clones it before delivering it to clients. Terminal observations use the same hook. Feature state participates in terminal state hashes and replay records.

Run `npm test -- tests/improvements.test.ts tests/improvement-host.test.ts tests/improvement-start.test.ts`, `npm run build`, and `npm run build:cli` when changing the host. Feature-specific tests should exercise a player's action and resulting state, including rejection paths, rather than merely checking registration.
