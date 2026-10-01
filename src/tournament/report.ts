import { ABILITIES, ECONOMY, FACTIONS, UPGRADES } from '../core/content';
import { validateCommand } from '../core/commands';
import { decodeReplay, replayChecksum, ReplayPlayer } from '../core/replays';
import { loadGame, saveGame } from '../core/saves';
import { createMatch, isGameOver } from '../core/simulation';
import type { GameState, MatchConfig } from '../core/types';
import type {
  AgentRunStats, TournamentConfig, TournamentMatch, TournamentProgress,
  TournamentReport, TournamentStanding,
} from './types';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max = 2000): value is string => typeof value === 'string' && value.length <= max;
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value);
function shape(value: unknown, keys: string[], label: string): asserts value is Record<string, unknown> {
  if (!object(value) || Object.keys(value).some(key => !keys.includes(key))) throw new Error(`Invalid ${label}.`);
}
function ensure(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`Invalid ${label}.`);
}
function dense(value: unknown, min: number, max: number): value is unknown[] {
  return Array.isArray(value) && value.length >= min && value.length <= max
    && Array.from({ length: value.length }, (_, index) => Object.hasOwn(value, index)).every(Boolean);
}

export function decodeTournamentConfig(input: unknown): TournamentConfig {
  shape(input, ['version', 'id', 'name', 'agents', 'seeds', 'mapSize', 'bothSeats', 'maxSeconds', 'decisionTicks', 'responseTimeoutMs', 'maxCommandsPerTurn', 'startingAge', 'startingResources'], 'tournament configuration');
  ensure(input.version === 1 && id(input.id) && text(input.name, 80) && input.name.trim(), 'tournament identity');
  ensure(dense(input.agents, 2, 16), 'tournament agents');
  const names = new Set<string>();
  for (const agent of input.agents) {
    shape(agent, ['id', 'name', 'faction', 'command', 'sourceFiles'], 'tournament agent');
    ensure(id(agent.id) && !names.has(agent.id) && text(agent.name, 80) && agent.name.trim(), 'agent identity');
    names.add(agent.id);
    ensure(typeof agent.faction === 'string' && Object.hasOwn(FACTIONS, agent.faction), 'agent faction');
    ensure(dense(agent.command, 1, 32) && agent.command.every(token => text(token, 4096) && !token.includes('\0')) && !!agent.command[0], 'agent command');
    if (agent.sourceFiles !== undefined) ensure(dense(agent.sourceFiles, 0, 32) && agent.sourceFiles.every(path => text(path, 4096) && !!path) && new Set(agent.sourceFiles).size === agent.sourceFiles.length, 'agent source files');
  }
  ensure(dense(input.seeds, 1, 16) && input.seeds.every(seed => integer(seed, 0, 0xffffffff)) && new Set(input.seeds).size === input.seeds.length, 'tournament seeds');
  ensure(['small', 'medium', 'large', 'huge'].includes(input.mapSize as string) && typeof input.bothSeats === 'boolean', 'tournament map');
  ensure(integer(input.maxSeconds, 1, 2700) && integer(input.decisionTicks, 1, 1200)
    && integer(input.responseTimeoutMs, 100, 30000) && integer(input.maxCommandsPerTurn, 1, 64), 'tournament limits');
  if (input.startingAge !== undefined) ensure(integer(input.startingAge, 1, 3), 'starting age');
  if (input.startingResources !== undefined) {
    const resources = input.startingResources;
    shape(resources, ['wood', 'ore', 'crystal'], 'starting resources');
    ensure(['wood', 'ore', 'crystal'].every(kind => typeof resources[kind] === 'number' && Number.isFinite(resources[kind])
      && resources[kind] >= 0 && resources[kind] <= 1e9), 'starting resources');
  }
  const config = structuredClone(input) as unknown as TournamentConfig;
  ensure(tournamentSchedule(config).length <= 128, 'tournament schedule (maximum 128 matches)');
  return config;
}

