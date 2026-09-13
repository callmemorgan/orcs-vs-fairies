/** One shared tooltip, including for unavailable actions. No native hover delay. */
export function createTooltip(root:HTMLElement) {
  const tip=document.createElement('aside');tip.id='command-tooltip';tip.className='command-tooltip';tip.role='tooltip';tip.hidden=true;root.append(tip);
  let target:HTMLElement|null=null;
  const hide=()=>{target?.removeAttribute('aria-describedby');target=null;tip.hidden=true;};
  const refresh=()=>{
    if(!target||!target.isConnected||!target.getClientRects().length){hide();return;}
    tip.innerHTML=target.dataset.tooltip??'';tip.hidden=false;
    const r=target.getBoundingClientRect();
    tip.style.left=`${Math.max(12,Math.min(innerWidth-tip.offsetWidth-12,r.left))}px`;
    tip.style.top=`${r.top>tip.offsetHeight+20?r.top-tip.offsetHeight-10:Math.min(innerHeight-tip.offsetHeight-12,r.bottom+10)}px`;
  };
  const show=(event:Event)=>{const next=(event.target as HTMLElement).closest<HTMLElement>('[data-tooltip]');if(!next)return;target=next;target.setAttribute('aria-describedby',tip.id);refresh();};
  root.addEventListener('pointerover',show);root.addEventListener('focusin',show);
  root.addEventListener('pointerout',event=>{if(target&&!target.contains(event.relatedTarget as Node))hide();});
  root.addEventListener('focusout',hide);root.addEventListener('pointerdown',hide);
  window.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  return {refresh,hide};
}
