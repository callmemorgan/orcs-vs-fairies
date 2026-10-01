import { availableUnits, contentFactions, upgradesFor, type ContentBundle } from './content-registry';
import { levelOf } from './world-map';
import type { Age, Cost, GameState, MatchPlayerConfig, Side, TeamId, FactionId } from './types';

export interface MatchRules {
 mode:'annihilation'|'hill'|'relic'|'survival'|'scenario'; standardDefeat:boolean;
 startingAge:Age; sharedVision:boolean; friendlyFire:boolean; startingResources:Cost; disabledDefinitionIds:string[];
 hill:{radius:number;captureTicks:number;holdTicks:number};
 relic:{count:number;required:number;holdTicks:number;pickupRadius:number};
 survival:{defenderTeam:TeamId;waveCount:number;intervalTicks:number;recoveryTicks:number;unitsPerWave:number;rewardPerWave:Cost};
 draft:{enabled:boolean;banRounds:number;pickRounds:number;turnTicks:number};
}
export type MatchRulesInput=Partial<Omit<MatchRules,'hill'|'relic'|'survival'|'draft'>> & {
 hill?:Partial<MatchRules['hill']>;relic?:Partial<MatchRules['relic']>;
 survival?:Partial<MatchRules['survival']>;draft?:Partial<MatchRules['draft']>;
};
export interface DraftState {
 status:'drafting'|'complete';turn:number;remainingTicks:number;
 order:Array<{side:Side;action:'ban'|'pick'}>;banned:string[];picks:string[][];pool:string[];
}
export interface ObjectiveState {
 hill:{x:number;y:number;level?:number;ownerTeam:TeamId|null;captureTeam:TeamId|null;captureTicks:number;holdTicks:number;contested:boolean};
 relics:Array<{id:number;x:number;y:number;level?:number;carrierId:number|null;heldTeam:TeamId|null}>;
 relicHoldTicks:number[];
 survival:{wave:number;nextWaveTick:number;spawnedIds:number[];phase:'waiting'|'fighting'|'recovery'|'complete'};
}
export const RULE_TICK_RATE=20;
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
function fields(value:unknown,allowed:string[],name:string):Record<string,unknown>{if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw new Error(`Invalid ${name}.`);return value;}
function num(value:unknown,min:number,max:number,name:string,integer=false):number {if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isSafeInteger(value)))throw new Error(`Invalid ${name}.`);return value;}
function bool(value:unknown,name:string):boolean {if(typeof value!=='boolean')throw new Error(`Invalid ${name}.`);return value;}
function money(value:unknown,name:string):Cost {const c=fields(value,['wood','ore','crystal'],name);return {wood:num(c.wood,0,1e9,`${name} wood`),ore:num(c.ore,0,1e9,`${name} ore`),crystal:num(c.crystal,0,1e9,`${name} crystal`)};}
const factionContext=(faction:FactionId,content?:ContentBundle)=>({content,players:[{faction}]});
export function definitionIds(content?:ContentBundle):string[]{return [...new Set(Object.keys(contentFactions(content)).flatMap(faction=>{const context=factionContext(faction as FactionId,content);return [...availableUnits(context,0).map(u=>u.id),...Object.keys(upgradesFor(context,0))];}))];}
export function normalizeMatchRules(value:unknown={},content?:ContentBundle):MatchRules {
 const r=fields(value,['mode','standardDefeat','startingAge','sharedVision','friendlyFire','startingResources','disabledDefinitionIds','hill','relic','survival','draft'],'match rules');
 if(Object.values(r).some(v=>v===null))throw new Error('Invalid null match rule.');
 const mode=r.mode??'annihilation';if(!['annihilation','hill','relic','survival','scenario'].includes(mode as string))throw new Error('Unknown victory mode.');
 const h=fields(r.hill??{},['radius','captureTicks','holdTicks'],'hill rules'),l=fields(r.relic??{},['count','required','holdTicks','pickupRadius'],'relic rules'),s=fields(r.survival??{},['defenderTeam','waveCount','intervalTicks','recoveryTicks','unitsPerWave','rewardPerWave'],'survival rules'),d=fields(r.draft??{},['enabled','banRounds','pickRounds','turnTicks'],'draft rules');
 if([h,l,s,d].some(group=>Object.values(group).some(v=>v===null)))throw new Error('Invalid null objective or draft rule.');
 const disabled=r.disabledDefinitionIds??[];
 if(!Array.isArray(disabled)||disabled.length>256||disabled.some(id=>typeof id!=='string'||id.length>128||!definitionIds(content).includes(id))||new Set(disabled).size!==disabled.length)throw new Error('Disabled definitions must be unique known unit or technology IDs.');
 const rules:MatchRules={mode:mode as MatchRules['mode'],standardDefeat:bool(r.standardDefeat??(mode!=='scenario'&&mode!=='survival'),'standard defeat'),startingAge:num(r.startingAge??1,1,3,'starting age',true) as Age,sharedVision:bool(r.sharedVision??true,'shared vision'),friendlyFire:bool(r.friendlyFire??true,'friendly fire'),startingResources:money(r.startingResources??{wood:420,ore:220,crystal:0},'starting resources'),disabledDefinitionIds:[...disabled],
 hill:{radius:num(h.radius??5,1,12,'hill radius'),captureTicks:num(h.captureTicks??100,1,72000,'hill capture duration',true),holdTicks:num(h.holdTicks??2400,1,72000,'hill hold duration',true)},
 relic:{count:num(l.count??3,1,8,'relic count',true),required:num(l.required??2,1,8,'required relics',true),holdTicks:num(l.holdTicks??2400,1,72000,'relic defense duration',true),pickupRadius:num(l.pickupRadius??1.5,.5,4,'relic pickup radius')},
 survival:{defenderTeam:num(s.defenderTeam??0,0,7,'defender team',true) as TeamId,waveCount:num(s.waveCount??5,1,20,'wave count',true),intervalTicks:num(s.intervalTicks??1200,20,72000,'wave interval',true),recoveryTicks:num(s.recoveryTicks??400,1,72000,'recovery duration',true),unitsPerWave:num(s.unitsPerWave??2,1,20,'wave size',true),rewardPerWave:money(s.rewardPerWave??{wood:60,ore:30,crystal:0},'wave reward')},
 draft:{enabled:bool(d.enabled??false,'draft enabled'),banRounds:num(d.banRounds??1,0,2,'ban rounds',true),pickRounds:num(d.pickRounds??3,1,6,'pick rounds',true),turnTicks:num(d.turnTicks??600,20,2400,'draft turn duration',true)}};
 if(rules.mode==='annihilation'&&!rules.standardDefeat)throw new Error('Annihilation requires headquarters defeat.');
 if(rules.mode==='survival'&&rules.standardDefeat)throw new Error('Survival must use its defender and wave defeat rules.');
 if(rules.relic.required>rules.relic.count)throw new Error('Required relic count exceeds the available relics.');
 return rules;
}
const draftOptions=(factionId:MatchPlayerConfig['factionId'],content?:ContentBundle)=>{const context=factionContext(factionId,content);return [...availableUnits(context,0).filter(u=>u.role!=='worker').map(u=>u.id),...Object.keys(upgradesFor(context,0)).filter(id=>!['town-age','citadel-age'].includes(id))];};
export function createDraft(players:Pick<MatchPlayerConfig,'id'|'factionId'>[],rules:MatchRules,content?:ContentBundle):DraftState {
 const pool=[...new Set(players.flatMap(p=>draftOptions(p.factionId,content)))].filter(id=>!rules.disabledDefinitionIds.includes(id)),order:DraftState['order']=[];
 if(rules.draft.enabled){for(let round=0;round<rules.draft.banRounds;round++)for(const p of round%2?[...players].reverse():players)order.push({side:p.id,action:'ban'});for(let round=0;round<rules.draft.pickRounds;round++)for(const p of round%2?[...players].reverse():players)order.push({side:p.id,action:'pick'});}
 // All turns must retain enough legal choices, even for eight mirror-faction slots.
 if(rules.draft.enabled&&players.some(p=>draftOptions(p.factionId,content).filter(id=>pool.includes(id)).length<rules.draft.pickRounds+rules.draft.banRounds*players.length||!availableUnits(factionContext(p.factionId,content),0).some(u=>u.role!=='worker'&&pool.includes(u.id))))throw new Error('Draft has too many bans/picks for the available faction definitions. Reduce bans or picks.');
 return {status:order.length?'drafting':'complete',turn:0,remainingTicks:order.length?rules.draft.turnTicks:0,order,banned:[],picks:players.map(()=>[]),pool};
}
export function legalDraftChoices(draft:DraftState,players:Pick<MatchPlayerConfig,'id'|'factionId'>[],side:Side,content?:ContentBundle):string[]{
 const turn=draft.order[draft.turn];if(draft.status!=='drafting'||turn?.side!==side)return [];
 const pickGoal=(id:Side)=>draft.order.filter(t=>t.side===id&&t.action==='pick').length;
 return draft.pool.filter(id=>{
  if(draft.banned.includes(id)||draft.picks[side]?.includes(id))return false;
  if(turn.action==='ban')return players.every(p=>draftOptions(p.factionId,content).filter(option=>draft.pool.includes(option)&&option!==id&&!draft.banned.includes(option)).length>=pickGoal(p.id)&&combatIds(p.factionId,content).some(option=>draft.pool.includes(option)&&option!==id&&!draft.banned.includes(option)));
  if(!draftOptions(players[side].factionId,content).includes(id))return false;
  return draft.picks[side].length!==pickGoal(side)-1||draft.picks[side].some(option=>combatIds(players[side].factionId,content).includes(option))||combatIds(players[side].factionId,content).includes(id);
 });
}
const combatIds=(factionId:MatchPlayerConfig['factionId'],content?:ContentBundle)=>availableUnits(factionContext(factionId,content),0).filter(u=>u.role!=='worker').map(u=>u.id);
export function applyDraftChoice(draft:DraftState,rules:MatchRules,players:Pick<MatchPlayerConfig,'id'|'factionId'>[],side:Side,definitionId:string,content?:ContentBundle):boolean {
 const turn=draft.order[draft.turn];if(draft.status!=='drafting'||!turn||turn.side!==side||!legalDraftChoices(draft,players,side,content).includes(definitionId))return false;
 // A ban is rejected when it would leave any faction unable to finish its picks.
 if(turn.action==='pick'&&draft.picks[side].length===rules.draft.pickRounds-1&&!draft.picks[side].some(id=>combatIds(players[side].factionId,content).includes(id))&&!combatIds(players[side].factionId,content).includes(definitionId))return false;
 if(turn.action==='ban'&&players.some(p=>draftOptions(p.factionId,content).filter(id=>draft.pool.includes(id)&&id!==definitionId&&!draft.banned.includes(id)).length<rules.draft.pickRounds||!combatIds(p.factionId,content).some(id=>draft.pool.includes(id)&&id!==definitionId&&!draft.banned.includes(id))))return false;
 if(turn.action==='pick')draft.picks[side].push(definitionId);else draft.banned.push(definitionId);
 draft.turn++;draft.status=draft.turn===draft.order.length?'complete':'drafting';draft.remainingTicks=draft.status==='complete'?0:rules.draft.turnTicks;return true;
}
export function tickDraft(draft:DraftState,rules:MatchRules,players:Pick<MatchPlayerConfig,'id'|'factionId'>[],content?:ContentBundle):boolean {
 if(draft.status==='complete')return false;if(--draft.remainingTicks>0)return false;
 const turn=draft.order[draft.turn],choices=legalDraftChoices(draft,players,turn.side,content);
 for(const id of choices)if(applyDraftChoice(draft,rules,players,turn.side,id,content))return true;
 throw new Error('Draft turn has no legal choices.');
}
export function draftDefinitions(state:Pick<GameState,'players'|'content'>){return [...new Map(state.players.flatMap((_,side)=>[...availableUnits(state,side as Side),...Object.values(upgradesFor(state,side as Side))]).map(definition=>[definition.id,{id:definition.id,name:definition.name}])).values()];}
export function draftPlayers(state:GameState):Pick<MatchPlayerConfig,'id'|'factionId'>[]{return state.players.map((p,id)=>({id:id as Side,factionId:p.faction}));}
export function definitionAllowed(state:GameState,side:Side,id:string):boolean {
 if(state.rules.disabledDefinitionIds.includes(id)||state.draft.banned.includes(id))return false;
 const necessary=id==='town-age'||id==='citadel-age'||availableUnits(state,side).some(unit=>unit.role==='worker'&&unit.id===id);
 return !state.rules.draft.enabled||necessary||state.draft.status==='complete'&&state.draft.picks[side].includes(id);
}
export function validateModeRoster(state:GameState):void {
 if(state.rules.mode!=='survival')return;
 if(!state.teams.includes(state.rules.survival.defenderTeam)||new Set(state.teams).size!==2)throw new Error('Survival requires a defender team and one opposing wave team.');
 if(state.draft.status==='complete'&&state.players.some((_player,side)=>state.teams[side]!==state.rules.survival.defenderTeam&&!availableUnits(state,side as Side).some(unit=>unit.role!=='worker'&&definitionAllowed(state,side as Side,unit.id))))throw new Error('Every wave slot needs an enabled combat unit.');
}

