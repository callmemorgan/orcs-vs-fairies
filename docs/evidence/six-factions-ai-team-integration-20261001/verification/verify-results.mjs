#!/usr/bin/env node
// Verify the preserved 108-result ladder without running gameplay.
// Run this file with Node from any working directory. Only ladder-provenance.json is written.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const verificationDir = dirname(scriptPath);
const evidenceDir = resolve(verificationDir, '..');
const repositoryDir = resolve(evidenceDir, '../../..');
const expectedCommit = '3f376c9ea75b9bcaed6643ea678ce3c4e5e80f77';
const seeds = [4127];
const sizes = ['small', 'medium', 'large'];
const factions = ['orcs', 'fairies', 'dwarves', 'undead', 'tideborn', 'automata'];
const widths = { small:36, medium:48, large:64 };
const defaultConfig = { difficulty:'normal', personality:'balanced', opening:'infantry-rush' };
const unitRoles = ['worker', 'melee', 'ranged', 'special', 'cavalry', 'spear', 'siege'];
const combatRoles = unitRoles.filter(role => role !== 'worker');
const buildingRoles = ['hq', 'barracks', 'depot', 'tower', 'wall', 'gate'];
const essentialBuildings = ['hq', 'barracks', 'depot', 'tower'];
const errors = [];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const hashSyntax = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactArray = (actual, expected) => Array.isArray(actual) && JSON.stringify(actual) === JSON.stringify(expected);
const sameKeys = (actual, expected) => record(actual) && JSON.stringify(Object.keys(actual).sort()) === JSON.stringify([...expected].sort());
const configMatches = actual => sameKeys(actual, Object.keys(defaultConfig)) && Object.entries(defaultConfig).every(([key,value]) => actual[key] === value);
const check = (condition, message) => { if (!condition) errors.push(message); };
const integer = value => Number.isSafeInteger(value) && value >= 0;
const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const numericWalk = (value, path) => {
 if (typeof value === 'number') check(Number.isFinite(value), path + ' is non-finite');
 else if (Array.isArray(value)) value.forEach((item,index) => numericWalk(item,path + '[' + index + ']'));
 else if (record(value)) Object.entries(value).forEach(([key,item]) => numericWalk(item,path + '.' + key));
};
const pair = (value, path) => check(Array.isArray(value) && value.length === 2, path + ' must contain two players');
const point = (value, width, path) => check(record(value) && nonnegative(value.x) && nonnegative(value.y) && value.x <= width && value.y <= width, path + ' is outside the recorded map');
const methodBytes = readFileSync(resolve(evidenceDir,'method.json'));
const method = JSON.parse(methodBytes);
numericWalk(method,'method');
check(method.sourceCommit === expectedCommit,'method.sourceCommit differs from frozen commit');
check(method.games === 108,'method.games is not 108');
check(exactArray(method.seeds,seeds),'method.seeds differs from [4127]');
check(exactArray(method.sizes,sizes),'method.sizes differs from small/medium/large');
check(exactArray(method.controllers,['ai','ai']),'method.controllers differs from two AI controllers');
check(method.seedIsUsed === true,'method.seedIsUsed is not true');
check(method.stepSeconds === .05 && method.maxMinutes === 45,'method time limits differ from .05 steps / 45 minutes');
check(method.decisionIntervalSeconds === 1,'method decision interval differs from default normal AI');
check(method.saveVersion === 3,'method.saveVersion is not 3');
check(configMatches(method.defaultAiConfig),'method.defaultAiConfig is not normalized default AI');

