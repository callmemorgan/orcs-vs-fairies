import type { BuildingRole, Cost, Entity, FactionId, GameState, MapSize, ResourceKind, Side, TerrainKind, UnitRole, Vec } from './types';
import type { SaveEnvelope } from './saves';
import type { WorldMapData } from './world-types';
import type { ContentBundle } from './content-registry';

export type ScenarioCondition =
  | { type: 'alive' | 'dead'; actor: string }
  | { type: 'at'; actor: string; point: Vec; radius: number }
  | { type: 'time'; seconds: number }
  | { type: 'variable'; key: string; op: 'eq' | 'gte' | 'lte'; value: number }
  | { type: 'cleared'; side: Side; buildings?: boolean }
  | { type: 'all' | 'any'; conditions: ScenarioCondition[] }
  | { type: 'not'; condition: ScenarioCondition };

export type ScenarioOrder =
  | ({ type: 'move' | 'attackMove' } & Vec)
  | { type: 'hold' | 'stop' | 'ability' }
  | { type: 'attack'; actor: string };

export interface ScenarioActor extends Vec {
  label: string;
  side: Side;
  kind: Entity['kind'];
  role: UnitRole | BuildingRole;
  /** An admitted same-role definition from the actor's faction. */
  definitionId?: string;
  hp?: number;
  order?: ScenarioOrder;
}

export interface ScenarioMap {
  size: MapSize;
  width: number;
  height: number;
  terrain: TerrainKind[];
  starts: Vec[];
  resources: Array<Vec & { kind: ResourceKind; amount: number; maxAmount: number }>;
  world?: WorldMapData;
}

export type ScenarioAction =
  | { type: 'spawn'; actors: ScenarioActor[] }
  | { type: 'order'; actors: string[]; order: ScenarioOrder }
  | { type: 'set' | 'add'; key: string; value: number }
  | { type: 'message'; text: string; speaker?: string }
  | { type: 'reward'; side: Side; resources: Cost }
  | { type: 'alliance'; allied: boolean }
  | { type: 'finish'; outcome: 'won' | 'lost'; reason: string };

export interface ScenarioTrigger {
  id: string;
  when: ScenarioCondition;
  actions: ScenarioAction[];
  /** Repeated triggers always wait at least one second. */
  repeat?: { seconds: number; count: number };
}

export interface ScenarioObjective {
  id: string;
  text: string;
  success: ScenarioCondition;
  failure?: ScenarioCondition;
  optional?: boolean;
}

export interface ScenarioDefinition {
  schemaVersion: 1;
  id: string;
  title: string;
  briefing: string;
  successText: string;
  failureText: string;
  faction: FactionId;
  opponent: FactionId;
  seed: number;
  content?: ContentBundle;
  map?: ScenarioMap;
  army: ScenarioActor[];
  objectives: ScenarioObjective[];
  events: ScenarioTrigger[];
  rules: { fixedArmy: boolean; reinforcementBudget: number; resources: Cost; timeLimit: number };
  escort?: { actor: string; route: Vec[]; radius: number; escortRadius: number };
  stealth?: {
    infiltrators: string[];
    guards: string[];
    alarmLimit: number;
    detectionSeconds: number;
    radius: number;
    coneDegrees: number;
    patrols: Array<{ actor: string; route: Vec[] }>;
  };
  boss?: {
    actor: string;
    name: string;
    health: number;
    phases: Array<{ below: number; name: string; radius: number; damage: number; warningSeconds: number; cooldown: number; interruptDamage: number; adds: ScenarioActor[] }>;
  };
  /** Completed player actions are counted by the shared command path. */
  requiredActions?: Array<{ action: 'ability' | 'hold' | 'repair' | 'gather'; count: number; text: string }>;
}

export interface ScenarioTelegraph extends Vec {
  radius: number;
  resolveAt: number;
  source: number;
  phase: number;
  hpAtStart: number;
  interrupted: boolean;
}

export interface ScenarioRuntime {
  version: 1;
  /** A simulation tick may be forwarded by both core and a client callback. */
  lastEvaluatedTick: number;
  definitionId: string;
  outcome: 'playing' | 'won' | 'lost';
  reason: string;
  labels: Record<string, number>;
  variables: Record<string, number>;
  triggers: Record<string, { count: number; lastTime: number }>;
  completed: string[];
  messages: Array<{ time: number; text: string; speaker?: string }>;
  reinforcementRemaining: number;
  escort: { checkpoint: number; moving: boolean };
  stealth: { alarms: number; exposure: Record<string, number>; detected: string[]; patrol: Record<string, number>; distractedUntil: Record<string, number> };
  boss: { phase: number; nextAttack: number; telegraph: ScenarioTelegraph | null; phasesEntered: number[]; interrupted: number; hits: number; dodged: number };
  commandCounts: Record<string, number>;
}

export interface ScenarioSession { definition: ScenarioDefinition; state: GameState; runtime: ScenarioRuntime }
export interface ScenarioBinding { definition: ScenarioDefinition; runtime: ScenarioRuntime }
export interface ScenarioCheckpoint { format: 'orcs-vs-fairies-scenario'; version: 1; definition: ScenarioDefinition; runtime: ScenarioRuntime; game: SaveEnvelope }

export interface CampaignChoice { id: string; text: string; consequence: string; chapter3: string }
export interface CampaignDefinition {
  id: string;
  faction: FactionId;
  title: string;
  commander: string;
  cast: Array<{ name: string; role: string }>;
  introduction: string;
  chapters: [string, string, string, string];
  choice: { prompt: string; options: [CampaignChoice, CampaignChoice] };
}
