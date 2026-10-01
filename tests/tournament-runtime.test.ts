import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer, request as nodeRequest, type IncomingMessage } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { stateHash } from '../src/cli/session';
import { PlayerView } from '../src/core/observation';
import { decodeReplay, ReplayPlayer } from '../src/core/replays';
import { createMatch } from '../src/core/simulation';
import { decodeTournamentReport, tournamentMatchConfig, verifyTournamentReport } from '../src/tournament/report';
import { runTournament } from '../src/tournament/runner';
import { createTournamentService } from '../src/tournament/service';
import type { AgentTurn, TournamentAgent, TournamentConfig, TournamentProgress, TournamentReport } from '../src/tournament/types';

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const builtinScript = 'scripts/agents/tournament-agent.mjs';
const cleanup: Array<() => Promise<unknown>> = [];
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const hash = (value: unknown) => sha256(JSON.stringify(value));
const pause = (milliseconds: number) => new Promise<void>(resolvePause => setTimeout(resolvePause, milliseconds));

afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!();
});

function builtin(id: string, faction: TournamentAgent['faction'], style = 'idle'): TournamentAgent {
  return { id, name: id, faction, command: [process.execPath, builtinScript, '--style', style], sourceFiles: [builtinScript] };
}

function config(overrides: Partial<TournamentConfig> = {}): TournamentConfig {
  return {
    version: 1, id: 'runtime', name: 'Runtime integration',
    agents: [builtin('alpha', 'orcs'), builtin('beta', 'fairies')],
    seeds: [4127], mapSize: 'small', bothSeats: false, maxSeconds: 1,
    decisionTicks: 10, responseTimeoutMs: 1000, maxCommandsPerTurn: 64,
    startingAge: 1, startingResources: { wood: 420, ore: 220, crystal: 0 },
    ...overrides,
  };
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ovf-tournament-runtime-'));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function fixture(directory: string, name: string, source: string): Promise<TournamentAgent> {
  const file = join(directory, `${name}.mjs`);
  await writeFile(file, source);
  return { id: name, name, faction: 'orcs', command: [process.execPath, file], sourceFiles: [file] };
}

function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
}

function expectChildrenExited(report: TournamentReport) {
  for (const match of report.matches) for (const agent of match.agents) {
    expect(agent.pid).toBeTypeOf('number');
    expect(alive(agent.pid!)).toBe(false);
    expect(agent.exitCode !== null || agent.exitSignal !== null).toBe(true);
  }
}

async function waitFor<T>(read: () => Promise<T>, ready: (value: T) => boolean, milliseconds = 10000): Promise<T> {
  const deadline = Date.now() + milliseconds;
  do {
    const value = await read();
    if (ready(value)) return value;
    await pause(15);
  } while (Date.now() < deadline);
  throw new Error('Timed out waiting for a tournament integration event.');
}

async function waitForPid(file: string): Promise<number> {
  return waitFor(async () => {
    try { return Number(await readFile(file, 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0; throw error; }
  }, pid => pid > 0);
}

function deterministicEvidence(report: TournamentReport) {
  return report.matches.map(match => ({
    seed: match.seed, seats: match.seats, status: match.status, finalTick: match.finalTick,
    finalStateSha256: match.finalStateSha256, transcriptSha256: match.transcriptSha256,
    decisions: match.decisions, checkpoints: match.checkpoints, actions: match.replay.actions,
  }));
}

interface HttpResult<T = unknown> { status: number; data: T }

function streamedPost(url: string) {
  const outgoing = nodeRequest(url + '/api/tournaments', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked', Authorization: 'Bearer runtime-test' },
  });
  cleanup.push(async () => { outgoing.destroy(); });
  const result = new Promise<HttpResult>((resolveResponse, reject) => {
    outgoing.once('error', reject);
    outgoing.once('response', response => {
      let content = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { content += chunk; });
      response.once('end', () => resolveResponse({ status: response.statusCode!, data: JSON.parse(content) }));
      response.once('error', reject);
    });
  });
  return { outgoing, result };
}

