import { describe, expect, it } from 'vitest';
import { createMatch, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import { economicState } from '../src/core/economy';
import { cancelCargoTask } from '../src/core/economy-cargo';
import { loadGame, saveGame } from '../src/core/saves';

function fixture() {
 const s=createMatch({map:{seed:4127,size:'small'},players:[{id:0,teamId:0,factionId:'orcs',controller:'external',handicap:{startingResources:{wood:5000,ore:5000,crystal:500}}},{id:1,teamId:1,factionId:'fairies',controller:'external'}]});
 s.terrain.fill('grass');s.resources=[];refreshVisibility(s);
 const worker=s.entities.find(entity=>entity.side===0&&entity.role==='worker')!,hq=s.entities.find(entity=>entity.side===0&&entity.role==='hq')!,economy=economicState(s)!;
 return {s,worker,hq,economy,point:{x:hq.x+5,y:hq.y+2}};
}
const run=(s:ReturnType<typeof fixture>['s'],seconds:number)=>{for(let index=0;index<Math.round(seconds*20);index++)stepGame(s,.05);};

describe('planting cancellation through cargo commands and combat',()=>{
 it('replacing a partly completed planting job releases its site and preserves the spending',()=>{
  const {s,worker,economy,point}=fixture(),wood=s.players[0].wood;
  expect(issueCommand(s,0,{type:'plantGrove',ids:[worker.id],...point})).toBe(true);
  for(let index=0;index<200&&economy.tasks[0].progress===0;index++)stepGame(s,.05);
  const grove=economy.groves[0];expect(economy.tasks[0].progress).toBeGreaterThan(0);expect(economy.tasks[0].progress).toBeLessThan(1);
  const pile={id:s.nextId++,x:worker.x,y:worker.y,stock:{wood:5,ore:0,crystal:0},expiresAt:s.time+120,owner:null,kind:'salvage' as const};economy.salvage.push(pile);
  expect(issueCommand(s,0,{type:'collectSalvage',ids:[worker.id],target:pile.id})).toBe(true);
  expect(grove.burned).toBe(true);expect(economy.tasks.some(task=>task.kind==='plant'&&task.targetId===grove.id)).toBe(false);expect(s.players[0].wood).toBe(wood-8);
  expect(issueCommand(s,0,{type:'plantGrove',ids:[worker.id],...point})).toBe(true);expect(economy.groves[1].burned).toBe(false);
  run(s,70);expect(grove.resourceId).toBeUndefined();expect(economy.groves[1].resourceId).toBeDefined();expect(loadGame(saveGame(s)).economy).toEqual(s.economy);
 });
 it('a killed planter leaves no unfinished grove blocking future planting or save restoration',()=>{
  const {s,worker,economy,point}=fixture();
  const enemy=s.entities.find(entity=>entity.side===1&&entity.role==='melee')!;
  enemy.x=worker.x+1;enemy.y=worker.y;worker.hp=1;refreshVisibility(s);
  expect(issueCommand(s,0,{type:'plantGrove',ids:[worker.id],...point})).toBe(true);
  expect(issueCommand(s,1,{type:'attack',ids:[enemy.id],target:worker.id})).toBe(true);run(s,.05);
  expect(worker.hp).toBe(0);expect(economy.groves[0].burned).toBe(true);expect(economy.tasks.some(task=>task.entityId===worker.id)).toBe(false);
  run(s,2);expect(s.entities.some(entity=>entity.id===worker.id)).toBe(false);expect(loadGame(saveGame(s)).economy).toEqual(s.economy);
 });
 it('a planted grove still matures after the planter dies',()=>{
  const {s,worker,economy,point}=fixture();
  expect(issueCommand(s,0,{type:'plantGrove',ids:[worker.id],...point})).toBe(true);run(s,10);
  const grove=economy.groves[0];expect(grove.plantedAt).toBeGreaterThan(0);expect(grove.resourceId).toBeUndefined();
  const enemy=s.entities.find(entity=>entity.side===1&&entity.role==='melee')!;
  enemy.x=worker.x+1;enemy.y=worker.y;worker.hp=1;refreshVisibility(s);
  expect(issueCommand(s,1,{type:'attack',ids:[enemy.id],target:worker.id})).toBe(true);run(s,.05);expect(worker.hp).toBe(0);
  run(s,70);expect(grove.burned).toBe(false);expect(s.resources.find(resource=>resource.id===grove.resourceId)?.amount).toBe(100);
 });
 it('explicit job cancellation leaves loaded physical cargo intact',()=>{
  const {s,worker,economy,point}=fixture();
  economy.cargo.push({entityId:worker.id,stock:{wood:7,ore:0,crystal:0},capacity:18,origin:'salvage',tradeValue:0});
  expect(issueCommand(s,0,{type:'plantGrove',ids:[worker.id],...point})).toBe(true);cancelCargoTask(worker,economy);
  expect(economy.groves[0].burned).toBe(true);expect(economy.tasks).toHaveLength(0);expect(economy.cargo[0].stock.wood).toBe(7);
 });
});
