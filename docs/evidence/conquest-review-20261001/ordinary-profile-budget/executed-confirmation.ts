import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createConquestProfile, prepareConquestBattle, completeConquestBattle, decodeConquestProfile } from '/tmp/conquest-carryover-review/fixed-source/src/core/conquest';
import type { ConquestProfile } from '/tmp/conquest-carryover-review/fixed-source/src/core/conquest-types';
import { issueScenarioCommand, stepScenario } from '/tmp/conquest-carryover-review/fixed-source/src/core/scenarios';
import { scenarioJson } from '/tmp/conquest-carryover-review/fixed-source/src/core/scenario-validation';
let profile = JSON.parse(readFileSync('/tmp/conquest-ordinary-aggregate-review/private/battle-230-profile.json','utf8')) as ConquestProfile;
const nodes = (value: unknown): number => value !== null && typeof value === 'object' ? 1 + Object.values(value).reduce((sum: number, child) => sum + nodes(child), 0) : 1;
const rows=[];
for (let battle=231; battle<=234; battle++) {
 const run=prepareConquestBattle(profile,'grove','passage');
 assert(issueScenarioCommand(run.session,0,{type:'move',ids:[run.session.runtime.labels.commander],x:29,y:16}));
 while(run.session.runtime.outcome==='playing') stepScenario(run.session);
 assert.equal(run.session.runtime.outcome,'won');
 const recording=run.recorder.archive(); run.recorder.destroy(); assert.equal(recording.commands.length,1);
 profile=completeConquestBattle(run.profile,run.session,recording);
 const text=JSON.stringify(profile), parsed=JSON.parse(text);
 let budget='passed'; try {scenarioJson(parsed,{maxBytes:30*1024*1024,maxNodes:1_500_000,maxArrayLength:100_000});}catch(error){budget=(error as Error).message;}
 let reload: string | undefined;
 if(battle===234){try{decodeConquestProfile(text);reload='passed';}catch(error){reload=(error as Error).message;}writeFileSync('/tmp/conquest-ordinary-aggregate-review/private/first-overflow-profile.json',text);}
 rows.push({battle,history:profile.history.length,profileBytes:Buffer.byteLength(text),profileNodes:nodes(parsed),jsonBudget:budget,...(reload?{reload}:{}),commands:recording.commands.length});
}
writeFileSync('/tmp/conquest-ordinary-aggregate-review/first-overflow.json',JSON.stringify({sourceRevision:'031dd2f3685443f090dbc47d262aff1d725e77ba',continuedFromAcceptedSavedBattle:230,rows},null,2)+'\n');
console.log(JSON.stringify(rows));
