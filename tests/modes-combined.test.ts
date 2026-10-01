import {describe,expect,it} from 'vitest';
import {availableUnits,contentHash,createContentBundle,unitFor} from '../src/core/content-registry';
import {exampleMod} from '../src/core/example-mod';
import {createMatch,issueCommand,refreshVisibility,spawnEntity,stepGame} from '../src/core/simulation';
import {createDraft,draftPlayers,legalDraftChoices,normalizeMatchRules} from '../src/core/match-rules';
import {evaluateObjectives,objectiveAi,publicObjectives} from '../src/core/objectives';
import {loadGame,saveGame} from '../src/core/saves';
import {MatchRecorder,ReplayPlayer} from '../src/core/replays';
import {OnlineView} from '../src/server/views';
import {observationToRenderState} from '../src/online/render-state';
import {levelOf} from '../src/core/world-map';
import type {ContentBundle} from '../src/core/content-registry';
import type {GameState,MatchRulesInput} from '../src/core/types';

const bundle=()=>createContentBundle([exampleMod()]);
function match(rules:MatchRulesInput={},content=bundle()) {return createMatch({content,map:{seed:4127,size:'small',biome:'forest'},players:[{id:0,teamId:0,factionId:'lantern:keepers',controller:'external'},{id:1,teamId:1,factionId:'lantern:keepers',controller:'external'}],rules});}
const tick=(s:GameState,n=1)=>{for(let i=0;i<n;i++)stepGame(s,.05);};
const evaluate=(s:GameState)=>evaluateObjectives(s,{spawn:spawnEntity,command:issueCommand});
function clearWorld(s:GameState){s.resources=[];s.world!.sites=[];s.world!.creatures=[];for(const level of s.world!.levels){level.terrain.fill('grass');level.elevation.fill(0);}}
function finishDraft(s:GameState,choices:string[]){for(const definitionId of choices){const side=s.draft.order[s.draft.turn].side;expect(issueCommand(s,side,{type:'draftChoice',definitionId})).toBe(true);}expect(s.draft.status).toBe('complete');}
function extendedContent():ContentBundle {
 const mod=structuredClone(exampleMod()),faction=mod.factions[0],base=availableUnits({content:bundle(),players:[{faction:faction.id}]},0).find(unit=>unit.role==='worker')!;
 faction.units.push({...base,id:'lantern:porter',name:'Lantern Porter'},{...base,id:'lantern:miner',name:'Lantern Miner'});faction.defaultUnits={...faction.defaultUnits,worker:'lantern:porter'};
 const hall=faction.buildings[0];faction.buildings.push({...hall,id:'lantern:keep',name:'Wide Keep',role:'hq',size:6});faction.defaultBuildings={...faction.defaultBuildings,hq:'lantern:keep'};
 for(const id of ['lantern:porter','lantern:miner','lantern:keep'])mod.art[id]={...mod.art['lantern:sentinel']};
 const {hash:_hash,...body}=mod;mod.hash=contentHash(body);return createContentBundle([mod]);
}

