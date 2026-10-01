import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const [sourcePin, inputPath, outputPath, expectedPhase] = process.argv.slice(2);
assert(outputPath && ['fighting', 'recovery'].includes(expectedPhase),
 'Usage: node scripts/modes/reproduce-survival-neutralization.mjs FULL_SOURCE_PIN ORIGINAL_SESSION NEW_OUTPUT_DIR fighting|recovery');
assert.match(sourcePin, /^[0-9a-f]{40}$/);
const git = args => execFileSync('git', args, { maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(['rev-parse', sourcePin]).toString().trim(), sourcePin);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const repository = git(['rev-parse', '--show-toplevel']).toString().trim();
const toolPin = git(['rev-parse', 'HEAD']).toString().trim();
const toolPath = relative(repository, fileURLToPath(import.meta.url));
const toolBytes = await readFile(fileURLToPath(import.meta.url));
assert(toolBytes.equals(git(['show', `${toolPin}:${toolPath}`])), 'Commit the runner before using it');
const configPaths = ['package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'vitest.config.ts', 'index.html', 'editor.html'];
const tracked = git(['ls-tree', '-r', '--name-only', sourcePin, '--', 'src', ...configPaths]).toString().trim().split('\n').sort();
const pinned = {};
for (const path of tracked) {
 const bytes = git(['show', `${sourcePin}:${path}`]);
 pinned[path] = { bytes: bytes.length, sha256: sha(bytes), gitBlob: git(['rev-parse', `${sourcePin}:${path}`]).toString().trim() };
}
const sourceDigest = sha(Object.entries(pinned).map(([path, entry]) => `${path}\0${entry.sha256}\n`).join(''));
const out = resolve(outputPath);
await mkdir(out); // Refuse to overwrite any earlier reproduction, including a failed one.
await writeFile(resolve(out, 'runner.mjs'), toolBytes);
const inputBytes = await readFile(resolve(inputPath));
assert.equal(sha(inputBytes), '1f524adce9f09dcc028bbe5f7d4bee709f8c739977dc4075ddce100a322f4484', 'Use the original failed wave-2 native checkpoint');
await writeFile(resolve(out, 'input.session.json'), inputBytes);
const entry = `export { loadGame, saveGame, SAVE_VERSION } from './src/core/saves';
export { createSessionFile, decodeSessionFile } from './src/core/session-storage';
export { stepGame } from './src/core/simulation';
export { MatchRecorder, ReplayPlayer } from './src/core/replays';
export { isCrewless } from './src/core/tactics';
export { SIMULATION_REVISION } from './src/core/versions';
export const sourceBinding = ${JSON.stringify({ sourcePin, sourceDigest })};`;
const bundleInputs = {};
const bundle = await build({ stdin: { contents: entry, sourcefile: 'public-api.ts', resolveDir: repository, loader: 'ts' },
 bundle: true, platform: 'node', format: 'esm', outfile: resolve(out, 'public-api.mjs'), metafile: true,
 plugins: [{ name: 'git-blobs', setup(builder) {
  builder.onResolve({ filter: /^\./ }, args => {
   const importer = args.namespace === 'git' ? posix.dirname(args.importer) : '';
   const path = posix.normalize(posix.join(importer, args.path));
   assert(pinned[`${path}.ts`], `Runtime import must be a pinned source file: ${path}`);
   return { path: `${path}.ts`, namespace: 'git' };
  });
  builder.onLoad({ filter: /.*/, namespace: 'git' }, args => {
   const bytes = git(['show', `${sourcePin}:${args.path}`]);
   assert.equal(sha(bytes), pinned[args.path].sha256);
   bundleInputs[args.path] = pinned[args.path];
   return { contents: bytes, loader: 'ts' };
  });
 } }] });
await writeFile(resolve(out, 'bundle-meta.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
const core = await import(pathToFileURL(resolve(out, 'public-api.mjs')).href);
assert.deepEqual(core.sourceBinding, { sourcePin, sourceDigest });
assert.equal(core.SAVE_VERSION, 4);
assert.equal(core.SIMULATION_REVISION, expectedPhase === 'fighting' ? '4.0.0' : '4.0.1');
const decoded = core.decodeSessionFile(inputBytes.toString());
assert.equal(decoded.file.replay.simulationRevision, '4.0.0');
// Preserve the old native session as input, but begin new history at its raw game.
// Attaching a 4.0.0 history to a 4.0.1 continuation would misrepresent the rules.
const state = core.loadGame(decoded.file.game), startTick = state.tick;
assert.equal(startTick, 6951);
assert.deepEqual({ wave: state.objectives.survival.wave, phase: state.objectives.survival.phase }, { wave: 2, phase: 'recovery' });
const recorder = new core.MatchRecorder(state);
const resumed = core.decodeSessionFile(core.createSessionFile(state, recorder.export()));
const resumedRecorder = new core.MatchRecorder(resumed.state, resumed.file.replay);
const snapshot = () => structuredClone({ tick: state.tick, ...state.objectives.survival,
 attackers: state.entities.filter(e => state.objectives.survival.spawnedIds.includes(e.id)).map(e => ({
  id: e.id, side: e.side, team: state.teams[e.side], hp: e.hp, role: e.role, definitionId: e.definitionId,
  x: e.x, y: e.y, order: e.order, crew: e.tactics?.siegeCrew, crewless: core.isCrewless(e)
 })),
 defenderHq: state.entities.filter(e => e.role === 'hq' && state.teams[e.side] === state.rules.survival.defenderTeam).map(e => ({ id: e.id, hp: e.hp }))
});
const transitions = []; let prior = '2:recovery', neutralized = null, comparedTicks = 0;
const step = () => {
 core.stepGame(state, .05); core.stepGame(resumed.state, .05); comparedTicks++;
 assert.deepEqual(core.saveGame(resumed.state), core.saveGame(state), `Native continuation diverged at ${state.tick}`);
 const phase = `${state.objectives.survival.wave}:${state.objectives.survival.phase}`;
 if (phase !== prior) { transitions.push(snapshot()); prior = phase; }
};
try {
 for (let i = 0; i < 1000 && !neutralized; i++) {
  step();
  const wave = state.objectives.survival;
  const living = state.entities.filter(e => wave.spawnedIds.includes(e.id) && e.hp > 0 && !e.illusion);
  if (wave.wave === 3 && living.length && living.every(e => core.isCrewless(e))) neutralized = snapshot();
 }
 assert(neutralized, 'The original checkpoint must defeat the real wave-3 crew');
 assert(neutralized.attackers.some(e => e.id === 93 && e.crew?.hp === 0 && e.crewless && e.hp > 0));
 for (let i = 0; i < 100; i++) step();
 assert.equal(state.objectives.survival.phase, expectedPhase);
 assert.equal(state.objectives.survival.wave, 3);
 assert(state.entities.some(e => e.id === 93 && e.hp > 0 && core.isCrewless(e)));
 assert(snapshot().defenderHq.every(e => e.hp > 0));
 assert.deepEqual(resumedRecorder.export(), recorder.export());
 const archive = recorder.export(), replay = new core.ReplayPlayer(archive);
 try {
  replay.advance(state.tick - replay.state.tick);
  assert(replay.finished); assert.deepEqual(core.saveGame(replay.state), core.saveGame(state));
  assert.deepEqual(replay.analysis, archive.analysis); assert.deepEqual(replay.technologyTimings, archive.technologies);
  replay.seek(state.tick); assert.deepEqual(core.saveGame(replay.state), core.saveGame(state));
 } finally { replay.dispose(); }
 await writeFile(resolve(out, 'final.session.json'), JSON.stringify(core.createSessionFile(state, archive)) + '\n');
 const report = { sourcePin, sourceDigest, toolPin, toolPath, toolSha256: sha(toolBytes), input: resolve(inputPath), inputSha256: sha(inputBytes),
  executedBundleSha256: sha(await readFile(resolve(out, 'public-api.mjs'))), saveVersion: core.SAVE_VERSION, simulationRevision: core.SIMULATION_REVISION,
  history: 'New history begins at the original raw SAVE4 wave-2 recovery game; the original 4.0.0 session and history are preserved as input.',
  startTick, finalTick: state.tick, publicStepSeconds: .05, comparedTicks, extraTicks: 100, expectedPhase,
  transitions, neutralized, afterExtraTicks: snapshot(), completeEnvelopesMatchEveryTick: true, recorderHistoriesEqual: true,
  fullReplayEndpointEqual: true, replayAnalysisEqual: true, technologyTimingsEqual: true, endpointSeekEqual: true, pinned, bundleInputs };
 await writeFile(resolve(out, 'reproduction.json'), JSON.stringify(report, null, 2) + '\n');
 console.log(JSON.stringify({ sourcePin, sourceDigest, simulationRevision: core.SIMULATION_REVISION, startTick, finalTick: state.tick,
  comparedTicks, neutralizedTick: neutralized.tick, phase: state.objectives.survival.phase, out }));
} finally { resumedRecorder.dispose(); recorder.dispose(); }
