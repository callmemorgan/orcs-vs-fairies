import { describe,expect,it } from 'vitest';
import { createContentBundle,unitFor } from '../src/core/content-registry';
import { exampleMod } from '../src/core/example-mod';
import { createMatch,issueCommand,refreshVisibility,stepGame } from '../src/core/simulation';
import { addBlueprint,assignBlueprintWorkers,createConstructionPlan,decodeConstructionPlan,executeBlueprints,applyWorkerTargets } from '../src/core/planning';
import { loadGame,saveGame } from '../src/core/saves';
import { replayChecksum } from '../src/core/replays';
import { OnlineView } from '../src/server/views';
import { observationToRenderState } from '../src/online/render-state';
import { fogKey } from '../src/core/world-map';
const match=()=>createMatch({content:createContentBundle([exampleMod()]),map:{seed:4127,size:'small',biome:'forest'},players:[{id:0,teamId:0,factionId:'lantern:keepers',controller:'human'},{id:1,teamId:1,factionId:'orcs',controller:'external'}]});
const advance=(s:ReturnType<typeof match>,n:number)=>{for(let i=0;i<n;i++)stepGame(s,.05);};
describe('assembled content and layered world contracts',()=>{
 it('builds and produces paid custom definitions in the cavern with exact save continuation',()=>{
  const s=match(),worker=s.entities.find(e=>e.side===0&&e.role==='worker')!;
  worker.x=8.5;worker.y=8.5;worker.level=1;s.resources=s.resources.filter(r=>r.level!==1);s.world!.levels[1].terrain.fill('grass');s.world!.levels[1].elevation.fill(0);s.world!.sites=[];s.world!.creatures=[];refreshVisibility(s);
  const plan=createConstructionPlan(0),item=addBlueprint(s,0,plan,{role:'barracks',x:9.5,y:9.5,level:1});expect(assignBlueprintWorkers(s,0,plan,item.id,[worker.id])).toBe(true);expect(executeBlueprints(s,0,plan).started).toEqual([item.id]);
  advance(s,800);const hall=s.entities.find(e=>e.id===item.buildingId)!;expect(hall).toMatchObject({level:1,definitionId:'lantern:hall',progress:1});
  expect(issueCommand(s,0,{type:'train',id:hall.id,role:'melee',definitionId:'lantern:duelist'})).toBe(true);expect(hall.queueDefinitionIds).toEqual(['lantern:duelist']);expect(hall.queuePaidCosts).toEqual([{wood:55,ore:35,crystal:0}]);
  const restored=loadGame(saveGame(s));advance(s,200);advance(restored,200);expect(replayChecksum(restored)).toBe(replayChecksum(s));expect(s.entities.find(e=>e.definitionId==='lantern:duelist')).toMatchObject({level:1});expect(decodeConstructionPlan({...plan,blueprints:[{...item,status:'complete'}]},s,0)?.blueprints[0].level).toBe(1);
 });
 it('allocates real cavern workers only to same-level harvesting and delivery',()=>{
  const s=match(),worker=s.entities.find(e=>e.side===0&&e.role==='worker')!,hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;
  for(const e of s.entities)if(e.side===0&&e.kind==='unit'&&e!==worker)e.hp=0;
  worker.x=8.5;worker.y=8.5;worker.level=1;hq.x=5;hq.y=5;hq.level=1;s.world!.levels[1].terrain.fill('grass');s.world!.levels[1].elevation.fill(0);s.world!.sites=[];s.world!.creatures=[];
  s.resources=[{id:s.nextId++,x:10.5,y:8.5,level:1,kind:'wood',amount:200,maxAmount:200},{id:s.nextId++,x:8.5,y:8.5,level:0,kind:'wood',amount:200,maxAmount:200}];refreshVisibility(s);
  const before=s.players[0].wood;expect(applyWorkerTargets(s,0,{wood:1,ore:0,crystal:0}).issued[0].resource).toBe(s.resources[0].id);advance(s,900);expect(s.players[0].wood).toBeGreaterThan(before);expect(s.resources[1].amount).toBe(200);
 });
 it('uses custom neutral recruitment costs and preserves custom defender levels',()=>{
  const s=match(),site=s.world!.sites.find(e=>e.kind==='village')!,actor=s.entities.find(e=>e.side===0&&e.role==='melee')!;
  s.world!.creatures=[];for(const site of s.world!.sites)site.creatureIds=[];actor.x=site.x+1.7;actor.y=site.y;actor.level=site.level;site.owner=0;site.loyalty[0]=60;site.supplied=true;site.reward={wood:65,ore:25,crystal:0};refreshVisibility(s);
  expect(issueCommand(s,0,{type:'recruitVillage',ids:[actor.id],target:site.id})).toBe(true);stepGame(s,.05);
  const recruit=s.entities.find(e=>e.side===0&&e.definitionId==='lantern:sentinel'&&e.id!==actor.id)!;expect(recruit.level).toBe(1);expect(unitFor(s,recruit).cost).toEqual({wood:65,ore:25,crystal:0});expect(site.reward).toEqual({wood:0,ore:0,crystal:0});
 });
 it('keeps remote levels and world observations while withholding hidden terrain and schedule',()=>{
  const s=match(),actor=s.entities.find(e=>e.side===0&&e.role==='melee')!,enemy=s.entities.find(e=>e.side===1&&e.kind==='unit')!;actor.x=30;actor.y=30;actor.level=1;enemy.x=30;enemy.y=30;enemy.level=0;s.world!.levels[1].terrain.fill('grass');s.world!.levels[1].elevation.fill(0);refreshVisibility(s);
  const observed=new OnlineView(0).observe(s),render=observationToRenderState(observed);
  expect(render.state.entities.find(e=>e.id===actor.id)?.level).toBe(1);expect(render.state.entities.find(e=>e.id===enemy.id)).toBeUndefined();expect(render.state.world!.levels[1].terrain).toHaveLength(s.width*s.height);expect(render.state.world!.nextEnvironmentAt).toBe(0);expect(render.state.seed).toBe(0);expect(render.worldPhase).toEqual(observed.world!.phase);
  const unseen=observed.world!.levels[1].terrain.findIndex(tile=>tile===null);expect(render.unknownTerrain.has(s.width*s.height+unseen)).toBe(true);expect(render.state.world!.levels[1].terrain[unseen]).toBe('rock');expect(render.state.visible[0].has(fogKey(s,actor))).toBe(true);
 });
});
