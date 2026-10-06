import { expect, it } from 'vitest';
import { FACTIONS } from '../../src/core/content';
import { issueCommand, refreshVisibility, stepGame } from '../../src/core/simulation';
import type { FactionId } from '../../src/core/types';
import { EXPANDED_ROLES } from '../../src/improvements/combat/roleProfiles';
import { advance, arena, unit } from './fixture';
it('Automata expanded roles absorb combat damage with real shields',()=>{for(const role of EXPANDED_ROLES){const s=arena('automata','orcs'),a=unit(s,0,role),b=unit(s,1,'melee',21,20);a.cooldown=100;stepGame(s,.05);expect(a.shield).toBeLessThan(a.maxShield!);expect(a.hp).toBe(a.maxHp);expect(s.events.some(e=>e.target===a.id&&e.source===b.id)).toBe(true);}});
it('Fairy cavalry moves farther than armored Dwarf cavalry under the same order',()=>{const moved=(f:'fairies'|'dwarves')=>{const s=arena(f),e=unit(s,0,'cavalry');issueCommand(s,0,{type:'move',ids:[e.id],x:30,y:20});advance(s,1);return e.x-20;};expect(moved('fairies')).toBeGreaterThan(moved('dwarves')+1);});
it('all faction pikes apply their stated cavalry counter in actual attacks',()=>{for(const f of Object.keys(FACTIONS) as FactionId[]){const s=arena(f),p=unit(s,0,'spear'),c=unit(s,1,'cavalry',21,20);c.cooldown=100;stepGame(s,.05);const d=FACTIONS[f].units.spear,armor=FACTIONS[f].units.cavalry.armor;expect(s.events.find(e=>e.source===p.id&&e.target===c.id)?.amount).toBeCloseTo(d.damage*d.bonusAgainst!.cavalry!-armor);}});
it('faction siege profiles deal their stated building damage through ordinary attack orders',()=>{
 const remaining={orcs:875,fairies:892.6,dwarves:860.2,undead:899,tideborn:895,automata:891};
 for(const f of Object.keys(remaining) as FactionId[]){const s=arena(f),siege=unit(s,0,'siege');const template=s.entities.find(e=>e.kind==='building')!;const tower={...structuredClone(template),id:s.nextId++,side:1 as const,role:'tower' as const,x:28,y:20,hp:1000,maxHp:1000,cooldown:100};s.entities.push(tower);refreshVisibility(s);expect(issueCommand(s,0,{type:'attack',ids:[siege.id],target:tower.id})).toBe(true);stepGame(s,.05);expect(tower.hp).toBeCloseTo(remaining[f]);expect(siege.hp).toBe(siege.maxHp);}
});
