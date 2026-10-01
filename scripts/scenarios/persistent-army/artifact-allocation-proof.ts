import { deployScenarioArmy, type CampaignSoldier } from '../../../src/core/campaign';
import { ScenarioRecorder, scenarioStateEquals, verifyScenarioRecording, type ScenarioRecording } from '../../../src/core/scenario-recordings';
import { captureScenario, createScenario, issueScenarioCommand, restoreScenario, scenarioSessionForState, stepScenario } from '../../../src/core/scenarios';
import { loadGame, saveGame } from '../../../src/core/saves';
import { ARTIFACTS, progressionStats } from '../../../src/core/unit-progression';
import type { ScenarioDefinition, ScenarioSession } from '../../../src/core/scenario-types';
import type { Entity } from '../../../src/core/types';

type Archive = (name: string, value: unknown) => void;
const assert = (test: unknown, message: string): void => { if (!test) throw new Error(`Artifact allocator proof: ${message}`); };

function destination(): ScenarioDefinition {
  const width = 36, height = 36;
  return {
    schemaVersion: 1, id: 'persistent-army-artifact-allocator', title: 'Artifact allocation inspection',
    briefing: 'Defeat the wounded enemy commander, then inspect a campaign survivor deployed beside the native artifact.',
    successText: 'The inspection window is complete.', failureText: 'The commander was lost during inspection.',
    faction: 'dwarves', opponent: 'orcs', seed: 76101,
    map: { size: 'small', width, height,
      terrain: Array.from({ length: width * height }, (_, i) => i < width || i >= width * (height - 1) || i % width === 0 || i % width === width - 1 ? 'rock' : 'grass'),
      starts: [{ x: 4, y: 6 }, { x: 11, y: 6 }], resources: [] },
    army: [
      { label: 'commander', side: 0, kind: 'unit', role: 'special', definitionId: 'core:dwarves-commander', x: 4, y: 6, order: { type: 'hold' } },
      { label: 'gun-a', side: 0, kind: 'unit', role: 'ranged', x: 5, y: 5, order: { type: 'hold' } },
      { label: 'gun-b', side: 0, kind: 'unit', role: 'ranged', x: 5, y: 7, order: { type: 'hold' } },
      { label: 'native-hero', side: 1, kind: 'unit', role: 'special', definitionId: 'core:orcs-commander', x: 9, y: 6, hp: 35, order: { type: 'hold' } },
    ],
    objectives: [{ id: 'inspection', text: 'Keep the inspection window open for 120 seconds.', success: { type: 'time', seconds: 120 }, failure: { type: 'dead', actor: 'commander' } }],
    events: [], rules: { fixedArmy: true, reinforcementBudget: 0, resources: { wood: 0, ore: 0, crystal: 0 }, timeLimit: 150 },
  };
}

