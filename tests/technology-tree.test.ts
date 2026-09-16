// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { createGame, issueCommand, stepGame } from '../src/core/simulation';
import type { UpgradeId } from '../src/core/types';
import { mountShell, type HudCallbacks } from '../src/ui/Hud';
afterEach(()=>{vi.restoreAllMocks();document.body.replaceChildren();});
it('researches through the global tree without requiring a selected headquarters',()=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect:()=>{}} as unknown as CanvasRenderingContext2D);
 const root=document.createElement('div');document.body.append(root);const shell=mountShell(root,()=>{});shell.showGame();
 const s=createGame('orcs',4127,'fairies',{controllers:['human','human']});
 const callbacks={isMuted:()=>false,groups:()=>({}),cameraCorners:()=>[],research:(upgrade:UpgradeId,id?:number)=>issueCommand(s,0,{type:'research',id:id!,upgrade})} as unknown as HudCallbacks;
 shell.update(s,[],callbacks);root.querySelector<HTMLButtonElement>('#technology-button')!.click();
 const button=(id:string)=>root.querySelector<HTMLButtonElement>(`[data-technology="${id}"]`)!;
 expect(button('citadel-age').disabled).toBe(true);expect(button('citadel-age').textContent).toContain('Requires Town Age');
 expect(button('town-age').disabled).toBe(false);button('town-age').click();shell.update(s,[],callbacks);
 expect(s.players[0].wood).toBe(160);expect(button('town-age').textContent).toContain('Researching');
 for(let i=0;i<660;i++)stepGame(s,.1);shell.update(s,[],callbacks);
 expect(root.querySelector('.objective-tag')!.textContent).toContain('Town Age');
 expect(button('town-age').textContent).toContain('Already researched');
 expect(button('citadel-age').textContent).toContain('Not enough resources');
 shell.showMenu();expect(root.querySelector<HTMLDialogElement>('dialog')!.open).toBe(false);
});
it('keeps mixed selection commands within two rows and exposes age unlock reasons',()=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect:()=>{}} as unknown as CanvasRenderingContext2D);
 const root=document.createElement('div');document.body.append(root);const shell=mountShell(root,()=>{});shell.showGame();
 const s=createGame('orcs',4127,'fairies',{controllers:['human','human']});
 const barracks=s.entities.find(e=>e.side===0&&e.role==='hq')!;barracks.role='barracks';
 const worker=s.entities.find(e=>e.side===0&&e.role==='worker')!;
 const cb={isMuted:()=>false,groups:()=>({}),cameraCorners:()=>[]} as unknown as HudCallbacks;
 const selected=[barracks.id,worker.id],buttons=()=>root.querySelectorAll('#action-buttons button');
 shell.update(s,selected,cb);expect(buttons()).toHaveLength(6);
 root.querySelector<HTMLButtonElement>('[data-mode="recruit"]')!.click();shell.update(s,selected,cb);
 expect(buttons()).toHaveLength(6);
 const cavalry=root.querySelector<HTMLButtonElement>('[aria-label="Boar Rider"]')!;
 expect(cavalry.getAttribute('aria-disabled')).toBe('true');expect(cavalry.dataset.tooltip).toContain('Requires Town Age');
 s.players[0].upgrades.push('town-age');shell.update(s,selected,cb);expect(cavalry.getAttribute('aria-disabled')).toBe('false');
 root.querySelector<HTMLButtonElement>('[data-mode="orders"]')!.click();shell.update(s,selected,cb);
 expect(buttons()).toHaveLength(3);expect(root.querySelector('[aria-label="Attack move"]')).not.toBeNull();
});

it('shows researched combat stats for owned troops without exposing enemy research',()=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect:()=>{}} as unknown as CanvasRenderingContext2D);
 const root=document.createElement('div');document.body.append(root);const shell=mountShell(root,()=>{});shell.showGame();
 const s=createGame('orcs',4127,'fairies',{controllers:['human','human']});
 const own=s.entities.find(e=>e.side===0&&e.role==='melee')!;
 const enemy=s.entities.find(e=>e.side===1&&e.role==='melee')!;
 s.players[0].upgrades.push('forged-weapons','veteran-arms','tempered-armor');
 s.players[1].upgrades.push('forged-weapons','tempered-armor');
 s.visible[0].add(Math.floor(enemy.y)*s.width+Math.floor(enemy.x));
 const cb={isMuted:()=>false,groups:()=>({}),cameraCorners:()=>[]} as unknown as HudCallbacks;
 shell.update(s,[own.id],cb);
 expect(root.querySelector('#selection-stats')!.textContent).toContain('ATK 22.5');
 expect(root.querySelector('#selection-stats')!.textContent).toContain('ARM 5');
 shell.update(s,[enemy.id],cb);
 expect(root.querySelector('#selection-stats [title*="enemy research is private"]')).not.toBeNull();
 expect(root.querySelector('#selection-stats')!.textContent).not.toContain('ARM 3');
});
