import { createMatch } from '../core/simulation';
import type { FactionId, GameState, MatchConfig, Side } from '../core/types';
import { decodeMapPackage, validateEditorMap } from './map-package';
import type { MapPackage } from './map-package';

/** The core receives the authored world unchanged, including entrances and elevations. */
export function createEditedMatch(input: MapPackage, faction: FactionId = 'orcs', opponent: FactionId = 'fairies'): GameState {
  const pkg = decodeMapPackage(input), checked = validateEditorMap(pkg.map);
  if (!checked.valid) throw new Error(checked.issues.join('; '));
  const config = {
    schemaVersion: 1,
    map: { seed: pkg.map.seed, size: pkg.map.size, world: structuredClone(pkg.map) },
    players: [...pkg.map.starts].sort((a, b) => a.slot - b.slot).map(start => ({
      id: start.slot as Side, teamId: start.slot as Side,
      factionId: start.slot === 0 ? faction : opponent,
      controller: start.slot === 0 ? 'human' as const : 'ai' as const, startingSlot: start.slot,
    })),
  } as MatchConfig;
  return createMatch(config);
}
