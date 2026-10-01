import {describe,it,expect} from 'vitest';
import {FACTIONS} from '../src/core/content';
import {createMatch,issueCommand,stepGame,spawnEntity,refreshVisibility} from '../src/core/simulation';
import {loadGame,saveGame} from '../src/core/saves';
import {draftPlayers,legalDraftChoices,normalizeMatchRules} from '../src/core/match-rules';
import {PlayerView} from '../src/core/observation';
import type {GameState,MatchRulesInput,Side} from '../src/core/types';
function match(rules:MatchRulesInput={},teams:Side[]=[0,1]){return createMatch({map:{seed:4127,size:'small'},players:teams.map((teamId,id)=>({id:id as Side,teamId,factionId:id%2?'fairies' as const:'orcs' as const,controller:'external' as const})),rules});}
function tick(state:GameState,count:number){for(let i=0;i<count&&!state.draw&&state.winner===null;i++)stepGame(state,.05);}
function move(state:GameState,side:Side,id:number,x:number,y:number){expect(issueCommand(state,side,{type:'move',ids:[id],x,y})).toBe(true);const assigned=state.entities.find(e=>e.id===id)!.order;if(assigned.type!=='move')throw new Error('Movement order missing');const destination={x:assigned.x,y:assigned.y};for(let i=0;i<2000;i++){const unit=state.entities.find(e=>e.id===id)!;if(Math.hypot(unit.x-destination.x,unit.y-destination.y)<.7)return;stepGame(state,.05);}throw new Error(`Move never reached its destination: ${JSON.stringify({destination,unit:state.entities.find(e=>e.id===id)})}`);}

