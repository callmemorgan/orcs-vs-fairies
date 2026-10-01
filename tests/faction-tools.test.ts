// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { factionConcealment, factionArmorBonus, factionDamageFactor } from '../src/core/faction-systems';
import type { FactionCommand } from '../src/core/faction-systems';
import { FACTION_STRUCTURE_INFO, TROPHY_STANDARD } from '../src/core/faction-systems-content';
import { issueCommand, refreshVisibility } from '../src/core/simulation';
import type { Command, FactionId, Side } from '../src/core/types';
import { mountFactionTools } from '../src/ui/FactionTools';
import type { FactionAction } from '../src/ui/FactionTools';
import { advanceFactionFixture, createFactionFixture } from '../scripts/factions/fixture-state';

const mounted:ReturnType<typeof mountFactionTools>[]=[];
afterEach(()=>{for(const tools of mounted.splice(0))tools.dispose();document.body.replaceChildren();vi.restoreAllMocks();});
function setup(faction:FactionId='orcs'){
  const fixture=createFactionFixture(faction),root=document.createElement('div');document.body.append(root);
  let selected=[fixture.soldier.id],state:typeof fixture.state|null=fixture.state,side:Side=0,permission:boolean|string=true;
  const bindings:Partial<Record<FactionAction,string>>={};
  const command=vi.fn<(value:FactionCommand)=>boolean|Promise<boolean>>(value=>!!state&&issueCommand(state,side,value));
  const coreCommand=vi.fn<(value:Command)=>boolean|Promise<boolean>>(value=>!!state&&issueCommand(state,side,value));
  const tools=mountFactionTools(root,{state:()=>state,selected:()=>selected,side:()=>side,command,coreCommand,enabled:()=>permission,keyFor:action=>bindings[action]});mounted.push(tools);tools.open();
  return {...fixture,root,tools,command,coreCommand,bindings,select(ids:number[]){selected=ids;tools.update();},permission(value:boolean|string){permission=value;tools.update();},replaceState(value:typeof state){state=value;tools.update();},setSide(value:Side){side=value;tools.update();}};
}
function button(root:HTMLElement,action:FactionAction){return root.querySelector<HTMLButtonElement>(`[data-faction-action="${action}"]`)!;}
function input<T extends HTMLInputElement|HTMLSelectElement>(root:HTMLElement,label:string){return root.querySelector<T>(`[aria-label="${label}"]`)!;}
function point(f:ReturnType<typeof setup>,x=f.placement.x,y=f.placement.y,level=0){for(const [label,value] of [['Faction destination X',x],['Faction destination Y',y],['Faction destination level',level]] as const){const item=input<HTMLInputElement|HTMLSelectElement>(f.root,label);item.value=String(value);item.dispatchEvent(new Event('input',{bubbles:true}));}}
async function settled(){await Promise.resolve();await Promise.resolve();}
function details(f:ReturnType<typeof setup>){return f.root.querySelector('[aria-label="Selected faction unit details"]')!.textContent!;}

