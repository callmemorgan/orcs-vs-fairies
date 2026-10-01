# Architecture for the 100-feature expansion

This is an implementation design for all 100 items in the requested feature list. It defines the behavior that must exist and the evidence needed to claim completion. It is not evidence that these features already work. The numbered requirements below preserve the requested scope; a menu entry, definition, catalog or unit test of a helper does not satisfy a playable feature.

The baseline inspected for this design is commit `76ba5fd6500ea4e9273442eae1f9a5b10c6a77c0`. The source request is `/home/morgana/.codex/attachments/917bc3a6-a1e9-4a3e-b2eb-8682eb3c4ec4/pasted-text-1.txt`. Product decisions in this document settle details the brainstorm left open. Balance constants can change after playtesting without removing the behavior they control.

## Current implementation

The browser and terminal already share `src/core/simulation.ts`. Phaser draws the battlefield; `src/main.ts`, `src/game/GameScene.ts` and `src/ui/Hud.ts` issue commands against the simulation. The browser accumulates time and advances at 20 ticks per second. The terminal also advances in 0.05-second increments. This is a useful starting point for a headless match server, but `stepGame` still accepts arbitrary positive durations, and the simulation has no enforced tick protocol.

`src/core/types.ts` defines `Side = 0 | 1`; controllers, players, starting points and fog are pairs. Simulation loops enumerate `[0,1]`; AI selects an enemy start with `1-side`; `PlayerView` exposes one opponent. Browser commands, minimap colors, selection ownership and the victory overlay assume the local player is side 0. Those assumptions must change for eight-player teams, co-op, allies, neutral actors, campaigns and spectators. A third entry added to an array does not implement team battles.

`src/core/simulation.ts` keeps behavioral state in a `WeakMap<GameState, Runtime>`. Its timers, ability readiness, gathering return state, route timing and AI memory affect the next tick. `PlayerView` separately remembers previously observed resources. `src/core/navigation.ts` also has a `WeakMap`, but its occupancy grids can be rebuilt from authoritative state. Saves must preserve behavior while rebuilding only derived caches. The current CLI hash serializes `GameState`, omits behavioral runtime and is tied to the same simulation version. It is not a resumable checkpoint or a browser replay viewer.

`src/core/content.ts` exposes six fixed factions, seven role-keyed units per faction, six building roles and a fixed upgrade union. Entity stats come from faction plus role. This cannot represent several units with the same role, a neutral monster, a hero with equipment or a new mod faction without adding special cases. `ArtRuntime` resolves these same IDs through `/assets/manifest.json`. It loads participating faction atlases; existing evidence reports roughly 470–490 MiB decoded for two factions. Loading all eight participants' unique atlases at once needs a lower-memory asset strategy.

`src/core/maps.ts` generates two symmetric starts and a one-level terrain array. Terrain affects movement and placement, but there is no elevation, cover geometry, seasonal state, underground level or destructible crossing. The existing static Vite package has no match host, accounts, lobby service, result database or community package service. Real online games, ranked seasons and shared published content need those services in addition to browser screens.

## Target structure

Keep a headless TypeScript core used by browser local play, CLI, server and replay tools. Split the large simulation by behavior rather than by UI screen. Proposed modules are `match`, `commands`, `movement`, `combat`, `effects`, `economy`, `production`, `technology`, `terrain`, `visibility`, `neutral`, `objectives`, `ai`, `campaign`, `serialization` and `content-registry`. They operate on one authoritative match state and publish typed events. They do not import Phaser, browser storage, networking or Node APIs.

Add `src/client/match-driver.ts` with local, remote and replay implementations. The driver owns command submission and exposes observations, receipts and match status. `GameScene` and HUD consume those observations using a `localPlayerId` or spectator perspective. Browser input must no longer call `issueCommand(state, 0, ...)` directly. A command registry binds the same actions to buttons, keyboard, gamepad and CLI. The rule validator remains in the core so all controllers pay the same costs and face the same ownership and visibility checks.

Add a headless `src/server` process for HTTP, WebSocket connections, identities, lobbies, matches, tournaments, ranking, challenges, community packages and report storage. Start with a Node server, SQLite migrations and a package directory for local development. Hide those choices behind repositories so deployment can use a persistent database and object storage. Run the same production server entry point locally and on the host. A mock endpoint or a static JSON file is not the completed hosted service.

Add dedicated browser routes for play, online lobby, campaign/world map, replays, analysis, editors, community content, challenges, cosmetics and reports. Existing skirmish remains a direct way to start a local game. A single modal listing the new modes does not replace their actual workflows.

## Players, teams and content

Replace `Side` with stable `PlayerId` and `TeamId` values. Account `UserId`, match player slot and team ID are different identities; a user's slot can differ between matches. A match supports one to eight active player slots plus neutral actors and any permitted spectators. Ownership belongs to a player; hostility and shared vision belong to diplomacy and teams. Neutral villages, monsters and capturable uncrewed engines have owners outside the active player roster. Team matches win and lose by team, and a player losing its final stronghold need not eliminate its allies. The browser offers the eliminated player continued team observation.

The core uses `isAllied`, `isHostile`, `canControl`, `canRepair`, `sharesVision` and `canTrade` helpers everywhere those relationships matter. Shared allied vision is enabled in team and co-op games. Economy and production remain private to their owner unless a rule explicitly shares them. Teammates can transfer resources through a validated command; allied AI requests do not grant ownership of another army. Campaign diplomacy can change these relationships at a specified tick. Ranked teams lock relationships for the match.

Use an immutable `ContentBundle` for each match. It contains namespaced faction, unit, building, technology, ability, equipment, terrain, scenario and cosmetic definitions, plus an asset manifest and a content hash. Existing six factions become the built-in bundle. `Entity.definitionId` resolves its actual definition; `Entity.role` remains information for counters and AI. Heroes, engineers, caravans, crew and monsters can then have real definitions without pretending to be a barracks' existing special unit.

Technology definitions contain prerequisites, exclusive groups, costs, research locations and typed effects. Effects use deterministic handlers selected by IDs rather than arbitrary user code. Mod packages may compose validated handlers and scenario expressions; they do not execute JavaScript in the client or server. Validate ranges, references, cycles, resource limits, asset paths and package hashes when installing and again when creating a match. Unsupported behavior receives a specific validation error. No missing asset may silently fall back to another faction's unit.

The existing `createGame(faction, seed, opponent, options)` can remain as a compatibility wrapper that constructs a two-slot `MatchConfig`. New creation uses the full config below. CLI version 2 accepts all players, teams, modes, map packages and content hashes; version 1 can continue using the wrapper until documented retirement.

