import { FACTIONS } from '../core/content';
import { blueprintReason, validPlanningSide, validateWorkerTargets, workerAllocation } from '../core/planning';
import type { ConstructionBlueprint, ConstructionPlan, WorkerTargets, applyWorkerTargets, executeBlueprints } from '../core/planning';
import type { BuildingRole, GameState, ResourceKind, Side, Vec } from '../core/types';
import './session-tools.css';

type MaybePromise<T> = T | Promise<T>;
type ActionResult = MaybePromise<void | boolean>;
export interface BlueprintPlacement extends Vec { role:BuildingRole }
export interface PlanningToolsStatus { side?:Side; readOnly?:boolean; blocked?:boolean }
/** Host callbacks own the serialized plan and gate commands for replay, network and photo modes. */
export interface PlanningToolsCallbacks {
  getPlan:()=>ConstructionPlan | null;
  getTargets:()=>WorkerTargets;
  setTargets:(targets:WorkerTargets)=>ActionResult;
  applyTargets:(targets:WorkerTargets)=>MaybePromise<ReturnType<typeof applyWorkerTargets>>;
  addBlueprint:(spec:BlueprintPlacement)=>MaybePromise<ConstructionBlueprint>;
  assignBlueprintWorkers:(id:string,workers:number[])=>ActionResult;
  cancelBlueprint:(id:string)=>ActionResult;
  executeBlueprints:()=>MaybePromise<ReturnType<typeof executeBlueprints>>;
  selectedWorkerIds:()=>number[];
  onPreview?:(blueprints:readonly ConstructionBlueprint[])=>void;
  onModal:(open:boolean)=>void;
  /** Close the dialog, accept a grid position from the battlefield, then reopen with the new plan. */
  beginPlacement?:(role:BuildingRole,accept:(point:Vec)=>void,cancel:()=>void)=>void;
  cancelPlacement?:()=>void;
}
const kinds:ResourceKind[]=['wood','ore','crystal'];
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,className?:string):HTMLElementTagNameMap[K]=>{
  const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(className)element.className=className;return element;
};
function field(text:string,input:HTMLElement):HTMLLabelElement {const label=el('label',text,'session-field');label.append(input);return label;}
function makeButton(text:string,action:()=>void):HTMLButtonElement {const button=el('button',text);button.type='button';button.addEventListener('click',action);return button;}
function errorMessage(error:unknown):string{return error instanceof Error?error.message:typeof error==='string'?error:'The action could not be applied. Your pending plans have been kept.';}

