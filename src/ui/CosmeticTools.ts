import { FACTIONS } from '../core/content';
import type { FactionId } from '../core/types';
import { CosmeticApi } from '../online/cosmetic-client';
import { EMPTY_COSMETIC_EQUIPMENT } from '../online/cosmetics';
import type { Cosmetic, CosmeticEquipment, CosmeticProfile, CosmeticSlot } from '../online/cosmetics';
import { cosmeticImage, resolveCosmeticLoadout } from '../game/Cosmetics';
import type { CosmeticLoadout } from '../game/Cosmetics';
import { OnlineRequestError } from '../online/client';
import './cosmetic-tools.css';

export interface CosmeticToolsOptions {api?:CosmeticApi;getFaction?:()=>FactionId;onEquipment:(factionId:FactionId,loadout:CosmeticLoadout)=>void|Promise<void>;onVisibility?:(visible:boolean)=>void}
const escape=(text:string)=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const slots:CosmeticSlot[]=['banner','decoration','portrait'];

/** A saved server receipt is required before a selection reaches the renderer callback. */
export function mountCosmeticTools(root:HTMLElement,options:CosmeticToolsOptions){
  const api=options.api??new CosmeticApi(),host=document.createElement('section');host.className='cosmetic-tools';
  host.innerHTML=`<button type="button" class="cosmetic-open small-button">Cosmetics</button><div class="cosmetic-overlay" hidden><section class="cosmetic-dialog" role="dialog" aria-modal="true" aria-label="Cosmetic unlocks" tabindex="-1"><header><h2>Cosmetic unlocks</h2><button type="button" class="cosmetic-close">Close</button></header><p class="cosmetic-message" role="status" aria-live="polite"></p><p class="cosmetic-rules"></p><button type="button" data-cosmetic="refresh">Refresh unlocks</button><form class="cosmetic-form"><label>Faction<select aria-label="Cosmetic faction">${Object.values(FACTIONS).map(faction=>`<option value="${faction.id}">${escape(faction.name)}</option>`).join('')}</select></label><p class="cosmetic-wins"></p><div class="cosmetic-cards"></div><div class="cosmetic-slots"></div><button type="submit">Apply cosmetic choices</button></form></section></div>`;
  root.append(host);
  const element=<T extends HTMLElement>(selector:string)=>host.querySelector<T>(selector)!;
  const overlay=element('.cosmetic-overlay'),dialog=element('.cosmetic-dialog'),faction=element<HTMLSelectElement>('[aria-label="Cosmetic faction"]');
  let visible=false,busy=false,disposed=false,profile:CosmeticProfile|undefined,catalog:Cosmetic[]=[],previousFocus:HTMLElement|null=null;
  const message=(text:string)=>{element('.cosmetic-message').textContent=text;};
  const controls=()=>{for(const node of Array.from(host.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select')))if(!node.classList.contains('cosmetic-close')&&!node.classList.contains('cosmetic-open')&&node.dataset.cosmetic!=='refresh')node.disabled=busy||!profile;element<HTMLButtonElement>('[data-cosmetic="refresh"]').disabled=busy;};
  const readFaction=()=>faction.value as FactionId;
  function render(){
    const current=readFaction(),wins=profile?.wins[current]??0,loadout=profile?.equipment[current]?.loadout??EMPTY_COSMETIC_EQUIPMENT;
    element('.cosmetic-wins').textContent=`${FACTIONS[current].name}: ${wins} faction ${wins===1?'victory':'victories'}.`;
    element('.cosmetic-cards').innerHTML=catalog.filter(item=>item.factionId===current).map(item=>{const earned=profile?.owned.includes(item.id);return `<article class="cosmetic-card${earned?'':' cosmetic-locked'}"><img src="${cosmeticImage(item)}" alt="${escape(item.name)}" width="96" height="96"><h3>${escape(item.name)}</h3><p>${earned?'Earned':`${wins} / ${item.requiresWins} victories`}</p></article>`;}).join('');
    element('.cosmetic-slots').innerHTML=slots.map(slot=>`<label>${slot==='decoration'?'Building decoration':slot==='portrait'?'Commander portrait':'Faction banner'}<select aria-label="Cosmetic ${slot}"><option value="">Default</option>${catalog.filter(item=>item.factionId===current&&item.slot===slot).map(item=>`<option value="${item.id}"${profile?.owned.includes(item.id)?'':' disabled'}${loadout[slot]===item.id?' selected':''}>${escape(item.name)}${profile?.owned.includes(item.id)?'':' (locked)'}</option>`).join('')}</select></label>`).join('');
    controls();
  }
  async function applyProfile(next:CosmeticProfile|undefined){if(disposed)return;profile=next;for(const id of Object.keys(FACTIONS) as FactionId[]){if(disposed)return;await options.onEquipment(id,resolveCosmeticLoadout(id,next?.equipment[id]?.loadout??EMPTY_COSMETIC_EQUIPMENT));}}
  async function refresh(){const response=await api.cosmetics();if(disposed)return;catalog=response.catalog;element('.cosmetic-rules').textContent=response.rules;await applyProfile(response.profile);render();}
  async function run(action:()=>Promise<void>){if(busy||disposed)return;busy=true;controls();try{await action();}catch(error){
    if(error instanceof OnlineRequestError&&error.status===401){await applyProfile(undefined);catalog=[];render();message('Sign in through Online play to view and equip earned cosmetics.');}
    else if(error instanceof OnlineRequestError&&error.status===409){try{await refresh();}catch{}message('Choices changed in another browser. Review the refreshed choices before applying.');}
    else message(error instanceof Error?error.message:'Cosmetic request failed.');
  }finally{busy=false;if(!disposed)controls();}}
  function setVisible(next:boolean){if(disposed||visible===next)return;visible=next;overlay.hidden=!next;options.onVisibility?.(next);if(next){previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;faction.value=options.getFaction?.()??faction.value;dialog.focus();void run(refresh);}else previousFocus?.focus();}
  element<HTMLButtonElement>('.cosmetic-open').onclick=()=>setVisible(true);element<HTMLButtonElement>('.cosmetic-close').onclick=()=>setVisible(false);element<HTMLButtonElement>('[data-cosmetic="refresh"]').onclick=()=>void run(refresh);faction.onchange=render;
  element<HTMLFormElement>('.cosmetic-form').onsubmit=event=>{event.preventDefault();void run(async()=>{if(!profile)throw new Error('Sign in first.');const current=readFaction(),revision=profile.equipment[current]?.revision??0;
    const loadout=Object.fromEntries(slots.map(slot=>[slot,element<HTMLSelectElement>(`[aria-label="Cosmetic ${slot}"]`).value||null])) as unknown as CosmeticEquipment;
    const response=await api.equip(current,revision,loadout);if(disposed)return;await applyProfile(response.profile);render();message('Cosmetic choices saved and applied.');
  });};
  const key=(event:KeyboardEvent)=>{if(!visible)return;if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setVisible(false);}else if(event.key==='Tab'){const nodes=Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled)'));const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',key,true);
  return {get visible(){return visible;},open:()=>setVisible(true),close:()=>setVisible(false),refresh:()=>run(refresh),dispose(){if(disposed)return;if(visible)options.onVisibility?.(false);disposed=true;document.removeEventListener('keydown',key,true);host.remove();}};
}

/** Optional HUD mount for the portrait and banner; the game owns where it appears. */
export function renderCosmeticIdentity(root:HTMLElement,loadout:CosmeticLoadout){root.replaceChildren();for(const item of [loadout.portrait,loadout.banner])if(item){const image=document.createElement('img');image.src=cosmeticImage(item);image.alt=item.name;image.width=item.slot==='portrait'?56:32;image.height=item.slot==='portrait'?56:32;root.append(image);}}
