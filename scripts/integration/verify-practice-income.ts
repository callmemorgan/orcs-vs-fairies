import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {TerminalSession} from '../../src/cli/session';
import {PlayerView} from '../../src/core/observation';
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
mkdirSync('work/brainstorm100',{recursive:true});
const base=mkdtempSync('work/brainstorm100/verify-practice-income-');
const outcomes=[];
for(const faction of ['orcs','fairies','dwarves','undead','tideborn','automata']){
 const session=new TerminalSession(),inputs:any[]=[],responses:any[]=[];
 function send(input:any){inputs.push(input);const response:any=session.handle(input);responses.push(JSON.parse(JSON.stringify(response)));assert(response.ok);return response.result;}
 function cmd(command:any,wanted=true){const result=send({op:'command',command});assert.equal(result.accepted,wanted,`${faction}:${JSON.stringify(command)}`);return result;}
 const start=send({op:'start',faction,opponent:'fairies',side:0,mapSize:'small',seed:4127,improvements:{'feature-002':{},'feature-041':true,'feature-022':true,'feature-061':{layout:'river'}}});
 const progress=()=>session.state!.improvements!['feature-002'].state as any;
 assert.equal(Object.keys(start.content.upgrades).length,12);assert.equal(progress().failed,false);
 const battle={type:'improvement',improvement:'feature-002',action:'battle',ids:[]};cmd(battle,false);
 const worker=start.entities.find((e:any)=>e.role==='worker')!;
 const node=start.resources.filter((e:any)=>e.kind==='wood').sort((a:any,b:any)=>Math.hypot(a.x-worker.x,a.y-worker.y)-Math.hypot(b.x-worker.x,b.y-worker.y))[0];
 assert(node);cmd({type:'gather',ids:[worker.id],target:node.id});
 const p=progress();
 if(faction==='undead'){
  const target=start.entities.find((e:any)=>e.id===p.initialTarget)!;assert(target);
  cmd({type:'attack',ids:[p.fighter],target:target.id});send({op:'advance',ticks:300});
  assert.equal(progress().mechanic,false);
  cmd({type:'move',ids:[p.actor],x:target.x-2,y:target.y});send({op:'advance',ticks:300});
 }else if(faction==='automata'){
  send({op:'advance',ticks:400});assert.equal(progress().mechanic,false);
  const fighter=start.entities.find((e:any)=>e.id===p.fighter)!;
  cmd({type:'move',ids:[p.actor],x: fighter.x-6,y:fighter.y+2});send({op:'advance',ticks:400});
 }else{cmd({type:'ability',ids:[p.actor]});send({op:'advance',ticks:faction==='dwarves'?80:20});}
 assert.equal(progress().mechanic,true,`${faction}:mechanic`);
 cmd(battle);cmd(battle,false);
 cmd({type:'attack',ids:[...new Set([p.actor,p.fighter])],target:progress().target});send({op:'advance',ticks:600});
 const final=send({op:'observe'});
 assert.equal(progress().complete,true,`${faction}:completion`);assert.equal(progress().failed,false);
 const privateObservation=new PlayerView(1).observe(session.state!);assert.equal(privateObservation.improvements!['feature-002'],null);
 const income:any=final.improvements['feature-022'];assert(income.income.wood>0,`${faction}:income`);
 assert.deepEqual((privateObservation.improvements!['feature-022'] as any).income,{wood:0,ore:0,crystal:0});
 const dir=`${base}/${faction}`;mkdirSync(dir,{recursive:true});
 const input=inputs.map(v=>JSON.stringify(v)).join('\n')+'\n';writeFileSync(`${dir}/requests.ndjson`,input);
 writeFileSync(`${dir}/session-replay.ndjson`,session.replay.map(v=>JSON.stringify(v)).join('\n')+'\n');
 const cli=spawnSync('node',['dist-cli/rts.js','--log',`${dir}/cli-replay.ndjson`],{input,encoding:'utf8',maxBuffer:16*1024*1024});assert.equal(cli.status,0,cli.stderr);writeFileSync(`${dir}/responses.ndjson`,cli.stdout);
 assert.deepEqual(cli.stdout.trim().split('\n').map(v=>JSON.parse(v)),responses);
 const replay=spawnSync('node',['dist-cli/rts.js','--replay',`${dir}/cli-replay.ndjson`],{encoding:'utf8',maxBuffer:16*1024*1024});assert.equal(replay.status,0,replay.stderr);writeFileSync(`${dir}/cli-verification.json`,replay.stdout);assert.equal(JSON.parse(replay.stdout).verified,inputs.length);
 outcomes.push({faction,complete:progress().complete,tick:session.state!.tick,replayEntries:inputs.length,incomeWood:income.income.wood,otherSidePractice:null,otherSideIncome:{wood:0,ore:0,crystal:0},cliResponsesEqual:true});
}
writeFileSync(`${base}/summary.json`,JSON.stringify({source,outcomes},null,2)+'\n');console.log(JSON.stringify({source,outcomes}));
