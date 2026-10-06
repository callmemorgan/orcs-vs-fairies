import { expect, it } from 'vitest';
import { createGame, issueCommand, stepGame } from '../src/core/simulation';
import { effectiveUnitStats, researchBranchesValid, researchRequirement, upgradeEffects } from '../src/core/progression';
import { ECONOMY, FACTIONS, UPGRADES } from '../src/core/content';
import type { GameState } from '../src/core/types';
function setup(){
 const s=createGame('orcs',4127,'fairies',{controllers:['external','external'],improvements:{'feature-042':true}});
 Object.assign(s.players[0],{wood:3000,ore:3000,crystal:300,upgrades:['town-age']});
 const hq=s.entities[0],a={...hq,id:s.nextId++,role:'barracks' as const,queue:[],path:[],x:20,y:20},b={...a,id:s.nextId++,queue:[],path:[],x:24};s.entities.push(a,b);return {s,hq,a,b};
}
it('reserves a branch at start across buildings, death and JSON state resumption',()=>{
 const {s,a,b}=setup();
 expect(issueCommand(s,0,{type:'research',id:a.id,upgrade:'rapid-assault'})).toBe(true);
 const wood=s.players[0].wood;
 expect(issueCommand(s,0,{type:'research',id:b.id,upgrade:'fortified-ranks'})).toBe(false);
 expect(s.players[0].wood).toBe(wood);a.hp=0;
 const raw=JSON.parse(JSON.stringify({...s,visible:s.visible.map(v=>[...v]),explored:s.explored.map(v=>[...v])}));
 raw.visible=raw.visible.map((v:number[])=>new Set(v));raw.explored=raw.explored.map((v:number[])=>new Set(v));const restored=raw as GameState;
 expect(researchRequirement(restored,0,'fortified-ranks')).toBe('Excluded by Rapid Assault');
 expect(issueCommand(restored,0,{type:'research',id:b.id,upgrade:'fortified-ranks'})).toBe(false);
 expect(issueCommand(restored,0,{type:'research',id:b.id,upgrade:'rapid-assault'})).toBe(true);
 for(let i=0;i<UPGRADES['rapid-assault'].researchTime*20+2;i++)stepGame(restored,.05);
 expect(restored.players[0].upgrades).toContain('rapid-assault');
 expect(issueCommand(restored,0,{type:'research',id:b.id,upgrade:'fortified-ranks'})).toBe(false);
});
it('rejects the opposite branch when legacy completed or in-flight research has no choice record',()=>{
 const {s,a,b}=setup();a.research='fortified-ranks';
 expect(issueCommand(s,0,{type:'research',id:b.id,upgrade:'rapid-assault'})).toBe(false);
 a.research=undefined;s.players[0].upgrades.push('fortified-ranks');
 expect(issueCommand(s,0,{type:'research',id:b.id,upgrade:'rapid-assault'})).toBe(false);
});
it.each([['rapid-assault',{damage:1.15,speed:1.2,armor:-1}],['fortified-ranks',{damage:1,speed:.85,armor:2}]] as const)('%s changes all military roles with a numeric drawback',(id,expected)=>{
 const {s}=setup();const before=effectiveUnitStats(s.players[0],'spear');s.players[0].upgrades.push(id);
 for(const role of ['melee','ranged','spear','cavalry','special','siege'] as const)expect(upgradeEffects(s.players[0],role)).toEqual({gather:1,...expected});
 expect(effectiveUnitStats(s.players[0],'spear').damage).toBeCloseTo(before.damage*expected.damage);
 expect(upgradeEffects(s.players[0],'worker')).toEqual({damage:1,armor:0,speed:1,gather:1});
});
it('economic branches apply gathering tradeoffs in simulation and exclude the alternative',()=>{
 const {s,hq}=setup();expect(issueCommand(s,0,{type:'research',id:hq.id,upgrade:'bulk-harvest'})).toBe(true);
 for(let i=0;i<UPGRADES['bulk-harvest'].researchTime*20+2;i++)stepGame(s,.05);
 expect(issueCommand(s,0,{type:'research',id:hq.id,upgrade:'swift-haul'})).toBe(false);
 const worker=s.entities.find(e=>e.side===0&&e.role==='worker')!,node=s.resources.find(n=>n.kind==='wood')!;
 worker.x=node.x;worker.y=node.y;worker.carried=0;worker.order={type:'gather',target:node.id};
 stepGame(s,.25);expect(worker.carried).toBeCloseTo(.25*ECONOMY.harvestPerSecond*1.25);
 expect(effectiveUnitStats(s.players[0],'worker').speed).toBeCloseTo(FACTIONS.orcs.units.worker.speed*.85);
});

it('rejects contradictory or forged branch choices in saved game data',()=>{
 const {s,a}=setup();
 s.players[0].upgrades.push('rapid-assault');expect(researchBranchesValid(s)).toBe(true);
 a.research='fortified-ranks';expect(researchBranchesValid(s)).toBe(false);
 a.research=undefined;s.players[0].researchChoices={'military-doctrine':'bulk-harvest'};expect(researchBranchesValid(s)).toBe(false);
});
