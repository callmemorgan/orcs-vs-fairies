#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { TerminalSession, replayMatch, type ReplayEntry } from './session';
const args=process.argv.slice(2);
function option(name:string){const i=args.indexOf(name);if(i<0)return undefined;if(!args[i+1]||args[i+1].startsWith('--'))throw new Error(`${name} requires a path.`);return args[i+1];}
if(args.includes('--help')){
 console.log('RTS terminal protocol: newline-delimited JSON on stdin/stdout.\nOperations: start, observe, command, advance, result.\n--log PATH writes replay entries (must be a new file).\n--replay PATH verifies a saved replay.\nSee docs/TERMINAL_AGENTS.md.');
}else{
 try{
  const replay=option('--replay'),log=option('--log');
  if(args.some((a,i)=>i%2===0&&!['--log','--replay'].includes(a)))throw new Error('Unknown option.');
  if(replay){if(log)throw new Error('Use --replay or --log.');const entries=readFileSync(replay,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l) as ReplayEntry);console.log(JSON.stringify(replayMatch(entries)));}
  else{
   if(log)writeFileSync(log,'',{flag:'wx'});
   const session=new TerminalSession();
   const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
   for await(const line of lines){
    if(!line.trim())continue;
    try{
     if(Buffer.byteLength(line)>1024*1024)throw new Error('Request exceeds 1 MiB.');
     const response=session.handle(JSON.parse(line));
     if(log)appendFileSync(log,JSON.stringify(session.replay.at(-1))+'\n');
     console.log(JSON.stringify(response));
    }catch(error){console.log(JSON.stringify({ok:false,error:error instanceof Error?error.message:String(error)}));}
   }
  }
 }catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
}
