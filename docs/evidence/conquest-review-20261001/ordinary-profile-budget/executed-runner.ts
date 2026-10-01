import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createConquestProfile, proposeConquest, prepareConquestBattle, completeConquestBattle, decodeConquestProfile } from '/tmp/conquest-carryover-review/fixed-source/src/core/conquest';
import { issueScenarioCommand, stepScenario } from '/tmp/conquest-carryover-review/fixed-source/src/core/scenarios';
const root = '/tmp/conquest-ordinary-aggregate-review';
const privateDir = join(root, 'private');
const recordingDir = join(privateDir, 'recordings');
mkdirSync(recordingDir, { recursive: true });
const nodes = (value: unknown): number => value !== null && typeof value === 'object' ? 1 + Object.values(value).reduce((sum: number, child) => sum + nodes(child), 0) : 1;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
let profile = createConquestProfile('undead', 'ordinary-aggregate-budget-proof');
profile = proposeConquest(profile, { type:'tribute', faction:'fairies', amount:250 });
profile = proposeConquest(profile, { type:'alliance', faction:'fairies' });
const checks = new Set([220,230,240,250,254]);
const checkpointResults: Array<Record<string,unknown>> = [];
const battles: Array<Record<string,unknown>> = [];
const started = Date.now();
for (let battle=1; battle<=254; battle++) {
 const run = prepareConquestBattle(profile, 'grove', 'passage');
 assert(issueScenarioCommand(run.session, 0, { type:'move', ids:[run.session.runtime.labels.commander], x:29, y:16 }), 'one exit move rejected');
 while (run.session.runtime.outcome === 'playing') stepScenario(run.session);
 assert.equal(run.session.runtime.outcome, 'won');
 const recording=run.recorder.archive(); run.recorder.destroy();
 assert.equal(recording.commands.length, 1);
 profile=completeConquestBattle(run.profile, run.session, recording);
 const recordingText=JSON.stringify(recording);
 writeFileSync(join(recordingDir, `battle-${String(battle).padStart(3,'0')}.json`), recordingText+'\n');
 battles.push({ battle, tick:recording.finalTick, commands:recording.commands.length, recordingBytes:Buffer.byteLength(recordingText), recordingNodes:nodes(recording), recordingSha256:sha256(recordingText+'\n'), history:profile.history.length });
 if (battle===1 || battle%25===0) console.log(JSON.stringify({progress:battle,history:profile.history.length,elapsedMs:Date.now()-started}));
 if (checks.has(battle)) {
  const text=JSON.stringify(profile);
  writeFileSync(join(privateDir, `battle-${battle}-profile.json`), text);
  let reload='passed';
  try { decodeConquestProfile(text); } catch (error) { reload=(error as Error).message; }
  const result={ battle, history:profile.history.length, profileBytes:Buffer.byteLength(text), profileNodes:nodes(profile), oneCommandPerBattle:true, reload, elapsedMs:Date.now()-started };
  checkpointResults.push(result); console.log(JSON.stringify(result));
  writeFileSync(join(root,'summary.json'), JSON.stringify({sourceRevision:'031dd2f3685443f090dbc47d262aff1d725e77ba',geometryDependencyRevision:'d1171b9',oneCommandPerBattle:true,battles: battles.length,checkpointResults,recordings:battles}, null,2)+'\n');
  if (reload!=='passed') break;
 }
}
