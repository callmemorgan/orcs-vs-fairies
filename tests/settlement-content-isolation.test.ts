import { expect, it } from 'vitest';
import { FACTIONS, UPGRADES } from '../src/core/content';
import { effectiveUnitStats } from '../src/core/progression';
import { PlayerView } from '../src/core/observation';
import { createGame, issueCommand, stepGame } from '../src/core/simulation';
import { TerminalSession, stateHash } from '../src/cli/session';
import { MILITARY_UPGRADES } from '../src/improvements/settlement/military';

const game=(improvements?:Record<string,boolean>)=>createGame('orcs',4127,'fairies',{controllers:['external','external'],improvements});

it('ordinary → researched military match → ordinary preserves definitions and deterministic ordinary state',()=>{
 const content=JSON.stringify({FACTIONS,UPGRADES});
 const ordinary=game();
 const improved=game({'feature-041':true});
 Object.assign(improved.players[0],{wood:2000,ore:2000,crystal:200,upgrades:['town-age']});
 const barracks={...improved.entities[0],id:improved.nextId++,role:'barracks' as const,x:20,y:20,queue:[],path:[]};improved.entities.push(barracks);
 expect(issueCommand(improved,0,{type:'research',id:barracks.id,upgrade:'ranged-drills'})).toBe(true);
 for(let i=0;i<UPGRADES['ranged-drills'].researchTime*20+2;i++)stepGame(improved,.05);
 expect(effectiveUnitStats(improved.players[0],'ranged').damage).toBeCloseTo(FACTIONS.orcs.units.ranged.damage*1.2);
 const after=game();
 expect(stateHash(after)).toBe(stateHash(ordinary));
 expect(effectiveUnitStats(after.players[0],'ranged')).toEqual(effectiveUnitStats(ordinary.players[0],'ranged'));
 expect(JSON.stringify({FACTIONS,UPGRADES})).toBe(content);
 expect(new PlayerView(0).observe(after).content).toEqual(new PlayerView(0).observe(ordinary).content);
});
it('observations omit disabled definitions and include active military research for either player',()=>{
 for(const enabled of [false,true]){
  const s=game(enabled?{'feature-041':true}:undefined);
  for(const side of [0,1] as const){const view=new PlayerView(side).observe(s);
   expect(Object.keys(view.content.upgrades)).toHaveLength(enabled?12:7);
   for(const upgrade of MILITARY_UPGRADES)expect(Object.hasOwn(view.content.upgrades,upgrade.id)).toBe(enabled);
   expect(Object.hasOwn(view.content.upgrades,'worker-harvest')).toBe(true);
  }
 }
});
it('the built terminal protocol filters disabled content in ordinary → improved → ordinary sessions',()=>{
 const start=(improvements?:Record<string,boolean>)=>new TerminalSession().handle({op:'start',side:0,faction:'orcs',opponent:'fairies',seed:4127,improvements}) as {result:ReturnType<PlayerView['observe']>};
 const before=start(),improved=start({'feature-041':true}),after=start();
 expect(after).toEqual(before);
 for(const def of MILITARY_UPGRADES){expect(before.result.content.upgrades).not.toHaveProperty(def.id);expect(improved.result.content.upgrades).toHaveProperty(def.id);}
});

it.each(MILITARY_UPGRADES)('rejects inactive $name at an otherwise eligible ordinary barracks without charging',def=>{
 const s=game();
 Object.assign(s.players[0],{wood:3000,ore:3000,crystal:300,upgrades:['town-age','citadel-age']});
 const barracks={...s.entities[0],id:s.nextId++,role:'barracks' as const,x:20,y:20,queue:[],path:[]};s.entities.push(barracks);
 const treasury=[s.players[0].wood,s.players[0].ore,s.players[0].crystal];
 expect(issueCommand(s,0,{type:'research',id:barracks.id,upgrade:def.id})).toBe(false);
 expect(barracks.research).toBeUndefined();
 expect([s.players[0].wood,s.players[0].ore,s.players[0].crystal]).toEqual(treasury);
});
