import { FACTIONS } from '../core/content';
import { FACTION_STRUCTURE_INFO, factionCommandReason, isCorpseWagon, isFactionCaster, wagonRecruitmentReason } from '../core/faction-systems';
import type { FactionCommand } from '../core/faction-systems';
import { CORPSE_WAGON, factionStructureKind, factionSystemDefinition } from '../core/faction-systems-content';
import type { FactionStructureKind } from '../core/faction-systems-content';
import { canObserveTacticalEntity, isCrewless, tacticalUnitDef } from '../core/tactics';
import type { Command, Entity, FactionId, GameState, Side } from '../core/types';
import { bindingFromKeyboard, displayBinding, inputIsSuppressed, normalizeBinding } from '../game/Controls';
import './faction-tools.css';

export type FactionAction='warChantAssault'|'warChantBulwark'|'trophyStandard'|'conjureIllusions'|'illusionSwap'|'buildGrove'|'artilleryStone'|'artilleryGrapeshot'|'artilleryIncendiary'|'artilleryReinforced'|'buildTunnel'|'tunnelTravel'|'recruitCorpseWagon'|'collectCorpses'|'deliverCorpses'|'buildNecropolis'|'shapeWater'|'buildPowerRelay';
type ActionResult=void|boolean|Promise<void|boolean>;
type OrdinaryFactionCommand=Extract<Command,{type:'train'|'ability'}>;
export interface FactionToolsCallbacks {
  toolbar?:HTMLElement;
  state:()=>GameState|null;
  selected:()=>readonly number[];
  side:()=>Side;
  command:(command:FactionCommand)=>ActionResult;
  enabled:()=>boolean|string;
  /** Ordinary production and ability commands use the same host permission gate. */
  coreCommand?:(command:Command)=>ActionResult;
  keyFor?:(action:FactionAction)=>string|undefined;
}
const labels:Record<FactionAction,string>={warChantAssault:'Assault chant',warChantBulwark:'Bulwark chant',trophyStandard:'Raise trophy standard',conjureIllusions:'Conjure illusions',illusionSwap:'Swap with illusion',buildGrove:'Build enchanted grove',artilleryStone:'Stone shot',artilleryGrapeshot:'Grapeshot',artilleryIncendiary:'Incendiary shot',artilleryReinforced:'Reinforce artillery',buildTunnel:'Build tunnel entrance',tunnelTravel:'Travel through tunnel',recruitCorpseWagon:'Recruit corpse wagon',collectCorpses:'Collect corpses',deliverCorpses:'Deliver corpses',buildNecropolis:'Build necropolis',shapeWater:'Shape water',buildPowerRelay:'Build power relay'};
const structureActions:Partial<Record<FactionAction,FactionStructureKind>>={buildGrove:'enchanted-grove',buildTunnel:'tunnel',buildNecropolis:'necropolis',buildPowerRelay:'power-relay'};
let nextFactionPanel=0;
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,className?:string):HTMLElementTagNameMap[K]=>{const item=document.createElement(tag);if(text!==undefined)item.textContent=text;if(className)item.className=className;return item;};
function field(label:string,input:HTMLElement){const row=el('label',label,'faction-field');row.append(input);return row;}
function errorText(error:unknown){return error instanceof Error?error.message:typeof error==='string'?error:'The faction command could not be applied.';}