```ts
interface MatchConfig {
  schemaVersion: number;
  simulationVersion: string;
  contentHash: string;
  map: { packageId?: string; seed: number; size: string; biome: string };
  players: Array<{
    id: PlayerId;
    teamId: TeamId;
    factionId: string;
    controller: 'human' | 'ai' | 'external';
    startingSlot: number;
    ai?: { difficulty: string; personality: string; opening: string };
    handicap: { startingResources: Cost; incomeFactor: number; populationCap: number };
  }>;
  rules: {
    mode: 'annihilation' | 'hill' | 'relic' | 'survival' | 'scenario';
    startingAge: number;
    disabledDefinitionIds: string[];
    sharedVision: boolean;
    friendlyFire: boolean;
    draft?: DraftRules;
    scenarioId?: string;
    ranked: boolean;
  };
}
```

The lobby exposes every handicap in this config before readiness. Ranked rules use a published fixed config. AI difficulty changes observation cadence, planning budget and mistakes, never hidden starting resources or income. A declared handicap may alter those numbers in an unranked match because every participant sees it.

## Tick, state and observations

Make `advanceTick(match)` the authoritative 20 Hz entry point. Time is derived from tick count; effects, research, wave schedules and projectiles expire on integer ticks. Accumulators may interpolate visuals but cannot advance game rules by arbitrary elapsed wall time. The server owns this clock in online matches. Offline pause stops it; an online photo mode or disconnected client does not.

A tick accepts validated commands in canonical order, updates scheduled effects and terrain changes, executes production and economy, moves units, chooses attacks, resolves projectile impacts and simultaneous damage, applies deaths and capture/reward claims, evaluates objectives, refreshes observations and publishes events. AI consumes its permitted previous observation and schedules its commands for a later tick. Cross-player claims on one corpse, relic or engine use a documented distance-and-tick tie rule with a rotating final tie breaker. Stable entity order alone should not reward player slot 0 throughout a match.

Terrain changes increment a map revision and invalidate affected navigation, cover and sight caches. A destroyed bridge cannot leave an old route walkable; units already on a destroyed crossing take the defined fall damage and move to the nearest reachable bank or die if none exists. New commands test the current authoritative terrain, rather than a client's outdated placement preview. Temporary flooding restores the underlying tile state when its effect expires. Layer transfers between caves and surface are explicit transitions; separate map levels do not interact by Euclidean distance.

Core events have stable event IDs, tick, category, actor, affected entities, location, level and values. Combat events describe actual damage after shielding and armor. Economy events distinguish collection, deposit, trade, raid transfer, refund and contract delivery. Production events distinguish start, completion, cancel and reorder. These are the source for minimap alerts, practice coaching, statistics, cosmetic progress and reports. Replays store the input history and checkpoints; analysis may store reduced event samples derived from that history.

`PlayerView` must save its observed resource memory and use team relations. Observations include owned details, permitted allied information and visible public enemies. Hidden enemy research, cargo, orders, illusions, tunnels and inventories remain absent. Redact event source/target IDs and locations independently: an attack on an owned unit must not reveal the unseen attacker. Generate network deltas from filtered observations rather than applying a field filter to a full-state delta. Replays can show an omniscient perspective only after the match or with the lobby's spectator policy. Coach recommendations use the player's historical observations; knowing from the replay that an unseen army was nearby is insufficient.

A network renderer receives only its permitted observation. It cannot hold a full authoritative `GameState` and rely on drawing fog over hidden units. Rendering observations include permitted facing, animation and effect state, rather than constructing a false full `GameState`. In modes with undiscovered procedural terrain, omit the map seed and hidden starts during live play because the seed can regenerate those tiles. Lobby rules may explicitly choose a public-known map; that does not make hidden armies or resources public. An online client never chooses its player ID from an untrusted command payload. The authenticated connection maps to one lobby slot and the server supplies the actor for command validation. Online QA diagnostics and report previews use the same permitted view; the current full `window.rts` export is local-only.

## Saved files and versions

Use separate versioned formats for maps, scenarios, mod packages, profiles, campaigns, checkpoints and replay files. Each states its format version, simulation version and content hash. The content hash pins definitions and gameplay assets used by a match. Include the configuration and generator version in seeded map identity. A numeric seed alone does not reproduce a map after the generator changes.

```ts
interface Checkpoint {
  format: 'ovf-checkpoint';
  formatVersion: number;
  simulationVersion: string;
  contentHash: string;
  config: MatchConfig;
  tick: number;
  state: SerializableMatchState;
  behavior: SerializableBehaviorState;
  rng: Record<string, { algorithm: string; state: number[] }>;
  views: Record<PlayerId, SerializableObservationMemory>;
  commandCursor: number;
  checksum: string;
}
interface ReplayFile {
  format: 'ovf-replay';
  formatVersion: number;
  config: MatchConfig;
  initialCheckpoint: Checkpoint;
  commands: AcceptedCommand[];
  checkpoints: Array<{ tick: number; checkpoint: Checkpoint }>;
  finalResult?: MatchResult;
}
```

Serializable behavior includes AI memory and intentions, team coordination, cooldowns, movement route scheduling, cargo return phase, delayed projectiles, reservations, draft state, objectives, neutral loyalty, campaign scenario variables and RNG cursors. Serialize maps and sets into canonical arrays; sort entries by stable keys for hashes. Exclude render animation clocks, audio, camera position and rebuilt navigation grids from simulation hashes. UI settings and camera can be separately restored for convenience. Do not exclude a field because it happens to live in a `WeakMap` today.

Browser saves use IndexedDB transactions, with manual export/import and automatic checkpoint rotation. Keep the last good autosave if a write fails. Loading validates checksums, ownership, referenced definitions and map bounds before replacing the current match. Version migrations must be explicit and tested; an unsupported simulation version offers a clear error and preserves the file. Pin older compatible simulation bundles for replay playback or convert only versions whose migrations preserve meaning. Claiming all historical versions work without such code is incorrect.

Campaign profiles contain chosen faction, completed chapters, branch decisions, world regions, diplomacy, surviving troop records, equipment, currency and unlocks. Persistent soldiers use campaign IDs independent of their temporary match entity IDs. Importing a campaign army obeys that scenario's roster limits. A failed mission does not erase the last committed campaign state, and a replay cannot award the same chapter reward twice.

## Multiplayer and hosted services

Use HTTP for account/session creation, content metadata, replays, standings and reports. Use WebSockets for lobby membership, readiness, draft turns, commands, observations and reconnects. Every message has a protocol version and request ID. Server receipts return acceptance, scheduled tick and a reason for rejection. Command sequence numbers are monotonic per player; duplicate sends after reconnect acknowledge the original result rather than building twice. Run each active match in a worker thread so a costly map cannot block lobby/authentication traffic. The main server owns database transactions. Deploy the browser build, API and WebSocket endpoint on one HTTPS origin behind a TLS reverse proxy.

