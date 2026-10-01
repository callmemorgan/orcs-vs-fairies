import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { validateCommand } from '../src/core/commands';
import { PlayerView } from '../src/core/observation';
import { MatchRecorder, ReplayPlayer, replayChecksum } from '../src/core/replays';
import { loadGame, saveGame } from '../src/core/saves';
import { createGame, createMatch, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import { canAmbush, canObserveTacticalEntity, formationDestination, initializeTactics, isCrewless, TACTICS } from '../src/core/tactics';
import type { FormationKind } from '../src/core/tactics';
import type { BuildingRole, Entity, FactionId, GameState, Side, UnitRole } from '../src/core/types';

function fixture(faction:FactionId='orcs',opponent:FactionId='orcs') {
 const s=createGame(faction,4127,opponent,{controllers:['external','external']});s.terrain.fill('grass');s.resources=[];s.entities=s.entities.filter(e=>e.kind==='building');return s;
}
function unit(s:GameState,side:Side,role:UnitRole,x:number,y:number):Entity {
 const d=FACTIONS[s.players[side].faction].units[role],e:Entity={id:s.nextId++,side,kind:'unit',role,x,y,hp:d.hp,maxHp:d.hp,order:{type:'hold'},cooldown:100,progress:1,queue:[],trainProgress:0,researchProgress:0,facing:4,animation:'idle',animTime:0,momentum:0,illusion:false,expires:0,carried:0,carriedKind:'wood',path:[]};if(d.shield){e.shield=d.shield;e.maxShield=d.shield;}initializeTactics(s,e);s.entities.push(e);return e;
}
function building(s:GameState,side:Side,role:BuildingRole,x:number,y:number):Entity {
 const d=FACTIONS[s.players[side].faction].buildings[role],template=s.entities.find(e=>e.kind==='building')!,e={...structuredClone(template),id:s.nextId++,side,role,x,y,hp:d.hp,maxHp:d.hp};s.entities.push(e);return e;
}
function advance(s:GameState,seconds:number){for(let i=0;i<Math.round(seconds/.05);i++)stepGame(s,.05);}
function fire(s:GameState,source:Entity,target:Entity,seconds=.05){refreshVisibility(s);source.cooldown=0;expect(issueCommand(s,source.side,{type:'attack',ids:[source.id],target:target.id})).toBe(true);advance(s,seconds);return s.events.filter(e=>e.type==='attack'&&e.source===source.id&&e.target===target.id).reduce((n,e)=>n+(e.amount??0),0);}

describe('combat tactics encounters',()=>{
 it.each<FormationKind>(['line','wedge','square','loose'])('%s preserves stable slots, routes around a building, and regroups after a casualty',kind=>{
  const s=fixture(),roles:UnitRole[]=['melee','ranged','spear','cavalry','melee','ranged'],army=roles.map((role,i)=>unit(s,0,role,18.5+i*.7,20.5));building(s,0,'depot',24.5,20.5);refreshVisibility(s);
  expect(issueCommand(s,0,{type:'formation',ids:army.map(e=>e.id).reverse(),formation:kind,spacing:.8,facing:0})).toBe(true);
  expect(army.map(e=>e.tactics!.formation!.slot)).toEqual([0,1,2,3,4,5]);
  expect(issueCommand(s,0,{type:'move',ids:army.map(e=>e.id),x:30.5,y:20.5})).toBe(true);advance(s,16);
  for(const e of army){const goal=formationDestination(e.tactics!.formation!,s);expect(Math.hypot(e.x-goal.x,e.y-goal.y)).toBeLessThan(.7);expect(e.order.type).toBe('hold');expect(e.facing).toBe(0);}
  const victim=army[2],enemy=unit(s,1,'ranged',victim.x-5,victim.y);victim.hp=1;victim.tactics!.morale=100;fire(s,enemy,victim);expect(victim.hp).toBe(0);enemy.cooldown=100;expect(issueCommand(s,1,{type:'move',ids:[enemy.id],x:10.5,y:10.5})).toBe(true);advance(s,8);
  const survivors=army.filter(e=>e.hp>0);expect(survivors.map(e=>e.tactics!.formation!.slot)).toEqual([0,1,2,3,4]);for(const e of survivors){expect(e.tactics!.formation!.count).toBe(5);expect(Math.hypot(e.x-formationDestination(e.tactics!.formation!,s).x,e.y-formationDestination(e.tactics!.formation!,s).y)).toBeLessThan(.75);}
 });
 it('assigns the same formation destinations for arbitrary entity-array and command-ID order',()=>{
  const a=fixture(),army=Array.from({length:5},(_,i)=>unit(a,0,i%2?'ranged':'melee',20.5+i,20.5)),b=loadGame(saveGame(a));b.entities.reverse();const ids=army.map(e=>e.id);
  issueCommand(a,0,{type:'formation',ids,formation:'wedge',spacing:1,facing:2});issueCommand(b,0,{type:'formation',ids:[...ids].reverse(),formation:'wedge',spacing:1,facing:2});
  const positions=(s:GameState)=>s.entities.filter(e=>ids.includes(e.id)).sort((a,b)=>a.id-b.id).map(e=>[e.id,e.order,e.tactics!.formation]);expect(positions(a)).toEqual(positions(b));
 });
 it('retains held facing and resolves front, side and rear damage through real attacks',()=>{
  const amounts=[];for(const [x,y] of [[20.5,24.5],[24.5,20.5],[28.5,24.5]]){const s=fixture(),target=unit(s,1,'melee',24.5,24.5),source=unit(s,0,'ranged',x,y);target.facing=4;const hp=target.hp;fire(s,source,target);amounts.push(hp-target.hp);expect(target.facing).toBe(4);}
  expect(amounts).toEqual([12,15,18]);
  const s=fixture(),target=unit(s,1,'melee',24.5,24.5),source=unit(s,0,'ranged',28.5,24.5);expect(issueCommand(s,1,{type:'face',ids:[target.id],facing:0})).toBe(true);expect(fire(s,source,target)).toBe(12);
 });
 it('an isolated wounded fighter retreats while allied support recovers morale',()=>{
  const alone=fixture(),fighter=unit(alone,0,'melee',25.5,25.5);fighter.hp=fighter.maxHp*.5;fighter.tactics!.morale=28;unit(alone,1,'melee',28.5,25.5);refreshVisibility(alone);advance(alone,2);
  expect(fighter.tactics!.retreat).toBeDefined();expect(fighter.order.type).toBe('move');expect(fighter.x).not.toBe(25.5);
  const supported=fixture(),supportedFighter=unit(supported,0,'melee',25.5,25.5);supportedFighter.hp=supportedFighter.maxHp*.5;supportedFighter.tactics!.morale=28;unit(supported,0,'spear',25.5,27.5);unit(supported,1,'melee',28.5,25.5);refreshVisibility(supported);advance(supported,2);
  expect(supportedFighter.tactics!.retreat).toBeUndefined();expect(supportedFighter.tactics!.morale).toBeGreaterThan(28);
  const resumed=loadGame(saveGame(alone));for(let i=0;i<80;i++){stepGame(alone,.05);stepGame(resumed,.05);}expect(replayChecksum(resumed)).toBe(replayChecksum(alone));
 });
 it('surrounded broken troops surrender without healing or changing their original definition',()=>{
  const s=fixture('dwarves','fairies'),broken=unit(s,0,'ranged',24.5,24.5);broken.hp=30;broken.tactics!.morale=1;for(const [x,y] of [[23.3,24.5],[25.7,24.5],[24.5,25.7]])unit(s,1,'melee',x,y);refreshVisibility(s);advance(s,.05);
  expect(broken.side).toBe(1);expect(broken.hp).toBe(30);expect(broken.definitionFaction).toBe('dwarves');expect(broken.tactics!.surrenderedTo).toBe(1);expect(issueCommand(s,0,{type:'move',ids:[broken.id],x:18,y:18})).toBe(false);expect(issueCommand(s,1,{type:'move',ids:[broken.id],x:28,y:28})).toBe(true);
 });
 it('a frontal shield consumes guard energy; rear and turned shields leave the ally exposed',()=>{
  const trial=(sourceX:number,facing:number)=>{const s=fixture('dwarves','orcs'),target=unit(s,0,'ranged',25.5,24.5),guard=unit(s,0,'melee',23.5,24.5),source=unit(s,1,'ranged',sourceX,24.5);guard.facing=facing;target.facing=sourceX<target.x?4:0;const hp=target.hp;fire(s,source,target);return {loss:hp-target.hp,energy:guard.tactics!.guard!.value};};
  const front=trial(20.5,4),rear=trial(29.5,4),turned=trial(20.5,0);expect(front.loss).toBeCloseTo(5.6);expect(front.energy).toBeCloseTo(31.6);expect(rear.loss).toBe(14);expect(rear.energy).toBe(40);expect(turned.loss).toBe(14);
 });
 it('shield support also protects an allied player, and depletion restores full damage',()=>{
  const s=createMatch({map:{seed:4127},players:[{id:0,teamId:0,factionId:'dwarves',controller:'external'},{id:1,teamId:1,factionId:'orcs',controller:'external'},{id:2,teamId:0,factionId:'fairies',controller:'external'}]});s.terrain.fill('grass');s.resources=[];s.entities=s.entities.filter(e=>e.kind==='building');const guard=unit(s,0,'melee',23.5,24.5),ally=unit(s,2,'ranged',25.5,24.5),source=unit(s,1,'ranged',20.5,24.5);guard.facing=4;ally.facing=4;guard.tactics!.guard!.value=1;const hp=ally.hp;fire(s,source,ally);expect(hp-ally.hp).toBeCloseTo(14);expect(guard.tactics!.guard!.value).toBe(0);const next=ally.hp;fire(s,source,ally);expect(next-ally.hp).toBeCloseTo(15.9);
 });
 it('buildings and rocks reduce ranged hits; cover does not reduce melee damage',()=>{
  const trial=(cover:'none'|'rock'|'building',melee=false)=>{const s=fixture(),target=unit(s,1,'melee',25.5,24.5),source=unit(s,0,melee?'spear':'ranged',melee?24:20.5,24.5);target.facing=4;if(cover==='rock')s.terrain[24*s.width+23]='rock';if(cover==='building')building(s,1,'depot',23.5,24.5);const hp=target.hp;fire(s,source,target);return hp-target.hp;};
  expect(trial('none')).toBe(12);expect(trial('rock')).toBeCloseTo(6.75);expect(trial('building')).toBeCloseTo(6.75);expect(trial('none',true)).toBe(trial('rock',true));
 });
 it('destroying a covering structure through combat restores unprotected ranged damage',()=>{
  const s=fixture(),target=unit(s,1,'melee',25.5,24.5),source=unit(s,0,'ranged',20.5,24.5),cover=building(s,1,'depot',23.5,24.5);target.facing=4;const first=target.hp;fire(s,source,target);expect(first-target.hp).toBeCloseTo(6.75);cover.hp=1;const siege=unit(s,0,'siege',18.5,24.5);fire(s,siege,cover,1);expect(cover.hp).toBe(0);source.momentum=0;const after=target.hp;fire(s,source,target);expect(after-target.hp).toBe(12);
 });
 it.each([true,false])('siege shell impact obeys friendlyFire=%s and survives a mid-flight save',friendlyFire=>{
  const s=fixture();s.friendlyFire=friendlyFire;const siege=unit(s,0,'siege',18.5,24.5),target=unit(s,1,'melee',25.5,24.5),friend=unit(s,0,'melee',25.5,25.5);target.facing=4;friend.facing=4;const enemyHp=target.hp,friendHp=friend.hp;fire(s,siege,target);expect(s.projectiles).toHaveLength(1);expect(target.hp).toBe(enemyHp);const resumed=loadGame(saveGame(s));advance(s,1);advance(resumed,1);expect(target.hp).toBeLessThan(enemyHp);if(friendlyFire)expect(friend.hp).toBeLessThan(friendHp);else expect(friend.hp).toBe(friendHp);expect(s.projectiles).toHaveLength(0);expect(replayChecksum(resumed)).toBe(replayChecksum(s));
 });
 it('moving cavalry gains impact while stops and sharp turns lose the charge',()=>{
  const trial=(motion:'stationary'|'charge'|'stop'|'turn')=>{const s=fixture(),cavalry=unit(s,0,'cavalry',18.5,24.5),target=unit(s,1,'melee',26,24.5);target.facing=4;cavalry.cooldown=100;refreshVisibility(s);if(motion!=='stationary'){issueCommand(s,0,{type:'move',ids:[cavalry.id],x:25.1,y:24.5});advance(s,1.8);expect(cavalry.tactics!.charge!.distance).toBeGreaterThan(4);if(motion==='stop'){issueCommand(s,0,{type:'hold',ids:[cavalry.id]});advance(s,1.5);}if(motion==='turn'){issueCommand(s,0,{type:'move',ids:[cavalry.id],x:cavalry.x,y:cavalry.y-2});advance(s,.4);}}else cavalry.x=25.1;const hp=target.hp;fire(s,cavalry,target,.3);return hp-target.hp;};
  expect(trial('charge')).toBeGreaterThan(trial('stationary')*1.5);expect(trial('stop')).toBeLessThan(trial('charge'));expect(trial('turn')).toBeLessThan(trial('charge'));
 });
 it('frontal braced pikes cancel charge and hurt the rider; a rear charge retains impact',()=>{
  const trial=(facing:number)=>{const s=fixture(),rider=unit(s,0,'cavalry',18.5,24.5),pike=unit(s,1,'spear',26,24.5);pike.facing=facing;rider.cooldown=100;refreshVisibility(s);issueCommand(s,0,{type:'move',ids:[rider.id],x:25.1,y:24.5});advance(s,1.8);const hp=pike.hp,riderHp=rider.hp;fire(s,rider,pike,.05);return {loss:hp-pike.hp,riderLoss:riderHp-rider.hp,charge:rider.tactics!.charge!.distance};};
  const front=trial(4),rear=trial(0);expect(front.loss).toBeCloseTo(17);expect(front.riderLoss).toBeGreaterThan(10);expect(front.charge).toBe(0);expect(rear.loss).toBeGreaterThan(front.loss*1.5);expect(rear.riderLoss).toBe(0);
 });
 it('crew deaths leave neutral equipment which channels capture, retains stats and obeys its new owner',()=>{
  const s=fixture('fairies','orcs'),engine=unit(s,1,'siege',25.5,24.5),captor=unit(s,0,'melee',24.3,24.5);engine.cooldown=100;engine.facing=4;engine.tactics!.siegeCrew!.hp=1;fire(s,captor,engine);expect(engine.hp).toBe(engine.maxHp);expect(isCrewless(engine)).toBe(true);expect(new PlayerView(1).observe(s).entities.find(e=>e.id===engine.id)?.owner).toBe(null);expect(issueCommand(s,1,{type:'move',ids:[engine.id],x:28,y:28})).toBe(false);
  expect(issueCommand(s,0,{type:'captureSiege',ids:[captor.id],target:engine.id})).toBe(true);advance(s,2);expect(captor.tactics!.capture!.progress).toBeCloseTo(.5);const resumed=loadGame(saveGame(s));advance(s,2.1);advance(resumed,2.1);expect(engine.side).toBe(0);expect(engine.definitionFaction).toBe('orcs');expect(isCrewless(engine)).toBe(false);expect(replayChecksum(resumed)).toBe(replayChecksum(s));expect(issueCommand(s,0,{type:'move',ids:[engine.id],x:28,y:26})).toBe(true);advance(s,4);expect(engine.x).toBeGreaterThan(27);expect(issueCommand(s,1,{type:'hold',ids:[engine.id]})).toBe(false);
 });
 it('an enemy guard contests siege capture until it leaves the equipment',()=>{
  const s=fixture(),engine=unit(s,1,'siege',25.5,24.5),captor=unit(s,0,'worker',24.3,24.5),guard=unit(s,1,'melee',26.5,24.5);engine.tactics!.siegeCrew!.hp=0;engine.tactics!.siegeCrew!.uncrewed=true;refreshVisibility(s);expect(issueCommand(s,0,{type:'captureSiege',ids:[captor.id],target:engine.id})).toBe(true);advance(s,3);expect(captor.tactics!.capture!.progress).toBe(0);issueCommand(s,1,{type:'move',ids:[guard.id],x:32.5,y:24.5});advance(s,7);expect(engine.side).toBe(0);
 });
 it('ambush troops remain concealed, withhold fire, and reveal on the selected trigger',()=>{
  const s=fixture(),ambusher=unit(s,0,'ranged',24.5,24.5),foe=unit(s,1,'melee',28.5,24.5);ambusher.cooldown=0;s.resources.push({id:s.nextId++,kind:'wood',x:24.5,y:25.6,amount:100,maxAmount:100});refreshVisibility(s);expect(canAmbush(s,ambusher)).toBe(true);expect(issueCommand(s,0,{type:'ambush',ids:[ambusher.id],radius:2,target:'melee'})).toBe(true);const hp=foe.hp;advance(s,1);expect(foe.hp).toBe(hp);expect(new PlayerView(1).observe(s).entities.some(e=>e.id===ambusher.id)).toBe(false);expect(issueCommand(s,1,{type:'attack',ids:[foe.id],target:ambusher.id})).toBe(false);
  issueCommand(s,1,{type:'move',ids:[foe.id],x:25.8,y:24.5});advance(s,2);expect(ambusher.tactics!.ambush!.concealed).toBe(false);expect(foe.hp).toBeLessThan(hp);expect(canObserveTacticalEntity(s,1,ambusher)).toBe(true);
 });
 it('scout detection, manual release and destroyed concealment expose an ambush without leaking its trigger',()=>{
  const s=fixture(),ambusher=unit(s,0,'ranged',24.5,24.5),scout=unit(s,1,'cavalry',26.8,24.5),wood={id:s.nextId++,kind:'wood' as const,x:24.5,y:25.6,amount:100,maxAmount:100};s.resources.push(wood);refreshVisibility(s);issueCommand(s,0,{type:'ambush',ids:[ambusher.id],radius:1,target:'building'});expect(canObserveTacticalEntity(s,1,ambusher)).toBe(true);const observed=new PlayerView(1).observe(s).entities.find(e=>e.id===ambusher.id)!;expect(observed.tactics).not.toHaveProperty('ambush');expect(issueCommand(s,0,{type:'releaseAmbush',ids:[ambusher.id]})).toBe(true);expect(ambusher.tactics!.ambush).toBeUndefined();scout.x=30;refreshVisibility(s);issueCommand(s,0,{type:'ambush',ids:[ambusher.id],radius:1,target:'building'});wood.amount=0;advance(s,.05);expect(ambusher.tactics!.ambush!.concealed).toBe(false);
 });
 it('formation, ambush and combat history replay to the same saved checksum',()=>{
  const s=fixture(),army=[unit(s,0,'melee',20.5,20.5),unit(s,0,'ranged',21.5,20.5)],foe=unit(s,1,'melee',29.5,20.5);army[1].cooldown=0;s.resources.push({id:s.nextId++,kind:'wood',x:25.5,y:21.6,amount:100,maxAmount:100});refreshVisibility(s);const recorder=new MatchRecorder(s);issueCommand(s,0,{type:'formation',ids:army.map(e=>e.id),formation:'line',spacing:.8,facing:0});issueCommand(s,0,{type:'move',ids:army.map(e=>e.id),x:25.5,y:20.5});advance(s,4);issueCommand(s,0,{type:'ambush',ids:[army[1].id],radius:2,target:'any'});issueCommand(s,1,{type:'move',ids:[foe.id],x:26,y:20.5});advance(s,3);const archive=recorder.export(),player=new ReplayPlayer(archive);player.seek(s.tick);expect(replayChecksum(player.state)).toBe(replayChecksum(s));recorder.dispose();player.dispose();
 });
 it('rejects invalid command fields and malformed persistent tactical state',()=>{
  const s=fixture(),fighter=unit(s,0,'melee',24.5,24.5);expect(validateCommand({type:'formation',ids:[fighter.id],formation:'circle',spacing:1,facing:0})).toBe(false);expect(issueCommand(s,0,{type:'face',ids:[fighter.id],facing:8})).toBe(false);expect(validateCommand({type:'ambush',ids:[fighter.id],radius:11,target:'any'})).toBe(false);const saved=saveGame(s);saved.state.entities.find(e=>e.id===fighter.id)!.tactics!.morale=NaN;expect(()=>loadGame(saved)).toThrow(/finite/);
 });
});
