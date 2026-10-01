import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ReplayPlayer, replayChecksum } from '../../src/core/replays';
import type { ReplayAction } from '../../src/core/replays';
import { saveGame, SAVE_VERSION } from '../../src/core/saves';
import { decodeSessionFile } from '../../src/core/session-storage';
import type { SessionFile } from '../../src/core/session-storage';
import { issueCommand, stepGame } from '../../src/core/simulation';
import { SIMULATION_REVISION } from '../../src/core/versions';
import { observeNative, verifyCaptureAmbushNativeArtifacts } from './capture-ambush-native-checks';
import { verifyDirectionDefenseNativeArtifacts } from './audit-direction-defense';
import { readAuthenticatedDownload } from './native-downloads';
export { observeNative };

const digest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
function commandSuffix(partial: SessionFile, full: SessionFile): ReplayAction[] {
  assert(partial.replay && full.replay); assert.deepEqual(partial.replay.initial, full.replay.initial);
  const prefix = partial.replay.actions, actions = full.replay.actions;
  let fullIndex = 0, consumedAdvance = 0;
  for (const action of prefix) {
    if (action.type === 'command') {
      assert.equal(consumedAdvance, 0, 'Checkpoint commands cannot occur inside a later advance');
      assert.deepEqual(actions[fullIndex++], action, 'Native checkpoint command prefix');
      continue;
    }
    let left = action.ticks;
    while (left) {
      const current = actions[fullIndex]; assert(current?.type === 'advance'); assert.equal(current.dt, action.dt);
      const take = Math.min(left, current.ticks - consumedAdvance); assert(take > 0);
      left -= take; consumedAdvance += take;
      if (consumedAdvance === current.ticks) { fullIndex++; consumedAdvance = 0; }
    }
  }
  const suffix = structuredClone(actions.slice(fullIndex));
  if (consumedAdvance) { assert(suffix[0]?.type === 'advance'); suffix[0].ticks -= consumedAdvance; }
  return suffix;
}

