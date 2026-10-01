import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { SAVE_VERSION } from '../src/core/saves';
import type { ScenarioCondition, ScenarioDefinition, ScenarioOrder } from '../src/core/scenario-types';
import { TERRAIN } from '../src/core/maps';
import { generateWorldMap } from '../src/core/world-map';
import { canonicalMapHash, canonicalPackageHash, createEditorMap, makeMapPackage } from '../src/editor/map-package';
import {
  canonicalScenarioHash, createScenarioDraft, decodeScenarioDefinition, decodeScenarioDraft,
  decodeScenarioPackage, makeScenarioPackage, SCENARIO_EDITOR_LIMITS, scenarioMapFromPackage,
} from '../src/editor/scenario-package';

const metadata = { author: 'Scenario author', revision: 1 };
function mapFixture(seed = 4127) {
  const map = createEditorMap(seed, 'small');
  map.levels[0].terrain.fill('grass');
  return map;
}
const mapDependency = makeMapPackage(
  { id: 'scenario-ground', title: 'Scenario ground', ...metadata }, mapFixture(),
);

function controls(): ScenarioDefinition {
  const draft = createScenarioDraft();
  draft.army.push(
    { label: 'escort', side: 0, kind: 'unit', role: 'worker', x: 12.5, y: 12.5, hp: 60, order: { type: 'hold' } },
    { label: 'guard', side: 1, kind: 'unit', role: 'ranged', x: 20.5, y: 20.5, order: { type: 'attack', actor: 'commander' } },
    { label: 'boss', side: 1, kind: 'unit', role: 'special', x: 24.5, y: 24.5 },
    { label: 'tower', side: 1, kind: 'building', role: 'tower', x: 28.5, y: 28.5 },
  );
  draft.army[0].definitionId = 'custom-commander';
  draft.objectives = [{
    id: 'escort-home', text: 'Escort the convoy and defeat the boss.', optional: false,
    success: { type: 'all', conditions: [
      { type: 'alive', actor: 'escort' }, { type: 'dead', actor: 'boss' },
      { type: 'at', actor: 'escort', point: { x: 14.5, y: 14.5 }, radius: 1 },
      { type: 'time', seconds: 30 }, { type: 'variable', key: 'waves', op: 'gte', value: 2 },
      { type: 'cleared', side: 1, buildings: true },
      { type: 'any', conditions: [{ type: 'variable', key: 'alarm', op: 'eq', value: 0 }] },
      { type: 'not', condition: { type: 'variable', key: 'alarm', op: 'lte', value: -1 } },
    ] },
    failure: { type: 'dead', actor: 'escort' },
  }];
  draft.events = [{
    id: 'timed-wave', when: { type: 'time', seconds: 10 },
    actions: [
      { type: 'spawn', actors: [{ label: 'wave-raider', side: 1, kind: 'unit', role: 'melee', x: 22.5, y: 22.5, order: { type: 'attackMove', x: 14.5, y: 14.5 } }] },
      { type: 'order', actors: ['wave-raider'], order: { type: 'attack', actor: 'escort' } },
      { type: 'set', key: 'alarm', value: 0 }, { type: 'add', key: 'waves', value: 1 },
      { type: 'message', speaker: 'Commander', text: 'The next wave has arrived.\nProtect the convoy.' },
      { type: 'reward', side: 0, resources: { wood: 20, ore: 10, crystal: 5 } },
      { type: 'finish', outcome: 'won', reason: 'The convoy reached safety.' },
    ],
  }, { id: 'wave-count', when: { type: 'time', seconds: 15 }, repeat: { seconds: 15, count: 3 }, actions: [{ type: 'add', key: 'ticks', value: 1 }] }];
  draft.rules = { fixedArmy: false, reinforcementBudget: 25, resources: { wood: 100, ore: 50, crystal: 20 }, timeLimit: 120 };
  draft.escort = { actor: 'escort', route: [{ x: 12.5, y: 12.5 }, { x: 14.5, y: 14.5 }], radius: 1, escortRadius: 4 };
  draft.stealth = {
    infiltrators: ['commander'], guards: ['guard'], alarmLimit: 3, detectionSeconds: 2, radius: 6, coneDegrees: 90,
    patrols: [{ actor: 'guard', route: [{ x: 20.5, y: 20.5 }, { x: 22.5, y: 20.5 }] }],
  };
  draft.boss = {
    actor: 'boss', name: 'Forest guardian', health: 1000,
    phases: [{ below: 1, name: 'Guarding', radius: 3, damage: 20, warningSeconds: 2, cooldown: 10, interruptDamage: 50,
      adds: [{ label: 'boss-add', side: 1, kind: 'unit', role: 'spear', x: 23.5, y: 23.5 }] },
      { below: .5, name: 'Enraged', radius: 4, damage: 30, warningSeconds: 1, cooldown: 5, interruptDamage: 50, adds: [] }],
  };
  draft.requiredActions = ['ability', 'hold', 'repair', 'gather'].map(action => ({
    action: action as NonNullable<ScenarioDefinition['requiredActions']>[number]['action'], count: 2, text: `Use ${action} twice.`,
  }));
  draft.map = scenarioMapFromPackage(mapDependency);
  draft.seed = mapDependency.map.seed;
  return draft;
}

function packageFixture() { return makeScenarioPackage(metadata, createScenarioDraft(), mapDependency); }
function nestedCondition(depth: number): ScenarioCondition {
  let condition: ScenarioCondition = { type: 'time', seconds: 1 };
  for (let index = 0; index < depth; index++) condition = { type: 'not', condition };
  return condition;
}

