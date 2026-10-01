import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MatchRecorder, ReplayPlayer, replayChecksum, replayRulesCompatible, type ReplayAction, type ReplayArchive } from '../src/core/replays';
import { loadGame, saveGame, SAVE_VERSION, type SaveEnvelope } from '../src/core/saves';
import { createSessionFile, decodeSessionFile, type SessionFile } from '../src/core/session-storage';
import { issueCommand, stepGame } from '../src/core/simulation';
import { SIMULATION_REVISION } from '../src/core/versions';
import type { GameState } from '../src/core/types';

// Bundle with esbuild, then run:
// node ADAPTER.mjs FINAL_SESSION.json NEW_OUTPUT_DIRECTORY FULL_COMMIT [--checkpoint SESSION.json] [--root REPO]
// Feed projected-full.session.json and, if present, projected-pending.session.json
// separately to scripts/tournaments/verify-packaged-cli-parity.mjs.
// The original browser inputs are authenticated and retained before projection.
const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const json = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

function pinnedSourceFiles(root: string) {
  assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'src'], { cwd: root, encoding: 'utf8' }).trim(), '', 'Core source must match its recorded commit');
  const algorithm = execFileSync('git', ['rev-parse', '--show-object-format'], { cwd: root, encoding: 'utf8' }).trim();
  return execFileSync('git', ['ls-tree', '-r', '-z', 'HEAD', '--', 'src'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean).map(entry => {
    const match = /^(\d+) blob ([0-9a-f]+)\t(.+)$/.exec(entry);
    assert(match && match[1] === '100644', `Unsupported core source tree entry: ${entry}`);
    const [, , blob, path] = match, bytes = readFileSync(resolve(root, path));
    const actualBlob = createHash(algorithm).update(Buffer.from(`blob ${bytes.byteLength}\0`)).update(bytes).digest('hex');
    assert.equal(actualBlob, blob, `Core source bytes differ from HEAD: ${path}`);
    return { path, gitBlob: blob, sha256: sha256(bytes) };
  }).sort((a, b) => a.path.localeCompare(b.path));
}

function adjacentAdvances(actions: ReplayAction[]): ReplayAction[] {
  const normalized: ReplayAction[] = [];
  for (const action of actions) {
    const last = normalized.at(-1);
    if (action.type === 'advance' && last?.type === 'advance' && last.dt === action.dt) last.ticks += action.ticks;
    else normalized.push(structuredClone(action));
  }
  return normalized;
}

/** A checkpoint can precede later commands at the same tick; ticks alone cannot identify its suffix. */
export function continuationActions(full: ReplayArchive, checkpoint: ReplayArchive): ReplayAction[] {
  assert.deepEqual(checkpoint.initial, full.initial, 'Checkpoint and final replay must have the same original initial envelope');
  assert.equal(checkpoint.simulationRevision, full.simulationRevision, 'Checkpoint rules revision differs');
  assert.equal(checkpoint.checksumVersion, full.checksumVersion, 'Checkpoint checksum version differs');
  assert(checkpoint.finalTick <= full.finalTick, 'Checkpoint tick exceeds the final replay');
  const prefix = adjacentAdvances(checkpoint.actions), actions = adjacentAdvances(full.actions);
  assert(prefix.length <= actions.length, 'Checkpoint action stream exceeds the full replay');
  for (const [index, earlier] of prefix.entries()) {
    const later = actions[index];
    if (earlier.type === 'advance' && later.type === 'advance') {
      assert.equal(earlier.dt, later.dt, `Checkpoint advance dt differs at action ${index}`);
      if (earlier.ticks !== later.ticks) {
        assert.equal(index, prefix.length - 1, 'Only the last checkpoint advance may be a strict tick prefix');
        assert(earlier.ticks < later.ticks, `Checkpoint advance exceeds the full action at ${index}`);
        return [{ ...later, ticks: later.ticks - earlier.ticks }, ...structuredClone(actions.slice(index + 1))];
      }
    } else assert.deepEqual(earlier, later, `Checkpoint command/action differs at action ${index}`);
  }
  return structuredClone(actions.slice(prefix.length));
}

export function normalizedForCli(envelope: SaveEnvelope): SaveEnvelope {
  const expected = structuredClone(envelope);
  assert(['human', 'external'].includes(expected.state.controllers[0]), 'Side 0 must be human or external before projection');
  assert(expected.state.controllers.slice(1).every(controller => controller !== 'human'), 'Alternate human sides require an independent AI-continuation reference and are unsupported');
  expected.state.controllers[0] = 'external';
  return expected;
}

