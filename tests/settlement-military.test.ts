import { expect, it } from 'vitest';
import { createGame, issueCommand, stepGame } from '../src/core/simulation';
import { effectiveUnitStats } from '../src/core/progression';
import { MILITARY_UPGRADES } from '../src/improvements/settlement/military';
import { FACTIONS } from '../src/core/content';

it.each(MILITARY_UPGRADES)('researches $name, charges once and changes only its role in this match',def=>{
 const s=createGame('orcs',4127,'fairies',{controllers:['external','external'],improvements:{'feature-041':true}});
 const other=createGame('orcs',4127,'fairies',{controllers:['external','external']});
 Object.assign(s.players[0],{wood:2000,ore:2000,crystal:200,upgrades:['town-age','citadel-age']});
 const barracks={...s.entities.find(e=>e.role==='hq'&&e.side===0)!,id:s.nextId++,role:'barracks' as const,x:20,y:20};s.entities.push(barracks);
 const role=Array.isArray(def.appliesTo)?def.appliesTo[0]:def.appliesTo;
 const before=effectiveUnitStats(s.players[0],role),worker=effectiveUnitStats(s.players[0],'worker');
 expect(issueCommand(s,0,{type:'research',id:barracks.id,upgrade:def.id})).toBe(true);
 expect(s.players[0].wood).toBe(2000-def.cost.wood);
 expect(issueCommand(s,0,{type:'research',id:barracks.id,upgrade:def.id})).toBe(false);
 for(let i=0;i<def.researchTime*20+2;i++)stepGame(s,.05);
 expect(s.players[0].upgrades).toContain(def.id);
 expect(effectiveUnitStats(s.players[0],role).damage).toBeCloseTo(before.damage*(def.effects.damage??1));
 expect(effectiveUnitStats(s.players[0],'worker')).toEqual(worker);
 expect(effectiveUnitStats(other.players[0],role)).toEqual(FACTIONS.orcs.units[role]);
 expect(issueCommand(other,0,{type:'research',id:other.entities[0].id,upgrade:def.id})).toBe(false);
});

it.each(MILITARY_UPGRADES)('uses $name in real combat without losing faction bonus multipliers',def=>{
 const s=createGame('orcs',4127,'fairies',{controllers:['external','external'],improvements:{'feature-041':true}});
 const attacker=s.entities.find(e=>e.side===0&&e.role==='melee')!,target=s.entities.find(e=>e.side===1&&e.role==='melee')!;
 const role=Array.isArray(def.appliesTo)?def.appliesTo[0]:def.appliesTo;
 attacker.role=role;attacker.x=15;attacker.y=15;attacker.order={type:'hold'};
 target.role='cavalry';target.x=16;target.y=15;target.hp=target.maxHp=5000;target.order={type:'hold'};
 s.entities=s.entities.filter(e=>e.kind==='building').concat([attacker,target]);
 s.players[0].upgrades.push(def.id);
 stepGame(s,.05);
 const base=FACTIONS.orcs.units[role];
 const expected=Math.max(1,base.damage*(def.effects.damage??1)*(base.bonusAgainst?.cavalry??1)-FACTIONS.fairies.units.cavalry.armor);
 expect(5000-target.hp).toBeCloseTo(expected);
});
