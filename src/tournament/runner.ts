import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { validateCommand } from '../core/commands';
import { PlayerView } from '../core/observation';
import { MatchRecorder, ReplayPlayer } from '../core/replays';
import { SAVE_VERSION } from '../core/saves';
import { createMatch, isGameOver, issueCommand, stepGame } from '../core/simulation';
import { stateHash } from '../cli/session';
import {
  decodeTournamentConfig, tournamentContentText, tournamentMatchConfig,
  tournamentProgress, tournamentSchedule,
} from './report';
import type {
  AgentDecision, AgentReceipt, AgentRunStats, AgentTurn, TournamentAgent,
  TournamentConfig, TournamentMatch, TournamentProgress, TournamentProvenance, TournamentReport,
} from './types';

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const message = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 2000);
const delay = (milliseconds: number) => new Promise<void>(resolve => { const timer = setTimeout(resolve, milliseconds); timer.unref(); });
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Each match gets new child processes. Only filtered observations cross their stdin boundary. */
class TerminalAgentProcess {
  readonly stats: AgentRunStats;
  private process: ChildProcessWithoutNullStreams;
  private buffer = '';
  private stopping = false;
  private exited = false;
  private fault: Error | undefined;
  private pending: { requestId: number; resolve: (decision: AgentDecision) => void; reject: (error: Error) => void } | undefined;
  private exit: Promise<void>;
  constructor(agent: TournamentAgent, cwd: string, private maxCommands: number) {
    this.process = spawn(agent.command[0], agent.command.slice(1), { cwd, stdio: 'pipe', windowsHide: true, detached: process.platform !== 'win32' });
    this.stats = { agentId: agent.id, pid: this.process.pid ?? null, turns: 0, accepted: 0, rejected: 0,
      fault: null, stderr: '', stderrTruncated: false, exitCode: null, exitSignal: null };
    this.process.stdout.setEncoding('utf8');
    this.process.stderr.setEncoding('utf8');
    this.process.stdout.on('data', (chunk: string) => this.output(chunk));
    this.process.stderr.on('data', (chunk: string) => {
      const room = 16384 - this.stats.stderr.length;
      this.stats.stderr += chunk.slice(0, Math.max(0, room));
      if (chunk.length > room) this.stats.stderrTruncated = true;
    });
    this.process.on('error', error => this.fail(new Error(`Agent process failed: ${message(error)}`)));
    this.process.stdin.on('error', error => { if (!this.stopping) this.fail(new Error(`Agent stdin failed: ${message(error)}`)); });
    this.exit = new Promise(resolve => this.process.once('close', (code, signal) => {
      this.exited = true;
      this.stats.exitCode = code;
      this.stats.exitSignal = signal;
      if (!this.stopping) this.fail(new Error(`Agent exited before the match finished (${signal ?? code ?? 'unknown'}).`));
      resolve();
    }));
  }
  private fail(error: Error) {
    this.fault ??= error;
    this.pending?.reject(this.fault);
  }
  get failure(): Error | undefined { return this.fault; }
  private output(chunk: string) {
    if (this.stopping || this.fault) return;
    this.buffer += chunk;
    if (Buffer.byteLength(this.buffer) > 65536) { this.fail(new Error('Agent response exceeds 64 KiB.')); return; }
    let newline: number;
    while ((newline = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      if (!line.trim()) continue;
      if (!this.pending) { this.fail(new Error('Agent sent an unsolicited response.')); return; }
      let input: unknown;
      try { input = JSON.parse(line); } catch { this.fail(new Error('Agent returned invalid JSON.')); return; }
      if (!record(input) || Object.keys(input).some(key => !['requestId', 'commands'].includes(key))
        || input.requestId !== this.pending.requestId || !Array.isArray(input.commands) || input.commands.length > this.maxCommands
        || Array.from(input.commands).some(command => !validateCommand(command))) {
        this.fail(new Error('Agent returned a malformed or out-of-sequence decision.')); return;
      }
      this.pending.resolve(structuredClone(input) as unknown as AgentDecision);
    }
  }
  async ask(turn: AgentTurn, timeout: number, signal?: AbortSignal): Promise<AgentDecision> {
    this.stats.turns++;
    if (this.fault) throw this.fault;
    if (signal?.aborted) throw new Error('Tournament canceled.');
    if (this.pending) throw new Error('Agent already has an outstanding decision.');
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); this.pending = undefined; };
      const abort = () => { cleanup(); reject(new Error('Tournament canceled.')); };
      const timer = setTimeout(() => this.fail(new Error(`Agent response timed out after ${timeout} ms.`)), timeout);
      this.pending = {
        requestId: turn.requestId,
        resolve: decision => { cleanup(); resolve(decision); },
        reject: error => { cleanup(); reject(error); },
      };
      signal?.addEventListener('abort', abort, { once: true });
      this.process.stdin.write(JSON.stringify(turn) + '\n', error => { if (error) this.fail(new Error(`Agent request failed: ${message(error)}`)); });
    });
  }
  private kill(signal: NodeJS.Signals) {
    if (this.exited) return;
    try {
      if (process.platform === 'win32' || !this.process.pid) this.process.kill(signal);
      else process.kill(-this.process.pid, signal);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  }
  async stop() {
    this.stopping = true;
    this.process.stdin.end();
    await Promise.race([this.exit, delay(250)]);
    if (!this.exited) { this.kill('SIGTERM'); await Promise.race([this.exit, delay(250)]); }
    if (!this.exited) { this.kill('SIGKILL'); await this.exit; }
  }
}

