// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { createGame } from '../src/core/simulation';
import type { FactionId, MapSize, UnitRole } from '../src/core/types';
import { mountShell, type HudCallbacks } from '../src/ui/Hud';

afterEach(()=>{vi.restoreAllMocks();document.body.replaceChildren();});

const factions=Object.keys(FACTIONS) as FactionId[];
const callbacks={isMuted:()=>false,groups:()=>({}),cameraCorners:()=>[]} as unknown as HudCallbacks;

function mount(){
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect:()=>{}} as unknown as CanvasRenderingContext2D);
  const root=document.createElement('div');document.body.append(root);
  let shell:ReturnType<typeof mountShell>;
  const onStart=vi.fn((faction:FactionId,_opponent:FactionId,_mapSize:MapSize,_seed:number)=>shell.showGame(faction));
  shell=mountShell(root,onStart);
  return {root,shell,onStart};
}

describe('faction game chrome',()=>{
  it.each(factions)('carries the %s menu choice into the match banner',faction=>{
    const {root,onStart}=mount();
    expect(root.hasAttribute('data-ui-faction')).toBe(false);

    root.querySelector<HTMLButtonElement>(`[data-faction="${faction}"]`)!.click();
    root.querySelector<HTMLButtonElement>('.begin-match')!.click();

    expect(onStart).toHaveBeenCalledWith(faction,'fairies','medium',4127);
    expect(root.dataset.uiFaction).toBe(faction);
    expect(root.querySelector('#faction-name')!.textContent).toBe(FACTIONS[faction].name);
    expect(root.querySelector<HTMLImageElement>('#banner-portrait')!.getAttribute('src')).toBe(`/assets/portrait-${faction}.png`);
  });

  it('applies an explicit faction and matching banner as soon as gameplay opens',()=>{
    const {root,shell}=mount();

    shell.showGame('undead');

    expect(root.dataset.uiFaction).toBe('undead');
    expect(root.querySelector('#faction-name')!.textContent).toBe(FACTIONS.undead.name);
    expect(root.querySelector<HTMLImageElement>('#banner-portrait')!.getAttribute('src')).toBe('/assets/portrait-undead.png');
  });

  it('uses the player faction when the selected unit belongs to the opponent',()=>{
    const {root,shell}=mount();
    const state=createGame('fairies',4127,'tideborn');
    const enemy=state.entities.find(e=>e.side===1&&e.kind==='unit')!;
    state.visible[0].add(Math.floor(enemy.y)*state.width+Math.floor(enemy.x));
    shell.showGame('orcs');

    shell.update(state,[enemy.id],callbacks);

    expect(root.dataset.uiFaction).toBe('fairies');
    expect(root.querySelector('#faction-name')!.textContent).toBe(FACTIONS.fairies.name);
    expect(root.querySelector<HTMLImageElement>('#banner-portrait')!.getAttribute('src')).toBe('/assets/portrait-fairies.png');
    expect(root.querySelector('#selection-name')!.textContent).toBe(FACTIONS.tideborn.units[enemy.role as UnitRole].name);
  });

  it('resets to a neutral menu and uses the next card choice for another match',()=>{
    const {root,shell}=mount();

    shell.showGame('dwarves');
    shell.showMenu();
    expect(root.hasAttribute('data-ui-faction')).toBe(false);
    expect(root.querySelector('.war-menu')!.hasAttribute('hidden')).toBe(false);

    root.querySelector<HTMLButtonElement>('[data-faction="automata"]')!.click();
    shell.showGame();

    expect(root.dataset.uiFaction).toBe('automata');
    expect(root.querySelector('#faction-name')!.textContent).toBe(FACTIONS.automata.name);
    expect(root.querySelector<HTMLImageElement>('#banner-portrait')!.getAttribute('src')).toBe('/assets/portrait-automata.png');
  });

  it('keeps the shared tooltip and technology dialog inside the faction host',()=>{
    const {root,shell}=mount();
    shell.showGame('fairies');

    const tooltip=root.querySelector('#command-tooltip');
    const dialog=root.querySelector('dialog.technology-tree');
    expect(tooltip).not.toBeNull();
    expect(dialog).not.toBeNull();
    expect(root.contains(tooltip)).toBe(true);
    expect(root.contains(dialog)).toBe(true);
  });
});
