import { expect, it } from 'vitest';
import { walkable } from '../src/core/navigation';
import { PlayerView } from '../src/core/observation';
import { createGame, issueCommand, stepGame, canPlace, isVisible } from '../src/core/simulation';
import type { TutorialProgress } from '../src/improvements/learning/tutorial-rule';
function advance(game:ReturnType<typeof createGame>,seconds:number){for(let i=0;i<seconds*4;i++)stepGame(game,.25);}
const battle={type:'improvement' as const,improvement:'feature-001',action:'battle',ids:[]};
function tutorial(seed:number){const game=createGame('orcs',seed,'fairies',{improvements:{'feature-001':{}}});return {game,state:game.improvements!['feature-001'].state as TutorialProgress};}
it('plays harvesting, construction, recruitment and a real first battle through validated commands',()=>{
 const {game,state}=tutorial(4127);
 expect(game.controllers[1]).toBe('external');
 expect(issueCommand(game,0,battle)).toBe(false);expect(issueCommand(game,1,battle)).toBe(false);
 const worker=game.entities.find(e=>e.side===0&&e.role==='worker')!;
 const wood=game.resources.find(e=>e.kind==='wood'&&isVisible(game,0,e.x,e.y))!;
 expect(issueCommand(game,0,{type:'gather',ids:[worker.id],target:wood.id})).toBe(true);advance(game,60);expect(state.gathered).toBeGreaterThanOrEqual(18);
 let site:{x:number;y:number}|undefined;
 for(let y=3;y<17&&!site;y++)for(let x=3;x<17;x++)if(canPlace(game,0,'barracks',x+.5,y+.5)){site={x:x+.5,y:y+.5};break;}
 expect(site).toBeDefined();expect(issueCommand(game,0,{type:'build',ids:[worker.id],role:'barracks',...site!})).toBe(true);advance(game,80);expect(state.built).toBe(true);
 const barracks=game.entities.find(e=>e.side===0&&e.role==='barracks')!;
 expect(issueCommand(game,0,{type:'train',id:barracks.id,role:'melee'})).toBe(true);advance(game,40);expect(state.recruited).toBe(true);
 expect(issueCommand(game,0,battle)).toBe(true);expect(issueCommand(game,0,battle)).toBe(false);
 const target=game.entities.find(e=>e.id===state.target)!;
 const army=game.entities.filter(e=>e.side===0&&e.role==='melee');
 expect(issueCommand(game,0,{type:'attack',ids:army.map(e=>e.id),target:target.id})).toBe(true);advance(game,50);expect(state.complete).toBe(true);
 expect(JSON.parse(JSON.stringify(game.improvements))).toEqual(game.improvements);
 expect(new PlayerView(0).observe(game).improvements?.['feature-001']).toEqual(state);
 expect(new PlayerView(1).observe(game).improvements?.['feature-001']).toBeNull();
});
it('does not change an ordinary skirmish',()=>{expect(createGame('orcs').controllers[1]).toBe('ai');});

it('places the first fight on visible walkable ground across seeds',()=>{
 for(const seed of [0,1,42,1977,4127,4294967295]){
  const {game,state}=tutorial(seed);
  Object.assign(state,{gathered:18,built:true,recruited:true});
  expect(issueCommand(game,0,battle)).toBe(true);
  const target=game.entities.find(e=>e.id===state.target)!;expect(walkable(game,target.x,target.y)).toBe(true);expect(isVisible(game,0,target.x,target.y)).toBe(true);
 }
});
