import { FACTIONS } from '../core/content';
import { AGE_NAMES, playerAge } from '../core/progression';
import type { Entity, GameState, Side, UnitRole } from '../core/types';
import './session-tools.css';

type MaybePromise<T> = T | Promise<T>;
type ActionResult = MaybePromise<void | boolean>;
export interface SessionSave { id:string; name:string; savedAt:string | number; tick?:number; autosave?:boolean }
export interface SessionAutosave { enabled:boolean; intervalSeconds:number }
export type ReplaySpeed = .25 | .5 | 1 | 2 | 4;
export interface SessionReplayStatus { tick:number; initialTick:number; totalTicks:number; playing:boolean; speed:ReplaySpeed; perspective:Side }
export interface SessionAnalysisPlayer { wood:number; ore:number; crystal:number; army:number; losses:number; gathered?:number; buildings?:number; armyValue?:number; buildingLosses?:number; lostValue?:number }
export interface SessionAnalysisSample { tick:number; time:number; players:[SessionAnalysisPlayer, SessionAnalysisPlayer] }
export interface SessionTechnologyTiming { side:Side; tick:number; time:number; name:string }
export interface SessionAnalysis { complete:boolean; samples:SessionAnalysisSample[]; technologies:SessionTechnologyTiming[]; playerNames?:[string,string] }
export interface SessionBinding { action:string; label:string; key:string }
export interface SessionToolsStatus { side?:Side; paused?:boolean; replaySpectator?:boolean; notice?:string }
/** All mutation callbacks must reject or return false on failure. Imports must validate their full schemas before replacing a match. */
export interface SessionToolsCallbacks {
  listSaves:()=>MaybePromise<SessionSave[]>;
  save:(name:string)=>ActionResult;
  load:(id:string)=>ActionResult;
  deleteSave:(id:string)=>ActionResult;
  importSave:(value:unknown)=>ActionResult;
  exportSave:()=>MaybePromise<unknown>;
  getAutosave:()=>SessionAutosave;
  setAutosave:(settings:SessionAutosave)=>ActionResult;
  getReplay:()=>SessionReplayStatus | null;
  importReplay:(value:unknown)=>ActionResult;
  exportReplay:()=>MaybePromise<unknown>;
  seekReplay:(tick:number)=>ActionResult;
  setReplayPlaying:(playing:boolean)=>ActionResult;
  setReplaySpeed:(speed:ReplaySpeed)=>ActionResult;
  setReplayPerspective:(side:Side)=>ActionResult;
  getAnalysis:()=>SessionAnalysis | null;
  train:(id:number,role:UnitRole)=>ActionResult;
  cancelTrain:(id:number,index:number,expectedQueue:string)=>ActionResult;
  reorderTrain:(id:number,from:number,to:number,expectedQueue:string)=>ActionResult;
  selectBuilding:(id:number)=>void;
  getBindings:()=>SessionBinding[];
  getBindingProfiles:()=>string[];
  getGamepadHelp?:()=>ReadonlyArray<{control:string;action:string}>;
  photoExitHint?:()=>string;
  setBinding:(action:string,key:string)=>ActionResult;
  saveBindingProfile:(name:string)=>ActionResult;
  loadBindingProfile:(name:string)=>ActionResult;
  resetBindings:()=>ActionResult;
  bugReport:(description:string)=>MaybePromise<unknown>;
  photo:()=>void;
  onModal:(open:boolean)=>void;
  /** Optional host download hook. Without it, the UI downloads formatted JSON through a Blob. */
  download?:(filename:string,value:unknown)=>ActionResult;
}
export const SESSION_IMPORT_MAX_BYTES = 20 * 1024 * 1024;
type Tab = 'saves' | 'replay' | 'analysis' | 'production' | 'controls' | 'report';
const defaultGamepadHelp = [
  ['Left stick','Move camera'],['Right stick','Move cursor'],['LT / RT','Zoom out / in'],
  ['LB / RB','Select previous / next unit'],['A','Select at cursor'],['X','Order at cursor'],
  ['Y','Attack mode'],['B','Cancel'],['D-pad up','Use ability'],['D-pad down','Hold position'],
  ['D-pad left','Stop'],['D-pad right','Center headquarters'],['Left stick click (hold)','Queue orders'],
  ['Right stick click (hold) + A/B/X/Y/LB/RB','Action slots 1–6'],['Start / Menu','Pause'],['Select / View','Photo mode'],
].map(([control,action])=>({control,action}));
const labels:Record<Tab,string> = {saves:'Saves',replay:'Replay',analysis:'Analysis',production:'Production',controls:'Controls',report:'Report a bug'};
const create = <K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,className?:string):HTMLElementTagNameMap[K]=>{
  const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(className)element.className=className;return element;
};
function button(text:string,run:()=>void):HTMLButtonElement {const item=create('button',text);item.type='button';item.addEventListener('click',run);return item;}
function field(text:string,input:HTMLElement):HTMLLabelElement {const label=create('label',text,'session-field');label.append(input);return label;}
function errorText(error:unknown):string {return error instanceof Error?error.message:typeof error==='string'?error:'The operation failed. Your current match has been kept. Try again or choose another file.';}
function jsonInput(text:string):unknown {
  const value:unknown=JSON.parse(text);
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Choose a JSON object exported by Orcs vs Fairies.');
  return value;
}

