import { readFileSync, writeFileSync } from 'node:fs';
import { loadGame, saveGame } from '../../src/core/saves';
import { captureRuntime, isGameOver, stepGame } from '../../src/core/simulation';
const s=loadGame(readFileSync(process.argv[2]??'work/ai-timeouts/small-orcs-undead/final.json','utf8')),start=s.time;
const banks=s.players.map(p=>({wood:p.wood,ore:p.ore,crystal:p.crystal}));
const gathered=s.players.map(()=>({wood:0,ore:0,crystal:0}));
let attacks=0;
for(let tick=0;tick<20*10*60&&!isGameOver(s);tick++){stepGame(s,.05);attacks+=s.events.filter(e=>e.type==='attack').length;for(const e of s.events)if(e.type==='gather'&&e.resource&&e.amount)gathered[e.side][e.resource]+=e.amount;}
writeFileSync(process.argv[3]??'work/ai-timeouts/recovered.json',JSON.stringify(saveGame(s)));
console.log(JSON.stringify({secondsAfterImport:s.time-start,winner:s.winner,draw:s.draw,attacks,banksUnchanged:JSON.stringify(banks)===JSON.stringify(s.players.map(p=>({wood:p.wood,ore:p.ore,crystal:p.crystal}))),resourceChanges:s.players.map((p,i)=>({wood:p.wood-banks[i].wood,ore:p.ore-banks[i].ore,crystal:p.crystal-banks[i].crystal})),gathered,gainsMatchGathering:s.players.every((p,i)=>(['wood','ore','crystal'] as const).every(kind=>Math.abs(p[kind]-banks[i][kind]-gathered[i][kind])<1e-7)),players:s.players,retreating:captureRuntime(s).retreating}));
if(!isGameOver(s))process.exitCode=1;
