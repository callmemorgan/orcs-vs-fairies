import { FACTIONS } from '../core/content';
import { TERRAIN } from '../core/maps';
import { SAVE_VERSION } from '../core/saves';
import { validateScenario } from '../core/scenario-validation';
import type { ScenarioActor, ScenarioCondition, ScenarioDefinition, ScenarioMap, ScenarioOrder } from '../core/scenario-types';
import type { BuildingRole, UnitRole } from '../core/types';
import { decodeEditorMap, decodeMapPackage, validateEditorMap } from './map-package';
import type { MapPackage } from './map-package';

export interface ScenarioPackage {
  schemaVersion: 1;
  kind: 'scenario';
  simulationVersion: number;
  revision: number;
  author: string;
  mapHash: string;
  contentHash: string;
  hash: string;
  map: MapPackage;
  scenario: ScenarioDefinition;
}
export interface ScenarioPackageMetadata { author: string; revision: number }
export const SCENARIO_EDITOR_LIMITS = { bytes: 20 * 1024 * 1024, actors: 256, objectives: 32, events: 128, conditionDepth: 8, actions: 16 } as const;
type RecordValue = Record<string, unknown>;
const unitRoles: UnitRole[] = ['worker', 'melee', 'ranged', 'special', 'cavalry', 'spear', 'siege'];
const buildingRoles: BuildingRole[] = ['hq', 'depot', 'barracks', 'tower', 'wall', 'gate'];
const packageFields = ['schemaVersion', 'kind', 'simulationVersion', 'revision', 'author', 'mapHash', 'contentHash', 'hash', 'map', 'scenario'];
function bad(path: string, detail: string): never { throw new Error(`Invalid scenario at ${path}: ${detail}.`); }

