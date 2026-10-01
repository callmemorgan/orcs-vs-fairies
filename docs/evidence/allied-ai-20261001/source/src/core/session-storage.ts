import { saveGame, loadGame, SAVE_VERSION } from './saves';
import { decodeReplay, replayChecksum } from './replays';
import { ECONOMY, FACTIONS, UPGRADES } from './content';
import type { ReplayArchive } from './replays';
import type { GameState, Side } from './types';
import { decodePlanningRuntime } from './planning';
import type { PlanningRuntime } from './planning';

export interface StoragePort {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
export interface SessionPlanning {version:1;players:PlanningRuntime[];automaticSides:Side[]}
export interface SessionFile {format:'orcs-vs-fairies/session';version:1;game:ReturnType<typeof saveGame>;replay?:ReplayArchive;planning?:SessionPlanning}
export interface SaveSlot {id:string;name:string;updatedAt:string;time:number;faction:string;opponent:string;autosave:boolean;file:SessionFile}
export interface AutosaveSettings {enabled:boolean;intervalSeconds:number}
const STORAGE_KEY='orcs-vs-fairies:sessions:v1';
const AUTOSAVE_KEY='orcs-vs-fairies:autosave:v1';
const MAX_BYTES=20*1024*1024;
const MAX_SLOTS=15;
const MAX_MANUAL_SLOTS=12;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);

export function decodeSessionPlanning(input:unknown,state:GameState):SessionPlanning {
  if(!record(input)||input.version!==1||Object.keys(input).some(key=>!['version','players','automaticSides'].includes(key))||!Array.isArray(input.players)||input.players.length!==state.players.length)throw new Error('Invalid saved planning roster.');
  const players:PlanningRuntime[]=[];
  for(let side=0;side<input.players.length;side++){if(!Object.hasOwn(input.players,side))throw new Error('Saved plans cannot contain missing player slots.');const runtime=decodePlanningRuntime(input.players[side],state,side as Side);if(!runtime)throw new Error(`Invalid saved plans for player ${side+1}.`);players.push(runtime);}
  const automatic=input.automaticSides===undefined?[]:input.automaticSides;
  if(!Array.isArray(automatic)||!Array.from(automatic).every(side=>Number.isInteger(side)&&side>=0&&side<players.length)||new Set(automatic).size!==automatic.length)throw new Error('Invalid automatic worker allocation players.');
  return {version:1,players,automaticSides:[...automatic]};
}

export function createSessionFile(state:GameState,replay?:ReplayArchive,planning?:SessionPlanning):SessionFile {
  const game=saveGame(state);
  const file:SessionFile={format:'orcs-vs-fairies/session',version:1,game};
  if(replay){const archive=decodeReplay(replay);if(archive.finalTick!==state.tick||archive.finalChecksum!==replayChecksum(state,archive.checksumVersion??archive.initial.version))throw new Error('Replay does not match this game.');file.replay=archive;}
  if(planning!==undefined)file.planning=decodeSessionPlanning(planning,state);
  return file;
}

export function decodeSessionFile(input:unknown):{file:SessionFile;state:GameState} {
  if(typeof input==='string'){if(input.length>MAX_BYTES)throw new Error('Save exceeds 20 MiB.');try{input=JSON.parse(input);}catch{throw new Error('Invalid save JSON.');}}
  if(!record(input)||input.format!=='orcs-vs-fairies/session'||input.version!==1||Object.keys(input).some(k=>!['format','version','game','replay','planning'].includes(k)))throw new Error('Unsupported session file or version.');
  const state=loadGame(input.game),planning=input.planning===undefined?undefined:decodeSessionPlanning(input.planning,state),file=createSessionFile(state,input.replay===undefined?undefined:decodeReplay(input.replay),planning);
  return {state,file};
}

