import { expect, it } from 'vitest';
import { ControlProfiles, inputIsSuppressed } from '../src/improvements/controls/bindings';
import { dispatchPlayerCommand, registerPlayerCommandInterceptor, registerPlayerCommandObserver } from '../src/game/commands';
import { createGame } from '../src/core/simulation';
it('remaps camera independently of attack move and persists with conflict rejection',()=>{
 const storage=new Map<string,string>(),profile=new ControlProfiles({getItem:key=>storage.get(key)??null,setItem:(key,value)=>{storage.set(key,value);}});
 const context={selected:true,playable:true};expect(profile.matchKeyboard({code:'KeyA'},context)).toBe('cameraLeft');expect(profile.matchKeyboard({code:'KeyT'},context)).toBe('attackMove');
 expect(profile.setBinding('attackMove','KeyG').ok).toBe(true);expect(profile.matchKeyboard({code:'KeyT'},context)).toBeNull();expect(profile.matchKeyboard({code:'KeyG'},context)).toBe('attackMove');
 expect(profile.setBinding('cameraLeft','KeyG').ok).toBe(false);expect(profile.bindingsFor('cameraLeft')).toEqual(['ArrowLeft','KeyA']);
 const restored=new ControlProfiles({getItem:key=>storage.get(key)??null,setItem:()=>{}});expect(restored.bindingsFor('attackMove')).toEqual(['KeyG']);
 expect(restored.isHeld('cameraLeft',{codes:new Set(['KeyA']),ctrl:false,meta:false,alt:false,shift:false},context)).toBe(true);
 expect(restored.matchKeyboard({code:'KeyA',ctrlKey:true},context)).toBeNull();
 expect(restored.setBinding('queueModifier','KeyY').ok).toBe(true);expect(restored.isHeld('queueModifier',{codes:new Set(['KeyY']),ctrl:false,meta:false,alt:false,shift:false},context)).toBe(true);
});
it('rejects hotkeys in dialogs and editable text including contenteditable',()=>{
 expect(inputIsSuppressed(null,true)).toBe(true);let selector='';expect(inputIsSuppressed({closest:(value:string)=>{selector=value;return {};}} as unknown as EventTarget)).toBe(true);expect(selector).toContain('contenteditable');
});
it('dispatches accepted commands once, protects read-only views and supports deferred interception',()=>{
 const state=createGame('orcs',1977,'fairies',{controllers:['human','human']}),scene={state,paused:false,readOnly:false},unit=state.entities.find(e=>e.side===0&&e.role==='worker')!;const accepted:string[]=[];
 const disposeObserver=registerPlayerCommandObserver((_scene,command)=>accepted.push(command.type));
 expect(dispatchPlayerCommand(scene,{type:'hold',ids:[unit.id]})).toBe(true);expect(unit.order.type).toBe('hold');expect(accepted).toEqual(['hold']);
 scene.readOnly=true;expect(dispatchPlayerCommand(scene,{type:'stop',ids:[unit.id]})).toBe(false);scene.readOnly=false;scene.paused=true;
 let apply:()=>boolean=()=>false;const dispose=registerPlayerCommandInterceptor((_scene,_command,next)=>{apply=next;return true;});
 expect(dispatchPlayerCommand(scene,{type:'stop',ids:[unit.id]})).toBe(true);expect(accepted).toEqual(['hold']);scene.paused=false;expect(apply()).toBe(true);expect(accepted).toEqual(['hold','stop']);dispose();disposeObserver();
});
