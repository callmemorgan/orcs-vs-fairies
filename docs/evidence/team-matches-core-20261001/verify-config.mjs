import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createMatch } from './frozen.mjs';

const method=JSON.parse(readFileSync(new URL('./2v2-method.json',import.meta.url),'utf8'));
const mutations=[
 ['map.size',c=>{c.map.size=null;}],
 ['startingSlot',c=>{c.players[0].startingSlot=null;}],
 ['incomeFactor',c=>{c.players[0].handicap={incomeFactor:null};}],
 ['populationCap',c=>{c.players[0].handicap={populationCap:null};}],
 ['startingAge',c=>{c.rules.startingAge=null;}],
 ['sparse players',c=>{delete c.players[1];}]
];
const checks=mutations.map(([name,mutate])=>{
 const config=structuredClone(method.config);mutate(config);
 let failure;try{createMatch(config);}catch(error){failure=error;}
 assert(failure?.constructor===Error,name+' must reject with a deliberate validation error');
 if(name==='sparse players')assert.equal(failure.message,'Player slots cannot contain gaps.');
 return {name,rejected:true,error:failure.message};
});
const result={sourceSha:method.sourceSha,checks};
writeFileSync(new URL('./config-edge-verification.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
