import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createContentBundle } from '../../src/core/content-registry';
import { exampleMod } from '../../src/core/example-mod';
import { canPlace, createMatch, refreshVisibility } from '../../src/core/simulation';
import { walkable } from '../../src/core/navigation';
import { createSessionFile, decodeSessionFile } from '../../src/core/session-storage';
import { SAVE_VERSION, saveGame } from '../../src/core/saves';
import { SIMULATION_REVISION } from '../../src/core/versions';
import { worldSourceProof, worldBundleProof, sha, freshWorldOutput } from '../world/proof-common.mjs';
const provenance=await worldSourceProof(process.env.OVF_PRODUCTION_SOURCE_COMMIT??process.env.OVF_SOURCE_PIN),bundle=worldBundleProof(provenance);
const out=resolve(process.argv[2]??process.env.OVF_MOD_FIXTURE_DIR??'work/hundred-features/mod-fixtures');
await freshWorldOutput(out);
function write(name:string,value:unknown){writeFileSync(resolve(out,name),JSON.stringify(value,null,2),{flag:'wx'});}
const state=createMatch({content:createContentBundle([exampleMod()]),map:{seed:4127,size:'small'},players:[{id:0,teamId:0,factionId:'lantern:keepers',controller:'human',handicap:{startingResources:{wood:2000,ore:1000,crystal:100}}},{id:1,teamId:1,factionId:'orcs',controller:'external'}]});
const sentinel=state.entities.find(e=>e.definitionId==='lantern:sentinel')!,enemy=state.entities.find(e=>e.side===1&&e.role==='melee')!;
sentinel.hp-=45;enemy.x=22.5;enemy.y=15.5;while(!walkable(state,enemy.x,enemy.y)&&enemy.y<25)enemy.y++;enemy.order={type:'hold'};refreshVisibility(state);
if(SAVE_VERSION!==4||SIMULATION_REVISION!=='4.0.0')throw new Error('The mod proof requires SAVE4 and simulation revision 4.0.0.');
const session=createSessionFile(state);assert.deepEqual(saveGame(decodeSessionFile(JSON.stringify(session)).state),session.game);write('scenario.json',session);
write('lantern.json',exampleMod());

let placement:{x:number;y:number}|undefined;for(let y=11.5;y<16&&!placement;y++)for(let x=2.5;x<16;x++)if(canPlace(state,0,'barracks',x,y,'lantern:hall')){placement={x,y};break;}if(!placement)throw new Error('No valid hall location');write('placement.json',placement);
assert.deepEqual(await worldSourceProof(provenance.sourcePin),provenance,'Source changed during mod fixture generation');
write('fixture-manifest.json',{...provenance,sourceCommit:provenance.sourcePin,sourceFingerprint:provenance.buildId,bundle,generatorSourceSha256:sha(readFileSync('scripts/mods/scenario.ts')),nativeDecoderPassed:true,completeEnvelopeRoundtripPassed:true,contentHash:state.content?.hash,files:Object.fromEntries(['scenario.json','lantern.json','placement.json'].map(name=>[name,sha(readFileSync(resolve(out,name)))]))});
console.log(JSON.stringify({out,saveVersion:SAVE_VERSION,simulationRevision:SIMULATION_REVISION,contentHash:state.content?.hash}));
