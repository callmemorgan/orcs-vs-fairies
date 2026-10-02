import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const sourcePath=new URL('../source/verify_assembled_online.83941bc.mjs',import.meta.url);
const candidatePath=new URL('../candidate/verify_assembled_online.mjs',import.meta.url);
const source=await readFile(sourcePath,'utf8'),candidate=await readFile(candidatePath,'utf8');
const originalLine='    if(privateSides.includes(player))assert.deepEqual(render.players[player],disclosedPlayers.get(player),`Private player ${player} must match its authorized server view`);';
const candidateBlock=`    if(privateSides.includes(player)) {
      const privatePlayer={...render.players[player]};if(privatePlayer.heroRecovery===undefined)delete privatePlayer.heroRecovery;
      assert.deepEqual(privatePlayer,disclosedPlayers.get(player),\`Private player \${player} must match its authorized server view\`);
    }`;
assert.equal(source.split(originalLine).length-1,1,'The pinned source must contain the original assertion once.');
assert.equal(candidate,source.replace(originalLine,candidateBlock),'Only the qualified assertion block may differ from the pinned source.');

/** @typedef {{faction:string,wood:number,ore:number,crystal:number,population:number,cap:number,heroRecovery?:Array<{definitionId:string,availableAt:number}>,upgrades:string[],[key:string]:unknown}} PrivatePlayer */
/** @param {PrivatePlayer} player */
function comparablePrivatePlayer(player){
  const copy={...player};
  if(copy.heroRecovery===undefined)delete copy.heroRecovery;
  return copy;
}

const diagnosticExpected={faction:'orcs',wood:420,ore:220,crystal:0,population:6,cap:12,upgrades:[]};
const diagnosticActual={faction:'orcs',wood:420,ore:220,crystal:0,population:6,cap:12,heroRecovery:undefined,upgrades:[]};
const passed=[];
function pass(label,actual,expected){assert.deepEqual(comparablePrivatePlayer(actual),expected,label);passed.push(label);}
function reject(label,actual,expected){assert.throws(()=>assert.deepEqual(comparablePrivatePlayer(actual),expected));passed.push(label);}

const wirePlayer=JSON.parse(JSON.stringify(diagnosticActual));
assert.equal(Object.hasOwn(wirePlayer,'heroRecovery'),false);assert.deepEqual(wirePlayer,diagnosticExpected);
passed.push('JSON serialization omits an object key whose value is undefined');
pass('preserved diagnostic accepts only undefined heroRecovery omission',diagnosticActual,diagnosticExpected);
assert.equal(Object.hasOwn(diagnosticActual,'heroRecovery'),true,'Qualification must not mutate the render player.');
pass('already omitted heroRecovery remains accepted',{...diagnosticExpected},diagnosticExpected);
const recovery=[{definitionId:'core:orcs-commander',availableAt:42}];
pass('defined heroRecovery remains strict',{...diagnosticExpected,heroRecovery:recovery},{...diagnosticExpected,heroRecovery:[...recovery]});
reject('defined heroRecovery cannot match an omitted key',{...diagnosticExpected,heroRecovery:recovery},diagnosticExpected);
reject('defined heroRecovery content mismatch is rejected',{...diagnosticExpected,heroRecovery:recovery},{...diagnosticExpected,heroRecovery:[{...recovery[0],availableAt:43}]});
reject('null heroRecovery is not treated as undefined',{...diagnosticExpected,heroRecovery:null},diagnosticExpected);
reject('another private field mismatch is rejected',{...diagnosticActual,wood:421},diagnosticExpected);
reject('another undefined key is retained and rejected',{...diagnosticActual,otherOptional:undefined},diagnosticExpected);
reject('an extra defined key is retained and rejected',{...diagnosticActual,otherPrivate:true},diagnosticExpected);
reject('a missing ordinary key is rejected',(({ore:_,...rest})=>rest)(diagnosticActual),diagnosticExpected);

const sha256=value=>createHash('sha256').update(value).digest('hex');
console.log(JSON.stringify({
  kind:'pure-node-optional-field-qualification',
  productRuntimeImported:false,
  sourceSha256:sha256(source),
  candidateSha256:sha256(candidate),
  exactSourceReplacement:true,
  cases:passed,
  passed:passed.length,
},null,2));
