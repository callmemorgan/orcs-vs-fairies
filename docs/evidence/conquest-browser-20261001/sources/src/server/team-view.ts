import type { PlayerObservation } from '../online/protocol';
import type { Side } from '../core/types';

/** Merge historical permitted teammate frames; never consult live authoritative state. */
export function teamObservation(views:PlayerObservation[],perspective:Side):PlayerObservation {
  const base=views[perspective],members=views.filter(view=>view.teamId===base.teamId);
  const visible=new Set(members.flatMap(view=>view.visible));
  const entities=new Map<number,PlayerObservation['entities'][number]>(),resources=new Map<number,PlayerObservation['resources'][number]>();
  const corpses=new Map<number,PlayerObservation['corpses'][number]>();
  const events=new Map<string,PlayerObservation['events'][number]>();
  for(const view of members){
    for(const entity of view.entities){const existing=entities.get(entity.id);if(!existing||entity.side===view.side)entities.set(entity.id,entity);}
    for(const resource of view.resources){const existing=resources.get(resource.id);if(!existing||resource.lastSeen>=existing.lastSeen)resources.set(resource.id,resource);}
    for(const corpse of view.corpses)corpses.set(corpse.id,corpse);
    for(const event of view.events){
      const key=event.eventId??JSON.stringify(event),existing=events.get(key);
      if(!existing){events.set(key,event);continue;}
      // A victim-only observation can relocate an unseen hit. Keep a known source's location.
      const location=existing.source!==undefined?existing:event.source!==undefined?event:existing;
      events.set(key,{...existing,...event,x:location.x,y:location.y});
    }
  }
  return {...base,teamPerspective:true,teamPlayers:members.map(view=>({side:view.side,player:view.player})),
    entities:[...entities.values()].sort((a,b)=>a.id-b.id),resources:[...resources.values()].sort((a,b)=>a.id-b.id).map(resource=>({...resource,visible:visible.has(Math.floor(resource.y)*base.map.width+Math.floor(resource.x))})),corpses:[...corpses.values()].sort((a,b)=>a.id-b.id),events:[...events.values()].sort((a,b)=>a.tick-b.tick),
    map:{...base.map,terrain:base.map.terrain.map((tile,index)=>tile??members.map(view=>view.map.terrain[index]).find(tile=>tile!==null)??null),starts:base.map.starts.map((point,index)=>point??members.map(view=>view.map.starts[index]).find(point=>point!==null)??null)},
    visible:[...visible].sort((a,b)=>a-b),explored:[...new Set(members.flatMap(view=>view.explored))].sort((a,b)=>a-b)};
}