describe('saved match rules and objectives',()=>{
 it('applies declared age/resources and rejects disabled recruits/research without spending',()=>{
  const state=match({startingAge:3,startingResources:{wood:950,ore:800,crystal:90},disabledDefinitionIds:['worker-harvest',FACTIONS.orcs.units.worker.id]});const hq=state.entities.find(e=>e.side===0&&e.role==='hq')!;
  expect(state.players[0]).toMatchObject({wood:950,ore:800,crystal:90,upgrades:['town-age','citadel-age']});
  expect(issueCommand(state,0,{type:'train',id:hq.id,role:'worker'})).toBe(false);expect(issueCommand(state,0,{type:'research',id:hq.id,upgrade:'worker-harvest'})).toBe(false);expect(state.players[0].wood).toBe(950);
  expect(()=>normalizeMatchRules({disabledDefinitionIds:['foreign-missing']})).toThrow();expect(()=>normalizeMatchRules({relic:{count:1,required:2}})).toThrow();
 });
 it('lets scenario rules replace headquarters defeat and permits commands without a stronghold',()=>{
  const state=match({mode:'scenario',standardDefeat:false});for(const hq of state.entities.filter(e=>e.role==='hq'))hq.hp=0;tick(state,5);
  expect(state.draw).toBe(false);expect(state.winner).toBeNull();expect(state.eliminated).toEqual([false,false]);const unit=state.entities.find(e=>e.side===0&&e.role==='worker')!;expect(issueCommand(state,0,{type:'move',ids:[unit.id],x:12,y:12})).toBe(true);
  expect(loadGame(saveGame(state)).rules.standardDefeat).toBe(false);
 });
 it('captures the hill by team, resets contested defense, and wins with opposing headquarters alive',()=>{
  const state=match({mode:'hill',hill:{captureTicks:3,holdTicks:80}},[0,0,1,1]),hill=state.objectives.hill;
  const ally=spawnEntity(state,1,'unit','melee',hill.x,hill.y);expect(issueCommand(state,1,{type:'hold',ids:[ally.id]})).toBe(true);tick(state,5);expect(hill.ownerTeam).toBe(0);expect(hill.holdTicks).toBe(2);
  const enemy=spawnEntity(state,3,'unit','melee',hill.x+3,hill.y);tick(state,1);expect(hill.contested).toBe(true);expect(hill.holdTicks).toBe(0);
  move(state,3,enemy.id,hill.x+6,hill.y);expect(issueCommand(state,3,{type:'hold',ids:[enemy.id]})).toBe(true);tick(state,80);expect(state.winningTeam,JSON.stringify({hill,units:state.entities.filter(e=>e.kind==='unit'&&e.role!=='worker')})).toBe(0);expect(state.winner).toBe(0);expect(state.entities.filter(e=>e.role==='hq'&&e.hp>0)).toHaveLength(4);
 });
 it('delivers, steals, interrupts and recovers a relic through ordinary movement and collection commands',()=>{
  const state=match({mode:'relic',relic:{count:1,required:1,holdTicks:1000}}),relic=state.objectives.relics[0],hq=state.entities.find(e=>e.side===0&&e.role==='hq')!;
  const carrier=state.entities.find(e=>e.side===0&&e.role==='melee')!;move(state,0,carrier.id,relic.x,relic.y);expect(issueCommand(state,0,{type:'collectRelic',id:carrier.id,relicId:relic.id})).toBe(true);move(state,0,carrier.id,hq.x,hq.y+2.8);tick(state,1);expect(relic.heldTeam,JSON.stringify({carrier:carrier,hq})).toBe(0);
  const before=state.objectives.relicHoldTicks[0];expect(before).toBeGreaterThan(0);for(const unit of state.entities.filter(e=>e.side===0&&e.kind==='unit')){move(state,0,unit.id,hq.x-4,hq.y+6);issueCommand(state,0,{type:'hold',ids:[unit.id]});}const raider=spawnEntity(state,1,'unit','cavalry',relic.x+1,relic.y);refreshVisibility(state);
  expect(issueCommand(state,1,{type:'collectRelic',id:raider.id,relicId:relic.id})).toBe(true);tick(state,1);expect(state.objectives.relicHoldTicks[0]).toBe(0);
  expect(issueCommand(state,1,{type:'dropRelic',id:raider.id})).toBe(true);move(state,1,raider.id,hq.x+10,hq.y+6);expect(issueCommand(state,1,{type:'hold',ids:[raider.id]})).toBe(true);move(state,0,carrier.id,relic.x,relic.y);expect(issueCommand(state,0,{type:'collectRelic',id:carrier.id,relicId:relic.id})).toBe(true);move(state,0,carrier.id,hq.x,hq.y+2.8);tick(state,1);expect(relic.heldTeam).toBe(0);tick(state,1000);expect(state.winningTeam).toBe(0);expect(state.entities.some(e=>e.side===1&&e.role==='hq'&&e.hp>0)).toBe(true);
 });
 it('drops a killed carrier at its final position and hides an unseen hostile carrier',()=>{
  const state=match({mode:'relic',relic:{count:1,required:1}}),relic=state.objectives.relics[0],carrier=spawnEntity(state,1,'unit','melee',relic.x,relic.y);
  expect(issueCommand(state,1,{type:'collectRelic',id:carrier.id,relicId:1})).toBe(true);carrier.x=state.width-3;carrier.y=state.height-3;tick(state,1);refreshVisibility(state);
  const observed=new PlayerView(0).observe(state).objectives.relics[0];expect(observed.x).toBeNull();expect(observed.y).toBeNull();expect(observed.carrierId).toBeNull();carrier.hp=0;tick(state,1);expect(relic.carrierId).toBeNull();expect(relic.x).toBe(carrier.x);
 });
 it('continues contested hill/relic/survival state and draft timers identically after saving',()=>{
  for(const mode of ['hill','relic','survival'] as const){const original=match({mode,survival:{intervalTicks:20,waveCount:2,recoveryTicks:5,unitsPerWave:1}});tick(original,25);const restored=loadGame(saveGame(original));for(let i=0;i<50;i++){tick(original,1);tick(restored,1);expect(saveGame(restored)).toEqual(saveGame(original));}}
  const draft=match({draft:{enabled:true,turnTicks:20,banRounds:0,pickRounds:1}});tick(draft,10);const resumed=loadGame(saveGame(draft));tick(draft,40);tick(resumed,40);expect(saveGame(resumed)).toEqual(saveGame(draft));
 });
 it('plays increasing real waves and returns survival failure when the last defender headquarters dies',()=>{
  const state=match({mode:'survival',survival:{intervalTicks:20,waveCount:3,recoveryTicks:5,unitsPerWave:1}});tick(state,20);expect(state.objectives.survival.phase).toBe('fighting');expect(state.objectives.survival.spawnedIds).toHaveLength(1);expect(state.entities.some(e=>e.side===1&&e.role==='hq')).toBe(false);
  const hq=state.entities.find(e=>e.side===0&&e.role==='hq')!;hq.hp=0;tick(state,1);expect(state.winningTeam).toBe(1);expect(state.objectives.survival.phase).toBe('complete');
 });
 it('rejects wrong turns/duplicates and makes completed picks control actual starting army and recruitment',()=>{
  const state=match({startingAge:3,startingResources:{wood:3000,ore:2000,crystal:500},draft:{enabled:true,banRounds:1,pickRounds:2,turnTicks:20}}),players=draftPlayers(state);
  expect(issueCommand(state,1,{type:'draftChoice',definitionId:state.draft.pool[0]})).toBe(false);
  const banned=FACTIONS.orcs.units.siege.id;expect(issueCommand(state,0,{type:'draftChoice',definitionId:banned})).toBe(true);expect(issueCommand(state,1,{type:'draftChoice',definitionId:banned})).toBe(false);
  expect(issueCommand(state,1,{type:'draftChoice',definitionId:'veteran-arms'})).toBe(true);
  expect(issueCommand(state,0,{type:'draftChoice',definitionId:FACTIONS.orcs.units.ranged.id})).toBe(true);expect(issueCommand(state,1,{type:'draftChoice',definitionId:FACTIONS.fairies.units.melee.id})).toBe(true);
  expect(issueCommand(state,1,{type:'draftChoice',definitionId:FACTIONS.fairies.units.melee.id})).toBe(false);expect(issueCommand(state,1,{type:'draftChoice',definitionId:'worker-harvest'})).toBe(true);expect(issueCommand(state,0,{type:'draftChoice',definitionId:'worker-speed'})).toBe(true);
  expect(state.draft.status).toBe('complete');expect(state.entities.filter(e=>e.side===0&&e.kind==='unit'&&e.role!=='worker').map(e=>e.role)).toEqual(['ranged']);
  const barracks=spawnEntity(state,0,'building','barracks',12,8);expect(issueCommand(state,0,{type:'train',id:barracks.id,role:'melee'})).toBe(false);expect(issueCommand(state,0,{type:'train',id:barracks.id,role:'siege'})).toBe(false);expect(issueCommand(state,0,{type:'train',id:barracks.id,role:'ranged'})).toBe(true);expect(issueCommand(state,0,{type:'research',id:barracks.id,upgrade:'forged-weapons'})).toBe(false);
  expect(legalDraftChoices(state.draft,players,0)).not.toContain(banned);expect(loadGame(saveGame(state)).draft).toEqual(state.draft);
 });
 it('rejects malformed save rule groups, absent carriers and impossible draft histories',()=>{
  const state=match({mode:'relic',relic:{count:1,required:1}}),save=saveGame(state);const partial=structuredClone(save);delete (partial.state as unknown as Partial<GameState>).draft;expect(()=>loadGame(partial)).toThrow(/stored together/);
  const badCarrier=structuredClone(save);badCarrier.state.objectives.relics[0].carrierId=9999;expect(()=>loadGame(badCarrier)).toThrow();
  const badDraft=structuredClone(save);badDraft.state.draft.turn=1;expect(()=>loadGame(badDraft)).toThrow();
 });
});
