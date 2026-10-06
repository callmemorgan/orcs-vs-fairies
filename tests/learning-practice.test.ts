import { expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { createGame, issueCommand, stepGame } from '../src/core/simulation';
import type { FactionId } from '../src/core/types';
import type { PracticeProgress } from '../src/improvements/learning/practice-rule';
const advance=(game:ReturnType<typeof createGame>,seconds:number)=>{for(let i=0;i<seconds*4;i++)stepGame(game,.25);};
const battle={type:'improvement' as const,improvement:'feature-002',action:'battle',ids:[]};
function practice(faction:FactionId){const game=createGame(faction,4127,'fairies',{improvements:{'feature-002':{}}});return {game,state:game.improvements!['feature-002'].state as PracticeProgress};}
for(const faction of Object.keys(FACTIONS) as FactionId[])it(`plays the ${faction} mechanic and practice fight`,()=>{
 const {game,state}=practice(faction);
 expect(game.controllers[1]).toBe('external');expect(issueCommand(game,0,battle)).toBe(false);expect(issueCommand(game,1,battle)).toBe(false);
 if(faction==='undead'){
  const enemy=game.entities.find(e=>e.id===state.initialTarget)!;expect(issueCommand(game,0,{type:'attack',ids:[state.fighter],target:enemy.id})).toBe(true);advance(game,15);
  expect(state.mechanic).toBe(false);expect(game.corpses.length).toBeGreaterThan(0);
  expect(issueCommand(game,0,{type:'move',ids:[state.actor],x:enemy.x-2,y:enemy.y})).toBe(true);advance(game,15);
 }else if(faction==='automata'){
  advance(game,20);expect(state.mechanic).toBe(false);
  expect(issueCommand(game,0,{type:'move',ids:[state.actor],x:game.starts[0].x-3,y:game.starts[0].y+3})).toBe(true);advance(game,15);
 }else{
  expect(issueCommand(game,0,{type:'ability',ids:[state.actor]})).toBe(true);advance(game,faction==='dwarves'?4:1);
 }
 expect(state.mechanic).toBe(true);expect(issueCommand(game,0,battle)).toBe(true);expect(issueCommand(game,0,battle)).toBe(false);
 expect(issueCommand(game,0,{type:'attack',ids:[state.actor,state.fighter],target:state.target!})).toBe(true);advance(game,30);
 expect(state.complete).toBe(true);expect(state.failed).toBe(false);expect(JSON.parse(JSON.stringify(game.improvements))).toEqual(game.improvements);
});
it('marks a lost mission troop as failed and rejects a fight',()=>{const {game,state}=practice('orcs');game.entities.find(e=>e.id===state.actor)!.hp=0;stepGame(game,.25);expect(state.failed).toBe(true);expect(issueCommand(game,0,battle)).toBe(false);});
