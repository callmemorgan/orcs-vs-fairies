import { environmentPhase, ENVIRONMENT_RULES } from '../core/environment';
import { observeNeutralWorld } from '../core/neutral-world';
import { fogKey, levelOf } from '../core/world-map';
import type { Command, GameState, Side, Vec } from '../core/types';
import type { Biome } from '../core/world-types';
import './world-tools.css';

interface WorldToolsCallbacks {state:()=>GameState|undefined;side:()=>Side;level:()=>number;selected:()=>number[];canCommand:()=>boolean;command:(c:Command)=>boolean;setLevel:(level:number)=>void;select:(ids:number[])=>void;center:(p:Vec)=>void;notice:(text:string)=>void}
const element=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
export function mountWorldBiome(menu:HTMLElement){
 const label=element('label','World'),select=element('select');select.id='world-biome';select.setAttribute('aria-label','World biome');
 for(const [id,title] of [['','Classic plains'],['desert','Desert and caverns'],['marsh','Marsh and caverns'],['snow','Snow valley and caverns'],['forest','Forest and caverns']]){const option=element('option',title);option.value=id;select.append(option);}label.append(select);menu.append(label);
 return ()=>select.value?(select.value as Biome):undefined;
}
export function mountWorldTools(root:HTMLElement,c:WorldToolsCallbacks){
 const host=element('details');host.className='world-tools';host.hidden=true;host.setAttribute('aria-label','World tools');
 const summary=element('summary','World'),body=element('div');body.className='world-tools-body';host.append(summary,body);root.append(host);
 const levelLabel=element('label','Map level'),levels=element('select');levels.setAttribute('aria-label','Map level');levelLabel.append(levels);body.append(levelLabel);levels.addEventListener('change',()=>c.setLevel(Number(levels.value)));
 const description=element('p'),rows=element('div'),fire=element('fieldset'),legend=element('legend','Forest work'),fuel=element('select'),ignite=element('button','Ignite'),firebreak=element('button','Clear firebreak');fuel.setAttribute('aria-label','Forest work tile');fire.append(legend,fuel,ignite,firebreak);body.append(description,rows,fire);
 const action=(command:Command,failure='Select eligible troops on this level and check distance, loyalty and resources.')=>{if(!c.canCommand()||!c.command(command))c.notice(failure);};
 for(const [button,type] of [[ignite,'ignite'],[firebreak,'firebreak']] as const)button.addEventListener('click',()=>{const s=c.state();if(!s||!fuel.value)return;const [x,y]=fuel.value.split(',').map(Number);action({type,ids:c.selected(),x,y,level:c.level()},`Use a worker within ${ENVIRONMENT_RULES.workerReach} tiles of visible timber. Ignition costs 15 wood and 5 ore; a firebreak costs 5 wood. Siege units can ignite from weapon range.`);});
 let signature='',current:GameState|undefined;
 const addButton=(parent:HTMLElement,label:string,command:()=>Command)=>{const button=element('button',label);button.addEventListener('click',()=>action(command()));button.dataset.command='true';parent.append(button);return button;};
 function update(){
  const s=c.state(),world=s?.world;host.hidden=!world;if(!s||!world){signature='';return;}const side=c.side(),level=c.level(),phase=environmentPhase(s);summary.textContent=`World · ${phase.day} · ${phase.weather} · ${phase.season}`;
  if(current!==s||levels.options.length!==world.levels.length){levels.replaceChildren(...world.levels.map(l=>{const option=element('option',l.title);option.value=String(l.id);return option;}));current=s;signature='';}levels.value=String(level);
  description.textContent=`${world.biome} · ${phase.day==='night'?'Night reduces surface sight; Undead keep full sight.':'Daylight changes surface sight.'} ${phase.weather==='rain'?'Rain slows troops and weakens ranged attacks; it stops fire spread.':phase.weather==='fog'?'Fog reduces surface sight to 65%.':phase.weather==='wind'?'Wind changes ranged reach and projectile drift.':'Clear weather.'}${phase.thawIn!==null?` Lake ice thaws in ${Math.ceil(phase.thawIn)}s; leave lake crossings.`:''} Caverns use independent fog and paths.`;
  const known=(p:Vec)=>levelOf(p)===level&&s.visible[side].has(fogKey(s,p)),observed=observeNeutralWorld(s,side),entrances=world.transitions.flatMap(t=>[t.from,t.to].filter(known).map(p=>({id:t.id,p}))),bridges=world.bridges.filter(known),sites=observed.sites.filter(known),creatures=observed.creatures.filter(known),troops=s.entities.filter(e=>e.side===side&&e.hp>0&&e.kind==='unit');
  const key=JSON.stringify([level,c.selected(),entrances.map(e=>e.id),bridges.map(e=>[e.id,e.hp===0]),sites.map(e=>[e.id,e.owner]),creatures.map(e=>e.id),troops.map(e=>[e.id,levelOf(e)])]);
  if(key!==signature){signature=key;rows.replaceChildren();
   for(const entrance of entrances){const row=element('div');row.className='world-row';row.append(element('span',`Entrance ${entrance.id} · ${entrance.p.x}, ${entrance.p.y}`));addButton(row,'Traverse entrance',()=>({type:'traverse',ids:c.selected(),transition:entrance.id}));rows.append(row);}
   for(const bridge of bridges){const row=element('div');row.className='world-row';row.append(element('span',`Bridge #${bridge.id}`));addButton(row,bridge.hp===0?'Rebuild bridge':'Attack bridge',()=>({type:bridge.hp===0?'repairBridge':'worldAttack',ids:c.selected(),target:bridge.id}));if(bridge.hp>0)addButton(row,'Repair bridge',()=>({type:'repairBridge',ids:c.selected(),target:bridge.id}));rows.append(row);}
   for(const site of sites){const row=element('div');row.className='world-row';row.append(element('span',`${site.kind} #${site.id}${site.owner===null?'':` · player ${site.owner+1}`}`));if(site.kind==='relic')addButton(row,'Capture relic',()=>({type:'captureSite',ids:c.selected(),target:site.id}));else if(site.kind==='village'){addButton(row,'Support village / collect supplies',()=>({type:'supportVillage',ids:c.selected(),target:site.id}));addButton(row,'Recruit local defender',()=>({type:'recruitVillage',ids:c.selected(),target:site.id}));addButton(row,'Raid village',()=>({type:'worldAttack',ids:c.selected(),target:site.id}));}else addButton(row,'Attack monster den',()=>({type:'worldAttack',ids:c.selected(),target:site.id}));rows.append(row);}
   for(const creature of creatures){const row=element('div');row.className='world-row';row.append(element('span',`Creature #${creature.id}`));addButton(row,'Attack creature',()=>({type:'worldAttack',ids:c.selected(),target:creature.id}));rows.append(row);}
   const army=element('details'),title=element('summary','Owned troops by level');army.append(title);for(const troop of troops){const button=element('button',`${troop.role} #${troop.id} · ${world.levels[levelOf(troop)].title}`);button.addEventListener('click',()=>{c.select([troop.id]);c.center(troop);});army.append(button);}rows.append(army);
  }
  for(const button of Array.from(rows.querySelectorAll<HTMLButtonElement>('button[data-command]')))button.disabled=!c.canCommand()||!c.selected().length;
  const actor=s.entities.find(e=>c.selected().includes(e.id)&&e.side===side),fuels=new Map<string,Vec>();for(const resource of s.resources)if(resource.kind==='wood'&&resource.amount>0&&known(resource))fuels.set(`${Math.floor(resource.x)+.5},${Math.floor(resource.y)+.5}`,resource);
  for(const flame of world.fires)if(known(flame))fuels.set(`${flame.x},${flame.y}`,flame);
  if(actor)for(let y=Math.max(0,Math.floor(actor.y-2));y<Math.min(s.height,Math.ceil(actor.y+2));y++)for(let x=Math.max(0,Math.floor(actor.x-2));x<Math.min(s.width,Math.ceil(actor.x+2));x++){const p={x:x+.5,y:y+.5,level};if(known(p)&&world.levels[level].terrain[y*s.width+x]==='forest')fuels.set(`${p.x},${p.y}`,p);}
  const options=[...fuels].sort(([,a],[,b])=>actor?Math.hypot(actor.x-a.x,actor.y-a.y)-Math.hypot(actor.x-b.x,actor.y-b.y):a.y-b.y),previous=fuel.value,fuelSignature=options.map(([key])=>key).join(';');if(fuel.dataset.values!==fuelSignature){fuel.dataset.values=fuelSignature;fuel.replaceChildren(...options.map(([key])=>{const o=element('option',`${key} · level ${level}`);o.value=key;return o;}));if(fuels.has(previous))fuel.value=previous;}
  ignite.disabled=firebreak.disabled=!c.canCommand()||!c.selected().length||!fuel.options.length;
 }
 return {update};
}
