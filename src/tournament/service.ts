import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir } from 'node:fs/promises';
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
  const outputRoot = path.resolve(options.outputRoot);
  const jobs = new Map<string, { progress: TournamentProgress; report?: TournamentReport; abort: AbortController; done?: Promise<void> }>();
  let active: string | null = null, disposed = false;
  const ready = (async () => {
    await mkdir(outputRoot, { recursive: true });
    // Completed reports survive server restart. Running processes belong to this server instance.
    for (const entry of await readdir(outputRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^run-[a-z0-9_-]+$/i.test(entry.name)) continue;
      try {
        const report = decodeTournamentReport(await readFile(path.join(outputRoot, entry.name, 'tournament.json'), 'utf8'));
        if (report.status !== 'running') jobs.set(report.id, { progress: tournamentProgress(report), report, abort: new AbortController() });
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
        if (active) throw new HttpFailure(409, 'A tournament is already running.');
        const id = `run-${randomUUID()}`, abort = new AbortController();
        const job: (typeof jobs extends Map<string, infer Job> ? Job : never) = {
          abort, progress: { id, status: 'running', totalMatches: config.agents.length * (config.agents.length - 1) / 2 * config.seeds.length * (config.bothSeats ? 2 : 1),
            completedMatches: 0, standings: tournamentStandings({ config, matches: [] }), current: null, error: null },
        };
        active = id;
        jobs.set(id, job);
        job.done = runTournament(config, { cwd: options.cwd, outputDirectory: path.join(outputRoot, id), id, signal: abort.signal,
          onProgress: progress => { job.progress = structuredClone(progress); } }).then(report => {
          job.report = report; job.progress = tournamentProgress(report);
        }).catch(error => {
          job.progress = { ...job.progress, status: 'failed', current: null, error: error instanceof Error ? error.message : String(error) };
        }).finally(() => { if (active === id) active = null; });
        json(response, 202, { id }); return true;
      }
      const route = /^\/api\/tournaments\/(run-[a-z0-9_-]+)(?:\/(result|cancel|matches\/([a-z0-9_-]+)\/replay))?$/.exec(url.pathname);
      if (!route) throw new HttpFailure(404, 'Unknown tournament route.');
      const job = jobs.get(route[1]);
      if (!job) throw new HttpFailure(404, 'Unknown tournament.');
      if (request.method === 'GET' && !route[2]) { json(response, 200, job.progress); return true; }
      if (request.method === 'POST' && route[2] === 'cancel') { job.abort.abort(); json(response, 202, { canceled: true }); return true; }
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
  return { handle, async dispose() {
    if (disposed) return;
    disposed = true;
    for (const job of jobs.values()) if (job.progress.status === 'running') job.abort.abort();
    await ready;
    await Promise.all([...jobs.values()].map(job => job.done));
  } };
}
