import { expect,it } from 'vitest';
import { generateMap,MAP_SIZES,validateMap } from '../src/core/maps';
import { createGame,issueCommand,stepGame } from '../src/core/simulation';
import { PlayerView } from '../src/core/observation';
import type { MapSize } from '../src/core/types';
import type { MapLayout } from '../src/improvements/maps/layouts';
const layouts:MapLayout[]=['plains','river','mountain'];
const options=(layout:MapLayout)=>({'feature-061':{layout}});
it.each(layouts)('keeps %s connected and reproducible for every size',layout=>{
 for(const size of Object.keys(MAP_SIZES) as MapSize[])for(let seed=0;seed<20;seed++){
  const map=generateMap(seed,size,options(layout));
  expect(validateMap(map).issues,`${layout}/${size}/${seed}`).toEqual([]);
  if(seed===0)expect(map).toEqual(generateMap(seed,size,options(layout)));
 }
},30000);
it('changes both geography and roads while leaving unselected generation intact',()=>{
 const original=generateMap(4127),empty=generateMap(4127,'medium',{});
 expect(original).toEqual(empty);
 const maps=layouts.map(layout=>generateMap(4127,'medium',options(layout))),[plains,river,mountain]=maps;
 expect(plains.terrain).not.toContain('water');
 expect(river.terrain).toContain('bridge');
 for(let y=river.height/2-2;y<river.height/2+2;y++)for(let x=1;x<river.width-1;x++)expect(['water','bridge']).toContain(river.terrain[y*river.width+x]);
 expect(mountain.terrain.filter(t=>t==='rock').length).toBeGreaterThan(plains.terrain.filter(t=>t==='rock').length);
 for(let i=0;i<maps.length;i++)for(let j=i+1;j<maps.length;j++){
  expect(maps[i].terrain).not.toEqual(maps[j].terrain);
  expect(maps[i].terrain.map(t=>t==='road')).not.toEqual(maps[j].terrain.map(t=>t==='road'));
 }
 expect(plains.resources).toEqual(original.resources);
});
it.each(layouts)('starts a playable %s match with the same preview',layout=>{
 const improvements=options(layout),preview=generateMap(4127,'small',improvements);
 const game=createGame('orcs',4127,'fairies',{mapSize:'small',controllers:['human','external'],improvements});
 expect(game.terrain).toEqual(preview.terrain);
 expect(new PlayerView(0).observe(game).improvements?.['feature-061']).toEqual({layout});
 const troop=game.entities.find(e=>e.side===0&&e.role==='melee')!;
 const initial={x:troop.x,y:troop.y};
 expect(issueCommand(game,0,{type:'move',ids:[troop.id],x:18,y:18})).toBe(true);
 for(let i=0;i<20;i++)stepGame(game,.25);
 expect(Math.hypot(troop.x-initial.x,troop.y-initial.y)).toBeGreaterThan(2);
});
it('rejects unknown layouts before spawning a match',()=>{
 expect(()=>createGame('orcs',1,'fairies',{improvements:{'feature-061':{layout:'bogus'}}})).toThrow('Choose plains');
});
