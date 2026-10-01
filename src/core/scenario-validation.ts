import { contentFactions, decodeContentBundle, decodeHistoricalContentBundle } from './content-registry';
import { ABILITIES } from './content';
import { MAP_SIZES, TERRAIN, generateMap } from './maps';
import { generatedMapFromWorld, validateWorldMap } from './world-map';
import type { BuildingRole, FactionId, UnitRole } from './types';
import type { WorldMapData } from './world-types';
import type { ScenarioActor, ScenarioCondition, ScenarioDefinition, ScenarioMap, ScenarioOrder } from './scenario-types';

const unitRoles = ['worker', 'melee', 'ranged', 'special', 'cavalry', 'spear', 'siege'];
const buildingRoles = ['hq', 'depot', 'barracks', 'tower', 'wall', 'gate'];
type RecordValue = Record<string, unknown>;
function bad(path: string, reason: string): never { throw new Error(`Invalid scenario at ${path}: ${reason}.`); }
function object(value: unknown, path: string, required: string[], optional: string[] = []): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) bad(path, 'expected a plain object');
  const record = value as RecordValue;
  for (const key of required) if (!Object.hasOwn(record, key)) bad(`${path}.${key}`, 'missing field');
  for (const key of Object.keys(record)) if (!required.includes(key) && !optional.includes(key)) bad(`${path}.${key}`, 'unknown field');
  return record;
}
function number(value: unknown, path: string, min = 0, max = 1e9, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || integer && !Number.isSafeInteger(value)) bad(path, `expected ${integer ? 'an integer' : 'a number'} between ${min} and ${max}`);
  return value;
}
function text(value: unknown, path: string, max = 4096): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > max) bad(path, 'invalid text');
  return value;
}
function identifier(value: unknown, path: string): string {
  const id = text(value, path, 96);
  if (!/^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(id) || ['constructor', 'prototype', '__proto__'].includes(id)) bad(path, 'invalid identifier');
  return id;
}
function choice(value: unknown, path: string, values: readonly string[]): string {
  if (typeof value !== 'string' || !values.includes(value)) bad(path, 'unknown value');
  return value;
}
function flag(value: unknown, path: string): boolean { if (typeof value !== 'boolean') bad(path, 'expected a boolean'); return value; }
function list(value: unknown, path: string, max: number, min = 0): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) bad(path, 'invalid array length');
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) bad(path, 'array contains gaps');
  return value;
}
/** Reject executable properties before walking a package supplied by an editor or importer. */
export function scenarioJson(input: unknown, limits: { maxBytes?: number; maxNodes?: number; maxArrayLength?: number } = {}): unknown {
  let nodes = 0; const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    if (++nodes > (limits.maxNodes ?? 100000) || depth > 24) bad('package', 'package is too large or deeply nested');
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object') bad('package', 'expected bounded JSON data');
    if (ancestors.has(value)) bad('package', 'cyclic reference');
    ancestors.add(value);
    let result: unknown;
    if (Array.isArray(value)) {
      if (value.length > (limits.maxArrayLength ?? 65536) || Object.getOwnPropertySymbols(value).length) bad('package', 'array is too large or contains symbols');
      for (const key of Object.getOwnPropertyNames(value)) {
        if (!('value' in Object.getOwnPropertyDescriptor(value, key)!)) bad('package', 'accessors are forbidden');
        if (key !== 'length') { const index = Number(key); if (!Number.isSafeInteger(index) || index < 0 || index >= value.length || String(index) !== key) bad('package', 'invalid array properties'); }
      }
      result = Array.from({ length: value.length }, (_, index) => {
        const property = Object.getOwnPropertyDescriptor(value, String(index));
        if (!property || !('value' in property)) bad('package', 'accessors and gaps are forbidden');
        return copy(property.value, depth + 1);
      });
    } else {
      if (Object.getPrototypeOf(value) !== Object.prototype || Object.getOwnPropertySymbols(value).length) bad('package', 'expected a plain object');
      const record: RecordValue = {};
      for (const key of Object.keys(value)) {
        if (['constructor', 'prototype', '__proto__'].includes(key)) bad('package', 'unsafe property');
        const property = Object.getOwnPropertyDescriptor(value, key)!;
        if (!('value' in property)) bad('package', 'accessors are forbidden');
        if (property.value !== undefined) record[key] = copy(property.value, depth + 1);
      }
      result = record;
    }
    ancestors.delete(value); return result;
  };
  const value = copy(input, 0);
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > (limits.maxBytes ?? 2 * 1024 * 1024)) bad('package', 'package exceeds its size limit');
  return value;
}

