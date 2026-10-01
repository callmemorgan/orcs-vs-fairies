import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir, rm } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { decodeTournamentConfig, decodeTournamentReport, tournamentProgress, tournamentStandings } from './report';
import { runTournament } from './runner';
import type { TournamentChoice, TournamentConfig, TournamentProgress, TournamentReport } from './types';

export interface TournamentServiceOptions {
  cwd: string;
  outputRoot: string;
  /** Only these server-owned commands can be selected by HTTP clients. */
  configs: unknown[];
  /** The canonical server supplies its authorization rule. */
  authorize: (request: IncomingMessage) => boolean | Promise<boolean>;
  /** Trusted account identity. When supplied, only a run's creator may cancel it. */
  principal?: (request: IncomingMessage) => string | undefined | Promise<string | undefined>;
}
export interface TournamentService {
  /** Returns false for routes outside /api/tournaments. */
  handle: (request: IncomingMessage, response: ServerResponse) => Promise<boolean>;
  /** Cancels active jobs and waits for their child processes to exit. */
  dispose: () => Promise<void>;
}
class HttpFailure extends Error { constructor(readonly status: number, message: string) { super(message); } }
function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(value));
}
async function body(request: IncomingMessage): Promise<unknown> {
  if (Number(request.headers['content-length']) > 4096) throw new HttpFailure(413, 'Tournament requests may contain only a registered configuration ID.');
  let content = '';
  for await (const chunk of request) {
    content += chunk;
    if (Buffer.byteLength(content) > 4096) throw new HttpFailure(413, 'Tournament request exceeds 4 KiB.');
  }
  try { return JSON.parse(content); } catch { throw new HttpFailure(400, 'Invalid tournament request JSON.'); }
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** A handler for the existing Node server; it neither creates accounts nor accepts remote argv. */
export function createTournamentService(options: TournamentServiceOptions): TournamentService {
  const configs = options.configs.map(decodeTournamentConfig), byConfig = new Map<string, TournamentConfig>();
  for (const config of configs) {
    if (byConfig.has(config.id)) throw new Error('Duplicate registered tournament configuration.');
    byConfig.set(config.id, config);
  }
  const outputRoot = path.resolve(options.outputRoot), owners = path.join(outputRoot, 'owners'), principal = options.principal;
  const jobs = new Map<string, { readonly creator?: string; progress: TournamentProgress; report?: TournamentReport; abort: AbortController; done?: Promise<void> }>();
  let active: string | null = null, disposed = false, disposing: Promise<void> | undefined;
  const validPrincipal = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 1024;
  const ownerFile = (id: string) => path.join(owners, `${id}.json`);
  async function readOwner(id: string): Promise<string | undefined> {
    try {
      const value: unknown = JSON.parse(await readFile(ownerFile(id), 'utf8'));
      return object(value) && Object.keys(value).every(key => ['version', 'id', 'principal'].includes(key))
        && value.version === 1 && value.id === id && validPrincipal(value.principal) ? value.principal : undefined;
    } catch { return undefined; }
  }
  async function writeOwner(id: string, creator: string): Promise<void> {
    await mkdir(owners, { recursive: true });
    // This sibling file never creates the runner's exclusively owned output directory.
    const file = await open(ownerFile(id), 'wx', 0o600);
    try {
      await file.writeFile(JSON.stringify({ version: 1, id, principal: creator }) + '\n');
      await file.sync();
      await file.close();
    } catch (error) {
      await file.close().catch(() => {});
      await rm(ownerFile(id), { force: true });
      throw error;
    }
  }
  async function identity(request: IncomingMessage): Promise<string | undefined> {
    if (!principal) return undefined;
    const creator = await principal(request);
    if (disposed) throw new HttpFailure(503, 'Tournament service is shutting down.');
    if (!validPrincipal(creator)) throw new HttpFailure(403, 'Tournament mutations require an account identity.');
    return creator;
  }
  const ready = (async () => {
    await mkdir(outputRoot, { recursive: true });
    // Completed reports survive server restart. Running processes belong to this server instance.
    for (const entry of await readdir(outputRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^run-[a-z0-9_-]+$/i.test(entry.name)) continue;
      try {
        const report = decodeTournamentReport(await readFile(path.join(outputRoot, entry.name, 'tournament.json'), 'utf8'));
        if (report.status !== 'running' && report.id === entry.name) jobs.set(report.id, {
          creator: await readOwner(report.id), progress: tournamentProgress(report), report, abort: new AbortController(),
        });
      } catch { /* An unfinished directory is retained as evidence, without inventing a result. */ }
    }
  })();
  function choices(): TournamentChoice[] {
    return configs.map(config => ({ id: config.id, name: config.name,
      agents: config.agents.map(({ id, name, faction }) => ({ id, name, faction })), seeds: [...config.seeds],
      mapSize: config.mapSize, bothSeats: config.bothSeats, maxSeconds: config.maxSeconds }));
  }
  async function handle(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/tournaments' && !url.pathname.startsWith('/api/tournaments/')) return false;
    try {
      await ready;
      if (disposed) throw new HttpFailure(503, 'Tournament service is shutting down.');
      const authorized = await options.authorize(request);
      if (disposed) throw new HttpFailure(503, 'Tournament service is shutting down.');
      if (!authorized) throw new HttpFailure(403, 'Tournament access is not authorized.');
      if (request.method === 'GET' && url.pathname === '/api/tournaments/configs') { json(response, 200, choices()); return true; }
      if (request.method === 'GET' && url.pathname === '/api/tournaments') { json(response, 200, [...jobs.values()].map(job => job.progress)); return true; }
      if (request.method === 'POST' && url.pathname === '/api/tournaments') {
        const input = await body(request);
        if (disposed) throw new HttpFailure(503, 'Tournament service is shutting down.');
        if (!object(input) || Object.keys(input).some(key => key !== 'configId') || typeof input.configId !== 'string') throw new HttpFailure(400, 'Select a registered tournament configuration.');
        const config = byConfig.get(input.configId);
        if (!config) throw new HttpFailure(404, 'Unknown tournament configuration.');
        const creator = await identity(request);
        if (disposed) throw new HttpFailure(503, 'Tournament service is shutting down.');
        if (active) throw new HttpFailure(409, 'A tournament is already running.');
        const id = `run-${randomUUID()}`, abort = new AbortController();
        if (jobs.has(id)) throw new HttpFailure(500, 'Tournament identity already exists.');
        const job: (typeof jobs extends Map<string, infer Job> ? Job : never) = {
          creator, abort, progress: { id, status: 'running', totalMatches: config.agents.length * (config.agents.length - 1) / 2 * config.seeds.length * (config.bothSeats ? 2 : 1),
            completedMatches: 0, standings: tournamentStandings({ config, matches: [] }), current: null, error: null },
        };
        active = id;
        jobs.set(id, job);
        let launched = false, ownerWritten = false;
        let accept!: () => void, reject!: (error: unknown) => void;
        const accepted = new Promise<void>((resolve, rejectStart) => { accept = resolve; reject = rejectStart; });
        // Reserve synchronously; done includes metadata preparation so disposal waits
        // for it, and no second request can launch during the ownership write.
        job.done = (async () => {
          try {
            if (creator !== undefined) { await writeOwner(id, creator); ownerWritten = true; }
            if (disposed) throw new HttpFailure(503, 'Tournament service is shutting down.');
            const result = runTournament(config, { cwd: options.cwd, outputDirectory: path.join(outputRoot, id), id, signal: abort.signal,
              onProgress: progress => { job.progress = structuredClone(progress); } });
            launched = true; accept();
            job.report = await result; job.progress = tournamentProgress(job.report);
          } catch (error) {
            if (ownerWritten) {
              try { await rm(ownerFile(id), { force: true }); }
              catch (cleanupError) { error = new Error(`Tournament ownership cleanup failed: ${String(cleanupError)}; original failure: ${String(error)}`); }
            }
            if (!launched) { jobs.delete(id); reject(error); }
            else job.progress = { ...job.progress, status: 'failed', current: null, error: error instanceof Error ? error.message : String(error) };
          } finally { if (active === id) active = null; }
        })();
        await accepted;
        json(response, 202, { id }); return true;
      }
      const route = /^\/api\/tournaments\/(run-[a-z0-9_-]+)(?:\/(result|cancel|matches\/([a-z0-9_-]+)\/replay))?$/.exec(url.pathname);
      if (!route) throw new HttpFailure(404, 'Unknown tournament route.');
      const job = jobs.get(route[1]);
      if (!job) throw new HttpFailure(404, 'Unknown tournament.');
      if (request.method === 'GET' && !route[2]) { json(response, 200, job.progress); return true; }
      if (request.method === 'POST' && route[2] === 'cancel') {
        if (principal && await identity(request) !== job.creator) throw new HttpFailure(403, 'Only the tournament creator may cancel this run.');
        if (disposed) throw new HttpFailure(503, 'Tournament service is shutting down.');
        job.abort.abort(); json(response, 202, { canceled: true }); return true;
      }
      if (request.method === 'GET' && route[2] === 'result') {
        if (!job.report) throw new HttpFailure(job.progress.status === 'failed' ? 500 : 409, job.progress.error ?? 'The tournament is still running.');
        json(response, 200, job.report); return true;
      }
      if (request.method === 'GET' && route[3]) {
        const match = job.report?.matches.find(match => match.id === route[3]);
        if (!match) throw new HttpFailure(404, 'Match replay is not available.');
        json(response, 200, match.replay); return true;
      }
      throw new HttpFailure(405, 'Unsupported tournament method.');
    } catch (error) {
      if (!response.headersSent) json(response, error instanceof HttpFailure ? error.status : 500, { error: error instanceof Error ? error.message : String(error) });
      else response.end();
      request.resume();
      return true;
    }
  }
  return { handle, dispose() {
    if (disposing) return disposing;
    disposed = true;
    for (const job of jobs.values()) if (job.progress.status === 'running') job.abort.abort();
    disposing = (async () => { await ready; await Promise.all([...jobs.values()].map(job => job.done)); })();
    return disposing;
  } };
}
