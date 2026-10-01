// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMatch, refreshVisibility, issueCommand, spawnDefinition } from '../src/core/simulation';
import type { Side } from '../src/core/types';
import { canAmbush, isCrewless } from '../src/core/tactics';
import type { TacticsCommand } from '../src/core/tactics';
import { mountTacticsTools } from '../src/ui/TacticsTools';
import type { TacticsAction } from '../src/ui/TacticsTools';
import { advanceTacticsFixture, createTacticsFixture } from '../scripts/tactics/fixture-state';

const mounted:ReturnType<typeof mountTacticsTools>[]=[];
afterEach(()=>{for(const tools of mounted.splice(0))tools.dispose();document.body.replaceChildren();vi.restoreAllMocks();});
function setup(){
  const fixture=createTacticsFixture(),root=document.createElement('div');document.body.append(root);
  let selected=fixture.army.map(item=>item.id),permission:boolean|string=true;
  let state:typeof fixture.state|null=fixture.state;
  let side:Side=0;
  const bindings:Partial<Record<TacticsAction,string>>={};
  const command=vi.fn<(value:TacticsCommand)=>boolean|Promise<boolean>>((value)=>!!state&&issueCommand(state,side,value));
  const tools=mountTacticsTools(root,{state:()=>state,selected:()=>selected,side:()=>side,command,enabled:()=>permission,keyFor:action=>bindings[action]});mounted.push(tools);tools.open();
  return {...fixture,root,tools,command,bindings,select(ids:number[]){selected=ids;tools.update();},permission(value:boolean|string){permission=value;tools.update();},replaceState(value:typeof fixture.state|null){state=value;tools.update();},setSide(value:Side){side=value;tools.update();}};
}
function button(root:HTMLElement,action:TacticsAction){return root.querySelector<HTMLButtonElement>(`[data-tactics-action="${action}"]`)!;}
function input<T extends HTMLInputElement|HTMLSelectElement>(root:HTMLElement,label:string){return root.querySelector<T>(`[aria-label="${label}"]`)!;}
async function settled(){await Promise.resolve();await Promise.resolve();}

