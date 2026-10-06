import type { ClientImprovement } from '../host';
import { LAYOUT_FEATURE_ID, LAYOUT_NAMES, type MapLayout } from './layouts';

const DESCRIPTIONS:Record<'generated'|MapLayout,string>={
 generated:'The original seeded wilderness with symmetric deposits and branching roads.',
 plains:'Open ground with a direct road and wide flank routes.',
 river:'Three river crossings connect the banks. Bridges carry the main roads.',
 mountain:'Two mountain passes connect the valleys. Roads turn along the cliff wall.',
};
export default {
 id:LAYOUT_FEATURE_ID,
 mount(context){
  const label=document.createElement('label');label.textContent='Battlefield layout ';
  const select=document.createElement('select');select.setAttribute('aria-label','Battlefield layout');
  for(const [value,text] of Object.entries({generated:'Seeded wilderness',...LAYOUT_NAMES})){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
  label.append(select);context.menu.append(label);
  const description=document.createElement('p');context.menu.append(description);
  const describe=()=>{description.textContent=DESCRIPTIONS[select.value as keyof typeof DESCRIPTIONS];};
  select.addEventListener('change',describe);describe();
  const readOptions=()=>select.value==='generated'?undefined:{layout:select.value as MapLayout};
  const preview=(event:Event)=>{const improvements=(event as CustomEvent).detail?.improvements,options=readOptions();if(improvements&&options)improvements[LAYOUT_FEATURE_ID]=options;};
  context.root.addEventListener('learning-map-options',preview);
  return {readOptions,dispose:()=>context.root.removeEventListener('learning-map-options',preview)};
 }
} satisfies ClientImprovement;