export function validateScenario(input: unknown, options:{historicalContent?:boolean}={}): ScenarioDefinition {
  let raw = input;
  if (typeof raw === 'string') {
    if (raw.length > 2 * 1024 * 1024) bad('package', 'package exceeds 2 MiB');
    try { raw = JSON.parse(raw); } catch { bad('package', 'invalid JSON'); }
  }
  const value = scenarioJson(raw);
  const s = object(value, 'definition', ['schemaVersion', 'id', 'title', 'briefing', 'successText', 'failureText', 'faction', 'opponent', 'seed', 'army', 'objectives', 'events', 'rules'], ['content', 'map', 'escort', 'stealth', 'boss', 'requiredActions']);
  if (s.schemaVersion !== 1) bad('schemaVersion', 'unsupported version');
  identifier(s.id, 'id'); for (const key of ['title', 'briefing', 'successText', 'failureText']) text(s[key], key);
  const content = s.content === undefined ? undefined : (options.historicalContent?decodeHistoricalContentBundle(s.content):decodeContentBundle(s.content));
  const factions = contentFactions(content);
  if (content) s.content = content;
  const faction = choice(s.faction, 'faction', Object.keys(factions)) as FactionId;
  const opponent = choice(s.opponent, 'opponent', Object.keys(factions)) as FactionId;
  const seed = number(s.seed, 'seed', 0, 0xffffffff, true);
  let map: ScenarioMap;
  if (s.map !== undefined) {
    const m = object(s.map, 'map', ['size', 'width', 'height', 'terrain', 'starts', 'resources'], ['world']);
    choice(m.size, 'map.size', Object.keys(MAP_SIZES));
    const width = number(m.width, 'map.width', 8, 128, true), height = number(m.height, 'map.height', 8, 128, true);
    list(m.terrain, 'map.terrain', width * height, width * height).forEach((tile, i) => choice(tile, `map.terrain[${i}]`, Object.keys(TERRAIN)));
    map = m as unknown as ScenarioMap;
    if (m.world !== undefined) { const validator = validateWorldMap as (input: unknown, policy?: { scenario: boolean }) => { valid: boolean; issues: string[] }; const validation = validator(m.world, { scenario: true }); if (!validation.valid) bad('map.world', validation.issues.join('; ')); }
    list(m.starts, 'map.starts', 2, 2).forEach((p, i) => point(p, `map.starts[${i}]`));
    list(m.resources, 'map.resources', 1024).forEach((resource, i) => {
      const path = `map.resources[${i}]`, r = object(resource, path, ['x', 'y', 'kind', 'amount', 'maxAmount'], ['level']);
      coordinates(r, path); choice(r.kind, `${path}.kind`, ['wood', 'ore', 'crystal']);
      const max = number(r.maxAmount, `${path}.maxAmount`, 1, 1e7); number(r.amount, `${path}.amount`, 0, max);
    });
    if (m.world !== undefined) {
      const generate = generatedMapFromWorld as (input: WorldMapData, count: number, policy?: { scenario: boolean }) => ReturnType<typeof generatedMapFromWorld>;
      const flattened = generate(map.world!, 2, { scenario: true });
      if (map.world!.seed !== seed || flattened.width !== map.width || flattened.height !== map.height || flattened.size !== map.size || JSON.stringify(flattened.terrain) !== JSON.stringify(map.terrain)) bad('map.world', 'layered map disagrees with the scenario ground map');
      if (JSON.stringify(flattened.starts.map(p => [p.x, p.y, p.level ?? 0])) !== JSON.stringify(map.starts.map(p => [p.x, p.y, p.level ?? 0])) || JSON.stringify(flattened.resources.map(r => [r.x, r.y, r.level ?? 0, r.kind, r.amount, r.maxAmount])) !== JSON.stringify(map.resources.map(r => [r.x, r.y, r.level ?? 0, r.kind, r.amount, r.maxAmount]))) bad('map.world', 'layered starts or resources disagree with the scenario map');
    }
  } else {
    const generated = generateMap(seed, 'small');
    map = { size: generated.size, width: generated.width, height: generated.height, terrain: generated.terrain, starts: generated.starts, resources: generated.resources };
  }
  function coordinates(record: RecordValue, path: string): void {
    number(record.x, `${path}.x`, .5, map.width - .5); number(record.y, `${path}.y`, .5, map.height - .5);
    if (record.level !== undefined) number(record.level, `${path}.level`, 0, (map.world?.levels.length ?? 1) - 1, true);
  }
  function point(v: unknown, path: string): void { coordinates(object(v, path, ['x', 'y'], ['level']), path); }
  const actorLabels = new Set<string>(), actorByLabel = new Map<string, ScenarioActor>();
  function actor(v: unknown, path: string): void {
    const a = object(v, path, ['label', 'side', 'kind', 'role', 'x', 'y'], ['hp', 'order', 'definitionId', 'level']);
    const label = identifier(a.label, `${path}.label`);
    if (actorLabels.has(label)) bad(`${path}.label`, 'duplicate actor label');
    actorLabels.add(label); actorByLabel.set(label, a as unknown as ScenarioActor);
    number(a.side, `${path}.side`, 0, 1, true); const kind = choice(a.kind, `${path}.kind`, ['unit', 'building']);
    const role = choice(a.role, `${path}.role`, kind === 'unit' ? unitRoles : buildingRoles);
    coordinates(a, path);
    const def = factions[a.side === 0 ? faction : opponent];
    const id = a.definitionId;
    if (id !== undefined && (typeof id !== 'string' || id.length > 100 || !/^[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?$/.test(id))) bad(`${path}.definitionId`, 'expected a registered definition ID');
    const roster = kind === 'unit' ? def.unitDefinitions ?? Object.values(def.units) : def.buildingDefinitions ?? Object.values(def.buildings);
    const definition = id === undefined ? kind === 'unit' ? def.units[role as UnitRole] : def.buildings[role as BuildingRole] : roster.find(d => d.id === id);
    if (!definition || definition.role !== role) bad(`${path}.definitionId`, 'definition is absent from the actor faction or has another kind or role');
    if (a.hp !== undefined) number(a.hp, `${path}.hp`, 1, definition.hp);
    const radius = kind === 'building' ? (definition as typeof def.buildings[BuildingRole]).size / 2 : .27;
    for (let y = Math.floor((a.y as number) - radius); y <= Math.floor((a.y as number) + radius); y++) for (let x = Math.floor((a.x as number) - radius); x <= Math.floor((a.x as number) + radius); x++) {
      const terrain = map.world?.levels[(a.level as number | undefined) ?? 0].terrain ?? map.terrain;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || !TERRAIN[terrain[y * map.width + x]].walkable) bad(path, 'actor is on impassable terrain');
    }
  }
  list(s.army, 'army', 256, 1).forEach((v, i) => actor(v, `army[${i}]`));
  const events = list(s.events, 'events', 128);
  for (const [i, event] of events.entries()) {
    const e = object(event, `events[${i}]`, ['id', 'when', 'actions'], ['repeat']);
    list(e.actions, `events[${i}].actions`, 16, 1).forEach((a, j) => {
      if (a && typeof a === 'object' && (a as RecordValue).type === 'spawn') {
        if (e.repeat !== undefined) bad(`events[${i}]`, 'repeated spawn labels are ambiguous; author separate waves');
        const spawn = object(a, `events[${i}].actions[${j}]`, ['type', 'actors']);
        list(spawn.actors, `events[${i}].actors`, 128, 1).forEach((v, k) => actor(v, `events[${i}].actors[${k}]`));
      }
    });
  }
  if (s.boss !== undefined) {
    const boss = object(s.boss, 'boss', ['actor', 'name', 'health', 'phases']);
    list(boss.phases, 'boss.phases', 8, 2).forEach((phase, i) => {
      const p = object(phase, `boss.phases[${i}]`, ['below', 'name', 'radius', 'damage', 'warningSeconds', 'cooldown', 'interruptDamage', 'adds']);
      list(p.adds, `boss.phases[${i}].adds`, 32).forEach((v, j) => actor(v, `boss.phases[${i}].adds[${j}]`));
    });
  }
  function reference(v: unknown, path: string): void { if (!actorLabels.has(identifier(v, path))) bad(path, 'unknown actor label'); }
  function condition(v: unknown, path: string, depth = 0): void {
    if (depth > 8) bad(path, 'condition nesting exceeds eight levels');
    const c = object(v, path, ['type'], ['actor', 'point', 'radius', 'seconds', 'key', 'op', 'value', 'side', 'buildings', 'conditions', 'condition']);
    switch (c.type) {
      case 'alive': case 'dead': object(v, path, ['type', 'actor']); reference(c.actor, `${path}.actor`); break;
      case 'at': object(v, path, ['type', 'actor', 'point', 'radius']); reference(c.actor, `${path}.actor`); point(c.point, `${path}.point`); number(c.radius, `${path}.radius`, .5, 32); break;
      case 'time': object(v, path, ['type', 'seconds']); number(c.seconds, `${path}.seconds`, 0, 7200); break;
      case 'variable': object(v, path, ['type', 'key', 'op', 'value']); identifier(c.key, `${path}.key`); choice(c.op, `${path}.op`, ['eq', 'gte', 'lte']); number(c.value, `${path}.value`, -1e9, 1e9); break;
      case 'cleared': object(v, path, ['type', 'side'], ['buildings']); number(c.side, `${path}.side`, 0, 1, true); if (c.buildings !== undefined) flag(c.buildings, `${path}.buildings`); break;
      case 'all': case 'any': object(v, path, ['type', 'conditions']); list(c.conditions, `${path}.conditions`, 16, 1).forEach((child, i) => condition(child, `${path}.conditions[${i}]`, depth + 1)); break;
      case 'not': object(v, path, ['type', 'condition']); condition(c.condition, `${path}.condition`, depth + 1); break;
      default: bad(`${path}.type`, 'unknown condition');
    }
  }
  function order(v: unknown, path: string): void {
    const o = object(v, path, ['type'], ['x', 'y', 'actor', 'level']);
    switch (o.type) {
      case 'move': case 'attackMove': object(v, path, ['type', 'x', 'y'], ['level']); coordinates(o, path); break;
      case 'attack': object(v, path, ['type', 'actor']); reference(o.actor, `${path}.actor`); break;
      case 'stop': case 'hold': case 'ability': object(v, path, ['type']); break;
      default: bad(`${path}.type`, 'unknown order');
    }
  }
  for (const [label, a] of actorByLabel) if (a.order) order(a.order, `actor.${label}.order`);
  const objectiveIds = new Set<string>();
  list(s.objectives, 'objectives', 32, 1).forEach((v, i) => {
    const p = `objectives[${i}]`, o = object(v, p, ['id', 'text', 'success'], ['failure', 'optional']), id = identifier(o.id, `${p}.id`);
    if (objectiveIds.has(id)) bad(`${p}.id`, 'duplicate objective'); objectiveIds.add(id);
    text(o.text, `${p}.text`); condition(o.success, `${p}.success`);
    if (o.failure !== undefined) condition(o.failure, `${p}.failure`);
    if (o.optional !== undefined) flag(o.optional, `${p}.optional`);
  });
  if ((s.objectives as Array<{ optional?: boolean }>).every(o => o.optional)) bad('objectives', 'at least one objective must be required');
  const eventIds = new Set<string>();
  for (const [i, v] of events.entries()) {
    const p = `events[${i}]`, e = v as RecordValue, id = identifier(e.id, `${p}.id`);
    if (eventIds.has(id)) bad(`${p}.id`, 'duplicate event'); eventIds.add(id); condition(e.when, `${p}.when`);
    if (e.repeat !== undefined) { const r = object(e.repeat, `${p}.repeat`, ['seconds', 'count']); number(r.seconds, `${p}.repeat.seconds`, 1, 3600); number(r.count, `${p}.repeat.count`, 1, 256, true); }
    (e.actions as unknown[]).forEach((v, j) => {
      const path = `${p}.actions[${j}]`, a = object(v, path, ['type'], ['actors', 'order', 'key', 'value', 'text', 'speaker', 'side', 'resources', 'outcome', 'reason', 'allied']);
      switch (a.type) {
        case 'spawn': object(v, path, ['type', 'actors']); break;
        case 'alliance': object(v, path, ['type', 'allied']); flag(a.allied, `${path}.allied`); break;
        case 'order': object(v, path, ['type', 'actors', 'order']); list(a.actors, `${path}.actors`, 256, 1).forEach((label, k) => reference(label, `${path}.actors[${k}]`)); order(a.order, `${path}.order`); break;
        case 'set': case 'add': object(v, path, ['type', 'key', 'value']); identifier(a.key, `${path}.key`); number(a.value, `${path}.value`, -1e6, 1e6); break;
        case 'message': object(v, path, ['type', 'text'], ['speaker']); text(a.text, `${path}.text`); if (a.speaker !== undefined) text(a.speaker, `${path}.speaker`, 96); break;
        case 'reward': object(v, path, ['type', 'side', 'resources']); number(a.side, `${path}.side`, 0, 1, true); resources(a.resources, `${path}.resources`); break;
        case 'finish': object(v, path, ['type', 'outcome', 'reason']); choice(a.outcome, `${path}.outcome`, ['won', 'lost']); text(a.reason, `${path}.reason`); break;
        default: bad(`${path}.type`, 'unknown action');
      }
    });
  }
  function resources(v: unknown, p: string): void { const r = object(v, p, ['wood', 'ore', 'crystal']); for (const key of ['wood', 'ore', 'crystal']) number(r[key], `${p}.${key}`, 0, 1e6); }
  const rules = object(s.rules, 'rules', ['fixedArmy', 'reinforcementBudget', 'resources', 'timeLimit']);
  flag(rules.fixedArmy, 'rules.fixedArmy'); number(rules.reinforcementBudget, 'rules.reinforcementBudget', 0, 256, true); resources(rules.resources, 'rules.resources'); number(rules.timeLimit, 'rules.timeLimit', 1, 7200);
  if (rules.fixedArmy && rules.reinforcementBudget !== 0) bad('rules.reinforcementBudget', 'fixed armies cannot recruit');
  if (s.escort !== undefined) {
    const e = object(s.escort, 'escort', ['actor', 'route', 'radius', 'escortRadius']); reference(e.actor, 'escort.actor');
    if (actorByLabel.get(e.actor as string)?.kind !== 'unit') bad('escort.actor', 'escort must be a moving unit');
    list(e.route, 'escort.route', 64, 2).forEach((v, i) => point(v, `escort.route[${i}]`)); number(e.radius, 'escort.radius', .5, 5); number(e.escortRadius, 'escort.escortRadius', 1, 32);
  }
  if (s.stealth !== undefined) {
    const t = object(s.stealth, 'stealth', ['infiltrators', 'guards', 'alarmLimit', 'detectionSeconds', 'radius', 'coneDegrees', 'patrols']);
    for (const group of ['infiltrators', 'guards']) list(t[group], `stealth.${group}`, 64, 1).forEach((label, i) => reference(label, `stealth.${group}[${i}]`));
    number(t.alarmLimit, 'stealth.alarmLimit', 1, 16, true); number(t.detectionSeconds, 'stealth.detectionSeconds', .1, 10); number(t.radius, 'stealth.radius', 1, 16); number(t.coneDegrees, 'stealth.coneDegrees', 15, 360);
    list(t.patrols, 'stealth.patrols', 64).forEach((v, i) => { const p = `stealth.patrols[${i}]`, patrol = object(v, p, ['actor', 'route']); reference(patrol.actor, `${p}.actor`); list(patrol.route, `${p}.route`, 32, 2).forEach((pointValue, j) => point(pointValue, `${p}.route[${j}]`)); });
  }
  if (s.boss !== undefined) {
    const b = s.boss as RecordValue; reference(b.actor, 'boss.actor'); text(b.name, 'boss.name', 96); number(b.health, 'boss.health', 100, 1e6);
    const bossActor = actorByLabel.get(b.actor as string)!; if (bossActor.side !== 1 || bossActor.kind !== 'unit' || !(s.army as ScenarioActor[]).some(a => a.label === bossActor.label)) bad('boss.actor', 'boss must be a hostile targetable unit in the initial army');
    let prior = Infinity;
    (b.phases as unknown[]).forEach((v, i) => {
      const p = `boss.phases[${i}]`, phase = v as RecordValue, below = number(phase.below, `${p}.below`, 0, 1);
      if (i === 0 && below !== 1 || below >= prior) bad(`${p}.below`, 'phase thresholds must start at one and decrease'); prior = below;
      text(phase.name, `${p}.name`, 96); number(phase.radius, `${p}.radius`, 1, 16); number(phase.damage, `${p}.damage`, 1, 1000);
      number(phase.warningSeconds, `${p}.warningSeconds`, .5, 10); number(phase.cooldown, `${p}.cooldown`, 2, 60); number(phase.interruptDamage, `${p}.interruptDamage`, 1, 10000);
    });
  }
  if (s.requiredActions !== undefined) list(s.requiredActions, 'requiredActions', 8).forEach((v, i) => { const p = `requiredActions[${i}]`, a = object(v, p, ['action', 'count', 'text'], ['ability']); choice(a.action, `${p}.action`, ['ability', 'hold', 'repair', 'gather']); if (a.ability !== undefined) { if (a.action !== 'ability') bad(`${p}.ability`, 'only ability actions can declare an ability'); choice(a.ability, `${p}.ability`, Object.keys(ABILITIES)); } number(a.count, `${p}.count`, 1, 256, true); text(a.text, `${p}.text`); });
  return value as ScenarioDefinition;
}

export type { ScenarioCondition, ScenarioOrder };