describe('live army tactics panel',()=>{
  it('shows the registered commander name for its special role',()=>{
    const f=setup(), hero=spawnDefinition(f.state,0,'unit','core:orcs-commander',15,15);
    f.select([hero.id]);expect(f.root.querySelector('[aria-label="Selected unit tactics"]')!.textContent).toContain(`Gorak Ironvoice #${hero.id}`);
  });
  it.each(['Line','Wedge','Square','Loose'] as const)('applies %s through a real formation command to selected owned army',async label=>{
    const f=setup(),workerOrder=structuredClone(f.worker.order),enemyOrder=structuredClone(f.enemy.order);
    f.select([...f.army.map(item=>item.id),f.worker.id,f.enemy.id]);
    input<HTMLSelectElement>(f.root,'Troop facing').value='6';input<HTMLInputElement>(f.root,'Formation spacing').value='1.5';
    button(f.root,`formation${label}`).click();await settled();
    expect(f.command).toHaveBeenCalledWith({type:'formation',ids:f.army.map(item=>item.id),formation:label.toLowerCase(),facing:6,spacing:1.5});
    for(const unit of f.army){expect(unit.tactics?.formation?.kind).toBe(label.toLowerCase());expect(unit.tactics?.formation?.facing).toBe(6);}
    expect(f.worker.order).toEqual(workerOrder);expect(f.enemy.order).toEqual(enemyOrder);
    advanceTacticsFixture(f.state,.5);f.tools.update();
    expect(f.root.textContent).toContain(label.toLowerCase());expect(f.root.textContent).toContain('Morale');
  });
  it('applies facing to workers and troops without commanding a foreign selection',async()=>{
    const f=setup();f.select([f.worker.id,f.army[0].id,f.enemy.id]);input<HTMLSelectElement>(f.root,'Troop facing').value='4';button(f.root,'face').click();await settled();
    expect(f.command).toHaveBeenCalledWith({type:'face',ids:[f.worker.id,f.army[0].id],facing:4});expect(f.worker.facing).toBe(4);expect(f.army[0].facing).toBe(4);expect(f.worker.order.type).toBe('hold');
  });
  it('sets the chosen ambush condition only for selected troops in real tree concealment and releases it',async()=>{
    const f=setup(),concealed=f.army.filter(item=>canAmbush(f.state,item));expect(concealed.length).toBeGreaterThan(0);expect(concealed.length).toBeLessThan(f.army.length);
    input<HTMLInputElement>(f.root,'Ambush trigger radius').value='2.75';input<HTMLSelectElement>(f.root,'Ambush target').value='cavalry';button(f.root,'ambush').click();await settled();
    expect(f.command).toHaveBeenCalledWith({type:'ambush',ids:concealed.map(item=>item.id),radius:2.75,target:'cavalry'});
    for(const unit of concealed){expect(unit.tactics?.ambush).toMatchObject({radius:2.75,target:'cavalry',concealed:true});expect(unit.order.type).toBe('hold');}
    expect(f.army.filter(item=>!concealed.includes(item)).every(item=>!item.tactics?.ambush)).toBe(true);
    expect(f.root.textContent).toContain('outside concealment');button(f.root,'releaseAmbush').click();await settled();expect(concealed.every(item=>!item.tactics?.ambush)).toBe(true);
  });
  it('captures a visible abandoned engine through real channel completion',async()=>{
    const f=setup();f.select([f.worker.id]);expect(button(f.root,'captureSiege').disabled).toBe(false);button(f.root,'captureSiege').click();await settled();
    expect(f.command).toHaveBeenCalledWith({type:'captureSiege',ids:[f.worker.id],target:f.engine.id});expect(f.worker.tactics?.capture?.target).toBe(f.engine.id);
    advanceTacticsFixture(f.state,6);f.tools.update();expect(f.engine.side).toBe(0);expect(isCrewless(f.engine)).toBe(false);expect(f.engine.definitionFaction).toBe('fairies');
    expect(input<HTMLSelectElement>(f.root,'Abandoned siege engine').value).toBe('');expect(button(f.root,'captureSiege').disabled).toBe(true);
  });
  it('shows normalized capture progress from the running simulation',async()=>{
    const f=setup();f.select([f.worker.id]);button(f.root,'captureSiege').click();await settled();advanceTacticsFixture(f.state,2);f.tools.update();
    expect(f.worker.tactics?.capture?.progress).toBeCloseTo(.5);expect(f.root.querySelector('[aria-label="Selected unit tactics"]')!.textContent).toContain(`Capturing #${f.engine.id} · 50%`);
  });
  it('keeps hidden abandoned engines out of the picker and rejects retained stale choices',()=>{
    const f=setup();f.select([f.worker.id]);const picker=input<HTMLSelectElement>(f.root,'Abandoned siege engine');expect(picker.value).toBe(String(f.engine.id));
    f.engine.x=f.state.width-2;f.engine.y=f.state.height-2;refreshVisibility(f.state);button(f.root,'captureSiege').click();
    expect(f.command).not.toHaveBeenCalled();f.tools.update();expect(picker.value).toBe('');expect(f.root.textContent).not.toContain(`Engine #${f.engine.id}`);
  });
  it('explains empty selections, invalid drafts and missing woodland',()=>{
    const f=setup();f.select([f.worker.id]);expect(button(f.root,'formationLine').disabled).toBe(true);expect(f.root.textContent).toContain('Select owned combat troops');
    f.select(f.army.map(item=>item.id));const spacing=input<HTMLInputElement>(f.root,'Formation spacing');spacing.value='';spacing.dispatchEvent(new Event('input',{bubbles:true}));expect(button(f.root,'formationLine').disabled).toBe(true);expect(f.root.textContent).toContain('spacing must be');
    spacing.value='1';for(const item of f.army){item.x=20;item.y=20;}f.tools.update();expect(button(f.root,'ambush').disabled).toBe(true);expect(f.root.textContent).toContain('woodland');
  });
  it('preserves focused facing, spacing and trigger drafts during live updates',()=>{
    const f=setup(),spacing=input<HTMLInputElement>(f.root,'Formation spacing');spacing.focus();spacing.value='2.35';input<HTMLSelectElement>(f.root,'Troop facing').value='7';input<HTMLSelectElement>(f.root,'Ambush target').value='spear';f.select([f.army[1].id]);
    expect(document.activeElement).toBe(spacing);expect(spacing.value).toBe('2.35');expect(input<HTMLSelectElement>(f.root,'Troop facing').value).toBe('7');expect(input<HTMLSelectElement>(f.root,'Ambush target').value).toBe('spear');
  });
  it('rechecks current permission before dispatch and disables controls for ended matches',()=>{
    const f=setup();f.permission('Replay is read-only.');expect(button(f.root,'formationLine').disabled).toBe(true);expect(f.root.textContent).toContain('Replay is read-only.');
    button(f.root,'formationLine').dispatchEvent(new MouseEvent('click',{bubbles:true}));expect(f.command).not.toHaveBeenCalled();f.permission(true);f.state.winner=0;f.tools.update();expect(button(f.root,'formationLine').disabled).toBe(true);expect(f.root.textContent).toContain('match has ended');
  });
  it('uses live profile chords, prevents battlefield bubbling, and ignores fields and other modals',async()=>{
    const f=setup();f.bindings.formationLine='Alt+KeyL';f.tools.update();expect(button(f.root,'formationLine').textContent).toContain('Alt+L');const battle=vi.fn();window.addEventListener('keydown',battle);
    try{document.body.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyL',key:'l',altKey:true,bubbles:true,cancelable:true}));await settled();expect(f.command).toHaveBeenCalledTimes(1);expect(battle).not.toHaveBeenCalled();
      f.command.mockClear();const spacing=input<HTMLInputElement>(f.root,'Formation spacing');spacing.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyL',key:'l',altKey:true,bubbles:true}));expect(f.command).not.toHaveBeenCalled();
      const hidden=document.createElement('div');hidden.hidden=true;hidden.innerHTML='<section role="dialog" aria-modal="true"></section>';document.body.append(hidden);const modal=document.createElement('section');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');document.body.append(modal);document.body.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyL',altKey:true,bubbles:true}));expect(f.command).not.toHaveBeenCalled();
    }finally{window.removeEventListener('keydown',battle);}
  });
  it('reports rejected commands and prevents overlapping requests until the host settles',async()=>{
    const f=setup();let resolve!:(result:boolean)=>void;f.command.mockImplementation(()=>new Promise<boolean>(done=>{resolve=done;}));button(f.root,'formationLine').click();expect(button(f.root,'formationWedge').disabled).toBe(true);button(f.root,'formationWedge').dispatchEvent(new MouseEvent('click',{bubbles:true}));expect(f.command).toHaveBeenCalledTimes(1);resolve(false);await settled();expect(f.root.textContent).toContain('command was rejected');expect(button(f.root,'formationLine').disabled).toBe(false);
  });
  it('does not publish a late result after disposal and removes profile listeners',async()=>{
    const f=setup();let resolve!:(result:boolean)=>void;f.command.mockImplementation(()=>new Promise<boolean>(done=>{resolve=done;}));button(f.root,'formationLine').click();f.tools.dispose();resolve(true);await settled();expect(f.root.children).toHaveLength(0);document.body.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyL',altKey:true,bubbles:true}));expect(f.command).toHaveBeenCalledTimes(1);
  });
  it('commands only the current eighth player after replacing the displayed match',async()=>{
    const f=setup(),state=createMatch({map:{seed:4127,size:'small'},players:Array.from({length:8},(_,id)=>({id:id as Side,teamId:(id%2) as Side,factionId:'orcs',controller:'external'}))});
    const owned=state.entities.find(item=>item.side===7&&item.role==='melee')!,foreign=state.entities.find(item=>item.side===0&&item.role==='melee')!;
    f.replaceState(state);f.setSide(7);f.select([owned.id,foreign.id]);button(f.root,'formationSquare').click();await settled();
    expect(f.command).toHaveBeenLastCalledWith({type:'formation',ids:[owned.id],formation:'square',spacing:1,facing:2});expect(owned.tactics?.formation?.kind).toBe('square');expect(foreign.tactics?.formation).toBeUndefined();
  });
  it('reads profile binding changes without retaining the previous shortcut',async()=>{
    const f=setup();f.bindings.formationLine='Alt+KeyL';f.tools.update();f.bindings.formationLine='Alt+KeyT';f.tools.update();
    document.body.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyL',altKey:true,bubbles:true}));expect(f.command).not.toHaveBeenCalled();
    document.body.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyT',altKey:true,bubbles:true}));await settled();expect(f.command).toHaveBeenCalledTimes(1);expect(button(f.root,'formationLine').textContent).toContain('Alt+T');
  });
  it('keeps a late host failure from appearing in a replacement match',async()=>{
    const f=setup();let reject!:(error:Error)=>void;f.command.mockImplementation(()=>new Promise<boolean>((_resolve,fail)=>{reject=fail;}));button(f.root,'formationLine').click();
    const replacement=createTacticsFixture();f.replaceState(replacement.state);f.select(replacement.army.map(item=>item.id));reject(new Error('Old match failed'));await settled();
    expect(f.root.textContent).not.toContain('Old match failed');expect(button(f.root,'formationLine').disabled).toBe(false);
  });
});