Provide persistent accounts without requiring an external identity vendor. Store a random account UUID, a scrypt password hash and server-hashed opaque session tokens; cookies are HttpOnly/Secure and WebSocket handshakes check Origin. Guests may play casual games, but ranked/challenge scores require accounts. Scoped, short-lived match tickets identify a lobby member and permitted role. Rate and size limits apply to package uploads, report bundles and command ingress.

```ts
type ClientMessage =
  | { kind: 'command'; protocolVersion: number; matchId: string;
      clientSeq: number; observedTick: number; command: Command }
  | { kind: 'resume'; ticket: string; lastFrameSeq: number;
      lastAckedClientSeq: number }
  | { kind: 'lobbyMutation'; requestId: string; lobbyId: string;
      expectedRevision: number; action: LobbyAction };
type ServerMessage =
  | { kind: 'commandAck'; clientSeq: number; appliedTick: number;
      accepted: boolean; reason?: string }
  | { kind: 'snapshot'; matchId: string; frameSeq: number; tick: number;
      view: PlayerObservation }
  | { kind: 'lobby'; revision: number; lobby: LobbyObservation };
```

Deduplicate commands by `(matchId, playerId, clientSeq)`. Retrying the same sequence and payload returns its stored receipt; changing the payload for an existing sequence fails. Persist accepted input order before a durable acknowledgement. Each seat has a connection generation; resuming increments it atomically and invalidates the old connection. Send the new connection a current filtered snapshot and authoritative command statuses rather than executing buffered clicks from the disconnect interval.

The server simulation is authoritative. It emits snapshots/deltas at a bounded rate, with checksums and a last acknowledged command sequence. Clients interpolate owned and visible unit movement for display. Begin without client simulation prediction; that avoids sending hidden state to players and makes reconnection a permitted snapshot plus outstanding receipts. If prediction is added later, it must use only a player's available information and cannot alter server decisions.

Lobbies have one to eight player slots, teams, AI slots, spectators, a host, rules, map/content hashes and a revision. Editing rules clears affected readiness. Launch validates team sizes, starts, content availability, draft completion and unanimous readiness. A disconnected lobby host passes ownership to a present participant. A started ranked match does not change owner or rules. Custom games can add AI teammates, but public ranked results exclude handicaps, mods and AI unless a separately published league permits them.

Persist active-match checkpoints and accepted command records. On restart, recover a match from the latest checkpoint and input history. A disconnected player has a published 120-second reconnect window. During that window its existing orders run and it can reclaim its slot using a scoped reconnect token. After the window, ranked matches apply a forfeit; custom lobbies choose AI takeover or forfeit before launch. A browser refresh must not create a second match or a new army.

Live spectators receive the lobby's permitted perspective, with selectable player/team view or omniscient view. Ranked spectators use a 30-second delay and cannot receive future frames or live result spoilers through another endpoint. A reconnecting spectator resumes behind the same delay. Spectator access never authorizes commands. Delayed playback should buffer serialized observations or retrieve historical checkpoints and events rather than exposing current hidden state in the browser. Live replay/checkpoint downloads also obey the viewing cutoff; a delayed animation over a current snapshot is not delayed observation.

Ranked seasons are server records with start/end times, frozen rules/content version, rating model, placement state and completed results. Begin with Elo for 1v1 and team Elo using equal rating changes for teammates; show the published model and provisional placements. Database tables include `matches`, `match_participants`, `match_results`, `seasons`, `ratings` and `rating_events`. A result transaction keyed by match ID writes the result and rating updates once, with unique result `matchId` and rating event `(seasonId, matchId, userId)` keys. Duplicate finish, service restart or report retry cannot award rating twice. Pin the admitted season and its completion grace period so a boundary during play is unambiguous. Season rollover archives standings and applies a published partial rating reset. Computer opponents and client-supplied winners cannot submit rated results.

Community packages are immutable, hash-addressed files with publisher, type, description, preview, compatible versions, dependencies and revision history. Published packages stay available to old saves and replays even when a new revision is released. The browser can search, inspect, download, validate, install and launch them. Local import is also supported, but cannot be the only implementation of a community browser. Publish supports an explicit submission action, validates the package and returns its public package ID. Metadata alone cannot launch content.

Daily challenges use a server-assigned UTC date, signed content/config identity and fixed seed. Local UI displays the release/reset time in the user's timezone. All players on that date receive the same rules, version and map. Competitive submissions include a verified replay or a server-hosted result. Offline runs remain playable and can be shown locally as unverified until accepted by the service. Changing a local clock cannot select a future ranked challenge or replace the signed rules.

Bug reports create a downloadable bundle containing replay, latest checkpoint, diagnostics, content/config versions and reproduction notes. Preview the included data and provide export and submit actions. Scrub account credentials, reconnect tokens, arbitrary local paths and chat text by default. The report service verifies replay integrity, stores the bundle and returns a report ID. Submitting a report does not automatically post to GitHub or message another person.

## Campaigns, scenarios and editors

Each of the six campaigns has its own named commander, cast, map objectives and faction mechanic lessons. Use four authored chapters per faction, with an alternative third chapter selected by a second-chapter decision. That produces 24 main chapters and six alternate chapters; every chapter has authored objectives and a readable introduction/outcome. Each playthrough has four chapters. Campaign examples should distribute escort, siege defense, stealth, boss and puzzle objectives across factions, while each finale requires its faction's mechanic. These counts are a concrete content target, not a replacement for complete playable campaign progression.

World conquest is a separate persistent campaign mode using a region graph. Region ownership, supply, garrisons and diplomacy affect the next battlefield. The player chooses an adjacent reachable region, negotiates or attacks, then imports survivors and applies the verified battle result once. Different region terrain and objectives matter; a list of unrelated skirmish buttons does not implement conquest. Tribute exchanges resources, alliances permit passage and aid, and truces prohibit hostile commands until their expiry. NPCs can reject proposals based on recorded relations and war pressure.

Implement a declarative scenario evaluator shared by built-in missions and the scenario editor. Predicates include elapsed ticks, region ownership, units entering an area, required entity alive/dead, resource delivered, discovered location, relic held and player action counts. Actions include spawn wave, dialogue, set alliance, grant bounded reward, unlock objective, set weather/terrain and finish with a defined result. Variables and scheduled actions belong in checkpoints. The validator detects missing references, impossible spawn points and cycles with no wait. Limit execution per tick so user packages cannot hang the simulation.

Escort missions use a real moving entity and route, checkpoints and failure rules. Fortress defense caps reinforcements and defines waves plus survival time. Stealth missions restrict army and resources, use visibility/detection and alarm objectives, and allow failure without stronghold destruction. Bosses have telegraphed phases, targetable mechanics and responses requiring positioning. Puzzles contain a fixed army, limited resources, a success predicate and an explicit reset. All modes use the same combat and command validator as skirmish.

