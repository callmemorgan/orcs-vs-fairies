import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createGame,stepGame} from '../../src/core/simulation';
import {PlayerView} from '../../src/core/observation';
import {stateHash} from '../../src/cli/session';
const options={controllers:['ai','external'] as ['ai','external'],mapSize:'small' as const,improvements:{'feature-022':true,'feature-041':true,'feature-051':{},'feature-061':{layout:'river'}}};
const games=[0,1,2].map(()=>createGame('orcs',4127,'fairies',options));
const views=[undefined,new PlayerView(0),new PlayerView(0)];
for(let tick=0;tick<400;tick++)for(let i=0;i<games.length;i++){
 stepGame(games[i],.05);
 if(i===1)views[i]!.observe(games[i]);
 if(i===2)for(let j=0;j<3;j++)views[i]!.observe(games[i]);
}
const hashes=games.map(stateHash);assert.equal(new Set(hashes).size,1);assert.deepEqual(games[0],games[1]);assert.deepEqual(games[1],games[2]);
const result={source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),ticks:400,observerCalls:[0,400,1200],hashes,authoritativeStatesEqual:true,limits:'Current PlayerView resource memory is outside authoritative state; save/restore memory purity must be repeated after sessions091.'};
mkdirSync('work/brainstorm100',{recursive:true});const output=mkdtempSync('work/brainstorm100/verify-observer-purity-');
writeFileSync(`${output}/summary.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
