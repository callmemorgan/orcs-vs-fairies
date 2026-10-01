// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mountCosmeticTools } from '../src/ui/CosmeticTools';
import { mountCompetitionTools } from '../src/ui/CompetitionTools';
import type { CosmeticApi } from '../src/online/cosmetic-client';

const dispose:Array<()=>void>=[];afterEach(()=>{dispose.splice(0).forEach(close=>close());document.body.replaceChildren();});
const wait=()=>new Promise(resolve=>setTimeout(resolve,0));
function host(){const root=document.createElement('div'),toolbar=document.createElement('nav');root.append(toolbar);document.body.append(root);return {root,toolbar};}

it('uses the live modal guard and removes moved launchers on disposal',()=>{
  const {root,toolbar}=host();let blocked=true;
  const cosmetics=mountCosmeticTools(root,{toolbar,isBlocked:()=>blocked,onEquipment:()=>{}}),competitions=mountCompetitionTools(root,{toolbar,isBlocked:()=>blocked,onJoinMatch:()=>{}});dispose.push(()=>cosmetics.dispose(),()=>competitions.dispose());
  for(const tool of [cosmetics,competitions]){tool.open();expect(tool.visible).toBe(false);}
  expect(toolbar.querySelectorAll('button')).toHaveLength(2);cosmetics.dispose();competitions.dispose();expect(toolbar.childElementCount).toBe(0);
});

it('discards a delayed old profile and queues the new account refresh',async()=>{
  const {root}=host();let first!: (value:unknown)=>void;
  const old=new Promise(resolve=>{first=resolve;}),next={account:{id:'new',username:'New'},profile:{owned:[],wins:{},equipment:{}},catalog:[],rules:'Current account'};
  const api={cosmetics:vi.fn().mockReturnValueOnce(old).mockResolvedValue(next)} as unknown as CosmeticApi,onEquipment=vi.fn();
  const tool=mountCosmeticTools(root,{api,onEquipment});dispose.push(()=>tool.dispose());
  const loading=tool.refresh();tool.reset();await tool.refresh();first({...next,account:{id:'old',username:'Old'}});await loading;await wait();
  expect(onEquipment).toHaveBeenCalledTimes(6);expect(onEquipment.mock.calls.every(call=>call[2]==='new')).toBe(true);expect(api.cosmetics).toHaveBeenCalledTimes(2);
});

it('opens cosmetic choices for a mod faction with a valid built-in fallback',async()=>{
  const {root}=host(),api={cosmetics:async()=>({profile:{owned:[],wins:{},equipment:{}},catalog:[],rules:'No earned cosmetics'})} as unknown as CosmeticApi;
  const tool=mountCosmeticTools(root,{api,getFaction:()=>('example:faction' as any),onEquipment:()=>{}});dispose.push(()=>tool.dispose());tool.open();await wait();
  expect(root.querySelector<HTMLSelectElement>('[aria-label="Cosmetic faction"]')!.value).toBe('orcs');expect(root.querySelector('.cosmetic-wins')!.textContent).toContain('Ironclad');
});
