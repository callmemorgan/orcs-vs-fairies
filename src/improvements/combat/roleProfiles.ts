import type { FactionId, UnitDef } from '../../core/types';

export const EXPANDED_ROLES=['cavalry','spear','siege'] as const;
// Identity, cost, age and counters come from content.ts; profiles cannot override them.
type RoleProfile=Partial<Omit<UnitDef,'id'|'name'|'role'|'cost'|'age'|'bonusAgainst'>>;
/** Permanent content statistics; no match mutates these profiles. */
export const ROLE_PROFILES:Record<FactionId,Record<typeof EXPANDED_ROLES[number],RoleProfile>>= {
 orcs:{
  cavalry:{hp:240,damage:20,armor:3,speed:3.15,cooldown:1.4,description:'Armored boar cavalry trades speed for hull and damage. Deals 1.7× damage to ranged troops; vulnerable to pikes.'},
  spear:{hp:150,damage:12,armor:2,speed:1.9,description:'Durable pikes screen the warband. Deals 3× damage to cavalry; slower than most infantry.'},
  siege:{hp:220,damage:32,range:8,speed:.9,cooldown:4.2,description:'Heavy catapult with a slow firing cycle and armored hull. Deals 4× damage to buildings.'}
 },
 fairies:{
  cavalry:{hp:170,damage:17,armor:1,speed:4.1,cooldown:1.1,description:'Fast, fragile stag cavalry raids and withdraws. Deals 1.7× damage to ranged troops; vulnerable to pikes.'},
  spear:{hp:105,damage:10,armor:0,range:2.2,speed:2.7,cooldown:1.1,description:'Swift, long-reaching pikes intercept cavalry. Deals 3× damage to cavalry; fragile under ranged fire.'},
  siege:{hp:145,damage:24,range:10,speed:1.15,cooldown:4,buildingDamageMultiplier:4.6,description:'Fragile trebuchet reaches 10 tiles. Deals 4.6× damage to buildings; protect it from raiders.'}
 },
 dwarves:{
  cavalry:{hp:240,damage:20,armor:4,speed:2.8,cooldown:1.5,description:'Slow mountain cavalry has heavy armor. Deals 1.7× damage to ranged troops; vulnerable to pikes.'},
  spear:{hp:155,damage:12,armor:3,speed:1.7,cooldown:1.4,description:'Armored pikes hold a defensive screen. Deals 3× damage to cavalry; slow to reposition.'},
  siege:{hp:250,damage:34,armor:4,range:8,speed:.9,cooldown:4.1,buildingDamageMultiplier:4.2,description:'Armored stone thrower breaks fortifications. Deals 4.2× damage to buildings with a slow firing cycle.'}
 },
 undead:{
  cavalry:{hp:175,damage:17,armor:1,speed:3.65,cooldown:1.2,description:'Light dread cavalry moves and strikes quickly. Deals 1.7× damage to ranged troops; vulnerable to pikes.'},
  spear:{hp:110,damage:10,armor:0,speed:2.35,cooldown:1.15,description:'Brittle bone pikes respond quickly and leave raisable corpses. Deals 3× damage to cavalry.'},
  siege:{hp:165,damage:26,armor:1,speed:1.15,cooldown:3.7,description:'Light grave catapult repositions faster than heavy engines. Deals 4× damage to buildings.'}
 },
 tideborn:{
  cavalry:{hp:205,speed:3.7,cooldown:1.25,description:'Shell riders cross mud and shallows at full speed. Deals 1.7× damage to ranged troops; vulnerable to pikes.'},
  spear:{hp:135,armor:2,range:2,speed:2.35,description:'Reef pikes escort amphibious advances without wet-ground penalties. Deals 3× damage to cavalry.'},
  siege:{hp:195,damage:27,speed:1.3,description:'Mobile coral mangonel follows wet-ground routes without slowing. Deals 4× damage to buildings.'}
 },
 automata:{
  cavalry:{hp:155,shield:60,speed:3.35,description:'Strider has 155 hull and 60 rechargeable shield. Deals 1.7× damage to ranged troops; vulnerable to pikes.'},
  spear:{hp:95,shield:35,speed:2.05,description:'Lance Sentinel has 95 hull and 35 rechargeable shield. Deals 3× damage to cavalry.'},
  siege:{hp:150,shield:75,range:9,speed:1,description:'Siege Engine has 150 hull and 75 rechargeable shield, with 9-tile range. Deals 4× damage to buildings.'}
 }
};
