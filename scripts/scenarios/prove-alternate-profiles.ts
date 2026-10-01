import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { CAMPAIGNS } from '../../src/scenarios/campaigns';
import { campaignArmy, campaignProgress, chooseCampaignBranch, completeCampaignMission, createCampaignProfile, decodeCampaignProfile, nextCampaignMission, prepareCampaignMission } from '../../src/core/campaign';
import { captureScenario } from '../../src/core/scenarios';
import { scenarioChecksum, verifyScenarioRecording } from '../../src/core/scenario-recordings';
import { solveMission } from './mission-strategy';

const output=resolve(process.argv[2]??`docs/evidence/campaigns/author-alternate-profiles-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
const route=process.argv[3]??'alternate';
if(route!=='primary'&&route!=='alternate') throw new Error('Choose the primary or alternate campaign route.');
if(existsSync(output)) throw new Error('Proof outputs are append-only. Choose a new path.');
const archiveDirectory=resolve('work/campaign-content/profiles',new Date().toISOString().replace(/[:.]/g,'-'));
mkdirSync(archiveDirectory,{recursive:true});
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const results=[];
for(const campaign of Object.values(CAMPAIGNS)) {
  const choice=campaign.choice.options[route==='primary'?0:1];
  let profile=createCampaignProfile(campaign.id,`author-${route}-${campaign.faction}`);
  const chapters=[];
  try {
    for(let chapter=0;chapter<4;chapter++) {
      if(chapter===2) {
        profile=chooseCampaignBranch(profile,choice.id);
        const decoded=decodeCampaignProfile(JSON.stringify(profile));
        if(decoded.choiceId!==choice.id||nextCampaignMission(decoded)!==choice.chapter3) throw new Error('Branch choice did not persist.');
        profile=decoded;
      }
      const previousArmy=campaignArmy(profile), prepared=prepareCampaignMission(profile);
      profile=prepared.profile;
      const deployed=profile.active!.deployedIds;
      const carry=deployed.map(id=>{
        const before=previousArmy.find(soldier=>soldier.entity.id===id)!.entity;
        const after=prepared.session.state.entities.find(entity=>entity.id===id)!;
        return {id,role:after.role,oldRole:before.role,oldMaxHp:before.maxHp,newMaxHp:after.maxHp,healed:after.hp===after.maxHp,oldMaxShield:before.maxShield??0,newMaxShield:after.maxShield??0};
      });
      if(carry.some(soldier=>soldier.role!==soldier.oldRole||soldier.oldMaxHp!==soldier.newMaxHp||soldier.oldMaxShield!==soldier.newMaxShield||!soldier.healed)) throw new Error('A deployed survivor changed identity or permanent stats.');
      const initialIds=prepared.session.state.entities.filter(entity=>entity.side===0&&entity.kind==='unit'&&!entity.illusion&&!entity.raised).map(entity=>entity.id);
      const reserves=previousArmy.filter(soldier=>!deployed.includes(soldier.entity.id)).map(soldier=>soldier.entity.id);
      solveMission(prepared.session);
      const recording=prepared.recorder.archive();prepared.recorder.destroy();
      const archivePath=resolve(archiveDirectory,`${campaign.faction}-${chapter+1}.json`);
      writeFileSync(archivePath,JSON.stringify(recording)+'\n');
      const verified=verifyScenarioRecording(recording);
      const won=prepared.session.runtime.outcome==='won'&&verified.runtime.outcome==='won'&&scenarioChecksum(verified)===scenarioChecksum(prepared.session);
      if(!won) throw new Error(`Chapter ${chapter+1} did not produce a verified win: ${prepared.session.runtime.outcome}.`);
      const survivors=prepared.session.state.entities.filter(entity=>entity.side===0&&entity.kind==='unit'&&entity.hp>0&&!entity.illusion&&!entity.raised).map(entity=>entity.id);
      const casualties=initialIds.filter(id=>!survivors.includes(id));
      profile=completeCampaignMission(profile,prepared.session,recording);
      const appliedOnce=completeCampaignMission(profile,prepared.session,recording)===profile;
      const roster=campaignArmy(profile).map(soldier=>soldier.entity.id);
      if(casualties.some(id=>roster.includes(id))||reserves.some(id=>!roster.includes(id))) throw new Error('Roster retained a casualty or lost a reserve.');
      const decoded=decodeCampaignProfile(JSON.stringify(profile));
      const decodedSame=hash(decoded)===hash(profile);
      const finalChecksum=scenarioChecksum(prepared.session);
      chapters.push({missionId:prepared.session.definition.id,time:prepared.session.state.time,outcome:prepared.session.runtime.outcome,initialIds,deployedIds:deployed,reserveIds:reserves,carry,survivorIds:survivors,casualtyIds:casualties,rosterIds:roster,assertions:{journalRecomputed:won,carriedIdentityAndStats:carry.every(soldier=>soldier.role===soldier.oldRole&&soldier.oldMaxHp===soldier.newMaxHp&&soldier.oldMaxShield===soldier.newMaxShield&&soldier.healed),casualtiesRemoved:casualties.every(id=>!roster.includes(id)),reservesRetained:reserves.every(id=>roster.includes(id)),idempotentResult:appliedOnce,profileRoundtrip:decodedSame},journal:{archivePath,sha256:hash(recording),finalChecksum,commandCount:recording.commands.length},finalCheckpointSha256:hash(captureScenario(prepared.session))});
      profile=decoded;
    }
    const progress=campaignProgress(profile), expected=[campaign.chapters[0],campaign.chapters[1],choice.chapter3,campaign.chapters[3]];
    const assertions={fourVerifiedChapters:profile.history.length===4,selectedChapterUsed:JSON.stringify(progress.completed)===JSON.stringify(expected),choicePersisted:profile.choiceId===choice.id,finished:progress.finished&&nextCampaignMission(profile)===null,chapterAssertions:chapters.every(chapter=>Object.values(chapter.assertions).every(Boolean))};
    const profilePath=resolve(archiveDirectory,`${campaign.faction}-profile.json`);
    writeFileSync(profilePath,JSON.stringify(profile)+'\n');
    results.push({campaignId:campaign.id,profileId:profile.id,choiceId:profile.choiceId,assertions,progress,chapters,profilePath,profileSha256:hash(profile)});
    console.log(`${campaign.id}: ${assertions.finished?'finished':'unfinished'}, ${chapters.length} verified chapters, ${chapters.reduce((sum,chapter)=>sum+chapter.deployedIds.length,0)} carried deployments`);
  } catch(error) {results.push({campaignId:campaign.id,profileId:profile.id,choiceId:profile.choiceId,chapters,error:String(error)});console.log(`${campaign.id}: ${String(error)}`);}
}
const sourceFiles=['src/core/campaign.ts','src/core/scenarios.ts','src/core/scenario-recordings.ts','src/scenarios/campaigns.ts','scripts/scenarios/mission-strategy.ts','scripts/scenarios/puzzle-stealth-strategy.ts','scripts/scenarios/route-strategy.ts','scripts/scenarios/finale-strategy.ts','scripts/scenarios/prove-alternate-profiles.ts'];
mkdirSync(resolve(output,'..'),{recursive:true});
writeFileSync(output,JSON.stringify({format:'orcs-vs-fairies-campaign-progression-proof',version:2,route,generatedAt:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceFiles:Object.fromEntries(sourceFiles.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')])),profiles:results},null,2)+'\n');
console.log(output);
if(results.some(result=>'error' in result||!Object.values(result.assertions??{}).every(Boolean))) process.exitCode=1;
