import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createGame, captureRuntime, isGameOver, stepGame } from '../../src/core/simulation';
import { saveGame } from '../../src/core/saves';
import type { FactionId, MapSize } from '../../src/core/types';
const faction=(process.argv[2]??'orcs') as FactionId,opponent=(process.argv[3]??'undead') as FactionId,mapSize=(process.argv[4]??'small') as MapSize;
const s=createGame(faction,4127,opponent,{controllers:['ai','ai'],mapSize}),folder=`work/ai-timeouts/${mapSize}-${faction}-${opponent}`;
mkdirSync(folder,{recursive:true});let lastAttack=0,lastSave=0;const traces:unknown[]=[];
for(let tick=0;tick<45*60*20&&!isGameOver(s);tick++){
 stepGame(s,.05);if(s.events.some(e=>e.type==='attack'))lastAttack=s.time;
 if(s.time-lastSave>=150){
  const runtime=captureRuntime(s),owned=s.players.map((_,side)=>s.entities.filter(e=>e.side===side&&e.hp>0));
  traces.push({time:s.time,secondsWithoutCombat:s.time-lastAttack,players:structuredClone(s.players),workers:owned.map(es=>es.filter(e=>e.role==='worker').map(e=>({id:e.id,order:e.order,hp:e.hp}))),queue:owned.map(es=>es.filter(e=>e.queue.length).map(e=>({id:e.id,queue:e.queue,progress:e.trainProgress}))),armies:owned.map(es=>es.filter(e=>e.kind==='unit'&&e.role!=='worker').map(e=>({id:e.id,role:e.role,hp:e.hp,order:e.order}))),retreats:runtime.retreating,produced:runtime.producedFighters});
  writeFileSync(`${folder}/${Math.round(s.time)}.json`,JSON.stringify(saveGame(s)));lastSave=s.time;
 }
}
const save=JSON.stringify(saveGame(s));writeFileSync(`${folder}/final.json`,save);writeFileSync(`${folder}/trace.json`,JSON.stringify(traces,null,2));
console.log(JSON.stringify({mapSize,faction,opponent,time:s.time,winner:s.winner,lastAttack,players:s.players,retreating:captureRuntime(s).retreating,queues:s.entities.filter(e=>e.queue.length).map(e=>({id:e.id,queue:e.queue})),sha256:createHash('sha256').update(save).digest('hex')}));
