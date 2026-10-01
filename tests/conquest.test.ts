import { describe, expect, it } from 'vitest';
import { checkpointConquestBattle, completeConquestBattle, createConquestProfile, decodeConquestProfile, prepareConquestBattle, proposeConquest, reachableConquestRegions, waitConquestTurn } from '../src/core/conquest';
import { captureScenario, issueScenarioCommand, stepScenario } from '../src/core/scenarios';
import { isHostile } from '../src/core/simulation';
import { solveConquest } from '../scripts/scenarios/conquest-strategy';
import { FACTIONS } from '../src/core/content';
import { decodeScenarioRecording } from '../src/core/scenario-recordings';

describe('connected conquest and negotiated diplomacy', () => {
  it('rejects malformed profile identities and non-null active placeholders', () => {
    const profile = createConquestProfile('orcs', 'typed-profile');
    for (const active of [false, 0, '']) expect(() => decodeConquestProfile({ ...profile, active })).toThrow('active conquest');
    expect(() => decodeConquestProfile({ ...profile, id: 123 })).toThrow('profile ID');
  });
  it('rejects decisions before they exceed the reloadable history bound', () => {
    let profile = createConquestProfile('orcs', 'history-bound');
    for (let i = 0; i < 256; i++) profile = waitConquestTurn(profile);
    expect(decodeConquestProfile(JSON.stringify(profile)).turn).toBe(256);
    expect(() => waitConquestTurn(profile)).toThrow('history is full');
    expect(() => proposeConquest(profile, { type: 'tribute', faction: 'fairies', amount: 25 })).toThrow('history is full');
    expect(() => prepareConquestBattle(profile, 'quarry')).toThrow('history is full');
  });
  it('rejects aggregate journal growth before returning a profile that cannot reload', () => {
    let profile = createConquestProfile('undead', 'profile-storage-bound');
    profile = proposeConquest(profile, { type: 'tribute', faction: 'fairies', amount: 250 });
    profile = proposeConquest(profile, { type: 'alliance', faction: 'fairies' });
    for (let battle = 0; battle < 4; battle++) {
      const run = prepareConquestBattle(profile, 'grove', 'passage');
      const previous = JSON.stringify(run.profile), commander = run.session.runtime.labels.commander;
      const ids = run.session.state.entities.filter(e => e.side === 0 && e.kind === 'unit' && e.hp > 0).map(e => e.id);
      for (let command = 0; command < 30000; command++) expect(issueScenarioCommand(run.session, 0, { type: 'hold', ids })).toBe(true);
      expect(issueScenarioCommand(run.session, 0, { type: 'move', ids: [commander], x: 29, y: 16 })).toBe(true);
      for (let tick = 0; tick < 1000 && run.session.runtime.outcome === 'playing'; tick++) stepScenario(run.session);
      expect(run.session.runtime.outcome).toBe('won');
      const journal = run.recorder.archive();
      expect(decodeScenarioRecording(journal).commands).toHaveLength(30001);
      if (battle < 3) {
        profile = checkpointConquestBattle(run.profile, run.session, run.recorder);
        expect(decodeConquestProfile(JSON.stringify(profile)).active!.recording.commands).toHaveLength(30001);
        profile = completeConquestBattle(profile, run.session, journal);
        expect(decodeConquestProfile(JSON.stringify(profile)).history).toHaveLength(battle + 3);
      } else {
        expect(() => checkpointConquestBattle(run.profile, run.session, run.recorder)).toThrow('package is too large');
        expect(() => completeConquestBattle(run.profile, run.session, journal)).toThrow('package is too large');
        expect(JSON.stringify(run.profile)).toBe(previous);
        expect(decodeConquestProfile(previous).active!.recording.commands).toHaveLength(0);
      }
      run.recorder.destroy();
    }
  }, 60000);

  it('captures connected regions through ordinary combat and reloads real surviving armies', () => {
    let profile = createConquestProfile('dwarves', 'conquest-proof');
    expect(reachableConquestRegions(profile)).toEqual(['grove', 'quarry']);
    expect(() => prepareConquestBattle(profile, 'keep')).toThrow('unreachable');
    let previous: ReturnType<typeof captureScenario> | null = null;
    for (const id of ['quarry', 'crossroads']) {
      const run = prepareConquestBattle(profile, id); profile = run.profile;
      if (previous) expect(run.session.definition.map!.terrain).not.toEqual(previous.definition.map!.terrain);
      const oldIds = profile.army.map(s => s.entity.id); expect(profile.active!.deployedIds.some(id => oldIds.includes(id))).toBe(true);
      solveConquest(run.session); expect(run.session.runtime.outcome).toBe('won');
      const recording = run.recorder.archive(); run.recorder.destroy(); previous = captureScenario(run.session);
      profile = completeConquestBattle(profile, run.session, recording);
      expect(completeConquestBattle(profile, run.session, recording)).toBe(profile);
      expect(profile.regions[id].owner).toBe('dwarves'); profile = decodeConquestProfile(JSON.stringify(profile));
    }
    expect(profile.turn).toBe(2); expect(reachableConquestRegions(profile)).toContain('keep');
    const altered = structuredClone(profile); altered.regions.keep.owner = 'dwarves'; expect(() => decodeConquestProfile(altered)).toThrow('disagree');
  }, 30000);

  it('transfers tribute atomically, rejects weak proposals and applies passage, expiry and alliance aid', () => {
    let profile = createConquestProfile('orcs', 'diplomacy-proof');
    const before = structuredClone(profile);
    expect(() => proposeConquest(profile, { type: 'alliance', faction: 'fairies' })).toThrow('rejects');
    expect(() => proposeConquest(profile, { type: 'tribute', faction: 'fairies', amount: 301 })).toThrow('available ore'); expect(profile).toEqual(before);
    profile = proposeConquest(profile, { type: 'tribute', faction: 'fairies', amount: 100 });
    expect(profile.treasury.ore).toBe(250); expect(profile.relations.fairies.treasury.ore).toBe(200);
    profile = proposeConquest(profile, { type: 'truce', faction: 'fairies', turns: 1 });
    expect(reachableConquestRegions(profile)).toContain('crossroads'); expect(() => prepareConquestBattle(profile, 'grove')).toThrow('agreement');
    const passage = prepareConquestBattle(profile, 'grove', 'passage');
    expect(isHostile(passage.session.state, 0, 1)).toBe(false);
    const commander = passage.session.state.entities.find(e => e.id === passage.session.runtime.labels.commander)!;
    const guard = passage.session.state.entities.find(e => e.side === 1)!;
    expect(issueScenarioCommand(passage.session, 0, { type: 'attack', ids: [commander.id], target: guard.id })).toBe(false);
    issueScenarioCommand(passage.session, 0, { type: 'move', ids: [commander.id], x: 22, y: 16 });
    const hp = commander.hp; for (let tick = 0; tick < 280; tick++) stepScenario(passage.session);
    expect(commander.x).toBeGreaterThan(20); expect(commander.hp).toBe(hp); expect(isHostile(passage.session.state, 0, 1)).toBe(false);
    const checkpoint = checkpointConquestBattle(passage.profile, passage.session, passage.recorder);
    const resumed = prepareConquestBattle(decodeConquestProfile(checkpoint), 'grove', 'passage'); expect(captureScenario(resumed.session)).toEqual(captureScenario(passage.session)); resumed.recorder.destroy();
    for (let tick = 0; tick < 40; tick++) stepScenario(passage.session); expect(isHostile(passage.session.state, 0, 1)).toBe(true);
    for (let tick = 0; tick < 60; tick++) stepScenario(passage.session); expect(commander.hp).toBeLessThan(hp); passage.recorder.destroy();
    solveConquest(passage.session); expect(passage.session.runtime.outcome).toBe('lost');
    profile = waitConquestTurn(profile); expect(profile.relations.fairies.truceUntil).toBe(profile.turn);
    profile = proposeConquest(profile, { type: 'tribute', faction: 'fairies', amount: 150 }); profile = proposeConquest(profile, { type: 'alliance', faction: 'fairies' });
    const aided = prepareConquestBattle(profile, 'quarry');
    expect(aided.session.runtime.labels['aid-fairies']).toBeGreaterThan(0);
    expect(aided.session.state.entities.some(e => e.id === aided.session.runtime.labels['aid-fairies'] && e.side === 0 && e.kind === 'unit')).toBe(true);
    expect(aided.session.state.players[0].ore).toBe(profile.treasury.ore);
    expect(profile.army.some(s => s.entity.id === aided.session.runtime.labels['aid-fairies'])).toBe(false);
    solveConquest(aided.session); expect(aided.session.runtime.outcome).toBe('won');
    const journal = aided.recorder.archive(); aided.recorder.destroy();
    profile = completeConquestBattle(aided.profile, aided.session, journal);
    expect(profile.relations.fairies.treasury.ore).toBe(350 - FACTIONS.orcs.units.ranged.cost.ore);
    expect(profile.relations.fairies.treasury.wood).toBe(150 - FACTIONS.orcs.units.ranged.cost.wood);
    expect(profile.army.some(s => s.label === 'aid-fairies')).toBe(true);
    expect(decodeConquestProfile(JSON.stringify(profile)).relations.fairies.alliance).toBe(true);
  }, 30000);
});