function worldFixture() {
  const world = generateWorldMap(42, 'small', 2, 'forest');
  const dependency = makeMapPackage({ id: 'cavern-scenario', title: 'Contested caverns', ...metadata }, world);
  const draft = createScenarioDraft(), center = world.sites[0];
  const destination = { x: center.x, y: center.y, level: 1 };
  const commander = { x: center.x, y: center.y + 2, level: 1 };
  const guard = { x: center.x + 2, y: center.y + 2, level: 1 };
  draft.map = scenarioMapFromPackage(dependency);
  draft.seed = world.seed;
  draft.army = [
    { label: 'commander', side: 0, kind: 'unit', role: 'melee', ...commander, order: { type: 'move', ...destination } },
    { label: 'guard', side: 1, kind: 'unit', role: 'ranged', ...guard },
  ];
  draft.objectives = [{ id: 'cavern-relic', text: 'Reach the cavern relic.', success: { type: 'at', actor: 'commander', point: destination, radius: 1 }, failure: { type: 'dead', actor: 'commander' } }];
  draft.events = [{ id: 'cavern-wave', when: { type: 'at', actor: 'guard', point: guard, radius: 1 }, actions: [
    { type: 'spawn', actors: [{ label: 'cavern-raider', side: 1, kind: 'unit', role: 'melee', x: center.x - 2, y: center.y + 2, level: 1, order: { type: 'move', ...destination } }] },
    { type: 'order', actors: ['cavern-raider'], order: { type: 'attackMove', ...destination } },
  ] }];
  draft.escort = { actor: 'commander', route: [commander, destination], radius: 1, escortRadius: 4 };
  draft.stealth = { infiltrators: ['commander'], guards: ['guard'], alarmLimit: 3, detectionSeconds: 2, radius: 6, coneDegrees: 90, patrols: [{ actor: 'guard', route: [guard, destination] }] };
  return { world, dependency, draft };
}

