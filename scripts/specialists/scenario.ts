import { mkdirSync, writeFileSync } from 'node:fs';
import { FACTIONS } from '../../src/core/content';
import { createMatch, refreshVisibility, spawnDefinition } from '../../src/core/simulation';
import { createArtifact } from '../../src/core/unit-progression';
import { createSessionFile, decodeSessionFile } from '../../src/core/session-storage';
import type { BuiltinFactionId, Entity } from '../../src/core/types';

// This authored encounter is imported through the normal save UI. The browser
// test issues every subsequent command through controls and reads rts snapshots.
const out='work/hundred-features/specialists';mkdirSync(out,{recursive:true});
const points={bridge:{x:13.5,y:6.5},barricade:{x:15.5,y:8.5},leap:{x:9.5,y:13.5},dash:{x:9.5,y:13.5},queen:{x:14.5,y:10.5},command:{x:9.5,y:14.5}};
for(const faction of Object.keys(FACTIONS) as BuiltinFactionId[]){
 const state=createMatch({map:{seed:4137,size:'small'},rules:{startingAge:3},players:[{id:0,teamId:0,factionId:faction,controller:'human',handicap:{startingResources:{wood:5000,ore:5000,crystal:1000}}},{id:1,teamId:1,factionId:'orcs',controller:'external'}]});
 state.terrain.fill('grass');state.resources=[];state.starts=[{x:9.5,y:9.5},{x:32.5,y:32.5}];
 const own=state.entities.filter(e=>e.side===0),hostile=state.entities.filter(e=>e.side===1);
 own.find(e=>e.role==='hq')!.x=6.5;own.find(e=>e.role==='hq')!.y=6.5;
 hostile.find(e=>e.role==='hq')!.x=32.5;hostile.find(e=>e.role==='hq')!.y=32.5;
 const reset=(e:Entity,x:number,y:number)=>{e.x=x;e.y=y;e.order={type:'hold'};e.path=[];};
 own.filter(e=>e.role==='worker').forEach((e,i)=>reset(e,3.5+i,11.5));
 hostile.filter(e=>e.role==='worker').forEach((e,i)=>reset(e,28.5+i,30.5));
 reset(own.find(e=>e.role==='melee')!,4.5,16.5);
 const battle=hostile.find(e=>e.role==='melee')!;reset(battle,14.5,14.5);battle.hp=80;
 const barracks=spawnDefinition(state,0,'building',FACTIONS[faction].buildings.barracks.id,9.5,9.5);
 spawnDefinition(state,0,'building',FACTIONS[faction].buildings.depot.id,4.5,13.5);
 const engineer=spawnDefinition(state,0,'unit',`core:${faction}-engineer`,12.5,8.5);engineer.order={type:'hold'};engineer.hp=70;
 const cavalry=spawnDefinition(state,0,'unit',FACTIONS[faction].units.cavalry.id,8.5,14.5);cavalry.order={type:'hold'};cavalry.hp=Math.min(cavalry.maxHp,100);if(cavalry.maxShield)cavalry.shield=30;
 const siege=spawnDefinition(state,0,'unit',FACTIONS[faction].units.siege.id,14.5,5.5);siege.order={type:'hold'};siege.hp=80;
 const shellTarget=spawnDefinition(state,1,'unit',FACTIONS.orcs.units.melee.id,21.5,5.5);shellTarget.order={type:'hold'};
 const beacon=spawnDefinition(state,0,'building',`core:${faction}-beacon`,17.5,5.5);
 let hero:Entity|undefined;if(faction!=='fairies'){hero=spawnDefinition(state,0,'unit',`core:${faction}-commander`,10.5,14.5);hero.order={type:'hold'};hero.hp=200;}
 if(faction==='undead'){hero!.x=7.5;battle.x=13.5;battle.y=14.5;battle.hp=100;cavalry.x=10.5;cavalry.y=13.5;state.corpses.push({id:state.nextId++,x:14.5,y:4.5,expires:45});}
 if(faction==='tideborn')state.terrain[Math.floor(cavalry.y)*state.width+Math.floor(cavalry.x)]='mud';
 for(const x of [12,13,14])state.terrain[6*state.width+x]='water';
 const artifact=createArtifact(state,'core:ember-blade',engineer);
 refreshVisibility(state);
 const file=createSessionFile(state);decodeSessionFile(file);
 writeFileSync(`${out}/${faction}.json`,JSON.stringify(file,null,2));
 writeFileSync(`${out}/${faction}-ids.json`,JSON.stringify({faction,barracks:barracks.id,engineer:engineer.id,cavalry:cavalry.id,siege:siege.id,battle:battle.id,shellTarget:shellTarget.id,beacon:beacon.id,hero:hero?.id,artifact:artifact.id,points},null,2));
}