/** Copy JSON through descriptors so malicious getters cannot run during validation. */
function jsonInput(input: unknown): unknown {
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).byteLength > SCENARIO_EDITOR_LIMITS.bytes) bad('document', 'document exceeds byte limit');
    try { input = JSON.parse(input); } catch { bad('document', 'invalid JSON'); }
  }
  let nodes = 0, chars = 0;
  const parents = new Set<object>();
  function copy(value: unknown, path: string, depth: number): unknown {
    if (++nodes > 700000 || depth > 48) bad(path, 'document exceeds node or depth limit');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { if (!Number.isFinite(value)) bad(path, 'expected a finite number'); return Object.is(value, -0) ? 0 : value; }
    if (typeof value === 'string') { chars += value.length * 2; if (chars > SCENARIO_EDITOR_LIMITS.bytes) bad(path, 'document exceeds byte limit'); return value; }
    if (!value || typeof value !== 'object') bad(path, 'expected JSON data');
    if (parents.has(value)) bad(path, 'cyclic references are forbidden');
    parents.add(value);
    let output: unknown;
    if (Array.isArray(value)) {
      if (value.length > 65536) bad(path, 'array exceeds length limit');
      if (Reflect.ownKeys(value).length !== value.length + 1) bad(path, 'array gaps and extra properties are forbidden');
      const result: unknown[] = [];
      for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) bad(`${path}[${index}]`, 'array gaps and accessors are forbidden');
        result.push(copy(descriptor.value, `${path}[${index}]`, depth + 1));
      }
      output = result;
    } else {
      if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) bad(path, 'expected a plain object');
      const keys = Reflect.ownKeys(value);
      if (keys.length > 64 || keys.some(key => typeof key !== 'string')) bad(path, 'invalid object properties');
      const result: RecordValue = Object.create(null);
      for (const key of keys as string[]) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) bad(path, 'unsafe property name');
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if (!('value' in descriptor) || !descriptor.enumerable) bad(`${path}.${key}`, 'accessors and hidden properties are forbidden');
        result[key] = copy(descriptor.value, `${path}.${key}`, depth + 1);
      }
      output = result;
    }
    parents.delete(value); return output;
  }
  const copied = copy(input, 'document', 0);
  if (new TextEncoder().encode(JSON.stringify(copied)).byteLength > SCENARIO_EDITOR_LIMITS.bytes) bad('document', 'document exceeds byte limit');
  return copied;
}
function object(value: unknown, path: string, fields: string[], optional: string[] = []): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad(path, 'expected an object');
  const result = value as RecordValue;
  for (const field of fields) if (!Object.hasOwn(result, field)) bad(`${path}.${field}`, 'missing field');
  for (const field of Object.keys(result)) if (!fields.includes(field) && !optional.includes(field)) bad(`${path}.${field}`, 'unknown field');
  return result;
}
function number(value: unknown, path: string, min = 0, max = 1e9, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) bad(path, `expected ${integer ? 'an integer' : 'a number'} from ${min} through ${max}`);
  return value;
}
function text(value: unknown, path: string, max = 200, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) bad(path, 'invalid text');
  return value;
}
function id(value: unknown, path: string): string { const result = text(value, path, 64); if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(result)) bad(path, 'use letters, numbers, dots, underscores or hyphens'); return result; }
function choice(value: unknown, path: string, values: readonly string[]): string { if (typeof value !== 'string' || !values.includes(value)) bad(path, 'unknown value'); return value; }
function bool(value: unknown, path: string): void { if (typeof value !== 'boolean') bad(path, 'expected a boolean'); }
function array(value: unknown, path: string, max: number, min = 0): unknown[] { if (!Array.isArray(value) || value.length < min || value.length > max) bad(path, `expected ${min} through ${max} entries`); return value; }
function point(value: unknown, path: string, width = 256, height = 256): void { const p = object(value, path, ['x', 'y'], ['level']); number(p.x, `${path}.x`, 0, width); number(p.y, `${path}.y`, 0, height); if (p.x === width || p.y === height) bad(path, 'point lies outside the map'); if (p.level !== undefined) number(p.level, `${path}.level`, 0, 1, true); }
function cost(value: unknown, path: string): void { const c = object(value, path, ['wood', 'ore', 'crystal']); for (const key of ['wood', 'ore', 'crystal']) number(c[key], `${path}.${key}`); }
function order(value: unknown, path: string, refs: string[], width: number, height: number): void {
  const type = choice((value as RecordValue)?.type, `${path}.type`, ['move', 'attackMove', 'hold', 'stop', 'ability', 'attack']);
  const o = object(value, path, type === 'move' || type === 'attackMove' ? ['type', 'x', 'y'] : type === 'attack' ? ['type', 'actor'] : ['type'], type === 'move' || type === 'attackMove' ? ['level'] : []);
  if (type === 'move' || type === 'attackMove') point({ x: o.x, y: o.y }, path, width, height);
  if (o.level !== undefined) number(o.level, `${path}.level`, 0, 1, true);
  if (type === 'attack') refs.push(id(o.actor, `${path}.actor`));
}
function actor(value: unknown, path: string, refs: string[], width: number, height: number): ScenarioActor {
  const a = object(value, path, ['label', 'side', 'kind', 'role', 'x', 'y'], ['definitionId', 'hp', 'order', 'level']);
  id(a.label, `${path}.label`); number(a.side, `${path}.side`, 0, 1, true); choice(a.kind, `${path}.kind`, ['unit', 'building']);
  choice(a.role, `${path}.role`, a.kind === 'unit' ? unitRoles : buildingRoles); point({ x: a.x, y: a.y }, path, width, height);
  if (a.level !== undefined) number(a.level, `${path}.level`, 0, 1, true);
  if (a.definitionId !== undefined) { const value = text(a.definitionId, `${path}.definitionId`, 96); if (!/^[a-zA-Z][a-zA-Z0-9_.-]*(?::[a-zA-Z0-9_.-]+)?$/.test(value)) bad(`${path}.definitionId`, 'invalid definition identifier'); }
  if (a.hp !== undefined) number(a.hp, `${path}.hp`, Number.MIN_VALUE, 1e7);
  if (a.order !== undefined) order(a.order, `${path}.order`, refs, width, height);
  return a as unknown as ScenarioActor;
}
function condition(value: unknown, path: string, refs: string[], width: number, height: number, depth = 0): void {
  if (depth > SCENARIO_EDITOR_LIMITS.conditionDepth) bad(path, 'condition is too deeply nested');
  const type = choice((value as RecordValue)?.type, `${path}.type`, ['alive', 'dead', 'at', 'time', 'variable', 'cleared', 'all', 'any', 'not']);
  const fields = type === 'alive' || type === 'dead' ? ['type', 'actor'] : type === 'at' ? ['type', 'actor', 'point', 'radius'] : type === 'time' ? ['type', 'seconds'] : type === 'variable' ? ['type', 'key', 'op', 'value'] : type === 'cleared' ? ['type', 'side'] : type === 'not' ? ['type', 'condition'] : ['type', 'conditions'];
  const c = object(value, path, fields, type === 'cleared' ? ['buildings'] : []);
  if (type === 'alive' || type === 'dead' || type === 'at') refs.push(id(c.actor, `${path}.actor`));
  if (type === 'at') { point(c.point, `${path}.point`, width, height); number(c.radius, `${path}.radius`, .1, 256); }
  if (type === 'time') number(c.seconds, `${path}.seconds`, 0, 86400);
  if (type === 'variable') { id(c.key, `${path}.key`); choice(c.op, `${path}.op`, ['eq', 'gte', 'lte']); number(c.value, `${path}.value`, -1e9, 1e9); }
  if (type === 'cleared') { number(c.side, `${path}.side`, 0, 1, true); if (c.buildings !== undefined) bool(c.buildings, `${path}.buildings`); }
  if (type === 'all' || type === 'any') array(c.conditions, `${path}.conditions`, 16, 1).forEach((v, i) => condition(v, `${path}.conditions[${i}]`, refs, width, height, depth + 1));
  if (type === 'not') condition(c.condition, `${path}.condition`, refs, width, height, depth + 1);
}