/** This custom destination proves allocation independently of canonical campaign missions. */
export function proveArtifactAllocation(army: CampaignSoldier[], archive: Archive) {
  const rawArmy = JSON.stringify(army), artifacts = new Map<string, unknown>();
  let session: ScenarioSession | undefined, nativeRecorder: ScenarioRecorder | undefined, deployedRecorder: ScenarioRecorder | undefined;
  let nativeRecording: ScenarioRecording | undefined, deploymentRecording: ScenarioRecording | undefined;
  try {
    const survivor = army.find(soldier => soldier.label === 'commander');
    assert(survivor, 'the caller did not provide a surviving campaign commander');
    const source = survivor!;
    assert(source.entity.definitionId === 'core:dwarves-commander' && source.entity.side === 0, 'the survivor must be the genuine dwarven campaign commander');
    const carried = source.artifacts?.find(item => item.id === source.entity.equipment?.armor);
    assert(source.artifacts?.length === 1 && carried?.id === 1 && carried.definitionId === 'core:iron-aegis' && carried.owner === 0 && carried.holder === source.entity.id && !carried.position, 'the source Iron Aegis must be the equipped campaign artifact 1');
    const firstEntityId = Math.max(...army.map(soldier => soldier.entity.id)) + 100;
    session = createScenario(destination(), { firstEntityId });
    const nativeSession = session, placeholderId = session.runtime.labels.commander, nativeHeroId = session.runtime.labels['native-hero'];
    assert(!army.some(soldier => nativeSession.state.entities.some(entity => entity.id === soldier.entity.id)), 'destination actor IDs overlap archived soldiers');
    artifacts.set('artifact-allocation-initial-checkpoint', captureScenario(session));
    nativeRecorder = new ScenarioRecorder(session);
    const attackIds = ['gun-a', 'gun-b'].map(label => session!.runtime.labels[label]);
    assert(issueScenarioCommand(session, 0, { type: 'attack', ids: attackIds, target: nativeHeroId }), 'the native hero attack was rejected');
    while (session.state.entities.some(entity => entity.id === nativeHeroId && entity.hp > 0) && session.state.tick < 400) stepScenario(session);
    assert(!session.state.entities.some(entity => entity.id === nativeHeroId && entity.hp > 0), 'ordinary combat did not kill the native hero');
    assert(session.runtime.outcome === 'playing', 'the destination finished before deployment');
    const nativeItem = session.state.specialists?.artifacts[0];
    assert(nativeItem?.id === 1 && nativeItem.position && nativeItem.owner === undefined && nativeItem.holder === undefined && session.state.specialists?.artifacts.length === 1 && session.state.specialists.nextArtifactId === 2, 'the native hero did not create local artifact 1');
    const nativeItemBefore = JSON.stringify(nativeItem), nativeDropTick = session.state.tick;
    nativeRecording = nativeRecorder.archive(); nativeRecorder.destroy(); nativeRecorder = undefined;
    artifacts.set('artifact-allocation-native-drop-recording', nativeRecording);
    artifacts.set('artifact-allocation-before-deployment-checkpoint', captureScenario(session));
    assert(scenarioStateEquals(verifyScenarioRecording(nativeRecording), session), 'the native artifact journal does not replay');

    const deployed = deployScenarioArmy(session, [source]);
    artifacts.set('artifact-allocation-after-deployment-checkpoint', captureScenario(session));
    deployedRecorder = new ScenarioRecorder(session);
    assert(deployed.length === 1 && deployed[0] === source.entity.id && session.runtime.labels.commander === source.entity.id, 'deployment did not replace the destination commander');
    assert(!session.state.entities.some(entity => entity.id === placeholderId), 'the destination commander placeholder remains');
    const commander = session.state.entities.find(entity => entity.id === source.entity.id)!;
    const allocated = session.state.specialists!.artifacts.find(item => item.holder === commander.id)!;
    const localUnchanged = (current: ScenarioSession) => JSON.stringify(current.state.specialists?.artifacts.find(item => item.id === 1)) === nativeItemBefore;
    const inspect = (current: ScenarioSession) => {
      const entity = current.state.entities.find(entity => entity.id === source.entity.id)!;
      assert(entity?.hp > 0 && entity.equipment?.armor === 2, 'the carried armor was not remapped to artifact 2');
      const item = current.state.specialists?.artifacts.find(item => item.id === entity.equipment?.armor);
      assert(item?.definitionId === 'core:iron-aegis' && item.owner === 0 && item.holder === entity.id && !item.position, 'the remapped armor ownership changed');
      assert(localUnchanged(current), 'deployment or continuation changed the native artifact');
      assert(current.state.specialists?.artifacts.length === 2 && current.state.specialists.nextArtifactId === 3, 'the destination artifact allocator did not advance to 3');
      const withoutArmor = { ...entity, equipment: {} } as Entity;
      const armorEffect = progressionStats(current.state, entity).armor - progressionStats(current.state, withoutArmor).armor;
      assert(armorEffect === ARTIFACTS['core:iron-aegis'].armor, 'the remapped Iron Aegis armor effect is absent');
      assert(JSON.stringify(army) === rawArmy, 'deployment changed the archived source army');
      return armorEffect;
    };
    assert(allocated.id === 2 && commander.equipment?.armor === allocated.id, 'the carried source artifact reused destination artifact 1');
    const armorEffect = inspect(session);
    assert(issueScenarioCommand(session, 0, { type: 'move', ids: [commander.id], x: 6, y: 9 }), 'the deployed commander move was rejected');
    for (let i = 0; i < 40; i++) stepScenario(session);
    inspect(session);
    const checkpoint = captureScenario(session), saved = saveGame(session.state), savedAtTick = session.state.tick;
    deploymentRecording = deployedRecorder.archive(); deployedRecorder.destroy(); deployedRecorder = undefined;
    artifacts.set('artifact-allocation-postdeployment-recording', deploymentRecording);
    artifacts.set('artifact-allocation-saved-checkpoint', checkpoint);
    artifacts.set('artifact-allocation-generic-save', saved);
    const checkpointRestored = restoreScenario(JSON.stringify(checkpoint)); inspect(checkpointRestored);
    assert(scenarioStateEquals(checkpointRestored, session), 'the scenario checkpoint roundtrip changed deployment');
    const saveRestored = scenarioSessionForState(loadGame(JSON.stringify(saved)));
    assert(saveRestored && scenarioStateEquals(saveRestored, session), 'the generic save roundtrip changed deployment');
    inspect(saveRestored!);
    assert(scenarioStateEquals(verifyScenarioRecording(deploymentRecording), session), 'the postdeployment recording does not replay');

    session = saveRestored!; deployedRecorder = new ScenarioRecorder(session, deploymentRecording);
    assert(issueScenarioCommand(session, 0, { type: 'hold', ids: [commander.id] }), 'the restored commander hold was rejected');
    for (let i = 0; i < 20; i++) stepScenario(session);
    inspect(session);
    const continued = deployedRecorder.archive(); artifacts.set('artifact-allocation-continuation-recording', continued);
    assert(continued.commands.length === deploymentRecording.commands.length + 1, 'the restored recording did not retain and append commands');
    assert(JSON.stringify(continued.initial) === JSON.stringify(deploymentRecording.initial) && JSON.stringify(continued.commands.slice(0, deploymentRecording.commands.length)) === JSON.stringify(deploymentRecording.commands), 'continuation changed the saved recording initial state or command prefix');
    const replayed = verifyScenarioRecording(continued); inspect(replayed);
    assert(scenarioStateEquals(replayed, session), 'the continued recording does not replay');
    return { scenarioId: session.definition.id, sourceCommanderId: source.entity.id, placeholderId, nativeHeroId, nativeDropTick,
      nativeArtifact: JSON.parse(nativeItemBefore), sourceArtifactId: carried!.id, allocatedArtifactId: allocated.id,
      nextArtifactId: session.state.specialists!.nextArtifactId, armorEffect, savedAtTick, finalTick: session.state.tick,
      nativeCommandCount: nativeRecording.commands.length, continuedCommandCount: continued.commands.length,
      sourceArmyUnchanged: JSON.stringify(army) === rawArmy, checkpointRoundtrip: true, genericSaveRoundtrip: true, recordingContinuation: true };
  } finally {
    const preserveRecorder = (name: string, recorder: ScenarioRecorder | undefined) => {
      if (!recorder) return;
      try { artifacts.set(name, recorder.archive()); }
      catch (error) { artifacts.set(`${name}-error`, { error: String(error) }); }
      finally { recorder.destroy(); }
    };
    preserveRecorder('artifact-allocation-native-drop-recording', nativeRecorder);
    preserveRecorder(artifacts.has('artifact-allocation-postdeployment-recording') ? 'artifact-allocation-live-recording' : 'artifact-allocation-postdeployment-recording', deployedRecorder);
    if (session) {
      try { artifacts.set('artifact-allocation-final-checkpoint', captureScenario(session)); }
      catch (error) { artifacts.set('artifact-allocation-final-checkpoint-error', { error: String(error) }); }
    }
    for (const [name, value] of artifacts) archive(name, value);
  }
}
