import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MatchRecorder, replayChecksum, type ReplayAction, type ReplayArchive } from '../src/core/replays';
import { loadGame } from '../src/core/saves';
import { createPlanningRuntime } from '../src/core/planning';
import { createSessionFile, decodeSessionFile, type SessionFile } from '../src/core/session-storage';
import { issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import type { Command, GameState, Side } from '../src/core/types';

const root = process.cwd(), sourcePin = process.argv[2];
assert(sourcePin);
const { continuationActions, normalizedForCli, verifyNativeSession } = await import(pathToFileURL(resolve(root, 'work/prepare-combat-cli-projection.mjs')).href) as typeof import('../scripts/prepare_combat_cli_projection');
const folder = resolve(root, `work/projection-fault-proof-${sourcePin.slice(0, 7)}-${process.argv[3] ?? 'run1'}`);
mkdirSync(folder, { recursive: true });
const finalPath = resolve(root, 'work/projection-fixtures/final.session.json');
const raw = JSON.parse(readFileSync(finalPath, 'utf8')) as SessionFile;
assert(raw.replay);
const records: Array<{ name: string; passed: true; error?: string }> = [];
function passes(name: string, fn: () => void) { fn(); records.push({ name, passed: true }); }
function rejects(name: string, fn: () => void, pattern: RegExp) {
  let failure: unknown;
  try { fn(); } catch (error) { failure = error; }
  assert(failure instanceof Error, `${name} must reject`);
  assert.match(failure.message, pattern);
  records.push({ name, passed: true, error: failure.message });
}
function adapterReject(name: string, session: string, pattern: RegExp, pin = sourcePin, executable = resolve(root, 'work/prepare-combat-cli-projection.mjs')) {
  const output = resolve(folder, `${name}-output`), args = [executable, session, output, pin, '--root', root];
  const processResult = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 30_000 });
  writeFileSync(resolve(folder, `${name}.stdout`), processResult.stdout ?? '');
  writeFileSync(resolve(folder, `${name}.stderr`), processResult.stderr ?? '');
  writeFileSync(resolve(folder, `${name}.process.json`), JSON.stringify({ command: [process.execPath, ...args], cwd: root, status: processResult.status, signal: processResult.signal, error: processResult.error?.message ?? null }, null, 2));
  assert.ifError(processResult.error);
  assert.equal(processResult.status, 1, `${name} must fail`);
  const failure = JSON.parse(readFileSync(resolve(output, 'failure.json'), 'utf8')) as { error: string };
  assert.match(failure.error, pattern);
  records.push({ name, passed: true, error: failure.error });
}
const A: ReplayAction = { type: 'command', side: 0, command: { type: 'stop', ids: [1] } };
const B: ReplayAction = { type: 'command', side: 0, command: { type: 'hold', ids: [1] } };
const advance = (ticks: number, dt = .05): ReplayAction => ({ type: 'advance', dt, ticks });
function archive(actions: ReplayAction[]): ReplayArchive {
  return { ...structuredClone(raw.replay!), actions, finalTick: raw.replay!.initial.state.tick + actions.reduce((sum, action) => sum + (action.type === 'advance' ? action.ticks : 0), 0) };
}
passes('equal action streams have empty suffix', () => assert.deepEqual(continuationActions(archive([A, advance(20)]), archive([A, advance(20)])), []));
passes('partial coalesced checkpoint advance retains remaining ticks', () => assert.deepEqual(continuationActions(archive([A, advance(20), B]), archive([A, advance(7)])), [advance(13), B]));
passes('same-tick commands after checkpoint remain in suffix', () => assert.deepEqual(continuationActions(archive([A, advance(20), B, advance(5)]), archive([A, advance(20)])), [B, advance(5)]));
passes('adjacent equal-dt chunks are equivalent without crossing commands', () => assert.deepEqual(continuationActions(archive([A, advance(5), advance(15), B]), archive([A, advance(3), advance(4)])), [advance(13), B]));
passes('checkpoint before any action retains all actions', () => assert.deepEqual(continuationActions(archive([A, advance(20)]), archive([])), [A, advance(20)]));
rejects('nonlast checkpoint advance cannot be shortened', () => continuationActions(archive([A, advance(20), B, advance(10)]), archive([A, advance(7), B, advance(10)])), /Only the last checkpoint advance/);
rejects('checkpoint cannot extend beyond final', () => continuationActions(archive([A, advance(20)]), archive([A, advance(21)])), /Checkpoint tick exceeds/);
rejects('commands cannot cross an advance boundary', () => continuationActions(archive([A, advance(20), B, advance(10)]), archive([A, B, advance(20)])), /Checkpoint command\/action differs/);
rejects('changed command is rejected', () => continuationActions(archive([A, advance(20)]), archive([B, advance(20)])), /Checkpoint command\/action differs/);
rejects('changed dt is rejected', () => continuationActions(archive([A, advance(20)]), archive([A, advance(7, .1)])), /Checkpoint advance dt differs/);
rejects('different original initial is rejected', () => { const cp = archive([A, advance(7)]); cp.initial.state.players[0].wood++; continuationActions(archive([A, advance(20)]), cp); }, /same original initial/);
rejects('different rules revision is rejected', () => { const cp = archive([A, advance(7)]); cp.simulationRevision = 'different'; continuationActions(archive([A, advance(20)]), cp); }, /rules revision differs/);
rejects('different checksum version is rejected', () => { const cp = archive([A, advance(7)]); cp.checksumVersion = 2; continuationActions(archive([A, advance(20)]), cp); }, /checksum version differs/);
passes('normalization changes only cloned controller0 and preserves runtime', () => { const before = structuredClone(raw.game), projected = normalizedForCli(raw.game); const expected = structuredClone(raw.game); expected.state.controllers[0] = 'external'; assert.deepEqual(projected, expected); assert.deepEqual(raw.game, before); assert.deepEqual(projected.runtime, before.runtime); });
rejects('alternate human side normalization is rejected', () => { const before = structuredClone(raw.game); before.state.controllers[1] = 'human'; normalizedForCli(before); }, /Alternate human sides/);
rejects('AI controlled side0 projection is rejected', () => { const before = structuredClone(raw.game); before.state.controllers[0] = 'ai'; normalizedForCli(before); }, /Side 0 must be human or external/);
passes('import-pair validity cannot substitute for native playback', () => {
  const changed = structuredClone(raw); changed.game.state.players[0].wood++;
  changed.replay!.finalChecksum = replayChecksum(loadGame(changed.game));
  decodeSessionFile(JSON.stringify(changed));
  rejects('tampered full game with adjusted import checksum fails playback', () => verifyNativeSession(JSON.stringify(changed)), /Replay final state diverged|native replay differs/);
});

