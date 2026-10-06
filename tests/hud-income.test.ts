// @vitest-environment happy-dom
import {expect,it} from 'vitest';
import {createGame,issueCommand,refreshVisibility,stepGame} from '../src/core/simulation';
import {PlayerView} from '../src/core/observation';
import {stepImprovements} from '../src/core/improvements';
import income from '../src/improvements/hud/income';
import type {ClientContext,PlayerObservation} from '../src/improvements/host';

it('captures deposited amounts on every tick, excludes spending/refunds and expires the sixty-second window',()=>{
 const game=createGame('orcs',4127,'fairies',{controllers:['external','external'],improvements:{'feature-022':true}});
 const worker=game.entities.find(e=>e.side===0&&e.role==='worker')!,hq=game.entities.find(e=>e.side===0&&e.role==='hq')!;
 game.entities=game.entities.filter(e=>e.kind==='building'||e===worker);game.terrain.fill('grass');hq.x=18.5;hq.y=20.5;worker.x=21.5;worker.y=20.5;
 const node={id:game.nextId++,kind:'crystal' as const,x:23.5,y:20.5,amount:8,maxAmount:8};game.resources=[node];refreshVisibility(game);
 expect(issueCommand(game,0,{type:'gather',ids:[worker.id],target:node.id})).toBe(true);
 for(let i=0;i<400;i++)stepGame(game,.05);
 const view=new PlayerView(0);let state:PlayerObservation={...view.observe(game),events:view.events(game)};
 expect(state.improvements?.['feature-022']).toEqual({windowSeconds:60,income:{wood:0,ore:0,crystal:8}});
 const root=document.createElement('div');root.innerHTML='<b id="wood"></b><b id="ore"></b><b id="crystal"></b>';
 const instance=income.mount({root,get state(){return state;}} as unknown as ClientContext);instance.update();expect(root.querySelector('[data-income="crystal"]')!.textContent).toBe('+8/min');
 expect(issueCommand(game,0,{type:'train',id:hq.id,role:'worker'})).toBe(true);expect(issueCommand(game,0,{type:'cancelTrain',id:hq.id,index:0})).toBe(true);
 stepGame(game,.05);state={...view.observe(game),events:[]};expect(state.improvements?.['feature-022']).toEqual({windowSeconds:60,income:{wood:0,ore:0,crystal:8}});
 for(let i=0;i<1300;i++)stepGame(game,.05);state={...view.observe(game),events:[]};instance.update();expect(root.querySelector('[data-income="crystal"]')!.textContent).toBe('+0/min');instance.dispose();
});

it('exposes only the observing side income and restarts cleanly',()=>{
 const game=createGame('orcs',4127,'fairies',{improvements:{'feature-022':true}});
 game.events=[{type:'gather',side:0,x:2,y:3,amount:18,resource:'wood'},{type:'gather',side:1,x:30,y:30,amount:12,resource:'ore'}];stepImprovements(game,.05);
 expect(new PlayerView(0).observe(game).improvements?.['feature-022']).toEqual({windowSeconds:60,income:{wood:18,ore:0,crystal:0}});
 expect(new PlayerView(1).observe(game).improvements?.['feature-022']).toEqual({windowSeconds:60,income:{wood:0,ore:12,crystal:0}});
 const fresh=createGame('orcs',4127,'fairies',{improvements:{'feature-022':true}});expect(new PlayerView(0).observe(fresh).improvements?.['feature-022']).toEqual({windowSeconds:60,income:{wood:0,ore:0,crystal:0}});
});
