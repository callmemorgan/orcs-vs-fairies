import { length2D } from '../../src/core/geometry';
import { issueScenarioCommand } from '../../src/core/scenarios';
import { isVisible } from '../../src/core/simulation';
import { unitFor } from '../../src/core/content-registry';
import { observedArtifacts } from '../../src/core/unit-progression';
import { missionAbilityCommand } from './ability-strategy';
import type { ScenarioSession } from '../../src/core/scenario-types';
import type { Command, Entity, Vec } from '../../src/core/types';

interface Steering { phase: number; nextCommand: number; started: boolean; deaths: Set<number>; commands: Array<{ tick: number; time: number; side: 0; command: Command; accepted: boolean }> }
const states = new WeakMap<ScenarioSession, Steering>();
const distance = (a: Vec, b: Vec) => length2D(a.x-b.x,a.y-b.y);
const own = (session: ScenarioSession) => session.state.entities.filter(entity => entity.hp>0 && entity.side===0 && entity.kind==='unit' && !entity.illusion && !entity.raised);
const named = (session: ScenarioSession, label: string) => session.state.entities.find(entity => entity.id===session.runtime.labels[label] && entity.hp>0 && (entity.side===0 || isVisible(session.state,0,entity.x,entity.y)));
const move = (session: ScenarioSession, entities: Entity[], point: Vec, attack = false) => entities.length>0 && submit(session,{type: attack?'attackMove':'move',ids: entities.map(entity=>entity.id),...point});
function ability(session: ScenarioSession, entities: Entity[]): boolean {
  let accepted = false;
  for (const entity of entities) {
    const command = missionAbilityCommand(session.state, entity);
    if (command && submit(session, command)) accepted = true;
  }
  return accepted;
}
function hold(session: ScenarioSession, entities: Entity[]): void {
  const ids = entities.filter(entity => entity.order.type !== 'hold').map(entity => entity.id);
  if (ids.length) submit(session, { type: 'hold', ids });
}
function steering(session: ScenarioSession): Steering {
  let state = states.get(session);
  if(!state) {state={phase:0,nextCommand:0,started:false,deaths:new Set(),commands:[]};states.set(session,state);}
  for(const event of session.state.events) if(event.type==='death' && event.source!==undefined && isVisible(session.state,0,event.x,event.y)) state.deaths.add(event.source);
  return state;
}
const observedDead = (session: ScenarioSession, state: Steering, label: string) => state.deaths.has(session.runtime.labels[label]);
function submit(session: ScenarioSession, command: Command): boolean {
  const accepted=issueScenarioCommand(session,0,command);
  steering(session).commands.push({tick:Math.round(session.state.time/.05),time:session.state.time,side:0,command:structuredClone(command),accepted});
  return accepted;
}
export function puzzleStealthCommands(session: ScenarioSession) { return structuredClone(states.get(session)?.commands??[]); }

/** This route is read from the authored archive trigger and avoids the visible patrol roads. */
export function steerStealth(session: ScenarioSession): void {
  const state = steering(session), commander = named(session,'commander');
  if(!commander || session.state.time < state.nextCommand) return;
  state.nextCommand=session.state.time+.5;
  const event=session.definition.events.find(event=>event.id==='archive')!;
  if(event.when.type!=='at') throw new Error('An authored stealth mission requires an archive area.');
  const origin=session.definition.army.find(actor=>actor.label==='commander')!;
  const route=[{x:6,y:6},event.when.point,{x:6,y:6},{x:origin.x,y:origin.y}];
  if(state.phase===1 && session.runtime.variables['archive.recovered']) state.phase=2;
  if(state.phase<route.length-1 && distance(commander,route[state.phase])<1) state.phase++;
  move(session,[commander],route[state.phase]);
  const weaver = named(session, 'weaver');
  if (weaver) {
    move(session, [weaver], route[state.phase]);
    const guard = session.state.entities.some(entity => entity.side === 1 && entity.hp > 0 && isVisible(session.state, 0, entity.x, entity.y) && distance(weaver, entity) < 7);
    if (guard) ability(session, [weaver]);
  }
}