/** Drafts may contain dangling actor references while their author creates later waves. */
export function decodeScenarioDraft(input: unknown): ScenarioDefinition { return readScenario(jsonInput(input), false); }
export function decodeScenarioDefinition(input: unknown): ScenarioDefinition { return validateScenario(readScenario(jsonInput(input), true)); }
function readScenario(value: unknown, complete: boolean): ScenarioDefinition {
  const s = object(value, 'scenario', ['schemaVersion', 'id', 'title', 'briefing', 'successText', 'failureText', 'faction', 'opponent', 'seed', 'army', 'objectives', 'events', 'rules'], ['map', 'escort', 'stealth', 'boss', 'requiredActions']);
  if (s.schemaVersion !== 1) bad('scenario.schemaVersion', 'unsupported schema version');
  id(s.id, 'scenario.id'); text(s.title, 'scenario.title', 120); for (const field of ['briefing', 'successText', 'failureText']) text(s[field], `scenario.${field}`, 8000, true);
  for (const field of ['faction', 'opponent']) choice(s[field], `scenario.${field}`, Object.keys(FACTIONS)); number(s.seed, 'scenario.seed', 0, 0xffffffff, true);
  let width = 256, height = 256;
  if (s.map !== undefined) {
    const m = object(s.map, 'scenario.map', ['size', 'width', 'height', 'terrain', 'starts', 'resources'], ['world']); width = number(m.width, 'scenario.map.width', 8, 256, true); height = number(m.height, 'scenario.map.height', 8, 256, true);
    if (m.world !== undefined) m.world = decodeEditorMap(m.world);
    choice(m.size, 'scenario.map.size', ['small', 'medium', 'large', 'huge']); const terrain = array(m.terrain, 'scenario.map.terrain', 65536); if (terrain.length !== width * height) bad('scenario.map.terrain', 'tile count does not match dimensions'); terrain.forEach((t, i) => choice(t, `scenario.map.terrain[${i}]`, Object.keys(TERRAIN)));
    array(m.starts, 'scenario.map.starts', 8, 2).forEach((p, i) => point(p, `scenario.map.starts[${i}]`, width, height));
    array(m.resources, 'scenario.map.resources', 8192).forEach((v, i) => { const p = `scenario.map.resources[${i}]`, r = object(v, p, ['x', 'y', 'kind', 'amount', 'maxAmount'], ['level']); point({ x: r.x, y: r.y }, p, width, height); if (r.level !== undefined) number(r.level, `${p}.level`, 0, 1, true); choice(r.kind, `${p}.kind`, ['wood', 'ore', 'crystal']); number(r.amount, `${p}.amount`); number(r.maxAmount, `${p}.maxAmount`, Number.MIN_VALUE); if ((r.amount as number) > (r.maxAmount as number)) bad(p, 'amount exceeds maximum'); });
  }
  const refs: string[] = [], labels = new Set<string>();
  const actors = (values: unknown, path: string, min = 0) => array(values, path, SCENARIO_EDITOR_LIMITS.actors, min).forEach((v, i) => { const a = actor(v, `${path}[${i}]`, refs, width, height); if (labels.has(a.label)) bad(`${path}[${i}].label`, 'duplicate actor label'); labels.add(a.label); });
  actors(s.army, 'scenario.army');
  const objectiveIds = new Set<string>();
  array(s.objectives, 'scenario.objectives', SCENARIO_EDITOR_LIMITS.objectives, complete ? 1 : 0).forEach((value, i) => {
    const path = `scenario.objectives[${i}]`, o = object(value, path, ['id', 'text', 'success'], ['failure', 'optional']); const key = id(o.id, `${path}.id`); if (objectiveIds.has(key)) bad(`${path}.id`, 'duplicate objective ID'); objectiveIds.add(key); text(o.text, `${path}.text`, 2000);
    condition(o.success, `${path}.success`, refs, width, height); if (o.failure !== undefined) condition(o.failure, `${path}.failure`, refs, width, height); if (o.optional !== undefined) bool(o.optional, `${path}.optional`);
  });
  const eventIds = new Set<string>();
  array(s.events, 'scenario.events', SCENARIO_EDITOR_LIMITS.events).forEach((value, i) => {
    const path = `scenario.events[${i}]`, e = object(value, path, ['id', 'when', 'actions'], ['repeat']); const key = id(e.id, `${path}.id`); if (eventIds.has(key)) bad(`${path}.id`, 'duplicate event ID'); eventIds.add(key); condition(e.when, `${path}.when`, refs, width, height);
    if (e.repeat !== undefined) { const r = object(e.repeat, `${path}.repeat`, ['seconds', 'count']); number(r.seconds, `${path}.repeat.seconds`, 1, 86400); number(r.count, `${path}.repeat.count`, 1, 10000, true); }
    array(e.actions, `${path}.actions`, SCENARIO_EDITOR_LIMITS.actions, complete ? 1 : 0).forEach((value, index) => {
      const p = `${path}.actions[${index}]`, type = choice((value as RecordValue)?.type, `${p}.type`, ['spawn', 'order', 'set', 'add', 'message', 'reward', 'alliance', 'finish']);
      const a = object(value, p, type === 'spawn' ? ['type', 'actors'] : type === 'order' ? ['type', 'actors', 'order'] : type === 'set' || type === 'add' ? ['type', 'key', 'value'] : type === 'message' ? ['type', 'text'] : type === 'reward' ? ['type', 'side', 'resources'] : type === 'alliance' ? ['type', 'allied'] : ['type', 'outcome', 'reason'], type === 'message' ? ['speaker'] : []);
      if (type === 'spawn') actors(a.actors, `${p}.actors`, 1);
      if (type === 'order') { array(a.actors, `${p}.actors`, 512, 1).forEach((v, i) => refs.push(id(v, `${p}.actors[${i}]`))); order(a.order, `${p}.order`, refs, width, height); }
      if (type === 'set' || type === 'add') { id(a.key, `${p}.key`); number(a.value, `${p}.value`, -1e9, 1e9); }
      if (type === 'message') { text(a.text, `${p}.text`, 8000); if (a.speaker !== undefined) text(a.speaker, `${p}.speaker`, 120); }
      if (type === 'reward') { number(a.side, `${p}.side`, 0, 1, true); cost(a.resources, `${p}.resources`); }
      if (type === 'alliance') bool(a.allied, `${p}.allied`);
      if (type === 'finish') { choice(a.outcome, `${p}.outcome`, ['won', 'lost']); text(a.reason, `${p}.reason`, 2000); }
    });
  });
  const r = object(s.rules, 'scenario.rules', ['fixedArmy', 'reinforcementBudget', 'resources', 'timeLimit']); bool(r.fixedArmy, 'scenario.rules.fixedArmy'); number(r.reinforcementBudget, 'scenario.rules.reinforcementBudget', 0, 100000, true); number(r.timeLimit, 'scenario.rules.timeLimit', .05, 86400); cost(r.resources, 'scenario.rules.resources');
  if (s.escort !== undefined) { const e = object(s.escort, 'scenario.escort', ['actor', 'route', 'radius', 'escortRadius']); refs.push(id(e.actor, 'scenario.escort.actor')); array(e.route, 'scenario.escort.route', 256, 1).forEach((p, i) => point(p, `scenario.escort.route[${i}]`, width, height)); number(e.radius, 'scenario.escort.radius', .1, 256); number(e.escortRadius, 'scenario.escort.escortRadius', .1, 256); }
  if (s.stealth !== undefined) {
    const t = object(s.stealth, 'scenario.stealth', ['infiltrators', 'guards', 'alarmLimit', 'detectionSeconds', 'radius', 'coneDegrees', 'patrols']); for (const k of ['infiltrators', 'guards']) array(t[k], `scenario.stealth.${k}`, 512, 1).forEach((v, i) => refs.push(id(v, `scenario.stealth.${k}[${i}]`)));
    number(t.alarmLimit, 'scenario.stealth.alarmLimit', 1, 10000, true); number(t.detectionSeconds, 'scenario.stealth.detectionSeconds', .05, 86400); number(t.radius, 'scenario.stealth.radius', .1, 256); number(t.coneDegrees, 'scenario.stealth.coneDegrees', 1, 360);
    array(t.patrols, 'scenario.stealth.patrols', 512).forEach((v, i) => { const p = `scenario.stealth.patrols[${i}]`, patrol = object(v, p, ['actor', 'route']); refs.push(id(patrol.actor, `${p}.actor`)); array(patrol.route, `${p}.route`, 256, 1).forEach((v, j) => point(v, `${p}.route[${j}]`, width, height)); });
  }
  if (s.boss !== undefined) {
    const b = object(s.boss, 'scenario.boss', ['actor', 'name', 'health', 'phases']); refs.push(id(b.actor, 'scenario.boss.actor')); text(b.name, 'scenario.boss.name', 120); number(b.health, 'scenario.boss.health', .1, 1e7);
    array(b.phases, 'scenario.boss.phases', 32, 1).forEach((v, i) => { const p = `scenario.boss.phases[${i}]`, phase = object(v, p, ['below', 'name', 'radius', 'damage', 'warningSeconds', 'cooldown', 'interruptDamage', 'adds']); number(phase.below, `${p}.below`, 0, 1); text(phase.name, `${p}.name`, 120); number(phase.radius, `${p}.radius`, .1, 256); number(phase.damage, `${p}.damage`); number(phase.warningSeconds, `${p}.warningSeconds`, .05, 86400); number(phase.cooldown, `${p}.cooldown`, .05, 86400); number(phase.interruptDamage, `${p}.interruptDamage`); actors(phase.adds, `${p}.adds`); });
  }
  if (s.requiredActions !== undefined) array(s.requiredActions, 'scenario.requiredActions', 32).forEach((v, i) => { const p = `scenario.requiredActions[${i}]`, a = object(v, p, ['action', 'count', 'text']); choice(a.action, `${p}.action`, ['ability', 'hold', 'repair', 'gather']); number(a.count, `${p}.count`, 1, 100000, true); text(a.text, `${p}.text`, 2000); });
  if (complete) for (const ref of refs) if (!labels.has(ref)) bad('scenario', `unknown actor label ${ref}`);
  return JSON.parse(JSON.stringify(s)) as ScenarioDefinition;
}