describe('scenario definition authoring', () => {
  it('creates detached valid starter documents', () => {
    const first = createScenarioDraft(), second = createScenarioDraft();
    expect(decodeScenarioDefinition(first)).toEqual(first);
    expect(first).toEqual(second);
    first.army[0].label = 'changed';
    expect(second.army[0].label).toBe('commander');
  });

  it('round trips actors, objectives, timed waves, escort, stealth, bosses and required actions', () => {
    const draft = controls();
    expect(decodeScenarioDefinition(JSON.stringify(draft))).toEqual(draft);
    const copied = decodeScenarioDraft(draft);
    copied.escort!.route[0].x = 1;
    copied.events[0].actions.length = 0;
    expect(draft.escort!.route[0].x).toBe(12.5);
    expect(draft.events[0].actions).toHaveLength(7);
  });

  it.each(Object.keys(FACTIONS))('accepts the %s faction on either side', faction => {
    const draft = createScenarioDraft();
    draft.faction = faction as ScenarioDefinition['faction'];
    draft.opponent = faction as ScenarioDefinition['opponent'];
    expect(decodeScenarioDefinition(draft)).toEqual(draft);
  });

  it.each<ScenarioOrder>([
    { type: 'move', x: 15.5, y: 15.5 }, { type: 'attackMove', x: 15.5, y: 15.5 },
    { type: 'hold' }, { type: 'stop' }, { type: 'ability' }, { type: 'attack', actor: 'commander' },
  ])('accepts an actor order $type', order => {
    const draft = createScenarioDraft();
    draft.army[0].order = order;
    expect(decodeScenarioDefinition(draft).army[0].order).toEqual(order);
  });

  it('keeps incomplete references and empty controls editable, then rejects them as complete definitions', () => {
    const draft = createScenarioDraft();
    draft.objectives[0].failure = { type: 'dead', actor: 'later-wave' };
    expect(decodeScenarioDraft(draft)).toEqual(draft);
    expect(() => decodeScenarioDefinition(draft)).toThrow('unknown actor label later-wave');
    expect(() => makeScenarioPackage(metadata, draft, mapDependency)).toThrow('unknown actor label later-wave');
    draft.objectives = [];
    draft.events = [{ id: 'unfinished', when: { type: 'time', seconds: 0 }, actions: [] }];
    expect(decodeScenarioDraft(draft)).toEqual(draft);
    expect(() => decodeScenarioDefinition(draft)).toThrow('scenario.objectives');
    draft.objectives = createScenarioDraft().objectives;
    expect(() => decodeScenarioDefinition(draft)).toThrow('scenario.events[0].actions');
  });

  it('resolves references to actors declared in later events and boss phases', () => {
    const draft = controls();
    draft.army[0].order = { type: 'attack', actor: 'boss-add' };
    draft.objectives[0].success = { type: 'dead', actor: 'wave-raider' };
    draft.events.unshift({ id: 'before-wave', when: { type: 'alive', actor: 'wave-raider' }, actions: [{ type: 'order', actors: ['boss-add'], order: { type: 'stop' } }] });
    expect(decodeScenarioDefinition(draft)).toEqual(draft);
  });

  it.each<[string, (draft: ScenarioDefinition) => void]>([
    ['actor order', s => { s.army[0].order = { type: 'attack', actor: 'missing' }; }],
    ['success condition', s => { s.objectives[0].success = { type: 'alive', actor: 'missing' }; }],
    ['failure condition', s => { s.objectives[0].failure = { type: 'dead', actor: 'missing' }; }],
    ['event condition', s => { s.events[0].when = { type: 'at', actor: 'missing', point: { x: 1, y: 1 }, radius: 1 }; }],
    ['order action actors', s => { s.events[0].actions.push({ type: 'order', actors: ['missing'], order: { type: 'hold' } }); }],
    ['order action target', s => { s.events[0].actions.push({ type: 'order', actors: ['commander'], order: { type: 'attack', actor: 'missing' } }); }],
    ['escort actor', s => { s.escort!.actor = 'missing'; }],
    ['stealth infiltrators', s => { s.stealth!.infiltrators = ['missing']; }],
    ['stealth guards', s => { s.stealth!.guards = ['missing']; }],
    ['patrol actor', s => { s.stealth!.patrols[0].actor = 'missing'; }],
    ['boss actor', s => { s.boss!.actor = 'missing'; }],
  ])('rejects an unresolved %s reference only when completing the definition', (_name, mutate) => {
    const draft = controls(); mutate(draft);
    expect(decodeScenarioDraft(draft)).toEqual(draft);
    expect(() => decodeScenarioDefinition(draft)).toThrow('unknown actor label missing');
  });

  it.each<[string, (draft: ScenarioDefinition) => void]>([
    ['initial actors', s => { s.army.push({ ...s.army[0] }); }],
    ['spawned actors', s => { s.events[0].actions.push({ type: 'spawn', actors: [{ ...s.army[0] }] }); }],
    ['boss adds', s => { s.boss!.phases[0].adds.push({ ...s.army[0] }); }],
    ['objectives', s => { s.objectives.push(structuredClone(s.objectives[0])); }],
    ['events', s => { s.events.push(structuredClone(s.events[0])); }],
  ])('rejects duplicate IDs across %s', (_name, mutate) => {
    const draft = controls(); mutate(draft);
    expect(() => decodeScenarioDraft(draft)).toThrow(/duplicate actor label|duplicate objective ID|duplicate event ID/);
  });

  it('accepts the advertised condition depth and rejects the next level in objectives and events', () => {
    const draft = controls();
    draft.objectives[0].success = nestedCondition(SCENARIO_EDITOR_LIMITS.conditionDepth);
    expect(decodeScenarioDefinition(draft)).toEqual(draft);
    draft.objectives[0].success = nestedCondition(SCENARIO_EDITOR_LIMITS.conditionDepth + 1);
    expect(() => decodeScenarioDraft(draft)).toThrow('condition is too deeply nested');
    draft.objectives[0].success = { type: 'time', seconds: 1 };
    draft.events[0].when = nestedCondition(SCENARIO_EDITOR_LIMITS.conditionDepth + 1);
    expect(() => decodeScenarioDraft(draft)).toThrow('condition is too deeply nested');
  });

  it.each<[string, (draft: ScenarioDefinition) => void, string]>([
    ['repeated spawning', s => { s.events[0].repeat = { seconds: 2, count: 2 }; }, 'repeated spawn'],
    ['all optional objectives', s => { s.objectives.forEach(objective => { objective.optional = true; }); }, 'at least one objective must be required'],
    ['empty army', s => { s.army = []; s.objectives = [{ id: 'wait', text: 'Wait for one minute.', success: { type: 'time', seconds: 60 } }]; s.events = []; delete s.escort; delete s.stealth; delete s.boss; }, 'army'],
    ['building escort', s => { s.escort!.actor = 'tower'; }, 'moving unit'],
    ['reserved variable key', s => { s.events[0].actions.push({ type: 'add', key: 'constructor', value: 1 }); }, 'invalid identifier'],
    ['numeric-leading ID', s => { s.id = '123-mission'; }, 'invalid identifier'],
    ['first boss threshold', s => { s.boss!.phases[0].below = .9; }, 'phase thresholds'],
    ['ascending boss thresholds', s => { s.boss!.phases[1].below = 1; }, 'phase thresholds'],
    ['excess actor health', s => { s.army[1].hp = FACTIONS.orcs.units.worker.hp + 1; }, 'hp'],
    ['fixed army recruitment', s => { s.rules.fixedArmy = true; }, 'fixed armies cannot recruit'],
  ])('keeps %s editable but prevents complete export and definition import', (_name, mutate, error) => {
    const draft = controls(); mutate(draft);
    expect(decodeScenarioDraft(draft)).toEqual(draft);
    expect(() => decodeScenarioDefinition(draft)).toThrow(error);
    expect(() => makeScenarioPackage(metadata, draft, mapDependency)).toThrow(error);
  });

  it('requires the boss actor in the initial army before gameplay initializes its health', () => {
    const draft = controls(), boss = draft.army.find(actor => actor.label === 'boss')!;
    draft.army = draft.army.filter(actor => actor !== boss);
    draft.events[0].actions.push({ type: 'spawn', actors: [boss] });
    expect(decodeScenarioDraft(draft)).toEqual(draft);
    expect(() => decodeScenarioDefinition(draft)).toThrow(/boss.*initial|initial.*boss/);
    expect(() => makeScenarioPackage(metadata, draft, mapDependency)).toThrow(/boss.*initial|initial.*boss/);
  });
});

