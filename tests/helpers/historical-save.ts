import { FACTIONS, UPGRADES } from '../../src/core/content';
import { BUILTIN_EXTRA_DEFINITIONS } from '../../src/core/specialist-content';
import { saveGame, SAVE_VERSION } from '../../src/core/saves';
import type { BuiltinFactionId, GameState } from '../../src/core/types';

// Synthetic fixtures projected onto the schemas emitted by 2c8c79a (v1)
// and b538995b6ee8b398f5724a5bb8a0d89cf18a49fc (v2).
const stateFields=['controllers','mapSize','mapVersion','terrain','starts','draw','tick','corpses','time','seed','width','height','entities','resources','players','winner','events','explored','visible','nextId'] as const;
const teamFields=['teams','incomeFactors','populationLimits','sharedVision','eliminated','winningTeam'] as const;
const entityFields=['id','side','kind','role','x','y','hp','maxHp','order','cooldown','progress','queue','trainProgress','researchProgress','facing','animation','animTime','momentum','illusion','expires','carried','carriedKind','path','orderQueue','research','rally','gateOpen','lastAttacker','abilityReadyAt','entrenchedAt','raised','shield','maxShield','lastDamagedAt','surgeUntil'] as const;
const runtimeFields=['fog','ai','aiTurns','hits','routes','abilities','returning','queuedGather','aiWave','initialScoutDispatched','expansionScout','expansionScoutDispatched','knownEnemyBuildings','enemyStartCleared','searched'] as const;
function fields(value:any,keys:readonly string[]):any {return Object.fromEntries(keys.filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]]));}
function point(value:any):any {return fields(value,['x','y']);}
function order(value:any):any {return fields(value,['type','x','y','target']);}

export function historicalSave(state:GameState,version:1|2):any {
 if(state.players.length!==2||state.world||state.content)throw new Error('These historical fixtures require two built-in players on a surface map.');
 const current:any=saveGame(state),save:any={format:current.format,version,state:fields(current.state,version===1?stateFields:[...stateFields,...teamFields]),runtime:fields(current.runtime,version===1?runtimeFields:[...runtimeFields,'clearedEnemyStarts'])};
 save.state.entities=save.state.entities.map((value:any)=>{const e=fields(value,entityFields);e.order=order(e.order);e.path=e.path.map(point);if(e.orderQueue)e.orderQueue=e.orderQueue.map(order);if(e.rally)e.rally=point(e.rally);return e;});
 save.state.starts=save.state.starts.map(point);
 save.state.players=save.state.players.map((value:any)=>fields(value,['faction','wood','ore','crystal','population','cap','upgrades']));
 save.state.resources=save.state.resources.map((value:any)=>fields(value,['id','x','y','kind','amount','maxAmount']));
 save.state.corpses=save.state.corpses.map((value:any)=>fields(value,['id','x','y','expires']));
 save.state.events=save.state.events.map((value:any)=>fields(value,['type','x','y','side','text','target','source','amount','resource']));
 save.runtime.hits=save.runtime.hits.map((value:any)=>fields(value,['source','target','amount','event']));
 save.runtime.routes=save.runtime.routes.map(([id,value]:any)=>[id,fields(value,['key','at'])]);
 save.runtime.knownEnemyBuildings=save.runtime.knownEnemyBuildings.map((row:any[])=>row.map(([id,value])=>[id,fields(value,['x','y','role'])]));
 return save;
}

/** Independent expected native envelope: preserved history plus published defaults. */
export function expectedHistoricalMigration(snapshot:any,eliminated=[false,false]):any {
 const expected=structuredClone(snapshot),count=snapshot.state.players.length;expected.version=SAVE_VERSION;
 if(snapshot.version===1){Object.assign(expected.state,{teams:[0,1],incomeFactors:[1,1],populationLimits:[100,100],sharedVision:true,eliminated,winningTeam:snapshot.state.winner});expected.runtime.clearedEnemyStarts=snapshot.runtime.enemyStartCleared.map((value:boolean,side:number)=>value?[1-side]:[]);}
 expected.state.aiConfigs=Array.from({length:count},()=>({difficulty:'normal',personality:'balanced',opening:'infantry-rush'}));
 Object.assign(expected.runtime,{aiBatchTurns:0,aiDecisionAt:Array(count).fill(snapshot.state.time),aiDecisionTurns:Array(count).fill(0),knownEnemyUnits:Array.from({length:count},()=>[]),retreating:Array.from({length:count},()=>[]),producedFighters:Array(count).fill(0)});
 expected.state.rules={mode:'annihilation',standardDefeat:true,startingAge:1,sharedVision:expected.state.sharedVision,friendlyFire:true,startingResources:{wood:420,ore:220,crystal:0},disabledDefinitionIds:[],hill:{radius:5,captureTicks:100,holdTicks:2400},relic:{count:3,required:2,holdTicks:2400,pickupRadius:1.5},survival:{defenderTeam:0,waveCount:5,intervalTicks:1200,recoveryTicks:400,unitsPerWave:2,rewardPerWave:{wood:60,ore:30,crystal:0}},draft:{enabled:false,banRounds:1,pickRounds:3,turnTicks:600}};
 const pool=[...new Set(snapshot.state.players.flatMap((player:any)=>{const faction=FACTIONS[player.faction as BuiltinFactionId],units=faction.unitDefinitions??[...Object.values(faction.units),...BUILTIN_EXTRA_DEFINITIONS[player.faction as BuiltinFactionId].units],research={...UPGRADES,...Object.fromEntries((faction.research??[]).map(def=>[def.id,def]))};return [...units.filter(unit=>unit.role!=='worker'&&!unit.id.startsWith('economy:')).map(unit=>unit.id),...Object.keys(research).filter(id=>!['town-age','citadel-age'].includes(id))];}))];
 expected.state.draft={status:'complete',turn:0,remainingTicks:0,order:[],banned:[],picks:Array.from({length:count},()=>[]),pool};
 expected.state.objectives={hill:{x:Math.floor(snapshot.state.width/2)+.5,y:Math.floor(snapshot.state.height/2)+.5,ownerTeam:null,captureTeam:null,captureTicks:0,holdTicks:0,contested:false},relics:[],relicHoldTicks:Array(8).fill(0),survival:{wave:0,nextWaveTick:0,spawnedIds:[],phase:'waiting'}};
 return expected;
}