async function httpService(outputRoot: string, configs: TournamentConfig[], authorize: (request: IncomingMessage) => boolean | Promise<boolean> = request => request.headers.authorization === 'Bearer runtime-test') {
  const service = createTournamentService({ cwd, outputRoot, configs, authorize });
  const server = createServer((request, response) => {
    void service.handle(request, response).then(handled => {
      if (!handled) { response.writeHead(418, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ delegated: true })); }
    }).catch(error => { response.writeHead(500); response.end(String(error)); });
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolveListen(); });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('HTTP fixture did not bind a TCP port.');
  const url = `http://127.0.0.1:${address.port}`;
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await service.dispose();
    server.closeIdleConnections();
    await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
  };
  cleanup.push(close);
  const request = async <T = unknown>(route: string, options: { body?: unknown; raw?: string; method?: string; authorized?: boolean } = {}): Promise<HttpResult<T>> => {
    const response = await fetch(url + route, {
      method: options.method ?? (options.body !== undefined || options.raw !== undefined ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', ...(options.authorized === false ? {} : { Authorization: 'Bearer runtime-test' }) },
      body: options.raw ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    });
    return { status: response.status, data: await response.json() as T };
  };
  return { service, request, close, url };
}

async function finishedStatus(request: <T = unknown>(route: string) => Promise<HttpResult<T>>, id: string) {
  return waitFor(async () => {
    const response = await request<TournamentProgress>(`/api/tournaments/${id}`);
    expect(response.status).toBe(200);
    return response.data;
  }, progress => progress.status !== 'running');
}

