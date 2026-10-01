import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { campaignArmy, checkpointCampaignMission, chooseCampaignBranch, completeCampaignMission, createCampaignProfile, decodeCampaignProfile, prepareCampaignMission, type CampaignMission, type CampaignProfile } from '../../src/core/campaign';
import { captureScenario, issueScenarioCommand, stepScenario, subscribeScenarioCommands } from '../../src/core/scenarios';
import { scenarioStateEquals, verifyScenarioRecording } from '../../src/core/scenario-recordings';
import { loadGame, saveGame } from '../../src/core/saves';
import { ARTIFACTS, progressionStats, promotionChoices } from '../../src/core/unit-progression';
import type { Command, Entity, GameEvent } from '../../src/core/types';
import { steerMission } from './mission-strategy';
import { proveArmorEffect } from './persistent-army/armor-effect-proof';
import { proveArtifactAllocation } from './persistent-army/artifact-allocation-proof';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const assert = (value: unknown, message: string): void => { if (!value) throw new Error(message); };
const permanent = (entity: Entity) => ({ id: entity.id, side: entity.side, kind: entity.kind, role: entity.role, definitionId: entity.definitionId, maxHp: entity.maxHp, maxShield: entity.maxShield, experience: entity.veteran?.experience, rank: entity.veteran?.rank, promotions: entity.veteran?.promotions });
type Stats = ReturnType<typeof progressionStats>;