/** Validate the stored turn history by replaying every legal choice from the rules. */
export function validateDraftState(value:unknown,players:Pick<MatchPlayerConfig,'id'|'factionId'>[],rules:MatchRules,content?:ContentBundle):DraftState {
 const d=fields(value,['status','turn','remainingTicks','order','banned','picks','pool'],'draft state'),expected=createDraft(players,rules,content);
 const turn=num(d.turn,0,expected.order.length,'draft turn',true);
 if(JSON.stringify(d.order)!==JSON.stringify(expected.order)||JSON.stringify(d.pool)!==JSON.stringify(expected.pool))throw new Error('Draft order or pool differs from the match rules.');
 if(!Array.isArray(d.banned)||!Array.isArray(d.picks)||d.picks.length!==players.length||d.picks.some(p=>!Array.isArray(p)||p.length>rules.draft.pickRounds||p.some(id=>typeof id!=='string')))throw new Error('Invalid saved draft choices.');
 const choices=d.picks as string[][];
 const picked=players.map(()=>0);let banned=0;
 for(let i=0;i<turn;i++){const action=expected.order[i],id=action.action==='ban'?d.banned[banned++]:choices[action.side][picked[action.side]++];if(typeof id!=='string'||!applyDraftChoice(expected,rules,players,action.side,id,content))throw new Error('Saved draft contains an illegal choice.');}
 if(banned!==d.banned.length||picked.some((count,side)=>count!==choices[side].length)||d.status!==expected.status)throw new Error('Saved draft choices do not match its turn.');
 expected.remainingTicks=num(d.remainingTicks,expected.status==='drafting'?1:0,expected.status==='drafting'?rules.draft.turnTicks:0,'remaining draft ticks',true);return expected;
}
export function validateSavedRules(value:unknown,content?:ContentBundle):MatchRules {
 const required=['mode','standardDefeat','startingAge','sharedVision','friendlyFire','startingResources','disabledDefinitionIds','hill','relic','survival','draft'];const r=fields(value,required,'saved rules');if(required.some(key=>!Object.hasOwn(r,key)))throw new Error('Saved match rules are incomplete.');
 for(const [key,names] of [['hill',['radius','captureTicks','holdTicks']],['relic',['count','required','holdTicks','pickupRadius']],['survival',['defenderTeam','waveCount','intervalTicks','recoveryTicks','unitsPerWave','rewardPerWave']],['draft',['enabled','banRounds','pickRounds','turnTicks']]] as const){const nested=fields(r[key],[...names],`saved ${key} rules`);if(names.some(name=>!Object.hasOwn(nested,name)))throw new Error(`Saved ${key} rules are incomplete.`);}
 return normalizeMatchRules(r,content);
}
export function validateObjectiveState(value:unknown,state:GameState):ObjectiveState {
 const o=fields(value,['hill','relics','relicHoldTicks','survival'],'objective state'),h=fields(o.hill,['x','y','level','ownerTeam','captureTeam','captureTicks','holdTicks','contested'],'hill state'),wave=fields(o.survival,['wave','nextWaveTick','spawnedIds','phase'],'survival state');
 const team=(v:unknown)=>{if(v===null)return null;const id=num(v,0,7,'objective team',true) as Side;if(!state.teams.includes(id))throw new Error('Objective refers to an absent team.');return id;};
 const point=(p:Record<string,unknown>)=>({x:num(p.x,0,state.width,'objective x'),y:num(p.y,0,state.height,'objective y'),...(p.level===undefined?{}:{level:num(p.level,0,(state.world?.levels.length??1)-1,'objective level',true)})});
 const hill:ObjectiveState['hill']={...point(h),ownerTeam:team(h.ownerTeam),captureTeam:team(h.captureTeam),captureTicks:num(h.captureTicks,0,state.rules.hill.captureTicks,'hill capture ticks',true),holdTicks:num(h.holdTicks,0,state.rules.hill.holdTicks,'hill hold ticks',true),contested:bool(h.contested,'contested hill')};
 if(!Array.isArray(o.relics)||o.relics.length!==(state.rules.mode==='relic'?state.rules.relic.count:0))throw new Error('Invalid saved relic count.');
 const relics:ObjectiveState['relics']=o.relics.map((v,i)=>{const r=fields(v,['id','x','y','level','carrierId','heldTeam'],'relic state');if(r.id!==i+1)throw new Error('Invalid saved relic ID.');const carrierId=r.carrierId===null?null:num(r.carrierId,1,state.nextId-1,'relic carrier ID',true);if(carrierId!==null&&!state.entities.some(e=>e.id===carrierId&&e.kind==='unit'&&e.hp>0&&!e.illusion))throw new Error('Relic carrier must be a living ordinary unit.');if(carrierId!==null&&levelOf(r as unknown as {x:number;y:number;level?:number})!==levelOf(state.entities.find(e=>e.id===carrierId)!))throw new Error('Relic and carrier must share a map level.');const heldTeam=team(r.heldTeam);if(carrierId!==null&&heldTeam!==null)throw new Error('Carried relic cannot be held in a shrine.');return {id:i+1,...point(r),carrierId,heldTeam};});
 const carriers=relics.flatMap(r=>r.carrierId===null?[]:[r.carrierId]);if(new Set(carriers).size!==carriers.length)throw new Error('Unit cannot carry multiple relics.');
 if(!Array.isArray(o.relicHoldTicks)||o.relicHoldTicks.length!==8)throw new Error('Invalid relic defense counters.');const relicHoldTicks=o.relicHoldTicks.map(v=>num(v,0,state.rules.relic.holdTicks,'relic defense counter',true));
 if(!Array.isArray(wave.spawnedIds)||wave.spawnedIds.length>state.rules.survival.unitsPerWave*state.rules.survival.waveCount)throw new Error('Invalid survival wave IDs.');const spawnedIds=wave.spawnedIds.map(v=>num(v,1,state.nextId-1,'wave entity ID',true));if(new Set(spawnedIds).size!==spawnedIds.length)throw new Error('Duplicate survival attacker ID.');
 if(!['waiting','fighting','recovery','complete'].includes(wave.phase as string))throw new Error('Unknown survival phase.');
 return {hill,relics,relicHoldTicks,survival:{wave:num(wave.wave,0,state.rules.survival.waveCount,'survival wave',true),nextWaveTick:num(wave.nextWaveTick,0,1e12,'next wave tick',true),spawnedIds,phase:wave.phase as ObjectiveState['survival']['phase']}};
}
