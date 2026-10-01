import { writeFileSync } from 'node:fs';
import { createContentBundle } from '../../src/core/content-registry';
import { exampleMod } from '../../src/core/example-mod';
import { canPlace, createMatch, refreshVisibility } from '../../src/core/simulation';
import { walkable } from '../../src/core/navigation';
import { createSessionFile } from '../../src/core/session-storage';
const state=createMatch({content:createContentBundle([exampleMod()]),map:{seed:4127,size:'small'},players:[{id:0,teamId:0,factionId:'lantern:keepers',controller:'human',handicap:{startingResources:{wood:2000,ore:1000,crystal:100}}},{id:1,teamId:1,factionId:'orcs',controller:'external'}]});
const sentinel=state.entities.find(e=>e.definitionId==='lantern:sentinel')!,enemy=state.entities.find(e=>e.side===1&&e.role==='melee')!;
sentinel.hp-=45;enemy.x=22.5;enemy.y=15.5;while(!walkable(state,enemy.x,enemy.y)&&enemy.y<25)enemy.y++;enemy.order={type:'hold'};refreshVisibility(state);
writeFileSync('work/hundred-features/mods/scenario.json',JSON.stringify(createSessionFile(state),null,2));
writeFileSync('work/hundred-features/mods/lantern.json',JSON.stringify(exampleMod(),null,2));

let placement:{x:number;y:number}|undefined;for(let y=11.5;y<16&&!placement;y++)for(let x=2.5;x<16;x++)if(canPlace(state,0,'barracks',x,y,'lantern:hall')){placement={x,y};break;}if(!placement)throw new Error('No valid hall location');writeFileSync('work/hundred-features/mods/placement.json',JSON.stringify(placement));
