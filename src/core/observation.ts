import { ABILITIES, FACTIONS, UPGRADES } from './content';
import { isGameOver, isVisible } from './simulation';
import type { GameEvent, GameState, ResourceNode, Side } from './types';

/** Resource memory contains only values observed while a node was visible. */
export class PlayerView {
 private state:GameState|undefined;
 private resources=new Map<number,ResourceNode & {lastSeen:number}>();
 constructor(readonly side:Side){}
 update(s:GameState){
  if(this.state!==s){this.resources.clear();this.state=s;}
  for(const r of s.resources)if(isVisible(s,this.side,r.x,r.y))this.resources.set(r.id,{...r,lastSeen:s.time});
 }
 resourcesFor(s:GameState){this.update(s);return [...this.resources.values()].map(r=>({...r,visible:isVisible(s,this.side,r.x,r.y)}));}
 events(s:GameState):GameEvent[]{return s.events.filter(e=>e.side===this.side||isVisible(s,this.side,e.x,e.y)).map(e=>({...e}));}
 observe(s:GameState){
  this.update(s);const side=this.side;
  return {
   version:1,tick:s.tick,time:s.time,side,controller:s.controllers[side],
   map:{size:s.mapSize,width:s.width,height:s.height,version:s.mapVersion,seed:s.seed,starts:s.starts.map(p=>({...p})),terrain:s.terrain.map((t,i)=>s.explored[side].has(i)?t:null)},
   player:{...s.players[side]},opponent:{side:1-side,faction:s.players[side===0?1:0].faction},
   entities:s.entities.filter(e=>e.hp>0&&(e.side===side||isVisible(s,side,e.x,e.y))).map(e=>{
    const publicFields={id:e.id,side:e.side,kind:e.kind,role:e.role,x:e.x,y:e.y,hp:e.hp,maxHp:e.maxHp,progress:e.progress,shield:e.shield,maxShield:e.maxShield,illusion:e.illusion,raised:e.raised,entrenchedAt:e.entrenchedAt,surgeUntil:e.surgeUntil};
    return e.side===side?{...publicFields,order:{...e.order},queue:[...e.queue],rally:e.rally?{...e.rally}:undefined,trainProgress:e.trainProgress,research:e.research,researchProgress:e.researchProgress,carried:e.carried,carriedKind:e.carriedKind,cooldown:e.cooldown,abilityReadyAt:e.abilityReadyAt,expires:e.expires}:publicFields;
   }),
   resources:this.resourcesFor(s),
   corpses:s.corpses.filter(c=>isVisible(s,side,c.x,c.y)).map(c=>({...c})),
   visible:[...s.visible[side]].sort((a,b)=>a-b),explored:[...s.explored[side]].sort((a,b)=>a-b),
   content:{faction:FACTIONS[s.players[side].faction],abilities:ABILITIES,upgrades:UPGRADES},
   result:{finished:isGameOver(s),winner:s.winner,draw:s.draw}
  };
 }
}
