import { FACTIONS, UPGRADES } from './content';
import type { Age, Cost, GameState, MatchPlayerConfig, Side, TeamId } from './types';

export interface MatchRules {
 mode:'annihilation'|'hill'|'relic'|'survival'|'scenario'; standardDefeat:boolean;
 startingAge:Age; sharedVision:boolean; startingResources:Cost; disabledDefinitionIds:string[];
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
 hill:{x:number;y:number;ownerTeam:TeamId|null;captureTeam:TeamId|null;captureTicks:number;holdTicks:number;contested:boolean};
 relics:Array<{id:number;x:number;y:number;carrierId:number|null;heldTeam:TeamId|null}>;
 relicHoldTicks:number[];
 survival:{wave:number;nextWaveTick:number;spawnedIds:number[];phase:'waiting'|'fighting'|'recovery'|'complete'};
}
export const RULE_TICK_RATE=20;
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
function fields(value:unknown,allowed:string[],name:string):Record<string,unknown>{if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw new Error(`Invalid ${name}.`);return value;}
function num(value:unknown,min:number,max:number,name:string,integer=false):number {if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isSafeInteger(value)))throw new Error(`Invalid ${name}.`);return value;}
function bool(value:unknown,name:string):boolean {if(typeof value!=='boolean')throw new Error(`Invalid ${name}.`);return value;}
function money(value:unknown,name:string):Cost {const c=fields(value,['wood','ore','crystal'],name);return {wood:num(c.wood,0,1e9,`${name} wood`),ore:num(c.ore,0,1e9,`${name} ore`),crystal:num(c.crystal,0,1e9,`${name} crystal`)};}
export function definitionIds():string[]{return [...new Set([...Object.values(FACTIONS).flatMap(f=>Object.values(f.units).map(u=>u.id)),...Object.keys(UPGRADES)])];}
export function normalizeMatchRules(value:unknown={}):MatchRules {
 const r=fields(value,['mode','standardDefeat','startingAge','sharedVision','startingResources','disabledDefinitionIds','hill','relic','survival','draft'],'match rules');
 const mode=r.mode??'annihilation';if(!['annihilation','hill','relic','survival','scenario'].includes(mode as string))throw new Error('Unknown victory mode.');
 const h=fields(r.hill??{},['radius','captureTicks','holdTicks'],'hill rules'),l=fields(r.relic??{},['count','required','holdTicks','pickupRadius'],'relic rules'),s=fields(r.survival??{},['defenderTeam','waveCount','intervalTicks','recoveryTicks','unitsPerWave','rewardPerWave'],'survival rules'),d=fields(r.draft??{},['enabled','banRounds','pickRounds','turnTicks'],'draft rules');
 const disabled=r.disabledDefinitionIds??[];
 if(!Array.isArray(disabled)||disabled.length>256||disabled.some(id=>typeof id!=='string'||id.length>128||!definitionIds().includes(id))||new Set(disabled).size!==disabled.length)throw new Error('Disabled definitions must be unique known unit or technology IDs.');
 const rules:MatchRules={mode:mode as MatchRules['mode'],standardDefeat:bool(r.standardDefeat??(mode!=='scenario'&&mode!=='survival'),'standard defeat'),startingAge:num(r.startingAge??1,1,3,'starting age',true) as Age,sharedVision:bool(r.sharedVision??true,'shared vision'),startingResources:money(r.startingResources??{wood:420,ore:220,crystal:0},'starting resources'),disabledDefinitionIds:[...disabled],
 hill:{radius:num(h.radius??5,1,12,'hill radius'),captureTicks:num(h.captureTicks??100,1,72000,'hill capture duration',true),holdTicks:num(h.holdTicks??2400,1,72000,'hill hold duration',true)},
 relic:{count:num(l.count??3,1,8,'relic count',true),required:num(l.required??2,1,8,'required relics',true),holdTicks:num(l.holdTicks??2400,1,72000,'relic defense duration',true),pickupRadius:num(l.pickupRadius??1.5,.5,4,'relic pickup radius')},
 survival:{defenderTeam:num(s.defenderTeam??0,0,7,'defender team',true) as TeamId,waveCount:num(s.waveCount??5,1,20,'wave count',true),intervalTicks:num(s.intervalTicks??1200,20,72000,'wave interval',true),recoveryTicks:num(s.recoveryTicks??400,1,72000,'recovery duration',true),unitsPerWave:num(s.unitsPerWave??2,1,20,'wave size',true),rewardPerWave:money(s.rewardPerWave??{wood:60,ore:30,crystal:0},'wave reward')},
 draft:{enabled:bool(d.enabled??false,'draft enabled'),banRounds:num(d.banRounds??1,0,2,'ban rounds',true),pickRounds:num(d.pickRounds??3,1,6,'pick rounds',true),turnTicks:num(d.turnTicks??600,20,2400,'draft turn duration',true)}};
 if(rules.relic.required>rules.relic.count)throw new Error('Required relic count exceeds the available relics.');
 return rules;
}
const draftOptions=(factionId:MatchPlayerConfig['factionId'])=>[...Object.values(FACTIONS[factionId].units).filter(u=>u.role!=='worker').map(u=>u.id),...Object.keys(UPGRADES).filter(id=>!['town-age','citadel-age'].includes(id))];
export function createDraft(players:Pick<MatchPlayerConfig,'id'|'factionId'>[],rules:MatchRules):DraftState {
 const pool=[...new Set(players.flatMap(p=>draftOptions(p.factionId)))].filter(id=>!rules.disabledDefinitionIds.includes(id)),order:DraftState['order']=[];
 if(rules.draft.enabled){for(let round=0;round<rules.draft.banRounds;round++)for(const p of round%2?[...players].reverse():players)order.push({side:p.id,action:'ban'});for(let round=0;round<rules.draft.pickRounds;round++)for(const p of round%2?[...players].reverse():players)order.push({side:p.id,action:'pick'});}
 // All turns must retain enough legal choices, even for eight mirror-faction slots.
 if(rules.draft.enabled&&players.some(p=>draftOptions(p.factionId).filter(id=>pool.includes(id)).length<rules.draft.pickRounds+rules.draft.banRounds*players.length))throw new Error('Draft has too many bans/picks for the available faction definitions. Reduce bans or picks.');
 return {status:order.length?'drafting':'complete',turn:0,remainingTicks:order.length?rules.draft.turnTicks:0,order,banned:[],picks:players.map(()=>[]),pool};
}
export function legalDraftChoices(draft:DraftState,players:Pick<MatchPlayerConfig,'id'|'factionId'>[],side:Side):string[]{return draft.pool.filter(id=>!draft.banned.includes(id)&&!draft.picks[side]?.includes(id)&&(draft.order[draft.turn]?.action==='ban'||draftOptions(players[side].factionId).includes(id)));}
export function applyDraftChoice(draft:DraftState,rules:MatchRules,players:Pick<MatchPlayerConfig,'id'|'factionId'>[],side:Side,definitionId:string):boolean {
 const turn=draft.order[draft.turn];if(draft.status!=='drafting'||!turn||turn.side!==side||!legalDraftChoices(draft,players,side).includes(definitionId))return false;
 // A ban is rejected when it would leave any faction unable to finish its picks.
 if(turn.action==='ban'&&players.some(p=>draftOptions(p.factionId).filter(id=>draft.pool.includes(id)&&id!==definitionId&&!draft.banned.includes(id)).length<rules.draft.pickRounds))return false;
 if(turn.action==='pick')draft.picks[side].push(definitionId);else draft.banned.push(definitionId);
 draft.turn++;draft.status=draft.turn===draft.order.length?'complete':'drafting';draft.remainingTicks=draft.status==='complete'?0:rules.draft.turnTicks;return true;
}
export function tickDraft(draft:DraftState,rules:MatchRules,players:Pick<MatchPlayerConfig,'id'|'factionId'>[]):boolean {
 if(draft.status==='complete')return false;if(--draft.remainingTicks>0)return false;
 const turn=draft.order[draft.turn],choices=legalDraftChoices(draft,players,turn.side);
 for(const id of choices)if(applyDraftChoice(draft,rules,players,turn.side,id))return true;
 throw new Error('Draft turn has no legal choices.');
}
export function draftPlayers(state:GameState):Pick<MatchPlayerConfig,'id'|'factionId'>[]{return state.players.map((p,id)=>({id:id as Side,factionId:p.faction}));}
export function definitionAllowed(state:GameState,side:Side,id:string):boolean {
 if(state.rules.disabledDefinitionIds.includes(id)||state.draft.banned.includes(id))return false;
 const necessary=id==='town-age'||id==='citadel-age'||id===FACTIONS[state.players[side].faction].units.worker.id;
 return !state.rules.draft.enabled||necessary||state.draft.status==='complete'&&state.draft.picks[side].includes(id);
}
