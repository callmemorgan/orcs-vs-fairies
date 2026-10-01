import { ReplayPlayer } from '../../src/core/replays';
import type { ReplayArchive } from '../../src/core/replays';
import { loadGame, saveGame } from '../../src/core/saves';
import { issueCommand, stepGame } from '../../src/core/simulation';
import type { GameState } from '../../src/core/types';

function serialized(state: GameState): string {
  const saved = saveGame(state);
  saved.state.visible = saved.state.visible.map(cells => cells.sort((a, b) => a - b));
  saved.state.explored = saved.state.explored.map(cells => cells.sort((a, b) => a - b));
  return JSON.stringify(saved);
}
async function hash(state: GameState): Promise<string> {
  const value = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized(state)));
  return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function checkReplay(archive: ReplayArchive, diagnostic = false) {
  const player = new ReplayPlayer(archive), tickHashes: string[] = [];
  const middle = Math.floor(archive.finalTick / 2);
  try {
    tickHashes.push(await hash(player.state));
    while (!player.finished) {
      try { player.advance(1); }
      catch (error) {
        if (!diagnostic) throw error;
        tickHashes.push(await hash(player.state));
        return { failedAt: player.state.tick, error: error instanceof Error ? error.message : String(error), tickHashes, finalState: serialized(player.state) };
      }
      tickHashes.push(await hash(player.state));
    }
    const finalHash = await hash(player.state);
    player.seek(middle);
    const continued = loadGame(saveGame(player.state));
    let tick = archive.initial.state.tick;
    for (const action of archive.actions) {
      if (action.type === 'command') {
        if (tick > middle && !issueCommand(continued, action.side, action.command)) throw new Error(`Saved continuation command rejected at ${tick}.`);
      } else for (let step = 0; step < action.ticks; step++) {
        if (tick >= middle) stepGame(continued, action.dt);
        tick++;
      }
    }
    const continuationHash = await hash(continued);
    if (continuationHash !== finalHash) throw new Error('Saved continuation diverged.');
    const seekHashes = [];
    for (const target of [0, Math.min(600, archive.finalTick), middle, archive.finalTick, Math.min(1200, archive.finalTick), archive.finalTick]) {
      player.seek(target);
      const value = await hash(player.state);
      if (value !== tickHashes[target - archive.initial.state.tick]) throw new Error(`Checkpoint seek diverged at ${target}.`);
      seekHashes.push({ tick: target, sha256: value });
    }
    return { initialTick: archive.initial.state.tick, finalTick: archive.finalTick, finalHash, continuationHash, seekHashes, tickHashes };
  } finally { player.dispose(); }
}
if (typeof window !== 'undefined') (window as unknown as { tournamentParity: typeof checkReplay }).tournamentParity = checkReplay;
