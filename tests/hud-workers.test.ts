// @vitest-environment happy-dom
import {expect,it} from 'vitest';
import {createGame,issueCommand,refreshVisibility} from '../src/core/simulation';
import {PlayerView} from '../src/core/observation';
import workers,{assignedWorkers} from '../src/improvements/hud/workers';
import type {ClientContext,PlayerObservation} from '../src/improvements/host';

it('shows gathering assignments beside totals and updates after stop, death and restart',()=>{
 const game=createGame('orcs',4127,'fairies',{controllers:['external','external']});
 const own=game.entities.filter(e=>e.side===0&&e.role==='worker');
 game.resources=own.slice(0,3).map((worker,i)=>({id:game.nextId++,kind:(['wood','ore','crystal'] as const)[i],x:worker.x+.5,y:worker.y,amount:100,maxAmount:100}));refreshVisibility(game);
 own.slice(0,3).forEach((worker,i)=>expect(issueCommand(game,0,{type:'gather',ids:[worker.id],target:game.resources[i].id})).toBe(true));
 const player=new PlayerView(0);let state:PlayerObservation={...player.observe(game),events:player.events(game)};
 const root=document.createElement('div');root.innerHTML='<div><b id="wood"></b></div><div><b id="ore"></b></div><div><b id="crystal"></b></div>';
 const instance=workers.mount({root,get state(){return state;}} as unknown as ClientContext);instance.update();
 expect(assignedWorkers(state)).toEqual({wood:1,ore:1,crystal:1});
 expect(root.querySelector('[data-resource="ore"]')!.textContent).toBe('1 workers');
 issueCommand(game,0,{type:'stop',ids:[own[1].id]});own[2].hp=0;
 state={...player.observe(game),events:player.events(game)};instance.update();expect(assignedWorkers(state)).toEqual({wood:1,ore:0,crystal:0});
 const fresh=createGame('fairies');state={...player.observe(fresh),events:[]};instance.update();expect(root.querySelector('[data-resource="wood"]')!.textContent).toBe('0 workers');
 instance.dispose();expect(root.querySelector('.hud-worker-count')).toBeNull();
});

it('ignores enemy private orders and keeps returning workers counted against their gathering job',()=>{
 const game=createGame('orcs');const own=game.entities.find(e=>e.side===0&&e.role==='worker')!;const enemy=game.entities.find(e=>e.side===1&&e.role==='worker')!;
 const node=game.resources.find(e=>e.kind==='wood')!;own.order={type:'gather',target:node.id};own.carried=18;own.carriedKind='wood';enemy.order={type:'gather',target:node.id};
 game.visible[0].add(Math.floor(node.y)*game.width+Math.floor(node.x));game.visible[0].add(Math.floor(enemy.y)*game.width+Math.floor(enemy.x));
 const view=new PlayerView(0);expect(assignedWorkers({...view.observe(game),events:[]})).toEqual({wood:1,ore:0,crystal:0});
});