function generated(name: string, alter: (state: GameState) => void, command?: { side: 0 | 1; value: Command }, dt = .05) {
  const state = loadGame(raw.replay!.initial); alter(state); refreshVisibility(state);
  const recorder = new MatchRecorder(state);
  try {
    if (command) assert(issueCommand(state, command.side, command.value));
    stepGame(state, dt);
    const file = createSessionFile(state, recorder.export());
    verifyNativeSession(JSON.stringify(file), name);
    const path = resolve(folder, `${name}.session.json`); writeFileSync(path, JSON.stringify(file)); return path;
  } finally { recorder.dispose(); }
}
const otherHuman = generated('alternate-human', state => { state.controllers[1] = 'human'; });
adapterReject('alternate-human', otherHuman, /Alternate human sides/);
const otherSide = generated('other-command-side', () => {}, { side: 1, value: { type: 'clearRally', ids: [raw.replay.initial.state.entities.find(entity => entity.side === 1 && entity.role === 'hq')!.id] } });
adapterReject('other-side', otherSide, /not controlled by side 0/);
const differentDt = generated('different-dt', () => {}, undefined, .1);
adapterReject('different-dt', differentDt, /not the CLI timestep/);
adapterReject('wrong-source', finalPath, /requested full source commit/, '0'.repeat(40));
assert.deepEqual(readFileSync(resolve(folder, 'wrong-source-output/original-final.json')), readFileSync(finalPath));
const planned = structuredClone(raw);
planned.planning = { version: 1, players: raw.game.state.players.map((_, side) => createPlanningRuntime(side as Side)), automaticSides: [] };
verifyNativeSession(JSON.stringify(planned), 'native browser planning wrapper');
const plannedPath = resolve(folder, 'with-planning.session.json'), plannedOutput = resolve(folder, 'with-planning-output');
writeFileSync(plannedPath, JSON.stringify(planned));
const plannedArgs = [resolve(root, 'work/prepare-combat-cli-projection.mjs'), plannedPath, plannedOutput, sourcePin, '--root', root];
const plannedRun = spawnSync(process.execPath, plannedArgs, { cwd: root, encoding: 'utf8', timeout: 30_000 });
writeFileSync(resolve(folder, 'with-planning.stdout'), plannedRun.stdout ?? '');
writeFileSync(resolve(folder, 'with-planning.stderr'), plannedRun.stderr ?? '');
writeFileSync(resolve(folder, 'with-planning.process.json'), JSON.stringify({ command: [process.execPath, ...plannedArgs], status: plannedRun.status, signal: plannedRun.signal, error: plannedRun.error?.message ?? null }, null, 2));
passes('valid planning wrapper is retained and explicitly omitted from derived CLI session', () => {
  assert.ifError(plannedRun.error); assert.equal(plannedRun.status, 0);
  assert.deepEqual(readFileSync(resolve(plannedOutput, 'original-final.json')), readFileSync(plannedPath));
  const projected = JSON.parse(readFileSync(resolve(plannedOutput, 'projected-full.session.json'), 'utf8')) as SessionFile;
  assert(!Object.hasOwn(projected, 'planning'));
  const report = JSON.parse(readFileSync(resolve(plannedOutput, 'projection.json'), 'utf8'));
  assert.equal(report.native.outerPlanningPresent, true); assert.equal(report.outerPlanning.projectedSessionsOmitPlanning, true);
});
rejects('invalid planning metadata is still rejected by the native decoder', () => { const invalid = structuredClone(planned); invalid.planning!.players[0].targets.wood = -1; verifyNativeSession(JSON.stringify(invalid)); }, /Invalid saved plans/);
const staleBundle = resolve(folder, 'stale-adapter.mjs');
writeFileSync(staleBundle, readFileSync(resolve(root, 'work/prepare-combat-cli-projection.mjs'), 'utf8') + '\n// Divergent executed bytes with identical declared simulation versions.\n');
adapterReject('stale-executed-bundle', finalPath, /Executed adapter bundle does not match/, sourcePin, staleBundle);
const uncommittedProof = resolve(root, 'scripts/prepare_combat_cli_projection.ts'), originalProof = readFileSync(uncommittedProof);
try {
  writeFileSync(uncommittedProof, Buffer.concat([originalProof, Buffer.from('\n// Uncommitted proof source fault in the isolated checkout.\n')]));
  adapterReject('uncommitted-proof-source', finalPath, /Adapter source bytes differ from its committed HEAD blob/);
} finally { writeFileSync(uncommittedProof, originalProof); }
const flaggedSource = resolve(root, 'src/core/versions.ts'), originalSource = readFileSync(flaggedSource);
try {
  execFileSync('git', ['update-index', '--assume-unchanged', 'src/core/versions.ts']);
  writeFileSync(flaggedSource, Buffer.concat([originalSource, Buffer.from('\n// Provenance fault in the isolated temporary checkout.\n')]));
  assert.equal(execFileSync('git', ['status', '--porcelain', '--', 'src'], { encoding: 'utf8' }).trim(), '');
  adapterReject('hidden-modified-source', finalPath, /Core source bytes differ from HEAD/);
} finally {
  writeFileSync(flaggedSource, originalSource);
  execFileSync('git', ['update-index', '--no-assume-unchanged', 'src/core/versions.ts']);
}
assert.equal(execFileSync('git', ['status', '--porcelain', '--', 'src'], { encoding: 'utf8' }).trim(), '');
writeFileSync(resolve(folder, 'result.json'), JSON.stringify({ sourcePin, passed: records.length, records }, null, 2) + '\n');
console.log(JSON.stringify({ passed: records.length, report: resolve(folder, 'result.json') }));
