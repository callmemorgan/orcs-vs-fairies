import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createGame, captureRuntime, isGameOver, stepGame } from '../../src/core/simulation';
import { saveGame } from '../../src/core/saves';
import type { FactionId, MapSize } from '../../src/core/types';

const cases:[MapSize,FactionId,FactionId][]=[['small','orcs','undead'],['small','automata','dwarves'],['small','automata','automata'],['medium','orcs','orcs'],['medium','fairies','fairies'],['medium','dwarves','automata'],['medium','undead','orcs'],['medium','undead','dwarves']];
const folder=process.env.AI_RECOVERY_OUTPUT??'work/ai-timeouts/regression';mkdirSync(folder,{recursive:true});
it.each(cases)('finishes the reported %s %s vs %s timeout through actual play',(mapSize,faction,opponent)=>{
 const s=createGame(faction,4127,opponent,{controllers:['ai','ai'],mapSize});let lastAttack=0;const attacks=[0,0],recruits=[0,0];
 for(let tick=0;tick<45*60*20&&!isGameOver(s);tick++){
  stepGame(s,.05);for(const event of s.events){if(event.type==='attack'){attacks[event.side]++;lastAttack=s.time;}if(event.type==='train')recruits[event.side]++;}
  expect(s.players.every(p=>p.wood>=0&&p.ore>=0&&p.crystal>=0)).toBe(true);
 }
 const envelope=JSON.stringify(saveGame(s)),report={seed:4127,mapSize,faction,opponent,time:s.time,winner:s.winner,draw:s.draw,timeout:!isGameOver(s),lastAttack,attacks,recruits,players:s.players,remainingRetreats:captureRuntime(s).retreating.map(r=>r.length),saveSha256:createHash('sha256').update(envelope).digest('hex')};
 writeFileSync(`${folder}/${mapSize}-${faction}-${opponent}.json`,JSON.stringify(report,null,2));writeFileSync(`${folder}/${mapSize}-${faction}-${opponent}-save.json`,envelope);
 expect(attacks.every(count=>count>10)).toBe(true);expect(isGameOver(s)).toBe(true);
},120_000);