export function verifyNativeSession(text: string, label = 'session') {
  const file = JSON.parse(text) as SessionFile;
  assert.equal(file.game.version, SAVE_VERSION, `${label}: regenerate the native export for the current save version`);
  assert(file.replay, `${label}: native recorder history is required`);
  assert.equal(file.replay.initial.version, SAVE_VERSION);
  assert.equal(file.replay.checksumVersion, SAVE_VERSION);
  assert.equal(file.replay.simulationRevision, SIMULATION_REVISION);
  assert(replayRulesCompatible(file.replay), `${label}: incompatible replay rules`);
  const decoded = decodeSessionFile(text);
  assert.deepEqual(decoded.file.game, file.game, `${label}: decoder changed the complete saved envelope`);
  assert.deepEqual(saveGame(decoded.state), file.game, `${label}: complete save roundtrip differs`);
  assert.deepEqual(decoded.file.replay, file.replay, `${label}: decoder changed the recorder history`);
  assert(!file.scenarioProfile && !decoded.state.scenario, 'CLI projection does not cover scenario-profile state or scenario bindings');
  assert.deepEqual(file.game.state.controllers, file.replay.initial.state.controllers, 'Controller changes within recorded browser history are unsupported');
  const player = new ReplayPlayer(file.replay);
  try {
    const initialTick = player.state.tick, requested = file.replay.finalTick - initialTick;
    const advanced = player.advance(requested);
    assert.equal(advanced, requested, `${label}: native playback stopped early`);
    assert(player.finished, `${label}: native playback did not finish`);
    assert.equal(player.state.tick, file.game.state.tick);
    assert.equal(replayChecksum(player.state), file.replay.finalChecksum);
    assert.deepEqual(saveGame(player.state), file.game, `${label}: unprojected native replay differs from the complete browser game envelope`);
    return { file, archive: file.replay, proof: { initialTick, finalTick: player.state.tick, advanced, nativeChecksum: file.replay.finalChecksum, completeEnvelopeRoundtrip: true, unprojectedNativeReplayEnvelope: true, outerPlanningPresent: file.planning !== undefined, outerPlanningValidatedByNativeDecoder: file.planning !== undefined } };
  } finally { player.dispose(); }
}

function validateActions(archive: ReplayArchive) {
  normalizedForCli(archive.initial);
  for (const [index, action] of archive.actions.entries()) {
    if (action.type === 'command') assert.equal(action.side, 0, `Action ${index} is not controlled by side 0`);
    else assert.equal(action.dt, .05, `Action ${index} is not the CLI timestep .05`);
  }
}

function recordActions(initial: SaveEnvelope, actions: ReplayAction[], label: string) {
  const state = loadGame(initial), recorder = new MatchRecorder(state);
  const receipts: Array<{ actionIndex: number; tick: number; accepted: true }> = [];
  let advanced = 0;
  try {
    for (const [actionIndex, action] of actions.entries()) {
      if (action.type === 'command') {
        const tick = state.tick;
        assert(issueCommand(state, action.side, action.command), `${label}: public command ${actionIndex} was rejected at tick ${tick}`);
        receipts.push({ actionIndex, tick, accepted: true });
      } else {
        for (let offset = 0; offset < action.ticks; offset++) {
          const before = state.tick; stepGame(state, action.dt);
          assert.equal(state.tick, before + 1, `${label}: simulation ended early at action ${actionIndex}`);
          advanced++;
        }
      }
    }
    const file = createSessionFile(state, recorder.export());
    verifyNativeSession(JSON.stringify(file), `${label} recorded projection`);
    return { file, proof: { initialTick: initial.state.tick, finalTick: state.tick, advanced, acceptedCommands: receipts.length, receipts } };
  } finally { recorder.dispose(); }
}

function pendingShots(state: GameState) {
  return [...(state.projectiles ?? []).map(shot => ({ kind: 'projectile', id: shot.id, impactAt: shot.impactAt })), ...(state.specialists?.shots ?? []).map(shot => ({ kind: 'specialist', id: shot.id, impactAt: shot.impactAt }))];
}

