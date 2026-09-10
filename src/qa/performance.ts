import { FACTIONS } from '../core/content';
import { createGame, refreshVisibility } from '../core/simulation';
import type { BuildingRole, Entity, GameState, Side, UnitRole } from '../core/types';

export const PERFORMANCE_CENTER = { x: 24, y: 24 } as const;
export const PERFORMANCE_UNIT_COUNT = 100;
export const PERFORMANCE_WARMUP_MS = 5_000;
export const PERFORMANCE_SAMPLE_MS = 60_000;

/** Synthetic render workload. Never use this fixture as match-outcome evidence. */
export function createPerformanceGame(): GameState {
  const state = createGame('orcs', 4127); state.terrain.fill('grass');state.controllers=['external','external'];
  state.entities = [];
  // Keep peripheral deposits, but leave a clear central combat area.
  state.resources = state.resources.filter(r => r.x < 18 || r.x > 30 || r.y < 18 || r.y > 30);
  const spawn = (side: Side, kind: Entity['kind'], role: UnitRole | BuildingRole, x: number, y: number): Entity => {
    const faction = FACTIONS[state.players[side].faction];
    const def = kind === 'unit' ? faction.units[role as UnitRole] : faction.buildings[role as BuildingRole];
    const hp = kind === 'unit' ? 1_000_000 : def.hp;
    const entity: Entity = { id: state.nextId++, side, kind, role, x, y, hp, maxHp: hp, order: { type: 'idle' }, cooldown: 0, progress: 1, queue: [], trainProgress: 0, facing: side === 0 ? 0 : 4, animation: 'idle', animTime: 0, momentum: 0, illusion: false, expires: 0, carried: 0, carriedKind: 'wood', path: [] };
    state.entities.push(entity);
    return entity;
  };
  const buildings: [BuildingRole, number, number][] = [
    ['hq', 8, 8], ['depot', 4, 8], ['depot', 8, 4], ['depot', 12, 8], ['depot', 8, 12], ['barracks', 4, 4], ['tower', 12, 12],
  ];
  for (const side of [0, 1] as const) {
    for (const [role, x, y] of buildings) spawn(side, 'building', role, side === 0 ? x : 47 - x, side === 0 ? y : 47 - y);
    state.players[side].wood = state.players[side].ore = 0;
    state.players[side].population = 50;
    state.players[side].cap = 52;
  }
  const roles: UnitRole[] = ['worker', 'melee', 'ranged', 'special'];
  for (let i = 0; i < 50; i++) {
    const x = 20.2 + (i % 5) * 1.7, y = 20.2 + Math.floor(i / 5) * .85;
    const a = spawn(0, 'unit', roles[i % roles.length], x, y);
    const b = spawn(1, 'unit', roles[i % roles.length], x + .8, y);
    // Explicit attack orders exercise combat animation without auto-casting
    // illusions. Large fixture HP retains exactly 100 units during sampling.
    a.order = { type: 'attack', target: b.id };
    b.order = { type: 'attack', target: a.id };
  }
  state.time = 0;
  state.winner = null;
  state.events = [];
  state.explored[0].clear(); state.explored[1].clear();
  refreshVisibility(state);
  return state;
}

export interface UnitCounts { alive: number; visible: number; onScreen: number }
/** The caller supplies actual camera containment; fog visibility alone is insufficient. */
export function countPerformanceUnits(state: GameState, onScreen: (entity: Entity) => boolean): UnitCounts {
  const alive = state.entities.filter(e => e.kind === 'unit' && e.hp > 0);
  const visible = alive.filter(e => e.side === 0 || state.visible[0].has(Math.floor(e.y) * state.width + Math.floor(e.x)));
  return { alive: alive.length, visible: visible.length, onScreen: visible.filter(onScreen).length };
}

export interface FrameMetadata {
  units: UnitCounts;
  viewport: { width: number; height: number };
  canvas: { width: number; height: number };
  drawingBuffer: { width: number; height: number };
  devicePixelRatio: number;
  documentVisible: boolean;
  artLoaded: boolean;
  paused: boolean;
}
export interface PerformanceSummary {
  phase: 'waiting' | 'warmup' | 'sampling' | 'complete';
  warmupMs: number;
  requestedSampleMs: number;
  elapsedMs: number;
  sampledMs: number;
  frames: number;
  averageFps: number | null;
  medianFrameMs: number | null;
  p95FrameMs: number | null;
  p99FrameMs: number | null;
  minUnits: UnitCounts | null;
  maxUnits: UnitCounts | null;
  firstMetadata: FrameMetadata | null;
  lastMetadata: FrameMetadata | null;
  valid: boolean;
  invalidReasons: string[];
}

