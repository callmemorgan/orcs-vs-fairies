import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { decodeSessionFile, createSessionFile } from '../../src/core/session-storage';
import { MatchRecorder, ReplayPlayer, replayChecksum } from '../../src/core/replays';
import type { ReplayArchive } from '../../src/core/replays';
import { saveGame, SAVE_VERSION } from '../../src/core/saves';
import { isGameOver, isVisible, issueCommand, stepGame } from '../../src/core/simulation';
import { segmentWalkable } from '../../src/core/navigation';
import { isCrewless } from '../../src/core/tactics';
import { SIMULATION_REVISION } from '../../src/core/versions';
import type { Command, Entity, GameState, Side, Vec } from '../../src/core/types';

// Required esbuild --define values bind the executed bundle to its build inputs.
declare const __OVF_PROOF_PIN__: string | undefined;
declare const __OVF_PROOF_SOURCE_DIGEST__: string | undefined;
const embeddedPin = typeof __OVF_PROOF_PIN__ === 'undefined' ? undefined : __OVF_PROOF_PIN__;
const embeddedDigest = typeof __OVF_PROOF_SOURCE_DIGEST__ === 'undefined' ? undefined : __OVF_PROOF_SOURCE_DIGEST__;
const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const hashJson = (value: unknown) => sha256(JSON.stringify(value));
const inputPath = process.argv[2], outputPath = process.argv[3], sourcePin = process.argv[4];
const gamepadPath = process.argv[5];
assert(inputPath && outputPath && sourcePin, 'Usage: node verify-native.mjs <native-session.json> <output.json> <full-HEAD-pin> [gamepad-browser-proof.json]');
assert.match(sourcePin, /^[0-9a-f]{40}$/, 'Pass the full Git commit, not a short ref');
const repository = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const git = (...args: string[]) => execFileSync('git', ['-C', repository, ...args], { maxBuffer: 32 * 1024 * 1024 });
const CONFIG_PATHS = ['package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'vitest.config.ts', 'index.html', 'editor.html'];

function actualSourcePaths(directory: string, prefix = 'src'): string[] {
  assert(!lstatSync(directory).isSymbolicLink(), `Source directory must not be a symlink: ${prefix}`);
  return readdirSync(directory).sort().flatMap(name => {
    const path = join(directory, name), relative = `${prefix}/${name}`, stat = lstatSync(path);
    assert(!stat.isSymbolicLink(), `Source files must not be symlinks: ${relative}`);
    return stat.isDirectory() ? actualSourcePaths(path, relative) : [relative];
  });
}

function sourceProvenance() {
  const head = git('rev-parse', 'HEAD').toString().trim();
  assert.equal(head, sourcePin, 'The requested source pin must be this checkout HEAD');
  const entries = git('ls-tree', '-r', '-z', head).toString().split('\0').filter(Boolean).map(entry => {
    const [metadata, path] = entry.split('\t'), [mode, kind, blob] = metadata.split(' ');
    return { path, mode, kind, blob };
  }).filter(entry => entry.path.startsWith('src/') || CONFIG_PATHS.includes(entry.path));
  const sourcePaths = entries.filter(entry => entry.path.startsWith('src/')).map(entry => entry.path).sort();
  assert.deepEqual(actualSourcePaths(join(repository, 'src')).sort(), sourcePaths, 'Missing or extra source files invalidate provenance');
  const configPaths = entries.filter(entry => CONFIG_PATHS.includes(entry.path)).map(entry => entry.path).sort();
  assert.deepEqual(configPaths, [...CONFIG_PATHS].sort(), 'Every required build input must be committed');
  const files = entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0).map(entry => {
    const path = join(repository, entry.path), stat = lstatSync(path);
    assert(stat.isFile() && !stat.isSymbolicLink(), `Expected a regular source/config file: ${entry.path}`);
    assert(entry.kind === 'blob' && ['100644', '100755'].includes(entry.mode), `Unexpected Git file type: ${entry.path}`);
    const bytes = readFileSync(path), committed = git('cat-file', 'blob', entry.blob);
    assert(bytes.equals(committed), `Source/config bytes differ from ${head}: ${entry.path}`);
    return { path: entry.path, bytes: bytes.length, sha256: sha256(bytes), gitBlob: entry.blob, bytesMatchGit: true };
  });
  const digest = sha256(files.map(file => `${file.path}\0${file.sha256}\n`).join(''));
  const buildHash = createHash('sha256');
  for (const path of sourcePaths.filter(path => /\.(ts|css)$/.test(path))) {
    buildHash.update(path.slice('src/'.length)); buildHash.update(readFileSync(join(repository, path)));
  }
  return { sourcePin: head, sourceFileCount: sourcePaths.length, configFileCount: configPaths.length, digest, buildId: buildHash.digest('hex'), files };
}