/** One atomic storage write keeps quota failures from corrupting the old save list. */
export class SaveRepository {
  constructor(private storage:StoragePort,private now:()=>Date=()=>new Date()){}
  private read():SaveSlot[] {
    const raw=this.storage.getItem(STORAGE_KEY);if(!raw)return [];
    let data:unknown;
    try{data=JSON.parse(raw);}catch{throw new Error('Local saves are damaged. Export or clear browser storage before replacing them.');}
    if(!record(data)||data.version!==1||!Array.isArray(data.slots)||data.slots.length>MAX_SLOTS)throw new Error('Unsupported local save store.');
    const slots:SaveSlot[]=[];
    for(const slot of data.slots){
      if(!record(slot)||typeof slot.id!=='string'||!/^slot-[0-9]+$|^autosave(?:-[12])?$/.test(slot.id)||typeof slot.name!=='string'||slot.name.length>80||typeof slot.updatedAt!=='string'||!Number.isFinite(Date.parse(slot.updatedAt))||typeof slot.autosave!=='boolean'||slot.autosave!==slot.id.startsWith('autosave'))throw new Error('Damaged local save slot.');
      const {file,state}=decodeSessionFile(slot.file);
      if(slots.some(x=>x.id===slot.id))throw new Error('Duplicate local save slot.');
      slots.push({id:slot.id,name:slot.name,updatedAt:slot.updatedAt,autosave:slot.autosave,time:state.time,faction:state.players[0].faction,opponent:state.players[1]?.faction??state.players[0].faction,file});
    }
    if(slots.filter(slot=>!slot.autosave).length>MAX_MANUAL_SLOTS)throw new Error('Too many manual saves.');
    return slots;
  }
  list():Omit<SaveSlot,'file'>[] {return this.read().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(({file,...metadata})=>metadata);}
  private write(slots:SaveSlot[]){
    const text=JSON.stringify({version:1,slots});if(text.length>MAX_BYTES)throw new Error('Save store exceeds 20 MiB. Export and delete older saves.');
    try{this.storage.setItem(STORAGE_KEY,text);}catch{throw new Error('Browser storage is full or unavailable. Existing saves were preserved; export this match to a file.');}
  }
  save(name:string,file:SessionFile,autosave=false):string {
    const clean=name.trim();if(!clean||clean.length>80)throw new Error('Save name must contain 1 to 80 characters.');
    const {file:validated,state}=decodeSessionFile(file),oldSlots=this.read();
    let slots=oldSlots;
    if(!autosave&&slots.filter(s=>!s.autosave).length>=MAX_MANUAL_SLOTS)throw new Error('All 12 save slots are used. Delete or export a save first.');
    if(autosave){
      slots=oldSlots.filter(slot=>!slot.autosave);
      const latest=oldSlots.find(slot=>slot.id==='autosave'),previous=oldSlots.find(slot=>slot.id==='autosave-1');
      if(previous)slots.push({...previous,id:'autosave-2',name:'Autosave (older)'});
      if(latest)slots.push({...latest,id:'autosave-1',name:'Autosave (previous)'});
    }
    let next=Math.max(0,...slots.filter(s=>!s.autosave).map(s=>Number(s.id.slice(5))))+1;
    if(!Number.isSafeInteger(next))next=1;
    const id=autosave?'autosave':`slot-${next}`;
    const slot:SaveSlot={id,name:clean,autosave,updatedAt:this.now().toISOString(),time:state.time,faction:state.players[0].faction,opponent:state.players[1]?.faction??state.players[0].faction,file:validated};
    slots.push(slot);
    this.write(slots);return id;
  }
  load(id:string):{file:SessionFile;state:GameState} {
    const slot=this.read().find(s=>s.id===id);if(!slot)throw new Error('Save slot no longer exists.');
    return decodeSessionFile(slot.file);
  }
  delete(id:string){const slots=this.read();if(!slots.some(s=>s.id===id))throw new Error('Save slot no longer exists.');this.write(slots.filter(s=>s.id!==id));}
  getAutosave():AutosaveSettings {
    try{const data:unknown=JSON.parse(this.storage.getItem(AUTOSAVE_KEY)??'null');if(record(data)&&typeof data.enabled==='boolean'&&Number.isInteger(data.intervalSeconds)&&(data.intervalSeconds as number)>=30&&(data.intervalSeconds as number)<=600)return data as unknown as AutosaveSettings;}catch{}
    return {enabled:true,intervalSeconds:60};
  }
  setAutosave(settings:AutosaveSettings){
    if(typeof settings.enabled!=='boolean'||!Number.isInteger(settings.intervalSeconds)||settings.intervalSeconds<30||settings.intervalSeconds>600)throw new Error('Autosave interval must be 30 to 600 seconds.');
    try{this.storage.setItem(AUTOSAVE_KEY,JSON.stringify(settings));}catch{throw new Error('Autosave preferences could not be saved.');}
  }
}

export function createBugReport(description:string,state:GameState,replay:ReplayArchive,diagnostics:Record<string,unknown>={},buildId='development',planning?:SessionPlanning) {
  if(!description.trim()||description.length>4000)throw new Error('Describe the problem in 1 to 4000 characters.');
  const archive=decodeReplay(replay);
  if(archive.finalChecksum!==replayChecksum(state,archive.checksumVersion??archive.initial.version))throw new Error('Report replay does not match the current match.');
  let contentHash=2166136261;for(const char of JSON.stringify({FACTIONS,UPGRADES,ECONOMY})){contentHash^=char.charCodeAt(0);contentHash=Math.imul(contentHash,16777619);}
  return {format:'orcs-vs-fairies/bug-report',version:1,id:`local-${crypto.randomUUID()}`,createdAt:new Date().toISOString(),description:description.trim(),versions:{buildId,save:SAVE_VERSION,replay:archive.version,replaySimulation:archive.initial.version,simulationRevision:archive.simulationRevision,contentHash:(contentHash>>>0).toString(16).padStart(8,'0')},session:createSessionFile(state,archive,planning),diagnostics:structuredClone(diagnostics)};
}
