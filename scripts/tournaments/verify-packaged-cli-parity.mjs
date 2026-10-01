#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { lstat, mkdir, readFile, readdir, readlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createGzip, gunzipSync } from 'node:zlib';
import { build, version as esbuildVersion } from 'esbuild';

// Use a native replay/session JSON (or gzip), or --fixture to generate a modest
// compatible session with the current core. The output directory must be new.
const [inputName, outputName, ...extra] = process.argv.slice(2);
if (!inputName || !outputName || extra.length) throw new Error('Use node scripts/tournaments/verify-packaged-cli-parity.mjs NATIVE_JSON|--fixture NEW_OUTPUT_DIRECTORY.');
const cwd = process.cwd(), output = resolve(outputName), execute = promisify(execFile);
const cli = join(output, 'dist-cli/rts.js'), sessions = [], checks = [];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let sourceBefore, sourceAfter, buildsBefore, buildsAfter, decoded, mainFinal, failure, created = false;

async function bounded(promise, milliseconds, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} exceeded ${milliseconds}ms.`)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
function pass(name, evidence) { checks.push({ name, ...evidence }); console.log(`PASS ${name}`); }
async function json(file, value) { await writeFile(join(output, file), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); }
async function sourceSnapshot() {
  const [head, status, listing] = await Promise.all([
    execute('git', ['rev-parse', 'HEAD'], { cwd }),
    execute('git', ['status', '--porcelain=v1', '-z'], { cwd }),
    execute('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd, maxBuffer: 16 * 1024 * 1024 }),
  ]);
  // Hash every tracked and non-ignored untracked file, including tests, assets,
  // scripts and configuration. Ignored build/evidence output is separate.
  const paths = [...new Set(listing.stdout.split('\0').filter(file => file && file !== 'node_modules' && !file.startsWith('node_modules/')))].sort();
  const files = {}, digest = createHash('sha256');
  for (const file of paths) {
    const location = join(cwd, file), stat = await lstat(location);
    const target = stat.isSymbolicLink() ? await readlink(location) : undefined;
    const bytes = target === undefined ? await readFile(location) : Buffer.from(target);
    files[file] = { sha256: sha256(bytes), bytes: bytes.length, ...(target === undefined ? {} : { symlink: target }) };
    digest.update(file).update('\0').update(bytes).update('\0');
  }
  return { head: head.stdout.trim(), workingTree: status.stdout, sha256: digest.digest('hex'), excludedDependencyDirectory: 'node_modules', files };
}
async function buildSnapshot() {
  const files = {};
  async function walk(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) { const bytes = await readFile(file); files[relative(output, file)] = { sha256: sha256(bytes), bytes: bytes.length }; }
    }
  }
  await walk(join(output, 'dist-cli')); await walk(join(output, 'reference'));
  return files;
}
async function buildCli() {
  const manifest = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8'));
  assert.match(manifest.scripts['build:cli'], /esbuild src\/cli\/main\.ts/,
    'Update the verifier for this production CLI build script.');
  const args = ['run', 'build:cli', '--', `--outfile=${cli}`, `--metafile=${join(output, 'dist-cli/metafile.json')}`];
  const child = spawn('npm', args, { cwd, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  const stdout = pipeline(child.stdout, createWriteStream(join(output, 'cli-build.stdout.log')));
  const stderr = pipeline(child.stderr, createWriteStream(join(output, 'cli-build.stderr.log')));
  const closed = new Promise((resolveExit, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolveExit({ code, signal })); });
  let result;
  try { result = await bounded(closed, 180000, 'Production CLI build'); }
  catch (error) {
    if (process.platform !== 'win32' && child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch (killError) { if (killError.code !== 'ESRCH') throw killError; } }
    else child.kill('SIGKILL');
    await bounded(closed, 5000, 'Build cleanup').catch(() => {}); throw error;
  } finally { await Promise.all([stdout, stderr]); }
  await json('cli-build-command.json', { command: 'npm', args, cwd, ...result });
  assert.equal(result.code, 0, `Production CLI build failed: ${result.code ?? result.signal}.`);
}

class CliProcess {
  constructor(name) {
    this.name = name; this.requests = 0; this.pending = undefined; this.fatal = undefined;
    this.logPath = join(output, `${name}.cli-log.ndjson`);
    this.child = spawn(process.execPath, [cli, '--log', this.logPath], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    this.input = createGzip(); this.inputDone = pipeline(this.input, createWriteStream(join(output, `${name}.stdin.ndjson.gz`)));
    this.stdoutDone = pipeline(this.child.stdout, createGzip(), createWriteStream(join(output, `${name}.stdout.ndjson.gz`)));
    this.stderrDone = pipeline(this.child.stderr, createWriteStream(join(output, `${name}.stderr.log`)));
    // Retain rejection handlers immediately, including spawn/early-exit failures.
    for (const promise of [this.inputDone, this.stdoutDone, this.stderrDone]) promise.catch(error => this.fail(error));
    this.lines = createInterface({ input: this.child.stdout, crlfDelay: Infinity });
    this.lines.on('line', line => {
      if (!this.pending) { this.fail(new Error(`${name} emitted an unsolicited stdout line.`)); return; }
      const pending = this.pending; this.pending = undefined;
      try { pending.resolve(JSON.parse(line)); } catch (error) { pending.reject(new Error(`${name} returned non-JSON stdout: ${error.message}`)); }
    });
    this.closed = new Promise(resolveExit => {
      this.child.once('error', error => { this.fail(error); resolveExit({ code: null, signal: null, error: error.message }); });
      this.child.once('close', (code, signal) => { this.fail(new Error(`${name} exited with a pending request (${code ?? signal}).`), false); resolveExit({ code, signal }); });
    });
    sessions.push(this);
  }
  fail(error, always = true) {
    if (always || this.pending) this.fatal ??= error;
    if (this.pending) { this.pending.reject(error); this.pending = undefined; }
  }
  async request(input, expectedOk = true) {
    if (this.fatal) throw this.fatal;
    assert(!this.pending, 'CLI requests must be sequential.');
    const line = JSON.stringify(input) + '\n';
    await new Promise((done, reject) => this.input.write(line, error => error ? reject(error) : done()));
    const response = new Promise((resolveReply, reject) => { this.pending = { resolve: resolveReply, reject }; });
    this.child.stdin.write(line, error => { if (error) this.fail(error); }); this.requests++;
    let reply;
    try { reply = await bounded(response, 30000, `${this.name} request ${this.requests} (${input.op})`); }
    catch (error) { this.fail(error); this.child.kill('SIGKILL'); throw error; }
    assert.equal(reply?.ok, expectedOk, `${this.name} ${input.op}: ${reply?.error ?? 'Unexpected protocol response.'}`);
    return expectedOk ? reply.result : reply;
  }
  async close() {
    if (this.closeResult) return this.closeResult;
    this.child.stdin.end(); this.input.end();
    let status;
    try { status = await bounded(this.closed, 10000, `${this.name} shutdown`); }
    catch (error) { this.child.kill('SIGKILL'); await bounded(this.closed, 5000, `${this.name} forced shutdown`).catch(() => {}); throw error; }
    finally { await Promise.all([this.inputDone, this.stdoutDone, this.stderrDone]); }
    this.closeResult = { ...status, requests: this.requests };
    await json(`${this.name}.process.json`, this.closeResult);
    assert.equal(status.code, 0, `${this.name} failed on exit (${status.code ?? status.signal ?? status.error}).`);
    assert.equal(await readFile(join(output, `${this.name}.stderr.log`), 'utf8'), '', `${this.name} wrote unexpected stderr.`);
    if (this.fatal) throw this.fatal;
    return this.closeResult;
  }
}

function nativeFingerprint(save) {
  const text = JSON.stringify(save); let checksum = 2166136261;
  for (let index = 0; index < text.length; index++) { checksum ^= text.charCodeAt(index); checksum = Math.imul(checksum, 16777619); }
  return { sha256: sha256(text), checksum: (checksum >>> 0).toString(16).padStart(8, '0'), bytes: Buffer.byteLength(text) };
}

try {
  if (!relative(cwd, output).startsWith('..') && !relative(cwd, output).startsWith('/')) {
    await execute('git', ['check-ignore', '-q', output], { cwd }).catch(() => { throw new Error('An output directory inside the checkout must be Git-ignored so the complete source manifest cannot include generated evidence.'); });
  }
  await mkdir(dirname(output), { recursive: true }); await mkdir(output); created = true;
  sourceBefore = await sourceSnapshot(); await json('source-before.json', sourceBefore);
  await mkdir(join(output, 'dist-cli')); await mkdir(join(output, 'reference'));
  await json('dist-cli/package.json', { type: 'module' });
  await buildCli();
  const reference = join(output, 'reference/core.mjs');
  const bundled = await build({ entryPoints: [join(cwd, 'scripts/tournaments/packaged-cli-entry.ts')], bundle: true, platform: 'node', format: 'esm', outfile: reference, metafile: true });
  await json('reference/metafile.json', bundled.metafile);
  buildsBefore = await buildSnapshot(); await json('builds-before.json', buildsBefore);
  assert.deepEqual(await sourceSnapshot(), sourceBefore, 'Source or HEAD changed during compilation.');
  const core = await import(pathToFileURL(reference).href);
  const bytes = inputName === '--fixture' ? Buffer.from(JSON.stringify(core.generateFixture())) : await readFile(resolve(inputName));
  const inputBytes = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
  await writeFile(join(output, 'input.native.json'), inputBytes, { flag: 'wx' });
  await json('input-manifest.json', { input: inputName, fileSha256: sha256(bytes), fileBytes: bytes.length, jsonSha256: sha256(inputBytes), jsonBytes: inputBytes.length });
  decoded = core.decodeInput(JSON.parse(inputBytes.toString('utf8')));
  const { archive, side, finalSave } = decoded;
  await json('versions.json', { save: core.SAVE_VERSION, simulationRevision: core.SIMULATION_REVISION, archiveInitialVersion: archive.initial.version, archiveRevision: archive.simulationRevision, controlledSide: side, node: process.version, esbuild: esbuildVersion });
  const comparisons = [];
  async function compare(process, state, label, retain) {
    const received = await process.request({ op: 'save' }), expected = core.snapshot(state);
    const cliHash = nativeFingerprint(received), referenceHash = nativeFingerprint(expected.save);
    if (JSON.stringify(received) !== JSON.stringify(expected.save)) {
      await json(`${process.name}.divergence-cli.json`, received); await json(`${process.name}.divergence-core.json`, expected.save);
      throw new Error(`Complete native save differs at ${label}, tick ${state.tick}.`);
    }
    assert.equal(cliHash.checksum, expected.checksum, `Native CLI checksum differs at ${label}.`);
    comparisons.push({ process: process.name, label, tick: state.tick, ...cliHash, coreSha256: referenceHash.sha256, coreChecksum: expected.checksum });
    if (retain) { await json(`${process.name}.${retain}.cli-save.json`, received); await json(`${process.name}.${retain}.core-save.json`, expected.save); }
    return received;
  }
  const main = new CliProcess('main'); let state = decoded.state;
  await main.request({ op: 'load', side, save: archive.initial });
  await compare(main, state, 'initial load/resave', 'initial');
  const middleTick = archive.initial.state.tick + Math.floor((archive.finalTick - archive.initial.state.tick) / 2);
  let checkpoint = { save: core.saveGame(state), actionIndex: 0, tickOffset: 0 };
  let checkpointChosen = middleTick === state.tick;
  if (checkpointChosen) await json('continuation-checkpoint.json', checkpoint);
  for (const [actionIndex, action] of archive.actions.entries()) {
    if (action.type === 'command') {
      assert.equal(action.side, side);
      assert(core.issueCommand(state, side, action.command), `Reference command rejected at tick ${state.tick}.`);
      const response = await main.request({ op: 'command', command: action.command });
      assert.equal(response.accepted, true, `CLI command rejected at tick ${state.tick}.`); assert.equal(response.tick, state.tick);
      await compare(main, state, `command ${actionIndex}`, `command-${actionIndex}`);
    } else {
      for (let tickOffset = 0; tickOffset < action.ticks; tickOffset++) {
        const before = state.tick; core.stepGame(state, action.dt); assert.equal(state.tick, before + 1, 'Reference replay ended early.');
        const response = await main.request({ op: 'advance', ticks: 1 });
        assert.equal(response.advanced, 1, `CLI replay ended early at tick ${before}.`); assert.equal(response.observation.tick, state.tick);
        const save = await compare(main, state, `tick ${state.tick}`);
        if ((state.tick - archive.initial.state.tick) % 1200 === 0) console.log(`Checked packaged CLI tick ${state.tick}.`);
        if (!checkpointChosen && state.tick >= middleTick) {
          checkpoint = { save, actionIndex, tickOffset: tickOffset + 1 }; checkpointChosen = true;
          await json('continuation-checkpoint.json', checkpoint);
        }
      }
    }
  }
  // Do not skip command-only actions at the final tick.
  assert.equal(state.tick, archive.finalTick, 'Reference final tick differs from the archive.');
  mainFinal = await compare(main, state, 'final', 'final');
  assert.equal(core.replayChecksum(state), archive.finalChecksum, 'Replay final checksum differs from its native archive.');
  if (finalSave) assert.equal(JSON.stringify(mainFinal), JSON.stringify(finalSave), 'CLI final save differs from the native session game.');
  pass('packaged CLI and direct core agree on every tick and accepted command', { initialTick: archive.initial.state.tick, finalTick: state.tick, ticksChecked: state.tick - archive.initial.state.tick, commandsChecked: archive.actions.filter(action => action.type === 'command').length, finalChecksum: archive.finalChecksum, finalSha256: nativeFingerprint(mainFinal).sha256, nativeSessionFinalEqual: !!finalSave });
  await main.close();

  const resumed = new CliProcess('continuation'); state = core.loadGame(checkpoint.save);
  await resumed.request({ op: 'load', side, save: checkpoint.save });
  await compare(resumed, state, 'checkpoint load/resave', 'initial');
  const batches = [];
  for (let actionIndex = checkpoint.actionIndex; actionIndex < archive.actions.length; actionIndex++) {
    const action = archive.actions[actionIndex];
    if (action.type === 'command') {
      assert(core.issueCommand(state, side, action.command), `Continuation core command rejected at tick ${state.tick}.`);
      const response = await resumed.request({ op: 'command', command: action.command }); assert.equal(response.accepted, true); assert.equal(response.tick, state.tick);
      await compare(resumed, state, `continuation command ${actionIndex}`);
    } else {
      const offset = actionIndex === checkpoint.actionIndex ? checkpoint.tickOffset : 0;
      for (let remaining = action.ticks - offset; remaining > 0;) {
        const ticks = Math.min(1200, remaining), before = state.tick;
        for (let index = 0; index < ticks; index++) core.stepGame(state, action.dt);
        assert.equal(state.tick, before + ticks, 'Saved continuation ended early in the core.');
        const response = await resumed.request({ op: 'advance', ticks }); assert.equal(response.advanced, ticks); assert.equal(response.observation.tick, state.tick);
        await compare(resumed, state, `continuation batch ${before}-${state.tick}`); batches.push({ from: before, to: state.tick, ticks }); remaining -= ticks;
      }
    }
  }
  const resumedFinal = await compare(resumed, state, 'continuation final', 'final');
  assert.equal(JSON.stringify(resumedFinal), JSON.stringify(mainFinal), 'Saved continuation differs from uninterrupted playback.');
  const result = await resumed.request({ op: 'result' }); assert.equal(result.tick, state.tick); assert.equal(result.finished, core.isGameOver(state));
  // Malformed public requests must report errors without changing the loaded state.
  const badAdvance = await resumed.request({ op: 'advance', ticks: 1201 }, false); assert.match(badAdvance.error, /1200/);
  const badCommand = await resumed.request({ op: 'command', command: { type: 'not-a-command' } }, false); assert.match(badCommand.error, /Malformed command/);
  await compare(resumed, state, 'rejected requests leave state unchanged');
  await resumed.close();
  pass('fresh packaged CLI reload and batched continuation agree with uninterrupted playback', { checkpointTick: checkpoint.save.state.tick, finalTick: state.tick, batches, maximumRequestTicks: Math.max(0, ...batches.map(batch => batch.ticks)), finalResult: result, rejectedRequestsPreserveState: true });
  await json('comparisons.json', comparisons);
  sourceAfter = await sourceSnapshot(); buildsAfter = await buildSnapshot();
  await json('source-after.json', sourceAfter); await json('builds-after.json', buildsAfter);
  assert.deepEqual(sourceAfter, sourceBefore, 'Source, working tree or HEAD changed during verification.');
  assert.deepEqual(buildsAfter, buildsBefore, 'Packaged CLI or reference build changed during verification.');
  pass('all checkout files, HEAD and fresh builds remain unchanged', { files: Object.keys(sourceBefore.files).length, sourceSha256: sourceBefore.sha256, head: sourceBefore.head });
} catch (error) { failure = error; }
finally {
  const cleanup = await Promise.allSettled(sessions.map(session => session.close()));
  const cleanupErrors = cleanup.filter(result => result.status === 'rejected').map(result => result.reason.message);
  if (!failure && cleanupErrors.length) failure = new Error(`CLI cleanup failed: ${cleanupErrors.join('; ')}`);
  // Retain a failing result as well as protocol and divergence evidence.
  if (created) await writeFile(join(output, 'result.json'), JSON.stringify({ status: failure ? 'failed' : 'passed', generatedAt: new Date().toISOString(), cwd, output, input: inputName, checks, source: sourceBefore ? { head: sourceBefore.head, sha256: sourceBefore.sha256, workingTree: sourceBefore.workingTree, files: Object.keys(sourceBefore.files).length } : undefined, builds: buildsBefore, cleanupErrors, ...(failure ? { error: failure.stack ?? String(failure) } : {}), method: 'Build the production CLI using build:cli into a fresh dist-cli/rts.js, spawn it twice, send public JSON load/command/advance/save/result requests over stdin, compare complete native save JSON and checksum with a separately bundled direct-core reference every tick and command, then load a saved midpoint and continue in requests of at most 1200 ticks. Retain raw public stdin/stdout as gzip, CLI hash logs, process exits, native checkpoints and full source/build manifests.', limits: ['Public CLI load changes human controllers and sets the controlled side to external; this full-save verifier rejects those incompatible archives.', 'Only commands for one controlled external side and 0.05-second ticks are supported.', 'The generated fixture is a short economy and recruitment run, not a natural victory or a full tournament.', 'This verifier executes the packaged CLI. Browser/Node helper parity remains a separate check.'] }, null, 2) + '\n', { flag: 'wx' });
}
if (failure) throw failure;
console.log(`Evidence: ${join(output, 'result.json')}`);