describe('assembled modes with pinned content and layered maps',()=>{
 it('drafts two different melee definitions and restricts starters, paid production and custom research by ID',()=>{
  const s=match({startingResources:{wood:2000,ore:2000,crystal:200},draft:{enabled:true,banRounds:0,pickRounds:2}});clearWorld(s);
  expect(legalDraftChoices(s.draft,draftPlayers(s),0,s.content)).toContain('lantern:duelist');
  finishDraft(s,['lantern:duelist','lantern:sentinel','worker-speed','lantern:bright-blades']);
  expect(s.entities.find(e=>e.side===0&&e.role==='melee')!.definitionId).toBe('lantern:duelist');expect(s.entities.find(e=>e.side===1&&e.role==='melee')!.definitionId).toBe('lantern:sentinel');
  const hall=spawnEntity(s,0,'building','barracks',14,14,1,'lantern:hall',1);
  expect(issueCommand(s,0,{type:'train',id:hall.id,role:'melee',definitionId:'lantern:sentinel'})).toBe(false);expect(issueCommand(s,0,{type:'train',id:hall.id,role:'melee',definitionId:'lantern:duelist'})).toBe(true);expect(hall.queuePaidCosts).toEqual([{wood:55,ore:35,crystal:0}]);
  expect(issueCommand(s,0,{type:'research',id:hall.id,upgrade:'lantern:bright-blades'})).toBe(true);tick(s,220);expect(s.players[0].upgrades).toContain('lantern:bright-blades');expect(s.entities.filter(e=>e.definitionId==='lantern:duelist').some(e=>levelOf(e)===1)).toBe(true);
  expect(()=>normalizeMatchRules({disabledDefinitionIds:['foreign:unit']},s.content)).toThrow();expect(()=>normalizeMatchRules({disabledDefinitionIds:['lantern:duelist']})).toThrow();
 });
 it('exempts every admitted worker from draft picks while honoring explicit worker exclusions',()=>{
  const s=match({draft:{enabled:true,banRounds:0,pickRounds:1}},extendedContent());finishDraft(s,['lantern:duelist','lantern:sentinel']);const hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;
  expect(issueCommand(s,0,{type:'train',id:hq.id,role:'worker',definitionId:'lantern:miner'})).toBe(true);
  const excluded=match({disabledDefinitionIds:['lantern:miner'],draft:{enabled:true,banRounds:0,pickRounds:1}},extendedContent());finishDraft(excluded,['lantern:duelist','lantern:sentinel']);expect(issueCommand(excluded,0,{type:'train',id:excluded.entities.find(e=>e.side===0&&e.role==='hq')!.id,role:'worker',definitionId:'lantern:miner'})).toBe(false);
 });
 it('uses the only permitted custom combat definition for survival attackers',()=>{
  const content=bundle(),disabled=availableUnits({content,players:[{faction:'lantern:keepers'}]},0).filter(unit=>unit.role!=='worker'&&unit.id!=='lantern:duelist').map(unit=>unit.id),s=match({mode:'survival',disabledDefinitionIds:disabled,survival:{intervalTicks:20,unitsPerWave:2,waveCount:2}},content);tick(s,20);
  const attackers=s.entities.filter(e=>s.objectives.survival.spawnedIds.includes(e.id));expect(attackers).toHaveLength(2);expect(attackers.every(e=>e.definitionId==='lantern:duelist'&&unitFor(s,e).damage===24)).toBe(true);expect(loadGame(saveGame(s)).objectives).toEqual(s.objectives);
 });
 it('requires a shared level for hill capture and relic collection, delivery and shrine ownership',()=>{
  const hill=match({mode:'hill',hill:{captureTicks:2,holdTicks:100}});clearWorld(hill);const actor=hill.entities.find(e=>e.side===0&&e.role==='melee')!;actor.x=hill.objectives.hill.x;actor.y=hill.objectives.hill.y;actor.level=1;evaluate(hill);evaluate(hill);expect(hill.objectives.hill.ownerTeam).toBeNull();actor.level=0;evaluate(hill);evaluate(hill);expect(hill.objectives.hill.ownerTeam).toBe(0);
  const s=match({mode:'relic',relic:{count:1,required:1,holdTicks:1000}},extendedContent());clearWorld(s);const unit=s.entities.find(e=>e.side===0&&e.role==='melee')!,relic=s.objectives.relics[0],hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;unit.x=relic.x;unit.y=relic.y;unit.level=1;expect(issueCommand(s,0,{type:'collectRelic',id:unit.id,relicId:relic.id})).toBe(false);unit.level=0;expect(issueCommand(s,0,{type:'collectRelic',id:unit.id,relicId:relic.id})).toBe(true);
  unit.level=1;unit.x=hq.x+5.2;unit.y=hq.y;evaluate(s);expect(relic).toMatchObject({level:1,carrierId:unit.id,heldTeam:null});hq.level=1;evaluate(s);expect(relic).toMatchObject({carrierId:null,heldTeam:0});hq.level=0;evaluate(s);expect(relic.heldTeam).toBeNull();
 });
 it('updates carried, dropped and fallen relic levels and removes an unseen carrier’s full location',()=>{
  const s=match({mode:'relic',relic:{count:1,required:1,holdTicks:1000}});clearWorld(s);const unit=s.entities.find(e=>e.side===0&&e.role==='melee')!,relic=s.objectives.relics[0];unit.x=relic.x;unit.y=relic.y;expect(issueCommand(s,0,{type:'collectRelic',id:unit.id,relicId:relic.id})).toBe(true);unit.level=1;unit.x=20.5;unit.y=20.5;evaluate(s);refreshVisibility(s);
  const hidden=publicObjectives(s,1).relics[0];expect(hidden).toMatchObject({x:null,y:null,carrierId:null});expect('level' in hidden).toBe(false);expect(publicObjectives(s,0).relics[0]).toMatchObject({level:1,carrierId:unit.id});
  const render=observationToRenderState(new OnlineView(1).observe(s));expect(render.state.rules.mode).toBe('relic');expect(render.objectiveView.objectives.relics[0]).toEqual(hidden);expect('objectives' in render.state).toBe(false);
  expect(issueCommand(s,0,{type:'dropRelic',id:unit.id})).toBe(true);expect(relic).toMatchObject({level:1,carrierId:null});expect(issueCommand(s,0,{type:'collectRelic',id:unit.id,relicId:relic.id})).toBe(true);unit.level=0;unit.hp=0;evaluate(s);expect(relic).toMatchObject({level:0,carrierId:null});
 });
 it('uses real portal traversal for AI objective orders across levels',()=>{
  const s=match({mode:'hill',hill:{captureTicks:2,holdTicks:1000}});clearWorld(s);const actor=s.entities.find(e=>e.side===0&&e.role==='melee')!,transition=s.world!.transitions[0];actor.x=transition.to.x;actor.y=transition.to.y;actor.level=transition.to.level;refreshVisibility(s);objectiveAi(s,0,issueCommand);expect(actor.order).toEqual({type:'traverse',transition:transition.id});tick(s,30);expect(levelOf(actor)).toBe(0);objectiveAi(s,0,issueCommand);expect(actor.order).toMatchObject({type:'attackMove',level:0});
 });
 it('delivers AI relic carriers to admitted small headquarters through normal movement',()=>{
  const mod=structuredClone(exampleMod()),faction=mod.factions[0];faction.buildings.push({...faction.buildings[0],id:'lantern:hut',name:'Small Keep',role:'hq',size:1});faction.defaultBuildings={...faction.defaultBuildings,hq:'lantern:hut'};mod.art['lantern:hut']={...mod.art['lantern:hall']};const {hash:_hash,...body}=mod;mod.hash=contentHash(body);
  const s=match({mode:'relic',relic:{count:1,required:1,holdTicks:1000}},createContentBundle([mod]));clearWorld(s);const carrier=s.entities.find(e=>e.side===0&&e.role==='melee')!,hq=s.entities.find(e=>e.side===0&&e.role==='hq')!,relic=s.objectives.relics[0];carrier.x=hq.x;carrier.y=hq.y+8;relic.x=carrier.x;relic.y=carrier.y;refreshVisibility(s);expect(issueCommand(s,0,{type:'collectRelic',id:carrier.id,relicId:relic.id})).toBe(true);
  for(let i=0;i<500&&relic.heldTeam===null;i++){if(i%20===0)objectiveAi(s,0,issueCommand);tick(s);}expect(relic.heldTeam).toBe(0);
 });
 it('applies custom draft and exclusion restrictions to village recruitment before assigning an order',()=>{
  for(const rules of [{disabledDefinitionIds:['lantern:sentinel']},{draft:{enabled:true,banRounds:0,pickRounds:1}}] as MatchRulesInput[]){const s=match(rules);if(s.draft.status==='drafting')finishDraft(s,['lantern:duelist','lantern:duelist']);const actor=s.entities.find(e=>e.side===0&&e.kind==='unit'&&e.role!=='worker')!,site=s.world!.sites.find(site=>site.kind==='village')!;s.world!.creatures=[];for(const entry of s.world!.sites)entry.creatureIds=[];site.owner=0;site.loyalty[0]=60;site.supplied=true;site.reward={wood:100,ore:100,crystal:0};actor.x=site.x+1.7;actor.y=site.y;actor.level=site.level;refreshVisibility(s);
   expect(issueCommand(s,0,{type:'recruitVillage',ids:[actor.id],target:site.id})).toBe(false);expect(site.reward).toEqual({wood:100,ore:100,crystal:0});tick(s);expect(s.entities.some(e=>e.definitionId==='lantern:sentinel'&&e.side===0)).toBe(false);
  }
 });
 it('continues complete world/content/objective saves and paid queues at every tick and replays the endpoint',()=>{
  const s=match({mode:'relic',relic:{count:1,required:1,holdTicks:1000}});clearWorld(s);const hall=spawnEntity(s,0,'building','barracks',14,14,1,'lantern:hall',1),recorder=new MatchRecorder(s);expect(issueCommand(s,0,{type:'train',id:hall.id,role:'melee',definitionId:'lantern:duelist'})).toBe(true);tick(s,30);const resumed=loadGame(saveGame(s));
  for(let i=0;i<130;i++){tick(s);tick(resumed);expect(saveGame(resumed)).toEqual(saveGame(s));}expect(s.entities.some(e=>e.definitionId==='lantern:duelist'&&levelOf(e)===1)).toBe(true);const replay=new ReplayPlayer(recorder.export());replay.seek(s.tick);expect(saveGame(replay.state)).toEqual(saveGame(s));recorder.dispose();replay.dispose();
 });
 it('keeps legacy individual vision and rejects partial mode groups and impossible objective levels',()=>{
  const s=match({sharedVision:false}),old=saveGame(s);delete (old.state as unknown as Partial<GameState>).rules;delete (old.state as unknown as Partial<GameState>).objectives;delete (old.state as unknown as Partial<GameState>).draft;const restored=loadGame(old);expect(restored.rules.sharedVision).toBe(false);expect(restored.sharedVision).toBe(false);expect(restored.world!.levels[0].terrain).toBe(restored.terrain);
  const relic=match({mode:'relic',relic:{count:1,required:1}}),invalid=saveGame(relic);invalid.state.objectives.relics[0].level=2;expect(()=>loadGame(invalid)).toThrow(/level/);const partial=saveGame(relic);delete (partial.state as unknown as Partial<GameState>).draft;expect(()=>loadGame(partial)).toThrow(/stored together/);
 });
 it('rejects loaded survival rosters with no opposing combat definition or wave team',()=>{
  const s=match({mode:'survival'});s.rules.disabledDefinitionIds=availableUnits(s,1).filter(unit=>unit.role!=='worker').map(unit=>unit.id);s.draft=createDraft(draftPlayers(s),s.rules,s.content);expect(()=>loadGame(saveGame(s))).toThrow(/enabled combat/);
  const oneTeam=match({mode:'survival'});oneTeam.teams=[0,0];expect(()=>loadGame(saveGame(oneTeam))).toThrow(/opposing wave team/);
 });
 it('raises the permitted alternative melee definition instead of a banned default',()=>{
  const mod=structuredClone(exampleMod());mod.factions[0].units.find(unit=>unit.id==='lantern:duelist')!.ability='raise';const {hash:_hash,...body}=mod;mod.hash=contentHash(body);
  for(const rules of [{disabledDefinitionIds:['lantern:sentinel']},{draft:{enabled:true,banRounds:0,pickRounds:1}}] as MatchRulesInput[]){const s=match(rules,createContentBundle([mod]));clearWorld(s);if(s.draft.status==='drafting')finishDraft(s,['lantern:duelist','lantern:duelist']);const caster=s.entities.find(e=>e.definitionId==='lantern:duelist'&&e.side===0)??spawnEntity(s,0,'unit','melee',10,10,1,'lantern:duelist',0);s.corpses.push({id:s.nextId++,x:caster.x+.8,y:caster.y,level:levelOf(caster),expires:s.time+45});refreshVisibility(s);expect(issueCommand(s,0,{type:'ability',ids:[caster.id]})).toBe(true);const raised=s.entities.find(e=>e.raised)!;expect(raised.definitionId).toBe('lantern:duelist');expect(unitFor(s,raised).damage).toBe(24);expect(loadGame(saveGame(s)).entities.find(e=>e.id===raised.id)!.definitionId).toBe('lantern:duelist');}
 });
});
