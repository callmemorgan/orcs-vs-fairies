import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {FACTIONS} from '../../src/core/content';
import {createMatch,issueCommand,refreshVisibility,spawnDefinition,stepGame} from '../../src/core/simulation';
import {createSessionFile,decodeSessionFile} from '../../src/core/session-storage';
import {MatchRecorder,replayChecksum} from '../../src/core/replays';
import {fogKey,validateWorldMap} from '../../src/core/world-map';
import {MinimapAlerts} from '../../src/ui/MinimapAlerts';
import type {WorldMapData} from '../../src/core/world-types';

const out=process.argv[2]??'docs/evidence/minimap-levels-20261001';
mkdirSync(out,{recursive:true});
const width=36,height=36,seed=810041,area=width*height;
const map:WorldMapData={width,height,seed,size:'small',
 levels:[{id:0,title:'Alert surface',terrain:Array(area).fill('grass'),elevation:Array(area).fill(0)},{id:1,title:'Alert caverns',terrain:Array(area).fill('grass'),elevation:Array(area).fill(0)}],
 starts:[{slot:0,x:6.5,y:6.5,level:0},{slot:1,x:30.5,y:30.5,level:0}],resources:[],sites:[],
 transitions:[{id:1,from:{x:18.5,y:18.5,level:0},to:{x:18.5,y:18.5,level:1}}]};
assert.deepEqual(validateWorldMap(map,{scenario:true}),{valid:true,issues:[]});
const state=createMatch({map:{seed,size:'small',world:map,biome:'temperate'},players:[{id:0,teamId:0,factionId:'orcs',controller:'human'},{id:1,teamId:1,factionId:'orcs',controller:'external'}]},{scenario:true});
const own=(role:'hq'|'barracks',x:number,y:number,level:number)=>spawnDefinition(state,0,'building',FACTIONS.orcs.buildings[role].id,x,y,1,level);
const surfaceHQ=own('hq',6.5,6.5,0),cavernHQ=own('hq',8.5,8.5,1),barracks=own('barracks',18.5,8.5,1),expansion=own('hq',25.5,23.5,1);
const enemyHQ=spawnDefinition(state,1,'building',FACTIONS.orcs.buildings.hq.id,30.5,30.5,1,0);
const raider=spawnDefinition(state,1,'unit',FACTIONS.orcs.units.melee.id,12,8.5,1,1),expansionRaider=spawnDefinition(state,1,'unit',FACTIONS.orcs.units.melee.id,29,23.5,1,1);
const hiddenCavern=spawnDefinition(state,1,'unit',FACTIONS.orcs.units.melee.id,33.5,3.5,1,1),hiddenSurface=spawnDefinition(state,1,'unit',FACTIONS.orcs.units.melee.id,25.5,23.5,1,0);
for(const entity of state.entities)entity.order={type:'hold'};
refreshVisibility(state);
assert(issueCommand(state,1,{type:'attack',ids:[raider.id],target:cavernHQ.id}));
assert(issueCommand(state,1,{type:'attack',ids:[expansionRaider.id],target:expansion.id}));
assert(!state.visible[0].has(fogKey(state,hiddenCavern)));
assert(!state.visible[0].has(fogKey(state,hiddenSurface)));
assert(state.visible[0].has(fogKey(state,expansion)));
assert(state.entities.every(entity=>entity.lastDamagedAt===undefined));
assert.deepEqual(state.events,[]);assert.equal(state.tick,0);assert.equal(state.time,0);
const recorder=new MatchRecorder(state),file=createSessionFile(state,recorder.export());recorder.dispose();
const serialized=JSON.stringify(file,null,2),decoded=decodeSessionFile(serialized);
assert.equal(replayChecksum(decoded.state),replayChecksum(state));assert.equal(decoded.state.world!.levels.length,2);
writeFileSync(`${out}/level-alerts-session.json`,serialized);
const actors={surfaceHQ:surfaceHQ.id,cavernHQ:cavernHQ.id,barracks:barracks.id,expansion:expansion.id,enemyHQ:enemyHQ.id,raider:raider.id,expansionRaider:expansionRaider.id,hiddenCavern:hiddenCavern.id,hiddenSurface:hiddenSurface.id};
writeFileSync(`${out}/level-alerts-ids.json`,JSON.stringify({seed,width,height,actors,positions:Object.fromEntries(state.entities.map(entity=>[entity.id,{x:entity.x,y:entity.y,level:entity.level??0}])),raidTarget:cavernHQ.id,expansionTarget:expansion.id,idleCavernSequence:[cavernHQ.id,barracks.id,expansion.id],hidden:[hiddenCavern.id,hiddenSurface.id],source:'Strict native SessionTools-import fixture at tick0; attacks are ordinary issueCommand orders; no synthetic damage/events/clock.',sessionVersion:file.version,saveVersion:file.game.version,replayVersion:file.replay!.version},null,2));

// This discarded decoded copy proves fixture feasibility. The imported file above
// remains tick0 with no damage history and no prefilled alert idle timer.
const tracker=new MinimapAlerts();tracker.update(decoded.state,0);
for(let tick=0;tick<260;tick++){stepGame(decoded.state,.05);tracker.update(decoded.state,0);}
const natural=tracker.current,damaged=decoded.state.entities.filter(entity=>entity.id===cavernHQ.id||entity.id===expansion.id);
assert(damaged.every(entity=>entity.hp<entity.maxHp&&entity.lastDamagedAt!==undefined));
assert(natural.some(alert=>alert.kind==='raid'&&alert.entity===cavernHQ.id&&alert.level===1));
assert(natural.some(alert=>alert.kind==='expansion'&&alert.entity===expansion.id&&alert.level===1));
assert(natural.some(alert=>alert.kind==='idle'&&alert.entity===barracks.id&&alert.level===1));
assert(!natural.some(alert=>alert.entity===hiddenCavern.id||alert.entity===hiddenSurface.id));
const validation={nativeDecoderPassed:true,initialTick:file.game.state.tick,initialTime:file.game.state.time,initialEvents:file.game.state.events,initialDamageHistory:[],worldLevels:decoded.state.world!.levels.length,fixtureChecksum:replayChecksum(state),feasibility:{tick:decoded.state.tick,time:decoded.state.time,damaged:damaged.map(entity=>({id:entity.id,hp:entity.hp,maxHp:entity.maxHp,lastDamagedAt:entity.lastDamagedAt})),alerts:natural.map(alert=>({...alert,expires:Number.isFinite(alert.expires)?alert.expires:'infinity'})),hiddenVisible:[hiddenCavern,hiddenSurface].map(entity=>({id:entity.id,level:entity.level,visible:decoded.state.visible[0].has(fogKey(decoded.state,entity))}))}};
writeFileSync(`${out}/fixture-validation.json`,JSON.stringify(validation,null,2));console.log(JSON.stringify(validation));