The map editor uses a brush for terrain/elevation/cover, resource placement, levels, starts, crossings and neutral sites. Undo/redo records editor changes, not game commands. Validate starts, reachable resource supply, team capacity and crossing connectivity; show problems at their location. Export a versioned map package and launch a local test match with that exact package. The scenario editor loads a map, creates objective graphs and events, previews execution, pauses to inspect variables and exports a package that the normal scenario runner loads. A form that edits labels without running them does not satisfy either editor.

## Full requirement and verification map

The implementation columns name owning behavior, not merely a destination file. Verification must exercise the command/UI path that a player uses and inspect resulting authoritative state. Deterministic fixtures make interactions reproducible; browser evidence proves the exposed workflow. Feature IDs remain stable if balance tuning changes numbers.

### Combat and tactics

| ID | Required behavior and implementation | Direct acceptance evidence |
| --- | --- | --- |
| 1 | Formation commands assign stable line, wedge, square or loose slots with spacing, facing and a regroup point. Movement follows a formation while allowing obstacle routing and casualties. Formation breaks and regroups under a documented rule. | In the browser select a mixed army, issue each formation and move through an obstacle; inspect actual positions and show regroup after one member dies. A test with arbitrary input entity order produces the same slots. |
| 2 | Resolve side/rear hits against target facing using an attack arc. The modifier applies to the actual incoming direction; held troops retain commanded facing. | Attack the same defender from front, side and rear with equal weapons; record distinct resulting damage, then turn the defender and observe the bonus change. |
| 3 | Add elevation to map tiles and height-aware sight/ranged effects. Hills improve vision and ranged attacks while cliffs constrain movement. | A hill attacker sees/fires where the equal low-ground attacker cannot, and replay reproduces the damage and sight difference. Browser highlights height without revealing hidden terrain. |
| 4 | Persist morale, nearby allied support and recent losses. Low morale causes a retreat order; surrounded broken units can surrender to a valid captor. Rally/support recovers morale. | Isolate and wound a squad, observe its retreat, surround a broken squad and capture it, then repeat with allied support and observe recovery. Save/load during retreat preserves it. |
| 5 | Shield bearers project a facing cone that intercepts damage for nearby troops behind them. Shields consume durability/energy and leave attacks from the rear unprotected. | Fire through the front cone at a protected ally, then fire from behind; record intercepted damage and depletion. Turning the bearer changes coverage. |
| 6 | Cover geometry intersects ranged attacks and provides a declared damage modifier or interception. Terrain art and UI show the relevant cover. | Place defenders behind a ruin and in open ground, fire equal shots, remove/destroy the cover and observe the changed damage. Cover never reduces melee without an explicit rule. |
| 7 | Siege projectiles resolve an area impact that can damage allied troops when friendly fire is enabled. UI previews the risk; ranked rules publish the setting. | Target an enemy beside a friendly squad and observe damage to both, then disable the lobby rule and observe only valid hostile damage. |
| 8 | Cavalry builds charge momentum through continuous movement; sharp turns, stops and combat reduce it. A braced frontal pike intercept cancels the impact and hurts the charger. | Compare stationary and moving cavalry attacks, then charge braced pikes from front and rear. Inspect actual momentum, interruption and damage. |
| 9 | Separate engine and crew health/ownership. Killing crew leaves an uncrewed engine; capture requires nearby eligible troops and a completed channel, then control changes. | Kill a siege crew while leaving the engine alive, capture it through an ordinary order, move/fire it as its new owner and save/load before capture completes. |
| 10 | Ambush orders require concealment and specify reveal conditions: enemy distance, selected target type or manual release. Concealed units withhold attacks until triggered. Detection can expose them. | Set an ambush in a grove, observe that an enemy outside the trigger cannot see it, trigger the attack and reveal, then detect the same setup with a scout. |

### Economy and settlements

| ID | Required behavior and implementation | Direct acceptance evidence |
| --- | --- | --- |
| 11 | Workers plant paid saplings on valid tiles. Growth creates harvestable wood, persists through saves and respects fire, obstruction and resource limits. | Plant through Build, advance through growth, harvest the resulting node and record deposited wood; burn a sapling and observe that it never becomes a full tree. |
| 12 | A deep mine is built on a depleted eligible ore site and unlocks a finite second deposit. Construction cost, worker access and remaining yield are visible. | Deplete a mine, build the upgrade and resume ore delivery; verify that a different arbitrary tile or already exhausted deep deposit rejects the command. |
| 13 | An extractor has normal/overcharge modes, increased crystal delivery and seeded damage incidents. Mode, risk and repair are visible and serialized. | Use both modes for equal time, record crystal and damage, repair through workers, then replay the same seed and reproduce the incidents. |
| 14 | Real caravans carry cargo between owned/allied settlements. Income requires arrival on a valid route; distance and capacity determine value. | Create two settlements, order a trade route, follow the caravan through arrival and inspect resources. Block or kill it and observe the lost delivery. |
| 15 | Neutral markets maintain supply/demand prices with bounded recovery over time. Transactions deduct and credit real resources atomically. | Execute several buys of one resource and observe increasing price, wait for recovery, then test insufficient funds and verify no partial transfer. |
| 16 | Raids loot cargo or a vulnerable warehouse stockpile, transfer it to a raider and require delivery before spending. Economy totals distinguish theft from gathering. | Raid a loaded caravan and a stocked warehouse, return the loot and inspect both owners' changed balances; kill the carrier before delivery and recover its dropped cargo. |
| 17 | Destroyed eligible buildings/engines create finite salvage objects. Workers collect and deposit them once; decay and competing claims are deterministic. | Destroy an engine, collect the salvage with a worker and inspect deposit plus object removal; two workers cannot receive the same full salvage amount. |
| 18 | Regional warehouses hold local stocks and provide resource delivery requests between settlements. UI displays location, stored amounts, capacity and pending delivery. | Redirect gathering to a regional warehouse, request a transfer, observe a delivery route and destination stock; destroy the source and preserve only previously delivered stock. |
| 19 | Each expansion headquarters chooses mining, military or research specialization with visible costs and local effects. Exclusive choice applies to its region rather than every base. | Specialize two expansions differently, record local gather/recruit/research differences and reject a second incompatible specialization. |
| 20 | Villages issue contracts with cargo type, amount, destination, deadline and reward. Deliveries contribute once; expired or incomplete contracts do not award full rewards. | Accept a contract, deliver with a caravan and inspect completion/reward, then miss a deadline and observe the documented failure result. |

### Faction identity