/** Mount once alongside the HUD. Call update each frame; getters remain the source of saved, replay and analysis data. */
export function mountSessionTools(root:HTMLElement,callbacks:SessionToolsCallbacks) {
  let state:GameState|null=null,status:SessionToolsStatus={},active:Tab='saves',opened=false,disposed=false,previousFocus:HTMLElement|null=null;
  let saveRequest=0,productionKey='',analysisKey='',bindingsKey='',statusNotice='';
  let drag:{id:number;from:number;expected:string}|null=null;
  const host=create('section',undefined,'session-tools');host.setAttribute('aria-label','Session tools');
  const toolbar=create('nav',undefined,'session-toolbar');toolbar.setAttribute('aria-label','Session tools');
  const overlay=create('div',undefined,'session-overlay');overlay.hidden=true;
  const dialog=create('section',undefined,'session-dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Session tools');dialog.tabIndex=-1;
  const header=create('header');header.append(create('h2','Session tools'));
  const closeButton=button('Close',()=>close());closeButton.setAttribute('aria-label','Close session tools');header.append(closeButton);
  const nav=create('nav',undefined,'session-tabs');nav.setAttribute('aria-label','Session tools pages');
  const notice=create('p',undefined,'session-notice');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.hidden=true;
  const panels=new Map<Tab,HTMLElement>(),tabButtons=new Map<Tab,HTMLButtonElement>(),toolbarButtons=new Map<Tab,HTMLButtonElement>();
  for(const tab of Object.keys(labels) as Tab[]){
    const launch=button(labels[tab],()=>open(tab));launch.dataset.sessionTool=tab;toolbar.append(launch);toolbarButtons.set(tab,launch);
    const select=button(labels[tab],()=>switchTab(tab));select.dataset.sessionTab=tab;nav.append(select);tabButtons.set(tab,select);
    const panel=create('section',undefined,'session-page');panel.dataset.sessionPage=tab;panel.setAttribute('aria-label',labels[tab]);panel.hidden=true;panels.set(tab,panel);
  }
  const photoButton=button('Photo mode',()=>{try{close();callbacks.photo();}catch(error){open('report');showError(error);}});photoButton.dataset.sessionTool='photo';toolbar.append(photoButton);
  dialog.append(header,nav,notice,...panels.values());overlay.append(dialog);host.append(toolbar,overlay);root.append(host);
  const showMessage=(text:string,failed=false)=>{notice.textContent=text;notice.hidden=!text;notice.classList.toggle('session-error',failed);};
  const showError=(error:unknown)=>showMessage(errorText(error),true);
  async function run(operation:()=>MaybePromise<unknown>,success?:string,control?:HTMLButtonElement) {
    if(disposed)return;
    if(control?.dataset.busy==='true')return;
    if(control){control.dataset.busy='true';control.disabled=true;}
    try{if(await operation()===false)throw new Error('The action could not be applied. Refresh the panel and try again.');if(!disposed&&success)showMessage(success);}
    catch(error){if(!disposed)showError(error);}
    finally{if(control){delete control.dataset.busy;control.disabled=false;}if(!disposed)refreshActive();}
  }
  async function download(filename:string,value:unknown) {
    if(value===undefined||value===null)throw new Error('There is no match data to export yet.');
    if(callbacks.download){if(await callbacks.download(filename,value)===false)throw new Error('The download could not be started.');return;}
    const text=JSON.stringify(value,null,2);if(text===undefined)throw new Error('The match data could not be exported.');
    const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
    const link=create('a');link.href=url;link.download=filename;link.hidden=true;host.append(link);
    try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);}
  }
  function importControl(kind:'save'|'replay',action:(value:unknown)=>ActionResult):HTMLElement {
    const container=create('div',undefined,'session-import');
    const input=create('input');input.type='file';input.accept='.json,application/json';input.setAttribute('aria-label',`Import ${kind} JSON`);
    const submit=button(`Import ${kind}`,()=>{void run(async()=>{
      const file=input.files?.[0];if(!file)throw new Error(`Choose a ${kind} JSON file first.`);
      if(file.size>SESSION_IMPORT_MAX_BYTES)throw new Error('The file is too large. Choose a file smaller than 20 MiB.');
      let value:unknown;
      try{value=jsonInput(await file.text());}catch(error){throw new Error(`Could not read ${kind}: ${errorText(error)}`);}
      if(await action(value)===false)throw new Error(`The ${kind} could not be loaded. Your current match has been kept.`);
      if(disposed)return;input.value='';if(kind==='save')void refreshSaves();
    },`${kind==='save'?'Save loaded':'Replay loaded'}.`,submit);});
    container.append(field(`Import ${kind} JSON`,input),submit);return container;
  }

  const savePanel=panels.get('saves')!,saveName=create('input');saveName.type='text';saveName.maxLength=80;saveName.placeholder='Name this match';saveName.setAttribute('aria-label','Save name');
  const saveButton=button('Save match',()=>{const name=saveName.value.trim();if(!name){showError(new Error('Enter a name for this save.'));saveName.focus();return;}void run(async()=>{if(await callbacks.save(name)===false)throw new Error('The save could not be written. Check available browser storage and try again.');await refreshSaves();},'Match saved.',saveButton);});
  const exportSave=button('Export save',()=>{void run(async()=>download('orcs-vs-fairies-save.json',await callbacks.exportSave()),'Save downloaded.',exportSave);});
  const savesList=create('ul',undefined,'session-save-list');savesList.setAttribute('aria-label','Saved matches');
  const refreshSavesButton=button('Refresh saves',()=>{void refreshSaves();});
  const autosave=create('input');autosave.type='checkbox';autosave.setAttribute('aria-label','Enable autosaves');
  const interval=create('select');interval.setAttribute('aria-label','Autosave frequency');
  for(const seconds of [30,60,120,300]){const option=create('option',`${seconds<60?`${seconds} seconds`:`${seconds/60} minute${seconds>60?'s':''}`}`);option.value=String(seconds);interval.append(option);}
  const applyAutosave=button('Apply autosave settings',()=>{void run(()=>callbacks.setAutosave({enabled:autosave.checked,intervalSeconds:Number(interval.value)}),'Autosave settings saved.',applyAutosave);});
  savePanel.append(create('p','Save a named copy or download a JSON backup. Failed imports keep the current match intact.'),field('Save name',saveName),saveButton,exportSave,importControl('save',value=>callbacks.importSave(value)),create('h3','Autosaves'),field('Enable autosaves',autosave),field('Autosave frequency',interval),applyAutosave,create('h3','Saved matches'),refreshSavesButton,savesList);
  async function refreshSaves() {
    const request=++saveRequest;
    try{
      const saves=await callbacks.listSaves();if(disposed||request!==saveRequest)return;
      savesList.replaceChildren();
      if(!saves.length){savesList.append(create('li','No saved matches yet.'));return;}
      for(const save of [...saves].sort((a,b)=>new Date(b.savedAt).getTime()-new Date(a.savedAt).getTime())){
        const row=create('li'),details=create('div'),date=new Date(save.savedAt);
        details.append(create('strong',save.name),create('small',`${save.autosave?'Autosave · ':''}${Number.isNaN(date.getTime())?'Unknown save date':date.toLocaleString()}${save.tick===undefined?'':` · tick ${save.tick}`}`));
        const load=button('Load',()=>{void run(async()=>{try{if(await callbacks.load(save.id)===false)throw new Error('The saved data did not pass validation.');}catch(error){throw new Error(`Could not load this save: ${errorText(error)} Your current match has been kept. Choose another save or retry.`);}},`Loaded ${save.name}.`,load);});load.setAttribute('aria-label',`Load ${save.name}`);
        const remove=button('Delete',()=>{void run(async()=>{if(await callbacks.deleteSave(save.id)===false)throw new Error('The saved match could not be deleted.');await refreshSaves();},`Deleted ${save.name}.`,remove);});remove.setAttribute('aria-label',`Delete ${save.name}`);
        row.append(details,load,remove);savesList.append(row);
      }
    }catch(error){if(!disposed&&request===saveRequest){savesList.replaceChildren(create('li','Saved matches could not be read. Use Refresh saves to try again.'));showError(error);}}
  }

  const replayPanel=panels.get('replay')!,replayDetails=create('p'),play=button('Play replay',()=>{const current=callbacks.getReplay();if(current)void run(()=>callbacks.setReplayPlaying(!current.playing),undefined,play);});
  const seek=create('input');seek.type='range';seek.min='0';seek.step='1';seek.setAttribute('aria-label','Replay tick');
  seek.addEventListener('change',()=>{const current=callbacks.getReplay();if(current){const target=Number(seek.value);if(Number.isInteger(target)&&target>=current.initialTick&&target<=current.totalTicks)void run(()=>callbacks.seekReplay(target));}});
  const speed=create('select');speed.setAttribute('aria-label','Replay speed');for(const n of [.25,.5,1,2,4]){const option=create('option',`${n}×`);option.value=String(n);speed.append(option);}speed.addEventListener('change',()=>{if(callbacks.getReplay())void run(()=>callbacks.setReplaySpeed(Number(speed.value) as ReplaySpeed));});
  const perspective=create('select');perspective.setAttribute('aria-label','Replay perspective');for(const side of [0,1]){const option=create('option',`Player ${side+1}`);option.value=String(side);perspective.append(option);}perspective.addEventListener('change',()=>{if(callbacks.getReplay())void run(()=>callbacks.setReplayPerspective(Number(perspective.value) as Side));});
  const replayExport=button('Export replay',()=>{void run(async()=>download('orcs-vs-fairies-replay.json',await callbacks.exportReplay()),'Replay downloaded.',replayExport);});
  replayPanel.append(create('p','Load a replay to seek through the match and view either player’s fog of war.'),importControl('replay',value=>callbacks.importReplay(value)),replayExport,replayDetails,play,field('Replay tick',seek),field('Replay speed',speed),field('Replay perspective',perspective));
  function refreshReplay(){
    const replay=callbacks.getReplay();replayDetails.textContent=replay?`Tick ${replay.tick} of ${replay.totalTicks}`:'Import a replay to enable playback controls.';
    play.disabled=!replay||play.dataset.busy==='true';play.textContent=replay?.playing?'Pause replay':'Play replay';seek.disabled=speed.disabled=perspective.disabled=!replay;
    if(replay){seek.min=String(replay.initialTick);seek.max=String(Math.max(replay.initialTick,replay.totalTicks));if(document.activeElement!==seek)seek.value=String(replay.tick);if(document.activeElement!==speed)speed.value=String(replay.speed);if(document.activeElement!==perspective)perspective.value=String(replay.perspective);seek.setAttribute('aria-valuetext',`Tick ${replay.tick} of ${replay.totalTicks}, starting at ${replay.initialTick}`);}
  }

  const analysisPanel=panels.get('analysis')!;
  function refreshAnalysis(){
    const analysis=callbacks.getAnalysis();
    const permitted=!!status.replaySpectator||!!state&&(state.winner!==null||state.draw)||!state&&!!analysis?.complete;
    if(!permitted){if(analysisKey!=='private'){analysisKey='private';analysisPanel.replaceChildren(create('p','Full match analysis is available when the match ends or while spectating a replay. Enemy economy and technology remain private during play.'));}return;}
    if(!analysis||!analysis.samples.length){if(analysisKey!=='empty'){analysisKey='empty';analysisPanel.replaceChildren(create('p','No recorded analysis samples are available for this match.'));}return;}
    const replay=callbacks.getReplay(),key=JSON.stringify([analysis,replay?{initialTick:replay.initialTick,totalTicks:replay.totalTicks}:null]);if(key===analysisKey)return;analysisKey=key;analysisPanel.replaceChildren();
    const samples=analysis.samples.filter(sample=>Number.isFinite(sample.time)&&Number.isFinite(sample.tick)&&sample.players.length===2).sort((a,b)=>a.time-b.time);
    if(!samples.length){analysisPanel.append(create('p','No valid analysis samples are available.'));return;}
    const names=analysis.playerNames??['Player 1','Player 2'];
    analysisPanel.append(create('p',`${samples.length} recorded samples, ${formatTime(samples[0].time)} to ${formatTime(samples.at(-1)!.time)}. Lines show recorded values; gaps between samples are connected.`));
    chart('Resources held',samples,sample=>sample.wood+sample.ore+sample.crystal,names);
    if(hasAnalysisField(samples,'gathered'))chart('Resources gathered',samples,sample=>sample.gathered??NaN,names);
    chart('Army strength',samples,sample=>sample.army,names);
    if(hasAnalysisField(samples,'armyValue'))chart('Army value',samples,sample=>sample.armyValue??NaN,names);
    if(hasAnalysisField(samples,'buildings'))chart('Buildings',samples,sample=>sample.buildings??NaN,names);
    chart('Cumulative losses',samples,sample=>sample.losses,names);
    if(hasAnalysisField(samples,'buildingLosses'))chart('Cumulative building losses',samples,sample=>sample.buildingLosses??NaN,names);
    if(hasAnalysisField(samples,'lostValue'))chart('Cumulative loss value',samples,sample=>sample.lostValue??NaN,names);
    const technology=create('section',undefined,'session-chart');technology.append(create('h3','Technology timing'));
    const tech=analysis.technologies.filter(item=>Number.isFinite(item.time)&&(item.side===0||item.side===1)).sort((a,b)=>a.time-b.time);
    if(!tech.length)technology.append(create('p','No completed technologies were recorded.'));
    else{
      const timeline=svg('svg');timeline.setAttribute('viewBox','0 0 640 130');timeline.setAttribute('role','img');timeline.setAttribute('aria-label','Completed technologies by match time');
      const end=Math.max(1,samples.at(-1)!.time,...tech.map(item=>item.time));
      for(const side of [0,1] as Side[]){const y=35+side*55,line=svg('line');setSvg(line,{x1:80,y1:y,x2:620,y2:y,stroke:'#8994a4'});timeline.append(line);const label=svg('text');setSvg(label,{x:2,y:y+4,fill:'#eee'});label.textContent=names[side];timeline.append(label);}
      const list=create('ul');for(const item of tech){const marker=svg('circle');setSvg(marker,{cx:80+540*item.time/end,cy:35+item.side*55,r:5,fill:item.side===0?'#efb86b':'#8fbded'});const title=svg('title');title.textContent=`${names[item.side]}: ${item.name} at ${formatTime(item.time)}`;marker.append(title);timeline.append(marker);const row=create('li'),label=`${names[item.side]} · ${item.name} · ${formatTime(item.time)} (tick ${item.tick})`;if(replay){const jump=button(label,()=>seekAnalysisTick(item.tick));jump.dataset.analysisTechnologyTick=String(item.tick);jump.disabled=!canSeekAnalysisTick(item.tick);row.append(jump);}else row.textContent=label;list.append(row);}technology.append(timeline,list);
    }
    analysisPanel.append(technology);
  }
  function chart(title:string,samples:SessionAnalysisSample[],value:(p:SessionAnalysisPlayer)=>number,names:[string,string]){
    const section=create('section',undefined,'session-chart');section.append(create('h3',title));const plot=svg('svg');plot.setAttribute('viewBox','0 0 640 200');plot.setAttribute('role',callbacks.getReplay()?'group':'img');plot.setAttribute('aria-label',`${title} over match time`);
    const series=([0,1] as Side[]).map(side=>samples.map(sample=>({tick:sample.tick,time:sample.time,value:value(sample.players[side])})).filter(point=>Number.isFinite(point.value))),start=samples[0].time,end=samples.at(-1)!.time;
    const maximum=Math.max(1,...series.flat().map(point=>point.value));
    const axis=svg('path');setSvg(axis,{d:'M 55 15 V 170 H 620',fill:'none',stroke:'#8994a4'});plot.append(axis);
    for(const [x,y,text] of [[5,20,String(Math.ceil(maximum))],[20,173,'0'],[55,194,formatTime(start)],[570,194,formatTime(end)]] as [number,number,string][]){const label=svg('text');setSvg(label,{x,y,fill:'#d7dee8'});label.textContent=text;plot.append(label);}
    for(const side of [0,1] as Side[]){const path=svg('path'),points=series[side];setSvg(path,{d:points.map((point,index)=>`${index?'L':'M'} ${(55+565*(point.time-start)/Math.max(1,end-start)).toFixed(2)} ${(170-155*point.value/maximum).toFixed(2)}`).join(' '),fill:'none',stroke:side===0?'#efb86b':'#8fbded','stroke-width':2,...(side===1?{'stroke-dasharray':'7 4'}:{})});const description=svg('title');description.textContent=`${names[side]}: ${points.map(point=>`${formatTime(point.time)} ${point.value}`).join('; ')}`;path.append(description);plot.append(path);
      for(const point of points){const marker=svg('circle'),label=`${names[side]} ${title}: ${point.value} at ${formatTime(point.time)} (tick ${point.tick})`;setSvg(marker,{cx:55+565*(point.time-start)/Math.max(1,end-start),cy:170-155*point.value/maximum,r:5,fill:side===0?'#efb86b':'#8fbded'});const pointTitle=svg('title');pointTitle.textContent=label;marker.append(pointTitle);if(canSeekAnalysisTick(point.tick)){marker.dataset.analysisTick=String(point.tick);marker.setAttribute('role','button');marker.setAttribute('tabindex','0');marker.setAttribute('aria-label',`View replay: ${label}`);marker.style.cursor='pointer';marker.addEventListener('click',()=>seekAnalysisTick(point.tick));marker.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();seekAnalysisTick(point.tick);}});}plot.append(marker);}
    }
    section.append(plot,create('p',`${names[0]}: gold solid line · ${names[1]}: blue dashed line`));analysisPanel.append(section);
  }
  function hasAnalysisField(samples:SessionAnalysisSample[],field:keyof SessionAnalysisPlayer){return samples.some(sample=>sample.players.some(player=>Number.isFinite(player[field])));}
  function canSeekAnalysisTick(tick:number){const replay=callbacks.getReplay();return !!replay&&Number.isInteger(tick)&&tick>=replay.initialTick&&tick<=replay.totalTicks;}
  function seekAnalysisTick(tick:number){if(!canSeekAnalysisTick(tick))return;void run(async()=>{if(await callbacks.seekReplay(tick)===false)throw new Error('This replay timestamp could not be opened.');if(!disposed)switchTab('replay');});}

  const productionPanel=panels.get('production')!,productionSummary=create('p'),productionList=create('div',undefined,'session-production-list');productionPanel.append(create('p','Manage every recruitment building. The active recruit stays in slot 1; drag waiting recruits or use Move up and Move down.'),productionSummary,productionList);
  type ProductionAction={button:HTMLButtonElement;id:number;role?:UnitRole;index?:number;from?:number;to?:number};const productionActions:ProductionAction[]=[];
  function refreshProduction(){
    if(!state){productionKey='';productionActions.length=0;productionList.replaceChildren();productionSummary.textContent='Start or load a match to manage recruitment.';return;}
    const side=status.side??0,player=state.players[side],faction=FACTIONS[player.faction],buildings=state.entities.filter(e=>e.kind==='building'&&e.side===side&&e.hp>0&&(e.role==='hq'||e.role==='barracks')).sort((a,b)=>a.id-b.id);
    const key=`${side}:${player.faction}:`+buildings.map(e=>`${e.id}/${e.role}/${e.queue.join(',')}`).join(';');
    productionSummary.textContent=`${buildings.length} recruitment building${buildings.length===1?'':'s'} · ${player.population} fielded · ${reservedPlaces(state,side)} queued · ${player.cap} supply`;
    if(key!==productionKey){productionKey=key;productionActions.length=0;productionList.replaceChildren();for(const building of buildings){
      const card=create('section',undefined,'session-production-card');card.dataset.productionBuilding=String(building.id);
      const heading=create('header');heading.append(create('h3',`${faction.buildings[building.role as 'hq'|'barracks'].name} #${building.id}`),button('Select building',()=>{callbacks.selectBuilding(building.id);close();}));card.append(heading,create('p',undefined,'session-building-status'));
      const recruits=create('div',undefined,'session-recruits');for(const role of (building.role==='hq'?['worker']:['melee','ranged','special','spear','cavalry','siege']) as UnitRole[]){const def=faction.units[role];const recruit=button(`Recruit ${def.name}`,()=>{void run(()=>callbacks.train(building.id,role),undefined,recruit);});recruit.dataset.recruit=role;recruit.append(create('small',costText(def.cost)),create('small',undefined,'session-action-reason'));productionActions.push({button:recruit,id:building.id,role});recruits.append(recruit);}card.append(recruits);
      const queue=create('ol',undefined,'session-production-queue');queue.setAttribute('aria-label',`Production queue for building ${building.id}`);
      building.queue.forEach((role,index)=>{
        const row=create('li');row.dataset.queueIndex=String(index);row.dataset.producer=String(building.id);row.draggable=index>0;row.append(create('span',`${index+1}. ${faction.units[role].name}${index===0?' · Active':' · Waiting'}`));
        if(index===0){const progress=create('progress');progress.max=1;progress.setAttribute('aria-label','Active recruitment progress');row.append(progress);}
        const cancel=button('Cancel',()=>{void run(()=>callbacks.cancelTrain(building.id,index,card.dataset.expectedQueue!),undefined,cancel);});cancel.setAttribute('aria-label',`Cancel ${faction.units[role].name} in slot ${index+1} at building ${building.id}`);productionActions.push({button:cancel,id:building.id,index});row.append(cancel);
        if(index>0){for(const [text,to] of [['Move up',index-1],['Move down',index+1]] as [string,number][]){const move=button(text,()=>{if(to<1||to>=building.queue.length)return;void run(()=>callbacks.reorderTrain(building.id,index,to,card.dataset.expectedQueue!),undefined,move);});move.setAttribute('aria-label',`${text} ${faction.units[role].name} in slot ${index+1} at building ${building.id}`);productionActions.push({button:move,id:building.id,from:index,to});row.append(move);}}
        row.addEventListener('dragstart',event=>{if(index===0||productionDisabled()){event.preventDefault();return;}drag={id:building.id,from:index,expected:card.dataset.expectedQueue!};event.dataTransfer?.setData('text/plain',JSON.stringify(drag));if(event.dataTransfer)event.dataTransfer.effectAllowed='move';});
        row.addEventListener('dragover',event=>{if(drag&&index>0&&drag.id===building.id&&!productionDisabled())event.preventDefault();});
        row.addEventListener('drop',event=>{event.preventDefault();const current=drag;drag=null;if(!current||index===0||current.from===index||current.id!==building.id||current.expected!==card.dataset.expectedQueue||productionDisabled())return;void run(()=>callbacks.reorderTrain(building.id,current.from,index,current.expected));});row.addEventListener('dragend',()=>{drag=null;});queue.append(row);
      });if(!building.queue.length)queue.append(create('li','Queue is empty.'));card.append(queue);productionList.append(card);
    }}
    for(const building of buildings){const card=productionList.querySelector<HTMLElement>(`[data-production-building="${building.id}"]`)!;card.dataset.expectedQueue=JSON.stringify(building.queue);card.querySelector('.session-building-status')!.textContent=building.progress<1?`Under construction · ${Math.floor(building.progress*100)}%`:`${Math.floor(building.hp)} / ${building.maxHp} health`;const progress=card.querySelector('progress');if(progress)progress.value=building.trainProgress;}
    for(const action of productionActions){const building=buildings.find(e=>e.id===action.id);let reason=productionDisabled();if(!reason&&building){if(action.role)reason=trainReason(state,side,building,action.role);else if(action.from!==undefined&&action.to!<1)reason='The active recruit stays in slot 1';else if(action.from!==undefined&&action.to!>=building.queue.length)reason='Already last in the queue';}if(!building)reason='Building is no longer available';action.button.disabled=!!reason||action.button.dataset.busy==='true';action.button.title=reason;action.button.setAttribute('aria-disabled',String(action.button.disabled));const hint=action.button.querySelector('.session-action-reason');if(hint)hint.textContent=reason||'Ready';}
  }
  function productionDisabled():string {return !state?'No active match':state.winner!==null||state.draw?'Match ended':status.replaySpectator||callbacks.getReplay()?'Replay playback is read only':'';}

  const controlsPanel=panels.get('controls')!,bindingsList=create('div',undefined,'session-binding-list'),profileName=create('input');profileName.maxLength=40;profileName.setAttribute('aria-label','Control profile name');
  const profiles=create('select');profiles.setAttribute('aria-label','Saved control profiles');
  const saveProfile=button('Save control profile',()=>{const name=profileName.value.trim();if(!name){showError(new Error('Enter a control profile name.'));profileName.focus();return;}void run(()=>callbacks.saveBindingProfile(name),'Control profile saved.',saveProfile);});
  const loadProfile=button('Load control profile',()=>{if(!profiles.value){showError(new Error('Choose a saved control profile.'));return;}void run(async()=>{if(await callbacks.loadBindingProfile(profiles.value)===false)throw new Error('The control profile could not be loaded.');bindingsKey='';},'Control profile loaded.',loadProfile);});
  const reset=button('Restore default controls',()=>{void run(async()=>{if(await callbacks.resetBindings()===false)throw new Error('Default controls could not be restored.');bindingsKey='';},'Default controls restored.',reset);});
  const gamepadHelp=create('dl',undefined,'session-gamepad-help'),photoHelp=create('p');
  controlsPanel.append(create('p','Click a shortcut field and press the new key combination, then Apply. Ctrl, Alt and Shift are supported. Conflicts are reported without changing the existing binding.'),bindingsList,field('Control profile name',profileName),saveProfile,field('Saved control profiles',profiles),loadProfile,reset,create('h3','Gamepad'),create('p','Connect a standard controller and press a button to enable it. The right stick moves the battlefield cursor.'),gamepadHelp,create('h3','Photo mode'),photoHelp);
  function refreshBindings(){
    photoHelp.textContent=`Photo mode hides the HUD so you can compose a screenshot. ${callbacks.photoExitHint?.()??'Press Escape or Select / View to leave photo mode.'}`;
    const help=callbacks.getGamepadHelp?.()??defaultGamepadHelp,helpKey=JSON.stringify(help);
    if(gamepadHelp.dataset.key!==helpKey){gamepadHelp.dataset.key=helpKey;gamepadHelp.replaceChildren();for(const item of help)gamepadHelp.append(create('dt',item.control),create('dd',item.action));}
    const bindings=callbacks.getBindings(),key=JSON.stringify(bindings);if(key!==bindingsKey&&!(document.activeElement instanceof HTMLInputElement&&bindingsList.contains(document.activeElement))){bindingsKey=key;bindingsList.replaceChildren();for(const binding of bindings){const input=create('input');input.value=binding.key;input.maxLength=60;input.setAttribute('aria-label',`${binding.label} shortcut`);input.dataset.bindingAction=binding.action;input.addEventListener('keydown',event=>{if(event.key==='Tab')return;if(event.key==='Escape'){event.stopPropagation();input.blur();return;}event.preventDefault();event.stopPropagation();const modifier=/^(Shift|Control|Alt|Meta)(Left|Right)$/.test(event.code)?event.code.replace(/(Left|Right)$/,''):null;if(modifier||['Shift','Control','Alt','Meta','AltGraph'].includes(event.key)){if(binding.action!=='queueModifier'||!modifier)return;}input.value=[event.ctrlKey&&modifier!=='Control'?'Ctrl':'',event.altKey&&modifier!=='Alt'?'Alt':'',event.shiftKey&&modifier!=='Shift'?'Shift':'',event.metaKey&&modifier!=='Meta'?'Meta':'',shortcutKey(event)].filter(Boolean).join('+');});const apply=button('Apply',()=>{const value=input.value.trim();if(!value){showError(new Error('Choose a shortcut before applying it.'));return;}void run(()=>callbacks.setBinding(binding.action,value),`Updated ${binding.label}.`,apply);});apply.setAttribute('aria-label',`Apply ${binding.label} shortcut`);const row=create('div',undefined,'session-binding-row');row.append(field(binding.label,input),apply);bindingsList.append(row);}}
    const names=callbacks.getBindingProfiles(),profileKey=JSON.stringify(names);if(profiles.dataset.key!==profileKey){const selected=profiles.value;profiles.dataset.key=profileKey;profiles.replaceChildren();if(!names.length){const empty=create('option','No saved profiles');empty.value='';profiles.append(empty);}for(const name of names){const option=create('option',name);option.value=name;profiles.append(option);}if(names.includes(selected))profiles.value=selected;}loadProfile.disabled=!names.length||loadProfile.dataset.busy==='true';
  }

  const reportPanel=panels.get('report')!,description=create('textarea');description.rows=6;description.maxLength=4000;description.setAttribute('aria-label','Bug description');description.placeholder='What happened? What did you expect? Include the steps that caused it.';
  const report=button('Download bug report',()=>{const text=description.value.trim();if(!text){showError(new Error('Describe the problem before downloading a report.'));description.focus();return;}void run(async()=>download('orcs-vs-fairies-bug-report.json',await callbacks.bugReport(text)),'Bug report downloaded. It includes the recorded match and diagnostics.',report);});
  reportPanel.append(create('p','Describe the problem and download a JSON report containing the recorded match and diagnostics. You can attach it when filing a bug.'),field('Bug description',description),report);

  function switchTab(tab:Tab){active=tab;for(const [name,panel] of panels)panel.hidden=name!==tab;for(const [name,control] of tabButtons){control.setAttribute('aria-pressed',String(name===tab));control.classList.toggle('active',name===tab);}notice.hidden=true;refreshActive();if(tab==='saves'){try{const settings=callbacks.getAutosave();autosave.checked=settings.enabled;const raw=String(settings.intervalSeconds);if(!Array.from(interval.options).some(o=>o.value===raw)){const custom=create('option',`${settings.intervalSeconds} seconds`);custom.value=raw;interval.append(custom);}interval.value=raw;}catch(error){showError(error);}void refreshSaves();}}
  function open(tab:Tab){if(disposed)return;if(!opened){previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;opened=true;overlay.hidden=false;try{callbacks.onModal(true);}catch(error){showError(error);}}switchTab(tab);closeButton.focus();}
  function close(){if(!opened)return;opened=false;overlay.hidden=true;drag=null;try{callbacks.onModal(false);}catch(error){showError(error);}if(previousFocus?.isConnected)previousFocus.focus();previousFocus=null;}
  function refreshActive(){if(!opened||disposed)return;try{saveButton.disabled=exportSave.disabled=!state||saveButton.dataset.busy==='true'||exportSave.dataset.busy==='true';if(active==='production')refreshProduction();if(active==='replay')refreshReplay();if(active==='analysis')refreshAnalysis();if(active==='controls')refreshBindings();}catch(error){showError(error);}}
  function keyboard(event:KeyboardEvent){if(!opened)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}if(event.key==='Tab'){const controls=Array.from(dialog.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]')).filter(e=>!e.closest('[hidden]')&&!(e instanceof HTMLButtonElement&&e.disabled)&&!(e instanceof HTMLInputElement&&e.disabled)&&!(e instanceof HTMLSelectElement&&e.disabled)&&e.tabIndex>=0);if(!controls.length){event.preventDefault();dialog.focus();return;}const first=controls[0],last=controls.at(-1)!;if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus();}}if(!dialog.contains(event.target as Node))event.stopPropagation();}
  document.addEventListener('keydown',keyboard,true);
  const stop=(event:Event)=>event.stopPropagation();for(const type of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','contextmenu','wheel'])host.addEventListener(type,stop);
  host.addEventListener('keydown',event=>{if(opened||event.target instanceof HTMLButtonElement&&['Enter',' ','Spacebar'].includes(event.key))event.stopPropagation();});
  return {
    update(nextState:GameState|null,nextStatus:SessionToolsStatus={}){if(disposed)return;state=nextState;status=nextStatus;host.classList.toggle('session-in-match',!!state);photoButton.disabled=!state;try{for(const tab of ['production','analysis'] as Tab[]){const disabled=tab==='production'?!state:!state&&!callbacks.getAnalysis();toolbarButtons.get(tab)!.disabled=disabled;}}catch(error){showError(error);}if(nextStatus.notice&&nextStatus.notice!==statusNotice)showMessage(nextStatus.notice);statusNotice=nextStatus.notice??'';refreshActive();},
    dispose(){if(disposed)return;close();disposed=true;++saveRequest;document.removeEventListener('keydown',keyboard,true);host.remove();}
  };
}
function costText(cost:{wood:number;ore:number;crystal:number}):string {return `${cost.wood} wood · ${cost.ore} ore${cost.crystal?` · ${cost.crystal} crystal`:''}`;}
function reservedPlaces(state:GameState,side:Side):number{return state.entities.filter(e=>e.side===side&&e.hp>0).reduce((sum,e)=>sum+e.queue.length,0);}
function trainReason(state:GameState,side:Side,building:Entity,role:UnitRole):string {
  const player=state.players[side],unit=FACTIONS[player.faction].units[role];
  if(building.progress!==1)return 'Under construction';
  if(playerAge(player)<(unit.age??1))return `Requires ${AGE_NAMES[unit.age!]}`;
  if(building.queue.length>=5)return 'Queue full';
  if(player.population+reservedPlaces(state,side)>=player.cap)return 'Build a depot for supply';
  const missing=(['wood','ore','crystal'] as const).filter(kind=>player[kind]<unit.cost[kind]).map(kind=>`${Math.ceil(unit.cost[kind]-player[kind])} ${kind}`);
  return missing.length?`Need ${missing.join(', ')}`:'';
}
function shortcutKey(event:KeyboardEvent):string {
  // Physical keys keep Shift+1 and punctuation compatible with stored KeyboardEvent.code bindings.
  if(event.code&&event.code!=='Unidentified'){
    if(/^Key[A-Z]$/.test(event.code))return event.code.slice(3);
    if(/^Digit[0-9]$/.test(event.code))return event.code.slice(5);
    if(/^Arrow(Left|Right|Up|Down)$/.test(event.code))return event.code.slice(5);
    return event.code;
  }
  return event.key===' '?'Space':event.key.length===1?event.key.toUpperCase():event.key;
}
function formatTime(time:number):string{return `${Math.floor(time/60)}:${Math.floor(time%60).toString().padStart(2,'0')}`;}
function svg<K extends keyof SVGElementTagNameMap>(tag:K):SVGElementTagNameMap[K]{return document.createElementNS('http://www.w3.org/2000/svg',tag);}
function setSvg(element:SVGElement,attributes:Record<string,string|number>){for(const [key,value] of Object.entries(attributes))element.setAttribute(key,String(value));}
