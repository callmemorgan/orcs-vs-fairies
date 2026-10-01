import { availableUnits, factionFor, upgradesFor } from '../core/content-registry';
import { AGE_NAMES, playerAge, researchRequirement } from '../core/progression';
import type { Age, GameState, Side, UpgradeId } from '../core/types';

/** Native modal keeps battlefield pointer and keyboard input out of the tree. */
export function technologyTree(host:HTMLElement,research:(id:UpgradeId,building:number)=>void){
 const dialog=document.createElement('dialog');dialog.className='technology-tree';
 dialog.innerHTML='<header><div><small>PLAN YOUR SETTLEMENT</small><h2>Technology tree</h2></div><button aria-label="Close technology tree">Close</button></header><p>Research uses resources immediately. Each building can research one technology at a time while recruiting troops.</p><div class="age-columns"></div>';
 host.append(dialog);dialog.querySelector('button')!.onclick=()=>dialog.close();
 dialog.addEventListener('keydown',event=>event.stopPropagation());
 let latest:GameState|undefined;let lastKey='';let latestPaused=false;let latestSide:Side=0;let latestReadOnly=false;
 function update(s:GameState,paused:boolean,side:Side=0,readOnly=false){
  latest=s;latestPaused=paused;latestSide=side;latestReadOnly=readOnly;if(!dialog.open)return;
  const key=JSON.stringify([side,s.players[side],s.entities.filter(e=>e.side===side&&e.kind==='building').map(e=>[e.id,e.hp>0,e.progress===1,e.research,Math.floor(e.researchProgress*100)]),paused,readOnly,s.winner,s.draw]);
  if(key===lastKey)return;lastKey=key;
  const player=s.players[side],f=factionFor(s,side);
  const columns=dialog.querySelector('.age-columns')!;
  const focused=(document.activeElement as HTMLElement)?.dataset.technology;
  columns.replaceChildren();
  for(const age of [1,2,3] as Age[]){
   const section=document.createElement('section');section.className=playerAge(player)>=age?'age-reached':'';
   const title=document.createElement('h3');title.textContent=`${age}. ${AGE_NAMES[age]}`;section.append(title);
   const units=document.createElement('p');units.textContent=`Units: ${availableUnits(s,side).filter(u=>(u.age??1)===age).map(u=>u.name).join(', ')}`;section.append(units);
   const unlocks=document.createElement('p');unlocks.textContent=age===1?'Build: depots, barracks and towers':age===2?'Build: expansion headquarters, stone walls and gates':'Train siege engines at your barracks';section.append(unlocks);
   for(const def of Object.values(upgradesFor(s,side)).filter(u=>(u.advancesTo??u.age??1)===age)){
    const buildings=s.entities.filter(e=>e.side===side&&e.kind==='building'&&e.role===def.building&&e.hp>0&&e.progress===1);
    const active=buildings.find(e=>e.research===def.id),producer=buildings.find(e=>!e.research);
    let reason=researchRequirement(s,side,def.id);
    if(active)reason=`Researching · ${Math.ceil((1-active.researchProgress)*def.researchTime)}s`;
    if(!reason&&!producer)reason=buildings.length?'Production building is researching':`Requires ${f.buildings[def.building].name}`;
    if(!reason&&(['wood','ore','crystal'] as const).some(r=>player[r]<def.cost[r]))reason='Not enough resources';
    if(readOnly&&!reason)reason='Viewing match';if(paused)reason='Battle paused';if(s.winner!==null||s.draw)reason='Match ended';
    const button=document.createElement('button');button.dataset.technology=def.id;button.disabled=!!reason;
    const name=document.createElement('strong');name.textContent=def.name;
    const description=document.createElement('span');description.textContent=def.description;
    const cost=document.createElement('small');cost.textContent=`${def.cost.wood} wood · ${def.cost.ore} ore · ${def.cost.crystal} crystal · ${def.researchTime}s`;
    const status=document.createElement('em');status.textContent=reason??`Research at ${f.buildings[def.building].name}`;
    if(def.exclusiveGroup){const choice=document.createElement('small');choice.className='technology-choice';choice.dataset.technologyGroup=def.exclusiveGroup;choice.textContent=`Choose one: ${Object.values(upgradesFor(s,side)).filter(other=>other.exclusiveGroup===def.exclusiveGroup).map(other=>other.name).join(' or ')}`;button.append(choice);}
    button.append(name,description,cost,status);button.onclick=()=>{if(producer)research(def.id,producer.id);};section.append(button);
   }
   columns.append(section);
  }
  if(focused)dialog.querySelector<HTMLElement>(`[data-technology="${focused}"]`)?.focus({preventScroll:true});
 }
 return {open:()=>{lastKey='';dialog.showModal();if(latest)update(latest,latestPaused,latestSide,latestReadOnly);},update,close:()=>dialog.close()};
}
