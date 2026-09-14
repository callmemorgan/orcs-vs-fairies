// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { createGame, issueCommand } from '../src/core/simulation';
import { mountShell, type HudCallbacks } from '../src/ui/Hud';

afterEach(()=>{vi.restoreAllMocks();document.body.replaceChildren();});

it('disguises enemy doubles in selection health, group totals and roster tooltips without changing simulation health',()=>{
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect:()=>{}} as unknown as CanvasRenderingContext2D);
  const root=document.createElement('div');document.body.append(root);
  const shell=mountShell(root,()=>{});shell.showGame();
  const callbacks={isMuted:()=>false,groups:()=>({}),cameraCorners:()=>[]} as unknown as HudCallbacks;
  const s=createGame('orcs',4127,'fairies',{controllers:['external','external']});
  const caster=s.entities.find(e=>e.side===1&&e.role==='melee')!;
  caster.role='special';caster.hp=caster.maxHp=FACTIONS.fairies.units.special.hp;
  expect(issueCommand(s,1,{type:'ability',ids:[caster.id]})).toBe(true);
  const clones=s.entities.filter(e=>e.illusion);
  for(const e of [caster,...clones])s.visible[0].add(Math.floor(e.y)*s.width+Math.floor(e.x));
  const clone=clones[0],rawMax=clone.maxHp;
  shell.update(s,[clone.id],callbacks);
  expect(root.querySelector('#selection-status')!.textContent).toContain('105 / 105 health');
  clone.hp=rawMax/2;
  shell.update(s,[clone.id],callbacks);
  expect(root.querySelector('#selection-status')!.textContent).toContain('53 / 105 health');
  expect(root.querySelector<HTMLElement>('#health-fill')!.style.width).toBe('50%');
  shell.update(s,[caster.id,clone.id],callbacks);
  expect(root.querySelector('#selection-status')!.textContent).toBe('158 / 210 group health');
  expect(root.querySelector<HTMLElement>(`[data-id="${clone.id}"]`)!.dataset.tooltip).toContain('53 / 105 health');
  expect(clone.hp).toBe(21);expect(clone.maxHp).toBe(42);
  // Owner-side doubles retain their true health in the same panel.
  clone.side=0;
  shell.update(s,[clone.id],callbacks);
  expect(root.querySelector('#selection-status')!.textContent).toContain('21 / 42 health');
});