/** Live faction controls; only the host dispatches commands and mutates the match. */
export function mountFactionTools(root:HTMLElement,callbacks:FactionToolsCallbacks){
  let opened=false,disposed=false,pending=false,lastState:GameState|null|undefined,lastSide:Side|undefined;
  const id=`faction-tools-${++nextFactionPanel}`,host=el('section',undefined,'faction-tools');host.setAttribute('aria-label','Faction powers');
  const launch=el('button','Faction powers','faction-launch');launch.type='button';launch.dataset.factionLaunch='';launch.setAttribute('aria-controls',id);launch.setAttribute('aria-expanded','false');
  const panel=el('section',undefined,'faction-panel');panel.id=id;panel.hidden=true;panel.setAttribute('aria-label','Faction power controls');
  const heading=el('h2','Faction powers'),header=el('header'),closeButton=el('button','Close');closeButton.type='button';closeButton.setAttribute('aria-label','Close faction powers');header.append(heading,closeButton);
  const summary=el('p'),permission=el('p',undefined,'faction-reason'),notice=el('p',undefined,'faction-notice');permission.setAttribute('aria-live','polite');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.hidden=true;
  const content=el('div'),stats=el('ul',undefined,'faction-unit-list'),structures=el('ul',undefined,'faction-unit-list');stats.setAttribute('aria-label','Selected faction unit details');structures.setAttribute('aria-label','Owned faction structures');
  const buttons=new Map<FactionAction,HTMLButtonElement>(),reasons=new Map<FactionAction,HTMLElement>(),groups=new Map<FactionId,HTMLElement>(),pickers=new Map<string,HTMLSelectElement>(),pickerKeys=new Map<string,string>();
  const x=el('input'),y=el('input');for(const [input,label] of [[x,'Faction destination X'],[y,'Faction destination Y']] as const){input.type='number';input.min='.5';input.step='.5';input.setAttribute('aria-label',label);}
  const level=el('select');level.setAttribute('aria-label','Faction destination level');for(const [value,label] of [['0','Surface'],['1','Underground']]){const option=el('option',label);option.value=value;level.append(option);}level.value='0';
  const placement=el('div',undefined,'faction-fields');placement.append(field('Destination X',x),field('Destination Y',y),field('Destination level',level));
  const placementNote=el('p','Use map coordinates for new structures and water shaping. The site must be visible, legal and within the selected caster’s range when required.');
  function picker(key:string,label:string){const input=el('select');input.setAttribute('aria-label',label);pickers.set(key,input);input.addEventListener('change',update);return field(label,input);}
  function section(faction:FactionId,title:string,text:string){const group=groups.get(faction)??el('div');if(!groups.has(faction)){groups.set(faction,group);group.hidden=true;content.append(group);}const item=el('section');item.append(el('h3',title),el('p',text));group.append(item);return item;}
  function addAction(section:HTMLElement,action:FactionAction){const button=el('button',labels[action]);button.type='button';button.dataset.factionAction=action;button.setAttribute('aria-label',labels[action]);const reason=el('p',undefined,'faction-reason');reason.id=`${id}-${action}`;button.setAttribute('aria-describedby',reason.id);button.addEventListener('click',()=>{void run(action);});buttons.set(action,button);reasons.set(action,reason);section.append(button,reason);}
  const chants=section('orcs','War chants','Spend 25 Fury to support the selected combat troops for 12 seconds. Assault increases damage; Bulwark adds armor.');addAction(chants,'warChantAssault');addAction(chants,'warChantBulwark');
  addAction(section('orcs','Trophy standards','A selected warrior with two earned kill trophies can raise a standard. Raising it consumes the trophies.'),'trophyStandard');
  const illusions=section('fairies','Illusion swap','Use a Veilweaver to conjure doubles, then select ready combat troops within ten tiles to swap with a living illusion. Swapping costs 15 crystal.');illusions.append(picker('illusion','Owned illusion'));addAction(illusions,'conjureIllusions');addAction(illusions,'illusionSwap');
  addAction(section('fairies','Enchanted grove','Selected workers plant a grove at the destination. Completed groves conceal nearby allied troops and send decoys toward observed enemy scouts.'),'buildGrove');
  const artillery=section('dwarves','Artillery modifications','Tune selected artillery for the next encounter. Each fitting costs 25 wood and 20 ore per eligible artillery unit. Each incendiary shot also costs 15 wood and 5 ore; the engine holds fire without that ammunition. Choose a shot type or reinforce the engine.');for(const action of ['artilleryStone','artilleryGrapeshot','artilleryIncendiary','artilleryReinforced'] as const)addAction(artillery,action);
  const tunnels=section('dwarves','Tunnel network','Build two entrances, select troops near an entrance, and choose another completed owned entrance as the exit.');tunnels.append(picker('tunnel','Owned tunnel exit'));addAction(tunnels,'buildTunnel');addAction(tunnels,'tunnelTravel');
  const corpses=section('undead','Corpse wagons','Recruit a wagon through a completed owned barracks. Wagons collect up to six visible bodies, preserving their remaining lifetimes, and deliver them to a Gravecaller.');corpses.append(picker('barracks','Corpse wagon barracks'),picker('corpse','Visible corpse'),picker('gravecaller','Owned Gravecaller'));for(const action of ['recruitCorpseWagon','collectCorpses','deliverCorpses'] as const)addAction(corpses,action);
  addAction(section('undead','Necropolis','Selected workers build a necropolis at the destination to heal nearby raised allies and preserve their remaining lifetimes.'),'buildNecropolis');
  const water=section('tideborn','Water shaping','A selected Tidecaller shapes nearby ground for 20 seconds. It costs 25 crystal and has a 20-second cooldown; rocks and bridges keep their terrain.');water.append(picker('terrain','Shaped terrain'));for(const value of ['mud','shallows','water']){const option=el('option',value[0].toUpperCase()+value.slice(1));option.value=value;pickers.get('terrain')!.append(option);}pickers.get('terrain')!.value='shallows';addAction(water,'shapeWater');
  addAction(section('automata','Power network','Selected workers build power relays at the destination. Connected buildings share shield reserves, and defensive towers need a headquarters connection.'),'buildPowerRelay');
  panel.append(header,summary,permission,notice,placementNote,placement,content,el('h3','Selected units and buildings'),stats,el('h3','Owned faction structures'),structures);host.append(panel);(callbacks.toolbar??host).append(launch);root.append(host);

  function context(){const state=callbacks.state(),side=callbacks.side(),valid=!!state&&Number.isInteger(side)&&side>=0&&side<state.players.length;return {state,side,valid,faction:valid?state!.players[side].faction:undefined};}
  function blocked(){const {state,side,valid}=context();if(!valid)return 'Start or load a match first.';if(state!.winner!==null||state!.draw)return 'The match has ended.';if(state!.eliminated[side])return 'This player has been eliminated.';const enabled=callbacks.enabled();return enabled===true?'':typeof enabled==='string'&&enabled?enabled:'Faction commands are unavailable in this view.';}
  function ownSelection(){const {state,side,valid}=context();if(!valid)return [];const chosen=new Set(callbacks.selected());return state!.entities.filter(item=>chosen.has(item.id)&&item.side===side&&item.hp>0&&!item.illusion&&!isCrewless(item));}
  function ownUnits(){return ownSelection().filter(item=>item.kind==='unit');}
  function ownTargets(predicate:(entity:Entity)=>boolean){const {state,side,valid}=context();return !valid?[]:state!.entities.filter(item=>item.hp>0&&item.side===side&&canObserveTacticalEntity(state!,side,item)&&predicate(item)).sort((a,b)=>a.id-b.id);}
  function point(){const {state}=context(),px=x.value.trim()?Number(x.value):NaN,py=y.value.trim()?Number(y.value):NaN,layer=Number(level.value);if(!state||!Number.isFinite(px)||!Number.isFinite(py)||px<.5||py<.5||px>state.width-.5||py>state.height-.5)throw new Error('Enter a destination inside the map.');if(!Number.isInteger(layer)||layer<0||layer>1)throw new Error('Choose the surface or underground level.');return {x:px,y:py,level:layer};}
  function target(key:string){const input=pickers.get(key)!,number=input.value.trim()?Number(input.value):NaN;if(!Number.isSafeInteger(number)||number<1)throw new Error(`Choose ${input.getAttribute('aria-label')!.toLowerCase()}.`);return number;}
  function draft(action:FactionAction):FactionCommand|OrdinaryFactionCommand {const ids=ownUnits().map(item=>item.id),structure=structureActions[action];
    if(structure)return {type:'buildFactionStructure',ids:ownUnits().filter(item=>item.role==='worker').map(item=>item.id),structure,...point()};
    if(action==='warChantAssault'||action==='warChantBulwark')return {type:'warChant',ids,chant:action==='warChantAssault'?'assault':'bulwark'};
    if(action==='trophyStandard')return {type:'trophyStandard',ids};
    if(action==='conjureIllusions')return {type:'ability',ids:ownUnits().filter(item=>isFactionCaster(context().state!,item,'illusion')).map(item=>item.id)};
    if(action==='illusionSwap')return {type:'illusionSwap',ids,target:target('illusion')};
    if(action.startsWith('artillery'))return {type:'modifyArtillery',ids,modification:action.slice(9).toLowerCase() as 'stone'|'grapeshot'|'incendiary'|'reinforced'};
    if(action==='tunnelTravel')return {type:'tunnelTravel',ids,target:target('tunnel')};
    if(action==='recruitCorpseWagon')return {type:'train',id:target('barracks'),role:'special',definitionId:'core:undead-corpse-wagon'};
    if(action==='collectCorpses')return {type:'collectCorpses',ids,target:target('corpse')};
    if(action==='deliverCorpses')return {type:'deliverCorpses',ids,target:target('gravecaller')};
    const terrain=pickers.get('terrain')!.value;if(!['mud','shallows','water'].includes(terrain))throw new Error('Choose mud, shallows or water.');return {type:'shapeWater',ids,...point(),terrain:terrain as 'mud'|'shallows'|'water'};
  }
  function factionFor(action:FactionAction):FactionId {return action.startsWith('warChant')||action==='trophyStandard'?'orcs':action==='conjureIllusions'||action==='illusionSwap'||action==='buildGrove'?'fairies':action.startsWith('artillery')||action==='buildTunnel'||action==='tunnelTravel'?'dwarves':action==='shapeWater'?'tideborn':action==='buildPowerRelay'?'automata':'undead';}
  function availability(action:FactionAction){const reason=blocked();if(reason)return reason;if(pending)return 'Waiting for the previous faction command.';const {state,side,faction}=context();if(faction!==factionFor(action))return 'This power belongs to another faction.';
    try{const command=draft(action);if(command.type==='ability'){if(!callbacks.coreCommand)return 'Ability commands are unavailable in this view.';const casters=ownUnits().filter(item=>command.ids.includes(item.id));if(!casters.length)return 'Select an owned Veilweaver first.';return casters.some(item=>(item.abilityReadyAt??0)<=state!.time)?'':'The selected Veilweavers are recharging their ability.';}
      if(command.type==='train'){if(!callbacks.coreCommand)return 'Production commands are unavailable in this view.';return wagonRecruitmentReason(state!,side,command.id);}
      return factionCommandReason(state!,side,command);
    }catch(error){return errorText(error);}
  }
  function message(text:string,failed=false){notice.textContent=text;notice.hidden=!text;notice.classList.toggle('faction-error',failed);}
  async function run(action:FactionAction){if(disposed)return;let origin:ReturnType<typeof context>|undefined;try{const reason=availability(action);if(reason){message(reason,true);update();return;}origin=context();const command=draft(action);pending=true;update();const accepted=command.type==='ability'||command.type==='train'?await callbacks.coreCommand!(command):await callbacks.command(command);if(disposed||origin.state!==context().state||origin.side!==context().side)return;if(accepted===false)throw new Error('The command was rejected. Check the current selection, resources and target.');message(`${labels[action]} ordered.`);}catch(error){if(!disposed&&(!origin||origin.state===context().state&&origin.side===context().side))message(errorText(error),true);}finally{pending=false;if(!disposed)update();}}
  function entityName(entity:Entity){const definition=factionSystemDefinition(entity.definitionId);if(definition)return definition.name;const state=context().state!;if(entity.kind==='unit')return tacticalUnitDef(state,entity).name;const faction=entity.definitionFaction??state.players[entity.side].faction;return FACTIONS[faction].buildings[entity.role as keyof typeof FACTIONS.orcs.buildings].name;}
  function setPicker(key:string,entries:{id:number;label:string}[],empty:string){const input=pickers.get(key)!,signature=JSON.stringify(entries);if(signature===pickerKeys.get(key)&&input.options.length)return;pickerKeys.set(key,signature);const previous=input.value;input.replaceChildren();if(!entries.length){const option=el('option',empty);option.value='';input.append(option);}for(const item of entries){const option=el('option',item.label);option.value=String(item.id);input.append(option);}input.value=entries.some(item=>String(item.id)===previous)?previous:String(entries[0]?.id??'');}
  function refreshTargets(){const {state,side,valid}=context();setPicker('illusion',ownTargets(item=>item.kind==='unit'&&item.illusion&&item.expires>state!.time).map(item=>({id:item.id,label:`${entityName(item)} #${item.id} · ${Math.ceil(item.expires-state!.time)}s left`})),'No owned living illusions');setPicker('tunnel',ownTargets(item=>item.kind==='building'&&item.progress===1&&factionStructureKind(item.definitionId)==='tunnel').map(item=>({id:item.id,label:`Tunnel #${item.id} · ${item.x}, ${item.y}`})),'No completed owned tunnels');setPicker('barracks',ownTargets(item=>item.kind==='building'&&item.role==='barracks'&&item.progress===1).map(item=>({id:item.id,label:`${entityName(item)} #${item.id} · ${item.queue.length}/5 queued`})),'No completed owned barracks');setPicker('gravecaller',ownTargets(item=>isFactionCaster(state!,item,'raise')).map(item=>({id:item.id,label:`${entityName(item)} #${item.id}`})),'No owned Gravecaller');setPicker('corpse',!valid?[]:state!.corpses.filter(item=>item.expires>state!.time&&state!.visible[side].has((item.level??0)*state!.width*state!.height+Math.floor(item.y)*state!.width+Math.floor(item.x))).map(item=>({id:item.id,label:`Corpse #${item.id} · ${Math.ceil(item.expires-state!.time)}s left`})),'No visible unclaimed bodies');}
  function details(entity:Entity):string[]{const {state,faction}=context(),f=entity.factionState,time=state!.time,parts=[`${entityName(entity)} #${entity.id}`];
    if(faction==='orcs'&&entity.kind==='unit'&&entity.role!=='worker')parts.push(`${f?.trophyKills??0} trophies`);
    if(f?.chant&&f.chant.until>time)parts.push(`${f.chant.kind} chant · ${Math.ceil(f.chant.until-time)}s left`);
    if(f?.swapReadyAt&&f.swapReadyAt>time)parts.push(`Swap ready in ${Math.ceil(f.swapReadyAt-time)}s`);
    if(f?.artillery)parts.push(`Artillery fitted: ${f.artillery}`);
    if(f?.tunnel)parts.push(`Tunnel to #${f.tunnel.target} · ${Math.round(f.tunnel.progress*100)}%`);
    if(isCorpseWagon(entity)){const cargo=f?.corpseCargo?.filter(body=>body.expires>time)??[];parts.push(`${cargo.length}/6 bodies aboard`);for(const body of cargo)parts.push(`Body #${body.id} · ${Math.ceil(body.expires-time)}s left`);}
    if(f?.corpseOrder)parts.push(`${f.corpseOrder.type==='collect'?'Collecting':'Delivering to'} #${f.corpseOrder.target} · ${Math.round(f.corpseOrder.progress*100)}%`);
    if(f?.deliveredCorpses){const fresh=f.deliveredCorpses.filter(body=>body.expires>time);parts.push(`${fresh.length} delivered bodies ready`);for(const body of fresh)parts.push(`Body #${body.id} · ${Math.ceil(body.expires-time)}s left`);}
    if(f?.waterReadyAt&&f.waterReadyAt>time)parts.push(`Water shaping ready in ${Math.ceil(f.waterReadyAt-time)}s`);
    if(f?.power)parts.push(`Power ${f.power.connected?'connected':'disconnected'}`);
    if(entity.maxShield!==undefined)parts.push(`Shield ${Math.ceil(entity.shield??0)}/${entity.maxShield}`);
    if(entity.kind==='building'&&entity.progress<1)parts.push(`Construction ${Math.floor(entity.progress*100)}%`);
    return parts;
  }
  function update(){if(disposed)return;try{const {state,side,valid,faction}=context();if(lastState!==state||lastSide!==side){lastState=state;lastSide=side;message('');if(valid){const start=state!.starts[side];x.value=String(Math.min(state!.width-.5,start.x+5));y.value=String(start.y);level.value=String(ownUnits()[0]?.level??0);}pickerKeys.clear();}launch.disabled=!valid;if(!opened)return;const reason=blocked();heading.textContent=faction?`${FACTIONS[faction].name} powers`:'Faction powers';const fury=faction==='orcs'?` · Fury ${Math.floor(state!.factionSystems?.fury[side]??0)}/100`:'';const selectedUnits=ownUnits().length,selectedBuildings=ownSelection().filter(item=>item.kind==='building').length,selection=[selectedUnits?`${selectedUnits} owned unit${selectedUnits===1?'':'s'}`:'',selectedBuildings?`${selectedBuildings} owned building${selectedBuildings===1?'':'s'}`:''].filter(Boolean).join(' and ');summary.textContent=`${selection||'No owned units or buildings'} selected${fury}`;permission.textContent=reason;permission.hidden=!reason;for(const [name,group] of groups)group.hidden=name!==faction;refreshTargets();
    const hasPlacement=faction==='fairies'||faction==='dwarves'||faction==='undead'||faction==='automata'||faction==='tideborn';placement.hidden=placementNote.hidden=!hasPlacement;
    if(state){x.max=String(state.width-.5);y.max=String(state.height-.5);}x.disabled=y.disabled=level.disabled=!!reason||pending;
    for(const input of pickers.values())input.disabled=!!reason||pending||!input.value;
    for(const [action,button] of buttons){const unavailable=availability(action),binding=callbacks.keyFor?.(action),normalized=binding?normalizeBinding(binding):null;button.disabled=!!unavailable;button.title=unavailable||labels[action];button.textContent=`${labels[action]}${normalized?` (${displayBinding(normalized)})`:''}`;const structure=structureActions[action],cost=structure?FACTION_STRUCTURE_INFO[structure].definition.cost:action==='recruitCorpseWagon'?CORPSE_WAGON.cost:null;reasons.get(action)!.textContent=[cost?`${cost.wood} wood · ${cost.ore} ore · ${cost.crystal} crystal`:'',unavailable||'Ready for the current selection.'].filter(Boolean).join(' · ');}
    const entries=ownSelection().map(item=>el('li',details(item).join(' · ')));stats.replaceChildren(...(entries.length?entries:[el('li','Select owned units or buildings to inspect their faction powers.')]));
    const ownedStructures=ownTargets(item=>item.kind==='building'&&!!factionSystemDefinition(item.definitionId));structures.replaceChildren(...(ownedStructures.length?ownedStructures.map(item=>el('li',`${details(item).join(' · ')} · ${item.x}, ${item.y} · level ${item.level??0}`)):[el('li','No faction structures built yet.')]));
  }catch(error){message(errorText(error),true);}}
  function open(){if(disposed)return;opened=true;panel.hidden=false;launch.setAttribute('aria-expanded','true');update();}
  function close(){if(disposed)return;opened=false;panel.hidden=true;launch.setAttribute('aria-expanded','false');}
  function otherModal(){return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).some(item=>!item.closest('[hidden]')&&getComputedStyle(item).display!=='none');}
  function keyboard(event:KeyboardEvent){if(!opened||disposed||event.repeat||event.defaultPrevented||inputIsSuppressed(event.target)||otherModal())return;if(event.key==='Escape'&&host.contains(event.target as Node)){event.preventDefault();event.stopPropagation();close();launch.focus();return;}const binding=bindingFromKeyboard(event);if(!binding)return;for(const action of buttons.keys()){const shortcut=callbacks.keyFor?.(action);if(shortcut&&normalizeBinding(shortcut)===binding&&!availability(action)){event.preventDefault();event.stopImmediatePropagation();void run(action);return;}}}
  launch.addEventListener('click',()=>{if(opened)close();else open();});closeButton.addEventListener('click',()=>{close();launch.focus();});for(const input of [x,y,level]){input.addEventListener('input',update);input.addEventListener('change',update);}
  document.addEventListener('keydown',keyboard,true);const stop=(event:Event)=>event.stopPropagation();for(const type of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','contextmenu','wheel','keydown'])host.addEventListener(type,stop);
  update();return {update,open,close,dispose(){if(disposed)return;disposed=true;document.removeEventListener('keydown',keyboard,true);launch.remove();host.remove();}};
}
