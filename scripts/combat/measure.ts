import { writeFileSync } from 'node:fs';
import { FACTIONS } from '../../src/core/content';
import { combatSample, SAMPLE } from './compare';
const changed=combatSample();
FACTIONS.orcs.units.melee.hp=175;FACTIONS.orcs.units.ranged.cooldown=1.5; // pre-031 stats
const baseline=combatSample();
const summary=(rows:typeof baseline)=>Object.fromEntries(SAMPLE.opponents.map(opponent=>{const r=rows.filter(x=>x.opponent===opponent);return [opponent,{wins:r.filter(x=>x.winner===x.orcSide).length,losses:r.filter(x=>x.winner!==null&&x.winner!==x.orcSide).length,draws:r.filter(x=>x.draw).length,timeouts:r.filter(x=>x.winner===null&&!x.draw).length,meanRemaining:r.reduce((s,x)=>s+x.health[x.orcSide],0)/r.length}];}));
const report={method:{budget:`${SAMPLE.budget} wood+ore+2*crystal; actual costs included per army`,terrain:SAMPLE.terrain,orientations:SAMPLE.orientations.length,formationOffsets:SAMPLE.formations.length,compositions:SAMPLE.compositions.map(roles=>roles.join('+')),secondsCap:SAMPLE.secondsCap,dt:SAMPLE.dt,humanMatches:0},baseline,changed,summary:{baseline:summary(baseline),changed:summary(changed)}};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary,null,2));
