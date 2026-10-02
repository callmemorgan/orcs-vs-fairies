export type ControlAction = 'cameraLeft'|'cameraRight'|'cameraUp'|'cameraDown'|'zoomIn'|'zoomOut'|'centerHQ'|'selectArmy'|'attackMove'|'hold'|'stop'|'ability'|'cancel'|'pause'|'photoMode'|'queueModifier'|`action${1|2|3|4|5|6}`|`groupRecall${0|1|2|3|4|5|6|7|8|9}`|`groupAssign${0|1|2|3|4|5|6|7|8|9}`;
type Context = 'camera'|'play'|'selected'|'global';
export interface ControlDefinition {id:ControlAction;label:string;context:Context;defaultBindings:readonly string[]}
export const CONTROL_ACTIONS:readonly ControlDefinition[] = [
  {id:'cameraLeft',label:'Pan left (A also works without a selection)',context:'camera',defaultBindings:['ArrowLeft','KeyA']},
  {id:'cameraRight',label:'Pan right',context:'camera',defaultBindings:['ArrowRight','KeyD']},
  {id:'cameraUp',label:'Pan up',context:'camera',defaultBindings:['ArrowUp','KeyW']},
  {id:'cameraDown',label:'Pan down',context:'camera',defaultBindings:['ArrowDown','KeyS']},
  {id:'zoomIn',label:'Zoom in',context:'camera',defaultBindings:['PageUp']},
  {id:'zoomOut',label:'Zoom out',context:'camera',defaultBindings:['PageDown']},
  {id:'centerHQ',label:'Center on stronghold',context:'camera',defaultBindings:['Space']},
  {id:'selectArmy',label:'Select army',context:'play',defaultBindings:['F2']},
  {id:'attackMove',label:'Attack move',context:'selected',defaultBindings:['KeyA']},
  {id:'hold',label:'Hold position',context:'selected',defaultBindings:['KeyH']},
  {id:'stop',label:'Stop',context:'selected',defaultBindings:['KeyX']},
  {id:'ability',label:'Use ability',context:'selected',defaultBindings:['KeyQ','KeyF']},
  {id:'cancel',label:'Cancel targeting / exit photo mode',context:'global',defaultBindings:['Escape']},
  {id:'pause',label:'Pause / resume',context:'global',defaultBindings:['KeyP']},
  {id:'photoMode',label:'Photo mode',context:'global',defaultBindings:['F9']},
  {id:'queueModifier',label:'Queue orders / add selection',context:'global',defaultBindings:['ShiftLeft','ShiftRight']},
  ...(['KeyZ','KeyC','KeyB','KeyV','KeyN','KeyM'] as const).map((code,i)=>({id:`action${i+1}` as ControlAction,label:`Action slot ${i+1}`,context:'play' as const,defaultBindings:[code]})),
  ...Array.from({length:10},(_,i)=>({id:`groupRecall${i}` as ControlAction,label:`Recall group ${i}`,context:'play' as const,defaultBindings:[`Digit${i}`]})),
  ...Array.from({length:10},(_,i)=>({id:`groupAssign${i}` as ControlAction,label:`Assign group ${i}`,context:'play' as const,defaultBindings:[`Primary+Digit${i}`]})),
];
export type ControlBindings = Record<ControlAction,string[]>;
export interface KeyboardSample {code:string;ctrlKey?:boolean;metaKey?:boolean;altKey?:boolean;shiftKey?:boolean}
export interface ControlContext {selected:boolean;playable:boolean}
export interface KeyboardState {codes:ReadonlySet<string>;ctrl:boolean;meta:boolean;alt:boolean;shift:boolean}
export interface BindingResult {ok:boolean;error?:string;conflicts?:ControlAction[]}
export interface ProfileStorage {getItem(key:string):string|null;setItem(key:string,value:string):void}
export const CONTROL_STORAGE_KEY = 'orcs-vs-fairies.controls.v1';
const defaultBindings = ():ControlBindings => Object.fromEntries(CONTROL_ACTIONS.map(action=>[action.id,[...action.defaultBindings]])) as ControlBindings;
const copyBindings = (bindings:ControlBindings):ControlBindings => Object.fromEntries(CONTROL_ACTIONS.map(action=>[action.id,[...bindings[action.id]]])) as ControlBindings;
const validCode = /^(Key[A-Z]|Digit[0-9]|Arrow(Left|Right|Up|Down)|(Shift|Control|Meta|Alt)(Left|Right)|F([1-9]|1[0-9]|2[0-4])|Numpad([0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter)|Space|Escape|Enter|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Backquote|Comma|Period|Slash|CapsLock)$/;

/** Stored chords use physical KeyboardEvent.code names. Primary means Ctrl or Cmd. */
export function normalizeBinding(value:string):string|null {
  const parts=value.trim().split('+').map(part=>part.trim());
  const code=parts.pop();
  if(!code||!validCode.test(code))return null;
  const modifiers=new Set<string>();
  for(const part of parts){const modifier=/^(Control|Ctrl|Meta|Cmd|Primary)$/i.test(part)?'Primary':/^Alt$/i.test(part)?'Alt':/^Shift$/i.test(part)?'Shift':null;if(!modifier||modifiers.has(modifier))return null;modifiers.add(modifier);}
  if(/^(Control|Meta)(Left|Right)$/.test(code))modifiers.delete('Primary');
  if(/^Shift(Left|Right)$/.test(code))modifiers.delete('Shift');
  if(/^Alt(Left|Right)$/.test(code))modifiers.delete('Alt');
  return [...['Primary','Alt','Shift'].filter(modifier=>modifiers.has(modifier)),code].join('+');
}
export function bindingFromKeyboard(event:KeyboardSample):string|null {
  return normalizeBinding([...(event.ctrlKey||event.metaKey?['Primary']:[]),...(event.altKey?['Alt']:[]),...(event.shiftKey?['Shift']:[]),event.code].join('+'));
}
export function displayBinding(binding:string):string {
  return binding.replace(/Primary/g,'Ctrl/Cmd').replace(/Key([A-Z])/g,'$1').replace(/Digit([0-9])/g,'$1').replace(/Arrow(Left|Right|Up|Down)/g,'$1').replace(/(Shift|Control|Meta|Alt)(Left|Right)/g,(_,modifier,side)=>`${side} ${modifier}`).replace('Space','Spacebar');
}
/** Parse the same labels the controls editor displays, including bare left/right modifiers. */
export function parseDisplayedBinding(value:string):string|null {
  const parts=value.replace(/Ctrl\/Cmd/g,'Primary').split('+').map(part=>part.trim());let key=parts.pop()??'';
  const modifier=/^(Left|Right) (Shift|Control|Meta|Alt)$/.exec(key);
  if(modifier)key=modifier[2]+modifier[1];
  else if(/^[a-z]$/i.test(key))key=`Key${key.toUpperCase()}`;
  else if(/^[0-9]$/.test(key))key=`Digit${key}`;
  else if(['Left','Right','Up','Down'].includes(key))key=`Arrow${key}`;
  else if(key==='Spacebar')key='Space';
  return normalizeBinding([...parts,key].join('+'));
}
export function inputIsSuppressed(target:EventTarget|null|undefined,dialogOpen=false):boolean {
  if(dialogOpen)return true;
  const element=target as {closest?:(selector:string)=>unknown}|null|undefined;
  return !!element?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
}
const specialUnselected = (action:ControlAction,binding:string)=>action==='cameraLeft'&&binding==='KeyA';
function available(definition:ControlDefinition,binding:string,context:ControlContext):boolean {
  if(specialUnselected(definition.id,binding))return !context.selected;
  return definition.context==='global'||definition.context==='camera'||context.playable&&(definition.context==='play'||context.selected);
}
function overlaps(a:ControlDefinition,b:ControlDefinition,binding:string):boolean {
  return [false,true].some(selected=>[false,true].some(playable=>available(a,binding,{selected,playable})&&available(b,binding,{selected,playable})));
}

/** Profiles are saved on every successful edit. Storage failures preserve the usable in-memory profile. */
export class ControlProfiles {
  private saved:Record<string,ControlBindings> = Object.create(null);
  private active='Default';
  private storage:ProfileStorage|null;
  public persistenceError:string|null=null;
  constructor(storage?:ProfileStorage|null){
    if(storage!==undefined)this.storage=storage;
    else {try{this.storage=typeof localStorage==='undefined'?null:localStorage;}catch{this.storage=null;}}
    this.saved.Default=defaultBindings();
    try{
      const raw=this.storage?.getItem(CONTROL_STORAGE_KEY);if(!raw)return;
      const data:unknown=JSON.parse(raw);
      if(!data||typeof data!=='object'||!('version' in data)||data.version!==1||!('profiles' in data)||!data.profiles||typeof data.profiles!=='object')return;
      for(const [name,source] of Object.entries(data.profiles)){
        if(!this.validName(name)||!source||typeof source!=='object')continue;
        const bindings=defaultBindings();let valid=true;
        for(const action of CONTROL_ACTIONS){
          const rawBinding=(source as Record<string,unknown>)[action.id];if(rawBinding===undefined)continue;
          if(!Array.isArray(rawBinding)||rawBinding.some(binding=>typeof binding!=='string'||!normalizeBinding(binding))){valid=false;break;}
          bindings[action.id]=[...new Set(rawBinding.map(binding=>normalizeBinding(binding)!))];
        }
        if(valid&&!this.findConflicts(bindings).length)this.saved[name]=bindings;
      }
      if('active' in data&&typeof data.active==='string'&&Object.hasOwn(this.saved,data.active))this.active=data.active;
    }catch{this.persistenceError='Saved controls could not be read.';}
  }
  get activeProfile(){return this.active;}
  get profiles(){return Object.keys(this.saved);}
  get bindings(){return copyBindings(this.saved[this.active]);}
  bindingsFor(action:ControlAction):string[]{return [...this.saved[this.active][action]];}
  setBinding(action:ControlAction,value:string|readonly string[]):BindingResult {
    if(!CONTROL_ACTIONS.some(definition=>definition.id===action))return {ok:false,error:'Unknown control action.'};
    const values=typeof value==='string'?(value.trim()?[value]:[]):[...value];
    const normalized=values.map(normalizeBinding);
    if(normalized.some(binding=>binding===null))return {ok:false,error:'Use a key code with optional Primary, Alt and Shift modifiers.'};
    const bindings=this.bindings;bindings[action]=[...new Set(normalized as string[])];
    const conflicts=this.findConflicts(bindings,action);
    if(conflicts.length)return {ok:false,error:`Already used by ${conflicts.map(id=>CONTROL_ACTIONS.find(definition=>definition.id===id)!.label).join(', ')}.`,conflicts};
    this.saved[this.active]=bindings;this.persist();return {ok:true};
  }
  saveProfile(name:string):BindingResult {
    name=name.trim();if(!this.validName(name))return {ok:false,error:'Use a profile name of 1 to 40 characters.'};
    this.saved[name]=this.bindings;this.active=name;this.persist();return {ok:true};
  }
  selectProfile(name:string):boolean {if(!Object.hasOwn(this.saved,name))return false;this.active=name;this.persist();return true;}
  deleteProfile(name:string):boolean {
    if(!Object.hasOwn(this.saved,name)||this.profiles.length===1)return false;
    delete this.saved[name];if(this.active===name)this.active=this.profiles[0];this.persist();return true;
  }
  resetDefaults(){this.saved[this.active]=defaultBindings();this.persist();}
  matchKeyboard(event:KeyboardSample,context:ControlContext):ControlAction|null {
    const binding=bindingFromKeyboard(event);if(!binding)return null;
    return CONTROL_ACTIONS.find(action=>this.saved[this.active][action.id].includes(binding)&&available(action,binding,context))?.id??null;
  }
  isHeld(action:ControlAction,state:KeyboardState,context:ControlContext):boolean {
    const definition=CONTROL_ACTIONS.find(value=>value.id===action)!;
    return this.saved[this.active][action].some(binding=>{
      const code=binding.split('+').at(-1)!;
      return state.codes.has(code)&&bindingFromKeyboard({code,ctrlKey:state.ctrl,metaKey:state.meta,altKey:state.alt,shiftKey:state.shift})===binding&&available(definition,binding,context);
    });
  }
  private validName(name:string){return name.length>0&&name.length<=40&&name.trim()===name&&!/[\u0000-\u001f]/.test(name)&&!['__proto__','prototype','constructor'].includes(name);}
  private findConflicts(bindings:ControlBindings,edited?:ControlAction):ControlAction[]{
    const conflicts=new Set<ControlAction>();
    for(let i=0;i<CONTROL_ACTIONS.length;i++)for(let j=i+1;j<CONTROL_ACTIONS.length;j++){
      const a=CONTROL_ACTIONS[i],b=CONTROL_ACTIONS[j];if(edited&&a.id!==edited&&b.id!==edited)continue;
      if(bindings[a.id].some(binding=>bindings[b.id].includes(binding)&&overlaps(a,b,binding))){conflicts.add(a.id===edited?b.id:a.id);}
    }
    return [...conflicts];
  }
  private persist(){try{this.storage?.setItem(CONTROL_STORAGE_KEY,JSON.stringify({version:1,active:this.active,profiles:this.saved}));this.persistenceError=null;}catch{this.persistenceError='Controls changed, but browser storage is unavailable.';}}
}