describe('scenario schema bounds', () => {
  it.each<[string, (draft: ScenarioDefinition) => void, string]>([
    ['schema version', s => { s.schemaVersion = 2 as 1; }, 'schemaVersion'],
    ['unknown top field', s => { Object.assign(s, { unknown: true }); }, 'unknown'],
    ['missing field', s => { Reflect.deleteProperty(s, 'rules'); }, 'rules'],
    ['blank title', s => { s.title = ' '; }, 'title'],
    ['control characters', s => { s.briefing = '\u0000'; }, 'briefing'],
    ['invalid ID', s => { s.id = '../mission'; }, 'id'],
    ['unknown faction', s => { s.faction = 'unknown' as ScenarioDefinition['faction']; }, 'faction'],
    ['fractional seed', s => { s.seed = 1.5; }, 'seed'],
    ['seed overflow', s => { s.seed = 0x100000000; }, 'seed'],
    ['actor side', s => { s.army[0].side = 2 as 0; }, 'side'],
    ['building unit role', s => { s.army[0].kind = 'building'; }, 'role'],
    ['actor coordinates', s => { s.army[0].x = -1; }, 'x'],
    ['actor health', s => { s.army[0].hp = 0; }, 'hp'],
    ['actor definition ID', s => { s.army[0].definitionId = 'bad/id'; }, 'definitionId'],
    ['order extra field', s => { s.army[0].order = { type: 'hold', x: 1 } as ScenarioOrder; }, 'order.x'],
    ['optional flag', s => { s.objectives[0].optional = 1 as unknown as boolean; }, 'optional'],
    ['empty all condition', s => { s.objectives[0].success = { type: 'all', conditions: [] }; }, 'conditions'],
    ['time condition', s => { s.objectives[0].success = { type: 'time', seconds: -1 }; }, 'seconds'],
    ['condition radius', s => { s.objectives[0].success = { type: 'at', actor: 'commander', point: { x: 1, y: 1 }, radius: 0 }; }, 'radius'],
    ['fixed army flag', s => { s.rules.fixedArmy = 'true' as unknown as boolean; }, 'fixedArmy'],
    ['fractional budget', s => { s.rules.reinforcementBudget = .5; }, 'reinforcementBudget'],
    ['negative resources', s => { s.rules.resources.wood = -1; }, 'wood'],
    ['zero time limit', s => { s.rules.timeLimit = 0; }, 'timeLimit'],
    ['repeat interval', s => { s.events[1].repeat!.seconds = 0; }, 'repeat.seconds'],
    ['fractional repeat count', s => { s.events[1].repeat!.count = 1.5; }, 'repeat.count'],
    ['empty spawn', s => { s.events[0].actions = [{ type: 'spawn', actors: [] }]; }, 'actors'],
    ['empty order actors', s => { s.events[0].actions = [{ type: 'order', actors: [], order: { type: 'hold' } }]; }, 'actors'],
    ['empty message', s => { s.events[0].actions = [{ type: 'message', text: '' }]; }, 'text'],
    ['reward resources', s => { s.events[0].actions = [{ type: 'reward', side: 0, resources: { wood: -1, ore: 0, crystal: 0 } }]; }, 'wood'],
    ['finish outcome', s => { s.events[0].actions = [{ type: 'finish', outcome: 'draw' as 'won', reason: 'Finished' }]; }, 'outcome'],
    ['empty escort route', s => { s.escort!.route = []; }, 'route'],
    ['escort radius', s => { s.escort!.escortRadius = 0; }, 'escortRadius'],
    ['stealth angle', s => { s.stealth!.coneDegrees = 361; }, 'coneDegrees'],
    ['empty patrol route', s => { s.stealth!.patrols[0].route = []; }, 'route'],
    ['boss threshold', s => { s.boss!.phases[0].below = 2; }, 'below'],
    ['boss warning', s => { s.boss!.phases[0].warningSeconds = 0; }, 'warningSeconds'],
    ['required action', s => { s.requiredActions![0].action = 'attack' as 'hold'; }, 'action'],
    ['required action count', s => { s.requiredActions![0].count = 0; }, 'count'],
    ['actor limit', s => { s.army = Array.from({ length: SCENARIO_EDITOR_LIMITS.actors + 1 }, (_, i) => ({ ...s.army[0], label: `actor-${i}` })); }, 'army'],
    ['objective limit', s => { s.objectives = Array.from({ length: SCENARIO_EDITOR_LIMITS.objectives + 1 }, (_, i) => ({ ...s.objectives[0], id: `objective-${i}` })); }, 'objectives'],
    ['event limit', s => { s.events = Array.from({ length: SCENARIO_EDITOR_LIMITS.events + 1 }, (_, i) => ({ ...s.events[0], id: `event-${i}` })); }, 'events'],
    ['action limit', s => { s.events[0].actions = Array.from({ length: SCENARIO_EDITOR_LIMITS.actions + 1 }, () => ({ type: 'message', text: 'Message' })); }, 'actions'],
  ])('rejects %s while editing', (_name, mutate, path) => {
    const draft = controls(); mutate(draft);
    expect(() => decodeScenarioDraft(draft)).toThrow(path);
  });

  it('checks actor, order and route coordinates against the selected map dimensions', () => {
    const draft = controls();
    draft.map = scenarioMapFromPackage(mapDependency);
    draft.army[0].x = draft.map.width;
    expect(() => decodeScenarioDraft(draft)).toThrow('point lies outside the map');
    draft.army[0].x = 10.5;
    draft.army[0].order = { type: 'move', x: draft.map.width, y: 1 };
    expect(() => decodeScenarioDraft(draft)).toThrow('point lies outside the map');
    draft.army[0].order = { type: 'hold' };
    draft.escort!.route[0].y = draft.map.height;
    expect(() => decodeScenarioDraft(draft)).toThrow('point lies outside the map');
  });
});