export function scenarioMapFromPackage(input: MapPackage): ScenarioMap {
  const { map } = decodeMapPackage(input);
  const rich = map.levels.length !== 1 || map.starts.some(p => p.level !== 0) || map.resources.some(p => p.level !== 0) || map.transitions.length > 0 || map.sites.length > 0 || map.levels[0].elevation.some(v => v !== 0);
  if (rich) return { size: map.size, width: map.width, height: map.height, terrain: [...map.levels.find(level => level.id === 0)!.terrain], starts: [...map.starts].sort((a, b) => a.slot - b.slot).map(({ x, y, level }) => ({ x, y, level })), resources: map.resources.map(({ x, y, level, kind, amount, maxAmount }) => ({ x, y, level, kind, amount, maxAmount })), world: structuredClone(map) };
  return { size: map.size, width: map.width, height: map.height, terrain: [...map.levels[0].terrain], starts: [...map.starts].sort((a, b) => a.slot - b.slot).map(({ x, y }) => ({ x, y })), resources: map.resources.map(({ x, y, kind, amount, maxAmount }) => ({ x, y, kind, amount, maxAmount })) };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') { const r = value as RecordValue; return `{${Object.keys(r).sort().map(k => `${JSON.stringify(k)}:${canonical(r[k])}`).join(',')}}`; }
  return JSON.stringify(value);
}
/** Integrity checksum only; it does not authenticate an author's identity. */
function hash(value: unknown): string {
  let a = 0x811c9dc5, b = 0x9e3779b9;
  for (const byte of new TextEncoder().encode(canonical(value))) { a = Math.imul(a ^ byte, 0x01000193) >>> 0; b = Math.imul(b ^ byte, 0x85ebca6b) >>> 0; }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}
