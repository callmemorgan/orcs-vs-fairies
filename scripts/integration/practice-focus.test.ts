// @vitest-environment happy-dom
import {expect,it,vi} from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class {}}}));
import GameScene from '../../src/game/GameScene';
import {mountShell} from '../../src/ui/Hud';
import {mountImprovementHost} from '../../src/improvements/host';
import clients from '../../src/improvements/learning/client';
import {createGame} from '../../src/core/simulation';

it('reproduces blocked practice ability input after selecting mission troops, with a canvas control',()=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect:()=>{}} as unknown as CanvasRenderingContext2D);
 const root=document.createElement('div');document.body.append(root);let scene:any;
 const shell=mountShell(root,(faction,opponent,size,seed,options)=>{
  scene=Object.create(GameScene.prototype);
  Object.assign(scene,{state:createGame(faction,seed,opponent,{...options,mapSize:size}),selected:[],paused:false,options:{onSelection:vi.fn(),onNotice:vi.fn()},audio:{play:vi.fn()},cameras:{main:{centerOn:vi.fn()}}});
  shell.showGame(faction);host.matchStart();
 },()=>host.options());
 const host=mountImprovementHost(root,clients,{current:()=>scene,notice:shell.notice,setPaused:value=>{scene.paused=value;}});
 root.querySelector<HTMLSelectElement>('#learning-mode')!.value='practice';root.querySelector<HTMLButtonElement>('.begin-match')!.click();
 const button=root.querySelector<HTMLButtonElement>('.practice-focus')!;button.focus();button.click();
 const actor=scene.state.entities.find((e:any)=>scene.selected.includes(e.id))!;
 expect(document.activeElement).toBe(button);expect(actor.role).toBe('melee');
 const key=(target:HTMLElement)=>{const event=new KeyboardEvent('keydown',{key:'q',code:'KeyQ',bubbles:true,cancelable:true});target.addEventListener('keydown',(e)=>scene.key(e),{once:true});target.dispatchEvent(event);return event.defaultPrevented;};
 const blockedPrevented=key(button);const blockedMomentum=actor.momentum;
 expect(blockedMomentum).toBe(0);expect(blockedPrevented).toBe(false);
 const canvas=document.createElement('canvas');canvas.tabIndex=0;root.querySelector('#game-canvas')!.append(canvas);canvas.focus();
 const controlPrevented=key(canvas);expect(actor.momentum).toBeGreaterThan(0);expect(controlPrevented).toBe(true);
 console.log(JSON.stringify({practiceButtonRetainedFocus:true,blockedMomentum,canvasMomentum:actor.momentum,blockedPrevented,controlPrevented}));
 host.dispose();document.body.replaceChildren();
});
