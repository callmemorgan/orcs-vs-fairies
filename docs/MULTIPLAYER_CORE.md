# Team match core

`createMatch(config)` constructs one through eight player slots. `createGame(faction, seed, opponent, options)` remains the two-player wrapper with the existing map layout, opening armies, resources and behavior. The new API lives in `src/core/simulation.ts`; its types live in `src/core/types.ts`.

```ts
createMatch({
  schemaVersion: 1,
  map: { seed: 4127, size: 'large' },
  players: [
    { id: 0, teamId: 3, factionId: 'orcs', controller: 'external' },
    { id: 1, teamId: 3, factionId: 'dwarves', controller: 'ai' },
    { id: 2, teamId: 7, factionId: 'fairies', controller: 'external' },
    { id: 3, teamId: 7, factionId: 'tideborn', controller: 'ai' }
  ],
  rules: { sharedVision: true, startingAge: 1 }
});
```

Player IDs must be ordered contiguous indices from zero. Team IDs range from zero through seven and can differ from player IDs. Factions and controllers are explicit per player. Optional `startingSlot` values permute the generated starting positions; they must be unique indices within the roster. Unknown fields, invalid values and explicit `null` values are rejected. The constructor copies configuration values into new state and does not retain mutable configuration objects.

Each player may supply `handicap: { startingResources: { wood, ore, crystal }, incomeFactor, populationCap }`. Defaults are 420 wood, 220 ore, no crystal, an income factor of one and a population limit of 100. Resource values range from zero through 10⁹, income factors from zero through ten, and population limits from one through 500. Income factors multiply successful resource deposits; gathering consumes the same physical stock. Population limits bound the capacity provided by completed headquarters and depots. The six-unit opening army remains the same even when the chosen limit is below six; recruitment waits until population falls below capacity. AI housing uses the configured limit and does not buy depots after reaching it.

Starting age is a match rule from one through three. Age two starts with Town Age researched; age three also includes Citadel Age. Shared allied vision defaults to enabled. Disabling it preserves separate current visibility and explored history. A one-player or single-team match remains open while a headquarters survives, allowing practice and cooperative scenario setup without an immediate victory.

## Relationships and outcomes

`isAllied(state, a, b)` compares valid players' team identities, and `isHostile` identifies players on different teams. Combat selection, explicit and waiting attacks, towers, AI scouting and threats use those helpers. Commands still control only the actor's owned entities. Allies do not share banks, research, recruitment or resource drop-offs. Allied workers can repair or finish construction, paying repair costs from their own bank. Healing and shields can support allies. Construction moves overlapping allied units out of the footprint and clears any emplacement they held.

`players`, `controllers`, `starts`, `visible`, `explored`, `teams`, `incomeFactors`, `populationLimits` and `eliminated` are arrays with one entry per player. Vision includes allied units and buildings when shared vision is enabled; explored history is also shared. Observations expose public ally and opponent rosters, while orders, recruitment, research and carried resources remain private to the owner. Hostile illusions retain their health disguise. Events redact unseen source and target references independently and do not expose another player's resource or research events.

A player is eliminated after losing its final living completed headquarters. Its allies can continue playing and the eliminated player can continue observing its team. Existing paid production and unit orders can continue; the eliminated actor cannot issue commands. An already paid foundation can finish and restore that player's active status while its team survives. A team wins only after every other team has lost all completed headquarters. Simultaneous loss of every headquarters produces a draw. `winningTeam` is authoritative; `winner` remains a representative player slot for older consumers. Outcomes must compare team identity rather than compare the observer's slot to `winner`.

AI memory contains one entry per player and tracks cleared hostile starting positions separately. AI chooses a living hostile start rather than selecting an ally or assuming `1 - side`. AI turn order rotates across the complete roster. Handicaps are explicit state values; AI does not receive hidden resources.

## Maps, saves and terminal use

Duel maps retain their original generated output. Three- and four-player matches use at least a large map; five through eight use a huge map. The returned `mapSize` reports the actual promoted size. Multiple bases have distinct clear pads, equal opening deposits and connected central and outer routes. Reserves rotate with the opening formation, preserving worker-to-deposit distances and income. The inherited random terrain has rotational symmetry for opposite positions, rather than exact symmetry across every possible player count. Navigation rebuilds grids when terrain walkability changes in place.

Save format version two includes all player arrays and runtime memory. The loader validates and migrates complete version-one saves before applying two-player team defaults. See `docs/SESSION_FORMAT.md` for limits and migration details.

The terminal keeps the old `start` operation and adds `{ "op": "startMatch", "config": ..., "side": 7 }`. The chosen slot must use an external controller. `{ "op": "save" }` returns the full envelope. `{ "op": "load", "save": ..., "side": 7 }` validates the envelope and selected slot before replacing the match. It makes the selected slot external, converts other human slots to AI, and preserves other external and AI controllers. Loading defaults to side one for a multi-player save and side zero for a single-player save. Replay hashes include simulation runtime. The CLI input limit permits a full 16 MiB save, including JSON-string wrapping overhead.

This is the headless team foundation. Browser team selection, networking, lobby readiness, spectators and public hosting are separate integration work; their existence cannot be inferred from these APIs.

## Verification

`tests/team-match.test.ts` runs real combat, allied support, ownership checks, team elimination, simultaneous headquarters destruction, handicap effects and all-slot AI economy, construction and recruitment. `tests/team-maps.test.ts` checks real routes between all bases, opening walkability, equal reserves and actual gathering income. `tests/team-saves.test.ts` compares complete saved state and runtime after each tick of 2v2, 3v3 and 4v4 continuation and validates legacy imports. `tests/team-observation.test.ts` and `tests/team-terminal.test.ts` exercise public observations, private information, command ownership, side-seven play and saved-match continuation through the actual terminal API.

[The preserved foundation evidence](evidence/CORE_TEAM_FOUNDATION.md) records the complete 681-case suite, a 108-game faction ladder and autonomous 2v2, 3v3 and 4v4 victories. It includes frozen source, executed bundles, runners, final saves, per-player metrics and the independent team-record review.
