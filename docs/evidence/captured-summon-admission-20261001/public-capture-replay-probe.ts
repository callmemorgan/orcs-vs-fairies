import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { FACTIONS } from '../../../src/core/content';
import { entityDefinition } from '../../../src/core/content-registry';
import { createMatch,spawnDefinition,issueCommand,refreshVisibility,stepGame } from '../../../src/core/simulation';
import { generateWorldMap } from '../../../src/core/world-map';
import { saveGame,loadGame } from '../../../src/core/saves';
import { MatchRecorder,ReplayPlayer } from '../../../src/core/replays';
import { definitionAllowed } from '../../../src/core/match-rules';
function capture(kind:'fairies'|'undead',pinned:boolean,policy:'none'|'draft'|'disable-born'|'disable-owner') {
 const map=generateWorldMap(4127,'large',2,'temperate');for(const layer of map.levels){layer.terrain.fill('grass');layer.elevation.fill(0)}map.sites=[];
 const born=kind==='fairies'?FACTIONS.fairies.units.special.id:FACTIONS.undead.units.melee.id;
 const disabled=policy==='disable-born'?[born]:policy==='disable-owner'?[FACTIONS.orcs.units.melee.id]:[];
 const s=createMatch({map:{seed:map.seed,size:map.size,world:map},rules:{startingAge:3,disabledDefinitionIds:disabled,draft:{enabled:policy==='draft',banRounds:0,pickRounds:1}},players:[{id:0,teamId:0,factionId:kind,controller:'external'},{id:1,teamId:1,factionId:'orcs',controller:'external'}]});
 if(policy==='draft'){assert.equal(issueCommand(s,0,{type:'draftChoice',definitionId:FACTIONS[kind].units.special.id}),true);assert.equal(issueCommand(s,1,{type:'draftChoice',definitionId:FACTIONS.orcs.units.melee.id}),true);}
 s.entities=s.entities.filter(e=>e.role==='hq');s.resources=[];
 const caster=spawnDefinition(s,0,'unit',FACTIONS[kind].units.special.id,24.5,32.5,1,1);caster.order={type:'hold'};caster.cooldown=100;caster.hp=caster.maxHp*.5;caster.tactics!.morale=0;if(!pinned)delete caster.definitionId;
 for(const [dx,dy] of [[-1.2,0],[1.2,0],[0,1.2]]){const captor=spawnDefinition(s,1,'unit',FACTIONS.orcs.units.melee.id,caster.x+dx,caster.y+dy,1,1);captor.order={type:'hold'};captor.cooldown=100;}
 if(kind==='undead'){s.corpses.push({id:s.nextId++,x:caster.x+.5,y:caster.y,level:caster.level,expires:s.time+45});(caster.factionState??={}).deliveredCorpses=[{id:s.nextId++,x:caster.x,y:caster.y,level:caster.level,expires:s.time+45}];}
 refreshVisibility(s);const recorder=new MatchRecorder(s);
 try {
 stepGame(s,.05);assert.equal(caster.side,1);assert.equal(caster.definitionFaction,kind);assert.equal(caster.tactics?.surrenderedTo,1);
 const snapshot=saveGame(s);assert.deepEqual(saveGame(loadGame(snapshot)),snapshot);
 const nextId=s.nextId,accepted=issueCommand(s,1,{type:'ability',ids:[caster.id]}),after=saveGame(s),sameWholeSave=isDeepStrictEqual(snapshot,after);
 const summons=s.entities.filter(e=>e.id>=nextId);
 const shouldReject=policy==='draft'||policy==='disable-born';assert.equal(accepted,!shouldReject);assert.equal(sameWholeSave,shouldReject);
 if(shouldReject){assert.equal(summons.length,0);assert.equal(s.nextId,nextId);assert.deepEqual(saveGame(loadGame(after)),after);}
 else {assert.equal(summons.length,2);for(const e of summons){assert.equal(e.definitionFaction,kind);assert.equal(entityDefinition(s,e).id,born);assert.equal(definitionAllowed(s,1,born),true);assert.equal(e.maxHp,FACTIONS[kind].units[kind==='fairies'?'special':'melee'].hp*(kind==='fairies'?.4:1));}const restored=loadGame(after);for(let i=0;i<10;i++){stepGame(s,.05);stepGame(restored,.05);}assert.deepEqual(saveGame(restored),saveGame(s));}
 const replay=new ReplayPlayer(recorder.export());let replayMatches=false;try{replay.seek(s.tick);replayMatches=isDeepStrictEqual(saveGame(replay.state),saveGame(s));assert.equal(replayMatches,true);}finally{replay.dispose();}
 return {kind,pinned,policy,accepted,sameWholeSave,original:caster.definitionFaction,summons:summons.map(e=>({definitionId:entityDefinition(s,e).id,definitionFaction:e.definitionFaction,illusion:e.illusion,raised:e.raised})),ordinaryCaptureRoundTrip:true,replayMatches};
 }finally{recorder.dispose();}
}
const results=[];for(const kind of ['fairies','undead'] as const)for(const pinned of [true,false])for(const policy of ['none','draft','disable-born','disable-owner'] as const)results.push(capture(kind,pinned,policy));console.log(JSON.stringify(results,null,2));