describe('live faction powers panel',()=>{
  it.each(['assault','bulwark'] as const)('spends Fury and applies the %s chant through the real authority',async chant=>{
    const f=setup(),enemy=f.state.entities.find(item=>item.side===1&&item.role==='melee')!,before=structuredClone(enemy.order);
    f.select([f.soldier.id,f.worker.id,enemy.id]);button(f.root,chant==='assault'?'warChantAssault':'warChantBulwark').click();await settled();
    expect(f.command).toHaveBeenCalledWith({type:'warChant',ids:[f.worker.id,f.soldier.id],chant});expect(f.state.factionSystems!.fury[0]).toBe(75);expect(f.soldier.factionState?.chant).toMatchObject({kind:chant,until:12});expect(f.worker.factionState?.chant).toBeUndefined();expect(enemy.order).toEqual(before);
    expect(chant==='assault'?factionDamageFactor(f.state,f.soldier):factionArmorBonus(f.state,f.soldier)).toBe(chant==='assault'?1.25:3);expect(details(f)).toContain(`${chant} chant`);
    advanceFactionFixture(f.state,13);f.tools.update();expect(f.soldier.factionState?.chant).toBeUndefined();expect(details(f)).not.toContain(`${chant} chant`);
  });
  it('consumes earned trophies to raise a real standard and refreshes selected troop stats',async()=>{
    const f=setup();expect(details(f)).toContain('2 trophies');button(f.root,'trophyStandard').click();await settled();
    const standard=f.state.entities.find(item=>item.definitionId===TROPHY_STANDARD.id)!;expect(standard).toMatchObject({side:0,kind:'building',progress:1,expires:180});expect(f.soldier.factionState?.trophyKills).toBe(0);expect(factionDamageFactor(f.state,f.soldier)).toBe(1.1);expect(details(f)).toContain('0 trophies');expect(f.root.querySelector('[aria-label="Owned faction structures"]')!.textContent).toContain('Trophy Standard');expect(button(f.root,'trophyStandard').disabled).toBe(true);
  });
  it('conjures real doubles and swaps a selected combat troop through the owned illusion picker',async()=>{
    const f=setup('fairies');f.select([f.special.id]);button(f.root,'conjureIllusions').click();await settled();
    expect(f.coreCommand).toHaveBeenCalledWith({type:'ability',ids:[f.special.id]});const illusion=f.state.entities.find(item=>item.side===0&&item.illusion)!;expect(illusion).toBeDefined();expect(button(f.root,'conjureIllusions').disabled).toBe(true);
    f.select([f.soldier.id]);const from={x:f.soldier.x,y:f.soldier.y},to={x:illusion.x,y:illusion.y},crystal=f.state.players[0].crystal;
    input<HTMLSelectElement>(f.root,'Owned illusion').value=String(illusion.id);button(f.root,'illusionSwap').click();await settled();
    expect(f.command).toHaveBeenCalledWith({type:'illusionSwap',ids:[f.soldier.id],target:illusion.id});expect({x:f.soldier.x,y:f.soldier.y}).toEqual(to);expect({x:illusion.x,y:illusion.y}).toEqual(from);expect(f.state.players[0].crystal).toBe(crystal-15);expect(details(f)).toContain('Swap ready in 10s');
  });
  it.each([
    ['fairies','buildGrove','enchanted-grove'],['dwarves','buildTunnel','tunnel'],['undead','buildNecropolis','necropolis'],['automata','buildPowerRelay','power-relay'],
  ] as const)('constructs the %s faction structure through selected workers',async(faction,action,kind)=>{
    const f=setup(faction);f.select([f.worker.id]);point(f);const before={wood:f.state.players[0].wood,ore:f.state.players[0].ore,crystal:f.state.players[0].crystal};button(f.root,action).click();await settled();
    expect(f.command).toHaveBeenCalledWith({type:'buildFactionStructure',ids:[f.worker.id],structure:kind,...f.placement});
    const building=f.state.entities.find(item=>item.definitionId===FACTION_STRUCTURE_INFO[kind].definition.id&&item.progress===0)!;expect(building).toBeDefined();expect(f.worker.order).toEqual({type:'build',target:building.id});expect(f.state.players[0].wood).toBe(before.wood-FACTION_STRUCTURE_INFO[kind].definition.cost.wood);expect(f.state.players[0].ore).toBe(before.ore-FACTION_STRUCTURE_INFO[kind].definition.cost.ore);expect(f.state.players[0].crystal).toBe(before.crystal-FACTION_STRUCTURE_INFO[kind].definition.cost.crystal);
    advanceFactionFixture(f.state,35);f.tools.update();expect(building.progress).toBe(1);expect(f.root.querySelector('[aria-label="Owned faction structures"]')!.textContent).toContain(FACTION_STRUCTURE_INFO[kind].definition.name);
    if(kind==='enchanted-grove')expect(factionConcealment(f.state,f.soldier)).toBe(true);
    if(kind==='power-relay'){expect(f.tower!.factionState?.power?.connected).toBe(true);f.select([f.tower!.id]);expect(details(f)).toContain('Power connected');expect(details(f)).toContain('Shield 80/80');}
  });
  it.each(['stone','grapeshot','incendiary','reinforced'] as const)('fits %s to real selected artillery with per-engine payment',async modification=>{
    const f=setup('dwarves');f.select([f.special.id,f.siege.id,f.worker.id]);const wood=f.state.players[0].wood,ore=f.state.players[0].ore;
    button(f.root,`artillery${modification[0].toUpperCase()}${modification.slice(1)}` as FactionAction).click();await settled();
    expect(f.siege.factionState?.artillery).toBe(modification);expect(f.special.factionState?.artillery).toBe(modification);expect(f.worker.factionState?.artillery).toBeUndefined();expect(f.state.players[0].wood).toBe(wood-50);expect(f.state.players[0].ore).toBe(ore-40);expect(details(f)).toContain(`Artillery fitted: ${modification}`);
  });
  it('shows normalized tunnel channel progress and completes travel to the selected owned exit',async()=>{
    const f=setup('dwarves'),exit=f.tunnels[1],picker=input<HTMLSelectElement>(f.root,'Owned tunnel exit');picker.value=String(exit.id);picker.dispatchEvent(new Event('change',{bubbles:true}));button(f.root,'tunnelTravel').click();await settled();
    expect(f.command).toHaveBeenCalledWith({type:'tunnelTravel',ids:[f.soldier.id],target:exit.id});advanceFactionFixture(f.state,1);f.tools.update();expect(f.soldier.factionState?.tunnel?.progress).toBeCloseTo(1/3);expect(details(f)).toContain(`Tunnel to #${exit.id} · 33%`);
    advanceFactionFixture(f.state,2.1);f.tools.update();expect(f.soldier.factionState?.tunnel).toBeUndefined();expect(Math.hypot(f.soldier.x-exit.x,f.soldier.y-exit.y)).toBeLessThan(3);expect(f.soldier.order.type).toBe('hold');
  });
  it('recruits a real wagon through ordinary production and preserves the paid custom definition',async()=>{
    const f=setup('undead'),wood=f.state.players[0].wood,ore=f.state.players[0].ore;button(f.root,'recruitCorpseWagon').click();await settled();
    expect(f.coreCommand).toHaveBeenCalledWith({type:'train',id:f.barracks.id,role:'special',definitionId:'core:undead-corpse-wagon'});expect(f.barracks.queue).toEqual(['special']);expect(f.barracks.queueDefinitionIds).toEqual(['core:undead-corpse-wagon']);expect(f.state.players[0].wood).toBe(wood-100);expect(f.state.players[0].ore).toBe(ore-45);
    advanceFactionFixture(f.state,25);f.tools.update();expect(f.barracks.queue).toEqual([]);expect(f.state.entities.filter(item=>item.definitionId==='core:undead-corpse-wagon')).toHaveLength(2);
  });
  it('collects a body and delivers it to the selected Gravecaller without extending its decay deadline',async()=>{
    const f=setup('undead'),deadline=f.corpse!.expires;f.select([f.wagon!.id]);button(f.root,'collectCorpses').click();await settled();advanceFactionFixture(f.state,1.1);f.tools.update();
    expect(f.wagon!.factionState?.corpseCargo).toMatchObject([{id:f.corpse!.id,expires:deadline}]);expect(f.state.corpses).toHaveLength(0);expect(details(f)).toContain('1/6 bodies aboard');
    button(f.root,'deliverCorpses').click();await settled();advanceFactionFixture(f.state,4);f.tools.update();expect(f.wagon!.factionState?.corpseCargo).toHaveLength(0);expect(f.special.factionState?.deliveredCorpses).toMatchObject([{id:f.corpse!.id,expires:deadline}]);f.select([f.special.id]);expect(details(f)).toContain('1 delivered bodies ready');
    advanceFactionFixture(f.state,45);f.tools.update();expect(details(f)).toContain('0 delivered bodies ready');
  });
  it.each(['mud','shallows','water'] as const)('shapes %s terrain and restores it through real simulation expiry',async terrain=>{
    const f=setup('tideborn');f.select([f.special.id]);point(f,15.5,16.5);input<HTMLSelectElement>(f.root,'Shaped terrain').value=terrain;const crystal=f.state.players[0].crystal;
    button(f.root,'shapeWater').click();await settled();expect(f.command).toHaveBeenCalledWith({type:'shapeWater',ids:[f.special.id],x:15.5,y:16.5,level:0,terrain});expect(f.state.factionSystems!.terrainEffects).toHaveLength(1);const effect=f.state.factionSystems!.terrainEffects[0];expect(effect.tiles.length).toBeGreaterThan(0);for(const tile of effect.tiles)expect(f.state.terrain[Math.floor(tile.y)*f.state.width+Math.floor(tile.x)]).toBe(terrain);expect(f.state.players[0].crystal).toBe(crystal-25);expect(details(f)).toContain('Water shaping ready in 20s');expect(button(f.root,'shapeWater').disabled).toBe(true);
    advanceFactionFixture(f.state,20.1);f.tools.update();expect(f.state.factionSystems!.terrainEffects).toHaveLength(0);for(const tile of effect.tiles)expect(f.state.terrain[Math.floor(tile.y)*f.state.width+Math.floor(tile.x)]).toBe('grass');expect(button(f.root,'shapeWater').disabled).toBe(false);
  });
  it('filters hidden levels and expired bodies from the corpse picker',()=>{
    const f=setup('undead');f.select([f.wagon!.id]);const hidden={...f.corpse!,id:f.state.nextId++,level:1},expired={...f.corpse!,id:f.state.nextId++,expires:f.state.time};f.state.corpses.push(hidden,expired);f.tools.update();
    const picker=input<HTMLSelectElement>(f.root,'Visible corpse');expect(Array.from(picker.options).map(item=>item.value)).toEqual([String(f.corpse!.id)]);
    f.corpse!.x=f.state.width-2;f.corpse!.y=f.state.height-2;refreshVisibility(f.state);button(f.root,'collectCorpses').click();expect(f.command).not.toHaveBeenCalled();expect(picker.value).toBe('');
  });
  it('does not dispatch a retained illusion target after the target dies',async()=>{
    const f=setup('fairies');f.select([f.special.id]);button(f.root,'conjureIllusions').click();await settled();f.select([f.soldier.id]);const illusion=f.state.entities.find(item=>item.illusion)!;illusion.hp=0;
    button(f.root,'illusionSwap').click();expect(f.command).not.toHaveBeenCalled();expect(f.root.textContent).toContain('owned living illusion');
  });
  it('rejects construction without a worker on the chosen level and preserves cost information',()=>{
    const f=setup('fairies');f.select([f.worker.id]);point(f,16.5,14.5,1);expect(button(f.root,'buildGrove').disabled).toBe(true);expect(f.root.textContent).toContain('worker on the construction level');expect(f.root.textContent).toContain('100 wood · 20 ore · 15 crystal');
    point(f);const x=input<HTMLInputElement>(f.root,'Faction destination X');x.value='';x.dispatchEvent(new Event('input',{bubbles:true}));expect(button(f.root,'buildGrove').disabled).toBe(true);expect(f.root.textContent).toContain('Enter a destination inside the map');
  });
  it('retains destination drafts and keyboard focus during selection changes',()=>{
    const f=setup('fairies'),x=input<HTMLInputElement>(f.root,'Faction destination X');point(f,19.5,20.5,1);x.focus();f.select([f.worker.id]);expect(document.activeElement).toBe(x);expect(x.value).toBe('19.5');expect(input<HTMLInputElement>(f.root,'Faction destination Y').value).toBe('20.5');expect(input<HTMLSelectElement>(f.root,'Faction destination level').value).toBe('1');
  });
  it('rechecks host permissions before dispatch and disables all visible faction commands in ended matches',()=>{
    const f=setup();f.permission('Replay is read-only.');expect(button(f.root,'warChantAssault').disabled).toBe(true);button(f.root,'warChantAssault').dispatchEvent(new MouseEvent('click',{bubbles:true}));expect(f.command).not.toHaveBeenCalled();expect(f.root.textContent).toContain('Replay is read-only.');
    f.permission(true);f.state.winner=0;f.tools.update();expect(button(f.root,'warChantAssault').disabled).toBe(true);expect(f.root.textContent).toContain('The match has ended.');
  });
  it('uses live profile bindings, stops battlefield input, and ignores editable fields and other modals',async()=>{
    const f=setup();f.bindings.warChantAssault='Alt+KeyA';f.tools.update();expect(button(f.root,'warChantAssault').textContent).toContain('Alt+A');const battle=vi.fn();window.addEventListener('keydown',battle);
    try{document.body.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyA',key:'a',altKey:true,bubbles:true,cancelable:true}));await settled();expect(f.command).toHaveBeenCalledTimes(1);expect(battle).not.toHaveBeenCalled();f.command.mockClear();
      input<HTMLInputElement>(f.root,'Faction destination X').dispatchEvent(new KeyboardEvent('keydown',{code:'KeyA',altKey:true,bubbles:true}));expect(f.command).not.toHaveBeenCalled();const modal=document.createElement('section');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');document.body.append(modal);document.body.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyA',altKey:true,bubbles:true}));expect(f.command).not.toHaveBeenCalled();modal.remove();
      f.bindings.warChantAssault='Alt+KeyB';f.tools.update();document.body.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyA',altKey:true,bubbles:true}));expect(f.command).not.toHaveBeenCalled();document.body.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyB',altKey:true,bubbles:true}));await settled();expect(f.command).toHaveBeenCalledTimes(1);
    }finally{window.removeEventListener('keydown',battle);}
  });
  it('serializes pending commands and reports host rejection',async()=>{
    const f=setup();let resolve!:(result:boolean)=>void;f.command.mockImplementation(()=>new Promise<boolean>(done=>{resolve=done;}));button(f.root,'warChantAssault').click();button(f.root,'warChantBulwark').dispatchEvent(new MouseEvent('click',{bubbles:true}));expect(f.command).toHaveBeenCalledTimes(1);expect(button(f.root,'warChantBulwark').disabled).toBe(true);resolve(false);await settled();expect(f.root.textContent).toContain('The command was rejected.');expect(button(f.root,'warChantAssault').disabled).toBe(false);
  });
  it('suppresses late results after match replacement and disposal',async()=>{
    const f=setup();let reject!:(error:Error)=>void;f.command.mockImplementation(()=>new Promise<boolean>((_done,fail)=>{reject=fail;}));button(f.root,'warChantAssault').click();f.replaceState(createFactionFixture('fairies').state);reject(new Error('Old match failed'));await settled();expect(f.root.textContent).not.toContain('Old match failed');
    f.replaceState(f.state);f.select([f.soldier.id]);let resolve!:(result:boolean)=>void;f.command.mockImplementation(()=>new Promise<boolean>(done=>{resolve=done;}));button(f.root,'warChantAssault').click();f.tools.dispose();resolve(true);await settled();expect(f.root.children).toHaveLength(0);
  });
  it('shows only the current faction and clears stale target choices after replacement',()=>{
    const f=setup('undead');expect(button(f.root,'recruitCorpseWagon').closest('[hidden]')).toBeNull();expect(button(f.root,'warChantAssault').closest('[hidden]')).not.toBeNull();f.replaceState(createFactionFixture('orcs').state);expect(button(f.root,'warChantAssault').closest('[hidden]')).toBeNull();expect(input<HTMLSelectElement>(f.root,'Visible corpse').value).toBe('');
    f.tools.close();expect(f.root.querySelector('[data-faction-launch]')!.getAttribute('aria-expanded')).toBe('false');f.tools.open();expect(f.root.querySelector('[data-faction-launch]')!.getAttribute('aria-expanded')).toBe('true');
  });
});