async function sourceFiles(cwd: string): Promise<string[]> {
  const files: string[] = [];
  for (const directory of ['src/core', 'src/tournament', 'src/cli']) {
    for (const entry of await readdir(path.join(cwd, directory), { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.ts')) files.push(`${directory}/${entry.name}`);
    }
  }
  return files.sort();
}
async function executablePath(command: string, cwd: string): Promise<string> {
  if (command.includes('/') || command.includes('\\')) return path.resolve(cwd, command);
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    const candidate = path.resolve(directory || cwd, command);
    try { await access(candidate, constants.X_OK); return candidate; } catch { /* Try the next PATH entry. */ }
  }
  throw new Error(`Executable is not available: ${command}`);
}
export async function tournamentProvenance(config: TournamentConfig, cwd: string): Promise<TournamentProvenance> {
  const sources = await Promise.all((await sourceFiles(cwd)).map(async file => ({ path: file, sha256: sha256(await readFile(path.join(cwd, file))) })));
  const agents = [];
  for (const agent of config.agents) {
    const paths = new Set<string>([await executablePath(agent.command[0], cwd), ...(agent.sourceFiles ?? []).map(file => path.resolve(cwd, file))]);
    // A direct script argument is pinned even when sourceFiles was omitted.
    if (agent.command[1] && !agent.command[1].startsWith('-')) {
      const script = path.resolve(cwd, agent.command[1]);
      try { await access(script); paths.add(script); } catch { /* It may be an ordinary argument. */ }
    }
    const files = await Promise.all([...paths].sort().map(async file => ({ path: file, sha256: sha256(await readFile(file)) })));
    agents.push({ agentId: agent.id, command: [...agent.command], files });
  }
  return { contentSha256: sha256(tournamentContentText()), engineSha256: sha256(JSON.stringify(sources)), sources, agents,
    node: process.version, platform: process.platform, architecture: process.arch, saveVersion: SAVE_VERSION };
}
export interface TournamentRunOptions {
  cwd: string;
  /** New directory only: existing evidence is never overwritten. */
  outputDirectory?: string;
  id?: string;
  signal?: AbortSignal;
  onProgress?: (progress: TournamentProgress) => void;
}
async function writeJson(file: string, value: unknown) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  await rename(temporary, file);
}