| ID | Required behavior and implementation | Direct acceptance evidence |
| --- | --- | --- |
| 21 | Orc chants consume earned Fury and choose offensive or defensive buffs affecting nearby allies for a fixed duration. Fury cannot be spent twice. | Earn Fury in combat, cast each chant through its button, inspect changed damage/defense and duration, and reject a cast without sufficient Fury. |
| 22 | Victorious Orc troops can spend a trophy claim on a placed standard. Nearby allied troops receive its aura; the standard is destructible and does not stack unlimited copies. | Win an engagement, place a standard, move troops into/out of range and record the changed stats; destroy the banner and observe the effect disappear. |
| 23 | A Fairy unit swaps with one of its own existing illusions through a targeted ability. Validate identity, visibility, expiry and both reachable destinations. | Create doubles, select one for a swap, inspect exchanged positions and retained health/orders; reject an expired, hostile or blocked clone. |
| 24 | Fairy workers enchant an existing/planted grove. It conceals allied units and creates observer-specific decoy information for hostile scouts. | Enchant a grove, observe allies hidden from a hostile player until detection, and show a decoy through that hostile observation while keeping the true unit private. |
| 25 | Dwarves build connected tunnel entrances. Eligible squads enter, spend transit time and emerge at a selected valid exit; destroyed exits require a defined alternate/emergency result. | Build two entrances, move troops through them, inspect transit state and arrival; save/load in transit and destroy an exit before arrival. |
| 26 | Dwarf workshops apply mutually exclusive ammunition or attachments to actual artillery entities, with costs and replacement rules. | Fit armor-piercing and explosive modifications, attack an armored target and a group, and record different impact behavior; modification survives save/load. |
| 27 | Undead wagons collect corpses as cargo and deliver them near Gravecallers or an ossuary. Collected corpses cannot also be raised on the ground. | Collect corpses, drive to a Gravecaller and raise from delivered stock; race two collectors and observe a single successful claim. |
| 28 | Undead territory converts around captured/constructed necropolises. Raised troops within it receive sustained lifespan or upkeep support; hostile cleansing reverses the region. | Move the same summoned troop inside/outside corrupted ground and record expiry change, then destroy/cleanse its source and observe decay resume. |
| 29 | Tideborn cast temporary terrain effects for shallows, mud or flooding. Effects alter movement and pathfinding, obey area limits and expire to underlying terrain. | Shape a choke, reroute a non-amphibious army, cross with Tideborn and inspect terrain restoration after expiry and after save/load. |
| 30 | Automata structures form a power graph by range/connectors. Capacity supplies connected shields and special defenses; disconnection or overload disables unsupported nodes. | Connect a defense, attack and observe shared shield transfer, destroy a connector and see power loss, then rebuild and restore supply. |

### Units and progression

| ID | Required behavior and implementation | Direct acceptance evidence |
| --- | --- | --- |
| 31 | Technology branches have exclusive groups and prerequisites enforced at research start and completion. The tree shows choices and locked alternatives. | Choose one branch, observe its combat/economy effect and reject the alternative through UI, CLI and replayed commands. |
| 32 | Give each faction's cavalry an ability: Orc impact Fury, Fairy forest leap, Dwarf armored brace, Undead terror, Tideborn wet-ground surge and Automata shield dash. These use different conditions or effects. | Run all six through their intended situation and show their unique result. Shared stats plus new names do not pass; anti-cavalry charge counters still work. |
| 33 | Give siege separate mechanics: Orc incendiary catapult, Fairy rooting trebuchet, Dwarf deployed ammunition cannon, Undead corpse bombard, Tideborn splash/flood mangonel and Automata powered beam engine. | Fire all six at relevant targets and record different projectile/effect behavior, deployment or resource requirements; verify ally area damage where applicable. |
| 34 | Add ranged, cavalry and siege research with visible costs, building/prerequisite requirements and role-specific effects. | Complete one relevant upgrade per role, inspect actual attack/movement/armor difference, and verify other roles do not gain that effect. |
| 35 | Troops gain capped experience from useful combat and survival milestones. Ranks alter defined stats and show visible insignia; illusions/summons cannot farm rank. | A surviving troop earns a rank after a real engagement, displays it and retains it in save/replay; killing disposable own summons grants no experience. |
| 36 | Rank milestones offer exclusive promotions with role-appropriate effects. Choosing one consumes the pending choice and preserves the soldier's identity. | Promote a veteran through UI, exercise its ability/stat change and reject a second choice at the same milestone. Campaign import keeps the promotion. |
| 37 | Each faction has a named recruitable commander, a roster limit and targeted abilities. Heroes can die and follow published recovery rules; AI can recruit and command them. | Recruit and use all six commanders' abilities in a match, attempt excess recruitment, kill a hero and inspect the correct death/recovery state. |
| 38 | Equipment exists as recoverable items with compatible slots, ownership and concrete stat/ability effects. Drops, equip, unequip and replacement use validated commands. | Recover an artifact, equip a compatible hero/specialist and record its effect, reject an incompatible unit and retain the item across campaign missions. |
| 39 | Beacons form a network between outposts, extend/shared team vision under rules and issue invasion alerts from observed intruders. Destroyed links stop that information. | Connect outposts, watch an enemy enter beacon sight and receive the alert, then disconnect the remote beacon and observe sight loss without leaking hidden attackers. |
| 40 | Engineers are units with bridge/barricade/field-repair commands. Temporary structures have costs, lifetimes and collision; repair consumes resources or charges. | Build a crossing and pass troops, place a barricade that changes navigation and repair a damaged engine; expiry invalidates the route. |

### Maps and the world

| ID | Required behavior and implementation | Direct acceptance evidence |
| --- | --- | --- |
| 41 | The generator supports desert, marsh, snow valley and forest biomes with terrain/resource distributions and symmetric fair-start constraints for the chosen roster. | Generate multiple seeds for each biome and 2/4/6/8 starts, validate reachability/resources, and play on each distinct visible terrain distribution. |
| 42 | A tick-driven day/night cycle changes sight and documented unit traits, with current phase shown in HUD. Local wall time cannot affect combat. | Keep opposing scouts stationary through dusk/dawn and record changing permitted sight; save at dusk, reload and reproduce transition timing. |
| 43 | Seeded weather changes sight/movement/projectile flight by declared rain, fog and wind rules. UI describes the current effects. | Observe fog visibility loss, rain movement/fire effects and wind projectile displacement in actual combat; replay the same weather schedule. |
| 44 | Bridges have targetable durability and define connected banks. Destruction changes passability immediately and rebuilding restores it. | Cross a bridge, destroy it, observe blocked routes and the defined result for troops on it, then rebuild and cross again. |
| 45 | Fire occupies tiles, spreads to combustible neighbors using seeded conditions, damages entities and consumes wood nodes. Rain/firebreaks suppress spread. | Ignite a forest beside an army, inspect spread, damage, wood loss and new routes, then contain a repeat with a firebreak or rain. |
| 46 | Seasonal maps have a cycle that freezes/thaws defined water tiles and changes crossings. Units on thawing ice receive a visible warning and defined consequence. | Use a frozen lake shortcut, advance to thaw, observe warning and route invalidation; a checkpoint before thaw resumes the same map changes. |
| 47 | Monster dens own autonomous neutral creatures with patrol/aggression, finite encounter rewards and respawn rules. | Approach a den, fight its creatures, collect its one-time reward and verify that unrelated neutral units do not attack from hidden knowledge. |
| 48 | Villages track allegiance/loyalty, support actions and local defenders. Earned loyalty unlocks actual supplies/recruits; raids reduce it. | Fulfill a village request, recruit a defender or receive supplies, then raid it and observe lost loyalty and services. |
| 49 | Relic sites use a contestable capture channel and ownership aura/bonus. Enemies can interrupt and recapture, and bonuses stop on loss. | Capture a site and inspect the applied bonus, contest it with an enemy and show interrupted progress, then recapture for the other team. |
| 50 | Maps support connected surface and cavern levels with entrances and independent fog/path grids. Combat crosses levels only through defined transitions. | Send an army underground through an entrance, fight on the cavern level and return through another exit; units above cannot attack those below by coordinate coincidence. |

