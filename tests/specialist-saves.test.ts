import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { contentHash, createContentBundle } from '../src/core/content-registry';
import { exampleMod } from '../src/core/example-mod';
import { loadGame, saveGame } from '../src/core/saves';
import { MatchRecorder, ReplayPlayer } from '../src/core/replays';
import { createGame, createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import { createArtifact, creditCombat, equipArtifact, promote, recoverArtifact } from '../src/core/unit-progression';
import type { GameState } from '../src/core/types';
import type { SiegeAbility } from '../src/core/specialist-types';

function fixture():GameState {
 const s=createGame('orcs',4127,'fairies',{controllers:['external','external']});s.time=12;s.terrain.fill('grass');
 const hero=spawnDefinition(s,0,'unit','core:orcs-commander',22,20),victim=s.entities.find(e=>e.side===1&&e.role==='worker')!;
 for(let i=0;i<4;i++)creditCombat(s,hero,victim,100);
 expect(promote(s,0,hero.id,'bulwark')).toBe(true);expect(promote(s,0,hero.id,'bulwark')).toBe(true);
 refreshVisibility(s);
 for(const id of ['core:ember-blade','core:iron-aegis','core:wind-charm'] as const){const item=createArtifact(s,id,hero);expect(recoverArtifact(s,0,hero.id,item.id)).toBe(true);expect(equipArtifact(s,0,hero.id,item.id)).toBe(true);}
 const ground=createArtifact(s,'core:iron-aegis',{x:10,y:10});Object.assign(ground.position!,{level:2});
 hero.specialistBuffs=[{until:20,damageFactor:1.25},{until:15,fearedFrom:{x:21,y:20}}];
 victim.burning=[{source:hero.id,side:0,until:18,nextAt:13,damage:5}];
 const beacon=spawnDefinition(s,0,'building','core:orcs-beacon',25,20);beacon.beacon={connected:true,nextAlertAt:20};
 const barricade=spawnDefinition(s,0,'building','core:field-barricade',28,20);
 s.specialists!.structures=[{id:1,kind:'barricade',owner:0,expires:72,entityId:barricade.id},{id:2,kind:'bridge',owner:0,expires:72,tiles:[30.5,31.5,32.5].map(x=>({x,y:20.5,previous:'water',placed:'bridge'}))}];
 s.specialists!.nextStructureId=3;s.players[0].heroRecovery=[{definitionId:'core:orcs-commander',availableAt:12}];
 return s;
}
function good():any {return saveGame(fixture());}
function hero(save:any):any {return save.state.entities.find((e:any)=>e.definitionId==='core:orcs-commander');}
function beacon(save:any):any {return save.state.entities.find((e:any)=>e.definitionId==='core:orcs-beacon');}
function siegeFixture(ability:SiegeAbility):GameState {
 const p:any=JSON.parse(JSON.stringify(exampleMod())),def={...FACTIONS.orcs.units.siege,id:'lantern:artillery',ability};
 p.factions[0].units.push(def);p.art[def.id]={...p.art['lantern:sentinel'],path:'/mods/lantern/artillery.svg'};const {hash:_,...body}=p;p.hash=contentHash(body);
 const s=createMatch({content:createContentBundle([p]),map:{seed:4127},players:[{id:0,teamId:0,factionId:'lantern:keepers',controller:'external'},{id:1,teamId:1,factionId:'orcs',controller:'external'}]});
 spawnDefinition(s,0,'unit',def.id,20,20);return s;
}

function shotFixture():any {
 const s=siegeFixture('incendiary-shell'),source=s.entities.find(e=>e.definitionId==='lantern:artillery')!;
 s.specialists={artifacts:[],structures:[],nextArtifactId:1,nextStructureId:1};
 Object.assign(s.specialists,{nextShotId:2,shots:[{id:1,source:{id:source.id,side:0,definitionId:source.definitionId,faction:s.players[0].faction,x:20,y:20,level:0},target:{x:25,y:20,level:0},impactAt:2,rawDamage:40,buildingMultiplier:1.8,payload:{kind:'incendiary',damageFactor:1,armorPiercing:false,radius:2}}]});
 return saveGame(s);
}
describe('specialist save validation',()=>{
 it('round-trips progression, equipped and ground artifacts, structures and timers without sharing records',()=>{
  const original=fixture(),before=saveGame(original),restored=loadGame(JSON.stringify(before));expect(saveGame(restored)).toEqual(before);
  restored.specialists!.artifacts[0].holder=999;restored.entities.find(e=>e.definitionId==='core:orcs-commander')!.veteran!.promotions[0].id='medic';
  expect(saveGame(original)).toEqual(before);expect((before.state.specialists!.artifacts[3].position as any).level).toBe(2);
 });
 it('preserves an earned pending promotion and allows the same role choice at later ranks',()=>{
  const s=fixture(),e=s.entities.find(e=>e.definitionId==='core:orcs-commander')!,victim=s.entities.find(e=>e.side===1&&e.role==='worker')!;
  for(let i=0;i<3;i++)creditCombat(s,e,victim,100);expect(e.veteran!.pendingPromotion).toBe(3);
  const restored=loadGame(saveGame(s)),copy=restored.entities.find(actor=>actor.id===e.id)!;expect(promote(restored,0,e.id,'bulwark')).toBe(true);
  expect(copy.veteran!.promotions.map(p=>p.rank)).toEqual([1,2,3]);expect(copy.veteran!.pendingPromotion).toBeUndefined();expect(()=>saveGame(restored)).not.toThrow();
 });
 it('accepts historical burn sources and a final fractional tick scheduled past expiry',()=>{
  const s=fixture(),victim=s.entities.find(e=>e.side===1&&e.role==='worker')!;
  victim.burning=[{source:s.nextId++,side:0,until:12.25,nextAt:13,damage:5}];expect(()=>loadGame(saveGame(s))).not.toThrow();
 });
 it('allows inventory artifacts that are owned and held but not equipped',()=>{
  const s=fixture(),e=s.entities.find(e=>e.definitionId==='core:orcs-commander')!;
  for(let i=0;i<9;i++){const item=createArtifact(s,'core:ember-blade',e);expect(recoverArtifact(s,0,e.id,item.id)).toBe(true);}
  expect(()=>loadGame(saveGame(s))).not.toThrow();
 });
 it.each([
  ['unearned rank',(s:any):any=>hero(s).veteran.rank=3],['excess experience',(s:any):any=>hero(s).veteran.experience=301],
  ['duplicate rank',(s:any):any=>hero(s).veteran.promotions[1].rank=1],['skipped rank',(s:any):any=>hero(s).veteran.promotions.shift()],
  ['wrong-role promotion',(s:any):any=>hero(s).veteran.promotions[0].id='siege-master'],['unearned promotion',(s:any):any=>hero(s).veteran.promotions.push({rank:3,id:'bulwark'})],
  ['wrong pending rank',(s:any):any=>hero(s).veteran.pendingPromotion=1],['missing pending rank',(s:any):any=>{hero(s).veteran.promotions.pop();}],
  ['future combat',(s:any):any=>hero(s).veteran.lastCombatAt=13],['unbounded survival timer',(s:any):any=>hero(s).veteran.nextSurvivalAt=73],
  ['illusion experience',(s:any):any=>hero(s).illusion=true],['raised experience',(s:any):any=>hero(s).raised=true],
  ['duplicate artifact',(s:any):any=>s.state.specialists.artifacts.push({...s.state.specialists.artifacts[0]})],
  ['artifact beyond counter',(s:any):any=>s.state.specialists.nextArtifactId=4],['unknown artifact definition',(s:any):any=>s.state.specialists.artifacts[0].definitionId='core:unknown'],
  ['orphan holder',(s:any):any=>s.state.specialists.artifacts[0].holder=999],['foreign owner',(s:any):any=>s.state.specialists.artifacts[0].owner=1],
  ['missing owned side',(s:any):any=>delete s.state.specialists.artifacts[0].owner],['simultaneous held and ground item',(s:any):any=>s.state.specialists.artifacts[0].position={x:1,y:1}],
  ['unpositioned ground artifact',(s:any):any=>delete s.state.specialists.artifacts[3].position],['owned ground artifact',(s:any):any=>s.state.specialists.artifacts[3].owner=0],
  ['invalid artifact level',(s:any):any=>s.state.specialists.artifacts[3].position.level=4],['invalid ground coordinate',(s:any):any=>s.state.specialists.artifacts[3].position.x=-1],
  ['unequipped orphan record',(s:any):any=>hero(s).equipment.weapon=999],['wrong equipment slot',(s:any):any=>{hero(s).equipment.weapon=2;}],
  ['same item in two slots',(s:any):any=>{hero(s).equipment.armor=1;}],['equipment on worker',(s:any):any=>{s.state.entities.find((e:any)=>e.role==='worker').equipment={weapon:1};}],
  ['unbounded held inventory',(s:any):any=>{const a=s.state.specialists.artifacts;for(let i=0;i<10;i++)a.push({id:s.state.specialists.nextArtifactId++,definitionId:'core:ember-blade',holder:hero(s).id,owner:0});}],
  ['dead item holder',(s:any):any=>hero(s).hp=0],['missing specialist records',(s:any):any=>delete s.state.specialists],
  ['unknown equipment slot',(s:any):any=>hero(s).equipment.helmet=4],['unknown buff key',(s:any):any=>hero(s).specialistBuffs[0].teleport=true],
  ['excess buff multiplier',(s:any):any=>hero(s).specialistBuffs[0].damageFactor=5],['future buff expiry',(s:any):any=>hero(s).specialistBuffs[0].until=43],
  ['empty buff',(s:any):any=>hero(s).specialistBuffs[0]={until:13}],['invalid fear point',(s:any):any=>hero(s).specialistBuffs[1].fearedFrom={x:1,y:1,level:-1}],
  ['too many buffs',(s:any):any=>hero(s).specialistBuffs=Array(65).fill({until:13,armor:1})],
  ['wrong burn source side',(s:any):any=>s.state.entities.find((e:any)=>e.burning).burning[0].side=1],['unbounded burn damage',(s:any):any=>s.state.entities.find((e:any)=>e.burning).burning[0].damage=101],
  ['invalid burn source',(s:any):any=>s.state.entities.find((e:any)=>e.burning).burning[0].source=s.state.nextId],['unbounded burn time',(s:any):any=>s.state.entities.find((e:any)=>e.burning).burning[0].until=19],
  ['beacon on unit',(s:any):any=>hero(s).beacon={connected:true,nextAlertAt:0}],['invalid beacon flag',(s:any):any=>beacon(s).beacon.connected=1],['unbounded beacon time',(s:any):any=>beacon(s).beacon.nextAlertAt=21],
  ['duplicate structure',(s:any):any=>s.state.specialists.structures.push({...s.state.specialists.structures[0]})],['structure beyond counter',(s:any):any=>s.state.specialists.nextStructureId=2],
  ['orphan barricade',(s:any):any=>s.state.specialists.structures[0].entityId=999],['unregistered living barricade',(s:any):any=>s.state.specialists.structures.shift()],['foreign barricade',(s:any):any=>s.state.specialists.structures[0].owner=1],
  ['wrong barricade entity',(s:any):any=>s.state.specialists.structures[0].entityId=hero(s).id],['mixed bridge and entity',(s:any):any=>s.state.specialists.structures[1].entityId=hero(s).id],
  ['missing bridge tile',(s:any):any=>s.state.specialists.structures[1].tiles.pop()],['nonconsecutive bridge',(s:any):any=>s.state.specialists.structures[1].tiles[1].x=35.5],
  ['invalid bridge level',(s:any):any=>s.state.specialists.structures[1].tiles[1].level=2],['invalid bridge stamp',(s:any):any=>s.state.specialists.structures[1].tiles[1].stamp=-1],['wrong placed terrain',(s:any):any=>s.state.specialists.structures[1].tiles[0].placed='grass'],
  ['invalid old terrain',(s:any):any=>s.state.specialists.structures[1].tiles[0].previous='rock'],['duplicate bridge tiles',(s:any):any=>{const bridge=structuredClone(s.state.specialists.structures[1]);bridge.id=s.state.specialists.nextStructureId++;s.state.specialists.structures.push(bridge);}],
  ['unbounded structure expiry',(s:any):any=>s.state.specialists.structures[0].expires=73],
  ['foreign recovery',(s:any):any=>s.state.players[0].heroRecovery[0].definitionId='core:fairies-commander'],['duplicate recovery',(s:any):any=>s.state.players[0].heroRecovery.push({...s.state.players[0].heroRecovery[0]})],
  ['unbounded recovery',(s:any):any=>s.state.players[0].heroRecovery[0].availableAt=43],['recovering active hero',(s:any):any=>s.state.players[0].heroRecovery[0].availableAt=20],
  ['duplicate living hero',(s:any):any=>{const e=structuredClone(hero(s));e.id=s.state.nextId++;delete e.equipment;s.state.entities.push(e);}],
  ['living and queued hero',(s:any):any=>{const barracks=structuredClone(s.state.entities.find((e:any)=>e.role==='hq'));barracks.id=s.state.nextId++;barracks.role='barracks';barracks.queue=['special'];barracks.queueDefinitionIds=['core:orcs-commander'];s.state.entities.push(barracks);}],
 ] as const)('rejects %s with a specialist save path',(_name,mutate)=>{
  const save=good();mutate(save);expect(()=>loadGame(save)).toThrow(/Invalid save at state\./);
 });
 it.each([
  ['incendiary-shell',{ammo:0,deployed:false,prepared:'incendiary'}],['rooting-shell',{ammo:0,deployed:false,prepared:'rooting'}],
  ['corpse-shell',{ammo:0,deployed:false,prepared:'corpse'}],['flood-shell',{ammo:0,deployed:false,prepared:'flood'}],
  ['ammunition-cannon',{ammo:10,deployed:true}],['powered-beam',{ammo:8,deployed:false}],
 ] as const)('round-trips %s preparation from a pinned custom definition', (ability,mode)=>{
  const s=siegeFixture(ability),e=s.entities.find(e=>e.definitionId==='lantern:artillery')!;e.siegeMode={...mode};expect(saveGame(loadGame(saveGame(s)))).toEqual(saveGame(s));
 });
 it.each([
  ['wrong prepared shell','incendiary-shell',{ammo:0,deployed:false,prepared:'rooting'}],['ammunition on prepared shell','flood-shell',{ammo:1,deployed:false}],
  ['cannon overcapacity','ammunition-cannon',{ammo:11,deployed:true}],['beam overcapacity','powered-beam',{ammo:9,deployed:false}],
  ['deployed beam','powered-beam',{ammo:1,deployed:true}],['prepared cannon','ammunition-cannon',{ammo:5,deployed:true,prepared:'corpse'}],
 ] as const)('rejects %s',(_name,ability,mode)=>{
  const s=siegeFixture(ability),e=s.entities.find(e=>e.definitionId==='lantern:artillery')!;e.siegeMode=mode as any;expect(()=>saveGame(s)).toThrow(/siegeMode/);
 });
 it('round-trips a delayed siege source snapshot after the firing entity is removed',()=>{
  const save=shotFixture();save.state.entities=save.state.entities.filter((e:any)=>e.definitionId!=='lantern:artillery');
  expect(saveGame(loadGame(JSON.stringify(save)))).toEqual(save);
 });
 it.each([
  ['missing shot counter',(s:any):any=>delete s.state.specialists.nextShotId],['duplicate shot',(s:any):any=>s.state.specialists.shots.push(structuredClone(s.state.specialists.shots[0]))],
  ['wrong source faction',(s:any):any=>s.state.specialists.shots[0].source.faction='fairies'],['unknown source faction',(s:any):any=>s.state.specialists.shots[0].source.faction='missing'],
  ['non-siege definition',(s:any):any=>s.state.specialists.shots[0].source.definitionId='lantern:sentinel'],['unallocated source id',(s:any):any=>s.state.specialists.shots[0].source.id=s.state.nextId],
  ['invalid source level',(s:any):any=>s.state.specialists.shots[0].source.level=4],['invalid impact level',(s:any):any=>s.state.specialists.shots[0].target.level=-1],['cross-level impact',(s:any):any=>s.state.specialists.shots[0].target.level=1],
  ['unbounded impact time',(s:any):any=>s.state.specialists.shots[0].impactAt=31],['unbounded damage',(s:any):any=>s.state.specialists.shots[0].rawDamage=1e10],
  ['invalid building multiplier',(s:any):any=>s.state.specialists.shots[0].buildingMultiplier=0],['wrong payload kind',(s:any):any=>s.state.specialists.shots[0].payload.kind='beam'],
  ['wrong payload factor',(s:any):any=>s.state.specialists.shots[0].payload.damageFactor=1.4],['wrong piercing flag',(s:any):any=>s.state.specialists.shots[0].payload.armorPiercing=true],
  ['wrong payload radius',(s:any):any=>s.state.specialists.shots[0].payload.radius=3],
 ] as const)('rejects %s in the delayed siege snapshot',(_name,mutate)=>{
  const save=shotFixture();mutate(save);expect(()=>loadGame(save)).toThrow(/Invalid save at state.specialists/);
 });

 it('resumes and replays accepted specialist commands through combat, fire, promotions and structure expiry',()=>{
  const s=createGame('orcs',4127,'fairies',{controllers:['external','external']});s.terrain.fill('grass');
  const commander=spawnDefinition(s,0,'unit','core:orcs-commander',22,20.5),engineer=spawnDefinition(s,0,'unit','core:orcs-engineer',20.5,22.5),siege=spawnDefinition(s,0,'unit',FACTIONS.orcs.units.siege.id,20.5,20.5);
  const victim=s.entities.find(e=>e.side===1&&e.role==='worker')!;victim.x=24.5;victim.y=20.5;victim.hp=500;victim.maxHp=500;victim.order={type:'hold'};
  for(const x of [22,23,24])s.terrain[22*s.width+x]='water';
  const item=createArtifact(s,'core:iron-aegis',commander);refreshVisibility(s);const recorder=new MatchRecorder(s);
  expect(issueCommand(s,0,{type:'recoverArtifact',id:commander.id,artifact:item.id})).toBe(true);
  expect(issueCommand(s,0,{type:'equipArtifact',id:commander.id,artifact:item.id})).toBe(true);
  expect(issueCommand(s,0,{type:'ability',ids:[commander.id],x:22,y:21})).toBe(true);
  expect(issueCommand(s,0,{type:'engineerBuild',ids:[engineer.id],kind:'bridge',x:23.5,y:22.5})).toBe(true);
  expect(issueCommand(s,0,{type:'engineerBuild',ids:[engineer.id],kind:'barricade',x:19.5,y:22.5})).toBe(true);
  expect(issueCommand(s,0,{type:'ability',ids:[siege.id]})).toBe(true);
  expect(issueCommand(s,0,{type:'attack',ids:[siege.id],target:victim.id})).toBe(true);
  stepGame(s,.1);expect(s.specialists!.shots).toHaveLength(1);expect(commander.specialistBuffs).not.toHaveLength(0);
  const restored=loadGame(JSON.stringify(saveGame(s)));let sawFire=false,sawPending=false;
  for(let i=0;i<280;i++){
   stepGame(s,.25);stepGame(restored,.25);
   sawFire||=s.entities.some(e=>!!e.burning?.length);sawPending||=!!commander.veteran?.pendingPromotion;
   if(commander.veteran?.pendingPromotion){expect(issueCommand(s,0,{type:'promote',id:commander.id,promotion:'bulwark'})).toBe(true);expect(issueCommand(restored,0,{type:'promote',id:commander.id,promotion:'bulwark'})).toBe(true);}
   expect(saveGame(restored)).toEqual(saveGame(s));
  }
  expect(sawFire).toBe(true);expect(sawPending).toBe(true);expect(commander.veteran!.promotions.length).toBeGreaterThan(0);
  expect(s.specialists!.structures).toEqual([]);for(const x of [22,23,24])expect(s.terrain[22*s.width+x]).toBe('water');
  expect(issueCommand(s,0,{type:'unequipArtifact',id:commander.id,slot:'armor'})).toBe(true);expect(issueCommand(s,0,{type:'dropArtifact',id:commander.id,artifact:item.id})).toBe(true);
  expect(item.holder).toBeUndefined();expect(item.position).toEqual({x:commander.x,y:commander.y});
  const replay=new ReplayPlayer(JSON.stringify(recorder.export()));replay.advance(s.tick);expect(replay.finished).toBe(true);expect(saveGame(replay.state)).toEqual(saveGame(s));
  replay.seek(1);expect(replay.state.specialists!.shots).toHaveLength(1);replay.seek(s.tick);expect(saveGame(replay.state)).toEqual(saveGame(s));recorder.dispose();replay.dispose();
 });
 it('preserves optional terrain ownership stamps on temporary bridge records',()=>{
  const s=fixture();for(const tile of s.specialists!.structures[1].tiles!)tile.stamp=42;
  expect(saveGame(loadGame(saveGame(s)))).toEqual(saveGame(s));
 });

 it('keeps the historical fire side when a captured siege engine still exists',()=>{
  const s=siegeFixture('incendiary-shell'),source=s.entities.find(e=>e.definitionId==='lantern:artillery')!,target=s.entities.find(e=>e.side===0&&e.role==='worker')!;
  source.definitionFaction=s.players[0].faction;source.side=1;
  target.burning=[{source:source.id,side:0,origin:{x:20,y:20},until:6,nextAt:1,damage:5}];
  expect(saveGame(loadGame(saveGame(s)))).toEqual(saveGame(s));
 });

});
