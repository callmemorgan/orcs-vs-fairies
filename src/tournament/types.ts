import type { ReplayArchive } from '../core/replays';
import type { Age, Command, Cost, FactionId, MapSize, MatchConfig } from '../core/types';

export interface TournamentAgent {
  id: string;
  name: string;
  faction: FactionId;
  /** Executable and arguments, passed to spawn without a shell. */
  command: string[];
  sourceFiles?: string[];
}
export interface TournamentConfig {
  version: 1;
  id: string;
  name: string;
  agents: TournamentAgent[];
  seeds: number[];
  mapSize: MapSize;
  bothSeats: boolean;
  maxSeconds: number;
  decisionTicks: number;
  responseTimeoutMs: number;
  maxCommandsPerTurn: number;
  startingAge?: Age;
  startingResources?: Cost;
}
export interface AgentReceipt { command: Command; accepted: boolean }
export interface AgentTurn {
  protocol: 'orcs-vs-fairies/tournament-agent';
  version: 1;
  type: 'turn';
  requestId: number;
  observation: unknown;
  receipts: AgentReceipt[];
}
export interface AgentDecision { requestId: number; commands: Command[] }
export interface AgentRunStats {
  agentId: string;
  pid: number | null;
  turns: number;
  accepted: number;
  rejected: number;
  fault: string | null;
  stderr: string;
  stderrTruncated: boolean;
  exitCode: number | null;
  exitSignal: string | null;
}
export interface TournamentDecision {
  tick: number;
  requestId: number;
  side: 0 | 1;
  observationSha256: string;
  commands: AgentReceipt[];
  fault: string | null;
}
export interface TournamentCheckpoint { tick: number; stateSha256: string }
export type TournamentMatchStatus = 'battle' | 'limit' | 'forfeit' | 'double-forfeit' | 'aborted';
export interface TournamentMatch {
  id: string;
  index: number;
  seed: number;
  seats: [string, string];
  config: MatchConfig;
  status: TournamentMatchStatus;
  winnerAgentId: string | null;
  finalTick: number;
  seconds: number;
  elapsedMs: number;
  agents: [AgentRunStats, AgentRunStats];
  finalStateSha256: string;
  transcriptSha256: string;
  decisions: TournamentDecision[];
  checkpoints: TournamentCheckpoint[];
  replay: ReplayArchive;
}
export interface TournamentProvenance {
  contentSha256: string;
  engineSha256: string;
  sources: Array<{ path: string; sha256: string }>;
  agents: Array<{ agentId: string; command: string[]; files: Array<{ path: string; sha256: string }> }>;
  node: string;
  platform: string;
  architecture: string;
  saveVersion: number;
}
export interface TournamentStanding {
  agentId: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  forfeits: number;
  incomplete: number;
  points: number;
}
export interface TournamentReport {
  format: 'orcs-vs-fairies/tournament';
  version: 1;
  id: string;
  createdAt: string;
  finishedAt: string | null;
  status: 'running' | 'complete' | 'canceled' | 'failed';
  error: string | null;
  config: TournamentConfig;
  provenance: TournamentProvenance;
  matches: TournamentMatch[];
}
export interface TournamentChoice {
  id: string;
  name: string;
  agents: Array<Pick<TournamentAgent, 'id' | 'name' | 'faction'>>;
  seeds: number[];
  mapSize: MapSize;
  bothSeats: boolean;
  maxSeconds: number;
}
export interface TournamentProgress {
  id: string;
  status: TournamentReport['status'];
  totalMatches: number;
  completedMatches: number;
  standings: TournamentStanding[];
  current: { matchId: string; seats: [string, string]; tick: number; seconds: number } | null;
  error: string | null;
}
export interface TournamentDashboardSource {
  choices: () => Promise<TournamentChoice[]>;
  start: (configId: string) => Promise<{ id: string }>;
  status: (id: string) => Promise<TournamentProgress>;
  result: (id: string) => Promise<TournamentReport>;
  cancel: (id: string) => Promise<void>;
}