describe('tournament runner with real terminal agents', () => {
  it('pins seeds and seat swaps, writes replay evidence, and repeats state hashes and commands', async () => {
    const directory = await temporaryDirectory();
    const idle = config({ seeds: [42, 4127], bothSeats: true });
    const first = await runTournament(idle, { cwd, outputDirectory: join(directory, 'first') });
    const second = await runTournament(idle, { cwd, outputDirectory: join(directory, 'second') });
    expect(first.status).toBe('complete');
    expect(second.status).toBe('complete');
    expect(first.matches.map(({ seed, seats }) => ({ seed, seats }))).toEqual([
      { seed: 42, seats: ['alpha', 'beta'] }, { seed: 42, seats: ['beta', 'alpha'] },
      { seed: 4127, seats: ['alpha', 'beta'] }, { seed: 4127, seats: ['beta', 'alpha'] },
    ]);
    expect(first.matches.every(match => match.status === 'limit' && match.finalTick === 20)).toBe(true);
    expect(deterministicEvidence(second)).toEqual(deterministicEvidence(first));
    expect(first.provenance.sources.some(source => source.path.startsWith('src/core/'))).toBe(true);
    expect(first.provenance.sources.some(source => source.path.startsWith('src/tournament/'))).toBe(true);
    expect(first.provenance.sources.some(source => source.path.startsWith('src/cli/'))).toBe(true);
    expect(first.provenance.agents.every(agent => agent.files.some(file => file.path === resolve(cwd, builtinScript)))).toBe(true);
    expect(first.provenance.sources.find(source => source.path === 'src/core/simulation.ts')?.sha256).toBe(sha256(await readFile(join(cwd, 'src/core/simulation.ts'))));
    const scriptSha256 = sha256(await readFile(resolve(cwd, builtinScript)));
    for (const agent of first.provenance.agents) expect(agent.files.find(file => file.path === resolve(cwd, builtinScript))?.sha256).toBe(scriptSha256);
    for (const match of [...first.matches, ...second.matches]) expect(new Set(match.agents.map(agent => agent.pid)).size).toBe(2);
    const saved = decodeTournamentReport(await readFile(join(directory, 'first', 'tournament.json'), 'utf8'));
    expect(saved).toEqual(decodeTournamentReport(JSON.stringify(first)));
    expect(await readdir(join(directory, 'first'))).toHaveLength(9);
    for (const match of first.matches) {
      const replay = decodeReplay(await readFile(join(directory, 'first', `${match.id}.replay.json`), 'utf8'));
      const evidence = JSON.parse(await readFile(join(directory, 'first', `${match.id}.evidence.json`), 'utf8'));
      expect(replay.finalTick).toBe(20);
      expect(evidence.finalStateSha256).toBe(match.finalStateSha256);
      expect(evidence).not.toHaveProperty('replay');
    }
    await verifyTournamentReport(saved);
    await verifyTournamentReport(second);
    expectChildrenExited(first);
    expectChildrenExited(second);

    const push = config({ agents: [builtin('alpha', 'orcs', 'push'), builtin('beta', 'fairies', 'push')] });
    const pushed = await runTournament(push, { cwd });
    const repeated = await runTournament(push, { cwd });
    expect(pushed.status).toBe('complete');
    expect(repeated.status).toBe('complete');
    expect(pushed.matches[0].decisions.flatMap(decision => decision.commands).some(receipt => receipt.accepted)).toBe(true);
    expect(deterministicEvidence(repeated)).toEqual(deterministicEvidence(pushed));
    await verifyTournamentReport(pushed);
    await verifyTournamentReport(repeated);
    expectChildrenExited(pushed);
    expectChildrenExited(repeated);
  }, 30000);

  it('sends canonical filtered observations and returns accepted and rejected command receipts on the next turn', async () => {
    const directory = await temporaryDirectory(), turnsFile = join(directory, 'turns.jsonl');
    const configured = config();
    const initial = createMatch(tournamentMatchConfig(configured, ['alpha', 'beta'], 4127));
    const hiddenWorker = initial.entities.find(entity => entity.side === 1 && entity.role === 'worker')!;
    const probe = await fixture(directory, 'alpha', `
      import { appendFileSync } from 'node:fs';
      import { createInterface } from 'node:readline';
      for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
        const turn = JSON.parse(line);
        appendFileSync(${JSON.stringify(turnsFile)}, JSON.stringify(turn) + '\\n');
        const own = turn.observation.entities.find(entity => entity.side === turn.observation.side && entity.role === 'worker');
        const commands = [{ type: 'hold', ids: [own.id] }, { type: 'move', ids: [${hiddenWorker.id}], x: 2, y: 2 }];
        process.stdout.write(JSON.stringify({ requestId: turn.requestId, commands }) + '\\n');
      }
    `);
    configured.agents[0] = probe;
    const report = await runTournament(configured, { cwd });
    const turns = (await readFile(turnsFile, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as AgentTurn);
    expect(report.status).toBe('complete');
    expect(turns).toHaveLength(2);
    expect(turns.map(turn => turn.requestId)).toEqual([1, 2]);
    expect(turns[0]).toMatchObject({ protocol: 'orcs-vs-fairies/tournament-agent', version: 1, type: 'turn', receipts: [] });
    expect(turns[0].observation).toEqual(new PlayerView(0).observe(initial));
    const observation = turns[0].observation as ReturnType<PlayerView['observe']>;
    expect(observation.entities.every(entity => entity.side === 0)).toBe(true);
    expect(observation.entities.some(entity => entity.id === hiddenWorker.id)).toBe(false);
    expect(observation.map.terrain.some(cell => cell === null)).toBe(true);
    expect(observation.opponent).toEqual({ side: 1, faction: 'fairies' });
    expect(observation).not.toHaveProperty('state');
    expect(observation).not.toHaveProperty('players');
    const decisions = report.matches[0].decisions.filter(decision => decision.side === 0);
    expect(decisions[0].commands.map(receipt => receipt.accepted)).toEqual([true, false]);
    expect(turns[1].receipts).toEqual(decisions[0].commands);
    expect(report.matches[0].decisions.map(decision => decision.side)).toEqual([0, 1, 1, 0]);
    expect(report.matches[0].agents[0]).toMatchObject({ accepted: 2, rejected: 2, fault: null, turns: 2 });
    await verifyTournamentReport(report);
    expectChildrenExited(report);
  }, 30000);

  it('forfeits timed out, crashed, malformed, out-of-sequence, and oversized processes and kills every child', async () => {
    const directory = await temporaryDirectory();
    const responding = (response: string) => `
      import { createInterface } from 'node:readline';
      for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
        const turn = JSON.parse(line);
        ${response}
      }
    `;
    const failures: Array<{ agent: TournamentAgent; fault: RegExp }> = [
      { agent: builtin('hang', 'orcs', 'hang'), fault: /timed out/ },
      { agent: builtin('crash', 'orcs', 'crash'), fault: /exited before the match finished/ },
      { agent: await fixture(directory, 'invalid-json', responding("process.stdout.write('not json\\n');")), fault: /invalid JSON/ },
      { agent: await fixture(directory, 'wrong-sequence', responding("process.stdout.write(JSON.stringify({ requestId: turn.requestId + 1, commands: [] }) + '\\n');")), fault: /out-of-sequence/ },
      { agent: await fixture(directory, 'invalid-command', responding("process.stdout.write(JSON.stringify({ requestId: turn.requestId, commands: [{ type: 'move', ids: [1], x: 'bad', y: 2 }] }) + '\\n');")), fault: /malformed/ },
      { agent: await fixture(directory, 'oversized', responding("process.stdout.write('x'.repeat(65537));")), fault: /exceeds 64 KiB/ },
    ];
    const runs = await Promise.allSettled(failures.map(({ agent }) =>
      runTournament(config({ agents: [agent, builtin('beta', 'fairies', 'push')], responseTimeoutMs: 3000 }), { cwd })));
    const reports = runs.map(run => {
      if (run.status === 'rejected') throw run.reason;
      return run.value;
    });
    for (const [index, report] of reports.entries()) {
      const { agent, fault } = failures[index];
      expect(report.status).toBe('complete');
      const match = report.matches[0];
      expect(match).toMatchObject({ status: 'forfeit', winnerAgentId: 'beta', finalTick: 0 });
      expect(match.agents[0].fault).toMatch(fault);
      expect(match.agents[1].fault).toBeNull();
      const healthyCommands = match.decisions.filter(decision => decision.side === 1).flatMap(decision => decision.commands);
      expect(healthyCommands.length).toBeGreaterThan(0);
      expect(healthyCommands.every(receipt => !receipt.accepted)).toBe(true);
      expect(match.agents[1]).toMatchObject({ accepted: 0, rejected: healthyCommands.length });
      if (agent.id === 'crash') expect(match.agents[0]).toMatchObject({ exitCode: 7, stderr: 'Intentional tournament crash fixture.\n' });
      await verifyTournamentReport(report);
      expectChildrenExited(report);
    }
    expect(reports).toHaveLength(failures.length);
    const double = await runTournament(config({ agents: [builtin('alpha', 'orcs', 'crash'), builtin('beta', 'fairies', 'hang')] }), { cwd });
    expect(double.status).toBe('complete');
    expect(double.matches[0]).toMatchObject({ status: 'double-forfeit', winnerAgentId: null, finalTick: 0 });
    expect(double.matches[0].agents.every(agent => agent.fault !== null)).toBe(true);
    await verifyTournamentReport(double);
    expectChildrenExited(double);
  }, 30000);

  it('forfeits an unsolicited duplicate response on the final planned turn', async () => {
    const directory = await temporaryDirectory();
    const duplicate = await fixture(directory, 'alpha', `
      import { createInterface } from 'node:readline';
      for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
        const turn = JSON.parse(line);
        const worker = turn.observation.entities.find(entity => entity.role === 'worker' && entity.side === turn.observation.side);
        const response = JSON.stringify({ requestId: turn.requestId, commands: [{ type: 'hold', ids: [worker.id] }] });
        process.stdout.write(response + '\\n' + response + '\\n');
      }
    `);
    const report = await runTournament(config({
      agents: [duplicate, builtin('beta', 'fairies', 'push')], decisionTicks: 20,
    }), { cwd });
    expect(report.status).toBe('complete');
    const match = report.matches[0];
    expect(match).toMatchObject({ status: 'forfeit', winnerAgentId: 'beta', finalTick: 0 });
    expect(match.agents[0]).toMatchObject({ turns: 1, accepted: 0, rejected: 1 });
    expect(match.agents[0].fault).toMatch(/unsolicited response/);
    expect(match.agents[1].fault).toBeNull();
    expect(match.decisions.flatMap(decision => decision.commands).every(receipt => !receipt.accepted)).toBe(true);
    await verifyTournamentReport(report);
    expectChildrenExited(report);
  }, 30000);

  it('cancels an active hung process, saves a verifiable aborted match, and waits for child termination', async () => {
    const directory = await temporaryDirectory(), pidFile = join(directory, 'pid');
    const hang = await fixture(directory, 'alpha', `
      import { writeFileSync } from 'node:fs';
      writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
      process.stdin.resume();
      setInterval(() => {}, 1000);
    `);
    const abort = new AbortController();
    const done = runTournament(config({ agents: [hang, builtin('beta', 'fairies')], responseTimeoutMs: 30000 }), {
      cwd, outputDirectory: join(directory, 'canceled'), signal: abort.signal,
    });
    cleanup.push(async () => { abort.abort(); await done; });
    const pid = await waitForPid(pidFile);
    expect(alive(pid)).toBe(true);
    abort.abort();
    const report = await done;
    expect(report.status).toBe('canceled');
    expect(report.matches).toHaveLength(1);
    expect(report.matches[0]).toMatchObject({ status: 'aborted', winnerAgentId: null, finalTick: 0 });
    expect(report.matches[0].agents.every(agent => agent.fault === null)).toBe(true);
    expect(report.matches[0].agents[0].pid).toBe(pid);
    const saved = await verifyTournamentReport(await readFile(join(directory, 'canceled', 'tournament.json'), 'utf8'));
    expect(saved.status).toBe('canceled');
    expectChildrenExited(report);
  }, 30000);

  it('refuses an existing output directory without overwriting evidence', async () => {
    const directory = await temporaryDirectory(), sentinel = join(directory, 'tournament.json');
    await writeFile(sentinel, 'existing evidence\n');
    await expect(runTournament(config(), { cwd, outputDirectory: directory })).rejects.toMatchObject({ code: 'EEXIST' });
    expect(await readFile(sentinel, 'utf8')).toBe('existing evidence\n');
    expect(await readdir(directory)).toEqual(['tournament.json']);
  }, 30000);

  it('rejects changed configuration, checkpoint, outcome, and accepted-command evidence', async () => {
    const report = await runTournament(config({ agents: [builtin('alpha', 'orcs', 'push'), builtin('beta', 'fairies', 'push')] }), { cwd });
    expect(report.status).toBe('complete');
    await verifyTournamentReport(report);
    const configuration = structuredClone(report);
    configuration.config.startingAge = 2;
    await expect(verifyTournamentReport(configuration)).rejects.toThrow('pinned match configuration');
    const checkpoint = structuredClone(report);
    checkpoint.matches[0].checkpoints[0].stateSha256 = '0'.repeat(64);
    await expect(verifyTournamentReport(checkpoint)).rejects.toThrow('replay checkpoint at tick 0');
    const outcome = structuredClone(report);
    outcome.matches[0].status = 'battle';
    outcome.matches[0].winnerAgentId = 'alpha';
    await expect(verifyTournamentReport(outcome)).rejects.toThrow('battle outcome');
    const commands = structuredClone(report), match = commands.matches[0];
    const accepted = match.decisions.flatMap(decision => decision.commands).find(receipt => receipt.accepted)!;
    expect(accepted).toBeDefined();
    accepted.accepted = false;
    match.transcriptSha256 = hash(match.decisions);
    await expect(verifyTournamentReport(commands)).rejects.toThrow('accepted-command replay evidence');
    expectChildrenExited(report);
  }, 30000);
});

describe('tournament HTTP service over TCP', () => {
  it('prevents a pending authorization or streamed request body from starting work after disposal', async () => {
    const directory = await temporaryDirectory(), registered = config();
    let entered = false;
    let releaseAuthorization!: () => void;
    const authorization = new Promise<void>(resolveAuthorization => { releaseAuthorization = resolveAuthorization; });
    const gated = await httpService(join(directory, 'authorization'), [registered], async () => {
      entered = true;
      await authorization;
      return true;
    });
    cleanup.push(async () => { releaseAuthorization(); });
    const pendingAuthorization = gated.request('/api/tournaments', { body: { configId: registered.id } });
    await waitFor(async () => entered, value => value);
    await gated.service.dispose();
    releaseAuthorization();
    expect((await pendingAuthorization).status).toBe(503);
    expect(await readdir(join(directory, 'authorization'))).toEqual([]);
    await gated.close();

    let receivedBody = false;
    const streamed = await httpService(join(directory, 'body'), [registered], request => {
      request.once('data', () => { receivedBody = true; });
      return true;
    });
    const { outgoing, result: pendingBody } = streamedPost(streamed.url);
    outgoing.write('{"configId":');
    await waitFor(async () => receivedBody, value => value);
    await streamed.service.dispose();
    outgoing.end(JSON.stringify(registered.id) + '}');
    expect((await pendingBody).status).toBe(503);
    expect(await readdir(join(directory, 'body'))).toEqual([]);
  }, 30000);

  it('authorizes requests, accepts registered configuration IDs, bounds concurrency, and cancels active agents', async () => {
    const directory = await temporaryDirectory(), pidFile = join(directory, 'http-pid');
    const hang = await fixture(directory, 'alpha', `
      import { writeFileSync } from 'node:fs';
      writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
      process.stdin.resume();
      setInterval(() => {}, 1000);
    `);
    const fast = config({ id: 'fast' }), hung = config({ id: 'hung', agents: [hang, builtin('beta', 'fairies')], responseTimeoutMs: 30000 });
    const { request, url } = await httpService(join(directory, 'reports'), [fast, hung]);
    expect(await request('/api/health', { authorized: false })).toEqual({ status: 418, data: { delegated: true } });
    expect((await request('/api/tournaments/configs', { authorized: false })).status).toBe(403);
    expect((await request('/api/tournaments', { body: { configId: 'fast' }, authorized: false })).status).toBe(403);
    const choices = await request<Array<{ id: string; agents: unknown[] }>>('/api/tournaments/configs');
    expect(choices.status).toBe(200);
    expect(choices.data.map(choice => choice.id)).toEqual(['fast', 'hung']);
    expect(JSON.stringify(choices.data)).not.toContain('command');
    expect(JSON.stringify(choices.data)).not.toContain('sourceFiles');
    for (const body of [fast, { configId: 'fast', command: [process.execPath, '-e', 'process.exit(0)'] }, ['fast'], { configId: 1 }]) {
      expect((await request('/api/tournaments', { body })).status).toBe(400);
    }
    expect((await request('/api/tournaments', { body: { configId: 'unknown' } })).status).toBe(404);
    expect((await request('/api/tournaments', { raw: '{' })).status).toBe(400);
    expect((await request('/api/tournaments', { raw: JSON.stringify({ configId: 'x'.repeat(4096) }) })).status).toBe(413);
    const oversizedStream = streamedPost(url);
    oversizedStream.outgoing.end(JSON.stringify({ configId: 'x'.repeat(4096) }));
    expect((await oversizedStream.result).status).toBe(413);
    expect((await request<TournamentProgress[]>('/api/tournaments')).data).toEqual([]);
    const started = await request<{ id: string }>('/api/tournaments', { body: { configId: 'hung' } });
    expect(started.status).toBe(202);
    const id = started.data.id;
    const pid = await waitForPid(pidFile);
    expect(alive(pid)).toBe(true);
    const busy = await Promise.all([request('/api/tournaments', { body: { configId: 'fast' } }), request('/api/tournaments', { body: { configId: 'hung' } })]);
    expect(busy.map(response => response.status)).toEqual([409, 409]);
    expect((await request<TournamentProgress>(`/api/tournaments/${id}`)).data).toMatchObject({ status: 'running', totalMatches: 1, completedMatches: 0 });
    expect((await request(`/api/tournaments/${id}/result`)).status).toBe(409);
    expect((await request(`/api/tournaments/${id}/matches/match-001/replay`)).status).toBe(404);
    expect((await request(`/api/tournaments/${id}/cancel`, { method: 'POST' })).status).toBe(202);
    expect((await finishedStatus(request, id)).status).toBe('canceled');
    const result = await request<TournamentReport>(`/api/tournaments/${id}/result`);
    expect(result.status).toBe(200);
    await verifyTournamentReport(result.data);
    expect(result.data.matches[0].agents[0].pid).toBe(pid);
    expectChildrenExited(result.data);
    const next = await request<{ id: string }>('/api/tournaments', { body: { configId: 'fast' } });
    expect(next.status).toBe(202);
    expect((await finishedStatus(request, next.data.id)).status).toBe('complete');
  }, 30000);

  it('serves verified results and replays and restores completed reports after a new server starts', async () => {
    const directory = await temporaryDirectory(), outputRoot = join(directory, 'reports'), registered = config({ bothSeats: true });
    const first = await httpService(outputRoot, [registered]);
    const started = await first.request<{ id: string }>('/api/tournaments', { body: { configId: registered.id } });
    expect(started.status).toBe(202);
    const id = started.data.id;
    expect(await finishedStatus(first.request, id)).toMatchObject({ status: 'complete', totalMatches: 2, completedMatches: 2, current: null });
    const result = await first.request<TournamentReport>(`/api/tournaments/${id}/result`);
    expect(result.status).toBe(200);
    await verifyTournamentReport(result.data);
    expectChildrenExited(result.data);
    const replay = await first.request(`/api/tournaments/${id}/matches/match-001/replay`);
    expect(replay.status).toBe(200);
    const player = new ReplayPlayer(decodeReplay(replay.data));
    try { player.seek(player.archive.finalTick); expect(stateHash(player.state)).toBe(result.data.matches[0].finalStateSha256); }
    finally { player.dispose(); }
    expect((await first.request(`/api/tournaments/${id}/matches/missing/replay`)).status).toBe(404);
    expect((await first.request('/api/tournaments/run-missing')).status).toBe(404);
    expect((await first.request(`/api/tournaments/${id}`, { method: 'POST' })).status).toBe(405);
    expect((await first.request<TournamentProgress[]>('/api/tournaments')).data.map(progress => progress.id)).toEqual([id]);
    expect(decodeTournamentReport(await readFile(join(outputRoot, id, 'tournament.json'), 'utf8'))).toEqual(result.data);
    await first.close();
    const restored = await httpService(outputRoot, [registered]);
    expect((await restored.request<TournamentProgress>(`/api/tournaments/${id}`)).data).toMatchObject({ status: 'complete', completedMatches: 2 });
    expect(await restored.request(`/api/tournaments/${id}/result`)).toEqual(result);
    expect(await restored.request(`/api/tournaments/${id}/matches/match-001/replay`)).toEqual(replay);
    expect((await restored.request<TournamentProgress[]>('/api/tournaments')).data.map(progress => progress.id)).toEqual([id]);
  }, 30000);
});
