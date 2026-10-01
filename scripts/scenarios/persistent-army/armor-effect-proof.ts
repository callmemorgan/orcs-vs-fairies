import { ARTIFACTS, progressionStats } from '../../../src/core/unit-progression';
import { captureScenario, issueScenarioCommand, restoreScenario, stepScenario } from '../../../src/core/scenarios';
import { ScenarioRecorder, scenarioStateEquals, verifyScenarioRecording, type ScenarioRecording } from '../../../src/core/scenario-recordings';
import type { ScenarioCheckpoint, ScenarioSession } from '../../../src/core/scenario-types';
import type { Command, Entity } from '../../../src/core/types';

interface ArmorHit { tick: number; source: number; target: number; damage: number }
interface ArmorArm {
  equipped: boolean;
  hits: ArmorHit[];
  stats: ReturnType<typeof progressionStats>;
  finalHp: number;
  commands: Array<{ tick: number; command: Command; accepted: boolean }>;
}
export interface ArmorEffectReport {
  artifact: string;
  armor: number;
  hits: Array<{ tick: number; source: number; target: number; equipped: number; unequipped: number }>;
  arms: ArmorArm[];
}

const assert = (test: unknown, message: string): void => { if (!test) throw new Error(message); };
const rankAndPromotions = (entity: Entity) => JSON.stringify({ rank: entity.veteran?.rank ?? 0, promotions: entity.veteran?.promotions ?? [] });

/** Compare real tower hits after changing only the earned Iron Aegis through accepted input. */
export function proveArmorEffect(checkpoint: ScenarioCheckpoint, prior: ScenarioRecording, archive: (name: string, value: unknown) => void): ArmorEffectReport {
  const arms: ArmorArm[] = [], failures: string[] = [], armor = ARTIFACTS['core:iron-aegis'].armor!;
  for (const equipped of [true, false]) {
    const name = `armor-${equipped ? 'equipped' : 'unequipped'}`;
    let session: ScenarioSession | undefined, recorder: ScenarioRecorder | undefined;
    let journal = prior;
    const commands: ArmorArm['commands'] = [];
    try {
      session = restoreScenario(checkpoint);
      recorder = new ScenarioRecorder(session, prior);
      const commander = session.state.entities.find(entity => entity.id === session!.runtime.labels.commander && entity.hp > 0)!;
      const tower = session.state.entities.find(entity => entity.id === session!.runtime.labels['target-tower'] && entity.hp > 0)!;
      assert(commander && tower, 'The armor proof requires the living commander and quarry tower.');
      const artifact = session.state.specialists?.artifacts.find(item => item.id === commander.equipment?.armor);
      assert(artifact?.definitionId === 'core:iron-aegis' && artifact.holder === commander.id && artifact.owner === 0 && !artifact.position, 'The commander must hold the naturally earned Iron Aegis.');
      assert(!(commander.shield ?? 0), 'The armor proof requires an unshielded commander.');
      const before = rankAndPromotions(commander);
      const issue = (command: Command): void => {
        const accepted = issueScenarioCommand(session!, 0, command);
        commands.push({ tick: session!.state.tick, command: structuredClone(command), accepted });
        assert(accepted, `The armor proof rejected ${command.type}.`);
      };
      if (!equipped) issue({ type: 'unequipArtifact', id: commander.id, slot: 'armor' });
      const otherTroops = session.state.entities.filter(entity => entity.side === 0 && entity.kind === 'unit' && entity.hp > 0 && entity.id !== commander.id).map(entity => entity.id);
      issue({ type: 'move', ids: otherTroops, x: 10, y: 24 });
      issue({ type: 'move', ids: [commander.id], x: 26, y: 20 });
      const stats = progressionStats(session.state, commander), hits: ArmorHit[] = [], lastTick = session.state.tick + 300;
      while (hits.length < 3 && session.runtime.outcome === 'playing' && session.state.tick < lastTick && commander.hp > 0) {
        const hp = commander.hp;
        stepScenario(session);
        if (commander.hp >= hp) continue;
        const attacks = session.state.events.filter(event => event.type === 'attack' && event.target === commander.id);
        assert(attacks.length === 1 && attacks[0].source === tower.id && attacks[0].amount === hp - commander.hp, 'The armor proof observed an unmatched incoming hit.');
        hits.push({ tick: session.state.tick, source: tower.id, target: commander.id, damage: hp - commander.hp });
      }
      assert(hits.length === 3, 'The armor proof did not observe three tower hits.');
      assert(rankAndPromotions(commander) === before, 'Rank or promotions changed during the armor comparison.');
      journal = recorder.archive();
      assert(scenarioStateEquals(verifyScenarioRecording(journal), session), 'The armor proof journal diverged from its final state.');
      arms.push({ equipped, hits, stats, finalHp: commander.hp, commands });
    } catch (error) {
      failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      try { if (recorder) journal = recorder.archive(); }
      catch (error) { failures.push(`${name} archive: ${error instanceof Error ? error.message : String(error)}`); }
      recorder?.destroy();
      archive(`${name}-recording`, journal);
      archive(`${name}-final`, session ? captureScenario(session) : checkpoint);
      archive(`${name}-commands`, commands);
    }
  }
  archive('armor-effect-failures', failures);
  assert(failures.length === 0, failures.join('\n'));
  const [withArmor, withoutArmor] = arms;
  assert(withArmor.stats.armor - withoutArmor.stats.armor === armor, 'Equipment did not add its declared armor.');
  const hits = withArmor.hits.map((hit, index) => {
    const other = withoutArmor.hits[index];
    assert(hit.tick === other.tick && hit.source === other.source && hit.target === other.target, 'The equipped and unequipped hits do not match.');
    assert(hit.damage > 0 && other.damage > 0 && other.damage - hit.damage === armor, 'The Iron Aegis did not reduce actual incoming damage by its declared armor.');
    return { tick: hit.tick, source: hit.source, target: hit.target, equipped: hit.damage, unequipped: other.damage };
  });
  return { artifact: 'core:iron-aegis', armor, hits, arms };
}
