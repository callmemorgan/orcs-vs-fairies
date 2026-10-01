import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PlayerView } from '../../src/core/observation';
import { ReplayPlayer } from '../../src/core/replays';
import type { ReplayAction } from '../../src/core/replays';
import { SAVE_VERSION, saveGame } from '../../src/core/saves';
import { decodeSessionFile } from '../../src/core/session-storage';
import type { SessionFile } from '../../src/core/session-storage';
import { issueCommand, stepGame } from '../../src/core/simulation';
import { SIMULATION_REVISION } from '../../src/core/versions';
import type { GameState, Side } from '../../src/core/types';
import { readAuthenticatedDownload } from './native-downloads';

const nativeSaves = [
  'siege-crew-defeated', 'siege-mid-capture', 'siege-new-owner', 'siege-new-owner-moved',
  'siege-new-owner-pending-shot', 'siege-new-owner-impact', 'surrounded-surrender',
  'surrounded-surrender-moved', 'morale-active-retreat', 'morale-retreat-recovered',
  'ambush-concealed', 'ambush-triggered', 'ambush-scout-spotted', 'ambush-manually-released',
  'ambush-timber-cleared',
] as const;

function decodeNative(input: unknown) {
  const decoded = decodeSessionFile(input);
  assert.equal(decoded.file.game.version, SAVE_VERSION);
  assert.equal(decoded.file.replay?.simulationRevision, SIMULATION_REVISION);
  assert.equal(decoded.file.replay?.initial.version, SAVE_VERSION);
  assert.equal(decoded.file.replay?.checksumVersion, SAVE_VERSION);
  assert.equal(decoded.file.planning === undefined || decoded.file.planning.version === 1, true);
  assert.deepEqual(saveGame(decoded.state), decoded.file.game, 'The complete original native game must round-trip, including runtime');
  return decoded;
}

/** Pure observation of the original native download, with no controller projection. */
export function observeNative(input: unknown, side: Side, level = 0) {
  const { state, file } = decodeNative(input);
  assert(Number.isSafeInteger(side) && side >= 0 && side < state.players.length);
  const observed = new PlayerView(side).observe(state);
  const entities = observed.entities.filter(entity => (entity.level ?? 0) === level);
  return {
    originalTick: file.game.state.tick, side, level, ids: entities.map(entity => entity.id), entities,
    visible: observed.visible, renderedUnits: entities.filter(entity => entity.kind === 'unit' && entity.hp > 0).length,
  };
}

function suffix(partial: SessionFile, full: SessionFile): ReplayAction[] {
  assert(partial.replay && full.replay);
  assert.deepEqual(full.replay.initial, partial.replay.initial, 'Continuation must retain the same original initial game');
  const prefix = partial.replay.actions, actions = full.replay.actions;
  assert(prefix.length <= actions.length);
  if (!prefix.length) return structuredClone(actions);
  for (let index = 0; index < prefix.length - 1; index++) assert.deepEqual(actions[index], prefix[index], `Recorded command/advance prefix at ${index}`);
  const last = prefix.at(-1)!, next = actions[prefix.length - 1];
  assert(next);
  let remainder: ReplayAction[] = [];
  if (last.type === 'advance' && next.type === 'advance') {
    assert.equal(next.dt, last.dt); assert(next.ticks >= last.ticks);
    if (next.ticks > last.ticks) remainder.push({ type: 'advance', dt: next.dt, ticks: next.ticks - last.ticks });
  } else assert.deepEqual(next, last);
  remainder = remainder.concat(structuredClone(actions.slice(prefix.length)));
  return remainder;
}

function apply(state: GameState, actions: ReplayAction[]) {
  for (const action of actions) {
    if (action.type === 'command') assert(issueCommand(state, action.side, action.command), `Native continuation accepts ${action.command.type}`);
    else {
      assert.equal(action.dt, .05, 'Native production recorder retains .05-second engine ticks');
      for (let tick = 0; tick < action.ticks; tick++) stepGame(state, action.dt);
    }
  }
}