### AI and practice

| ID | Required behavior and implementation | Direct acceptance evidence |
| --- | --- | --- |
| 51 | Difficulty changes reaction delay, planning effort, scouting and intentional mistakes. The same starting resources, production, income and commands apply at all unhandicapped difficulties. | Audit config and resource events in equal-seed matches, record equal economic rules, and observe distinct reaction/planning performance. |
| 52 | Rush, fortify, expand and raid personalities change priorities and spending. Personality state is serialized and shown in setup. | Run each personality with the same faction/seed, inspect actual early production/locations/targets and confirm that fortify does not use the rush plan. |
| 53 | AI uses defined opening plans with transitions when prerequisites fail or scouting changes risk. The setup/coach can name the selected opening. | Record each opening's command sequence, disrupt a planned building and observe an alternate plan rather than repeated invalid commands. |
| 54 | Counter composition depends on units observed by that AI, using dated sightings and confidence. Hidden enemy production never directly changes its plan. | Hide cavalry and compare AI decisions with a control run, then reveal cavalry and record spear production; expire the sighting and observe confidence decay. |
| 55 | Allied AI uses a team coordinator to distribute defense, scouting, expansion and timed attacks from shared permitted knowledge. Commands stay owned by each ally. | Play co-op with two AI allies, inspect distinct scout/defense assignments and a synchronized attack; removing an ally reassigns its responsibility. |
| 56 | AI estimates local threat from observations, retreats wounded/outnumbered troops to safe support and regroups before resuming. | Present an observed overwhelming threat, inspect retreat orders and surviving troops, then reinforce the AI and observe a renewed attack. |
| 57 | A teammate directive command requests defend/scout/support/attack with a location or target. AI acknowledges, validates and reports completion/failure. | Issue all directive types through the team panel, observe corresponding allied actions and bounded expiry, and reject directives to hostile AI. |
| 58 | Setup exposes starting-resource offsets, income factors and population caps per slot; all values appear before ready and in replay config. | Set a handicap, launch and inspect starting balances/income/cap; online guests see the edited value and readiness resets. Ranked rejects it. |
| 59 | The practice coach derives missed opportunities from the player's known event history, with timestamps and actionable explanations. Coaching can pause/seek the replay. | Finish a match with idle workers and capped production, inspect timestamped advice and jump to it; hidden enemy troop positions never appear before discovery. |
| 60 | The tournament dashboard launches real CLI agents in bounded processes, schedules seeded pairings, records logs/results/replays and displays live standings. | Start a tournament with at least two agents, observe process execution and completed games, open a recorded replay, then terminate a hung agent and record its timeout. |

### Multiplayer and game modes

| ID | Required behavior and implementation | Direct acceptance evidence |
| --- | --- | --- |
| 61 | Two remote human clients join an authoritative 1v1, ready, launch, command armies and receive the same verified result. Reconnect restores a slot. | Use separate browser sessions through the production server, play to victory, refresh one client, compare final match IDs/results and replay the server history. A local AI match does not pass. |
| 62 | Team lobbies support 2v2, 3v3 and 4v4 with distinct starts, shared allied vision, hostile-only targeting and team victory. | Launch and complete each team size with active human/AI slots, verify allied commands cannot hurt/control teammates except published siege rules, and test one teammate losing its stronghold. |
| 63 | Multiple humans on one team play against coordinated AI teams through the server, with the same human ownership and AI rule checks. | Two browser clients launch co-op against at least two AI opponents, cooperate on an objective and complete the match; each keeps its own resource and command state. |
| 64 | Spectators can join live matches, select allowed views and pause/catch up within the delay buffer. They cannot command units or obtain future frames. | Join a third session, inspect live/delayed views against recorded ticks, seek within available history, attempt a command and observe server rejection. |
| 65 | Authenticated players enter a fixed ranked queue, get a server match and receive season standings/rating changes once. Placements and reset/archive rules are visible. | Complete two authenticated ranked games, verify server results and rating ledger, resend finish events and observe no duplicate change, then roll a test season and inspect archive/reset. |
| 66 | Custom lobby host edits victory, age, resources, handicaps, disabled units, map and slots. Guests see revisions, install required content and ready on the current revision. | Two clients edit/review rules, launch the resulting game and exercise the changed rules; test host departure, stale readiness and incompatible packages. |
| 67 | Hill victory awards team progress only while an uncontested eligible force holds the hill, pauses when contested and ends at the declared score/time. | Hold, contest, recapture and win the hill; inspect progress changes and HUD timer with two teams. Strongholds surviving does not prevent objective victory. |
| 68 | Relic victory requires the configured number delivered/held by a team for a defense duration. Relics can drop, be stolen and interrupt the countdown. | Collect and defend enough relics, lose one before expiry and observe interruption, recover it and win while enemy strongholds remain. |
| 69 | Survival schedules increasing waves with declared spawn regions, compositions and reward/recovery intervals. Win/loss uses survival rules and saves include wave state. | Play several distinct escalating waves, save between waves, resume the same schedule and reach the configured finale or lose through the documented objective. |
| 70 | Draft occurs before launch, alternates bans/picks by declared order, enforces availability and turn timer, and locks the resulting roster/technology options. | Two clients complete a timed draft, test an invalid/duplicate pick, launch and verify banned definitions cannot be recruited or researched. Reconnect resumes the same draft turn. |

### Campaign and scenarios

