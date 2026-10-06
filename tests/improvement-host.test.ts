// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { createGame } from '../src/core/simulation';
import { mountImprovementHost } from '../src/improvements/host';
import type { ClientContext, ClientScene } from '../src/improvements/host';

afterEach(()=>document.body.replaceChildren());
it('uses the current match, protects hidden information and cleans up mounted controls',()=>{
  const root=document.createElement('main');root.innerHTML='<div class="menu-content"></div><div class="war-hud"></div>';document.body.append(root);
  let context!:ClientContext;
  const update=vi.fn(),matchStart=vi.fn(),matchEnd=vi.fn(),menu=vi.fn(),dispose=vi.fn(),center=vi.fn(),select=vi.fn(),notice=vi.fn();
  let scene:ClientScene|undefined={state:createGame('orcs'),selected:[],paused:false,selectEntities:select,centerOn:center};
  const host=mountImprovementHost(root,[{id:'test-ui',mount:ctx=>{context=ctx;ctx.menu.textContent='Match option';ctx.hud.textContent='Battle control';return {update,matchStart,matchEnd,menu,dispose,readOptions:()=>({enabled:true})};}}],{current:()=>scene,notice,setPaused:value=>{scene!.paused=value;}});
  expect(context.state).toBeNull();host.showMenu();expect(menu).toHaveBeenCalledTimes(1);
  expect(host.options()).toEqual({improvements:{'test-ui':{enabled:true}}});
  host.matchStart();expect(matchStart).toHaveBeenCalledTimes(1);
  const worker=scene.state.entities.find(e=>e.side===0&&e.role==='worker')!;
  const enemy=scene.state.entities.find(e=>e.side===1)!;
  expect(context.state!.entities.some(e=>e.id===enemy.id)).toBe(false);
  context.state!.player.upgrades.push('worker-speed');expect(scene.state.players[0].upgrades).toEqual([]);
  expect(context.command({type:'hold',ids:[enemy.id]})).toBe(false);
  expect(context.command({type:'hold',ids:[worker.id]})).toBe(true);expect(worker.order.type).toBe('hold');
  context.setPaused(true);expect(scene.paused).toBe(true);expect(context.command({type:'stop',ids:[worker.id]})).toBe(false);
  context.select([worker.id]);expect(select).toHaveBeenCalledWith([worker.id]);context.center(NaN,2);expect(center).not.toHaveBeenCalled();context.center(2,3);expect(center).toHaveBeenCalledWith(2,3);
  context.notice('Ready');expect(notice).toHaveBeenCalledWith('Ready');
  const next=createGame('fairies');scene={...scene,state:next,selected:[next.entities[1].id],paused:false};host.matchStart();
  expect(context.state!.player.faction).toBe('fairies');expect(context.selected).toEqual([next.entities[1].id]);
  next.winner=0;host.update();host.update();expect(matchEnd).toHaveBeenCalledTimes(1);expect(matchEnd).toHaveBeenCalledWith('result');
  scene=undefined;host.showMenu();expect(context.state).toBeNull();expect(context.selected).toEqual([]);expect(context.command({type:'stop',ids:[]})).toBe(false);
  host.dispose();expect(dispose).toHaveBeenCalledTimes(1);expect(root.querySelectorAll('[data-improvement]').length).toBe(0);
});
it('reports a match abandoned for the menu and leaves matches without clients untouched',()=>{
  const root=document.createElement('main');root.innerHTML='<div class="menu-content"></div><div class="war-hud"></div>';
  const state=createGame('orcs'),matchEnd=vi.fn();
  const scene={state,selected:[],paused:false,selectEntities:()=>{},centerOn:()=>{}};
  const actions={current:()=>scene,notice:()=>{},setPaused:()=>{}};
  const host=mountImprovementHost(root,[{id:'test',mount:()=>({matchEnd})}],actions);host.matchStart();host.showMenu();host.showMenu();expect(matchEnd).toHaveBeenCalledTimes(1);expect(matchEnd).toHaveBeenCalledWith('menu');
  const empty=mountImprovementHost(root,[],actions);empty.update();expect(empty.options()).toEqual({});expect(state.improvements).toBeUndefined();
});

it('passes menu settings through the shell and keeps extension pause controls in sync',async()=>{
  const {mountShell}=await import('../src/ui/Hud');
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect:()=>{}} as unknown as CanvasRenderingContext2D);
  const root=document.createElement('div');document.body.append(root);
  const onStart=vi.fn(),scene={state:createGame('orcs'),selected:[],paused:false,selectEntities:()=>{},centerOn:()=>{}};
  let context!:ClientContext;
  const shell=mountShell(root,onStart,()=>host.options());
  const host=mountImprovementHost(root,[{id:'menu-test',mount:ctx=>{context=ctx;return {readOptions:()=>({enabled:true})};}}],{current:()=>scene,notice:shell.notice,setPaused:value=>{scene.paused=value;shell.setPaused(value);}});
  root.querySelector<HTMLButtonElement>('.begin-match')!.click();
  expect(onStart).toHaveBeenCalledWith('orcs','fairies','medium',4127,{improvements:{'menu-test':{enabled:true}}});
  shell.showGame();context.setPaused(true);
  const callbacks={isMuted:()=>false,groups:()=>({}),cameraCorners:()=>[]} as unknown as import('../src/ui/Hud').HudCallbacks;
  shell.update(scene.state,[],callbacks);
  expect(scene.paused).toBe(true);expect(root.querySelector('#overlay-title')!.textContent).toBe('Battle paused');expect(root.querySelector<HTMLElement>('.game-overlay')!.hidden).toBe(false);
  context.setPaused(false);shell.update(scene.state,[],callbacks);expect(root.querySelector<HTMLElement>('.game-overlay')!.hidden).toBe(true);
  host.dispose();vi.restoreAllMocks();
});