describe('safe scenario JSON input', () => {
  it.each([NaN, Infinity, -Infinity])('rejects nonfinite numbers (%s)', value => {
    const draft = createScenarioDraft(); draft.army[0].x = value;
    expect(() => decodeScenarioDraft(draft)).toThrow('finite number');
  });

  it('rejects getters without invoking them, including array elements', () => {
    const draft = createScenarioDraft(); let reads = 0;
    Object.defineProperty(draft, 'title', { enumerable: true, get: () => { reads++; return 'Getter title'; } });
    expect(() => decodeScenarioDraft(draft)).toThrow('accessors');
    const arrayDraft = createScenarioDraft();
    Object.defineProperty(arrayDraft.army, '0', { enumerable: true, get: () => { reads++; return createScenarioDraft().army[0]; } });
    expect(() => decodeScenarioDraft(arrayDraft)).toThrow('accessors');
    expect(reads).toBe(0);
  });

  it.each<[string, (draft: ScenarioDefinition) => void]>([
    ['class instance', s => { Object.setPrototypeOf(s.army[0], new Date()); }],
    ['inherited root', s => { Object.setPrototypeOf(s, { inherited: true }); }],
    ['hidden field', s => { Object.defineProperty(s.army[0], 'hidden', { value: true }); }],
    ['symbol field', s => { Object.assign(s.army[0], { [Symbol('hidden')]: true }); }],
    ['array hole', s => { Reflect.deleteProperty(s.army, '0'); }],
    ['array extra field', s => { Object.assign(s.army, { extra: true }); }],
    ['hidden array element', s => { Object.defineProperty(s.army, '0', { value: s.army[0], enumerable: false }); }],
    ['cyclic condition', s => { const c = { type: 'not' } as ScenarioCondition & { condition: ScenarioCondition }; c.condition = c; s.objectives[0].success = c; }],
    ['non-JSON value', s => { Object.assign(s, { unknown: undefined }); }],
  ])('rejects a %s', (_name, mutate) => {
    const draft = createScenarioDraft(); mutate(draft);
    expect(() => decodeScenarioDraft(draft)).toThrow();
  });

  it.each(['__proto__', 'constructor', 'prototype'])('rejects the unsafe property %s', key => {
    const draft = createScenarioDraft();
    Object.defineProperty(draft.army[0], key, { value: 'unsafe', enumerable: true });
    expect(() => decodeScenarioDraft(draft)).toThrow('unsafe property name');
  });

  it('accepts null-prototype data and returns ordinary detached JSON objects', () => {
    const draft = createScenarioDraft(); Object.setPrototypeOf(draft, null);
    const decoded = decodeScenarioDraft(draft);
    expect(decoded).toEqual(draft);
    expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
    expect(decoded.army[0]).not.toBe(draft.army[0]);
  });

  it('rejects malformed JSON and oversized documents before reading scenario fields', () => {
    expect(() => decodeScenarioDraft('{')).toThrow('invalid JSON');
    expect(() => decodeScenarioDraft(' '.repeat(SCENARIO_EDITOR_LIMITS.bytes + 1))).toThrow('byte limit');
  });
});