const git = args => execFileSync('git',args,{cwd:repositoryDir});
const coreFiles = git(['ls-tree','-r','--name-only',expectedCommit,'src/core']).toString().trim().split('\n').filter(name => name.endsWith('.ts')).sort();
const expectedSourceFiles = [...coreFiles,'scripts/ladder/ladder.test.ts','scripts/ladder/report.py','vitest.ladder.config.ts','package.json','package-lock.json'].sort();
check(coreFiles.length === 14,'frozen commit does not contain 14 core TypeScript files');
check(expectedSourceFiles.length === 19,'expected source snapshot does not contain 19 files');
check(sameKeys(method.sourceSha256,expectedSourceFiles),'sourceSha256 does not contain the exact 19 expected paths');
const sourceVerification = [];
for (const name of expectedSourceFiles) {
 try {
  const bytes = readFileSync(resolve(evidenceDir,'source',name));
  const actualSha256 = digest(bytes), expectedSha256 = method.sourceSha256?.[name];
  check(hashSyntax(expectedSha256),'invalid source SHA-256: ' + name);
  check(actualSha256 === expectedSha256,'source snapshot hash differs: ' + name);
  let matchesFrozenCore = null;
  if (coreFiles.includes(name)) {
   matchesFrozenCore = bytes.equals(git(['show',expectedCommit + ':' + name]));
   check(matchesFrozenCore,'core snapshot differs from frozen Git bytes: ' + name);
  }
  sourceVerification.push({path:name,expectedSha256,actualSha256,matchesFrozenCore});
 } catch (error) { errors.push('source ' + name + ': ' + error.message); }
}

