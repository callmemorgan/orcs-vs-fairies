import { fogKey, levelOf, sameLevel } from '../core/world-map';
import type { Entity, GameState } from '../core/types';
import { ownershipRelation } from '../game/Appearance';

export type MinimapAlertKind = 'raid' | 'expansion' | 'idle';
export interface MinimapAlert { id:string;kind:MinimapAlertKind;x:number;y:number;level?:number;entity:number;label:string;expires:number }
const DAMAGE_SECONDS=8,IDLE_SECONDS=12,THREAT_DISTANCE=6;
type AlertState=GameState&{teams?:readonly number[]};

/** The tracker reads only own information or entities inside the viewer's current vision. */
export class MinimapAlerts {
  private idleSince=new Map<number,number>();
  private attackedAt=new Map<number,number>();
  private lastTime=-Infinity;
  private lastTick=-Infinity;
  private match='';
  private entries:MinimapAlert[]=[];
  reset(){this.idleSince.clear();this.attackedAt.clear();this.entries=[];this.match='';this.lastTime=-Infinity;this.lastTick=-Infinity;}
  update(state:AlertState,viewer:number):readonly MinimapAlert[] {
    const match=JSON.stringify([state.seed,state.width,state.height,viewer,state.starts,state.teams]);
    if(match!==this.match||state.time<this.lastTime||state.tick<this.lastTick)this.reset();
    const newTick=state.tick!==this.lastTick;
    this.match=match;this.lastTime=state.time;this.lastTick=state.tick;
    const visible=(e:Entity)=>e.side===viewer||!!state.visible[viewer]?.has(fogKey(state,e));
    const friends=state.entities.filter(e=>ownershipRelation(e.side,viewer,state.teams)!=='enemy'&&visible(e));
    const enemies=state.entities.filter(e=>e.hp>0&&e.kind==='unit'&&e.role!=='worker'&&ownershipRelation(e.side,viewer,state.teams)==='enemy'&&visible(e));
    if(newTick)for(const event of state.events)if(event.type==='attack'&&event.target!==undefined){const target=friends.find(e=>e.id===event.target);if(target?.side===viewer)this.attackedAt.set(target.id,state.time);}
    for(const [id,at] of this.attackedAt)if(state.time-at>=DAMAGE_SECONDS)this.attackedAt.delete(id);
    const idle=new Set<number>();
    const alerts:MinimapAlert[]=[];
    for(const target of friends){
      const damagedAt=Math.max(target.side===viewer?target.lastDamagedAt??-Infinity:-Infinity,this.attackedAt.get(target.id)??-Infinity);
      const recentDamage=damagedAt<=state.time&&state.time-damagedAt<DAMAGE_SECONDS;
      const threatened=target.hp>0&&target.kind==='building'&&enemies.some(enemy=>sameLevel(enemy,target)&&Math.hypot(enemy.x-target.x,enemy.y-target.y)<=THREAT_DISTANCE);
      if(recentDamage||threatened){
        const start=state.starts[target.side];
        const expansion=target.kind==='building'&&!!start&&Math.hypot(target.x-start.x,target.y-start.y)>10;
        alerts.push({id:`${expansion?'expansion':'raid'}:${target.id}`,kind:expansion?'expansion':'raid',x:target.x,y:target.y,...(target.level===undefined?{}:{level:target.level}),entity:target.id,label:expansion?'Expansion threatened':'Under attack',expires:threatened?state.time+DAMAGE_SECONDS:damagedAt+DAMAGE_SECONDS});
      }
      // An idle queue is private. Only the viewer's own recruitment buildings qualify.
      if(target.side===viewer&&target.hp>0&&target.kind==='building'&&target.progress===1&&(target.role==='hq'||target.role==='barracks')&&!target.queue.length&&!target.research){
        idle.add(target.id);
        const since=this.idleSince.get(target.id)??state.time;this.idleSince.set(target.id,since);
        if(state.time-since>=IDLE_SECONDS)alerts.push({id:`idle:${target.id}`,kind:'idle',x:target.x,y:target.y,...(target.level===undefined?{}:{level:target.level}),entity:target.id,label:'Recruitment idle',expires:Infinity});
      }
    }
    // A visible approaching raider may be shown, but its marker disappears on losing vision.
    for(const enemy of enemies)if(friends.some(friend=>friend.hp>0&&sameLevel(friend,enemy)&&(friend.kind==='building'||friend.role==='worker')&&Math.hypot(friend.x-enemy.x,friend.y-enemy.y)<=THREAT_DISTANCE))alerts.push({id:`raid:${enemy.id}`,kind:'raid',x:enemy.x,y:enemy.y,...(enemy.level===undefined?{}:{level:enemy.level}),entity:enemy.id,label:'Visible raid',expires:state.time+DAMAGE_SECONDS});
    for(const id of this.idleSince.keys())if(!idle.has(id))this.idleSince.delete(id);
    this.entries=alerts.sort((a,b)=>a.kind.localeCompare(b.kind)||a.entity-b.entity);
    return this.entries;
  }
  get current():readonly MinimapAlert[]{return this.entries;}
}