export function tournamentSchedule(config: TournamentConfig): Array<{ id: string; index: number; seed: number; seats: [string, string] }> {
  const schedule: Array<{ id: string; index: number; seed: number; seats: [string, string] }> = [];
  for (const seed of config.seeds) for (let left = 0; left < config.agents.length; left++) for (let right = left + 1; right < config.agents.length; right++) {
    for (const seats of [[config.agents[left].id, config.agents[right].id], ...(config.bothSeats ? [[config.agents[right].id, config.agents[left].id]] : [])]) {
      const index = schedule.length;
      schedule.push({ id: `match-${String(index + 1).padStart(3, '0')}`, index, seed, seats: seats as [string, string] });
    }
  }
  return schedule;
}
export function tournamentMatchConfig(config: TournamentConfig, seats: [string, string], seed: number): MatchConfig {
  return {
    schemaVersion: 1, map: { seed, size: config.mapSize },
    players: seats.map((agentId, side) => ({ id: side as 0 | 1, teamId: side as 0 | 1,
      factionId: config.agents.find(agent => agent.id === agentId)!.faction, controller: 'external' as const,
      ...(config.startingResources ? { handicap: { startingResources: { ...config.startingResources } } } : {}),
    })),
    rules: { sharedVision: false, startingAge: config.startingAge ?? 1 },
  };
}
export function tournamentStandings(report: Pick<TournamentReport, 'config' | 'matches'>): TournamentStanding[] {
  const rows = new Map(report.config.agents.map(agent => [agent.id, {
    agentId: agent.id, name: agent.name, played: 0, wins: 0, losses: 0, draws: 0, forfeits: 0, incomplete: 0, points: 0,
  }]));
  for (const match of report.matches) for (const agentId of match.seats) {
    const row = rows.get(agentId)!;
    row.played++;
    if (match.status === 'limit' || match.status === 'aborted' || match.status === 'double-forfeit') row.incomplete++;
    else if (match.winnerAgentId === null) { row.draws++; row.points++; }
    else if (match.winnerAgentId === agentId) { row.wins++; row.points += 3; }
    else row.losses++;
    if (match.agents.find(agent => agent.agentId === agentId)?.fault) row.forfeits++;
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.agentId.localeCompare(b.agentId));
}
export function tournamentProgress(report: TournamentReport, current: TournamentProgress['current'] = null): TournamentProgress {
  return { id: report.id, status: report.status, totalMatches: tournamentSchedule(report.config).length,
    completedMatches: report.matches.length, standings: tournamentStandings(report), current, error: report.error };
}
export function tournamentContentText(): string { return JSON.stringify({ FACTIONS, ABILITIES, UPGRADES, ECONOMY }); }
export function tournamentStateText(state: GameState): string {
  const saved = saveGame(state);
  saved.state.visible = saved.state.visible.map(cells => cells.sort((a, b) => a - b));
  saved.state.explored = saved.state.explored.map(cells => cells.sort((a, b) => a - b));
  return JSON.stringify(saved);
}
export async function tournamentSha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function decodeStats(input: unknown, agentId: string): AgentRunStats {
  shape(input, ['agentId', 'pid', 'turns', 'accepted', 'rejected', 'fault', 'stderr', 'stderrTruncated', 'exitCode', 'exitSignal'], 'agent process statistics');
  ensure(input.agentId === agentId && (input.pid === null || integer(input.pid, 1)) && integer(input.turns)
    && integer(input.accepted) && integer(input.rejected) && (input.fault === null || text(input.fault) && !!input.fault)
    && text(input.stderr, 16384) && typeof input.stderrTruncated === 'boolean'
    && (input.exitCode === null || integer(input.exitCode, 0, 255)) && (input.exitSignal === null || text(input.exitSignal, 80)), 'agent process statistics');
  return structuredClone(input) as unknown as AgentRunStats;
}
export function decodeTournamentReport(value: unknown): TournamentReport {
  if (typeof value === 'string') {
    ensure(value.length <= 64 * 1024 * 1024, 'tournament report size (maximum 64 MiB)');
    try { value = JSON.parse(value); } catch { throw new Error('Invalid tournament JSON.'); }
  }
  shape(value, ['format', 'version', 'id', 'createdAt', 'finishedAt', 'status', 'error', 'config', 'provenance', 'matches'], 'tournament report');
  ensure(value.format === 'orcs-vs-fairies/tournament' && value.version === 1 && id(value.id), 'tournament report identity');
  ensure(text(value.createdAt, 80) && Number.isFinite(Date.parse(value.createdAt))
    && (value.finishedAt === null || text(value.finishedAt, 80) && Number.isFinite(Date.parse(value.finishedAt))), 'tournament dates');
  ensure(['running', 'complete', 'canceled', 'failed'].includes(value.status as string)
    && (value.error === null || text(value.error) && !!value.error), 'tournament result');
  ensure((value.status === 'running') === (value.finishedAt === null) && (value.status === 'failed') === (value.error !== null), 'tournament completion');
  const config = decodeTournamentConfig(value.config), schedule = tournamentSchedule(config);
  shape(value.provenance, ['contentSha256', 'engineSha256', 'sources', 'agents', 'node', 'platform', 'architecture', 'saveVersion'], 'tournament provenance');
  const provenance = value.provenance;
  ensure(hash(provenance.contentSha256) && hash(provenance.engineSha256) && text(provenance.node, 80)
    && text(provenance.platform, 80) && text(provenance.architecture, 80) && integer(provenance.saveVersion, 1, 100), 'tournament version pins');
  function files(input: unknown) {
    ensure(dense(input, 1, 256), 'pinned source files');
    const paths = new Set<string>();
    for (const file of input) {
      shape(file, ['path', 'sha256'], 'source pin');
      ensure(text(file.path, 4096) && !!file.path && !paths.has(file.path) && hash(file.sha256), 'source pin');
      paths.add(file.path);
    }
  }
  files(provenance.sources);
  ensure(dense(provenance.agents, config.agents.length, config.agents.length), 'agent version pins');
  for (const [index, pin] of provenance.agents.entries()) {
    shape(pin, ['agentId', 'command', 'files'], 'agent pin');
    ensure(pin.agentId === config.agents[index].id && JSON.stringify(pin.command) === JSON.stringify(config.agents[index].command), 'agent command pin');
    files(pin.files);
  }
  ensure(dense(value.matches, 0, schedule.length) && (value.status !== 'complete' || value.matches.length === schedule.length), 'recorded matches');
  const matches: TournamentMatch[] = [];
  for (const [index, input] of value.matches.entries()) {
    shape(input, ['id', 'index', 'seed', 'seats', 'config', 'status', 'winnerAgentId', 'finalTick', 'seconds', 'elapsedMs', 'agents', 'finalStateSha256', 'transcriptSha256', 'decisions', 'checkpoints', 'replay'], 'match result');
    const pairing = schedule[index];
    ensure(input.id === pairing.id && input.index === index && input.seed === pairing.seed && JSON.stringify(input.seats) === JSON.stringify(pairing.seats), 'match schedule');
    ensure(['battle', 'limit', 'forfeit', 'double-forfeit', 'aborted'].includes(input.status as string)
      && (input.winnerAgentId === null || pairing.seats.includes(input.winnerAgentId as string))
      && integer(input.finalTick, 0, config.maxSeconds * 20) && typeof input.seconds === 'number' && Number.isFinite(input.seconds)
      && input.seconds >= 0 && Math.abs(input.seconds - input.finalTick * .05) < .000001
      && typeof input.elapsedMs === 'number' && Number.isFinite(input.elapsedMs) && input.elapsedMs >= 0
      && hash(input.finalStateSha256) && hash(input.transcriptSha256), 'match outcome');
    const matchConfig = tournamentMatchConfig(config, pairing.seats, pairing.seed);
    const configured = createMatch(input.config as MatchConfig), expected = createMatch(matchConfig);
    ensure(replayChecksum(configured) === replayChecksum(expected), 'pinned match configuration');
    ensure(dense(input.agents, 2, 2), 'match processes');
    const agents = input.agents.map((stats, side) => decodeStats(stats, pairing.seats[side])) as [AgentRunStats, AgentRunStats];
    ensure(dense(input.decisions, 0, 108002) && dense(input.checkpoints, 1, 54002), 'match evidence');
    let previousTick = -1;
    for (const checkpoint of input.checkpoints) {
      shape(checkpoint, ['tick', 'stateSha256'], 'match checkpoint');
      ensure(integer(checkpoint.tick, 0, input.finalTick) && checkpoint.tick > previousTick && hash(checkpoint.stateSha256), 'match checkpoint');
      previousTick = checkpoint.tick;
    }
    ensure((input.checkpoints[0] as { tick: number }).tick === 0 && previousTick === input.finalTick
      && (input.checkpoints.at(-1) as { stateSha256: string }).stateSha256 === input.finalStateSha256, 'final checkpoint');
    let lastDecisionTick = -1;
    for (const decision of input.decisions) {
      shape(decision, ['tick', 'requestId', 'side', 'observationSha256', 'commands', 'fault'], 'agent decision');
      ensure(integer(decision.tick, 0, input.finalTick) && decision.tick >= lastDecisionTick
        && integer(decision.requestId, 1) && (decision.side === 0 || decision.side === 1) && hash(decision.observationSha256)
        && (decision.fault === null || text(decision.fault) && !!decision.fault) && dense(decision.commands, 0, config.maxCommandsPerTurn), 'agent decision');
      lastDecisionTick = decision.tick;
      for (const receipt of decision.commands) {
        shape(receipt, ['command', 'accepted'], 'command receipt');
        ensure(validateCommand(receipt.command) && typeof receipt.accepted === 'boolean', 'command receipt');
      }
    }
    const replay = decodeReplay(input.replay);
    ensure(replay.finalTick === input.finalTick && replay.initial.state.tick === 0
      && tournamentStateText(expected) === tournamentStateText(loadGame(replay.initial)), 'initial replay configuration');
    matches.push({ ...(structuredClone(input) as unknown as TournamentMatch), config: matchConfig, agents, replay });
  }
  return { ...(structuredClone(value) as unknown as TournamentReport), config, matches };
}