export function prepareCombatCliProjection(options: { session: string; output: string; sourcePin: string; checkpoint?: string; root?: string }) {
  const root = resolve(options.root ?? process.cwd()), output = resolve(options.output);
  if (existsSync(output)) assert.equal(readdirSync(output).length, 0, 'Use a new or empty output directory');
  else mkdirSync(output, { recursive: true });
  try {
    const originalFinal = readFileSync(resolve(options.session));
    writeFileSync(resolve(output, 'original-final.json'), originalFinal);
    const originalCheckpoint = options.checkpoint ? readFileSync(resolve(options.checkpoint)) : undefined;
    if (originalCheckpoint) writeFileSync(resolve(output, 'original-checkpoint.json'), originalCheckpoint);
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    assert.equal(head, options.sourcePin, 'Adapter must use the requested full source commit');
    const sourceFiles = pinnedSourceFiles(root);
    const proofSource = resolve(root, 'scripts/prepare_combat_cli_projection.ts'), executed = fileURLToPath(import.meta.url);
    assert.deepEqual(readFileSync(proofSource), execFileSync('git', ['show', 'HEAD:scripts/prepare_combat_cli_projection.ts'], { cwd: root }), 'Adapter source bytes differ from its committed HEAD blob');
    const proofSourceGitBlob = execFileSync('git', ['rev-parse', 'HEAD:scripts/prepare_combat_cli_projection.ts'], { cwd: root, encoding: 'utf8' }).trim();
    copyFileSync(proofSource, resolve(output, 'proof-source.ts'));
    copyFileSync(executed, resolve(output, 'proof-executed.mjs'));
    json(resolve(output, 'source-manifest.json'), { sourcePin: head, files: sourceFiles });
    const rebuilt = resolve(output, 'proof-rebuilt.mjs');
    const buildArgs = ['scripts/prepare_combat_cli_projection.ts', '--bundle', '--platform=node', '--format=esm', `--outfile=${rebuilt}`, `--metafile=${resolve(output, 'proof-build.metafile.json')}`];
    const buildExecutable = resolve(root, 'node_modules/.bin/esbuild');
    const build = spawnSync(buildExecutable, buildArgs, { cwd: root, encoding: 'utf8', timeout: 30_000 });
    writeFileSync(resolve(output, 'proof-build.stdout'), build.stdout ?? '');
    writeFileSync(resolve(output, 'proof-build.stderr'), build.stderr ?? '');
    json(resolve(output, 'proof-build.process.json'), { command: [buildExecutable, ...buildArgs], cwd: root, status: build.status, signal: build.signal, error: build.error?.message ?? null });
    assert.ifError(build.error);
    assert.equal(build.status, 0, 'Adapter rebuild failed; inspect retained build stderr');
    assert.deepEqual(readFileSync(executed), readFileSync(rebuilt), 'Executed adapter bundle does not match the pinned current-source rebuild');
    assert.deepEqual(pinnedSourceFiles(root), sourceFiles, 'Core source changed while binding the executed adapter');
    const final = verifyNativeSession(originalFinal.toString('utf8'), 'original final');
    validateActions(final.archive);
    const projectedInitial = normalizedForCli(final.archive.initial), expectedFinal = normalizedForCli(final.file.game);
    const full = recordActions(projectedInitial, final.archive.actions, 'full projection');
    assert.deepEqual(full.file.replay!.initial, projectedInitial, 'Projected replay changed initial fields beyond controller 0');
    assert.deepEqual(full.file.game, expectedFinal, 'Derived full game differs beyond the explicit controller 0 projection');
    json(resolve(output, 'projected-full.session.json'), full.file);
    let checkpointProof: unknown = null;
    if (originalCheckpoint) {
      const checkpoint = verifyNativeSession(originalCheckpoint.toString('utf8'), 'original pending checkpoint');
      validateActions(checkpoint.archive);
      const suffix = continuationActions(final.archive, checkpoint.archive);
      const remainingTicks = suffix.reduce((sum, action) => sum + (action.type === 'advance' ? action.ticks : 0), 0);
      assert.equal(remainingTicks, final.archive.finalTick - checkpoint.archive.finalTick, 'Checkpoint suffix changes elapsed ticks');
      assert(remainingTicks > 0, 'Pending checkpoint must have subsequent simulation steps');
      const state = loadGame(checkpoint.file.game), pending = pendingShots(state);
      assert(pending.length > 0 && pending.every(shot => shot.impactAt > state.time), 'Checkpoint must contain shells still in flight');
      assert(final.file.game.state.time >= Math.max(...pending.map(shot => shot.impactAt)), 'Final game must continue beyond pending shell impact times');
      const nativeContinuation = recordActions(checkpoint.file.game, suffix, 'unprojected native checkpoint continuation');
      assert.deepEqual(nativeContinuation.file.game, final.file.game, 'Unprojected pending-checkpoint continuation differs from the uninterrupted browser history');
      assert(!pendingShots(loadGame(nativeContinuation.file.game)).some(shot => pending.some(before => before.kind === shot.kind && before.id === shot.id)), 'Checkpoint shells must resolve during continuation');
      const projectedCheckpoint = normalizedForCli(checkpoint.file.game);
      const continued = recordActions(projectedCheckpoint, suffix, 'pending checkpoint projection');
      assert.deepEqual(continued.file.replay!.initial, projectedCheckpoint, 'Projected pending replay changed its initial saved shell state');
      assert.deepEqual(continued.file.game, expectedFinal, 'Projected pending continuation differs beyond controller 0');
      assert.deepEqual(continued.file.game, full.file.game, 'Independent pending continuation differs from uninterrupted projection');
      json(resolve(output, 'checkpoint-suffix.json'), suffix);
      json(resolve(output, 'projected-pending.session.json'), continued.file);
      checkpointProof = { inputSha256: sha256(originalCheckpoint), native: checkpoint.proof, pending, remainingTicks, nativeContinuation: nativeContinuation.proof, projectedContinuation: continued.proof, completeContinuationEnvelopeParity: true };
    }
    assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), head, 'Source commit changed during projection');
    assert.deepEqual(pinnedSourceFiles(root), sourceFiles, 'Core source changed during projection');
    assert.equal(sha256(readFileSync(proofSource)), sha256(readFileSync(resolve(output, 'proof-source.ts'))), 'Adapter source changed during projection');
    const artifacts = readdirSync(output).filter(path => !['projection.json', 'failure.json'].includes(path)).sort().map(path => { const bytes = readFileSync(resolve(output, path)); return { path, bytes: bytes.byteLength, sha256: sha256(bytes) }; });
    const result = { sourcePin: head, saveVersion: SAVE_VERSION, simulationRevision: SIMULATION_REVISION, inputSha256: sha256(originalFinal), proofSourceGitBlob, proofSourceSha256: sha256(readFileSync(proofSource)), proofExecutedSha256: sha256(readFileSync(executed)), normalization: { side: 0, before: final.archive.initial.state.controllers, after: projectedInitial.state.controllers, changedField: 'state.controllers[0]', runtimeProjection: false }, outerPlanning: { originalMetadataRetained: true, projectedSessionsOmitPlanning: true, parityScope: 'Complete game envelope only; outer planning is validated by the native decoder and retained unchanged in original inputs.' }, native: final.proof, projected: { ...full.proof, checksum: full.file.replay!.finalChecksum, completeEnvelopeParityAfterControllerProjection: true }, checkpoint: checkpointProof, artifacts, packagedDriverInputs: ['projected-full.session.json', ...(originalCheckpoint ? ['projected-pending.session.json'] : [])] };
    json(resolve(output, 'projection.json'), result);
    return result;
  } catch (error) {
    json(resolve(output, 'failure.json'), { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : null });
    throw error;
  }
}

function main() {
  const [session, output, sourcePin, ...flags] = process.argv.slice(2);
  assert(session && output && sourcePin, 'Usage: ADAPTER.mjs FINAL_SESSION.json NEW_OUTPUT_DIRECTORY FULL_COMMIT [--checkpoint SESSION.json] [--root REPO]');
  const options: { session: string; output: string; sourcePin: string; checkpoint?: string; root?: string } = { session, output, sourcePin };
  for (let index = 0; index < flags.length; index += 2) {
    assert(flags[index + 1], `${flags[index]} needs a path`);
    if (flags[index] === '--checkpoint') { assert(!options.checkpoint, 'Duplicate checkpoint'); options.checkpoint = flags[index + 1]; }
    else if (flags[index] === '--root') { assert(!options.root, 'Duplicate root'); options.root = flags[index + 1]; }
    else assert.fail(`Unknown argument ${flags[index]}`);
  }
  console.log(JSON.stringify(prepareCombatCliProjection(options)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
