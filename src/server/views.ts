import { PlayerView } from '../core/observation';
import { isVisible } from '../core/simulation';
import type { GameState, Side } from '../core/types';
import type { PlayerObservation } from '../online/protocol';
import type { ResourceMemory } from './store';

/** Per-seat memory survives socket replacement and server checkpoints. */
export class OnlineView {
  private readonly view:PlayerView;
  private readonly memory=new Map<number,ResourceMemory[number]>();
  constructor(readonly side:Side,restored:ResourceMemory=[]){this.view=new PlayerView(side);for(const node of restored)this.memory.set(node.id,{...node});}
  observe(state:GameState):PlayerObservation {
    const observed=this.view.observe(state);
    for(const node of observed.resources)if(node.visible)this.memory.set(node.id,{...node});
    const resources=[...this.memory.values()].map(node=>({...node,visible:isVisible(state,this.side,node.x,node.y)}));
    const entityMap=new Map(state.entities.map(entity=>[entity.id,entity]));
    const permittedIds=new Set(observed.entities.map(entity=>entity.id));
    const events:PlayerObservation['events']=[];
    for(const event of state.events){
      const target=event.target===undefined?undefined:entityMap.get(event.target);
      const seen=isVisible(state,this.side,event.x,event.y);
      const ownTarget=target?.side===this.side;
      if(event.side!==this.side&&!seen&&!ownTarget)continue;
      const safe={...event};
      if(safe.source!==undefined&&!permittedIds.has(safe.source))delete safe.source;
      if(safe.target!==undefined&&!permittedIds.has(safe.target))delete safe.target;
      if(!seen&&event.side!==this.side){
        if(!ownTarget)continue;
        safe.x=target!.x;safe.y=target!.y;delete (safe as Partial<typeof safe>).side;delete safe.text;
      }
      events.push({...safe,tick:state.tick});
    }
    const {seed:_seed,starts,...map}=observed.map;
    return {...observed,map:{...map,starts:starts.map((point,side)=>side===this.side||isVisible(state,this.side,point.x,point.y)?{...point}:null)},resources,events,
      entities:observed.entities.map(entity=>{const full=entityMap.get(entity.id)!;return {...entity,facing:full.facing,animation:full.animation,animTime:full.animTime};})};
  }
  snapshot():ResourceMemory{return [...this.memory.values()].map(node=>({...node}));}
}
