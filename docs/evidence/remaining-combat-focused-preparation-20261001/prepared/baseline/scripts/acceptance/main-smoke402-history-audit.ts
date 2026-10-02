import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { subscribeSimulation } from '../../src/core/history-hooks';
import { decodeReplay, ReplayPlayer, replayChecksum } from '../../src/core/replays';
import type { ReplayAction, ReplayArchive } from '../../src/core/replays';
import { saveGame, SAVE_VERSION } from '../../src/core/saves';
import type { SaveEnvelope } from '../../src/core/saves';
import { decodeSessionFile } from '../../src/core/session-storage';
import type { SessionFile } from '../../src/core/session-storage';
import { captureRuntime, issueCommand, stepGame } from '../../src/core/simulation';
import type { Entity, GameState } from '../../src/core/types';
import { SIMULATION_REVISION } from '../../src/core/versions';
import { readAuthenticatedDownload } from './native-downloads';

const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const canonicalCases = ['formation-line', 'formation-wedge', 'formation-square', 'formation-loose', 'charge-pike-front', 'charge-pike-rear', 'siege-full-crew-capture', 'ambush-selected-trigger', 'morale-supported-full-fight'];
const replayFields = ['format', 'version', 'initial', 'actions', 'finalTick', 'finalChecksum', 'checksumVersion', 'simulationRevision'] as const;
type Frame = {
  tick: number; time: number; actors: Entity[];
  projectiles: NonNullable<GameState['projectiles']>;
  visibleHostiles: Record<number, number[]>;
};
type TickObservation = { before: Frame; after: Frame; dt: number; events: GameState['events'] };
type CommandObservation = { actionIndex: number; tick: number; side: number; command: Extract<ReplayAction, { type: 'command' }>['command'] };
type CurrentReplay = ReplayArchive & { initial: SaveEnvelope };
type CurrentSession = Omit<SessionFile, 'game' | 'replay'> & { game: SaveEnvelope; replay: CurrentReplay };
type Authored = { name: string; scenario: any; file: CurrentSession };
type History = { scenario: string; file: string; initial: SaveEnvelope; commands: CommandObservation[]; ticks: TickObservation[] };

function safeFixture(directory: string, filename: string) {
  assert(typeof filename === 'string' && filename.length > 0 && !filename.includes('\\'));
  assert(filename.split('/').every(part => /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.json)?$/.test(part)), 'Safe declared fixture path');
  const root = realpathSync(directory), path = resolve(root, filename);
  assert(path.startsWith(`${root}${sep}`));
  const status = lstatSync(path);
  assert(status.isFile() && !status.isSymbolicLink());
  assert(realpathSync(path).startsWith(`${root}${sep}`), 'Fixture remains within its frozen directory');
  return path;
}

function frame(state: GameState, ids: number[]): Frame {
  const actors = state.entities.filter(actor => ids.includes(actor.id));
  const visibleHostiles: Record<number, number[]> = {};
  for (const actor of actors) visibleHostiles[actor.id] = state.entities.filter(other =>
    other.hp > 0 && state.teams[other.side] !== state.teams[actor.side] && (other.level ?? 0) === (actor.level ?? 0) &&
    state.visible[actor.side].has((other.level ?? 0) * state.width * state.height + Math.floor(other.y) * state.width + Math.floor(other.x))
  ).map(other => other.id);
  return { tick: state.tick, time: state.time, actors: structuredClone(actors), projectiles: structuredClone(state.projectiles ?? []), visibleHostiles };
}

function commands(archive: ReplayArchive): CommandObservation[] {
  let tick = archive.initial.state.tick;
  const result: CommandObservation[] = [];
  for (const [actionIndex, action] of archive.actions.entries()) {
    if (action.type === 'advance') tick += action.ticks;
    else result.push({ actionIndex, tick, side: action.side, command: structuredClone(action.command) });
  }
  return result;
}

