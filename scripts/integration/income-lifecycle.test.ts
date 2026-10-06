// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {createGame,refreshVisibility,stepGame,issueCommand} from '../../src/core/simulation';
import {PlayerView} from '../../src/core/observation';
import {mountShell} from '../../src/ui/Hud';
import {mountImprovementHost} from '../../src/improvements/host';
import learning from '../../src/improvements/learning/client';
import hud from '../../src/improvements/hud/client';
afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();});
it('captures a deposit on the same accepted tick that destroys the last enemy HQ',()=>{
 const game=createGame('orcs',4127,'fairies',{controllers:['external','external'],improvements:{'feature-022':true}}),hq=game.entities.find(e=>e.side===0&&e.role==='hq')!,worker=game.entities.find(e=>e.side===0&&e.role==='worker')!,fighter=game.entities.find(e=>e.side===0&&e.role==='melee')!,enemy=game.entities.find(e=>e.side===1&&e.role==='hq')!;
 game.entities=[hq,worker,fighter,enemy];game.terrain.fill('grass');worker.x=hq.x+1.9;worker.y=hq.y;worker.carried=18;worker.carriedKind='wood';const node=game.resources.find(e=>e.kind==='wood')!;node.amount=0;worker.order={type:'gather',target:node.id};enemy.x=fighter.x+1;enemy.y=fighter.y;enemy.hp=1;fighter.order={type:'hold'};refreshVisibility(game);
 const before=game.players[0].wood;stepGame(game,.05);expect(game.winner).toBe(0);expect(game.tick).toBe(1);expect(game.events.some(e=>e.type==='gather'&&e.amount===18)).toBe(true);expect(game.events.some(e=>e.type==='death'&&e.source===enemy.id)).toBe(true);expect(game.players[0].wood-before).toBe(18);
 expect(new PlayerView(0).observe(game).improvements?.['feature-022']).toEqual({windowSeconds:60,income:{wood:18,ore:0,crystal:0}});const frozen=JSON.stringify(game.improvements);stepGame(game,.05);expect(game.tick).toBe(1);expect(JSON.stringify(game.improvements)).toBe(frozen);
});
it('keeps deposit income until the exact sixty-second boundary',()=>{
 const game=createGame('orcs',4127,'fairies',{controllers:['external','external'],improvements:{'feature-022':true}}),hq=game.entities.find(e=>e.side===0&&e.role==='hq')!,worker=game.entities.find(e=>e.side===0&&e.role==='worker')!;
 game.entities=game.entities.filter(e=>e.kind==='building'||e===worker);game.terrain.fill('grass');worker.x=hq.x+1.9;worker.y=hq.y;worker.carried=18;const node=game.resources.find(e=>e.kind==='wood')!;node.amount=0;worker.order={type:'gather',target:node.id};refreshVisibility(game);
 stepGame(game,.25);expect(issueCommand(game,0,{type:'stop',ids:[worker.id]})).toBe(true);const view=new PlayerView(0),income=()=>((view.observe(game).improvements!['feature-022'] as any).income.wood);expect(income()).toBe(18);
 for(let i=0;i<239;i++)stepGame(game,.25);expect(game.time).toBe(60);expect(income()).toBe(18);stepGame(game,.25);expect(game.time).toBe(60.25);expect(income()).toBe(0);
});
it('keeps learning cards and combined worker/income labels fresh across practice/tutorial/skirmish restarts',()=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect:()=>{}} as unknown as CanvasRenderingContext2D);const root=document.createElement('div');document.body.append(root);let scene:any;
 const shell=mountShell(root,(faction,opponent,size,seed,options)=>{scene={state:createGame(faction,seed,opponent,{...options,mapSize:size}),selected:[],paused:false,selectEntities:(ids:number[])=>{scene.selected=ids;},centerOn:vi.fn()};shell.showGame(faction);host.matchStart();},()=>host.options());
 const host=mountImprovementHost(root,[...learning,...hud],{current:()=>scene,notice:shell.notice,setPaused:p=>{scene.paused=p;}}),mode=root.querySelector<HTMLSelectElement>('#learning-mode')!;
 for(const selected of ['practice','practice','tutorial','skirmish']){
  mode.value=selected;root.querySelector<HTMLButtonElement>('.begin-match')!.click();expect(mode.querySelectorAll('option[value="practice"]')).toHaveLength(1);expect(root.querySelectorAll('[data-income]')).toHaveLength(3);expect(root.querySelectorAll('.hud-worker-count')).toHaveLength(3);
  expect(root.querySelector<HTMLElement>('[aria-label="Faction practice"]')!.hidden).toBe(selected!=='practice');expect(root.querySelector<HTMLElement>('[aria-label="Tutorial"]')!.hidden).toBe(selected!=='tutorial');for(const label of root.querySelectorAll('[data-income]'))expect(label.textContent).toBe('+0/min');
  const progress=scene.state.improvements?.['feature-002']?.state as any;if(selected==='practice'){expect(progress.mechanic).toBe(false);expect(progress.battleStarted).toBe(false);expect(progress.complete).toBe(false);expect(issueCommand(scene.state,0,{type:'ability',ids:[progress.actor]})).toBe(true);stepGame(scene.state,.25);host.update();expect(progress.mechanic).toBe(true);}
  host.showMenu();expect(root.querySelector<HTMLElement>('[aria-label="Faction practice"]')!.hidden).toBe(true);expect(root.querySelector<HTMLElement>('[aria-label="Tutorial"]')!.hidden).toBe(true);
 }
 host.dispose();expect(root.querySelectorAll('[data-income]')).toHaveLength(0);expect(root.querySelectorAll('.hud-worker-count')).toHaveLength(0);
});