const expectedNames = seeds.flatMap(seed => sizes.flatMap(size => factions.flatMap(faction => factions.map(opponent => size + '-' + seed + '-' + faction + '-' + opponent + '.json')))).sort();
const topLevelNames = readdirSync(evidenceDir);
const reportNames = topLevelNames.filter(name => /^(small|medium|large|huge)-/.test(name) && name.endsWith('.json')).sort();
check(exactArray(reportNames,expectedNames),'match files do not form the exact 108 ordered seed/map/faction matrix');
const reportHashes = {}, matches = [], keys = new Set();
const requiredFields = ['sourceCommit','saveVersion','saveRoundTrip','finalSaveSha256','aiConfigs','seed','mapSize','faction','opponent','seconds','winner','winningTeam','draw','timeout','lastAttack','secondsWithoutCombat','invalidEconomy','invalidPosition','trained','deposited','hitsByRole','damageByRole','abilities','built','roles','maxPopulation','maxWood','maxOre','maxCrystal','pathStalls','finalPlayers','hq','survivors'];
for (const name of reportNames) {
 try {
  const bytes = readFileSync(resolve(evidenceDir,name)), m = JSON.parse(bytes);
  reportHashes[name] = digest(bytes);
  const before = errors.length, prefix = name + ': ';
  check(record(m) && requiredFields.every(key => Object.hasOwn(m,key)),prefix + 'missing required report fields');
  if (!record(m) || !requiredFields.every(key => Object.hasOwn(m,key))) continue;
  numericWalk(m,name);
  const key = [m.seed,m.mapSize,m.faction,m.opponent].join('/');
  check(!keys.has(key),prefix + 'duplicate metadata key'); keys.add(key);
  check(name === m.mapSize + '-' + m.seed + '-' + m.faction + '-' + m.opponent + '.json',prefix + 'filename and metadata differ');
  check(seeds.includes(m.seed) && sizes.includes(m.mapSize) && factions.includes(m.faction) && factions.includes(m.opponent),prefix + 'unexpected matrix metadata');
  check(m.sourceCommit === expectedCommit,prefix + 'source commit mismatch');
  pair(m.aiConfigs,prefix + 'aiConfigs');
  check(Array.isArray(m.aiConfigs) && m.aiConfigs.every(configMatches),prefix + 'AI config is not normalized default AI');
  check(m.saveVersion === 3 && m.saveRoundTrip === true,prefix + 'reported save-v3 serialization equality failed');
  check(hashSyntax(m.finalSaveSha256),prefix + 'invalid final-save SHA-256 syntax');
  for (const field of ['draw','timeout','invalidEconomy','invalidPosition']) check(typeof m[field] === 'boolean',prefix + field + ' is not boolean');
  check(m.invalidEconomy === false && m.invalidPosition === false,prefix + 'runner recorded an economy or position violation');
  check(nonnegative(m.seconds) && m.seconds > 0 && m.seconds <= 2700.00001,prefix + 'invalid duration');
  check(nonnegative(m.lastAttack) && m.lastAttack <= m.seconds,prefix + 'invalid lastAttack');
  check(nonnegative(m.secondsWithoutCombat) && Math.abs(m.seconds - m.lastAttack - m.secondsWithoutCombat) < .00001,prefix + 'combat inactivity differs from duration-lastAttack');
  check(m.winner === null || m.winner === 0 || m.winner === 1,prefix + 'invalid winning player');
  if (m.timeout) check(m.winner === null && m.winningTeam === null && m.draw === false && Math.abs(m.seconds - 2700) < .00001,prefix + 'inconsistent timeout');
  else if (m.draw) check(m.winner === null && m.winningTeam === null,prefix + 'inconsistent draw');
  else check((m.winner === 0 || m.winner === 1) && m.winningTeam === m.winner,prefix + 'inconsistent decisive outcome');
  for (const field of ['trained','deposited','hitsByRole','damageByRole','abilities','built','roles','maxPopulation','maxWood','maxOre','maxCrystal','finalPlayers']) pair(m[field],prefix + field);
  for (let side=0;side<2;side++) {
   check(integer(m.trained[side]),prefix + 'invalid trained count');
   check(sameKeys(m.deposited[side],['wood','ore','crystal']) && Object.values(m.deposited[side]).every(nonnegative),prefix + 'invalid deposited resources');
   for (const field of ['hitsByRole','abilities']) check(record(m[field][side]) && Object.entries(m[field][side]).every(([role,count]) => [...unitRoles,...buildingRoles].includes(role) && integer(count)),prefix + 'invalid ' + field);
   check(record(m.damageByRole[side]) && Object.entries(m.damageByRole[side]).every(([role,amount]) => [...unitRoles,...buildingRoles].includes(role) && nonnegative(amount)),prefix + 'invalid damageByRole');
   for (const [field,allowed] of [['built',buildingRoles],['roles',unitRoles]]) check(Array.isArray(m[field][side]) && new Set(m[field][side]).size === m[field][side].length && m[field][side].every(role => allowed.includes(role)),prefix + 'invalid distinct ' + field);
   const player = m.finalPlayers[side];
   check(record(player) && player.faction === [m.faction,m.opponent][side],prefix + 'final player faction mismatch');
   check(record(player) && ['wood','ore','crystal'].every(resource => nonnegative(player[resource])),prefix + 'invalid final bank');
   check(record(player) && integer(player.population) && player.population <= 100 && integer(player.cap) && player.cap <= 100,prefix + 'invalid final population/cap');
   for (const [field,resource] of [['maxWood','wood'],['maxOre','ore'],['maxCrystal','crystal'],['maxPopulation','population']]) check(nonnegative(m[field][side]) && record(player) && m[field][side] + .00001 >= player[resource],prefix + 'maximum below final ' + resource);
  }
  const width = widths[m.mapSize];
  check(Array.isArray(m.hq) && m.hq.every(hq => record(hq) && [0,1].includes(hq.side) && nonnegative(hq.hp)),prefix + 'invalid HQ rows');
  check(Array.isArray(m.pathStalls),prefix + 'invalid pathStalls');
  for (const stall of m.pathStalls) {
   check(integer(stall.id) && stall.id > 0 && [0,1].includes(stall.side) && unitRoles.includes(stall.role) && nonnegative(stall.at) && stall.at <= m.seconds,prefix + 'invalid movement episode');
   point(stall,width,prefix + 'movement position'); point(stall.target,width,prefix + 'movement target');
  }
  check(Array.isArray(m.survivors),prefix + 'invalid survivor rows');
  const ids = new Set();
  for (const survivor of m.survivors) {
   check(integer(survivor.id) && survivor.id > 0 && !ids.has(survivor.id),prefix + 'invalid/duplicate survivor id'); ids.add(survivor.id);
   check([0,1].includes(survivor.side) && [...unitRoles,...buildingRoles].includes(survivor.role) && nonnegative(survivor.hp) && survivor.hp > 0,prefix + 'invalid survivor');
   point(survivor,width,prefix + 'survivor position');
   const order = survivor.order;
   check(record(order) && ['idle','hold','move','attackMove','attack','gather','build'].includes(order.type),prefix + 'invalid survivor order');
   if (order?.type === 'move' || order?.type === 'attackMove') point(order,width,prefix + 'survivor destination');
   if (['attack','gather','build'].includes(order?.type)) check(integer(order.target) && order.target > 0,prefix + 'invalid survivor order target');
  }
  if (errors.length === before) matches.push({name,...m});
 } catch (error) { errors.push(name + ': ' + error.message); }
}
check(keys.size === 108 && matches.length === 108,'not all 108 reports passed metadata and parsed-metric validation');

