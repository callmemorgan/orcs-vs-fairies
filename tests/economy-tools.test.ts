// @vitest-environment happy-dom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createGame} from '../src/core/simulation';
import type {Cost,Entity,GameState,ResourceNode} from '../src/core/types';
import type {EconomyView} from '../src/core/economy-types';
import {marketPrices,marketQuote} from '../src/core/economy-cargo';
import {ECONOMY_RULES} from '../src/core/economy-definitions';
import {mountEconomyTools} from '../src/ui/EconomyTools';

type Tools=ReturnType<typeof mountEconomyTools>;
const mounted:Tools[]=[];
afterEach(()=>{for(const tool of mounted.splice(0))tool.dispose();document.body.replaceChildren();vi.restoreAllMocks();});
const zero=():Cost=>({wood:0,ore:0,crystal:0});
function viewFixture():EconomyView{return {version:1,deepSites:[],recruits:[],groves:[],structures:[],caravans:[],salvage:[],markets:[],contracts:[],specializations:[],workerWarehouses:[],ledger:{gathered:zero(),delivered:zero(),traded:zero(),raided:zero(),salvaged:zero(),contractRewards:zero()}};}
function setup(){
  let game:GameState=createGame('orcs',4127,'fairies',{controllers:['human','human']}),view=viewFixture();
  game.players[0].wood=game.players[0].ore=game.players[0].crystal=2000;
  const workers=game.entities.filter(item=>item.side===0&&item.role==='worker'),hq=game.entities.find(item=>item.side===0&&item.role==='hq')!;
  let selected=workers.slice(0,2).map(item=>item.id),resources:(ResourceNode & {visible?:boolean})[]=[];
  const submit=vi.fn<Parameters<typeof mountEconomyTools>[1]['submit']>(()=>true),onModal=vi.fn();
  const root=document.createElement('div');document.body.append(root);
  const tools=mountEconomyTools(root,{getGame:()=>game,getView:()=>view,knownResources:()=>resources,selectedIds:()=>selected,submit,onModal});mounted.push(tools);tools.update();
  root.querySelector<HTMLButtonElement>('[data-economy-launch]')!.click();
  return {root,tools,workers,hq,submit,onModal,get game(){return game;},get view(){return view;},setSelected(ids:number[]){selected=ids;},setResources(value:typeof resources){resources=value;tools.update();},replaceGame(value:GameState){game=value;view=viewFixture();tools.update();}};
}
function control(root:ParentNode,label:string):HTMLButtonElement{const result=Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(item=>item.textContent===label||item.getAttribute('aria-label')===label);expect(result,`button ${label}`).toBeDefined();return result!;}
function input<T extends HTMLInputElement|HTMLSelectElement=HTMLInputElement>(root:ParentNode,label:string):T{const result=Array.from(root.querySelectorAll<T>('input,select')).find(item=>item.getAttribute('aria-label')===label);expect(result,`input ${label}`).toBeDefined();return result!;}
function set(root:ParentNode,label:string,value:string){const element=input(root,label);element.value=value;element.dispatchEvent(new Event('change',{bubbles:true}));}
async function click(root:ParentNode,label:string){control(root,label).click();await Promise.resolve();await Promise.resolve();}
function addEntity(fixture:ReturnType<typeof setup>,role:Entity['role'],point:{x:number;y:number},side:Entity['side']=0){const entity={...fixture.hq,id:fixture.game.nextId++,side,role,...point,queue:[],kind:role==='hq'||role==='depot'?'building':'unit',hp:100,maxHp:100,progress:1,order:{type:'idle'}} as Entity;fixture.game.entities.push(entity);return entity;}
function addWarehouse(fixture:ReturnType<typeof setup>,side:Entity['side']=0){const entity=addEntity(fixture,'depot',{x:fixture.hq.x+11,y:fixture.hq.y},side);fixture.view.structures.push({entityId:entity.id,side,kind:'warehouse',x:entity.x,y:entity.y,hp:entity.hp,maxHp:entity.maxHp,progress:entity.progress,stock:{wood:120,ore:60,crystal:5},capacity:900,overcharge:false,nextIncident:12});return entity;}
function addCaravan(fixture:ReturnType<typeof setup>){const entity=addEntity(fixture,'worker',{x:fixture.hq.x+2,y:fixture.hq.y});fixture.view.caravans.push({entityId:entity.id,...entity,stock:zero(),capacity:90,origin:'delivery',tradeValue:0});return entity;}