/** Records actual browser/render timestamps. No Phaser smoothed FPS estimates. */
export class FrameCollector {
  private firstTimestamp: number | null = null;
  private lastTimestamp: number | null = null;
  private elapsed = 0;
  private intervals: number[] = [];
  private duration = 0;
  private firstMetadata: FrameMetadata | null = null;
  private lastMetadata: FrameMetadata | null = null;
  private minimum: UnitCounts | null = null;
  private maximum: UnitCounts | null = null;
  private invalid = new Set<string>();
  constructor(readonly warmupMs = PERFORMANCE_WARMUP_MS, readonly sampleMs = PERFORMANCE_SAMPLE_MS) {
    if (!Number.isFinite(warmupMs) || warmupMs < 0 || !Number.isFinite(sampleMs) || sampleMs <= 0) throw new Error('Invalid benchmark duration');
  }
  record(timestampMs: number, metadata: FrameMetadata): PerformanceSummary['phase'] {
    if (!Number.isFinite(timestampMs)) throw new Error('Frame timestamp must be finite');
    if (this.phase === 'complete') return this.phase;
    if (this.lastTimestamp !== null && timestampMs <= this.lastTimestamp) throw new Error('Record once per frame with increasing timestamps');
    this.firstTimestamp ??= timestampMs;
    const previous = this.lastTimestamp;
    this.lastTimestamp = timestampMs;
    this.elapsed = timestampMs - this.firstTimestamp;
    // Exclude the interval straddling the warmup boundary. Keep the full final
    // frame and report actual sampled duration rather than truncating a stall.
    if (previous !== null && previous - this.firstTimestamp >= this.warmupMs) {
      const interval = timestampMs - previous;
      this.intervals.push(interval); this.duration += interval;
      this.inspect(metadata);
    }
    return this.phase;
  }
  get phase(): PerformanceSummary['phase'] {
    if (this.firstTimestamp === null) return 'waiting';
    if (this.elapsed < this.warmupMs) return 'warmup';
    return this.duration >= this.sampleMs ? 'complete' : 'sampling';
  }
  private inspect(metadata: FrameMetadata) {
    const snapshot = structuredClone(metadata);
    this.firstMetadata ??= snapshot; this.lastMetadata = snapshot;
    this.minimum ??= { ...metadata.units }; this.maximum ??= { ...metadata.units };
    for (const key of ['alive', 'visible', 'onScreen'] as const) {
      this.minimum[key] = Math.min(this.minimum[key], metadata.units[key]);
      this.maximum[key] = Math.max(this.maximum[key], metadata.units[key]);
      if (metadata.units[key] !== PERFORMANCE_UNIT_COUNT) this.invalid.add(`${key} unit count was not 100`);
    }
    if (!metadata.documentVisible) this.invalid.add('Document was hidden during sampling');
    if (metadata.paused) this.invalid.add('Simulation was paused during sampling');
    if (!metadata.artLoaded) this.invalid.add('Final artwork was not loaded during sampling');
    for (const key of ['viewport', 'canvas', 'drawingBuffer'] as const) {
      if (!Number.isFinite(metadata[key].width) || !Number.isFinite(metadata[key].height) || metadata[key].width <= 0 || metadata[key].height <= 0) this.invalid.add(`${key} dimensions were invalid`);
      if (metadata[key].width !== 1920 || metadata[key].height !== 1080) this.invalid.add(`${key} was not 1920×1080`);
      if (metadata[key].width !== this.firstMetadata[key].width || metadata[key].height !== this.firstMetadata[key].height) this.invalid.add(`${key} dimensions changed during sampling`);
    }
    if (!Number.isFinite(metadata.devicePixelRatio) || metadata.devicePixelRatio <= 0) this.invalid.add('Device pixel ratio was invalid');
    if (metadata.devicePixelRatio !== this.firstMetadata.devicePixelRatio) this.invalid.add('Device pixel ratio changed during sampling');
  }
  summary(): PerformanceSummary {
    const sorted = [...this.intervals].sort((a, b) => a - b);
    const percentile = (p: number) => sorted.length ? sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] : null;
    return {
      phase: this.phase, warmupMs: this.warmupMs, requestedSampleMs: this.sampleMs,
      elapsedMs: this.elapsed, sampledMs: this.duration, frames: sorted.length,
      averageFps: this.duration > 0 ? sorted.length * 1000 / this.duration : null,
      medianFrameMs: percentile(.5), p95FrameMs: percentile(.95), p99FrameMs: percentile(.99),
      minUnits: this.minimum ? { ...this.minimum } : null, maxUnits: this.maximum ? { ...this.maximum } : null,
      firstMetadata: this.firstMetadata ? structuredClone(this.firstMetadata) : null,
      lastMetadata: this.lastMetadata ? structuredClone(this.lastMetadata) : null,
      valid: this.phase === 'complete' && this.invalid.size === 0,
      invalidReasons: [...this.invalid],
    };
  }
}
