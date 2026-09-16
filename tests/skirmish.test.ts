import { playerAge } from '../src/core/progression';
import { mkdirSync, writeFileSync } from 'node:fs';
import { FACTIONS } from '../src/core/content';
import type { FactionId } from '../src/core/types';
import { afterAll, expect, it } from 'vitest';
import { createGame, isGameOver, stepGame } from '../src/core/simulation';

// Both commanders use the public AI and shared rules. No resources, damage,
// units or outcomes are injected; this exercises the complete economy loop.
const maxMinutes=Number(process.env.SKIRMISH_MAX_MINUTES??45);
const factions=Object.keys(FACTIONS) as FactionId[];
const coverage=new Map<string,{hits:Set<string>;buildings:Set<string>;age:number}>();
it.each(factions.flatMap(f=>factions.map(o=>[f,o] as const)))('completes a real %s vs %s AI skirmish', (faction,opponent) => {
  const s = createGame(faction,4127,opponent,{controllers:['ai','ai']});
  const emplacementHits=[0,0],raisedHits=[0,0];
  const hitsByRole:Record<string,number>[]=[{},{}];
  const abilities=[0,0],roles=[new Set<string>(),new Set<string>()];
  const trained = [0, 0], deposited = [0, 0], attacks = [0, 0];
  const built = [new Set<string>(), new Set<string>()];
  for (let tick = 0; tick < 20 * maxMinutes * 60 && !isGameOver(s); tick++) {
    stepGame(s, .05);
    for (const event of s.events) {
      if (event.type === 'train') {trained[event.side]++;const e=s.entities.find(e=>e.id===event.source);if(e)roles[event.side].add(e.role);}
      if(event.type==='ability')abilities[event.side]++;
      if (event.type === 'gather') deposited[event.side]++;
      if (event.type === 'attack') {attacks[event.side]++;const attacker=s.entities.find(e=>e.id===event.source);if(attacker)hitsByRole[event.side][attacker.role]=(hitsByRole[event.side][attacker.role]??0)+1;if(attacker?.raised)raisedHits[event.side]++;if(attacker?.entrenchedAt!==undefined&&s.time-attacker.entrenchedAt>=3)emplacementHits[event.side]++;}
    }
    for (const entity of s.entities) if (entity.kind === 'building' && entity.progress === 1) built[entity.side].add(entity.role);
    for (const player of s.players) {
      expect(player.wood).toBeGreaterThanOrEqual(0);
      expect(player.ore).toBeGreaterThanOrEqual(0);
      expect(player.crystal).toBeGreaterThanOrEqual(0);
      expect(player.population).toBeLessThanOrEqual(100);
    }
  }
  const report={faction,opponent,seed:4127,seconds:s.time,winner:s.winner,draw:s.draw,hq:s.entities.filter(e=>e.role==='hq').map(e=>({side:e.side,hp:e.hp})),trained,deposited,attacks,hitsByRole,abilities,emplacementHits,raisedHits,ages:s.players.map(playerAge),upgrades:s.players.map(p=>p.upgrades),roles:roles.map(r=>[...r]),built:built.map(b=>[...b])};
  mkdirSync('work/three-ages/regression-matches',{recursive:true});writeFileSync(`work/three-ages/regression-matches/${faction}-${opponent}.json`,JSON.stringify(report,null,2));
  if(!isGameOver(s))writeFileSync(`work/three-ages/regression-matches/${faction}-${opponent}-unfinished.json`,JSON.stringify({time:s.time,players:s.players,entities:s.entities},null,2));

  for (const side of [0, 1]) {
    expect(trained[side]).toBeGreaterThan(5);
    expect(deposited[side]).toBeGreaterThan(10);
    expect(attacks[side]).toBeGreaterThan(10);
    expect(built[side].has('barracks')).toBe(true);
    expect(built[side].has('depot')).toBe(true);
    const f=s.players[side].faction,c=coverage.get(f)??{hits:new Set<string>(),buildings:new Set<string>(),age:1};
    for(const [role,hits] of Object.entries(hitsByRole[side]))if(hits)c.hits.add(role);
    for(const role of built[side])c.buildings.add(role);c.age=Math.max(c.age,playerAge(s.players[side]));coverage.set(f,c);

  }
  expect(isGameOver(s)).toBe(true);
  const lostHQ = s.entities.find(e => e.role === 'hq' && e.progress===1 && e.side !== s.winner);
  expect(lostHQ?.hp ?? 0).toBe(0);
}, 120_000);

afterAll(()=>{
 for(const faction of factions){const c=coverage.get(faction)!;for(const role of ['melee','ranged','special','spear','cavalry','siege'])expect(c.hits.has(role),`${faction} ${role} never fought`).toBe(true);expect(c.age,`${faction} never reached Citadel Age`).toBe(3);expect(c.buildings).toEqual(new Set(['hq','barracks','depot','tower','wall','gate']));}
});