describe('economy panel command boundary',()=>{
  it('issues forestry and warehouse commands through the host without spending or editing orders itself',async()=>{
    const fixture=setup(),before=structuredClone(fixture.game.players[0]),orders=fixture.workers.map(item=>structuredClone(item.order));
    set(fixture.root,'Grove X','18.5');set(fixture.root,'Grove Y','12.5');await click(fixture.root,'Plant grove');
    expect(fixture.submit).toHaveBeenLastCalledWith({type:'plantGrove',ids:fixture.workers.slice(0,2).map(item=>item.id),x:18.5,y:12.5});
    control(fixture.root,'Settlements and contracts').click();set(fixture.root,'Warehouse X','21.5');set(fixture.root,'Warehouse Y','14.5');await click(fixture.root,'Build warehouse');
    expect(fixture.submit).toHaveBeenLastCalledWith({type:'buildEconomy',ids:fixture.workers.slice(0,2).map(item=>item.id),kind:'warehouse',x:21.5,y:14.5});
    expect(fixture.game.players[0]).toEqual(before);expect(fixture.workers.map(item=>item.order)).toEqual(orders);
    expect(fixture.root.textContent).toContain(`${ECONOMY_RULES.grove.growthSeconds} seconds to mature`);
  });
  it('uses visible depleted ore, hides live unseen resources and rejects already claimed crystal sites',async()=>{
    const fixture=setup();fixture.game.resources.push({id:999,kind:'crystal',x:30,y:30,amount:1000,maxAmount:1000});
    fixture.setResources([{id:500,kind:'ore',x:10,y:10,amount:0,maxAmount:400,visible:true},{id:501,kind:'ore',x:11,y:10,amount:0,maxAmount:400,visible:false},{id:502,kind:'crystal',x:12,y:10,amount:100,maxAmount:100,visible:true}]);
    await click(fixture.root,'Build deep mine');expect(fixture.submit).toHaveBeenLastCalledWith({type:'buildEconomy',ids:fixture.workers.slice(0,2).map(item=>item.id),kind:'deep-mine',target:500});
    expect(input<HTMLSelectElement>(fixture.root,'Depleted ore deposit').options[1].disabled).toBe(true);expect(input<HTMLSelectElement>(fixture.root,'Crystal deposit').textContent).not.toContain('999');
    fixture.view.structures.push({entityId:600,kind:'extractor',resourceId:502,side:0,x:12,y:13,hp:100,maxHp:100,progress:1,stock:zero(),capacity:0,overcharge:false,nextIncident:12});fixture.tools.update();
    expect(control(fixture.root,'Build crystal extractor').disabled).toBe(true);
    control(fixture.root,'Build crystal extractor').dispatchEvent(new MouseEvent('click',{bubbles:true}));expect(fixture.submit).toHaveBeenCalledTimes(1);
  });
  it('shows and toggles a completed owned extractor while excluding foreign or unfinished extractors',async()=>{
    const fixture=setup();fixture.view.structures.push({entityId:100,kind:'extractor',side:0,x:10,y:10,hp:500,maxHp:650,progress:1,stock:zero(),capacity:0,overcharge:true,nextIncident:12},{entityId:101,kind:'extractor',side:1,x:10,y:11,hp:650,maxHp:650,progress:1,stock:zero(),capacity:0,overcharge:false,nextIncident:12},{entityId:102,kind:'extractor',side:0,x:10,y:12,hp:65,maxHp:650,progress:.2,stock:zero(),capacity:0,overcharge:false,nextIncident:12});fixture.tools.update();
    expect(input<HTMLSelectElement>(fixture.root,'Owned crystal extractor').options).toHaveLength(1);await click(fixture.root,'Disable overcharge');expect(fixture.submit).toHaveBeenLastCalledWith({type:'setOvercharge',id:100,enabled:false});
    expect(fixture.root.textContent).toContain('50% chance of 75 damage every 12 seconds');
  });
  it('uses explicit caravan cargo, local stock and distinct route endpoints',async()=>{
    const fixture=setup(),warehouse=addWarehouse(fixture),caravan=addCaravan(fixture);fixture.tools.update();control(fixture.root,'Caravans and markets').click();
    await click(fixture.root,'Recruit caravan');expect(fixture.submit).toHaveBeenLastCalledWith({type:'trainCaravan',id:fixture.hq.id});
    set(fixture.root,'Trade route source',String(fixture.hq.id));set(fixture.root,'Trade route destination',String(warehouse.id));set(fixture.root,'Trade route resource','ore');set(fixture.root,'Trade route amount','32');set(fixture.root,'Repeat trade route','no');await click(fixture.root,'Start trade route');expect(fixture.submit).toHaveBeenLastCalledWith({type:'tradeRoute',id:caravan.id,source:fixture.hq.id,target:warehouse.id,kind:'ore',amount:32,repeat:false});
    control(fixture.root,'Settlements and contracts').click();set(fixture.root,'Delivery stock source',String(warehouse.id));set(fixture.root,'Delivery stock destination',String(fixture.hq.id));set(fixture.root,'Wood delivery amount','20');set(fixture.root,'Ore delivery amount','3');await click(fixture.root,'Deliver stock');expect(fixture.submit).toHaveBeenLastCalledWith({type:'deliverStock',id:caravan.id,source:warehouse.id,target:fixture.hq.id,stock:{wood:20,ore:3,crystal:0}});
    set(fixture.root,'Delivery stock destination',String(warehouse.id));fixture.tools.update();expect(control(fixture.root,'Deliver stock').disabled).toBe(true);
  });
  it('excludes caravans and foreign selected units from worker commands',async()=>{
    const fixture=setup(),caravan=addCaravan(fixture),foreign=fixture.game.entities.find(item=>item.side===1&&item.role==='worker')!;fixture.setSelected([caravan.id,foreign.id]);fixture.tools.update();control(fixture.root,'Use battlefield selection').click();expect(control(fixture.root,'Plant grove').disabled).toBe(true);control(fixture.root,'Plant grove').dispatchEvent(new MouseEvent('click',{bubbles:true}));expect(fixture.submit).not.toHaveBeenCalled();
  });
  it('quotes and submits demand-priced market trades in the correct currency',async()=>{
    const fixture=setup(),location=fixture.workers[0],market={id:800,x:location.x,y:location.y,stock:{wood:1500,ore:1500,crystal:1500},demand:zero(),recoverAt:0};fixture.view.markets.push({...market,prices:marketPrices(market)});fixture.tools.update();control(fixture.root,'Caravans and markets').click();
    set(fixture.root,'Market resource','wood');set(fixture.root,'Market amount','12');await click(fixture.root,'Buy resource');expect(fixture.submit).toHaveBeenLastCalledWith({type:'marketTrade',market:800,kind:'wood',amount:12,direction:'buy'});expect(fixture.root.querySelector('[aria-label="Market price and stock"]')!.textContent).toContain(`${Math.round(marketQuote(market,'wood',12,'buy')*10)/10} ore`);
    set(fixture.root,'Market resource','crystal');await click(fixture.root,'Sell resource');expect(fixture.submit).toHaveBeenLastCalledWith({type:'marketTrade',market:800,kind:'crystal',amount:12,direction:'sell'});
    fixture.view.markets[0].x=60;fixture.view.markets[0].y=60;fixture.tools.update();expect(control(fixture.root,'Buy resource').disabled).toBe(true);expect(control(fixture.root,'Buy resource').title).toContain('within 3 tiles');
  });
  it('raids with military units and collects salvage with workers',async()=>{
    const fixture=setup(),soldier=addEntity(fixture,'melee',{x:fixture.hq.x+2,y:fixture.hq.y}),hostile=addWarehouse(fixture,1);fixture.view.salvage.push({id:801,x:10,y:10,stock:{wood:8,ore:2,crystal:0},expiresAt:120,owner:1,kind:'salvage'});fixture.setSelected([soldier.id,fixture.workers[0].id]);fixture.tools.update();control(fixture.root,'Use battlefield selection').click();control(fixture.root,'Supply and salvage').click();
    await click(fixture.root,'Raid supply');expect(fixture.submit).toHaveBeenLastCalledWith({type:'raidSupply',ids:[soldier.id],target:hostile.id});await click(fixture.root,'Collect salvage');expect(fixture.submit).toHaveBeenLastCalledWith({type:'collectSalvage',ids:[fixture.workers[0].id],target:801});expect(fixture.root.querySelector('[aria-label="Salvage materials and expiry"]')!.textContent).toContain('expires in 120 seconds');
  });
  it('assigns workers to local delivery and then returns them to central delivery',async()=>{
    const fixture=setup(),warehouse=addWarehouse(fixture);fixture.tools.update();control(fixture.root,'Settlements and contracts').click();await click(fixture.root,'Assign worker warehouse');expect(fixture.submit).toHaveBeenLastCalledWith({type:'setWarehouse',ids:fixture.workers.slice(0,2).map(item=>item.id),target:warehouse.id});await click(fixture.root,'Use central delivery');expect(fixture.submit).toHaveBeenLastCalledWith({type:'setWarehouse',ids:fixture.workers.slice(0,2).map(item=>item.id),target:null});expect(fixture.root.querySelector('[aria-label="Warehouse stock and capacity"]')!.textContent).toContain('120 wood, 60 ore, 5 crystal');
  });
  it('specializes an expansion without offering the starting headquarters',async()=>{
    const fixture=setup(),expansion=addEntity(fixture,'hq',{x:fixture.hq.x+12,y:fixture.hq.y});fixture.tools.update();control(fixture.root,'Settlements and contracts').click();const settlements=input<HTMLSelectElement>(fixture.root,'Expansion settlement');expect(Array.from(settlements.options).map(option=>option.value)).toEqual([String(expansion.id)]);set(fixture.root,'Settlement specialization','research');await click(fixture.root,'Specialize settlement');expect(fixture.submit).toHaveBeenLastCalledWith({type:'specializeSettlement',id:expansion.id,kind:'research'});fixture.view.specializations.push({entityId:expansion.id,kind:'research'});fixture.tools.update();expect(control(fixture.root,'Specialize settlement').disabled).toBe(true);
  });
  it('accepts a nearby open contract and arranges an accepted contract delivery',async()=>{
    const fixture=setup(),caravan=addCaravan(fixture),location=fixture.workers[0];fixture.view.contracts.push({id:802,villageId:803,x:location.x,y:location.y,side:null,kind:'ore',amount:60,delivered:0,deadline:180,reward:{wood:35,ore:25,crystal:10},status:'open'});fixture.tools.update();control(fixture.root,'Settlements and contracts').click();expect(control(fixture.root,'Deliver contract').disabled).toBe(true);await click(fixture.root,'Accept contract');expect(fixture.submit).toHaveBeenLastCalledWith({type:'acceptContract',id:802});fixture.view.contracts[0].side=0;fixture.view.contracts[0].status='accepted';fixture.tools.update();await click(fixture.root,'Deliver contract');expect(fixture.submit).toHaveBeenLastCalledWith({type:'deliverContract',id:caravan.id,contract:802,source:fixture.hq.id});expect(fixture.root.querySelector('[aria-label="Contract delivery and reward"]')!.textContent).toContain('reward 35 wood, 25 ore, 10 crystal');
  });
  it('offers visible allied destinations while restricting sources to owned stock',()=>{
    const fixture=setup();fixture.game.teams[1]=fixture.game.teams[0];fixture.game.players[1].wood=987654;const allied=addEntity(fixture,'depot',{x:fixture.hq.x+3,y:fixture.hq.y},1),hidden=addEntity(fixture,'depot',{x:60,y:60},1);fixture.game.visible[0].add(Math.floor(allied.y)*fixture.game.width+Math.floor(allied.x));fixture.game.visible[0].delete(Math.floor(hidden.y)*fixture.game.width+Math.floor(hidden.x));fixture.tools.update();const options=input<HTMLSelectElement>(fixture.root,'Delivery stock destination');expect(options.textContent).toContain(`Allied Depot ${allied.id}`);expect(input<HTMLSelectElement>(fixture.root,'Delivery stock source').textContent).not.toContain(`Allied Depot ${allied.id}`);expect(options.textContent).not.toContain(`Depot ${hidden.id}`);expect(fixture.root.textContent).not.toContain('987654');
  });
  it('excludes an already exhausted deep site after its mine has been destroyed',()=>{
    const fixture=setup();fixture.view.deepSites.push(500);fixture.setResources([{id:500,kind:'ore',x:10,y:10,amount:0,maxAmount:400,visible:true}]);expect(control(fixture.root,'Build deep mine').disabled).toBe(true);
  });
  it('keeps coordinate drafts and focus during frame updates',()=>{
    const fixture=setup(),x=input(fixture.root,'Grove X');x.value='22.5';x.focus();fixture.game.tick++;fixture.tools.update();expect(input(fixture.root,'Grove X')).toBe(x);expect(x.value).toBe('22.5');expect(document.activeElement).toBe(x);
  });
  it('does not submit unaffordable construction and explains the missing stock',()=>{
    const fixture=setup();fixture.game.players[0].wood=0;fixture.tools.update();const plant=control(fixture.root,'Plant grove');expect(plant.disabled).toBe(true);expect(plant.title).toContain('Need 8 wood');plant.dispatchEvent(new MouseEvent('click',{bubbles:true}));expect(fixture.submit).not.toHaveBeenCalled();
  });
  it.each(['','-2','NaN','20000'])('rejects invalid map coordinate %s before submission',async value=>{
    const fixture=setup();set(fixture.root,'Grove X',value);await click(fixture.root,'Plant grove');expect(fixture.submit).not.toHaveBeenCalled();expect(fixture.root.querySelector('[role=status]')?.textContent).toContain('position within the map');
  });
  it('lists burned, pending and mature groves with remaining times',()=>{
    const fixture=setup();fixture.game.time=20;fixture.view.groves.push({id:601,x:8,y:8,side:0,burned:false,plantedAt:10,maturesAt:70},{id:602,x:9,y:8,side:0,burned:true,plantedAt:5,maturesAt:65},{id:603,x:10,y:8,side:0,burned:false,plantedAt:5,maturesAt:65,resourceId:610});fixture.tools.update();const rows=fixture.root.querySelector('[aria-label="Planted groves"]')!.textContent;expect(rows).toContain('matures in 50 seconds');expect(rows).toContain('burned');expect(rows).toContain('harvestable');
  });
});