export function verifyCaptureAmbushNativeArtifacts(directory: string, manifest: {
  sourceCommit: string;
  scenarios: Record<string, { ids: Record<string, number | number[] | { x: number; y: number; level: number }> }>;
}, browserReceipt: { retainedNativeSaves: unknown }, downloads: Record<string, { bytes: number; sha256: string }>) {
  const out = resolve(directory), files = new Map<string, SessionFile>();
  const checks: Record<string, unknown>[] = [];
  const expectedFiles = nativeSaves.map(name => `${name}-save.json`);
  assert(browserReceipt && Array.isArray(browserReceipt.retainedNativeSaves), 'Capture browser receipt declares retained native saves');
  const retained = browserReceipt.retainedNativeSaves;
  assert(retained.every(name => typeof name === 'string'), 'Retained native save names must be strings');
  assert.equal(retained.length, expectedFiles.length, 'Capture receipt retains all fifteen required native saves');
  assert.equal(new Set(retained).size, retained.length, 'Capture receipt native save names must be unique');
  assert.deepEqual([...retained].sort(), [...expectedFiles].sort(), 'Capture receipt native saves equal the fixed acceptance set');
  assert(downloads && typeof downloads === 'object' && !Array.isArray(downloads), 'Authenticated native download map is required');
  for (const name of nativeSaves) {
    const filename = `${name}-save.json`;
    assert(Object.hasOwn(downloads, filename), `Required native capture save is an authenticated browser download: ${filename}`);
    const { bytes, path } = readAuthenticatedDownload(out, filename, downloads);
    const original = JSON.parse(bytes.toString('utf8'));
    const { state, file } = decodeNative(original); assert(file.replay);
    const replay = new ReplayPlayer(file.replay);
    try {
      replay.seek(state.tick);
      assert.deepEqual(saveGame(replay.state), file.game, `${name} full unprojected replay must equal every native game/runtime field`);
    } finally { replay.dispose(); }
    assert(file.replay.actions.every(action => action.type !== 'command' || action.side === 0), 'Later native UI commands belong to the playable side; hostile initial orders are setup');
    files.set(name, file);
    checks.push({ name, file: filename, authenticatedPath: path, sha256: downloads[filename].sha256, tick: state.tick, fullNativeRoundTrip: true, fullUnprojectedReplay: true, commands: file.replay.actions.filter(action => action.type === 'command') });
  }

  for (const [partialName, fullName] of [
    ['siege-mid-capture', 'siege-new-owner-impact'],
    ['siege-new-owner-pending-shot', 'siege-new-owner-impact'],
    ['morale-active-retreat', 'morale-retreat-recovered'],
    ['ambush-concealed', 'ambush-triggered'],
  ]) {
    const partial = files.get(partialName)!, full = files.get(fullName)!;
    const continuation = suffix(partial, full), state = decodeNative(partial).state;
    apply(state, continuation);
    assert.deepEqual(saveGame(state), full.game, `${partialName} pending continuation must equal every uninterrupted native game/runtime field`);
    checks.push({ name: `${partialName} → ${fullName}`, checkpointTick: partial.game.state.tick, finalTick: full.game.state.tick, completeNativeContinuation: true, actions: continuation });
  }

  const triggerIds = manifest.scenarios['ambush-selected-trigger'].ids;
  const ambusherId = triggerIds.ambusher as number;
  const concealed = observeNative(files.get('ambush-concealed'), 1);
  const triggered = observeNative(files.get('ambush-triggered'), 1);
  const owned = observeNative(files.get('ambush-concealed'), 0);
  assert(owned.ids.includes(ambusherId)); assert(!concealed.ids.includes(ambusherId)); assert(triggered.ids.includes(ambusherId));
  assert(!Object.hasOwn(triggered.entities.find(entity => entity.id === ambusherId)!.tactics ?? {}, 'ambush'));
  const scoutIds = manifest.scenarios['ambush-scout-release-firebreak'].ids;
  const spotted = observeNative(files.get('ambush-scout-spotted'), 1);
  assert(spotted.ids.includes(scoutIds.ambusher as number));
  assert(!Object.hasOwn(spotted.entities.find(entity => entity.id === scoutIds.ambusher)!.tactics ?? {}, 'ambush'));
  const crewIds = manifest.scenarios['siege-full-crew-capture'].ids;
  const crewless = observeNative(files.get('siege-crew-defeated'), 1);
  const abandoned = crewless.entities.find(entity => entity.id === crewIds.engine);
  assert(abandoned); assert.equal(abandoned.owner, null);
  assert.equal(observeNative(files.get('siege-new-owner'), 0).entities.find(entity => entity.id === crewIds.engine)!.owner, 0);
  checks.push({ name: 'Original native PlayerView observer and ownership evidence', originalInputs: ['ambush-concealed', 'ambush-triggered', 'ambush-scout-spotted', 'siege-crew-defeated', 'siege-new-owner'], concealed, triggered, spotted, crewless });
  const result = { sourceCommit: manifest.sourceCommit, saveVersion: SAVE_VERSION, simulationRevision: SIMULATION_REVISION, executed: true, nativeSaves: nativeSaves.length, checks };
  writeFileSync(resolve(out, 'capture-ambush-native-checks.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  return result;
}
