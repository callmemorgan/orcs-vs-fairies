import type { PlayerObservation } from '../online/protocol';
import type { Side } from '../core/types';
import type { EconomyView } from '../core/economy-types';

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
      events.set(key,{...existing,...event,x:location.x,y:location.y,...(location.level===undefined?{}:{level:location.level})});
    }
  }
  const worlds=members.flatMap(view=>view.world?[view.world]:[]),worldBase=base.world??worlds[0];
  const unionById=<T extends {id:number}>(lists:T[][])=>[...new Map(lists.flat().map(item=>[item.id,item])).values()];
  const world=worldBase?{...worldBase,
    levels:worldBase.levels.map(level=>({...level,
      terrain:level.terrain.map((tile,index)=>tile??worlds.map(world=>world.levels[level.id]?.terrain[index]).find(tile=>tile!==null&&tile!==undefined)??null),
      elevation:level.elevation.map((height,index)=>height??worlds.map(world=>world.levels[level.id]?.elevation[index]).find(height=>height!==null&&height!==undefined)??null)})),
    transitions:unionById(worlds.map(world=>world.transitions)),bridges:unionById(worlds.map(world=>world.bridges)),
    sites:unionById(worlds.map(world=>world.sites)).map(site=>({...site,loyalty:base.world?.sites.find(own=>own.id===site.id)?.loyalty??0})),
    creatures:unionById(worlds.map(world=>world.creatures)),
    fires:[...new Map(worlds.flatMap(world=>world.fires).map(fire=>[`${fire.level},${fire.x},${fire.y}`,fire])).values()],
  }:undefined;
  const economies=members.flatMap(view=>view.economy?[view.economy]:[]),economyBase=base.economy??economies[0];
  // Team spectators share disclosed markers. Local stores, assignments and ledgers
  // keep the selected seat's privacy rules, as world-site loyalty does above.
  const economy:EconomyView|undefined=economyBase?{...structuredClone(economyBase),
    deepSites:[...new Set(economies.flatMap(view=>view.deepSites))],groves:structuredClone(unionById(economies.map(view=>view.groves))),
    markets:structuredClone(unionById(economies.map(view=>view.markets))),salvage:structuredClone(unionById(economies.map(view=>view.salvage))),
    structures:[...new Map(economies.flatMap(view=>view.structures).map(item=>[item.entityId,item])).values()].map(item=>({...structuredClone(item),stock:item.side===perspective?{...(base.economy?.structures.find(own=>own.entityId===item.entityId)?.stock??{wood:0,ore:0,crystal:0})}:{wood:0,ore:0,crystal:0}})),
    caravans:[...new Map(economies.flatMap(view=>view.caravans).map(item=>[item.entityId,item])).values()].map(item=>item.side===perspective?structuredClone(base.economy?.caravans.find(own=>own.entityId===item.entityId)??item):({...structuredClone(item),origin:'delivery' as const,stock:{wood:0,ore:0,crystal:0},tradeValue:0,sourceId:undefined,destinationId:undefined,contractId:undefined,task:undefined})),
    contracts:structuredClone(unionById(economies.map(view=>view.contracts.filter(contract=>contract.side===null||contract.side===perspective)))),
  }:undefined;
  return {...base,...(world?{world}:{}),...(economy?{economy}:{}),teamPerspective:true,teamPlayers:members.map(view=>({side:view.side,player:view.player})),
    entities:[...entities.values()].sort((a,b)=>a.id-b.id),resources:[...resources.values()].sort((a,b)=>a.id-b.id).map(resource=>({...resource,visible:visible.has((resource.level??0)*base.map.width*base.map.height+Math.floor(resource.y)*base.map.width+Math.floor(resource.x))})),corpses:[...corpses.values()].sort((a,b)=>a.id-b.id),events:[...events.values()].sort((a,b)=>a.tick-b.tick),
    map:{...base.map,terrain:base.map.terrain.map((tile,index)=>tile??members.map(view=>view.map.terrain[index]).find(tile=>tile!==null)??null),starts:base.map.starts.map((point,index)=>point??members.map(view=>view.map.starts[index]).find(point=>point!==null)??null)},
    visible:[...visible].sort((a,b)=>a-b),explored:[...new Set(members.flatMap(view=>view.explored))].sort((a,b)=>a-b)};
}