describe('economy panel lifecycle',()=>{
  it.each(['readOnly','eliminated','ended'] as const)('blocks dispatched mutations in a %s view',async mode=>{
    const fixture=setup();if(mode==='eliminated')fixture.game.eliminated[0]=true;if(mode==='ended')fixture.game.winner=1;fixture.tools.update(mode==='readOnly'?{readOnly:true}:{});
    for(const action of Array.from(fixture.root.querySelectorAll<HTMLButtonElement>('[data-economy-action]'))){expect(action.disabled).toBe(true);action.dispatchEvent(new MouseEvent('click',{bubbles:true}));}await Promise.resolve();expect(fixture.submit).not.toHaveBeenCalled();
  });
  it('retains a rejection message and allows another command',async()=>{
    const fixture=setup();fixture.submit.mockReturnValueOnce(false);await click(fixture.root,'Plant grove');expect(fixture.root.querySelector('[role=status]')!.textContent).toContain('rejected');expect(control(fixture.root,'Plant grove').disabled).toBe(false);await click(fixture.root,'Plant grove');expect(fixture.submit).toHaveBeenCalledTimes(2);
  });
  it('releases an obsolete pending command on context replacement and ignores its completion',async()=>{
    const fixture=setup();let resolveOld!:(value:boolean)=>void;fixture.submit.mockReturnValueOnce(new Promise<boolean>(resolve=>{resolveOld=resolve;}));control(fixture.root,'Plant grove').click();expect(control(fixture.root,'Plant grove').disabled).toBe(true);
    const replacement=createGame('orcs',7,'fairies',{controllers:['human','human']});replacement.players[0].wood=1000;fixture.replaceGame(replacement);control(fixture.root,'Use battlefield selection').click();expect(control(fixture.root,'Plant grove').disabled).toBe(false);fixture.submit.mockReturnValueOnce(false);await click(fixture.root,'Plant grove');const current=fixture.root.querySelector('[role=status]')!.textContent;resolveOld(true);await Promise.resolve();await Promise.resolve();expect(fixture.root.querySelector('[role=status]')!.textContent).toBe(current);
  });
  it('restores focus on Escape, traps Tab and releases modal state when disposed',()=>{
    const fixture=setup();control(fixture.root,'Close economy and settlements').click();const launch=fixture.root.querySelector<HTMLButtonElement>('[data-economy-launch]')!;launch.focus();launch.click();const close=control(fixture.root,'Close economy and settlements');close.focus();close.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true}));expect(document.activeElement).not.toBe(close);document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));expect(fixture.onModal).toHaveBeenLastCalledWith(false);expect(document.activeElement).toBe(launch);launch.click();fixture.tools.dispose();expect(fixture.onModal).toHaveBeenLastCalledWith(false);expect(fixture.root.children).toHaveLength(0);
  });
  it('cannot launch alongside another visible modal or without a game',()=>{
    const fixture=setup();control(fixture.root,'Close economy and settlements').click();const other=document.createElement('section');other.setAttribute('role','dialog');other.setAttribute('aria-modal','true');document.body.append(other);fixture.root.querySelector<HTMLButtonElement>('[data-economy-launch]')!.click();expect(fixture.onModal.mock.calls.filter(([open])=>open)).toHaveLength(1);fixture.tools.update({blocked:true});expect(fixture.root.querySelector<HTMLButtonElement>('[data-economy-launch]')!.disabled).toBe(true);
  });
});

