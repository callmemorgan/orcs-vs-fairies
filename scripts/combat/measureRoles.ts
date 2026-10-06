import { writeFileSync } from 'node:fs';
import { FACTIONS } from '../../src/core/content';
import { issueCommand } from '../../src/core/simulation';
import type { FactionId } from '../../src/core/types';
import { EXPANDED_ROLES } from '../../src/improvements/combat/roleProfiles';
import { advance, arena, unit } from '../../tests/combat/fixture';
const factions=Object.keys(FACTIONS) as FactionId[],opposingRole={cavalry:'ranged',spear:'cavalry',siege:'melee'} as const;
function sample(){return factions.flatMap(f=>EXPANDED_ROLES.map(role=>{const units=FACTIONS[f].units,s=arena(f),a=unit(s,0,role),b=unit(s,1,opposingRole[role],24,20);issueCommand(s,0,{type:'attack',ids:[a.id],target:b.id});issueCommand(s,1,{type:'attack',ids:[b.id],target:a.id});advance(s,30);return {faction:f,role,cost:units[role].cost,opposingCost:units[opposingRole[role]].cost,hull:a.hp,shield:a.shield??0,opposingHull:b.hp,seconds:s.time};}));}
const changed=sample();
const pre032={cavalry:{hp:210,damage:18,armor:2,range:1.5,speed:3.5,cooldown:1.3},spear:{hp:125,damage:11,armor:1,range:1.9,speed:2.1,cooldown:1.25},siege:{hp:185,damage:28,armor:2,range:8.5,speed:1.05,cooldown:3.8,buildingDamageMultiplier:4}}; // pre-032 stats
for(const f of factions)for(const role of EXPANDED_ROLES)Object.assign(FACTIONS[f].units[role],{shield:undefined},pre032[role]);
const baseline=sample();
const report={method:'Same role and cost before/after; 18 controlled 30-second fights per version on grass, one unit per side, actual opposing costs included. Opposing cavalry also uses pre-032 definitions in baseline. No human balance claims.',baseline,changed};
const json=JSON.stringify(report,null,2);
if(process.argv[2])writeFileSync(process.argv[2],json);console.log(json);
