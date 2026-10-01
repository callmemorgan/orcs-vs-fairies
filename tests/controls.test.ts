import {describe,it,expect} from 'vitest';
import {CONTROL_ACTIONS,CONTROL_STORAGE_KEY,ControlProfiles,bindingFromKeyboard,displayBinding,inputIsSuppressed,normalizeBinding} from '../src/game/Controls';
const playing={selected:true,playable:true};
function storage(){const data=new Map<string,string>();return {data,getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};}

describe('configurable controls',()=>{
  it('keeps every keyboard action in one registry including all action slots and group keys',()=>{
    const controls=new ControlProfiles(null);
    expect(CONTROL_ACTIONS).toHaveLength(42);
    for(let i=0;i<10;i++){
      expect(controls.matchKeyboard({code:`Digit${i}`},playing)).toBe(`groupRecall${i}`);
      expect(controls.matchKeyboard({code:`Digit${i}`,metaKey:true},playing)).toBe(`groupAssign${i}`);
      expect(controls.matchKeyboard({code:`Digit${i}`,ctrlKey:true},playing)).toBe(`groupAssign${i}`);
    }
    for(const [i,code] of ['KeyZ','KeyC','KeyB','KeyV','KeyN','KeyM'].entries())expect(controls.matchKeyboard({code},playing)).toBe(`action${i+1}`);
  });
  it('preserves the contextual A default and checks conflicts in overlapping contexts',()=>{
    const controls=new ControlProfiles(null);
    expect(controls.matchKeyboard({code:'KeyA'},playing)).toBe('attackMove');
    expect(controls.matchKeyboard({code:'KeyA'},{selected:false,playable:true})).toBe('cameraLeft');
    expect(controls.matchKeyboard({code:'KeyA'},{selected:true,playable:false})).toBe(null);
    expect(controls.setBinding('hold','KeyA')).toEqual(expect.objectContaining({ok:false,conflicts:['attackMove']}));
    expect(controls.setBinding('action1','Primary+Digit1')).toEqual(expect.objectContaining({ok:false,conflicts:['groupAssign1']}));
    expect(controls.setBinding('groupRecall1','KeyZ').ok).toBe(false);
  });
  it('rebinds camera, actions and control groups and persists profiles independently',()=>{
    const store=storage(),controls=new ControlProfiles(store);
    expect(controls.saveProfile('Left hand').ok).toBe(true);
    expect(controls.setBinding('action1','Shift+KeyR').ok).toBe(true);
    expect(controls.setBinding('cameraUp','KeyI').ok).toBe(true);
    expect(controls.setBinding('groupAssign1','Alt+Digit1').ok).toBe(true);
    const reload=new ControlProfiles(store);
    expect(reload.activeProfile).toBe('Left hand');
    expect(reload.matchKeyboard({code:'KeyR',shiftKey:true},playing)).toBe('action1');
    expect(reload.matchKeyboard({code:'KeyZ'},playing)).toBe(null);
    expect(reload.matchKeyboard({code:'Digit1',altKey:true},playing)).toBe('groupAssign1');
    expect(reload.selectProfile('Default')).toBe(true);
    expect(reload.bindingsFor('action1')).toEqual(['KeyZ']);
    expect(reload.selectProfile('Left hand')).toBe(true);reload.resetDefaults();
    expect(reload.bindingsFor('cameraUp')).toEqual(['ArrowUp','KeyW']);
    expect(new ControlProfiles(store).bindingsFor('action1')).toEqual(['KeyZ']);
  });
  it('allows unbinding and returns copies rather than writable saved state',()=>{
    const controls=new ControlProfiles(null);
    expect(controls.setBinding('stop',[]).ok).toBe(true);
    expect(controls.setBinding('stop','').ok).toBe(true);
    expect(controls.matchKeyboard({code:'KeyX'},playing)).toBe(null);
    const copy=controls.bindings;copy.hold.push('KeyR');
    expect(controls.bindingsFor('hold')).toEqual(['KeyH']);
    expect(controls.setBinding('hold',['KeyR','KeyR']).ok).toBe(true);
    expect(controls.bindingsFor('hold')).toEqual(['KeyR']);
  });
  it('rejects invalid data, prototype profile names and conflicting stored profiles',()=>{
    const store=storage(),controls=new ControlProfiles(store);
    expect(controls.setBinding('stop','Shift+KeyBogus').ok).toBe(false);
    expect(controls.setBinding('stop','Primary+Ctrl+KeyR').ok).toBe(false);
    expect(controls.saveProfile('__proto__').ok).toBe(false);
    store.setItem(CONTROL_STORAGE_KEY,JSON.stringify({version:1,active:'Broken',profiles:{Broken:{stop:['KeyH']}}}));
    const reload=new ControlProfiles(store);expect(reload.profiles).toEqual(['Default']);expect(reload.activeProfile).toBe('Default');
    store.setItem(CONTROL_STORAGE_KEY,'{');expect(new ControlProfiles(store).persistenceError).toBeTruthy();
  });
  it('keeps controls usable when persistence fails and safely deletes profiles',()=>{
    const controls=new ControlProfiles({getItem:()=>null,setItem:()=>{throw new Error('quota');}});
    expect(controls.setBinding('stop','KeyR').ok).toBe(true);expect(controls.persistenceError).toBeTruthy();
    expect(controls.matchKeyboard({code:'KeyR'},playing)).toBe('stop');
    expect(controls.deleteProfile('Default')).toBe(false);controls.saveProfile('Other');expect(controls.deleteProfile('Other')).toBe(true);expect(controls.activeProfile).toBe('Default');
  });
  it('matches modifiers exactly, leaves gameplay shortcuts alone while paused and supports held camera bindings',()=>{
    const controls=new ControlProfiles(null);
    expect(controls.matchKeyboard({code:'KeyH',ctrlKey:true},playing)).toBe(null);
    expect(controls.matchKeyboard({code:'Digit1'},{selected:true,playable:false})).toBe(null);
    expect(controls.matchKeyboard({code:'KeyP'},{selected:false,playable:false})).toBe('pause');
    expect(controls.isHeld('cameraUp',{codes:new Set(['KeyW']),ctrl:false,meta:false,alt:false,shift:false},{selected:true,playable:false})).toBe(true);
    expect(controls.isHeld('cameraLeft',{codes:new Set(['KeyA']),ctrl:false,meta:false,alt:false,shift:false},playing)).toBe(false);
    expect(bindingFromKeyboard({code:'KeyR',metaKey:true,shiftKey:true})).toBe('Primary+Shift+KeyR');
    expect(normalizeBinding('Shift + Ctrl + KeyR')).toBe('Primary+Shift+KeyR');
    expect(displayBinding('Primary+KeyR')).toBe('Ctrl/Cmd+R');
  });
  it('suppresses shortcuts in forms, editable content and dialogs',()=>{
    expect(inputIsSuppressed(null,true)).toBe(true);
    expect(inputIsSuppressed({closest:()=>({})} as unknown as EventTarget)).toBe(true);
    expect(inputIsSuppressed({closest:()=>null} as unknown as EventTarget)).toBe(false);
    expect(inputIsSuppressed(null)).toBe(false);
  });
  it('allows the queue and additive-selection modifier to be rebound and saved',()=>{
    const store=storage(),controls=new ControlProfiles(store);
    expect(bindingFromKeyboard({code:'ShiftLeft',shiftKey:true})).toBe('ShiftLeft');
    expect(controls.isHeld('queueModifier',{codes:new Set(['ShiftLeft']),ctrl:false,meta:false,alt:false,shift:true},playing)).toBe(true);
    expect(controls.setBinding('queueModifier','KeyL').ok).toBe(true);
    const reload=new ControlProfiles(store);
    expect(reload.isHeld('queueModifier',{codes:new Set(['KeyL']),ctrl:false,meta:false,alt:false,shift:false},playing)).toBe(true);
    expect(reload.isHeld('queueModifier',{codes:new Set(['ShiftLeft']),ctrl:false,meta:false,alt:false,shift:true},playing)).toBe(false);
    expect(reload.setBinding('queueModifier','KeyX').ok).toBe(false);
  });
});
