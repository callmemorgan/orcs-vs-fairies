// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mountCosmeticTools } from '../src/ui/CosmeticTools';
import { mountCompetitionTools } from '../src/ui/CompetitionTools';
import type { CosmeticApi } from '../src/online/cosmetic-client';
import { OnlineRequestError } from '../src/online/client';

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


function cosmeticEpochDeferred<T>() {
  let resolve!: (value:T|PromiseLike<T>)=>void;
  let reject!: (reason?:unknown)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
const cosmeticEpochResponse={account:{id:'new',username:'New'},profile:{owned:[],wins:{orcs:5},equipment:{}},catalog:[],rules:'Current account'};

it('ignores a stale generic error while the queued new account request is pending',async()=>{
  const {root}=host(),old=cosmeticEpochDeferred<unknown>(),latest=cosmeticEpochDeferred<unknown>(),latestStarted=cosmeticEpochDeferred<void>();
  const request=vi.fn().mockImplementationOnce(()=>old.promise).mockImplementationOnce(()=>{latestStarted.resolve(undefined);return latest.promise;});
  const api={cosmetics:request} as unknown as CosmeticApi,onEquipment=vi.fn();
  const tool=mountCosmeticTools(root,{api,onEquipment});dispose.push(()=>tool.dispose());
  try {
    const loading=tool.refresh();tool.reset();await tool.refresh();
    old.reject(new Error('Old account request failed'));await loading;await latestStarted.promise;
    expect(request).toHaveBeenCalledTimes(2);
    expect(root.querySelector('.cosmetic-message')!.textContent).toBe('');
    expect(onEquipment).not.toHaveBeenCalled();
  } finally {tool.dispose();latest.resolve(cosmeticEpochResponse);}
});

it('ignores a stale 401 without clearing equipment while the new account request is pending',async()=>{
  const {root}=host(),old=cosmeticEpochDeferred<unknown>(),latest=cosmeticEpochDeferred<unknown>(),latestStarted=cosmeticEpochDeferred<void>();
  const request=vi.fn().mockImplementationOnce(()=>old.promise).mockImplementationOnce(()=>{latestStarted.resolve(undefined);return latest.promise;});
  const api={cosmetics:request} as unknown as CosmeticApi,onEquipment=vi.fn(),onProfile=vi.fn();
  const tool=mountCosmeticTools(root,{api,onEquipment,onProfile});dispose.push(()=>tool.dispose());
  try {
    const loading=tool.refresh();tool.reset();await tool.refresh();
    old.reject(new OnlineRequestError(401,'Old account authentication expired'));await loading;await latestStarted.promise;
    expect(request).toHaveBeenCalledTimes(2);
    expect(onEquipment).not.toHaveBeenCalled();
    expect(onProfile).not.toHaveBeenCalled();
    expect(root.querySelector('.cosmetic-message')!.textContent).toBe('');
  } finally {tool.dispose();latest.resolve(cosmeticEpochResponse);}
});

it('does not recover a stale 409 by fetching after disposal',async()=>{
  const {root}=host(),old=cosmeticEpochDeferred<unknown>();
  const request=vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(cosmeticEpochResponse);
  const api={cosmetics:request} as unknown as CosmeticApi,onEquipment=vi.fn(),onProfile=vi.fn();
  const tool=mountCosmeticTools(root,{api,onEquipment,onProfile});dispose.push(()=>tool.dispose());
  const loading=tool.refresh();tool.dispose();old.reject(new OnlineRequestError(409,'Old equipment revision conflict'));await loading;
  expect(request).toHaveBeenCalledTimes(1);
  expect(onEquipment).not.toHaveBeenCalled();
  expect(onProfile).not.toHaveBeenCalled();
  expect(root.querySelector('.cosmetic-tools')).toBeNull();
});

it('stops old profile callbacks when reset occurs during awaited equipment application',async()=>{
  const {root}=host(),firstStarted=cosmeticEpochDeferred<void>(),releaseFirst=cosmeticEpochDeferred<void>();
  const response={...cosmeticEpochResponse,account:{id:'old',username:'Old'}};
  const api={cosmetics:vi.fn().mockResolvedValue(response)} as unknown as CosmeticApi;
  let first=true;
  const onEquipment=vi.fn(async(_factionId:string,_loadout:unknown,_accountId?:string)=>{if(first){first=false;firstStarted.resolve(undefined);await releaseFirst.promise;}}),onProfile=vi.fn();
  const tool=mountCosmeticTools(root,{api,onEquipment,onProfile});dispose.push(()=>tool.dispose());
  try {
    const loading=tool.refresh();await firstStarted.promise;tool.reset();releaseFirst.resolve(undefined);await loading;
    expect(onEquipment).toHaveBeenCalledTimes(1);
    expect(onEquipment.mock.calls[0]?.[2]).toBe('old');
    expect(onProfile).not.toHaveBeenCalled();
    expect(root.querySelector('.cosmetic-wins')!.textContent).toBe('Ironclad: 0 faction victories.');
    expect(root.querySelector('.cosmetic-cards')!.childElementCount).toBe(0);
  } finally {releaseFirst.resolve(undefined);tool.dispose();}
});