/** Exercise earned progression, equipment, casualties and reserves through canonical campaign journals. */
export function provePersistentArmy(directory: string) {
  const output = resolve(directory);
  if (existsSync(output)) throw new Error('Proof outputs are append-only. Choose a new directory.');
  mkdirSync(output, { recursive: true });
  const archive = (name: string, value: unknown) => writeFileSync(resolve(output, `${name}.json`), JSON.stringify(value, null, 2) + '\n');
  const assertions: Record<string, boolean> = {};
  const check = (name: string, value: unknown) => { assertions[name] = !!value; assert(value, name); };
  const commands: Array<{ mission: string; tick: number; command: Command }> = [];
  const combat: Array<GameEvent & { mission: string; tick: number }> = [];
  const promotions: Array<{ mission: string; tick: number; id: number; before: Entity['veteran']; after: Entity['veteran']; statsBefore: Stats; statsAfter: Stats }> = [];
  const equipment: Array<{ mission: string; tick: number; id: number; artifact: number; before: Stats; after: Stats }> = [];
  const chapters: Array<{ mission: string; tick: number; checksum: string; commands: number; deployed: number[]; survivors: number[] }> = [];
  const continuations: Array<{ mission: string; tick: number; checksum: string }> = [];
  let profile = createCampaignProfile('campaign-dwarves', 'persistent-army-proof');
  let current: CampaignMission | null = null, unobserve = () => {};
  let armorEffect: ReturnType<typeof proveArmorEffect> | null = null;
  let allocation: ReturnType<typeof proveArtifactAllocation> | null = null;
  let casualty: number | null = null, recruited: number[] = [], reserves: number[] = [];
  let statsBeforeCommands = new Map<number, Stats>();

  const observe = (run: CampaignMission) => {
    unobserve(); current = run;
    const session = run.session;
    unobserve = subscribeScenarioCommands(session, (_side, command) => {
      commands.push({ mission: session.definition.id, tick: session.state.tick, command: structuredClone(command) });
      if (command.type === 'equipArtifact') {
        const entity = session.state.entities.find(entity => entity.id === command.id)!;
        equipment.push({ mission: session.definition.id, tick: session.state.tick, id: command.id, artifact: command.artifact, before: statsBeforeCommands.get(entity.id)!, after: progressionStats(session.state, entity) });
      }
      statsBeforeCommands = new Map(session.state.entities.filter(entity => entity.side === 0 && entity.kind === 'unit').map(entity => [entity.id, progressionStats(session.state, entity)]));
    });
  };
  const advance = (steer = true) => {
    const session = current!.session;
    statsBeforeCommands = new Map(session.state.entities.filter(entity => entity.side === 0 && entity.kind === 'unit').map(entity => [entity.id, progressionStats(session.state, entity)]));
    if (steer) steerMission(session);
    for (const entity of session.state.entities.filter(entity => entity.side === 0 && entity.hp > 0 && entity.veteran?.pendingPromotion)) {
      const choices = promotionChoices(session.state, entity), promotion = choices.includes('bulwark') ? 'bulwark' : choices[0];
      const before = structuredClone(entity.veteran), statsBefore = progressionStats(session.state, entity);
      assert(promotion && issueScenarioCommand(session, 0, { type: 'promote', id: entity.id, promotion }), 'Earned promotion was rejected.');
      promotions.push({ mission: session.definition.id, tick: session.state.tick, id: entity.id, before, after: structuredClone(entity.veteran), statsBefore, statsAfter: progressionStats(session.state, entity) });
    }
    stepScenario(session);
    for (const event of session.state.events) if (event.type === 'attack' || event.type === 'death' || event.type === 'train') combat.push({ ...structuredClone(event), mission: session.definition.id, tick: session.state.tick });
  };
  const resume = (name: string) => {
    const run = current!, checkpoint = captureScenario(run.session), recording = run.recorder.archive();
    archive(`${name}-checkpoint`, checkpoint); archive(`${name}-recording`, recording);
    check(`${name}: game save roundtrip`, hash(saveGame(loadGame(checkpoint.game))) === hash(checkpoint.game));
    check(`${name}: journal replay`, scenarioStateEquals(verifyScenarioRecording(recording), run.session));
    const saved = checkpointCampaignMission(run.profile, run.session, run.recorder); archive(`${name}-active-profile`, saved);
    run.recorder.destroy(); unobserve();
    const resumed = prepareCampaignMission(decodeCampaignProfile(JSON.stringify(saved)));
    check(`${name}: resume state`, scenarioStateEquals(run.session, resumed.session));
    continuations.push({ mission: run.session.definition.id, tick: run.session.state.tick, checksum: recording.finalChecksum });
    observe(resumed);
  };
  const complete = (name: string): CampaignProfile => {
    const run = current!, recording = run.recorder.archive();
    archive(`${name}-recording`, recording); archive(`${name}-final`, captureScenario(run.session));
    check(`${name}: victory`, run.session.runtime.outcome === 'won');
    check(`${name}: verified final state`, scenarioStateEquals(verifyScenarioRecording(recording), run.session));
    const completed = completeCampaignMission(run.profile, run.session, recording);
    check(`${name}: result applied once`, completeCampaignMission(completed, run.session, recording) === completed);
    const decoded = decodeCampaignProfile(JSON.stringify(completed));
    check(`${name}: profile reload`, hash(decoded) === hash(completed)); archive(`${name}-completed-profile`, decoded);
    chapters.push({ mission: run.session.definition.id, tick: run.session.state.tick, checksum: recording.finalChecksum, commands: recording.commands.length, deployed: [...run.profile.active!.deployedIds], survivors: campaignArmy(decoded).map(soldier => soldier.entity.id) });
    run.recorder.destroy(); unobserve(); return decoded;
  };

  try {
    observe(prepareCampaignMission(profile)); archive('chapter1-initial', captureScenario(current!.session));
    let resumedArtifact = false;
    while (current!.session.runtime.outcome === 'playing' && current!.session.state.tick < 3610) {
      advance();
      if (!resumedArtifact && equipment.length) {
        const equipped = equipment[0];
        check('native artifact adds four armor', equipped.after.armor - equipped.before.armor === ARTIFACTS['core:iron-aegis'].armor);
        armorEffect = proveArmorEffect(captureScenario(current!.session), current!.recorder.archive(), archive);
        resume('chapter1-equipped'); resumedArtifact = true;
      }
    }
    check('equipped chapter was resumed', resumedArtifact);
    profile = complete('chapter1');
    const firstArmy = campaignArmy(profile), commander = firstArmy.find(soldier => soldier.label === 'commander')!, cannon = firstArmy.find(soldier => soldier.label === 'cannon')!;
    check('native artifact recovered and equipped by commands', commands.some(entry => entry.command.type === 'recoverArtifact') && commands.some(entry => entry.command.type === 'equipArtifact'));
    check('cannon earned rank and promotion in combat', !!cannon.entity.veteran && cannon.entity.veteran.experience >= 40 && cannon.entity.veteran.rank >= 1 && cannon.entity.veteran.promotions.length > 0 && combat.some(event => event.type === 'attack' && event.source === cannon.entity.id && (event.amount ?? 0) > 0));
    check('commander artifact has native ownership', commander.artifacts?.length === 1 && commander.artifacts[0].definitionId === 'core:iron-aegis' && commander.artifacts[0].holder === commander.entity.id && commander.artifacts[0].owner === 0 && commander.entity.equipment?.armor === commander.artifacts[0].id);
    archive('earned-army', firstArmy);
    allocation = proveArtifactAllocation(firstArmy, archive);

    observe(prepareCampaignMission(profile));
    const second = current!, secondInitial = captureScenario(second.session); archive('chapter2-initial', secondInitial);
    for (const survivor of [commander, cannon]) {
      const deployed = second.session.state.entities.find(entity => entity.id === survivor.entity.id)!;
      check(`chapter2: survivor ${survivor.entity.id} identity and earned progress`, hash(permanent(deployed)) === hash(permanent(survivor.entity)));
      check(`chapter2: survivor ${survivor.entity.id} rests`, deployed.hp === deployed.maxHp && deployed.cooldown === 0 && deployed.path.length === 0 && !deployed.specialistBuffs && !deployed.entrenchedAt && !deployed.orderQueue);
    }
    check('chapter2 artifact uses a separate owned record', second.session.state.specialists?.artifacts[0].holder === commander.entity.id && second.session.state.specialists.artifacts[0].owner === 0 && second.session.state.specialists.artifacts[0] !== commander.artifacts![0] && second.session.state.specialists.nextArtifactId === 2);
    const barracks = second.session.state.entities.find(entity => entity.side === 0 && entity.role === 'barracks')!;
    const initialIds = new Set(second.session.state.entities.map(entity => entity.id));
    check('two ordinary reinforcements accepted', issueScenarioCommand(second.session, 0, { type: 'train', id: barracks.id, role: 'ranged' }) && issueScenarioCommand(second.session, 0, { type: 'train', id: barracks.id, role: 'ranged' }));
    const doomed = second.session.state.entities.find(entity => entity.id === second.session.runtime.labels['gun-a'])!;
    casualty = doomed.id; check('casualty was a carried deployed troop', second.profile.active!.deployedIds.includes(casualty) && firstArmy.some(soldier => soldier.entity.id === casualty));
    check('casualty move accepted', issueScenarioCommand(second.session, 0, { type: 'move', ids: [casualty], x: 18, y: 8 }));
    while (doomed.hp > 0 && second.session.runtime.outcome === 'playing' && second.session.state.tick < 1000) advance(false);
    check('deployed casualty died through hostile combat', doomed.hp === 0 && combat.some(event => event.type === 'attack' && event.side === 1 && event.target === casualty && (event.amount ?? 0) > 0) && combat.some(event => event.type === 'death' && event.source === casualty));
    resume('chapter2-casualty');
    while (current!.session.runtime.outcome === 'playing' && current!.session.state.tick < 3310) advance();
    recruited = current!.session.state.entities.filter(entity => entity.side === 0 && entity.kind === 'unit' && entity.hp > 0 && !initialIds.has(entity.id)).map(entity => entity.id);
    profile = complete('chapter2');
    check('deployed casualty removed from roster', !campaignArmy(profile).some(soldier => soldier.entity.id === casualty));
    check('trained survivor joins persisted army', recruited.length > 0 && recruited.every(id => campaignArmy(profile).some(soldier => soldier.entity.id === id)));

    profile = chooseCampaignBranch(profile, 'works'); const priorArmy = campaignArmy(profile);
    observe(prepareCampaignMission(profile)); const third = current!; archive('chapter3-initial', captureScenario(third.session));
    const reserveArmy = priorArmy.filter(soldier => !third.profile.active!.deployedIds.includes(soldier.entity.id)); reserves = reserveArmy.map(soldier => soldier.entity.id);
    check('reserve includes earned veteran and trained soldier', reserves.includes(cannon.entity.id) && recruited.some(id => reserves.includes(id)));
    check('casualty absent from next mission', !third.session.state.entities.some(entity => entity.id === casualty));
    check('commander equipment persists into next mission', third.session.state.entities.find(entity => entity.id === commander.entity.id)?.equipment?.armor === third.session.state.specialists?.artifacts.find(item => item.holder === commander.entity.id)?.id);
    advance(); resume('chapter3-reserves');
    while (current!.session.runtime.outcome === 'playing' && current!.session.state.tick < 4810) advance();
    profile = complete('chapter3');
    const finalArmy = campaignArmy(profile); archive('final-army', finalArmy);
    check('all reserves retain every recorded value', reserveArmy.length > 0 && reserveArmy.every(soldier => hash(finalArmy.find(after => after.entity.id === soldier.entity.id)) === hash(soldier)));
    check('casualty remains removed after later victory', !finalArmy.some(soldier => soldier.entity.id === casualty));
    const deterministic = { assertions, chapters, continuations, casualty, recruited, reserves, promotions, equipment, armorEffect, allocation, finalArmy };
    const sourceFiles = ['src/core/campaign.ts', 'src/core/scenarios.ts', 'src/core/scenario-recordings.ts', 'src/core/simulation.ts', 'src/core/unit-progression.ts', 'src/core/saves.ts', 'src/scenarios/campaigns.ts', 'scripts/scenarios/mission-strategy.ts', 'scripts/scenarios/puzzle-stealth-strategy.ts', 'scripts/scenarios/route-strategy.ts', 'scripts/scenarios/prove-persistent-army.ts', 'scripts/scenarios/persistent-army/armor-effect-proof.ts', 'scripts/scenarios/persistent-army/artifact-allocation-proof.ts'];
    const report = { format: 'orcs-vs-fairies-persistent-army-proof', version: 1, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceFiles: Object.fromEntries(sourceFiles.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])), generatedAt: new Date().toISOString(), commandPath: 'issueScenarioCommand', stepPath: 'stepScenario', deterministicSha256: hash(deterministic), ...deterministic };
    archive('report', report); archive('accepted-commands', commands); archive('combat-events', combat); return report;
  } catch (error) {
    archive('failure', { error: String(error), stack: error instanceof Error ? error.stack : null, assertions, chapters, continuations, casualty, recruited, reserves, promotions, equipment, armorEffect, allocation });
    archive('accepted-commands', commands); archive('combat-events', combat);
    if (current) { archive('failure-checkpoint', captureScenario(current.session)); archive('failure-recording', current.recorder.archive()); archive('failure-profile', current.profile); }
    throw error;
  } finally { (current as CampaignMission | null)?.recorder.destroy(); unobserve(); }
}

if (process.argv[1] && /^prove-persistent-army\.(?:mjs|js|ts)$/.test(basename(process.argv[1])) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory = process.argv[2] ?? `work/campaign-content/persistent-army/${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const report = provePersistentArmy(directory);
  console.log(JSON.stringify({ directory: resolve(directory), deterministicSha256: report.deterministicSha256, assertions: Object.keys(report.assertions).length, chapters: report.chapters, casualty: report.casualty, reserves: report.reserves }, null, 2));
}
