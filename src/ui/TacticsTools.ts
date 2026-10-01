import { FACTIONS } from '../core/content';
import { canAmbush, canCaptureSiege, canObserveTacticalEntity, isCrewless } from '../core/tactics';
import type { AmbushTarget, FormationKind, TacticsCommand } from '../core/tactics';
import type { Entity, GameState, Side } from '../core/types';
import { bindingFromKeyboard, displayBinding, inputIsSuppressed, normalizeBinding } from '../game/Controls';
import './tactics-tools.css';

export type TacticsAction = 'formationLine'|'formationWedge'|'formationSquare'|'formationLoose'|'face'|'ambush'|'releaseAmbush'|'captureSiege';
export interface TacticsToolsCallbacks {
  toolbar?:HTMLElement;
  state:()=>GameState|null;
  selected:()=>readonly number[];
  side:()=>Side;
  command:(command:TacticsCommand)=>void|boolean|Promise<void|boolean>;
  /** Return false or a reason when commands are blocked by pause, replay, photo or network state. */
  enabled:()=>boolean|string;
  /** Physical key chords from the current controls profile. No shortcuts are reserved by this panel. */
  keyFor?:(action:TacticsAction)=>string|undefined;
}
const formations:readonly {kind:FormationKind;action:TacticsAction;label:string;description:string}[] = [
  {kind:'line',action:'formationLine',label:'Line',description:'Spread troops across the front.'},
  {kind:'wedge',action:'formationWedge',label:'Wedge',description:'Arrange troops behind a leading point.'},
  {kind:'square',action:'formationSquare',label:'Square',description:'Arrange troops in a compact block.'},
  {kind:'loose',action:'formationLoose',label:'Loose',description:'Spread troops with more room between them.'},
];
const directions=['East','Southeast','South','Southwest','West','Northwest','North','Northeast'];
const ambushTargets:readonly {value:AmbushTarget;label:string}[]=[
  {value:'any',label:'Any enemy'},{value:'unit',label:'Enemy units'},{value:'building',label:'Enemy buildings'},
  {value:'worker',label:'Workers'},{value:'melee',label:'Melee troops'},{value:'ranged',label:'Ranged troops'},
  {value:'special',label:'Special troops'},{value:'spear',label:'Spearmen'},{value:'cavalry',label:'Cavalry'},{value:'siege',label:'Siege engines'},
];
const actionLabels:Record<TacticsAction,string>={formationLine:'Line',formationWedge:'Wedge',formationSquare:'Square',formationLoose:'Loose',face:'Apply facing',ambush:'Set ambush',releaseAmbush:'Release ambush',captureSiege:'Capture siege engine'};
let nextPanelId=0;
const element=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,className?:string):HTMLElementTagNameMap[K]=>{const item=document.createElement(tag);if(text!==undefined)item.textContent=text;if(className)item.className=className;return item;};
function field(label:string,input:HTMLElement){const item=element('label',label,'tactics-field');item.append(input);return item;}
function errorText(error:unknown){return error instanceof Error?error.message:typeof error==='string'?error:'The tactics command could not be applied.';}