export function verifyNativeAcceptanceArtifacts({ evidenceDir, fixturesDir, manifest, receipt, sourceCommit }: {
  evidenceDir: string; fixturesDir: string; manifest: any; receipt: any; sourceCommit: string;
}) {
  assert.equal(manifest.sourceCommit, sourceCommit); assert.equal(receipt.source.commit, sourceCommit);
  assert.equal(manifest.saveVersion, SAVE_VERSION); assert.equal(manifest.simulationRevision, SIMULATION_REVISION);
  assert.equal(receipt.completed, true, 'Browser must complete before its histories are admitted');
  const selectedGroups = receipt.selectedGroups;
  assert(Array.isArray(selectedGroups) && selectedGroups.length > 0 && new Set(selectedGroups).size === selectedGroups.length);
  assert(selectedGroups.every(group => ['direction', 'capture', 'specialists'].includes(group)), 'Browser requested known acceptance groups');
  assert.deepEqual(Object.keys(receipt.groups).sort(), [...selectedGroups].sort(), 'Every requested browser group has its completed receipt');
  for(const group of selectedGroups)assert(receipt.groups[group]&&typeof receipt.groups[group]==='object'&&!Array.isArray(receipt.groups[group]),`Nonempty completed receipt for requested ${group}`);
  assert(Object.keys(receipt.downloads).length > 0, 'Retained native downloads are required');
  if (selectedGroups.includes('specialists')) {
    assert.equal(receipt.groups.specialists.completed, true);
    const required = ['specialists-earned-promotion','specialists-death-recovery','specialists-paid-rerecruit-queued','specialists-paid-rerecruit-complete','specialists-artifact-baseline-hit','specialists-artifact-equipped-hit','specialists-bridge-crossed','specialists-bridge-before-expiry','specialists-bridge-expired','specialists-barricade-obstructs','specialists-barricade-expired-crossed','specialists-beacon-connected-alert','specialists-beacon-link-destroyed'];
    for (const faction of ['orcs','fairies','dwarves','undead','tideborn','automata']) required.push(`specialists-${faction}-pending`,`specialists-${faction}-active`);
    for (const name of required) assert(Object.hasOwn(receipt.downloads,`${name}-save.json`),`Required native specialist endpoint ${name}`);
  }
  const authored = new Map(Object.entries(manifest.scenarios).map(([name, scenario]: [string, any]) => {
    const file = JSON.parse(readFileSync(resolve(fixturesDir, scenario.file), 'utf8'));
    return [digest(JSON.stringify(file.game)), name];
  }));
  const files = new Map<string, SessionFile>(), checks: any[] = [];
  for (const name of Object.keys(receipt.downloads)) {
    const { bytes } = readAuthenticatedDownload(evidenceDir, name, receipt.downloads);
    if (!name.endsWith('-save.json')) continue;
    const original = JSON.parse(bytes.toString()), decoded = decodeSessionFile(original);
    assert.equal(original.game.version, SAVE_VERSION); assert(original.replay);
    assert.equal(original.replay.simulationRevision, SIMULATION_REVISION); assert.equal(original.replay.checksumVersion, SAVE_VERSION);
    assert.deepEqual(decoded.file.game, original.game); assert.deepEqual(saveGame(decoded.state), original.game);
    const scenario = authored.get(digest(JSON.stringify(original.replay.initial))); assert(scenario, `${name} starts at a declared authored native input`);
    const replay = new ReplayPlayer(original.replay);
    try {
      const initialTick = replay.state.tick; const advanced = replay.advance(original.replay.finalTick - initialTick);
      assert(replay.finished); assert.equal(replayChecksum(replay.state), original.replay.finalChecksum);
      assert.deepEqual(saveGame(replay.state), original.game, `${name} complete original native replay game and runtime`);
      checks.push({ file: name, scenario, initialTick, advanced, finalTick: replay.state.tick, checksum: original.replay.finalChecksum, completeNativeRoundTrip: true, completeUnprojectedReplay: true });
    } finally { replay.dispose(); }
    files.set(name.replace(/-save\.json$/, ''), original);
  }
  assert(checks.length > 0, 'An admitted history audit must inspect original native saves');
  const pairs: [string, string][] = [];
  if (selectedGroups.includes('specialists')) {
    for (const faction of ['orcs', 'fairies', 'dwarves', 'undead', 'tideborn', 'automata']) pairs.push([`specialists-${faction}-pending`, `specialists-${faction}-active`]);
    pairs.push(['specialists-death-recovery', 'specialists-paid-rerecruit-complete'], ['specialists-paid-rerecruit-queued', 'specialists-paid-rerecruit-complete'], ['specialists-bridge-before-expiry', 'specialists-bridge-expired'], ['specialists-barricade-obstructs', 'specialists-barricade-expired-crossed'], ['specialists-beacon-connected-alert', 'specialists-beacon-link-destroyed']);
  }
  const continuations = pairs.map(([from, to]) => {
    const partial = files.get(from), full = files.get(to); assert(partial && full, `Retained native continuation ${from} to ${to}`);
    const state = decodeSessionFile(partial).state, suffix = commandSuffix(partial, full);
    for (const action of suffix) {
      if (action.type === 'command') assert(issueCommand(state, action.side, action.command), `Continuation accepts ${action.command.type}`);
      else { assert.equal(action.dt, .05); for (let tick = 0; tick < action.ticks; tick++) stepGame(state, action.dt); }
    }
    assert.deepEqual(saveGame(state), full.game, `${from} restored continuation equals full native game and runtime at ${to}`);
    return { from, to, checkpointTick: partial.game.state.tick, finalTick: full.game.state.tick, suffix, completeNativeContinuation: true };
  });
  const groupAudits: any = {};
  if (selectedGroups.includes('capture')) groupAudits.capture = verifyCaptureAmbushNativeArtifacts(evidenceDir, manifest, receipt.groups.capture, receipt.downloads);
  if (selectedGroups.includes('direction')) groupAudits.direction = verifyDirectionDefenseNativeArtifacts({ evidenceDir, fixturesDir, manifest: { ...manifest, scenarios: Object.fromEntries(Object.entries(manifest.scenarios).filter(([, scenario]: [string, any]) => scenario.group === 'direction')) }, browserReceipt: receipt.groups.direction, downloads:receipt.downloads, outputPath: resolve(evidenceDir, 'direction-defense-native-checks.json'), sourceCommit });
  const result = { sourceCommit, saveVersion: SAVE_VERSION, simulationRevision: SIMULATION_REVISION, completeNativeSaves: checks.length, checks, continuations, groupAudits };
  writeFileSync(resolve(evidenceDir, 'native-acceptance-history-checks.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  return result;
}