describe('scenario package integrity', () => {
  it('binds map seed and data, keeps authoring input detached, and round trips JSON', () => {
    const draft = controls(), before = structuredClone(draft);
    const packaged = makeScenarioPackage(metadata, draft, mapDependency);
    expect(draft).toEqual(before);
    expect(packaged).toMatchObject({ schemaVersion: 1, kind: 'scenario', simulationVersion: SAVE_VERSION, ...metadata, mapHash: mapDependency.hash });
    expect(packaged.scenario.seed).toBe(mapDependency.map.seed);
    expect(packaged.scenario.map).toEqual(scenarioMapFromPackage(mapDependency));
    expect(packaged.contentHash).toBe(canonicalScenarioHash(packaged.scenario));
    expect(decodeScenarioPackage(JSON.stringify(packaged))).toEqual(packaged);
    packaged.scenario.army[0].x = 1;
    packaged.map.map.levels[0].terrain[0] = 'water';
    expect(draft).toEqual(before);
    expect(mapDependency.map.levels[0].terrain[0]).not.toBe('water');
  });

  it('hashes independently of object key order and normalizes negative zero', () => {
    const draft = createScenarioDraft();
    const reordered = Object.fromEntries(Object.entries(draft).reverse());
    expect(canonicalScenarioHash(reordered)).toBe(canonicalScenarioHash(draft));
    draft.rules.resources.wood = -0;
    expect(canonicalScenarioHash(draft)).toBe(canonicalScenarioHash(createScenarioDraft()));
    expect(makeScenarioPackage(metadata, draft, mapDependency).hash).toBe(packageFixture().hash);
    const packaged = packageFixture();
    expect(decodeScenarioPackage(Object.fromEntries(Object.entries(packaged).reverse()))).toEqual(packaged);
  });

  it('changes content hashes for authored changes and package hashes for metadata changes', () => {
    const first = packageFixture(), draft = createScenarioDraft(); draft.title = 'A different title';
    const contentEdit = makeScenarioPackage(metadata, draft, mapDependency);
    const revisionEdit = makeScenarioPackage({ ...metadata, revision: 2 }, createScenarioDraft(), mapDependency);
    expect(contentEdit.contentHash).not.toBe(first.contentHash);
    expect(contentEdit.hash).not.toBe(first.hash);
    expect(revisionEdit.contentHash).toBe(first.contentHash);
    expect(revisionEdit.hash).not.toBe(first.hash);
  });

  it('binds the complete map package hash when map metadata changes', () => {
    const first = packageFixture();
    const changedMetadata = makeMapPackage({ id: mapDependency.id, title: mapDependency.title, author: metadata.author, revision: 2 }, mapDependency.map);
    const packaged = makeScenarioPackage(metadata, createScenarioDraft(), changedMetadata);
    expect(packaged.scenario.map).toEqual(first.scenario.map);
    expect(packaged.contentHash).toBe(first.contentHash);
    expect(packaged.mapHash).toBe(changedMetadata.hash);
    expect(packaged.mapHash).not.toBe(first.mapHash);
    expect(packaged.hash).not.toBe(first.hash);
    expect(decodeScenarioPackage(packaged)).toEqual(packaged);
  });

  it('changes the scenario and dependency hashes when starting positions change assignment', () => {
    const first = packageFixture(), reassignedMap = structuredClone(mapDependency.map);
    const [a, b] = reassignedMap.starts;
    reassignedMap.starts = [{ ...b, slot: 0 }, { ...a, slot: 1 }];
    const dependency = makeMapPackage({ id: mapDependency.id, title: mapDependency.title, ...metadata }, reassignedMap);
    const packaged = makeScenarioPackage(metadata, createScenarioDraft(), dependency);
    expect(dependency.map.starts.map(start => start.slot)).toEqual([0, 1]);
    expect(packaged.scenario.map!.starts).toEqual([...first.scenario.map!.starts].reverse());
    expect(packaged.contentHash).not.toBe(first.contentHash);
    expect(packaged.mapHash).toBe(dependency.hash);
    expect(packaged.mapHash).not.toBe(first.mapHash);
    expect(packaged.hash).not.toBe(first.hash);
    expect(decodeScenarioPackage(packaged)).toEqual(packaged);
  });

  it('rejects package and metadata accessors without running user code', () => {
    let reads = 0;
    const packaged = packageFixture();
    Object.defineProperty(packaged, 'hash', { enumerable: true, get: () => { reads++; return '0'.repeat(16); } });
    expect(() => decodeScenarioPackage(packaged)).toThrow('accessors');
    const unsafeMetadata = { revision: 1, get author() { reads++; return 'Author'; } };
    expect(() => makeScenarioPackage(unsafeMetadata, createScenarioDraft(), mapDependency)).toThrow('accessors');
    expect(reads).toBe(0);
  });

  it('rejects unresolved actor references in imported complete packages', () => {
    const packaged = packageFixture();
    packaged.scenario.objectives[0].failure = { type: 'dead', actor: 'later-wave' };
    expect(() => decodeScenarioPackage(packaged)).toThrow('unknown actor label later-wave');
  });

  it.each<[string, (packaged: ReturnType<typeof packageFixture>) => void, string]>([
    ['schema', p => { p.schemaVersion = 2 as 1; }, 'unsupported package schema'],
    ['kind', p => { p.kind = 'map' as 'scenario'; }, 'unsupported package schema'],
    ['simulation version', p => { p.simulationVersion++; }, 'simulationVersion'],
    ['unknown field', p => { Object.assign(p, { extra: true }); }, 'unknown field'],
    ['missing field', p => { Reflect.deleteProperty(p, 'mapHash'); }, 'missing field'],
    ['revision', p => { p.revision = 0; }, 'revision'],
    ['empty author', p => { p.author = ''; }, 'author'],
    ['hash format', p => { p.hash = 'not-a-checksum'; }, 'invalid checksum'],
    ['map hash format', p => { p.mapHash = 'ABCDEF0123456789'; }, 'invalid checksum'],
    ['content hash format', p => { p.contentHash = 'f'.repeat(15); }, 'invalid checksum'],
    ['map hash tampering', p => { p.mapHash = '0'.repeat(16); }, 'map dependency checksum mismatch'],
    ['scenario content tampering', p => { p.scenario.title = 'Tampered title'; }, 'scenario checksum mismatch'],
    ['content hash tampering', p => { p.contentHash = '0'.repeat(16); }, 'scenario checksum mismatch'],
    ['package hash tampering', p => { p.hash = '0'.repeat(16); }, 'package checksum mismatch'],
    ['metadata tampering', p => { p.author = 'Another author'; }, 'package checksum mismatch'],
    ['map dependency content tampering', p => { p.map.map.seed++; }, 'map checksum mismatch'],
  ])('rejects package %s', (_name, mutate, error) => {
    const packaged = packageFixture(); mutate(packaged);
    expect(() => decodeScenarioPackage(packaged)).toThrow(error);
  });

  it.each(['terrain', 'seed'] as const)('rejects a checksummed scenario whose %s differs from its map dependency', field => {
    const packaged = packageFixture();
    if (field === 'terrain') packaged.scenario.map!.terrain[0] = 'water';
    else packaged.scenario.seed++;
    packaged.contentHash = canonicalScenarioHash(packaged.scenario);
    expect(() => decodeScenarioPackage(packaged)).toThrow('embedded scenario map differs from dependency');
  });

  it('rejects a different valid map dependency even if its mapHash is updated', () => {
    const packaged = packageFixture();
    packaged.map = makeMapPackage({ id: 'different-ground', title: 'Different ground', ...metadata }, createEditorMap(4128, 'small'));
    packaged.mapHash = packaged.map.hash;
    expect(() => decodeScenarioPackage(packaged)).toThrow('embedded scenario map differs from dependency');
  });

  it('rejects a map with three valid starting positions during export and import', () => {
    const map = createEditorMap(4127, 'small', 3); map.levels[0].terrain.fill('grass');
    const dependency = makeMapPackage({ id: 'three-starts', title: 'Three starts', ...metadata }, map);
    expect(() => makeScenarioPackage(metadata, createScenarioDraft(), dependency)).toThrow('two starting positions');
    const packaged = packageFixture(); packaged.map = dependency; packaged.mapHash = dependency.hash;
    expect(() => decodeScenarioPackage(packaged)).toThrow('two starting positions');
  });

  it.each(['impassable headquarters', 'noncontiguous slots'] as const)('rejects an integrity-valid map with %s before accepting a scenario package', problem => {
    const dependency = structuredClone(mapDependency);
    if (problem === 'impassable headquarters') {
      const start = dependency.map.starts[0];
      dependency.map.levels[0].terrain[Math.floor(start.y) * dependency.map.width + Math.floor(start.x)] = 'rock';
    } else dependency.map.starts[1].slot = 2;
    dependency.contentHash = canonicalMapHash(dependency.map);
    const { hash: _previousHash, ...body } = dependency;
    dependency.hash = canonicalPackageHash(body);
    expect(() => makeScenarioPackage(metadata, createScenarioDraft(), dependency)).toThrow(/cannot be played/);
    const packaged = packageFixture(); packaged.map = dependency; packaged.mapHash = dependency.hash;
    expect(() => decodeScenarioPackage(packaged)).toThrow(problem === 'impassable headquarters'
      ? 'headquarters requires flat buildable terrain' : 'Starting slots must be contiguous');
  });

  it.each([
    { author: '', revision: 1 }, { author: 'Author', revision: 0 }, { author: 'Author', revision: 1.5 },
    { author: 'Author', revision: 1, extra: true },
  ])('rejects invalid package metadata %j', invalid => {
    expect(() => makeScenarioPackage(invalid, createScenarioDraft(), mapDependency)).toThrow();
  });
});