// Same advance-splitting algorithm as native-audit.ts; the checkpoint can end
// partway through an advance action in the later complete history.
function commandSuffix(partial: SessionFile, full: SessionFile): ReplayAction[] {
  assert(partial.replay && full.replay); assert.deepEqual(partial.replay.initial, full.replay.initial);
  const prefix = partial.replay.actions, actions = full.replay.actions;
  let fullIndex = 0, consumedAdvance = 0;
  for (const action of prefix) {
    if (action.type === 'command') {
      assert.equal(consumedAdvance, 0, 'Checkpoint commands cannot occur inside a later advance');
      assert.deepEqual(actions[fullIndex++], action, 'Native checkpoint command prefix');
      continue;
    }
    let left = action.ticks;
    while (left) {
      const current = actions[fullIndex]; assert(current?.type === 'advance'); assert.equal(current.dt, action.dt);
      const take = Math.min(left, current.ticks - consumedAdvance); assert(take > 0);
      left -= take; consumedAdvance += take;
      if (consumedAdvance === current.ticks) { fullIndex++; consumedAdvance = 0; }
    }
  }
  const suffix = structuredClone(actions.slice(fullIndex));
  if (consumedAdvance) { assert(suffix[0]?.type === 'advance'); suffix[0].ticks -= consumedAdvance; }
  return suffix;
}

function actor(at: Frame, id: number): Entity {
  const entity = at.actors.find(item => item.id === id); assert(entity, `Observed entity ${id} at tick ${at.tick}`); return entity;
}
const distance = (a: Entity, b: Entity) => (a.level ?? 0) === (b.level ?? 0) ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity;
const positiveHits = (history: History, source?: number, target?: number) => history.ticks.flatMap(tick => tick.events
  .filter(event => event.type === 'attack' && (event.amount ?? 0) > 0 && (source === undefined || event.source === source) && (target === undefined || event.target === target))
  .map(event => ({ tick: tick.after.tick, event, before: tick.before, after: tick.after })));
function nativeCommand(history: History, type: string, predicate: (command: any) => boolean) {
  const record = history.commands.find(record => record.side === 0 && record.command.type === type && predicate(record.command));
  assert(record, `Retained native ${type} in ${history.file}`); return record;
}

