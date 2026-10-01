import { decodeReplay, MatchRecorder, replayChecksum, replayRulesCompatible } from '../../src/core/replays';
import { createSessionFile, decodeSessionFile } from '../../src/core/session-storage';
import { loadGame, saveGame, SAVE_VERSION } from '../../src/core/saves';
import { createGame, isGameOver, isVisible, issueCommand, stepGame } from '../../src/core/simulation';
import { SIMULATION_REVISION } from '../../src/core/versions';
import type { Command, GameState, Side } from '../../src/core/types';

// This reference imports core operations, never TerminalSession or the CLI entry.
export { loadGame, saveGame, replayChecksum, isGameOver, issueCommand, stepGame, SAVE_VERSION, SIMULATION_REVISION };

export function decodeInput(input: unknown) {
  const session = typeof input === 'object' && input !== null && 'format' in input && input.format === 'orcs-vs-fairies/session'
    ? decodeSessionFile(input) : undefined;
  const archive = decodeReplay(session ? session.file.replay : input);
  if (!replayRulesCompatible(archive)) throw new Error('Packaged CLI parity requires a current save and simulation revision.');
  const state = loadGame(archive.initial);
  const sides = new Set(archive.actions.flatMap(action => action.type === 'command' ? [action.side] : []));
  if (sides.size > 1) throw new Error('The public CLI can replay commands for only one controlled side.');
  const side = (sides.size ? [...sides][0] : state.controllers.findIndex(controller => controller === 'external')) as Side;
  if (side < 0 || state.controllers[side] !== 'external' || state.controllers.some(controller => controller === 'human')) {
    throw new Error('Full-save CLI parity requires the controlled side to be external and no human controllers. Public CLI load changes other controller arrangements.');
  }
  if (archive.actions.some(action => action.type === 'advance' && action.dt !== .05)) {
    throw new Error('The public CLI advances at 0.05 seconds per tick.');
  }
  return { archive, side, state, finalSave: session ? saveGame(session.state) : undefined };
}

export function generateFixture() {
  const state = createGame('orcs', 4127, 'fairies', { mapSize: 'small', controllers: ['external', 'ai'] });
  const recorder = new MatchRecorder(state);
  const hq = state.entities.find(entity => entity.side === 0 && entity.role === 'hq')!;
  const workers = state.entities.filter(entity => entity.side === 0 && entity.role === 'worker');
  const wood = state.resources.find(node => node.kind === 'wood' && isVisible(state, 0, node.x, node.y))!;
  function command(value: Command) {
    if (!issueCommand(state, 0, value)) throw new Error(`Fixture command rejected: ${value.type}.`);
  }
  command({ type: 'gather', ids: workers.map(worker => worker.id), target: wood.id });
  command({ type: 'train', id: hq.id, role: 'worker' });
  command({ type: 'setRally', ids: [hq.id], x: workers[0].x, y: workers[0].y });
  for (let tick = 0; tick < 2402; tick++) {
    if (tick === 15) command({ type: 'stop', ids: [workers[0].id] });
    if (tick === 40) command({ type: 'gather', ids: [workers[0].id], target: wood.id });
    if (isGameOver(state)) throw new Error('The modest CLI fixture ended before its continuation checkpoint.');
    stepGame(state, .05);
  }
  // A final command verifies that the driver preserves commands sharing the
  // archive's final tick instead of stopping at the final advance.
  command({ type: 'hold', ids: [workers[0].id] });
  const archive = recorder.export(); recorder.dispose();
  return createSessionFile(state, archive);
}

export function snapshot(state: GameState) {
  return { save: saveGame(state), checksum: replayChecksum(state) };
}