describe('scenario world map dependencies', () => {
  it('preserves flat map packages in the existing scenario representation', () => {
    const map = scenarioMapFromPackage(mapDependency);
    expect(map.world).toBeUndefined();
    expect(map.starts.every(start => !Object.hasOwn(start, 'level'))).toBe(true);
    expect(map.resources.every(resource => !Object.hasOwn(resource, 'level'))).toBe(true);
    expect(decodeScenarioPackage(packageFixture()).scenario.map).toEqual(map);
  });

  it('round trips both levels, elevation, sites, entrances and resource levels with authored cavern controls', () => {
    const { world, dependency, draft } = worldFixture();
    expect(world.levels).toHaveLength(2);
    expect(world.levels[0].elevation.some(value => value > 0)).toBe(true);
    expect(world.sites).not.toHaveLength(0);
    expect(world.transitions).not.toHaveLength(0);
    expect(world.resources.some(resource => resource.level === 1)).toBe(true);
    expect(draft.map!.world).toEqual(world);
    expect(draft.map!.terrain).toEqual(world.levels[0].terrain);
    expect(draft.map!.starts).toEqual(world.starts.map(({ x, y, level }) => ({ x, y, level })));
    expect(draft.map!.resources).toEqual(world.resources);
    expect(decodeScenarioDraft(draft)).toEqual(draft);
    expect(decodeScenarioDefinition(draft)).toEqual(draft);
    const packaged = makeScenarioPackage(metadata, draft, dependency);
    expect(packaged.map.map).toEqual(world);
    expect(packaged.mapHash).toBe(dependency.hash);
    expect(packaged.contentHash).toBe(canonicalScenarioHash(packaged.scenario));
    expect(decodeScenarioPackage(JSON.stringify(packaged))).toEqual(packaged);
    expect(makeScenarioPackage(metadata, draft, dependency).hash).toBe(packaged.hash);
    packaged.scenario.map!.world!.levels[1].terrain[0] = 'grass';
    packaged.scenario.map!.world!.transitions[0].to.x++;
    packaged.scenario.escort!.route[0].level = 0;
    expect(draft.map!.world).toEqual(world);
    expect(dependency.map).toEqual(world);
    expect(draft.escort!.route[0].level).toBe(1);
  });

  it('checks an actor against the terrain on its selected level', () => {
    const { world, dependency, draft } = worldFixture();
    const index = world.levels[0].terrain.findIndex((terrain, tile) => {
      const x = tile % world.width, y = Math.floor(tile / world.width);
      return x > 0 && y > 0 && x < world.width - 1 && y < world.height - 1
        && TERRAIN[terrain].walkable && !TERRAIN[world.levels[1].terrain[tile]].walkable;
    });
    expect(index).toBeGreaterThanOrEqual(0);
    draft.army[0].x = index % world.width + .5;
    draft.army[0].y = Math.floor(index / world.width) + .5;
    expect(() => decodeScenarioDefinition(draft)).toThrow('actor is on impassable terrain');
    expect(() => makeScenarioPackage(metadata, draft, dependency)).toThrow('actor is on impassable terrain');
    draft.army[0].level = 0;
    expect(decodeScenarioDefinition(draft)).toEqual(draft);
  });

  it.each<[string, (draft: ScenarioDefinition) => void]>([
    ['actor', s => { s.army[0].level = 2; }],
    ['actor movement order', s => { s.army[0].order = { type: 'move', x: 18.5, y: 18.5, level: 2 }; }],
    ['spawned actor', s => { if (s.events[0].actions[0].type === 'spawn') s.events[0].actions[0].actors[0].level = 2; }],
    ['spawned actor movement order', s => { if (s.events[0].actions[0].type === 'spawn') s.events[0].actions[0].actors[0].order = { type: 'move', x: 18.5, y: 18.5, level: 2 }; }],
    ['event order', s => { s.events[0].actions[1] = { type: 'order', actors: ['cavern-raider'], order: { type: 'attackMove', x: 18.5, y: 18.5, level: 2 } }; }],
    ['objective point', s => { s.objectives[0].success = { type: 'at', actor: 'commander', point: { x: 18.5, y: 18.5, level: 2 }, radius: 1 }; }],
    ['event point', s => { s.events[0].when = { type: 'at', actor: 'guard', point: { x: 18.5, y: 18.5, level: 2 }, radius: 1 }; }],
    ['escort route', s => { s.escort!.route[0].level = 2; }],
    ['patrol route', s => { s.stealth!.patrols[0].route[0].level = 2; }],
    ['flattened start', s => { s.map!.starts[0].level = 2; }],
    ['flattened resource', s => { s.map!.resources[0].level = 2; }],
    ['world start', s => { s.map!.world!.starts[0].level = 2; }],
    ['world resource', s => { s.map!.world!.resources[0].level = 2; }],
    ['world site', s => { s.map!.world!.sites[0].level = 2; }],
    ['world entrance', s => { s.map!.world!.transitions[0].to.level = 2; }],
  ])('rejects an unknown level on the %s', (_name, mutate) => {
    const { dependency, draft } = worldFixture(); mutate(draft);
    expect(() => decodeScenarioDraft(draft)).toThrow(/level/);
    expect(() => decodeScenarioDefinition(draft)).toThrow(/level/);
    expect(() => makeScenarioPackage(metadata, draft, dependency)).toThrow(/level/);
  });

  it.each([-1, .5, NaN, Infinity])('rejects malformed actor levels (%s)', level => {
    const { draft } = worldFixture(); draft.army[0].level = level;
    expect(() => decodeScenarioDraft(draft)).toThrow(/level/);
  });

  it('rejects cavern references when the map contains only ground level', () => {
    const draft = createScenarioDraft(); draft.army[0].level = 1;
    expect(decodeScenarioDraft(draft)).toEqual(draft);
    expect(() => decodeScenarioDefinition(draft)).toThrow('level');
    expect(() => makeScenarioPackage(metadata, draft, mapDependency)).toThrow('level');
  });

  it.each<[string, (draft: ScenarioDefinition) => void, string]>([
    ['ground terrain', s => { s.map!.terrain[0] = s.map!.terrain[0] === 'water' ? 'grass' : 'water'; }, 'scenario ground map'],
    ['map size', s => { s.map!.size = 'medium'; }, 'scenario ground map'],
    ['world seed', s => { s.map!.world!.seed++; }, 'scenario ground map'],
    ['starting coordinates', s => { s.map!.starts[0].x++; }, 'layered starts or resources'],
    ['starting level', s => { s.map!.starts[0].level = 1; }, 'layered starts or resources'],
    ['resource amount', s => { s.map!.resources[0].amount--; }, 'layered starts or resources'],
    ['resource level', s => { s.map!.resources[0].level = 1; }, 'layered starts or resources'],
  ])('rejects flattened %s that disagree with the embedded world', (_name, mutate, error) => {
    const { draft } = worldFixture(); mutate(draft);
    expect(decodeScenarioDraft(draft)).toEqual(draft);
    expect(() => decodeScenarioDefinition(draft)).toThrow(error);
  });

  it.each<[string, (draft: ScenarioDefinition) => void]>([
    ['level title', s => { s.map!.world!.levels[1].title = 'A renamed cavern'; }],
    ['elevation', s => { const map = s.map!.world!; map.levels[1].elevation[Math.floor(map.height / 2) * map.width + Math.floor(map.width / 2)] = 1; }],
    ['site', s => { s.map!.world!.sites[0].x++; }],
    ['entrance', s => { s.map!.world!.transitions[0].to.x++; }],
    ['resource amount', s => { s.map!.world!.resources[0].amount--; s.map!.resources[0].amount--; }],
  ])('rejects checksummed world %s tampering that differs from the map dependency', (_name, mutate) => {
    const { draft, dependency } = worldFixture(), packaged = makeScenarioPackage(metadata, draft, dependency);
    const originalHash = packaged.contentHash;
    mutate(packaged.scenario);
    packaged.contentHash = canonicalScenarioHash(packaged.scenario);
    expect(packaged.contentHash).not.toBe(originalHash);
    expect(() => decodeScenarioPackage(packaged)).toThrow('embedded scenario map differs from dependency');
  });

  it('permits rich scenario definitions without private crystal reserves', () => {
    const { draft } = worldFixture();
    draft.map!.world!.resources = draft.map!.world!.resources.filter(resource => resource.level !== 0 || resource.kind !== 'crystal');
    draft.map!.resources = draft.map!.resources.filter(resource => resource.level !== 0 || resource.kind !== 'crystal');
    expect(decodeScenarioDraft(draft)).toEqual(draft);
    expect(decodeScenarioDefinition(draft)).toEqual(draft);
  });

  it('rejects reordered world levels before hashing or complete export', () => {
    const { draft, dependency } = worldFixture();
    dependency.map.levels.reverse();
    expect(() => canonicalMapHash(dependency.map)).toThrow(/level|identifier/);
    expect(() => makeScenarioPackage(metadata, draft, dependency)).toThrow(/level|identifier/);
  });

  it('rejects reordered starting slots during play validation even with valid checksums', () => {
    const { draft, dependency } = worldFixture();
    dependency.map.starts.reverse();
    dependency.contentHash = canonicalMapHash(dependency.map);
    const { hash: _previousHash, ...body } = dependency;
    dependency.hash = canonicalPackageHash(body);
    expect(() => makeScenarioPackage(metadata, draft, dependency)).toThrow(/slot/);
  });
});