const median = values => { const sorted=[...values].sort((a,b)=>a-b), n=sorted.length; return n ? n%2 ? sorted[(n-1)/2] : (sorted[n/2-1]+sorted[n/2])/2 : null; };
const summarize = mm => ({
 games:mm.length, decisive:mm.filter(m=>m.winner!==null).length,
 concluded:mm.filter(m=>!m.timeout).length, draws:mm.filter(m=>m.draw).length,
 timeouts:mm.filter(m=>m.timeout).length, side0Wins:mm.filter(m=>m.winner===0).length,
 side1Wins:mm.filter(m=>m.winner===1).length,
 medianSeconds:median(mm.map(m=>m.seconds)),
 movementStallEpisodes:mm.reduce((sum,m)=>sum+m.pathStalls.length,0),
 gamesWithMovementStalls:mm.filter(m=>m.pathStalls.length).length,
 gamesEndingWithoutCombatFor180s:mm.filter(m=>m.secondsWithoutCombat>=180).length
});
const roleAndBuildingUse = Object.fromEntries(factions.map(faction => {
 const entries=matches.flatMap(m=>[m.faction,m.opponent].flatMap((f,side)=>f===faction?[{m,side}]:[]));
 return [faction,{armies:entries.length,
  missingAnyOfSixCombatRoles:entries.filter(({m,side})=>combatRoles.some(role=>!(m.hitsByRole[side][role]>0))).length,
  missingEssentialBuildings:entries.filter(({m,side})=>essentialBuildings.some(role=>!m.built[side].includes(role))).length,
  noCrystalDeposited:entries.filter(({m,side})=>m.deposited[side].crystal===0).length,
  noSpecialAbilityUsed:entries.filter(({m,side})=>!(m.abilities[side].special>0)).length}];
}));
const timeoutDetails = matches.filter(m=>m.timeout).map(m=>({
 file:m.name, finalSaveSha256:m.finalSaveSha256, mapSize:m.mapSize, faction:m.faction, opponent:m.opponent,
 seconds:m.seconds,lastAttack:m.lastAttack,secondsWithoutCombat:m.secondsWithoutCombat,
 movementStallEpisodes:m.pathStalls.length,hq:m.hq,
 players:[0,1].map(side=>({side,faction:m.finalPlayers[side].faction,wood:m.finalPlayers[side].wood,
  population:m.finalPlayers[side].population,
  survivingWorkers:m.survivors.filter(e=>e.side===side&&e.role==='worker').length,
  survivingNonWorkerUnitEntries:m.survivors.filter(e=>e.side===side&&combatRoles.includes(e.role)).length}))
}));
let generatedSummary = null;
const summaryPath = resolve(evidenceDir,'summary.json');
if (existsSync(summaryPath)) {
 try {
  const bytes=readFileSync(summaryPath), summary=JSON.parse(bytes), totals=summarize(matches);
  numericWalk(summary,'summary');
  const values={games:totals.games,completed:totals.concluded,draws:totals.draws,timeouts:totals.timeouts,
   side0Wins:totals.side0Wins,side1Wins:totals.side1Wins,
   mirrorSide0Wins:matches.filter(m=>m.faction===m.opponent&&m.winner===0).length,
   mirrorSide1Wins:matches.filter(m=>m.faction===m.opponent&&m.winner===1).length,
   medianSeconds:totals.medianSeconds,
   minSeconds:matches.length?Math.min(...matches.map(m=>m.seconds)):null,
   maxSeconds:matches.length?Math.max(...matches.map(m=>m.seconds)):null,
   movementStallEpisodes:totals.movementStallEpisodes,gamesWithMovementStalls:totals.gamesWithMovementStalls,
   gamesEndingWithoutCombatFor180s:totals.gamesEndingWithoutCombatFor180s,
   invalidEconomy:matches.filter(m=>m.invalidEconomy).length,invalidPosition:matches.filter(m=>m.invalidPosition).length};
  for (const [key,value] of Object.entries(values)) check(typeof summary[key]==='number' && Math.abs(summary[key]-value)<.00001,'summary differs from match aggregation: ' + key);
  check(hashSyntax(summary.reporterSha256),'summary reporter SHA-256 syntax is invalid');
  const matchesInitialReporterSnapshot=summary.reporterSha256===method.sourceSha256['scripts/ladder/report.py'];
  const reporterSnapshot=matchesInitialReporterSnapshot?'source/scripts/ladder/report.py':'verification/report-corrected.py';
  const reporterSnapshotSha256=digest(readFileSync(resolve(evidenceDir,reporterSnapshot)));
  check(reporterSnapshotSha256===summary.reporterSha256,'summary reporter hash differs from preserved reporter bytes');
  check(sameKeys(summary.standings,factions),'summary standings do not contain the exact six factions');
  for (const faction of factions) {
   const standing={wins:0,losses:0,draws:0,timeouts:0,side0Wins:0,side1Wins:0,games:0};
   for (const m of matches.filter(m=>m.faction!==m.opponent)) {
    const side=[m.faction,m.opponent].indexOf(faction); if(side<0)continue;
    standing.games++;
    if(m.timeout)standing.timeouts++;else if(m.draw)standing.draws++;
    else if(m.winner===side){standing.wins++;standing['side'+side+'Wins']++;}else standing.losses++;
   }
   for (const [key,value] of Object.entries(standing)) check(summary.standings?.[faction]?.[key]===value,'summary standing differs: ' + faction + '.' + key);
  }
  generatedSummary={sha256:digest(bytes),reporterSha256:summary.reporterSha256,
   matchesInitialReporterSnapshot,reporterSnapshot,reporterSnapshotSha256,
   numericAggregateChecked:true,standingsChecked:true};
 } catch(error) { errors.push('summary: ' + error.message); }
}
const provenance = {
 schemaVersion:1, checkedAt:new Date().toISOString(), checkerSha256:digest(readFileSync(scriptPath)),
 nodeVersion:process.version, validationPassed:errors.length===0, errors,
 sourceCommit:expectedCommit, methodSha256:digest(methodBytes),
 expectedMatrix:{seeds,mapSizes:sizes,factions,orderedPairs:true,mirrorsIncluded:true,games:108},
 observedReportFiles:reportNames.length, uniqueMetadataKeys:keys.size, validatedReports:matches.length,
 sourceSnapshotFiles:sourceVerification.length, frozenCoreFiles:coreFiles.length, sourceVerification,
 aiConfiguration:defaultConfig, saveVersion:3,
 saveVerificationScope:'Checks the runner-reported in-memory save/load serialization equality and hash syntax. The original ladder exported result reports without final save envelopes; this checker does not repeat save round trips or prove behavioral continuation.',
 runnerAssertionScope:'Recorded diagnostic and serialization flags are validated. Vitest exit status is separate command evidence. Timeouts count as unfinished games even when runner assertions pass.',
 numericVerificationScope:'All numbers in parsed method and result files are finite. This does not add a per-tick finiteness check to the original economy diagnostic.',
 reducedStateScope:'HQ progress, entity kind/illusion/raised markers and runtime retreat records are absent from result rows. The checker validates outcome relations without recomputing authoritative elimination or population from these reduced rows.',
 generatedSummary, completion:summarize(matches), byMap:Object.fromEntries(sizes.map(size=>[size,summarize(matches.filter(m=>m.mapSize===size))])),
 mirrors:summarize(matches.filter(m=>m.faction===m.opponent)), roleAndBuildingUse, timeoutDetails,
 reportSha256:reportHashes,
 ignoredTopLevelJson:topLevelNames.filter(name=>name.endsWith('.json')&&!reportNames.includes(name)).sort()
};
writeFileSync(resolve(verificationDir,'ladder-provenance.json'),JSON.stringify(provenance,null,2)+'\n');
console.log(JSON.stringify({validationPassed:provenance.validationPassed,validatedReports:matches.length,
 sourceSnapshotFiles:sourceVerification.length,frozenCoreFiles:coreFiles.length,
 completion:provenance.completion,errors,output:resolve(verificationDir,'ladder-provenance.json')},null,2));
if (errors.length) process.exitCode=1;
