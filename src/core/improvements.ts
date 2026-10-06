import type { GameState, ImprovementCommand, JsonValue, Side } from './types';

/** Rules are opt-in: registration alone does not enable a rule in a match. */
export interface GameImprovement {
  id:string;
  initialState:(options:JsonValue)=>JsonValue;
  start?:(game:GameState, options:JsonValue, state:JsonValue)=>void;
  validate?:(game:GameState, side:Side, command:ImprovementCommand, state:JsonValue)=>boolean;
  command?:(game:GameState, side:Side, command:ImprovementCommand, state:JsonValue)=>boolean;
  step?:(game:GameState, dt:number, state:JsonValue)=>void;
  observe?:(game:GameState, side:Side, state:JsonValue)=>JsonValue;
}
const rules=new Map<string,GameImprovement>();
export function registerGameImprovement(rule:GameImprovement):()=>void {
  if(!rule.id||rules.has(rule.id))throw new Error(`Duplicate or empty improvement id: ${rule.id}`);
  rules.set(rule.id,rule);
  return ()=>{if(rules.get(rule.id)===rule)rules.delete(rule.id);};
}
export function isJsonValue(value:unknown):value is JsonValue {
  if(value===null||typeof value==='string'||typeof value==='boolean')return true;
  if(typeof value==='number')return Number.isFinite(value);
  if(Array.isArray(value)){
    for(let i=0;i<value.length;i++)if(!Object.hasOwn(value,i)||!isJsonValue(value[i]))return false;
    return true;
  }
  return typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype&&Object.values(value).every(isJsonValue);
}
export function startImprovements(game:GameState,options:Record<string,JsonValue>={}):void {
  for(const id of Object.keys(options).sort()){
    const option=options[id],rule=rules.get(id);if(!rule)continue;
    if(!isJsonValue(option))throw new Error(`Improvement options must be JSON: ${id}`);
    const savedOptions=structuredClone(option),state=rule.initialState(savedOptions);
    if(!isJsonValue(state))throw new Error(`Improvement state must be JSON: ${id}`);
    const entry={options:savedOptions,state:structuredClone(state)};
    (game.improvements??=Object.create(null))[id]=entry;
    rule.start?.(game,entry.options,entry.state);
  }
}
export function commandImprovement(game:GameState,side:Side,command:ImprovementCommand):boolean {
  const rule=rules.get(command.improvement),entry=game.improvements?.[command.improvement];
  if(!rule?.validate||!rule.command||!entry||typeof command.action!=='string'||!Array.isArray(command.ids)||!command.ids.every(id=>game.entities.some(e=>e.id===id&&e.side===side&&e.hp>0))||command.payload!==undefined&&!isJsonValue(command.payload))return false;
  return rule.validate(game,side,command,entry.state)&&rule.command(game,side,command,entry.state);
}
export function stepImprovements(game:GameState,dt:number):void {
  for(const id of Object.keys(game.improvements??{}).sort())rules.get(id)?.step?.(game,dt,game.improvements![id].state);
}

/** A rule must explicitly choose what state the player is allowed to see. */
export function observeImprovements(game:GameState,side:Side):Record<string,JsonValue> {
  const observed:Record<string,JsonValue>=Object.create(null);
  for(const id of Object.keys(game.improvements??{}).sort()){
    const entry=game.improvements![id],rule=rules.get(id);
    if(rule?.observe)observed[id]=structuredClone(rule.observe(game,side,entry.state));
  }
  return observed;
}