/** The fixed-army puzzles use their declared counter, firing shelf, wet flank, or real corpses. */
export function steerPuzzle(session: ScenarioSession): void {
  const state=steering(session), troops=own(session), commander=named(session,'commander');
  if(!commander || session.state.time<state.nextCommand) return;
  state.nextCommand=session.state.time+1;
  switch(session.definition.id) {
    case 'orcs-3': {
      const riders=troops.filter(entity=>entity.role==='cavalry'), line=troops.filter(entity=>entity.role!=='cavalry');
      if(!state.started) {move(session,line,{x:23,y:18},true);ability(session,line);state.started=true;}
      const route=[{x:13,y:28},{x:24,y:28},{x:29,y:21}];
      if(state.phase<2 && riders.length && riders.every(entity=>distance(entity,route[state.phase])<2)) state.phase++;
      move(session,riders,route[state.phase],state.phase===2);
      if(state.phase===2) {
        const target=named(session,'archer-b')??named(session,'archer-a');
        if(target) submit(session,{type:'attack',ids:riders.map(entity=>entity.id),target:target.id});
      }
      break;
    }
    case 'fairies-3-alt': {
      if(!state.started) {
        move(session,troops.filter(entity=>entity.role==='melee'),{x:26,y:18},true);
        move(session,troops.filter(entity=>entity.role!=='melee'),{x:27,y:18},true);
        ability(session,troops.filter(entity=>unitFor(session.state,entity).ability==='illusion'));state.started=true;
      }
      break;
    }
    case 'dwarves-1': {
      const cannon=named(session,'cannon');
      if(!cannon) return;
      const artifacts = observedArtifacts(session.state, 0);
      const held = artifacts.find(item => item.holder === commander.id && item.owner === 0);
      const equipped = held && Object.values(commander.equipment ?? {}).includes(held.id);
      if (equipped) state.phase = 3;
      else if (held || artifacts.some(item => item.position) || observedDead(session, state, 'raider')) state.phase = Math.max(state.phase, 1);
      if (state.phase === 0) {
        const escort = troops.filter(entity => entity.id !== cannon.id);
        const raider = named(session, 'raider');
        if (raider) submit(session, { type: 'attack', ids: escort.map(entity => entity.id), target: raider.id });
        else move(session, escort, { x: 20, y: 24 }, true);
        ability(session, [commander]);
        break;
      }
      hold(session, troops.filter(entity => entity.id !== commander.id && (state.phase < 3 || entity.id !== cannon.id)));
      if (state.phase < 3) {
        if (held) {
          if (submit(session, { type: 'equipArtifact', id: commander.id, artifact: held.id })) state.phase = 3;
        } else {
          const drop = artifacts.find(item => item.position);
          if (!drop?.position) {
            move(session, [commander], { x: 23.2, y: 24 });
          } else if (distance(commander, drop.position) <= 2) {
            if (submit(session, { type: 'recoverArtifact', id: commander.id, artifact: drop.id }) &&
              submit(session, { type: 'equipArtifact', id: commander.id, artifact: drop.id })) state.phase = 3;
          } else {
            const tower = session.definition.army.find(actor => actor.label === 'target-tower')!;
            const separation = Math.max(.01, distance(drop.position, tower));
            move(session, [commander], {
              x: drop.position.x + (drop.position.x - tower.x) / separation * .8,
              y: drop.position.y + (drop.position.y - tower.y) / separation * .8,
              ...(drop.position.level === undefined ? {} : { level: drop.position.level }),
            });
          }
        }
        ability(session, [commander]);
      }
      if (state.phase === 3) {
        if (distance(commander, { x: 14, y: 18 }) > 1) move(session, [commander], { x: 14, y: 18 });
        else hold(session, [commander]);
        ability(session, [commander]);
        if (distance(cannon,{x:19,y:18})>.8) move(session,[cannon],{x:19,y:18});
        else if (cannon.entrenchedAt === undefined) ability(session,[cannon]);
      }
      break;
    }
    case 'undead-3-alt': {
      const gravecaller = named(session, 'gravecaller');
      if (gravecaller) ability(session, [gravecaller]);
      ability(session, [commander]);
      if(observedDead(session,state,'wounded-a') && observedDead(session,state,'wounded-b') && (session.runtime.commandCounts['ability.raise']??0)>0 && !state.started) {
        const army = session.state.entities.filter(entity => entity.side === 0 && entity.hp > 0 && entity.kind === 'unit' && !entity.illusion);
        move(session,army,{x:29,y:18},true);state.started=true;
      }
      break;
    }
    case 'tideborn-2': {
      const shells=troops.filter(entity=>entity.role==='melee');
      if(!state.started) {move(session,troops.filter(entity=>entity.role!=='melee'),{x:26,y:18},true);state.started=true;}
      const route=[{x:24,y:27},{x:29,y:22},{x:28,y:18}];
      if(state.phase<2 && shells.length && shells.every(entity=>distance(entity,route[state.phase])<2)) state.phase++;
      move(session,shells,route[state.phase],state.phase===2);
      break;
    }
    case 'automata-1': {
      if(!state.started) {move(session,troops,{x:26,y:18},true);state.started=true;}
      if(observedDead(session,state,'blocker-a') && observedDead(session,state,'blocker-b')) move(session,[commander],{x:29,y:18});
      break;
    }
    default: throw new Error(`No authored puzzle strategy for ${session.definition.id}`);
  }
}