const beforeSource = sourceProvenance();
assert(embeddedPin && embeddedDigest, 'Rebundle with esbuild __OVF_PROOF_PIN__ and __OVF_PROOF_SOURCE_DIGEST__ defines');
assert.equal(embeddedPin, sourcePin, 'The verifier bundle was built for another pin');
assert.equal(embeddedDigest, beforeSource.digest, 'The verifier bundle was built from different source/config bytes');

const inputBytes = readFileSync(inputPath), input = JSON.parse(inputBytes.toString('utf8'));
assert.equal(input.game?.version, SAVE_VERSION, 'Export a fresh native game from the current save schema');
assert(input.replay, 'Native session must include recorder history');
assert.equal(input.replay.initial?.version, SAVE_VERSION);
assert.equal(input.replay.checksumVersion, SAVE_VERSION);
assert.equal(input.replay.simulationRevision, SIMULATION_REVISION, 'Replay must explicitly use the current simulation rules');
const decoded = decodeSessionFile(inputBytes.toString('utf8'));
assert.deepEqual(decoded.file.game, input.game, 'Decoder must preserve the complete raw game envelope');
assert.deepEqual(saveGame(decoded.state), input.game, 'Loaded game must resave to the complete raw envelope');
const schemaRecorder = new MatchRecorder(decoded.state);
let currentReplay: ReplayArchive;
try { currentReplay = schemaRecorder.export(); } finally { schemaRecorder.dispose(); }
const currentSession = createSessionFile(decoded.state, currentReplay);
assert.equal(input.format, currentSession.format); assert.equal(input.version, currentSession.version);
assert.equal(input.replay.format, currentReplay.format); assert.equal(input.replay.version, currentReplay.version);
const replay = new ReplayPlayer(input.replay);
const initialTick = replay.state.tick;
try {
  const advanced = replay.advance(input.replay.finalTick - initialTick);
  assert(replay.finished, 'Playback must consume every recorded command and step');
  assert.equal(replay.state.tick, input.game.state.tick);
  assert.equal(replayChecksum(replay.state), input.replay.finalChecksum);
  assert.deepEqual(saveGame(replay.state), input.game, 'Full replay endpoint must match the raw exported envelope');
  assert.deepEqual(replay.analysis, input.replay.analysis, 'Recorded analysis must match recomputed replay analysis');
  assert.deepEqual(replay.technologyTimings, input.replay.technologies, 'Recorded technologies must match playback');
  const endpoint = replay.state;
  replay.dispose();

  const commandEntries = (input.replay.actions as ReplayArchive['actions']).flatMap((action, replayActionIndex) => action.type === 'command' ? [{ replayActionIndex, ...action }] : []);
  const commands = commandEntries.map(entry => entry.command);
  let gamepad: Record<string, unknown> | undefined;
  if (gamepadPath) {
    const sidecarBytes = readFileSync(gamepadPath), sidecar = JSON.parse(sidecarBytes.toString('utf8'));
    assert.equal(sidecar.result, 'passed', 'Gamepad browser sidecar must record a passing run');
    assert.equal(sidecar.sourcePin, sourcePin, 'Gamepad sidecar must name this source pin');
    assert.equal(sidecar.final?.tick, input.game.state.tick, 'Gamepad sidecar and native export must end at the same tick');
    assert.deepEqual(commandEntries, sidecar.commands, 'Accepted native actions, sides and replay indices must equal captured browser commands');
    assert(commandEntries.every(entry => entry.side === 0), 'Controller actions must belong to the player side');
    assert.equal(commands.length, 6, 'Gamepad proof must preserve all six controller commands');
    assert.deepEqual(commands.map(command => command.type), ['hold', 'stop', 'move', 'move', 'hold', 'stop']);
    const firstMove = commands[2], queuedMove = commands[3];
    assert(firstMove.type === 'move' && !firstMove.queued);
    assert(queuedMove.type === 'move' && queuedMove.queued === true);
    const first = commands[0]; assert('ids' in first && first.ids.length === 1);
    const workerId = first.ids[0];
    assert(commands.every(value => 'ids' in value && value.ids.length === 1 && value.ids[0] === workerId), 'All six controller commands must address the same selected worker');
    assert(input.game.state.entities.some((entity: Entity) => entity.id === workerId && entity.side === 0 && entity.kind === 'unit' && entity.role === 'worker'), 'Controller target must be the player worker');
    gamepad = { path: gamepadPath, sha256: sha256(sidecarBytes), acceptedCommandCount: commands.length, workerId, acceptedActionsSidesAndIndicesEqualBrowser: true, holdStopMoveQueuedSequencePassed: true, inputMethod: sidecar.method };
  }

  assert(!isGameOver(decoded.state), 'Continuation proof requires an unfinished native match');
  assert.equal(decoded.state.draft.status, 'complete', 'Continuation commands require a completed draft');
  const actorCandidates = decoded.state.entities.filter(entity => entity.kind === 'unit' && entity.hp > 0 && !entity.illusion && !isCrewless(entity) && !decoded.state.eliminated[entity.side])
    .sort((a, b) => Number(decoded.state.controllers[b.side] === 'human') - Number(decoded.state.controllers[a.side] === 'human') || a.id - b.id);
  const offsets = [[1.5, 0], [0, 1.5], [-1.5, 0], [0, -1.5], [1.5, 1.5], [-1.5, -1.5]];
  let actor: Entity | undefined, destinations: Vec[] = [];
  for (const candidate of actorCandidates) {
    const points = offsets.map(([dx, dy]) => ({ x: candidate.x + dx, y: candidate.y + dy, level: candidate.level ?? 0 }))
      .filter(point => isVisible(decoded.state, candidate.side, point.x, point.y, point.level) && segmentWalkable(decoded.state, candidate, point));
    const pair = points.flatMap((first, index) => points.slice(index + 1).filter(second => segmentWalkable(decoded.state, first, second)).map(second => [first, second])).at(0);
    if (pair) { actor = candidate; destinations = pair; break; }
  }
  assert(actor, 'Continuation proof needs a living unit with two visible walkable destinations');
  const actorId = actor.id, side = actor.side as Side;
  const loadedRecorder = new MatchRecorder(decoded.state, decoded.file.replay);
  const endpointRecorder = new MatchRecorder(endpoint, decoded.file.replay);
  const continuationCommands: Command[] = [], checkpointHashes: Array<{ phase: string; tick: number; gameSha256: string }> = [];
  let continuedTicks = 0, movingTicks = 0, maxDisplacement = 0;
  let moveStart: { x: number; y: number } | undefined;
  const compare = (phase: string, record = false) => {
    const loaded = saveGame(decoded.state), played = saveGame(endpoint);
    assert.deepEqual(loaded, played, `Loaded and replayed continuation differ at ${phase}, tick ${decoded.state.tick}`);
    assert.deepEqual(loadedRecorder.export(), endpointRecorder.export(), `Continued recorder histories differ at ${phase}`);
    const recordedCommands = loadedRecorder.export().actions.filter(action => action.type === 'command');
    const expectedCommands = [
      ...decoded.file.replay!.actions.filter(action => action.type === 'command'),
      ...continuationCommands.map(value => ({ type: 'command' as const, side, command: value })),
    ];
    assert.deepEqual(recordedCommands, expectedCommands, `Every accepted continuation command must remain recorded at ${phase}`);
    if (record) checkpointHashes.push({ phase, tick: decoded.state.tick, gameSha256: hashJson(loaded) });
  };
  const command = (value: Command) => {
    assert(issueCommand(decoded.state, side, value), `Loaded branch rejected continuation ${value.type}`);
    assert(issueCommand(endpoint, side, value), `Replay branch rejected continuation ${value.type}`);
    continuationCommands.push(value); compare(`command-${continuationCommands.length}-${value.type}`, true);
  };
  const steps = (count: number, phase: string) => {
    for (let index = 0; index < count; index++) {
      assert(!isGameOver(decoded.state), `Match ended before the planned continuation at ${phase}`);
      const before = decoded.state.tick;
      stepGame(decoded.state, .05); stepGame(endpoint, .05);
      assert.equal(decoded.state.tick, before + 1, 'Natural core step must advance the loaded match');
      assert.equal(endpoint.tick, before + 1, 'Natural core step must advance the replay endpoint');
      continuedTicks++;
      const moved = decoded.state.entities.find(entity => entity.id === actorId);
      if (phase === 'moving') {
        assert(moveStart); movingTicks++;
        if (moved) maxDisplacement = Math.max(maxDisplacement, Math.hypot(moved.x - moveStart.x, moved.y - moveStart.y));
      }
      compare(`${phase}-${index + 1}`);
    }
    compare(phase, true);
  };
  let extended: ReplayArchive;
  try {
    command({ type: 'hold', ids: [actorId] }); steps(5, 'held');
    command({ type: 'stop', ids: [actorId] }); steps(5, 'stopped');
    const movingActor = decoded.state.entities.find(entity => entity.id === actorId);
    assert(movingActor); moveStart = { x: movingActor.x, y: movingActor.y };
    command({ type: 'move', ids: [actorId], ...destinations[0], queued: false });
    const beforeQueue = decoded.state.entities.find(entity => entity.id === actorId)?.orderQueue?.length ?? 0;
    command({ type: 'move', ids: [actorId], ...destinations[1], queued: true });
    assert.equal(decoded.state.entities.find(entity => entity.id === actorId)?.orderQueue?.length, beforeQueue + 1, 'Queued movement must add a real order');
    steps(60, 'moving');
    assert(maxDisplacement > .01, 'Accepted continuation movement must move the actor during natural steps');
    command({ type: 'hold', ids: [actorId] }); steps(5, 'held-again');
    command({ type: 'stop', ids: [actorId] }); steps(25, 'stopped-again');
    extended = loadedRecorder.export();
    assert.deepEqual(extended, endpointRecorder.export());
    assert.equal(extended.initial.version, SAVE_VERSION);
    assert.equal(extended.checksumVersion, SAVE_VERSION);
    assert.equal(extended.simulationRevision, SIMULATION_REVISION);
    for (const archive of [extended, endpointRecorder.export()]) {
      const continuedReplay = new ReplayPlayer(archive);
      try {
        continuedReplay.advance(archive.finalTick - continuedReplay.state.tick);
        assert(continuedReplay.finished);
        assert.deepEqual(saveGame(continuedReplay.state), saveGame(decoded.state), 'Extended replay must reproduce the full continued envelope');
        assert.deepEqual(continuedReplay.analysis, archive.analysis);
        assert.deepEqual(continuedReplay.technologyTimings, archive.technologies);
      } finally { continuedReplay.dispose(); }
    }
  } finally { loadedRecorder.dispose(); endpointRecorder.dispose(); }

  const afterSource = sourceProvenance();
  assert.deepEqual(afterSource, beforeSource, 'Source/config provenance must remain unchanged throughout verification');
  const checkerScriptPath = 'scripts/controls-proof/verify-native.ts';
  const result = {
    result: 'passed', sourcePin, inputPath, inputSha256: sha256(inputBytes),
    checkerScriptPath, checkerScriptSha256: sha256(readFileSync(join(repository, checkerScriptPath))),
    executedBundlePath: resolve(process.argv[1]), executedBundleSha256: sha256(readFileSync(process.argv[1])),
    sourceProvenance: beforeSource, sourceUnchangedDuringVerification: true,
    bundleSourceBindingPassed: true,
    saveVersion: SAVE_VERSION, simulationRevision: SIMULATION_REVISION,
    sessionVersion: currentSession.version, replayVersion: currentReplay.version, replayChecksumVersion: currentReplay.checksumVersion,
    nativeDecoderPassed: true, completeEnvelopeRoundtripPassed: true, completeReplayEnvelopePassed: true,
    initialTick, advanced, finalTick: input.game.state.tick, checksum: input.replay.finalChecksum, gameEnvelopeSha256: hashJson(input.game),
    recomputedAnalysisPassed: true, technologyTimingsPassed: true, acceptedCommands: commands, acceptedCommandEntries: commandEntries, gamepad,
    continuation: { completeEnvelopeEqualityPassed: true, recorderEqualityPassed: true, allAcceptedContinuationCommandsRecorded: true, extendedReplayEqualityPassed: true,
      startTick: input.game.state.tick, finalTick: decoded.state.tick, advancedTicks: continuedTicks, timestep: .05,
      actorId, side, commands: continuationCommands, movementStart: moveStart, movementPhaseTicks: movingTicks, maxActorDisplacement: maxDisplacement,
      finalChecksum: replayChecksum(decoded.state), extendedReplaySha256: hashJson(extended), checkpointHashes },
    limits: ['This verifies native data and deterministic core continuation; browser controls and physical controller hardware require separate evidence.'],
  };
  mkdirSync(dirname(resolve(outputPath)), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ result: result.result, sourcePin, saveVersion: SAVE_VERSION, simulationRevision: SIMULATION_REVISION, finalTick: result.finalTick, continuedTicks, bundleSourceBindingPassed: result.bundleSourceBindingPassed, outputPath }));
} finally { replay.dispose(); }
