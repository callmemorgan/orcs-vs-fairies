import { issueCommand } from '../core/simulation';
import type { Command, GameState, Side } from '../core/types';
export interface CommandScene {state:GameState;paused:boolean;viewSide?:Side;readOnly?:boolean}
export type CommandInterceptor=(scene:CommandScene,command:Command,next:()=>boolean)=>boolean;
export type CommandObserver=(scene:CommandScene,command:Command)=>void;
const interceptors:CommandInterceptor[]=[];
const observers:CommandObserver[]=[];
const register=<T>(list:T[],item:T)=>{list.push(item);return ()=>{const i=list.indexOf(item);if(i>=0)list.splice(i,1);};};
export function registerPlayerCommandInterceptor(interceptor:CommandInterceptor){return register(interceptors,interceptor);}
export function registerPlayerCommandObserver(observer:CommandObserver){return register(observers,observer);}
export function dispatchPlayerCommand(scene:CommandScene,command:Command):boolean{
  const handlers=[...interceptors];let index=0;
  const next=():boolean=>{const handler=handlers[index++];if(handler)return handler(scene,command,next);const accepted=!scene.readOnly&&!scene.paused&&issueCommand(scene.state,scene.viewSide??0,command);if(accepted)for(const observer of [...observers])observer(scene,command);return accepted;};
  return next();
}