/** Focused retained-history verification only. Root supplies execution admission. */
export function verifyMainSmoke402Artifacts({ evidenceDir, fixturesDir, manifest, receipt, sourceCommit }: {
  evidenceDir: string; fixturesDir: string; manifest: any; receipt: any; sourceCommit: string;
}) {
  assert.match(sourceCommit, /^[0-9a-f]{40}$/);
  // Bind the supplied objects to the actual completed receipt and fixture manifest.
  assert.deepEqual(JSON.parse(readFileSync(resolve(evidenceDir, 'browser-main-smoke402.json'), 'utf8')), receipt);
  assert.deepEqual(JSON.parse(readFileSync(resolve(fixturesDir, 'manifest.json'), 'utf8')), manifest);
  assert.equal(manifest.sourceCommit, sourceCommit); assert.equal(receipt.source.commit, sourceCommit);
  assert.equal(SAVE_VERSION, 4); assert.equal(SIMULATION_REVISION, '4.0.2');
  assert.equal(manifest.saveVersion, SAVE_VERSION); assert.equal(manifest.simulationRevision, SIMULATION_REVISION);
  assert.equal(receipt.source.saveVersion, SAVE_VERSION); assert.equal(receipt.source.simulationRevision, SIMULATION_REVISION);
  assert.equal(receipt.completed, true, 'Only a completed browser receipt admits its retained histories');
  assert.equal(receipt.cleanup?.completed, true, 'Completed receipt includes its browser cleanup');
  const selected: string[] = receipt.selectedGroups;
  assert(Array.isArray(selected) && selected.length > 0 && new Set(selected).size === selected.length);
  assert(selected.every(group => ['canonical', 'ruins'].includes(group)));
  assert.deepEqual(Object.keys(receipt.groups).sort(), [...selected].sort());
  assert(receipt.downloads && Object.keys(receipt.downloads).length > 0);
  if (selected.includes('canonical')) {
    assert.equal(receipt.groups.canonical.completed, true);
    assert.deepEqual([...receipt.groups.canonical.caseNames].sort(), [...canonicalCases].sort());
    assert(Array.isArray(receipt.groups.canonical.exports));
  }
  if (selected.includes('ruins')) assert(receipt.groups.ruins.results && receipt.groups.ruins.capture);

  const authoredByName = new Map<string, Authored>(), authoredByInitial = new Map<string, Authored[]>();
  for (const [name, scenario] of Object.entries(manifest.scenarios) as [string, any][]) {
    const bytes = readFileSync(safeFixture(fixturesDir, scenario.file));
    assert.equal(digest(bytes), scenario.sha256, `${name} frozen fixture hash`);
    if (scenario.bytes !== undefined) assert.equal(bytes.length, scenario.bytes);
    const file = JSON.parse(bytes.toString()) as CurrentSession;
    const key = digest(JSON.stringify(file.game)), entry = { name, scenario, file };
    authoredByName.set(name, entry);
    authoredByInitial.set(key, [...(authoredByInitial.get(key) ?? []), entry]);
  }

  const originalBytes = new Map<string, Buffer>(), originals = new Map<string, any>();
  for (const filename of Object.keys(receipt.downloads)) {
    const { bytes } = readAuthenticatedDownload(evidenceDir, filename, receipt.downloads);
    originalBytes.set(filename, bytes); originals.set(filename, JSON.parse(bytes.toString()));
  }
  const sessions = new Map<string, CurrentSession>(), histories = new Map<string, History>(), checks: any[] = [];
  function replayOriginal(file: CurrentSession, filename: string, retainTicks: boolean) {
    const decoded = decodeSessionFile(file);
    assert.deepEqual(decoded.file.game, file.game);
    assert.deepEqual(saveGame(decoded.state), file.game, `${filename} complete loaded native game`);
    assert.deepEqual(captureRuntime(decoded.state), file.game.runtime, `${filename} complete loaded native runtime`);
    assert(file.replay); assert.equal(file.game.version, SAVE_VERSION);
    assert.equal(file.replay.simulationRevision, SIMULATION_REVISION); assert.equal(file.replay.checksumVersion, SAVE_VERSION);
    const candidates = authoredByInitial.get(digest(JSON.stringify(file.replay.initial)));
    assert(candidates?.length, `${filename} starts at an authenticated declared fixture`);
    for (const candidate of candidates) assert.deepEqual(file.replay.initial, candidate.file.game);
    // Formation fixtures share original game bytes; shape lives in metadata and
    // the later native command. Initial native imports may match all four.
    const formation = commands(file.replay).find(record => record.command.type === 'formation');
    const matching = candidates.filter(candidate => candidate.name === `formation-${(formation?.command as any)?.formation}`);
    const initial = candidates.length === 1 ? candidates[0] : matching.length === 1 ? matching[0] : undefined;
    assert(!retainTicks || initial, `${filename} event history has a declared scenario`);
    const scenarioName = initial?.name ?? `equivalent-initial:${candidates.map(candidate => candidate.name).join(',')}`;
    const ids = [...new Set(Object.values((initial ?? candidates[0]).scenario.ids).flatMap((value: any) => Number.isSafeInteger(value) ? [value] : Array.isArray(value) ? value.filter(Number.isSafeInteger) : []))] as number[];
    const replay = new ReplayPlayer(file.replay);
    const history: History = { scenario: scenarioName, file: filename, initial: structuredClone(file.replay.initial), commands: commands(file.replay), ticks: [] };
    let before: Frame | undefined, observerFailure: unknown, observedSteps = 0, advanced = 0;
    // The hook fires before ReplayPlayer settles commands after an advance.
    // It only copies data. Observer errors are checked outside the hook because
    // history-hooks catches observer exceptions rather than propagating them.
    const unsubscribe = subscribeSimulation(replay.state, { step: dt => {
      try {
        observedSteps++;
        if (retainTicks) history.ticks.push({ before: before!, after: frame(replay.state, ids), dt, events: structuredClone(replay.state.events) });
      } catch (error) { observerFailure = error; }
    } });
    try {
      const initialTick = replay.state.tick;
      while (!replay.finished) {
        if (retainTicks) before = frame(replay.state, ids);
        assert.equal(replay.advance(1), 1, `${filename} ordinary replay advances one tick`); advanced++;
        if (observerFailure) throw observerFailure;
      }
      assert.equal(advanced, file.replay.finalTick - initialTick); assert.equal(observedSteps, advanced);
      assert.equal(replay.state.tick, file.game.state.tick);
      assert.equal(replayChecksum(replay.state), file.replay.finalChecksum);
      assert.deepEqual(saveGame(replay.state), file.game, `${filename} complete rederived game envelope`);
      assert.deepEqual(captureRuntime(replay.state), file.game.runtime, `${filename} complete rederived runtime`);
      checks.push({ file: filename, scenario: scenarioName, declaredInitialCandidates: candidates.map(candidate => candidate.name), initialTick, advanced, finalTick: replay.state.tick, checksum: file.replay.finalChecksum, completeNativeRoundTrip: true, completeUnprojectedReplay: true, completeRuntimeEquality: true, ordinaryObservedSteps: observedSteps });
    } finally { unsubscribe(); replay.dispose(); }
    if (retainTicks) histories.set(filename, history);
  }

  const eventEndpoints = new Set(['charge-pike-front-impact-save.json', 'charge-pike-rear-impact-save.json', 'siege-new-owner-impact-save.json', 'ambush-triggered-save.json', 'morale-supported-retreat-moved-save.json', ...['control', 'covered', 'other-level', 'beyond-victim', 'inside-near-victim'].map(kind => `ruin-${kind}-first-hit-save.json`)]);
  for (const [filename, original] of originals) if (filename.endsWith('-save.json')) {
    replayOriginal(original, filename, eventEndpoints.has(filename)); sessions.set(filename, original);
  }
  assert(sessions.size > 0);
  const standaloneReplays: any[] = [];
  for (const [filename, original] of originals) if (filename.endsWith('-replay.json')) {
    const archive = decodeReplay(original), savedName = filename.replace(/-replay\.json$/, '-save.json'), saved = sessions.get(savedName);
    assert(saved?.replay, `${filename} retained original save`);
    for (const key of replayFields) assert.deepEqual(archive[key], saved.replay[key], `${filename} playback ${key}`);
    replayOriginal({ ...saved, replay: archive as CurrentReplay }, filename, false);
    standaloneReplays.push({ file: filename, savedFile: savedName, completeOriginalReplayAndRuntime: true });
  }
  // The downloaded bug report also declares a complete replay, so rederive it.
  const report = originals.get('production-build-report.json');
  assert(report?.session && report.versions?.simulationRevision === SIMULATION_REVISION);
  const checkpoint = sessions.get('acceptance-final-checkpoint-save.json'); assert(checkpoint);
  assert.deepEqual(report.session.game, checkpoint.game);
  replayOriginal(report.session, 'production-build-report.json#session', false);

  const suppliedPairs: [string, string][] = [];
  if (selected.includes('canonical')) {
    const declared = receipt.groups.canonical.continuations; assert(Array.isArray(declared));
    for (const item of declared) {
      assert(typeof item.checkpoint === 'string' && typeof item.final === 'string' && item.checkpoint !== item.final);
      const partial = sessions.get(item.checkpoint), full = sessions.get(item.final); assert(partial && full);
      assert.equal(partial.game.state.tick, item.checkpointTick); assert.equal(full.game.state.tick, item.finalTick);
      suppliedPairs.push([item.checkpoint, item.final]);
    }
    for (const item of receipt.groups.canonical.exports) {
      assert.equal(item.file, `${item.name}-save.json`); const file = sessions.get(item.file); assert(file);
      assert.equal(file.game.state.tick, item.tick);
    }
  }
  // The current ruins receipt names these capture checkpoints through its
  // capture fields, rather than exposing a continuation array.
  if (selected.includes('ruins')) {
    const partial = sessions.get('ruin-capture-progress-save.json'), full = sessions.get('ruin-captured-save.json'); assert(partial && full);
    assert.equal(partial.game.state.tick, receipt.groups.ruins.capture.progressTick);
    assert.equal(full.game.state.tick, receipt.groups.ruins.capture.finalTick);
    suppliedPairs.push(['ruin-capture-progress-save.json', 'ruin-captured-save.json']);
  }
  assert.equal(new Set(suppliedPairs.map(pair => JSON.stringify(pair))).size, suppliedPairs.length);
  const continuations = suppliedPairs.map(([from, to]) => {
    const partial = sessions.get(from)!, full = sessions.get(to)!;
    assert(full.game.state.tick > partial.game.state.tick);
    const state = decodeSessionFile(partial).state, suffix = commandSuffix(partial, full);
    for (const action of suffix) {
      if (action.type === 'command') assert(issueCommand(state, action.side, action.command), `${from} continuation accepts ${action.command.type}`);
      else for (let tick = 0; tick < action.ticks; tick++) {
        const beforeTick = state.tick; stepGame(state, action.dt); assert.equal(state.tick, beforeTick + 1);
      }
    }
    assert.deepEqual(saveGame(state), full.game, `${from} command-suffix continuation complete game at ${to}`);
    assert.deepEqual(captureRuntime(state), full.game.runtime, `${from} command-suffix continuation complete runtime at ${to}`);
    return { from, to, checkpointTick: partial.game.state.tick, finalTick: full.game.state.tick, suffix, completeNativeContinuation: true, completeRuntimeEquality: true };
  });

  function history(name: string, scenario: string) {
    const found = histories.get(`${name}-save.json`); assert(found, `Retained ordinary tick history ${name}`); assert.equal(found.scenario, scenario); return found;
  }
  const observations: any = {};
  if (selected.includes('canonical')) {
    observations.formations = ['line', 'wedge', 'square', 'loose'].map(kind => {
      const name = `formation-${kind}`, initial = authoredByName.get(name); assert(initial);
      const file = sessions.get(`${name}-settled-save.json`); assert(file?.replay);
      const accepted = commands(file.replay).find(record => record.side === 0 && record.command.type === 'formation' && record.command.formation === kind); assert(accepted);
      const troops = initial.scenario.ids.army.map((id: number) => file.game.state.entities.find(item => item.id === id));
      assert(troops.every((troop: Entity | undefined) => troop?.tactics?.formation?.kind === kind));
      return { scenario: name, nativeCommand: accepted, finalTick: file.game.state.tick, troops };
    });
    const charge = ['front', 'rear'].map(direction => {
      const name = `charge-pike-${direction}`, h = history(`${name}-impact`, name), ids = authoredByName.get(h.scenario)!.scenario.ids;
      const first = positiveHits(h, ids.source, ids.target)[0]; assert(first);
      const input = nativeCommand(h, 'attack', command => command.ids.includes(ids.source) && command.target === ids.target);
      assert(input.tick < first.tick); assert((actor(first.before, ids.source).tactics?.charge?.distance ?? 0) > 0);
      const initialRider = h.initial.state.entities.find(item => item.id === ids.source)!;
      assert((actor(first.before, ids.source).tactics?.charge?.distance ?? 0) > (initialRider.tactics?.charge?.distance ?? 0));
      const returns = positiveHits(h, ids.target, ids.source).filter(hit => hit.tick === first.tick);
      const stopped = h.ticks.flatMap(tick => tick.events.filter(event => event.text === 'Charge stopped by braced pikes').map(event => ({ tick: tick.after.tick, event })));
      return { scenario: name, nativeCommand: input, firstHit: first, returnHits: returns, stoppedMessages: stopped, chargeBefore: actor(first.before, ids.source).tactics?.charge, chargeAfter: actor(first.after, ids.source).tactics?.charge };
    });
    assert(charge[0].returnHits.length > 0 && charge[0].stoppedMessages.some(item => item.tick === charge[0].firstHit.tick));
    assert(charge[1].firstHit.event.amount! > charge[0].firstHit.event.amount!);
    observations.charges = charge;

    const siege = history('siege-new-owner-impact', 'siege-full-crew-capture'), siegeIds = authoredByName.get(siege.scenario)!.scenario.ids;
    const initialEngine = siege.initial.state.entities.find(item => item.id === siegeIds.engine)!;
    assert(initialEngine.tactics?.siegeCrew && initialEngine.tactics.siegeCrew.hp === initialEngine.tactics.siegeCrew.maxHp && !initialEngine.tactics.siegeCrew.uncrewed);
    assert.equal(initialEngine.hp, initialEngine.maxHp);
    const input = nativeCommand(siege, 'attack', command => command.ids.includes(siegeIds.captor) && command.target === siegeIds.engine);
    const crewTicks = siege.ticks.filter(tick => (actor(tick.before, siegeIds.engine).tactics?.siegeCrew?.hp ?? 0) > (actor(tick.after, siegeIds.engine).tactics?.siegeCrew?.hp ?? 0));
    assert(crewTicks.length > 0 && input.tick < crewTicks[0].after.tick);
    const crewDamage = crewTicks.map(tick => {
      const hits = tick.events.filter(event => event.type === 'attack' && event.source === siegeIds.captor && event.target === siegeIds.engine && (event.amount ?? 0) > 0);
      assert(hits.length > 0, 'Actual ordinary attack event accompanies crew damage');
      const loss = actor(tick.before, siegeIds.engine).tactics!.siegeCrew!.hp - actor(tick.after, siegeIds.engine).tactics!.siegeCrew!.hp;
      assert(Math.abs(hits.reduce((sum, event) => sum + event.amount!, 0) - loss) < 1e-6);
      assert.equal(actor(tick.after, siegeIds.engine).hp, initialEngine.hp);
      return { tick: tick.after.tick, before: actor(tick.before, siegeIds.engine), after: actor(tick.after, siegeIds.engine), hits, actualCrewLoss: loss };
    });
    const defeated = siege.ticks.find(tick => tick.events.some(event => event.text === 'Siege crew defeated: engine uncrewed')); assert(defeated);
    const captured = siege.ticks.find(tick => tick.events.some(event => event.text === 'Siege crew replaced: engine captured')); assert(captured);
    assert(captured.after.tick > defeated.after.tick); assert.equal(actor(captured.after, siegeIds.engine).side, 0);
    const captureInput = nativeCommand(siege, 'captureSiege', command => command.ids.includes(siegeIds.captor) && command.target === siegeIds.engine);
    assert(captureInput.tick >= defeated.after.tick && captureInput.tick < captured.after.tick);
    assert.equal(actor(captured.after, siegeIds.engine).tactics?.siegeCrew?.hp, initialEngine.tactics.siegeCrew.maxHp);
    const ownerHit = positiveHits(siege, siegeIds.engine, siegeIds.target).find(hit => hit.event.side === 0); assert(ownerHit && ownerHit.tick > captured.after.tick);
    const ownerInput = nativeCommand(siege, 'attack', command => command.ids.includes(siegeIds.engine) && command.target === siegeIds.target);
    const siegeLaunches = siege.ticks.flatMap(tick => tick.events.filter(event => event.type === 'ability' && event.source === siegeIds.engine && event.side === 0).map(event => ({ tick: tick.after.tick, event })));
    assert(siegeLaunches.some(item => item.tick >= captured.after.tick && item.tick < ownerHit.tick));
    assert(siegeLaunches.some(item => ownerInput.tick < item.tick && item.tick < ownerHit.tick));
    observations.siege = { nativeAttack: input, nativeCapture: captureInput, nativeNewOwnerAttack: ownerInput, initialEngine, crewDamage, defeatedTick: defeated.after.tick, captureTick: captured.after.tick, newOwnerAbilities: siegeLaunches, newOwnerHit: ownerHit };

    const ambush = history('ambush-triggered', 'ambush-selected-trigger'), ambushIds = authoredByName.get(ambush.scenario)!.scenario.ids;
    const ambushInput = nativeCommand(ambush, 'ambush', command => command.ids.includes(ambushIds.ambusher));
    const concealed = sessions.get('ambush-concealed-save.json'); assert(concealed);
    const hostileBaseline = [ambushIds.wrongTarget, ambushIds.trigger].map(id => ambush.initial.state.entities.find(item => item.id === id)!);
    assert(hostileBaseline.every(troop => troop.hp === troop.maxHp));
    assert(hostileBaseline.every(troop => concealed.game.state.entities.find(item => item.id === troop.id)?.hp === troop.hp));
    const firstAmbushHit = positiveHits(ambush, ambushIds.ambusher)[0]; assert(firstAmbushHit && ambushInput.tick < firstAmbushHit.tick);
    assert.equal(firstAmbushHit.event.target, ambushIds.trigger);
    assert.equal(actor(firstAmbushHit.after, ambushIds.trigger).role, (ambushInput.command as any).target);
    const withheld = ambush.ticks.filter(tick => {
      const source = actor(tick.before, ambushIds.ambusher), wrong = actor(tick.before, ambushIds.wrongTarget);
      return source.tactics?.ambush?.concealed && source.cooldown === 0 && distance(source, wrong) <= source.tactics.ambush.radius && wrong.role !== source.tactics.ambush.target;
    });
    assert(withheld.length > 0);
    assert(withheld.every(tick => !tick.events.some(event => event.type === 'attack' && event.source === ambushIds.ambusher && (event.amount ?? 0) > 0 && event.target === ambushIds.wrongTarget)));
    const triggered = ambush.ticks.find(tick => tick.events.some(event => event.source === ambushIds.ambusher && event.text === 'Ambush triggered')); assert(triggered && triggered.after.tick <= firstAmbushHit.tick);
    assert(distance(actor(triggered.after, ambushIds.ambusher), actor(triggered.after, ambushIds.trigger)) <= (ambushInput.command as any).radius);
    assert.equal(actor(firstAmbushHit.after, ambushIds.wrongTarget).hp, hostileBaseline[0].hp);
    observations.ambush = { nativeCommand: ambushInput, fullHealthHostileBaseline: hostileBaseline, readyConcealedWrongRoleTicks: withheld.map(tick => tick.before.tick), triggeredTick: triggered.after.tick, firstSelectedRoleHit: firstAmbushHit };

    const morale = history('morale-supported-retreat-moved', 'morale-supported-full-fight'), moraleIds = authoredByName.get(morale.scenario)!.scenario.ids;
    const initialSquad = moraleIds.squad.map((id: number) => morale.initial.state.entities.find(item => item.id === id)!);
    assert(initialSquad.every((troop: Entity) => troop.hp === troop.maxHp && troop.tactics?.morale === 100 && troop.tactics.recentLoss === 0));
    const attackInput = nativeCommand(morale, 'attack', command => moraleIds.siege.every((id: number) => command.ids.includes(id)) && command.target === moraleIds.primary);
    const beforeVolley = sessions.get('morale-native-attack-before-volley-save.json'); assert(beforeVolley?.replay);
    assert((beforeVolley.game.state.projectiles ?? []).length === 0);
    assert(moraleIds.squad.every((id: number) => {
      const troop = beforeVolley.game.state.entities.find(item => item.id === id);
      return troop && troop.hp === troop.maxHp && troop.tactics?.morale === 100 && troop.tactics.recentLoss === 0;
    }));
    assert(commands(beforeVolley.replay).some(record => record.actionIndex === attackInput.actionIndex && record.tick === attackInput.tick && record.side === attackInput.side && JSON.stringify(record.command) === JSON.stringify(attackInput.command)));
    const launches = morale.ticks.flatMap(tick => tick.events.filter(event => event.type === 'ability' && moraleIds.siege.includes(event.source) && /launched/i.test(event.text ?? '')).map(event => ({ tick: tick.after.tick, event })));
    const hits = positiveHits(morale).filter(hit => moraleIds.siege.includes(hit.event.source) && moraleIds.squad.includes(hit.event.target));
    assert(launches.length > 0 && hits.length > 0); assert(attackInput.tick < launches[0].tick && launches[0].tick < hits[0].tick);
    const deaths = morale.ticks.flatMap(tick => tick.events.filter(event => event.type === 'death' && moraleIds.squad.includes(event.source)).map(event => ({ tick: tick.after.tick, event, before: actor(tick.before, event.source!), after: actor(tick.after, event.source!) })));
    assert(deaths.length > 0 && deaths.every(death => death.before.hp > 0 && death.after.hp === 0 && hits.some(hit => hit.tick === death.tick && hit.event.target === death.event.source)));
    const retreats = morale.ticks.flatMap(tick => tick.events.filter(event => event.text === 'Low morale: retreating to support' && moraleIds.squad.includes(event.source)).map(event => ({ tick: tick.after.tick, event, before: actor(tick.before, event.source!), after: actor(tick.after, event.source!), frame: tick.after })));
    assert(retreats.length > 0);
    assert(retreats.some(retreat => retreat.after.hp > 0 && retreat.after.hp < retreat.after.maxHp && deaths.some(death => death.tick <= retreat.tick) && hits.some(hit => hit.event.target === retreat.after.id && hit.tick <= retreat.tick)));
    const casualtyEffects = morale.ticks.filter(tick => deaths.some(death => death.tick === tick.after.tick)).map(tick => ({ tick: tick.after.tick, survivors: moraleIds.squad.flatMap((id: number) => {
      const previous = tick.before.actors.find(item => item.id === id), current = tick.after.actors.find(item => item.id === id);
      return previous && current && current.hp > 0 ? [{ id, hpBefore: previous.hp, hpAfter: current.hp, moraleBefore: previous.tactics?.morale, moraleAfter: current.tactics?.morale, recentLossBefore: previous.tactics?.recentLoss, recentLossAfter: current.tactics?.recentLoss }] : [];
    }) }));
    observations.morale = { originalClause: 'isolated or badly damaged squads can retreat or surrender.', witnessedBranch: 'badly damaged squads retreat', initialSquad, nativeAttack: attackInput, beforeVolleyTick: beforeVolley.game.state.tick, ordinaryLaunches: launches, ordinaryHits: hits, combatDeaths: deaths, casualtyEffects, automaticRetreats: retreats.map(retreat => ({ ...retreat, closeLivingAllies: retreat.frame.actors.filter(other => other.id !== retreat.after.id && other.hp > 0 && morale.initial.state.teams[other.side] === morale.initial.state.teams[retreat.after.side] && distance(other, retreat.after) < 4.5).map(other => other.id), visibleHostiles: retreat.frame.visibleHostiles[retreat.after.id] })) };
  }
  if (selected.includes('ruins')) {
    const cover = ['control', 'covered', 'other-level', 'beyond-victim', 'inside-near-victim'].map(kind => {
      const name = `ruin-${kind}`, h = history(`${name}-first-hit`, name), ids = authoredByName.get(h.scenario)!.scenario.ids;
      const first = positiveHits(h, ids.source, ids.target)[0]; assert(first);
      const input = nativeCommand(h, 'attack', command => command.ids.includes(ids.source) && command.target === ids.target); assert(input.tick < first.tick);
      return { scenario: name, nativeAttack: input, firstOrdinaryHit: first, initialSites: h.initial.state.world?.sites, firstTickTargetLoss: actor(first.before, ids.target).hp - actor(first.after, ids.target).hp };
    });
    assert(cover[1].firstOrdinaryHit.event.amount! < cover[0].firstOrdinaryHit.event.amount!);
    observations.ruins = { originalClause: 'rocks, ruins and buildings reduce incoming ranged damage.', witnessedMaterial: 'ruins', observations: cover, remainingMaterials: 'Root assesses retained rock/building evidence separately.' };
  }
  const result = {
    schema: 1, sourceCommit, saveVersion: SAVE_VERSION, simulationRevision: SIMULATION_REVISION,
    completedReceiptSha256: digest(readFileSync(resolve(evidenceDir, 'browser-main-smoke402.json'))),
    originalDownloads: [...originalBytes].map(([file, bytes]) => ({ file, bytes: bytes.length, sha256: digest(bytes) })),
    scope: 'Focused canonical/ruins retained histories for original IDs1/4/6/8/9/10. Data verification is not root feature admission or visual acceptance.',
    checks, standaloneReplays, continuations, observations,
    ordinaryTickHistories: [...histories.values()], completeOriginalSaveAndRuntimeVerification: true,
  };
  writeFileSync(resolve(evidenceDir, 'main-smoke402-history-checks.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  return result;
}
