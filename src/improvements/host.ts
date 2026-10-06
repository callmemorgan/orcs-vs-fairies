import { dispatchPlayerCommand } from '../game/commands';
import { PlayerView } from '../core/observation';
import { isGameOver } from '../core/simulation';
import type { Command, GameEvent, GameOptions, GameState, JsonValue } from '../core/types';

export type PlayerObservation=ReturnType<PlayerView['observe']> & {events:GameEvent[]};
export interface ClientScene {
  state:GameState;
  selected:number[];
  paused:boolean;
  selectEntities:(ids:number[])=>void;
  centerOn:(x:number,y:number)=>void;
}
export interface ClientContext {
  readonly root:HTMLElement;
  readonly menu:HTMLElement;
  readonly hud:HTMLElement;
  /** A detached player observation. Hidden enemies and unobserved resources are absent. */
  readonly state:PlayerObservation|null;
  readonly selected:readonly number[];
  readonly paused:boolean;
  command:(command:Command)=>boolean;
  select:(ids:number[])=>void;
  center:(x:number,y:number)=>void;
  setPaused:(paused:boolean)=>void;
  notice:(text:string)=>void;
}
export interface ClientInstance {
  update?:()=>void;
  matchStart?:()=>void;
  matchEnd?:(reason:'result'|'menu')=>void;
  menu?:()=>void;
  /** Return undefined to leave this improvement disabled in the next match. */
  readOptions?:()=>JsonValue|undefined;
  dispose?:()=>void;
}
export interface ClientImprovement {
  id:string;
  mount:(context:ClientContext)=>ClientInstance;
}
export interface HostActions {
  current:()=>ClientScene|undefined;
  notice:(text:string)=>void;
  setPaused:(paused:boolean)=>void;
}
export function mountImprovementHost(root:HTMLElement,extensions:ClientImprovement[],actions:HostActions){
  const view=new PlayerView(0),instances:Array<{id:string;instance:ClientInstance;menu:HTMLElement;hud:HTMLElement}>=[];
  let observation:PlayerObservation|null=null,ended=false;
  for(const extension of extensions){
    if(!extension.id||instances.some(({id})=>id===extension.id))throw new Error(`Duplicate or empty improvement id: ${extension.id}`);
    const menu=document.createElement('div'),hud=document.createElement('div');
    menu.dataset.improvement=extension.id;hud.dataset.improvement=extension.id;
    root.querySelector('.menu-content')!.append(menu);root.querySelector('.war-hud')!.append(hud);
    const context:ClientContext={
      root,menu,hud,
      get state(){return observation;},
      get selected(){return [...(actions.current()?.selected??[])];},
      get paused(){return actions.current()?.paused??false;},
      command:command=>{const scene=actions.current();return !!scene&&dispatchPlayerCommand(scene,command);},
      select:ids=>actions.current()?.selectEntities(ids),
      center:(x,y)=>{if(Number.isFinite(x)&&Number.isFinite(y))actions.current()?.centerOn(x,y);},
      setPaused:paused=>{const scene=actions.current();if(scene&&!isGameOver(scene.state))actions.setPaused(paused);},
      notice:actions.notice
    };
    instances.push({id:extension.id,instance:extension.mount(context),menu,hud});
  }
  function update(){
    if(!instances.length)return;
    const scene=actions.current();
    observation=scene?structuredClone({...view.observe(scene.state),events:view.events(scene.state)}):null;
    for(const {instance} of instances)instance.update?.();
    if(scene&&isGameOver(scene.state)&&!ended){ended=true;for(const {instance} of instances)instance.matchEnd?.('result');}
  }
  return {
    update,
    matchStart:()=>{ended=false;update();for(const {instance} of instances)instance.matchStart?.();},
    showMenu:()=>{if(observation&&!ended)for(const {instance} of instances)instance.matchEnd?.('menu');observation=null;ended=false;for(const {instance} of instances)instance.menu?.();},
    options:():GameOptions=>{
      const improvements:Record<string,JsonValue>=Object.create(null);
      for(const {id,instance} of instances){const value=instance.readOptions?.();if(value!==undefined)improvements[id]=structuredClone(value);}
      return Object.keys(improvements).length?{improvements}:{};
    },
    dispose:()=>{for(const {instance,menu,hud} of instances){instance.dispose?.();menu.remove();hud.remove();}}
  };
}
