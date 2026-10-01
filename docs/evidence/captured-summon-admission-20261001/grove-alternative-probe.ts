import assert from 'node:assert/strict';
import { FACTIONS } from '../../../src/core/content';
import { contentHash, createContentBundle, entityDefinition } from '../../../src/core/content-registry';
import { FACTION_STRUCTURE_INFO } from '../../../src/core/faction-systems-content';
import { loadGame, saveGame } from '../../../src/core/saves';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../../../src/core/simulation';
import { generateWorldMap } from '../../../src/core/world-map';
import { replayChecksum } from '../../../src/core/replays';

function encounter({disabled=[],raise=false,content=undefined,origin='undead',pinned=true}:any={}) {
 const map=generateWorldMap(9241,'large',3,'temperate');
 for(const layer of map.levels){layer.terrain.fill('grass');layer.elevation.fill(0);}map.sites=[];
 const s=createMatch({...(content?{content}:{}),map:{seed:map.seed,size:map.size,world:map},rules:{startingAge:3,disabledDefinitionIds:disabled},players:[
 {id:0,teamId:0,factionId:origin,controller:'external'},
 {id:1,teamId:1,factionId:'fairies',controller:'external'},
 {id:2,teamId:2,factionId:'orcs',controller:'external'}]});
 s.entities=s.entities.filter(e=>e.role==='hq');s.resources=[];
 const caster=spawnDefinition(s,0,'unit',FACTIONS.undead.units.special.id,raise?24.5:28.5,32.5,1,1);
 caster.order={type:'hold'};caster.cooldown=100;caster.hp=caster.maxHp*.5;caster.tactics!.morale=0;
 if(!pinned)delete caster.definitionId;
 const offsets=raise?[[-1.2,0],[1.2,0],[0,1.2]]:[[-1.2,0],[.05,1.2],[.05,-1.2]];
 for(const [dx,dy]of offsets){const c=spawnDefinition(s,1,'unit',FACTIONS.fairies.units.spear.id,caster.x+dx,caster.y+dy,1,1);c.order={type:'hold'};c.cooldown=100;}
 const grove=spawnDefinition(s,1,'building',FACTION_STRUCTURE_INFO['enchanted-grove'].definition.id,32.5,32.5,1,1);
 const scout=spawnDefinition(s,2,'unit',FACTIONS.orcs.units.cavalry.id,38.5,32.5,1,1);scout.order={type:'hold'};scout.cooldown=100;
 let corpse;if(raise){corpse={id:s.nextId++,x:28.5,y:32.5,level:1,expires:45};s.corpses.push(corpse);}
 refreshVisibility(s);
 const idAtStart=s.nextId;stepGame(s,.05);
 assert.equal(caster.side,1);assert.equal(caster.definitionFaction,origin);assert.equal(caster.tactics!.surrenderedTo,1);
 assert(s.events.some(e=>e.source===caster.id&&e.text==='A surrounded unit surrendered'));
 assert.equal(s.entities.filter(e=>e.illusion).length,0);
 return{s,caster,grove,corpse,idAtStart};
}
function roundTrip(s:any){const saved=saveGame(s),restored=loadGame(saved);assert.deepEqual(saveGame(restored),saved);for(let i=0;i<10;i++){stepGame(s,.05);stepGame(restored,.05);}assert.deepEqual(saveGame(restored),saveGame(s));return replayChecksum(s);}
function identity(s:any,e:any){return{id:e.id,side:e.side,definitionId:e.definitionId??null,definitionFaction:e.definitionFaction??null,resolvedId:entityDefinition(s,e).id,hp:e.hp,maxHp:e.maxHp,raised:e.raised??false,illusion:e.illusion,expires:e.expires,surrenderedTo:e.tactics?.surrenderedTo??null};}
const results=[];
for(const pinned of [true,false]){
 const {s,caster,grove,idAtStart}=encounter({disabled:[FACTIONS.undead.units.special.id],pinned});
 const nextIdBefore=s.nextId,nextDecoyBefore=grove.factionState?.nextDecoyAt??null;
 for(let i=0;i<10;i++)stepGame(s,.05);
 assert.equal(s.nextId,nextIdBefore);assert.equal(nextIdBefore,idAtStart);assert.equal(grove.factionState?.nextDecoyAt??null,nextDecoyBefore);assert.equal(s.entities.filter(e=>e.illusion).length,0);
 results.push({case:'disabled captured template',pinned,caster:identity(s,caster),nextIdBefore,nextIdAfter:s.nextId,nextDecoyBefore,nextDecoyAfter:grove.factionState?.nextDecoyAt??null,illusionCount:0,continuationChecksum:roundTrip(s)});
}
for(const pinned of [true,false]){
 const {s,caster,grove}=encounter({pinned});stepGame(s,.05);const clone=s.entities.find(e=>e.illusion)!;
 assert(clone);assert.equal(clone.definitionFaction,'undead');assert.equal(entityDefinition(s,clone).id,FACTIONS.undead.units.special.id);assert.equal(clone.maxHp,FACTIONS.undead.units.special.hp*.4);assert.equal(clone.tactics?.surrenderedTo,undefined);assert.equal(grove.factionState!.nextDecoyAt,s.time+20);
 results.push({case:'admitted captured template',pinned,caster:identity(s,caster),clone:identity(s,clone),nextDecoyAt:grove.factionState!.nextDecoyAt,continuationChecksum:roundTrip(s)});
}
for(const pinned of [true,false]){
 const {s,caster,grove,corpse}=encounter({raise:true,pinned});assert(issueCommand(s,1,{type:'ability',ids:[caster.id]}));const raised=s.entities.find(e=>e.raised&&!e.illusion)!;
 assert(raised);assert.equal(raised.definitionFaction,'undead');assert.equal(entityDefinition(s,raised).id,FACTIONS.undead.units.melee.id);assert.equal(raised.maxHp,FACTIONS.undead.units.melee.hp);assert.equal(raised.hp,raised.maxHp*.5);assert.equal(raised.expires,s.time+35);assert(!s.corpses.some(e=>e.id===corpse!.id));stepGame(s,.05);
 const clone=s.entities.find(e=>e.raised&&e.illusion)!;assert(clone);assert.equal(clone.definitionFaction,'undead');assert.equal(entityDefinition(s,clone).id,FACTIONS.undead.units.melee.id);assert.equal(clone.maxHp,FACTIONS.undead.units.melee.hp*.4);assert.equal(clone.expires,s.time+15);assert.equal(clone.tactics?.surrenderedTo,undefined);
 results.push({case:'admitted raised template',pinned,raised:identity(s,raised),clone:identity(s,clone),nextDecoyAt:grove.factionState!.nextDecoyAt,continuationChecksum:roundTrip(s)});
}
const alternative={...structuredClone(FACTIONS.undead.units.melee),id:'probe:ash-guard',name:'Ash Guard',hp:270,description:'Probe melee alternative'};
const body={format:'orcs-vs-fairies-mod',schemaVersion:1,engineVersion:3,id:'probe',version:'1.0.0',name:'Probe raising faction',dependencies:[],factions:[{id:'probe:graveborn',baseFaction:'undead',name:'Probe Graveborn',subtitle:'Probe',description:'Temporary admitted alternative melee probe',color:0x888888,accent:'#888888',units:[alternative],buildings:[],research:[]}],art:{'probe:ash-guard':{path:'/mods/probe/ash-guard.svg',svg:'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#888888"/></svg>',width:16,height:16,anchor:[8,16]}}};
const content=createContentBundle([{...body,hash:contentHash(body)}]);
const {s,caster,grove}=encounter({raise:true,origin:'probe:graveborn',content,disabled:[FACTIONS.undead.units.melee.id]});
assert(issueCommand(s,1,{type:'ability',ids:[caster.id]}));const raised=s.entities.find(e=>e.raised&&!e.illusion)!;assert(raised);assert.equal(raised.definitionId,alternative.id);assert.equal(raised.definitionFaction,'probe:graveborn');assert.equal(raised.maxHp,270);assert.equal(raised.hp,135);stepGame(s,.05);const clone=s.entities.find(e=>e.raised&&e.illusion)!;assert(clone);assert.equal(clone.definitionId,alternative.id);assert.equal(clone.maxHp,108);assert.equal(clone.definitionFaction,'probe:graveborn');
results.push({case:'permitted original melee alternative',disabled:FACTIONS.undead.units.melee.id,raised:identity(s,raised),clone:identity(s,clone),nextDecoyAt:grove.factionState!.nextDecoyAt,continuationChecksum:roundTrip(s)});
console.log(JSON.stringify({allAssertionsPassed:true,source:'/home/morgana/.codex/worktrees/captured-summons/orcs-vs-Fairies',results},null,2));