describe('economy panel layer compatibility',()=>{
 it('disables surface resource and warehouse targets for an underground worker',()=>{
  const f=setup();for(const worker of f.workers.slice(0,2))worker.level=1;
  f.setResources([{id:500,kind:'crystal',x:10,y:10,level:0,amount:100,maxAmount:100,visible:true},{id:501,kind:'ore',x:10,y:12,level:0,amount:0,maxAmount:100,visible:true}]);
  const warehouse=addWarehouse(f);f.tools.update();expect(input<HTMLSelectElement>(f.root,'Crystal deposit').options[0].disabled).toBe(true);expect(input<HTMLSelectElement>(f.root,'Crystal deposit').options[0].textContent).toContain('Surface');expect(control(f.root,'Build crystal extractor').disabled).toBe(true);expect(control(f.root,'Build deep mine').disabled).toBe(true);
  control(f.root,'Settlements and contracts').click();f.tools.update();expect(input<HTMLSelectElement>(f.root,'Worker delivery warehouse').options[0].value).toBe(String(warehouse.id));expect(input<HTMLSelectElement>(f.root,'Worker delivery warehouse').options[0].disabled).toBe(true);expect(control(f.root,'Assign worker warehouse').disabled).toBe(true);expect(f.submit).not.toHaveBeenCalled();
 });
 it('explains a mixed-layer worker selection before accepting a planting order',()=>{
  const f=setup();f.workers[0].level=1;f.tools.update();expect(control(f.root,'Plant grove').disabled).toBe(true);expect(control(f.root,'Plant grove').title).toContain('one map level');
 });
 it('disables stock and accepted contract delivery across caravan layers',()=>{
  const f=setup(),warehouse=addWarehouse(f),cart=addCaravan(f);cart.level=1;f.view.caravans[0].level=1;f.view.contracts.push({id:600,villageId:601,x:20,y:20,level:0,side:0,kind:'wood',amount:60,delivered:0,deadline:180,reward:zero(),status:'accepted'});f.tools.update();control(f.root,'Settlements and contracts').click();set(f.root,'Delivery stock destination',String(warehouse.id));expect(control(f.root,'Deliver stock').disabled).toBe(true);expect(control(f.root,'Deliver stock').title).toContain('same map level');expect(control(f.root,'Deliver contract').disabled).toBe(true);expect(control(f.root,'Deliver contract').title).toContain('same map level');
 });
});


it('mounts the economy launcher in the shared toolbar and removes it on disposal',()=>{
 const root=document.createElement('div'),toolbar=document.createElement('nav');document.body.append(root);root.append(toolbar);
 const game=createGame('orcs',4127,'fairies',{controllers:['human','human']}),onModal=vi.fn();
 const tools=mountEconomyTools(root,{toolbar,getGame:()=>game,getView:()=>viewFixture(),knownResources:()=>[],selectedIds:()=>[],submit:()=>true,onModal});mounted.push(tools);tools.update();
 const launcher=toolbar.querySelector<HTMLButtonElement>('[data-economy-launch]')!;expect(launcher).toBeDefined();expect(root.querySelector('.economy-toolbar')).toBeNull();launcher.click();
 expect(root.querySelector<HTMLElement>('.economy-overlay')!.hidden).toBe(false);expect(onModal).toHaveBeenLastCalledWith(true);tools.dispose();expect(toolbar.children).toHaveLength(0);expect(onModal).toHaveBeenLastCalledWith(false);
});