/** The panel edits metadata through callbacks. It never pays costs or changes worker orders itself. */
export function mountPlanningTools(root:HTMLElement,callbacks:PlanningToolsCallbacks) {
  let state:GameState|null=null,status:PlanningToolsStatus={},opened=false,disposed=false,placing=false,placementGeneration=0;
  let previousFocus:HTMLElement|null=null,lastState:GameState|null=null,lastSide:Side|undefined,plansKey='',workersKey='',factionKey='',previewKey='';
  const chosenWorkers=new Set<number>(),targets=new Map<ResourceKind,HTMLInputElement>();
  const host=el('section',undefined,'session-tools planning-tools');host.setAttribute('aria-label','Settlement planning');host.style.zIndex='95';
  const toolbar=el('nav',undefined,'session-toolbar');toolbar.setAttribute('aria-label','Settlement planning');toolbar.style.left='16px';toolbar.style.right='auto';
  const launch=makeButton('Settlement planning',()=>open());launch.dataset.planningLaunch='';toolbar.append(launch);
  const overlay=el('div',undefined,'session-overlay');overlay.hidden=true;
  const dialog=el('section',undefined,'session-dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Settlement planning');dialog.tabIndex=-1;
  const heading=el('header');heading.append(el('h2','Settlement planning'));
  const closeButton=makeButton('Close',()=>close());closeButton.setAttribute('aria-label','Close settlement planning');heading.append(closeButton);
  const notice=el('p',undefined,'session-notice');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.hidden=true;
  const content=el('div',undefined,'session-page');
  const allocationSummary=el('p'),allocationResult=el('p');allocationResult.setAttribute('aria-live','polite');
  const targetFields=el('div',undefined,'session-recruits');
  for(const kind of kinds){const input=el('input');input.type='number';input.min='0';input.max='10000';input.step='1';input.value='0';input.setAttribute('aria-label',`${kind[0].toUpperCase()+kind.slice(1)} worker target`);targets.set(kind,input);targetFields.append(field(`${kind[0].toUpperCase()+kind.slice(1)} workers`,input));}
  function readTargets():WorkerTargets {
    const value=Object.fromEntries(kinds.map(kind=>[kind,targets.get(kind)!.value.trim()===''?NaN:Number(targets.get(kind)!.value)]));
    if(!validateWorkerTargets(value))throw new Error('Worker targets must be whole numbers from 0 to 10000.');return value;
  }
  const saveTargets=makeButton('Save worker targets',()=>{void run(async()=>{if(await callbacks.setTargets(readTargets())===false)throw new Error('Worker targets could not be saved.');},'Worker targets saved. Apply them when you are ready.',saveTargets);});
  const applyTargets=makeButton('Apply worker targets',()=>{void run(async()=>{
    const value=readTargets();if(await callbacks.setTargets(value)===false)throw new Error('Worker targets could not be saved.');
    const result=await callbacks.applyTargets(value),unmet=kinds.filter(kind=>result.unmet[kind]>0).map(kind=>`${result.unmet[kind]} ${kind}`);
    allocationResult.textContent=`Last allocation: assigned ${kinds.map(kind=>`${result.assigned[kind]} ${kind}`).join(', ')}. ${unmet.length?`Unmet targets: ${unmet.join(', ')}.`:'All worker targets were met when applied.'} ${result.messages.join(' ')}`;
  },'Worker allocation applied through gathering orders.',applyTargets);});
  content.append(el('h3','Worker allocation'),el('p','Set desired gatherers for each resource. Applying targets uses idle workers and redistributes current gatherers. Workers building, moving, fighting or following queued orders keep their work. Targets can remain unmet when workers, visible reachable deposits or completed delivery buildings are unavailable.'),allocationSummary,targetFields,saveTargets,applyTargets,allocationResult);

  const building=el('select');building.setAttribute('aria-label','Blueprint building');
  const x=el('input'),y=el('input');for(const input of [x,y]){input.type='number';input.min='0.5';input.step='0.5';}x.setAttribute('aria-label','Blueprint X');y.setAttribute('aria-label','Blueprint Y');
  function readPlacement():BlueprintPlacement {const role=building.value as BuildingRole,px=Number(x.value),py=Number(y.value);if(!state||!x.value.trim()||!y.value.trim()||!Number.isFinite(px)||!Number.isFinite(py))throw new Error('Enter a finite X and Y map position.');return {role,x:role==='gate'?Math.round(px):px,y:role==='gate'?Math.round(py):py};}
  const add=makeButton('Add blueprint',()=>{void run(async()=>{await callbacks.addBlueprint(readPlacement());},'Blueprint added. Planning does not spend resources or assign workers.',add);});
  const place=makeButton('Place on battlefield',()=>{
    if(!callbacks.beginPlacement||readOnly())return;
    const role=building.value as BuildingRole,generation=++placementGeneration;placing=true;close(true);
    try{callbacks.beginPlacement(role,point=>{if(disposed||generation!==placementGeneration)return;placing=false;open();x.value=String(point.x);y.value=String(point.y);void run(async()=>{await callbacks.addBlueprint({role,x:point.x,y:point.y});},'Blueprint placed. Choose workers before constructing it.');},()=>{if(disposed||generation!==placementGeneration)return;placing=false;open();message('Blueprint placement canceled.');});}
    catch(error){placing=false;open();message(errorMessage(error),true);}
  });
  const preview=el('canvas');preview.width=300;preview.height=220;preview.setAttribute('aria-label','Planned construction preview');preview.style.width='min(100%, 420px)';preview.style.height='auto';preview.style.background='#0b1710';preview.style.border='1px solid #596b51';
  const previewNote=el('p');previewNote.textContent='The preview shows your plans, owned buildings and visible deposits. Numbered outlines match the plan list. Add a blueprint at a visible valid site, then assign workers and construct it.';
  const positionFields=el('div',undefined,'session-recruits');positionFields.append(field('Building',building),field('Map X',x),field('Map Y',y));
  content.append(el('h3','Construction blueprints'),el('p','Plan several locations before committing workers or resources. Invalid or unaffordable sites stay pending so you can move obstacles, gain vision or gather resources before trying again.'),positionFields,add,place,previewNote,preview);
  const workerSummary=el('p'),workerPicker=el('div');workerPicker.setAttribute('aria-label','Choose construction workers');workerPicker.style.display='grid';workerPicker.style.gridTemplateColumns='repeat(auto-fit,minmax(170px,1fr))';
  const useSelection=makeButton('Use battlefield selection',()=>{chosenWorkers.clear();for(const id of ownSelected())chosenWorkers.add(id);refreshWorkerChoices();});
  const list=el('ol');list.setAttribute('aria-label','Construction plans');list.style.padding='0';list.style.listStyle='none';
  const execute=makeButton('Construct assigned plans',()=>{void run(async()=>{const result=await callbacks.executeBlueprints();message(`Started ${result.started.length} plan${result.started.length===1?'':'s'}. ${result.pending.length?`${result.pending.length} pending: ${result.pending.map(item=>item.reason).join(' ')}`:'No pending construction plans.'}`);},undefined,execute);});
  content.append(el('h3','Construction workers'),el('p','Choose one or more workers below, then assign them to a plan. Each worker can construct one new site at a time; other assigned plans remain pending until workers are free.'),workerSummary,useSelection,workerPicker,el('h3','Your plans'),list,execute);
  dialog.append(heading,notice,content);overlay.append(dialog);host.append(toolbar,overlay);root.append(host);

  function side():Side{return status.side??0;}
  function contextValid():boolean{return !!state&&validPlanningSide(state,side());}
  function readOnly():string{return !contextValid()?'Start or load a match first.':status.readOnly?'Planning commands are unavailable in this view.':state!.winner!==null||state!.draw?'Match ended.':'';}
  function message(text:string,failed=false){notice.textContent=text;notice.hidden=!text;notice.classList.toggle('session-error',failed);}
  async function run(operation:()=>MaybePromise<unknown>,success?:string,control?:HTMLButtonElement){
    if(disposed||control?.dataset.busy==='true')return;
    if(readOnly()){message(readOnly(),true);return;}
    if(control){control.dataset.busy='true';control.disabled=true;}
    try{if(await operation()===false)throw new Error('The action could not be applied. Your pending plans have been kept.');if(!disposed&&success)message(success);}
    catch(error){if(!disposed)message(errorMessage(error),true);}
    finally{if(control)delete control.dataset.busy;if(!disposed)refresh();}
  }
  function ownSelected():number[]{if(!contextValid())return [];const selected=new Set(callbacks.selectedWorkerIds());return state!.entities.filter(e=>e.side===side()&&e.kind==='unit'&&e.role==='worker'&&e.hp>0&&!e.illusion&&selected.has(e.id)).map(e=>e.id);}
  function ownWorkers(){return !contextValid()?[]:state!.entities.filter(e=>e.side===side()&&e.kind==='unit'&&e.role==='worker'&&e.hp>0&&!e.illusion).sort((a,b)=>a.id-b.id);}
  function refreshWorkerChoices(){
    const workers=ownWorkers(),key=workers.map(e=>e.id).join(',');for(const id of chosenWorkers)if(!workers.some(e=>e.id===id))chosenWorkers.delete(id);
    if(key!==workersKey){workersKey=key;workerPicker.replaceChildren();for(const worker of workers){const check=el('input');check.type='checkbox';check.dataset.workerChoice=String(worker.id);check.setAttribute('aria-label',`Worker ${worker.id}`);check.addEventListener('change',()=>{if(check.checked)chosenWorkers.add(worker.id);else chosenWorkers.delete(worker.id);refreshWorkerChoices();});const label=field('',check);label.style.margin='5px 0';label.append(el('span',undefined,'planning-worker-label'));workerPicker.append(label);}}
    for(const worker of workers){const check=workerPicker.querySelector<HTMLInputElement>(`[data-worker-choice="${worker.id}"]`)!;check.checked=chosenWorkers.has(worker.id);check.disabled=!!readOnly();check.parentElement!.querySelector('.planning-worker-label')!.textContent=`Worker ${worker.id} · ${worker.order.type}${worker.orderQueue?.length?' · queued':''}`;}
    workerSummary.textContent=`${chosenWorkers.size} worker${chosenWorkers.size===1?'':'s'} chosen · ${workers.length} owned workers available to assign`;
    for(const assign of Array.from(list.querySelectorAll<HTMLButtonElement>('[data-assign-plan]')))assign.disabled=!!readOnly()||chosenWorkers.size===0||assign.dataset.busy==='true'||assign.closest<HTMLElement>('[data-blueprint-id]')?.dataset.planStatus==='complete';
  }
  function fillContext(){
    if(!contextValid())return;
    const faction=state!.players[side()].faction;
    if(faction!==factionKey){factionKey=faction;const current=building.value;building.replaceChildren();for(const def of Object.values(FACTIONS[faction].buildings)){const option=el('option',`${def.name} · ${def.cost.wood} wood, ${def.cost.ore} ore${def.cost.crystal?`, ${def.cost.crystal} crystal`:''}`);option.value=def.role;building.append(option);}building.value=Array.from(building.options).some(option=>option.value===current)?current:'depot';}
    x.max=String(state!.width-.5);y.max=String(state!.height-.5);
    if(state!==lastState||side()!==lastSide){lastState=state;lastSide=side();const saved=callbacks.getTargets();if(validateWorkerTargets(saved))for(const kind of kinds)targets.get(kind)!.value=String(saved[kind]);chosenWorkers.clear();for(const id of ownSelected())chosenWorkers.add(id);allocationResult.textContent='';const home=state!.starts[side()];if(home){x.value=String(Math.min(state!.width-.5,home.x+5));y.value=String(home.y);}plansKey='';workersKey='';}
  }
  function currentPlan():ConstructionPlan|null {const plan=callbacks.getPlan();return plan&&plan.side===side()?plan:null;}
  function refreshPlans(){
    const plan=currentPlan(),items=plan?.blueprints??[];
    const key=items.map(item=>`${item.id}/${item.role}/${item.x}/${item.y}/${item.workerIds.join(',')}`).join(';');
    if(key!==plansKey||!list.children.length){plansKey=key;list.replaceChildren();items.forEach((item,index)=>{
      const row=el('li',undefined,'session-production-card');row.dataset.blueprintId=item.id;row.dataset.planStatus=item.status;
      const name=contextValid()?FACTIONS[state!.players[side()].faction].buildings[item.role]?.name??item.role:item.role;
      row.append(el('h3',`${index+1}. ${name} at ${item.x}, ${item.y}`),el('p',undefined,'planning-plan-workers'),el('p',undefined,'planning-plan-status'));
      const assign=makeButton('Assign selected workers',()=>{void run(()=>{const ids=Array.from(chosenWorkers);if(!ids.length)throw new Error('Choose at least one owned worker.');return callbacks.assignBlueprintWorkers(item.id,ids);},'Workers assigned to the blueprint. Construct it when ready.',assign);});assign.dataset.assignPlan=item.id;assign.setAttribute('aria-label',`Assign selected workers to blueprint ${item.id}`);
      const cancel=makeButton('Cancel blueprint',()=>{void run(()=>callbacks.cancelBlueprint(item.id),'Blueprint removed. No construction resources were spent.',cancel);});cancel.dataset.cancelPlan=item.id;cancel.setAttribute('aria-label',`Cancel blueprint ${item.id}`);row.append(assign,cancel);list.append(row);
    });if(!items.length)list.append(el('li','No construction plans yet.'));}
    for(const item of items){const row=list.querySelector<HTMLElement>(`[data-blueprint-id="${CSS.escape(item.id)}"]`)!;row.dataset.planStatus=item.status;row.querySelector('.planning-plan-workers')!.textContent=item.workerIds.length?`Assigned workers: ${item.workerIds.join(', ')}`:'No workers assigned.';
      const reason=contextValid()&&item.status!=='complete'?blueprintReason(state!,side(),item):item.reason;
      const built=item.buildingId!==undefined?state?.entities.find(e=>e.id===item.buildingId&&e.hp>0):undefined;
      row.querySelector('.planning-plan-status')!.textContent=item.status==='complete'?'Construction complete.':item.status==='building'?(reason?`Construction paused · ${reason}`:`Construction started${built?` · ${Math.floor(built.progress*100)}%`:''}.`):reason||'Ready to construct.';
      row.querySelector<HTMLButtonElement>('[data-cancel-plan]')!.disabled=!!readOnly()||item.status!=='planned';
    }
    execute.disabled=!!readOnly()||!items.some(item=>item.status!=='complete'&&item.workerIds.length>0)||execute.dataset.busy==='true';
    publishPreview(items);
    drawPreview(items);
  }
  function publishPreview(items:ConstructionBlueprint[]){
    const snapshot=JSON.stringify(items.map(item=>({id:item.id,role:item.role,x:item.x,y:item.y,status:item.status,workerIds:item.workerIds,buildingId:item.buildingId})));
    if(snapshot!==previewKey){previewKey=snapshot;callbacks.onPreview?.(items.map(item=>({...item,workerIds:[...item.workerIds]})));}
  }
  function drawPreview(items:ConstructionBlueprint[]){
    const ctx=preview.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,preview.width,preview.height);if(!contextValid())return;
    const s=state!,scale=Math.min((preview.width-16)/s.width,(preview.height-16)/s.height),ox=(preview.width-s.width*scale)/2,oy=(preview.height-s.height*scale)/2;
    ctx.fillStyle='#070d0a';ctx.fillRect(ox,oy,s.width*scale,s.height*scale);
    for(const index of s.explored[side()]){ctx.fillStyle=s.visible[side()].has(index)?'#354b34':'#1b2a20';ctx.fillRect(ox+(index%s.width)*scale,oy+Math.floor(index/s.width)*scale,scale+.5,scale+.5);}
    for(const node of s.resources){if(node.amount<=0||!s.visible[side()].has(Math.floor(node.y)*s.width+Math.floor(node.x)))continue;ctx.fillStyle=node.kind==='wood'?'#7cab69':node.kind==='ore'?'#b8c2ca':'#c0a4ec';ctx.fillRect(ox+node.x*scale-1.5,oy+node.y*scale-1.5,3,3);}
    for(const entity of s.entities){if(entity.kind!=='building'||entity.side!==side()||entity.hp<=0)continue;ctx.fillStyle='#d4b777';const size=FACTIONS[s.players[side()].faction].buildings[entity.role as BuildingRole]?.size??1;ctx.fillRect(ox+(entity.x-size/2)*scale,oy+(entity.y-size/2)*scale,size*scale,size*scale);}
    items.forEach((item,index)=>{const size=FACTIONS[s.players[side()].faction].buildings[item.role]?.size??1;ctx.strokeStyle=item.status==='complete'?'#9adeb0':item.status==='building'?'#e2c77c':'#97c5ed';ctx.lineWidth=1.5;ctx.setLineDash(item.status==='planned'?[3,2]:[]);ctx.strokeRect(ox+(item.x-size/2)*scale,oy+(item.y-size/2)*scale,size*scale,size*scale);ctx.setLineDash([]);ctx.fillStyle='#fff';ctx.font='10px sans-serif';ctx.fillText(String(index+1),ox+item.x*scale+3,oy+item.y*scale-3);});
  }
  function refresh(){if(disposed)return;try{launch.disabled=!contextValid()||!!status.blocked&&!opened;publishPreview(contextValid()?currentPlan()?.blueprints??[]:[]);if(!opened)return;fillContext();const reason=readOnly();for(const control of [saveTargets,applyTargets,add,useSelection])control.disabled=!!reason||control.dataset.busy==='true';place.disabled=!!reason||!callbacks.beginPlacement;for(const input of targets.values())input.disabled=!!reason;building.disabled=x.disabled=y.disabled=!!reason;
    if(contextValid()){const snapshot=workerAllocation(state!,side());allocationSummary.textContent=`${snapshot.total} workers · ${snapshot.assigned.wood} gathering wood · ${snapshot.assigned.ore} gathering ore · ${snapshot.assigned.crystal} gathering crystal · ${snapshot.idle} idle · ${snapshot.busy} busy`;refreshPlans();refreshWorkerChoices();}else{allocationSummary.textContent='Start or load a match to allocate workers and plan construction.';list.replaceChildren();workerPicker.replaceChildren();chosenWorkers.clear();workersKey='';workerSummary.textContent='No active worker selection.';execute.disabled=true;}
  }catch(error){message(errorMessage(error),true);}}
  function otherModalOpen(){return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).some(item=>item!==dialog&&!item.closest('[hidden]')&&getComputedStyle(item).display!=='none');}
  function open(){if(disposed||!contextValid()||otherModalOpen())return;if(!opened){previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;opened=true;overlay.hidden=false;try{callbacks.onModal(true);const saved=callbacks.getTargets();if(validateWorkerTargets(saved))for(const kind of kinds)targets.get(kind)!.value=String(saved[kind]);chosenWorkers.clear();for(const id of ownSelected())chosenWorkers.add(id);}catch(error){message(errorMessage(error),true);}}refresh();closeButton.focus();}
  function close(keepPlacement=false){if(!keepPlacement&&placing){++placementGeneration;placing=false;try{callbacks.cancelPlacement?.();}catch(error){message(errorMessage(error),true);}}if(!opened)return;opened=false;overlay.hidden=true;try{callbacks.onModal(false);}catch(error){message(errorMessage(error),true);}if(previousFocus?.isConnected)previousFocus.focus();previousFocus=null;}
  function keyboard(event:KeyboardEvent){if(placing&&!opened&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();++placementGeneration;placing=false;callbacks.cancelPlacement?.();open();message('Blueprint placement canceled.');return;}if(!opened)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}if(event.key==='Tab'){const controls=Array.from(dialog.querySelectorAll<HTMLElement>('button,input,select,textarea,[tabindex]')).filter(item=>!item.closest('[hidden]')&&!(item instanceof HTMLButtonElement&&item.disabled)&&!(item instanceof HTMLInputElement&&item.disabled)&&!(item instanceof HTMLSelectElement&&item.disabled)&&item.tabIndex>=0);if(!controls.length){event.preventDefault();dialog.focus();return;}if(event.shiftKey&&(document.activeElement===controls[0]||!dialog.contains(document.activeElement))){event.preventDefault();controls.at(-1)!.focus();}else if(!event.shiftKey&&(document.activeElement===controls.at(-1)||!dialog.contains(document.activeElement))){event.preventDefault();controls[0].focus();}}}
  document.addEventListener('keydown',keyboard,true);const stop=(event:Event)=>event.stopPropagation();for(const type of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','contextmenu','wheel','keydown'])host.addEventListener(type,stop);
  return {
    update(nextState:GameState|null,nextStatus:PlanningToolsStatus={}){if(disposed)return;state=nextState;status=nextStatus;host.classList.toggle('session-in-match',!!state);refresh();},
    dispose(){if(disposed)return;close();disposed=true;++placementGeneration;document.removeEventListener('keydown',keyboard,true);try{callbacks.onPreview?.([]);}finally{host.remove();}}
  };
}
