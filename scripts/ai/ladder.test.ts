import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { captureRuntime, createMatch, isGameOver, stepGame } from '../../src/core/simulation';
import type { FactionId } from '../../src/core/types';
import type { AiPersonality } from '../../src/core/ai-policy';

const pairs:[FactionId,FactionId,AiPersonality][]=[['orcs','fairies','rush'],['dwarves','undead','fortify'],['tideborn','automata','expand'],['fairies','orcs','raid']];
const folder=process.env.AI_LADDER_OUTPUT??'work/ai-modes/ladder';mkdirSync(folder,{recursive:true});
it.each(pairs.flatMap(([faction,opponent,personality])=>[false,true].map(swapped=>({faction,opponent,personality,swapped}))))('$faction/$personality vs $opponent with swapped slots=$swapped',({faction,opponent,personality,swapped})=>{
 const config={map:{seed:4127,size:'small' as const},players:[{id:0 as const,teamId:0 as const,factionId:faction,controller:'ai' as const,startingSlot:swapped?1:0,ai:{difficulty:'hard' as const,personality}},{id:1 as const,teamId:1 as const,factionId:opponent,controller:'ai' as const,startingSlot:swapped?0:1,ai:{difficulty:'normal' as const,personality:'balanced' as const}}]};
 const s=createMatch(config),trained=[0,0],damage=[0,0],retreats=[0,0],deposits=[0,0],built=[new Set<string>(),new Set<string>()];
 let invalid=false;
 for(let tick=0;tick<45*60*20&&!isGameOver(s);tick++){
  stepGame(s,.05);
  for(const event of s.events){if(event.type==='train')trained[event.side]++;if(event.type==='attack')damage[event.side]+=event.amount??0;if(event.type==='gather')deposits[event.side]+=event.amount??0;if(event.type==='message'&&event.text?.startsWith('Retreating'))retreats[event.side]++;}
  for(const e of s.entities)if(e.kind==='building'&&e.progress===1)built[e.side].add(e.role);
  invalid ||= s.players.some(p=>p.wood<0||p.ore<0||p.crystal<0||p.population>100)||s.entities.some(e=>!Number.isFinite(e.x)||!Number.isFinite(e.y)||e.x<0||e.y<0||e.x>s.width||e.y>s.height);
 }
 const runtime=captureRuntime(s),report={config,seconds:s.time,winner:s.winner,draw:s.draw,timeout:!isGameOver(s),trained,damage,retreats,deposits,built:built.map(b=>[...b]),decisionTurns:runtime.aiDecisionTurns,producedFighters:runtime.producedFighters,remainingRetreats:runtime.retreating.map(a=>a.length),players:s.players};
 writeFileSync(`${folder}/${faction}-${personality}-${swapped?'swap':'original'}.json`,JSON.stringify(report,null,2));
 console.info(`${faction}/${personality} vs ${opponent} (${swapped?'swapped':'original'}): winner ${s.winner}, ${Math.round(s.time)}s, retreats ${retreats}`);
 expect(invalid).toBe(false);expect(trained.every(count=>count>5)).toBe(true);expect(deposits.every(amount=>amount>100)).toBe(true);expect(damage.every(amount=>amount>100)).toBe(true);expect(isGameOver(s)).toBe(true);
},120_000);