/** A live panel: the host keeps battlefield selection and command permissions authoritative. */
export function mountTacticsTools(root:HTMLElement,callbacks:TacticsToolsCallbacks){
  let opened=false,disposed=false,pending=false,targetKey='',selectionKey='',lastState:GameState|null|undefined,lastSide:Side|undefined;
  const id=`tactics-${++nextPanelId}`,host=element('section',undefined,'tactics-tools');host.setAttribute('aria-label','Army tactics');
  const launch=element('button','Tactics','tactics-launch');launch.type='button';launch.setAttribute('aria-expanded','false');launch.setAttribute('aria-controls',id);launch.dataset.tacticsLaunch='';
  const panel=element('section',undefined,'tactics-panel');panel.id=id;panel.hidden=true;panel.setAttribute('aria-label','Army tactics controls');
  const header=element('header'),closeButton=element('button','Close');closeButton.type='button';closeButton.setAttribute('aria-label','Close army tactics');header.append(element('h2','Army tactics'),closeButton);
  const summary=element('p',undefined,'tactics-summary'),permission=element('p',undefined,'tactics-permission');permission.id=`${id}-permission`;permission.setAttribute('aria-live','polite');
  const notice=element('p',undefined,'tactics-notice');notice.hidden=true;notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  const facing=element('select');facing.setAttribute('aria-label','Troop facing');directions.forEach((name,index)=>{const option=element('option',name);option.value=String(index);facing.append(option);});facing.value='2';
  const spacing=element('input');spacing.type='number';spacing.min='.65';spacing.max='3';spacing.step='.05';spacing.value='1';spacing.setAttribute('aria-label','Formation spacing');
  const formationSection=element('section'),formationReason=element('p',undefined,'tactics-reason');formationReason.id=`${id}-formation`;
  const layoutFields=element('div',undefined,'tactics-fields');layoutFields.append(field('Facing',facing),field('Spacing (.65–3)',spacing));
  const formationButtons=element('div',undefined,'tactics-formations'),buttons=new Map<TacticsAction,HTMLButtonElement>();
  function actionButton(action:TacticsAction,descriptionId:string){const button=element('button',actionLabels[action]);button.type='button';button.dataset.tacticsAction=action;button.setAttribute('aria-describedby',`${id}-permission ${descriptionId}`);button.addEventListener('click',()=>{void runAction(action);});buttons.set(action,button);return button;}
  for(const formation of formations){const button=actionButton(formation.action,formationReason.id);button.title=formation.description;formationButtons.append(button);}
  formationSection.append(element('h3','Formation and facing'),element('p','Choose a facing and spacing, then apply a formation to selected combat troops. Workers and siege engines keep their orders.'),layoutFields,formationButtons,actionButton('face',formationReason.id),formationReason);
  const ambushSection=element('section'),radius=element('input');radius.type='number';radius.min='.75';radius.max='10';radius.step='.25';radius.value='4';radius.setAttribute('aria-label','Ambush trigger radius');
  const trigger=element('select');trigger.setAttribute('aria-label','Ambush target');for(const target of ambushTargets){const option=element('option',target.label);option.value=target.value;trigger.append(option);}
  const ambushReason=element('p',undefined,'tactics-reason');ambushReason.id=`${id}-ambush`;
  const ambushFields=element('div',undefined,'tactics-fields');ambushFields.append(field('Trigger radius (.75–10)',radius),field('Trigger target',trigger));
  ambushSection.append(element('h3','Ambush'),element('p','Troops in woodland wait until the chosen enemy enters the trigger radius. Nearby scouts, close enemies or taking damage can expose them.'),ambushFields,actionButton('ambush',ambushReason.id),actionButton('releaseAmbush',ambushReason.id),ambushReason);
  const captureSection=element('section'),engine=element('select');engine.setAttribute('aria-label','Abandoned siege engine');
  const captureReason=element('p',undefined,'tactics-reason');captureReason.id=`${id}-capture`;
  captureSection.append(element('h3','Capture siege'),element('p','Select workers, melee troops, spearmen or special troops to recover a visible abandoned engine. Capture needs four uninterrupted seconds beside it while enemies are clear.'),field('Visible abandoned engine',engine),actionButton('captureSiege',captureReason.id),captureReason);
  const statsSection=element('section'),stats=element('ul',undefined,'tactics-unit-list');stats.setAttribute('aria-label','Selected unit tactics');statsSection.append(element('h3','Selected units'),stats);
  panel.append(header,summary,permission,notice,formationSection,ambushSection,captureSection,statsSection);host.append(panel);(callbacks.toolbar??host).append(launch);root.append(host);

  function context(){const state=callbacks.state(),side=callbacks.side();return {state,side,valid:!!state&&Number.isInteger(side)&&side>=0&&side<state.players.length};}
  function blocked(){const {state,side,valid}=context();if(!valid)return 'Start or load a match first.';if(state!.winner!==null||state!.draw)return 'The match has ended.';if(state!.eliminated[side])return 'This player has been eliminated.';const enabled=callbacks.enabled();return enabled===true?'':typeof enabled==='string'&&enabled?enabled:'Tactics commands are unavailable in this view.';}
  function selectedUnits(){const {state,side,valid}=context();if(!valid)return [];const selected=new Set(callbacks.selected());return state!.entities.filter(item=>selected.has(item.id)&&item.side===side&&item.kind==='unit'&&item.hp>0&&!item.illusion&&!isCrewless(item));}
  function army(){return selectedUnits().filter(item=>item.role!=='worker'&&item.role!=='siege');}
  function abandonedEngines(){const {state,side,valid}=context();return !valid?[]:state!.entities.filter(item=>item.hp>0&&item.kind==='unit'&&item.role==='siege'&&isCrewless(item)&&canObserveTacticalEntity(state!,side,item)).sort((a,b)=>a.id-b.id);}
  function facingValue(){const value=Number(facing.value);if(!Number.isInteger(value)||value<0||value>7)throw new Error('Choose one of the eight facing directions.');return value;}
  function spacingValue(){const value=spacing.value.trim()?Number(spacing.value):NaN;if(!Number.isFinite(value)||value<.65||value>3)throw new Error('Formation spacing must be between .65 and 3.');return value;}
  function radiusValue(){const value=radius.value.trim()?Number(radius.value):NaN;if(!Number.isFinite(value)||value<.75||value>10)throw new Error('Ambush radius must be between .75 and 10.');return value;}
  function availability(action:TacticsAction){const reason=blocked();if(reason)return reason;if(pending)return 'Waiting for the previous tactics command.';const {state}=context(),troops=army();
    if(action.startsWith('formation')){if(!troops.length)return 'Select owned combat troops to arrange a formation.';try{facingValue();spacingValue();}catch(error){return errorText(error);}return '';}
    if(action==='face')return selectedUnits().length?'':'Select owned troops to apply a facing.';
    if(action==='ambush'){if(!troops.length)return 'Select owned combat troops to set an ambush.';if(!troops.some(item=>canAmbush(state!,item)))return 'Move selected troops into woodland or beside standing trees first.';try{radiusValue();}catch(error){return errorText(error);}if(!ambushTargets.some(item=>item.value===trigger.value))return 'Choose an ambush target.';return '';}
    if(action==='releaseAmbush')return troops.some(item=>item.tactics?.ambush)?'':'No selected troops have an ambush to release.';
    const target=abandonedEngines().find(item=>String(item.id)===engine.value);if(!target)return 'No visible abandoned siege engine is selected.';return selectedUnits().some(item=>canCaptureSiege(state!,item,target))?'':'Select owned workers, melee troops, spearmen or special troops to capture this engine.';
  }
  function commandFor(action:TacticsAction):TacticsCommand {const troops=army(),ids=troops.map(item=>item.id),{state}=context(),formation=formations.find(item=>item.action===action);
    if(formation)return {type:'formation',ids,formation:formation.kind,spacing:spacingValue(),facing:facingValue()};
    if(action==='face')return {type:'face',ids:selectedUnits().map(item=>item.id),facing:facingValue()};
    if(action==='ambush')return {type:'ambush',ids:troops.filter(item=>canAmbush(state!,item)).map(item=>item.id),radius:radiusValue(),target:trigger.value as AmbushTarget};
    if(action==='releaseAmbush')return {type:'releaseAmbush',ids:troops.filter(item=>item.tactics?.ambush).map(item=>item.id)};
    const target=abandonedEngines().find(item=>String(item.id)===engine.value);if(!target)throw new Error('The abandoned engine is no longer visible.');return {type:'captureSiege',ids:selectedUnits().filter(item=>canCaptureSiege(state!,item,target)).map(item=>item.id),target:target.id};
  }
  function message(text:string,failed=false){notice.textContent=text;notice.hidden=!text;notice.classList.toggle('tactics-error',failed);}
  async function runAction(action:TacticsAction){if(disposed)return;let before:ReturnType<typeof context>|undefined;try{const reason=availability(action);if(reason){message(reason,true);update();return;}before=context();const command=commandFor(action);pending=true;update();const result=await callbacks.command(command);if(disposed)return;const after=context();if(before.state!==after.state||before.side!==after.side)return;if(result===false)throw new Error('The tactics command was rejected. Check the selection and battlefield conditions.');message(`${actionLabels[action]} applied to ${command.ids.length} unit${command.ids.length===1?'':'s'}.`);}catch(error){if(!disposed&&(!before||before.state===context().state&&before.side===context().side))message(errorText(error),true);}finally{pending=false;if(!disposed)update();}}
  function unitName(item:Entity){const {state}=context();return FACTIONS[item.definitionFaction??state!.players[item.side].faction].units[item.role as keyof typeof FACTIONS.orcs.units].name;}
  function update(){if(disposed)return;try{const {valid,state,side}=context();if(state!==lastState||side!==lastSide){lastState=state;lastSide=side;message('');}launch.disabled=!valid;if(!opened)return;const units=selectedUnits(),troops=army(),reason=blocked();summary.textContent=`${units.length} owned unit${units.length===1?'':'s'} selected · ${troops.length} combat troop${troops.length===1?'':'s'}`;permission.textContent=reason;permission.hidden=!reason;
    const engines=abandonedEngines(),key=engines.map(item=>`${item.id}:${unitName(item)}`).join('|');if(key!==targetKey||!engine.options.length){targetKey=key;const previous=engine.value;engine.replaceChildren();if(!engines.length){const option=element('option','No visible abandoned engines');option.value='';engine.append(option);}for(const item of engines){const option=element('option',`${unitName(item)} #${item.id}`);option.value=String(item.id);engine.append(option);}engine.value=engines.some(item=>String(item.id)===previous)?previous:String(engines[0]?.id??'');}
    for(const [action,button] of buttons){const unavailable=availability(action),binding=callbacks.keyFor?.(action),normalized=binding?normalizeBinding(binding):null;button.disabled=!!unavailable;button.title=unavailable||formations.find(item=>item.action===action)?.description||actionLabels[action];button.textContent=`${actionLabels[action]}${normalized?` (${displayBinding(normalized)})`:''}`;button.setAttribute('aria-label',actionLabels[action]);if(normalized){const shortcut=displayBinding(normalized).replace('Spacebar','Space');button.setAttribute('aria-keyshortcuts',normalized.includes('Primary')?`${shortcut.replace('Ctrl/Cmd','Control')} ${shortcut.replace('Ctrl/Cmd','Meta')}`:shortcut);}else button.removeAttribute('aria-keyshortcuts');}
    const partial=troops.length-troops.filter(item=>canAmbush(context().state!,item)).length;formationReason.textContent=availability('formationLine')||`${troops.length} combat troop${troops.length===1?'':'s'} will receive the formation. Facing can also apply to selected workers and crewed engines.`;ambushReason.textContent=availability('ambush')||(partial?`${partial} selected troop${partial===1?' is':'s are'} outside concealment and will keep current orders.`:'All selected combat troops can use woodland concealment.');captureReason.textContent=availability('captureSiege')||'Engine is uncrewed. Selected eligible troops will approach it and capture it.';
    for(const input of [facing,spacing,radius,trigger])input.disabled=!!reason||pending;engine.disabled=!!reason||pending||!engines.length;
    const entries=units.map(item=>{const t=item.tactics,details=[`Facing ${directions[item.facing]??item.facing}`];if(t){details.push(`Morale ${Math.round(t.morale)}%`);if(t.formation)details.push(`${t.formation.kind} · ${t.formation.phase}`);if(t.ambush)details.push(`Ambush ${t.ambush.concealed?'concealed':'exposed'} · ${t.ambush.target} within ${t.ambush.radius}`);if(t.charge)details.push(`Charge ${t.charge.distance.toFixed(1)} tiles`);if(t.siegeCrew)details.push(`Crew ${Math.ceil(t.siegeCrew.hp)}/${t.siegeCrew.maxHp}`);if(t.capture)details.push(`Capturing #${t.capture.target} · ${Math.round(t.capture.progress*100)}%`);}return `${unitName(item)} #${item.id} · ${details.join(' · ')}`;});const nextKey=entries.join('\n');if(nextKey!==selectionKey||!stats.children.length){selectionKey=nextKey;stats.replaceChildren(...(entries.length?entries.map(text=>element('li',text)):[element('li','Select units on the battlefield to inspect their tactics.')]));}
  }catch(error){message(errorText(error),true);}}
  function open(){if(disposed)return;opened=true;panel.hidden=false;launch.setAttribute('aria-expanded','true');update();}
  function close(){if(disposed)return;opened=false;panel.hidden=true;launch.setAttribute('aria-expanded','false');}
  launch.addEventListener('click',()=>{if(opened)close();else open();});closeButton.addEventListener('click',()=>{close();launch.focus();});
  for(const input of [spacing,radius,facing,trigger,engine]){input.addEventListener('input',update);input.addEventListener('change',update);}
  function otherModalOpen(){return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).some(item=>!item.closest('[hidden]')&&getComputedStyle(item).display!=='none');}
  function keyboard(event:KeyboardEvent){if(!opened||disposed||event.repeat||event.defaultPrevented||inputIsSuppressed(event.target)||otherModalOpen())return;if(event.key==='Escape'&&host.contains(event.target as Node)){event.preventDefault();event.stopPropagation();close();launch.focus();return;}const binding=bindingFromKeyboard(event);if(!binding)return;for(const action of buttons.keys()){const configured=callbacks.keyFor?.(action);if(configured&&normalizeBinding(configured)===binding&&!availability(action)){event.preventDefault();event.stopImmediatePropagation();void runAction(action);return;}}}
  document.addEventListener('keydown',keyboard,true);const stop=(event:Event)=>event.stopPropagation();for(const type of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','contextmenu','wheel','keydown'])host.addEventListener(type,stop);
  update();return {update,open,close,dispose(){if(disposed)return;disposed=true;document.removeEventListener('keydown',keyboard,true);launch.remove();host.remove();}};
}
