import type { BuildingRole, Entity, FactionDef, UnitRole, Vec } from './types';

export type AiDifficulty = 'easy' | 'normal' | 'hard';
export type AiPersonality = 'balanced' | 'rush' | 'fortify' | 'expand' | 'raid';
export type AiOpening = 'infantry-rush' | 'tower-defense' | 'fast-expansion' | 'cavalry-raids';
export interface AiConfig { difficulty:AiDifficulty; personality:AiPersonality; opening:AiOpening }
export const DEFAULT_AI_CONFIG:Readonly<AiConfig> = {difficulty:'normal',personality:'balanced',opening:'infantry-rush'};
export const AI_PERSONALITIES:Record<AiPersonality,{name:string;description:string;opening:AiOpening}> = {
 balanced:{name:'Balanced',description:'Builds an economy and a mixed army.',opening:'infantry-rush'},
 rush:{name:'Rush',description:'Attacks early with infantry and delays economy upgrades.',opening:'infantry-rush'},
 fortify:{name:'Fortify',description:'Builds towers before committing to a large attack.',opening:'tower-defense'},
 expand:{name:'Expand',description:'Prioritizes workers and a second resource base.',opening:'fast-expansion'},
 raid:{name:'Raid',description:'Uses small mobile groups to attack observed workers and depots.',opening:'cavalry-raids'},
};
export const AI_OPENINGS:Record<AiOpening,{name:string;plan:string;weakness:string}> = {
 'infantry-rush':{name:'Infantry rush',plan:'Barracks first, then an early infantry attack.',weakness:'The first attack leaves few defenders at home.'},
 'tower-defense':{name:'Tower defense',plan:'Tower first, then barracks and a defensive army.',weakness:'Early spending on towers slows mobile troops and expansion.'},
 'fast-expansion':{name:'Fast expansion',plan:'Depot first, more workers, then an observed outer resource base.',weakness:'Extra workers and buildings delay the first army.'},
 'cavalry-raids':{name:'Cavalry raids',plan:'Barracks first, advance age, then recruit cavalry for raids.',weakness:'The army is small before cavalry becomes available; spears counter it.'},
};
export interface AiProfile {
 decisionInterval:number; mistakeEvery:number; counterStrength:number; trainingQueue:number;
 retreatHealth:number; retreatRatio:number; regroupSeconds:number; workerTarget:number;
 attackSizeFactor:number; waveIntervalFactor:number; expansionWorkers:number; scoutAt:number;
}
export function normalizeAiConfig(input?:Partial<AiConfig>):AiConfig {
 if(input!==undefined&&(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['difficulty','personality','opening'].includes(key))))throw new Error('Invalid AI configuration.');
 const difficulty=input?.difficulty??DEFAULT_AI_CONFIG.difficulty,personality=input?.personality??DEFAULT_AI_CONFIG.personality;
 if(!['easy','normal','hard'].includes(difficulty))throw new Error('Unknown AI difficulty.');
 if(!Object.hasOwn(AI_PERSONALITIES,personality))throw new Error('Unknown AI personality.');
 const opening=input?.opening??AI_PERSONALITIES[personality].opening;
 if(!Object.hasOwn(AI_OPENINGS,opening))throw new Error('Unknown AI opening.');
 return {difficulty,personality,opening};
}
export function aiProfile(config:AiConfig):AiProfile {
 const difficulty:Record<AiDifficulty,Pick<AiProfile,'decisionInterval'|'mistakeEvery'|'counterStrength'|'trainingQueue'|'retreatHealth'|'retreatRatio'|'regroupSeconds'>> = {
 easy:{decisionInterval:2.8,mistakeEvery:5,counterStrength:0,trainingQueue:1,retreatHealth:.18,retreatRatio:2.5,regroupSeconds:24},
 normal:{decisionInterval:1,mistakeEvery:0,counterStrength:.65,trainingQueue:2,retreatHealth:.3,retreatRatio:1.65,regroupSeconds:18},
 hard:{decisionInterval:.55,mistakeEvery:0,counterStrength:1.25,trainingQueue:3,retreatHealth:.4,retreatRatio:1.35,regroupSeconds:12},
 };
 const personality:Record<AiPersonality,Pick<AiProfile,'workerTarget'|'attackSizeFactor'|'waveIntervalFactor'|'expansionWorkers'|'scoutAt'>> = {
 balanced:{workerTarget:13,attackSizeFactor:1,waveIntervalFactor:1,expansionWorkers:13,scoutAt:65},
 rush:{workerTarget:9,attackSizeFactor:.65,waveIntervalFactor:.55,expansionWorkers:16,scoutAt:35},
 fortify:{workerTarget:13,attackSizeFactor:1.4,waveIntervalFactor:1.4,expansionWorkers:15,scoutAt:80},
 expand:{workerTarget:17,attackSizeFactor:1.2,waveIntervalFactor:1.2,expansionWorkers:10,scoutAt:45},
 raid:{workerTarget:12,attackSizeFactor:.55,waveIntervalFactor:.55,expansionWorkers:13,scoutAt:35},
 };
 return {...difficulty[config.difficulty],...personality[config.personality]};
}
export function skipsAiDecision(config:AiConfig,turn:number):boolean {
 const every=aiProfile(config).mistakeEvery;return every>0&&turn>0&&turn%every===0;
}
export function openingBuilding(config:AiConfig,roles:readonly BuildingRole[]):BuildingRole|undefined {
 const first:BuildingRole=config.opening==='tower-defense'?'tower':config.opening==='fast-expansion'?'depot':'barracks';
 if(!roles.includes(first))return first;
 if(!roles.includes('barracks'))return 'barracks';
}
export interface EnemyObservation extends Vec { role:UnitRole; seenAt:number; hpFraction:number }
export type EnemyMemory = Map<number,EnemyObservation>;
/** Callers supply only visible hostiles. This function never reads the full match. */
export function rememberObservedUnits(memory:EnemyMemory,visible:readonly Entity[],time:number):void {
 for(const [id,observation] of memory)if(time-observation.seenAt>90)memory.delete(id);
 for(const enemy of visible)if(enemy.kind==='unit'&&enemy.role!=='worker'&&!enemy.illusion&&enemy.hp>0)memory.set(enemy.id,{role:enemy.role as UnitRole,x:enemy.x,y:enemy.y,seenAt:time,hpFraction:enemy.hp/enemy.maxHp});
}
export function counterWeights(faction:FactionDef,config:AiConfig,observed:Iterable<EnemyObservation>):Partial<Record<UnitRole,number>> {
 const weights:Partial<Record<UnitRole,number>>={...faction.ai.composition,spear:.1,cavalry:.16,siege:.18};
 if(config.opening==='infantry-rush'&&config.personality==='rush'){weights.melee=(weights.melee??.25)+.3;weights.siege=.08;}
 if(config.personality==='raid'||config.opening==='cavalry-raids'){weights.cavalry=.65;weights.siege=.05;}
 if(config.personality==='fortify'){weights.ranged=(weights.ranged??.25)+.2;weights.spear=.2;}
 const composition:Partial<Record<UnitRole,number>>={};let total=0;
 for(const unit of observed){composition[unit.role]=(composition[unit.role]??0)+1;total++;}
 if(total){const strength=aiProfile(config).counterStrength;weights.spear=(weights.spear??0)+strength*(composition.cavalry??0)/total;weights.cavalry=(weights.cavalry??0)+strength*((composition.ranged??0)+(composition.siege??0))/total;weights.ranged=(weights.ranged??0)+strength*((composition.melee??0)+(composition.spear??0))/total;}
 return weights;
}
export function chooseAiRecruit(roles:readonly UnitRole[],planned:readonly (UnitRole|BuildingRole)[],weights:Partial<Record<UnitRole,number>>):UnitRole|undefined {
 const total=roles.reduce((sum,role)=>sum+(weights[role]??.1),0);
 return [...roles].sort((a,b)=>((planned.length+1)*(weights[b]??.1)/total-planned.filter(role=>role===b).length)-((planned.length+1)*(weights[a]??.1)/total-planned.filter(role=>role===a).length))[0];
}
export function shouldRetreat(config:AiConfig,unit:Entity,nearbyAllies:readonly Entity[],visibleEnemies:readonly Entity[]):boolean {
 if(!visibleEnemies.length)return false;
 const profile=aiProfile(config);
 if(unit.hp/unit.maxHp<profile.retreatHealth)return true;
 const ownStrength=nearbyAllies.reduce((sum,e)=>sum+e.hp/e.maxHp,0),enemyStrength=visibleEnemies.reduce((sum,e)=>sum+e.hp/e.maxHp,0);
 return enemyStrength>Math.max(1,ownStrength)*profile.retreatRatio;
}
