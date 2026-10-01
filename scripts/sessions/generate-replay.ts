import { mkdirSync, writeFileSync } from 'node:fs';
import { createGame, stepGame, isGameOver } from '../../src/core/simulation';
import { MatchRecorder } from '../../src/core/replays';

const state=createGame('orcs',4127,'fairies',{mapSize:'small',controllers:['ai','ai']});
const recorder=new MatchRecorder(state);
for(let i=0;i<54_000&&!isGameOver(state);i++)stepGame(state,.05);
if(!isGameOver(state))throw new Error('Replay fixture match did not finish within 45 minutes.');
const archive=recorder.export();recorder.dispose();
mkdirSync('work/hundred-features',{recursive:true});
writeFileSync(process.argv[2]??'work/hundred-features/current-replay.json',JSON.stringify(archive));
console.log(JSON.stringify({winner:state.winner,draw:state.draw,time:state.time,tick:state.tick,samples:archive.analysis.length,technologies:archive.technologies.length}));
