import {describe,it,expect} from 'vitest';
import {FACTIONS} from '../src/core/content';
import {createGame,issueCommand,stepGame} from '../src/core/simulation';
function setup(){const s=createGame('orcs',4127,'fairies',{controllers:['external','external']});const hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;for(let i=0;i<3;i++)expect(issueCommand(s,0,{type:'train',id:hq.id,role:'worker'})).toBe(true);hq.trainProgress=.6;return {s,hq};}
describe('recruitment cancellation',()=>{
 it('refunds one waiting entry without resetting active progress',()=>{const {s,hq}=setup(),wood=s.players[0].wood;expect(issueCommand(s,0,{type:'cancelTrain',id:hq.id,index:1})).toBe(true);expect(hq.queue).toEqual(['worker','worker']);expect(hq.trainProgress).toBe(.6);expect(s.players[0].wood).toBe(wood+50);});
 it('resets progress when canceling the active entry and refunds each purchase only once',()=>{const {s,hq}=setup();for(let i=0;i<3;i++)expect(issueCommand(s,0,{type:'cancelTrain',id:hq.id,index:0})).toBe(true);expect(hq.trainProgress).toBe(0);expect(hq.queue).toEqual([]);expect(s.players[0].wood).toBe(420);expect(issueCommand(s,0,{type:'cancelTrain',id:hq.id,index:0})).toBe(false);expect(s.players[0].wood).toBe(420);});
 it('rejects foreign buildings, invalid slots and ended games without changing the queue',()=>{const {s,hq}=setup();expect(issueCommand(s,1,{type:'cancelTrain',id:hq.id,index:0})).toBe(false);for(const index of [-1,.5,3,NaN])expect(issueCommand(s,0,{type:'cancelTrain',id:hq.id,index})).toBe(false);s.winner=0;expect(issueCommand(s,0,{type:'cancelTrain',id:hq.id,index:0})).toBe(false);expect(hq.queue).toHaveLength(3);expect(hq.trainProgress).toBe(.6);});
 it('refunds the training queue when the producer dies and does not refund again on cancel',()=>{
  const s=createGame('orcs',4127,'fairies',{controllers:['external','external']});s.terrain.fill('grass');s.resources=[];
  const hall=s.entities.find(e=>e.side===0&&e.role==='hq')!;
  const barracks={...structuredClone(hall),id:s.nextId++,role:'barracks' as const,x:hall.x+6,y:hall.y,queue:[],trainProgress:0,progress:1};
  s.entities.push(barracks);Object.assign(s.players[0],{wood:2000,ore:2000,crystal:2000});
  expect(issueCommand(s,0,{type:'train',id:barracks.id,role:'melee'})).toBe(true);
  expect(issueCommand(s,0,{type:'train',id:barracks.id,role:'ranged'})).toBe(true);
  const wood=s.players[0].wood,ore=s.players[0].ore,crystal=s.players[0].crystal;
  const melee=FACTIONS.orcs.units.melee.cost,ranged=FACTIONS.orcs.units.ranged.cost;
  barracks.hp=0;stepGame(s,.05);
  expect(s.players[0].wood).toBe(wood+melee.wood+ranged.wood);
  expect(s.players[0].ore).toBe(ore+melee.ore+ranged.ore);
  expect(s.players[0].crystal).toBe(crystal+melee.crystal+ranged.crystal);
  expect(barracks.queue).toEqual([]);expect(barracks.trainProgress).toBe(0);
  expect(issueCommand(s,0,{type:'cancelTrain',id:barracks.id,index:0})).toBe(false);
  expect(s.players[0].wood).toBe(wood+melee.wood+ranged.wood);
 });
});