| ID | Required behavior and implementation | Direct acceptance evidence |
| --- | --- | --- |
| 71 | Six authored campaigns each have a named commander, faction-specific story/problems and four playable chapters plus a third-chapter alternative. Mission completion advances the campaign. | Play each faction campaign to its finale, inspect different maps/objectives/dialogue/mechanic requirements, and complete its alternative third chapter. Skirmishes with different faction labels do not pass. |
| 72 | Conquest uses a persistent connected regional map with ownership, garrisons, reachable invasion choices and imported battle results. | Win adjacent regions, reload the profile, inspect retained ownership/army and launch a battle whose terrain/resources reflect its region; reject an unreachable invasion. |
| 73 | Authored branch decisions select later missions, allies or objectives. Decisions persist and have visible consequences. | Choose each branch in separate campaign profiles, compare the resulting mission/alliance/objective and reload to preserve the chosen path. |
| 74 | Surviving eligible soldiers preserve campaign IDs, experience, promotions and equipment. Casualties leave the roster; reinforcements follow chapter limits. | Finish a mission with ranked troops and casualties, launch the next, verify correct survivors/stats and absence of dead troops, then save/load the campaign. |
| 75 | Campaign factions negotiate alliances, tribute and time-limited truces using their relations/resources. Accepted agreements change actual passage, hostility and support. | Pay tribute, negotiate a truce and move through former hostile territory without attacks; advance expiry and observe hostility return, then form an alliance and receive its aid. |
| 76 | Escort scenarios have moving protected units, a route/checkpoints, ambushes and explicit arrival/death outcomes. | Complete an escort through its checkpoints with the actual convoy, then lose the protected unit and receive failure without requiring headquarters destruction. |
| 77 | Fortress scenarios enforce limited reinforcement budgets, authored waves and a surviving-defender objective. | Spend the allowed reinforcements, reject excess recruitment, survive to the final wave and win, then lose the required fortress and fail. |
| 78 | Stealth missions constrain army/resources, track detection/alarms and require infiltration/extraction using scouts or illusions. | Complete without alarm, repeat with a revealed infiltrator and observe enemy response/failure, and use a legitimate illusion diversion to pass a guarded route. |
| 79 | Bosses have targetable phases and visible telegraphs that require repositioning or coordinated abilities, with rewards/outcome tied to defeat. | Play each authored boss phase, dodge a telegraphed attack, interrupt or counter a mechanic, and defeat it; a high-HP ordinary unit does not pass. |
| 80 | Puzzles start with a fixed army and resource budget, expose a precise objective and support reset to the same initial state. | Solve and fail representative positioning/counter puzzles, inspect objective success/failure and reset to identical troops/resources/seed. |

### Controls and accessibility

| ID | Required behavior and implementation | Direct acceptance evidence |
| --- | --- | --- |
| 81 | An alert service turns own known raids, threats and idle production into bounded minimap indicators and optional audio/text. Alerts link to a location and expire. | Trigger all three in a normal match, click each alert to center correctly and verify that an unseen attacker location is not exposed. |
| 82 | Orders have per-unit queues with replace/append semantics and completion/failure handling for move, attack, gather, repair and construction. Shift or remapped append queues commands. | Through normal input queue several waypoints and a gather/repair target, observe execution in order, cancel one order and save/load halfway through. |
| 83 | Production entries have IDs and paid cost records. Dragging reorders waiting entries without corrupting active progress; optionally moving the active entry follows an explicit reset rule. | Recruit different types, drag waiting portraits, inspect final spawn order and unchanged active progress; stale queue revisions reject safely. |
| 84 | Global production lists every owned producer and queues, with recruit/cancel/reorder/research/rally commands and location selection. | Build multiple producers, issue commands from the global panel without selecting them individually, observe correct queues/spawns and update after destruction. |
| 85 | Worker allocation accepts target counts per resource and assigns available workers using visible resource nodes and delivery distance. Builders and manual locks are respected. | Set wood/ore/crystal targets, inspect resulting workers and deposits, deplete a node and reassign, then manually lock a worker without the panel stealing it. |
| 86 | Blueprints plan several valid future structures without premature spawning/payment. Commit assigns workers and reserves/pays under a published rule; undo/cancel releases reservations. | Plan a base through UI, adjust/cancel part, commit the remainder and observe real construction/costs; a newly blocked location receives a visible failure. |
| 87 | Palette profiles, owner patterns and outlines distinguish all eight slots, teams and selected enemies. Settings apply to units, minimap, UI and previews and persist. | Use each palette in a mirror/team battle, inspect owner/team cues beyond color, change it mid-match and reload the saved preference. |
| 88 | Action-based binding profiles configure camera, selection, groups and every command; conflict handling, reset/import/export and persistence are available. | Rebind representative actions, execute them in play and inspect tooltips for new keys; conflicts are shown and old bindings stop firing unless explicitly retained. |
| 89 | Gamepad maps camera/zoom, cursor or focus selection, additive selection, contextual orders, ability targeting, build/recruit menus and cancel. Disconnect returns usable input. | Complete construction, gathering, recruitment, combat and menu navigation using a controller only; verify dead zones, prompts and disconnection/reconnection. |
| 90 | Manual saves, rotating autosaves and import/export resume local/scenario/campaign matches including runtime, queues and RNG. Online reconnect uses server state rather than client saves. | Save during ability cooldown, production, gathering return, projectile flight and tunnel transit; reload and compare future authoritative hashes/events against uninterrupted play. Recover the last good autosave after a failed write. |

### Replays, creation and community

| ID | Required behavior and implementation | Direct acceptance evidence |
| --- | --- | --- |
| 91 | Replay viewer imports or retrieves a real match, pauses, seeks using checkpoints, changes speed and shows player/team/omniscient perspectives under policy. | Record a match through normal commands, open it in the viewer, seek backward/forward and compare state hashes at known ticks; player perspective reproduces historical fog. |
| 92 | Analysis derives economy, army strength, losses and technology timings from a completed match, with charts and clickable timestamps. Units/buildings/cargo have distinct loss values. | Finish a match with known trades, research and casualties, inspect chart values against event totals and jump to selected events in the replay. |
| 93 | Photo mode hides HUD, permits camera composition and exports a screenshot. Offline can pause; online viewing never stops the server and still obeys fog. | Enter from a local and online match, compose/export actual art, verify HUD absence and restore previous camera/input mode on exit. |
| 94 | Map editor paints terrain/elevation/levels, places resources/starts/sites and validates/exports an actual playable package with undo/redo. | Create a two-level map, fix reported reachability errors, export/import it and launch the exact edited map in normal play. |
| 95 | Scenario editor builds validated objective/event graphs on a map, tests execution and exports/imports playable scenarios. | Create an escort plus timed wave and custom victory, test failure/success in the editor, export/import and complete it through the normal scenario menu. |
| 96 | Mod loader installs validated packages defining factions, units, art, technology and balance. Matches pin dependencies/hash and show custom content through normal controls. | Install a custom faction with two same-role units and custom art, recruit/use it, alter a balance rule, record/replay and reject missing/cyclic/incompatible packages clearly. |
| 97 | Community browser searches remote package metadata, shows previews/version/dependencies, downloads/verifies/installs packages and launches them. Publishers can submit a package revision. | Publish an editor-created package to the real service, find it from another profile/browser, install/play it, update to a new revision and open the old replay with its pinned version. |
| 98 | Daily service issues fixed signed configurations by server date and accepts verified challenge results for a shared leaderboard. Offline attempts are identified. | Two profiles receive the same day's map/rules, complete runs, submit verified results and inspect standings; tampered config/replay and clock changes cannot yield accepted scores. |
| 99 | Profile progression awards banners, building decorations and portraits for declared achievements. Players inspect/equip them and see them in play; cosmetic choice has no combat effect. | Earn a cosmetic through a completed match/campaign, equip it, reload and see it on the correct faction/building; compare simulation hashes with different cosmetics. |
| 100 | In-game report flow previews and exports/submits a replay/checkpoint/diagnostic bundle, returns a report ID and supports reproduction in a compatible build. | Report an observed issue, download/open the stored bundle, replay the failing tick and inspect diagnostic/version data; credentials and unrelated private data are absent. |