async function runMatch(config: TournamentConfig, pairing: ReturnType<typeof tournamentSchedule>[number], options: TournamentRunOptions, report: TournamentReport): Promise<TournamentMatch> {
  const started = performance.now(), matchConfig = tournamentMatchConfig(config, pairing.seats, pairing.seed), state = createMatch(matchConfig);
  const recorder = new MatchRecorder(state), views = [new PlayerView(0), new PlayerView(1)];
  const processes = pairing.seats.map(agentId => new TerminalAgentProcess(config.agents.find(agent => agent.id === agentId)!, options.cwd, config.maxCommandsPerTurn));
  const decisions: TournamentMatch['decisions'] = [], checkpoints: TournamentMatch['checkpoints'] = [];
  let receipts: AgentReceipt[][] = [[], []], requestId = 0;
  let status: TournamentMatch['status'] = 'limit', winnerAgentId: string | null = null;
  const checkpoint = () => {
    const value = { tick: state.tick, stateSha256: stateHash(state) };
    if (checkpoints.at(-1)?.tick === state.tick) checkpoints[checkpoints.length - 1] = value;
    else checkpoints.push(value);
  };
  const progress = () => options.onProgress?.(tournamentProgress(report, { matchId: pairing.id, seats: pairing.seats, tick: state.tick, seconds: state.time }));
  checkpoint();
  try {
    progress();
    while (!isGameOver(state) && state.tick < config.maxSeconds * 20) {
      if (options.signal?.aborted) { status = 'aborted'; break; }
      requestId++;
      // Capture both views before applying either side's commands.
      const observations = views.map(view => view.observe(state));
      const replies = await Promise.allSettled(processes.map((agent, side) => agent.ask({ protocol: 'orcs-vs-fairies/tournament-agent', version: 1,
        type: 'turn', requestId, observation: observations[side], receipts: receipts[side] }, config.responseTimeoutMs, options.signal)));
      const canceled = options.signal?.aborted ?? false;
      // stdout can resolve a valid reply and then latch a protocol fault in the
      // same data event. Keep that fault even on the final decision of a match.
      const failures = replies.map((reply, side) => processes[side].failure
        ?? (reply.status === 'rejected' ? reply.reason : undefined));
      const failed = failures.map(failure => failure !== undefined);
      receipts = [[], []];
      // Alternate application priority. Neither agent observes the other response first.
      for (const side of (requestId % 2 ? [0, 1] : [1, 0]) as Array<0 | 1>) {
        const reply = replies[side], agent = processes[side];
        const fault = !canceled && failed[side] ? message(failures[side]) : null;
        if (fault) agent.stats.fault = fault;
        const commands = reply.status === 'fulfilled' ? reply.value.commands : [];
        for (const command of commands) {
          const accepted = canceled || failed.some(Boolean) ? false : issueCommand(state, side, command);
          receipts[side].push({ command: structuredClone(command), accepted });
          if (accepted) agent.stats.accepted++; else agent.stats.rejected++;
        }
        decisions.push({ tick: state.tick, requestId, side, observationSha256: sha256(JSON.stringify(observations[side])),
          commands: structuredClone(receipts[side]), fault });
      }
      checkpoint();
      if (canceled) { status = 'aborted'; break; }
      if (failed.some(Boolean)) {
        status = failed.every(Boolean) ? 'double-forfeit' : 'forfeit';
        winnerAgentId = failed.every(Boolean) ? null : pairing.seats[failed[0] ? 1 : 0];
        break;
      }
      const ticks = Math.min(config.decisionTicks, config.maxSeconds * 20 - state.tick);
      for (let offset = 0; offset < ticks && !isGameOver(state); offset++) {
        stepGame(state, .05);
        for (const view of views) view.update(state);
      }
      checkpoint();
      progress();
    }
    if (isGameOver(state)) { status = 'battle'; winnerAgentId = state.draw ? null : pairing.seats[state.winner as 0 | 1]; }
    checkpoint();
  } finally {
    await Promise.all(processes.map(agent => agent.stop()));
    recorder.dispose();
  }
  const replay = recorder.export();
  // Replay every match through the shared replay implementation before publishing it.
  const verification = new ReplayPlayer(replay);
  try { verification.seek(replay.finalTick); if (stateHash(verification.state) !== stateHash(state)) throw new Error('Tournament replay final state diverged.'); }
  finally { verification.dispose(); }
  return { ...pairing, config: matchConfig, status, winnerAgentId, finalTick: state.tick, seconds: state.time,
    elapsedMs: performance.now() - started, agents: processes.map(agent => ({ ...agent.stats })) as [AgentRunStats, AgentRunStats],
    finalStateSha256: stateHash(state), transcriptSha256: sha256(JSON.stringify(decisions)), decisions, checkpoints, replay };
}

export async function runTournament(input: unknown, options: TournamentRunOptions): Promise<TournamentReport> {
  const config = decodeTournamentConfig(input), cwd = path.resolve(options.cwd), output = options.outputDirectory && path.resolve(options.outputDirectory);
  if (output) { await mkdir(path.dirname(output), { recursive: true }); await mkdir(output); }
  const report: TournamentReport = { format: 'orcs-vs-fairies/tournament', version: 1, id: options.id ?? `run-${randomUUID()}`,
    createdAt: new Date().toISOString(), finishedAt: null, status: 'running', error: null,
    config, provenance: await tournamentProvenance(config, cwd), matches: [] };
  options = { ...options, cwd };
  try {
    options.onProgress?.(tournamentProgress(report));
    for (const pairing of tournamentSchedule(config)) {
      if (options.signal?.aborted) { report.status = 'canceled'; break; }
      const match = await runMatch(config, pairing, options, report);
      report.matches.push(match);
      if (output) {
        await writeJson(path.join(output, `${match.id}.replay.json`), match.replay);
        const { replay, ...evidence } = match;
        await writeJson(path.join(output, `${match.id}.evidence.json`), evidence);
      }
      options.onProgress?.(tournamentProgress(report));
      if (match.status === 'aborted') { report.status = 'canceled'; break; }
    }
    if (report.status === 'running') report.status = 'complete';
  } catch (error) { report.status = 'failed'; report.error = message(error); }
  report.finishedAt = new Date().toISOString();
  if (output) await writeJson(path.join(output, 'tournament.json'), report);
  options.onProgress?.(tournamentProgress(report));
  return report;
}