/** Verify the simulation and recorded checkpoints; process faults remain explicit external outcomes. */
export async function verifyTournamentReport(input: unknown, onProgress?: (completed: number, total: number) => void): Promise<TournamentReport> {
  const report = decodeTournamentReport(input);
  ensure(await tournamentSha256(tournamentContentText()) === report.provenance.contentSha256, 'content version for this build');
  ensure(await tournamentSha256(JSON.stringify(report.provenance.sources)) === report.provenance.engineSha256, 'engine source pin');
  for (const [index, match] of report.matches.entries()) {
    ensure(await tournamentSha256(JSON.stringify(match.decisions)) === match.transcriptSha256, 'decision transcript checksum');
    const accepted = match.decisions.flatMap(decision => decision.commands.filter(receipt => receipt.accepted).map(receipt => ({ tick: decision.tick, side: decision.side, command: receipt.command })));
    let tick = 0;
    const recorded = match.replay.actions.flatMap(action => {
      if (action.type === 'advance') { tick += action.ticks; return []; }
      return [{ tick, side: action.side, command: action.command }];
    });
    ensure(JSON.stringify(accepted) === JSON.stringify(recorded), 'accepted-command replay evidence');
    const player = new ReplayPlayer(match.replay);
    try {
      for (const checkpoint of match.checkpoints) {
        while (player.state.tick < checkpoint.tick) {
          player.advance(Math.min(200, checkpoint.tick - player.state.tick));
          await new Promise<void>(resolve => setTimeout(resolve, 0));
        }
        ensure(await tournamentSha256(tournamentStateText(player.state)) === checkpoint.stateSha256, `replay checkpoint at tick ${checkpoint.tick}`);
      }
      ensure(player.finished, 'completed replay');
      const finished = isGameOver(player.state), faults = match.agents.map(agent => !!agent.fault);
      if (match.status === 'battle') ensure(finished && !faults.some(Boolean)
        && match.winnerAgentId === (player.state.draw ? null : match.seats[player.state.winner as 0 | 1]), 'battle outcome');
      else if (match.status === 'forfeit') ensure(!finished && faults.filter(Boolean).length === 1
        && match.winnerAgentId === match.seats[faults[0] ? 1 : 0], 'process forfeit');
      else if (match.status === 'double-forfeit') ensure(!finished && faults.every(Boolean) && match.winnerAgentId === null, 'double forfeit');
      else if (match.status === 'limit') ensure(!finished && !faults.some(Boolean) && match.winnerAgentId === null && match.finalTick === report.config.maxSeconds * 20, 'time limit');
      else ensure(!finished && match.winnerAgentId === null && report.status === 'canceled', 'canceled match');
      for (const [side, agent] of match.agents.entries()) {
        const decisions = match.decisions.filter(decision => decision.side === side);
        ensure(agent.turns === decisions.length && agent.accepted === decisions.flatMap(decision => decision.commands).filter(receipt => receipt.accepted).length
          && agent.rejected === decisions.flatMap(decision => decision.commands).filter(receipt => !receipt.accepted).length, 'process command totals');
      }
    } finally { player.dispose(); }
    onProgress?.(index + 1, report.matches.length);
  }
  return report;
}
