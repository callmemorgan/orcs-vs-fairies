// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mountShell } from '../src/ui/Hud';
import { mountImprovementHost, type ClientScene } from '../src/improvements/host';
import clients from '../src/improvements/learning/client';
import { createGame, issueCommand, stepGame } from '../src/core/simulation';
import type { PracticeProgress } from '../src/improvements/learning/practice-rule';
afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();});
it('starts only the chosen learning mode, selects mission troops, and updates the practice card from the simulation',()=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect:()=>{}} as unknown as CanvasRenderingContext2D);
 const root=document.createElement('div');document.body.append(root);
 let scene:ClientScene|undefined;const center=vi.fn();
 const shell=mountShell(root,(faction,opponent,size,seed,options)=>{scene={state:createGame(faction,seed,opponent,{...options,mapSize:size}),selected:[],paused:false,selectEntities:ids=>{scene!.selected=ids;},centerOn:center};shell.showGame(faction);host.matchStart();},()=>host.options());
 const host=mountImprovementHost(root,clients,{current:()=>scene,notice:shell.notice,setPaused:value=>{scene!.paused=value;}});
 const mode=root.querySelector<HTMLSelectElement>('#learning-mode')!;mode.value='practice';
 expect(host.options()).toEqual({improvements:{'feature-002':{}}});
 root.querySelector<HTMLButtonElement>('.begin-match')!.click();
 const card=root.querySelector<HTMLElement>('[aria-label="Faction practice"]')!,battle=root.querySelector<HTMLButtonElement>('.practice-battle')!,state=scene!.state.improvements!['feature-002'].state as PracticeProgress;
 expect(card.hidden).toBe(false);expect(card.textContent).toContain('War Cry');
 root.querySelector<HTMLButtonElement>('.practice-focus')!.click();expect(scene!.selected).toEqual([state.actor]);expect(center).toHaveBeenCalled();
 expect(battle.hidden).toBe(true);
 issueCommand(scene!.state,0,{type:'ability',ids:scene!.selected});stepGame(scene!.state,.25);host.update();
 expect(battle.hidden).toBe(false);
 battle.click();expect(state.battleStarted).toBe(true);host.update();expect(card.textContent).toContain('defeat the nearby enemy');
 host.showMenu();expect(card.hidden).toBe(true);mode.value='tutorial';expect(host.options()).toEqual({improvements:{'feature-001':{}}});host.dispose();
});