## Implementation order

First replace two-slot assumptions, separate content definitions from role identity, formalize ticks and command receipts, and make behavioral runtime serializable. Preserve current two-player skirmish and CLI through the wrapper while adding two-, four-, six- and eight-slot fixtures. Add shared relations and observations before writing combat helpers; otherwise later systems will repeat incorrect `side !== owner` checks. Use one authoritative match result type before implementing objective modes.

Next complete command queues, production IDs, effect handling, terrain revisions and economy transfers. Implement formations, flanking, elevation, morale, shields, cover, projectiles, crew capture and ambush on these systems. Add cargo/local warehouses and finite claims before caravans, contracts, salvage and corpse wagons. Add structure connectivity before tunnels, beacons and Automata power. Each system must be reachable through input and displayed through observations as it is integrated.

Faction mechanics, unit definitions, technologies, heroes and equipment follow the shared effects and registry. Build meaningful scenario fixtures using them so authored missions and AI tests use the same mechanics. Implement biomes and environmental transitions with navigation/visibility invalidation together; adding art before passability rules leaves a misleading map.

In parallel after the player/tick/serialization interfaces stabilize, build the server, lobby protocol, remote driver, replay storage and identity. Complete actual two-client 1v1 before adding team sizes, co-op and spectators. Add draft/readiness revisions, objective rule customization, restart recovery and authoritative result transactions before rankings and challenge competition. Deployment and remote-session evidence belong to this branch of work; static hosting alone cannot complete it.

AI personalities, openings, counter intelligence and team coordination build on permitted observations and order queues. The tournament runner invokes the real CLI and uses pinned content/config versions. Coach and analysis consume the stable event model and historical player views. Do not add economy cheats to make AI fixtures finish.

Campaign progression, world regions, diplomacy and authored scenarios share the scenario evaluator and saved profile formats. Map/scenario editors use that evaluator rather than their own execution code. Community packages build on exports and validated mod manifests. Cosmetics use verified results; bug reports use the completed replay/checkpoint stack. Input/accessibility changes should be integrated continuously so every action can appear in binding profiles and gamepad menus.

Work can proceed in parallel across independent modules, but one owner must integrate shared type/command changes. Agents should commit in isolated branches, publish interface changes before others depend on them and avoid editing the same central simulation file concurrently. A task claiming completion must include its actual behavior evidence and any remaining integration gap, not just the number of implemented definitions.

## Verification and completion

Keep `docs/evidence/hundred-features/requirements.json` as a requirement ledger with one entry for every ID, linked source, authoritative command/test/session evidence and current status: incomplete, contradicted, unverified or verified. The ledger is an index, not proof. Review its referenced artifacts and check that each covers its stated behavior. A passing test named after a feature does not help if it merely checks a definition exists.

Run existing rule tests, browser production build and CLI build after foundational changes. Add deterministic interaction checks where the result is substantive: team ownership/vision, terrain invalidation, claims, inventory conservation, save/resume equivalence, replay seeking and result idempotency. Preserve equal-seed uninterrupted/resumed hash sequences and report the first divergent tick. Verify content packages against the same loader used by normal play.

Run a full six-faction ladder after AI or balance changes, including mirror matches and side/slot permutations. For team changes, play 2v2, 3v3 and 4v4 on supported maps; eight labels in a lobby are insufficient. Check coordinates, path stalls, zero-sum transfers, finite values, population reservations, effects cleanup and objective termination. Profile an eight-player mixed-faction match with final assets, rather than inferring performance from the existing two-faction benchmark.

Browser checks must use actual displayed controls for formations, economy, abilities, production, editor exports, campaign choices, accessibility and replay playback. Read-only state inspection can substantiate the observed result, but injecting commands into `window.rts` cannot prove the control works. Network verification uses separate sessions/connections and exercises readiness, command submission, filtered observations, disconnect/reconnect, spectator delay, service restart and completion. Include an independently reachable deployed-service run before claiming public online functionality.

Final completion requires all 100 entries to be verified against the requested behavior, with no known missing integration path. The six campaigns, each draft/team mode, editor/import/export workflow, real hosted services and mod artifacts are deliverables, not optional examples. A narrow test pass, compile success or status document cannot establish this full outcome.

## Risks to resolve through implementation

Decoded atlas memory is already high for two factions. Eight-player support must measure unique-faction loading, share atlas pages, use suitable compression or lower-resolution tiers and release unused textures. Procedural/neutral assets and mod limits need their own budget. A stable match on the actual target browser is the required evidence; a headless match cannot prove renderer memory or usability.

New damage/economy modifiers can stack into runaway advantages. Declare ordering and stacking policies for equipment, research, rank, chants, elevation, power and cover, then test combined cases. Resource transfers require conservation and finite bounds. Team vision, decoys and underground maps need server-filtered observations because the client can otherwise inspect hidden state. Server restart recovery must include all behavioral state, not only positions and health.

Ranked operation depends on an accessible host, durable storage, identity sessions and a server-owned result ledger. Community operation depends on immutable package availability and publisher identity. Local development can proceed without hosted credentials, but local-only implementations remain incomplete for the hosted requirements. Preserve working local modes and report that exact gap while continuing the deployable service work.

Campaign and community content require more than engines. Authored dialogue/objectives, actual missions, a playable custom faction with artwork, downloadable editor packages and achievement cosmetics must exist and use the shared systems. Track these as artifacts in the requirement ledger so implementation infrastructure does not hide missing game content.