export function canonicalScenarioHash(input: unknown): string { return hash(decodeScenarioDefinition(input)); }
export function makeScenarioPackage(metadata: ScenarioPackageMetadata, input: ScenarioDefinition, mapInput: MapPackage): ScenarioPackage {
  const m = object(jsonInput(metadata), 'metadata', ['author', 'revision']); text(m.author, 'metadata.author', 120); number(m.revision, 'metadata.revision', 1, 0x7fffffff, true);
  const map = decodeMapPackage(mapInput), validation = validateEditorMap(map.map); if (!validation.valid) throw new Error(`Scenario map cannot be played: ${validation.issues.join('; ')}`);
  if (map.map.starts.length !== 2) throw new Error('Scenarios require two starting positions.');
  const scenario = decodeScenarioDefinition({ ...decodeScenarioDraft(input), map: scenarioMapFromPackage(map), seed: map.map.seed });
  const data: Omit<ScenarioPackage, 'hash'> = { schemaVersion: 1, kind: 'scenario', simulationVersion: SAVE_VERSION, revision: m.revision as number, author: m.author as string, mapHash: map.hash, contentHash: canonicalScenarioHash(scenario), map, scenario };
  return { ...data, hash: hash(data) };
}
export function decodeScenarioPackage(input: unknown): ScenarioPackage {
  const p = object(jsonInput(input), 'package', packageFields);
  if (p.schemaVersion !== 1 || p.kind !== 'scenario') bad('package', 'unsupported package schema or kind');
  if (p.simulationVersion !== SAVE_VERSION) bad('package.simulationVersion', `expected current simulation version ${SAVE_VERSION}`);
  text(p.author, 'package.author', 120); number(p.revision, 'package.revision', 1, 0x7fffffff, true);
  for (const field of ['hash', 'mapHash', 'contentHash']) if (typeof p[field] !== 'string' || !/^[0-9a-f]{16}$/.test(p[field] as string)) bad(`package.${field}`, 'invalid checksum');
  const map = decodeMapPackage(p.map), scenario = decodeScenarioDefinition(p.scenario);
  const validation = validateEditorMap(map.map); if (!validation.valid) bad('package.map', validation.issues.join('; '));
  if (map.map.starts.length !== 2) bad('package.map', 'scenarios require two starting positions');
  if (p.mapHash !== map.hash) bad('package.mapHash', 'map dependency checksum mismatch');
  if (p.contentHash !== canonicalScenarioHash(scenario)) bad('package.contentHash', 'scenario checksum mismatch');
  if (canonical(scenario.map) !== canonical(scenarioMapFromPackage(map)) || scenario.seed !== map.map.seed) bad('package.scenario.map', 'embedded scenario map differs from dependency');
  const { hash: expected, ...body } = p; if (expected !== hash(body)) bad('package.hash', 'package checksum mismatch');
  return { ...p, map, scenario } as unknown as ScenarioPackage;
}

export function createScenarioDraft(): ScenarioDefinition {
  return { schemaVersion: 1, id: 'custom-scenario', title: 'Custom scenario', briefing: 'Lead your force to complete the objectives.', successText: 'Objectives completed.', failureText: 'The mission failed.', faction: 'orcs', opponent: 'fairies', seed: 42, army: [{ label: 'commander', side: 0, kind: 'unit', role: 'melee', x: 10.5, y: 11.5 }], objectives: [{ id: 'survive', text: 'Keep the commander alive for 60 seconds.', success: { type: 'time', seconds: 60 }, failure: { type: 'dead', actor: 'commander' } }], events: [], rules: { fixedArmy: true, reinforcementBudget: 0, resources: { wood: 0, ore: 0, crystal: 0 }, timeLimit: 600 } };
}
