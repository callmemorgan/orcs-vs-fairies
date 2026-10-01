import { mountEconomyTools } from './ui/EconomyTools';
import { observeEconomy } from './core/economy';
import { isVisible } from './core/simulation';
import Phaser from 'phaser';
import GameScene, { project, unproject } from './game/GameScene';
import { createPerformanceGame, countPerformanceUnits, FrameCollector, PERFORMANCE_CENTER } from './qa/performance';
import { alliedAiStatus, createGame, createMatch, issueCommand, isGameOver } from './core/simulation';
import { createScenario, scenarioSessionForState } from './core/scenarios';
import { ScenarioOverlay } from './game/ScenarioOverlay';
import { ScenarioCampaignHost } from './ui/ScenarioCampaignHost';
import { ContentLibrary, productionQueueKey, upgradeFor, factionFor, createContentBundle, decodeContentPackage } from './core/content-registry';
import { mountModLibrary } from './ui/ModLibrary';
import { mountEditorTools } from './ui/EditorTools';
import { createEditedMatch } from './editor/launch';
import { canonicalMapHash } from './editor/map-package';
import { decodeScenarioPackage } from './editor/scenario-package';
import { mountCommunityBrowser } from './ui/CommunityBrowser';
import { CommunityLibrary } from './online/community-client';
import { communityPackageValidators } from './editor/package-validation';
import type { MapPackage } from './editor/map-package';
import { mountShell } from './ui/Hud';
import { mountWorldBiome, mountWorldTools } from './ui/WorldTools';
import { mountObjectivePanel } from './ui/ObjectivePanel';
import type { HudCallbacks } from './ui/Hud';
import type { FactionId, MapSize, GameState, Side, UpgradeId } from './core/types';
import { mountSessionTools } from './ui/SessionTools';
import type { SessionAnalysis, ReplaySpeed } from './ui/SessionTools';
import { CONTROL_ACTIONS, ControlProfiles, displayBinding, parseDisplayedBinding } from './game/Controls';
import type { ControlAction } from './game/Controls';
import { GAMEPAD_HELP } from './game/Gamepad';
import { MatchRecorder, ReplayPlayer, decodeReplay, replayRulesCompatible } from './core/replays';
import type { ReplayArchive, AnalysisSample, ArmySample, TechnologyTiming } from './core/replays';
import { SaveRepository, createSessionFile, decodeSessionFile, createBugReport } from './core/session-storage';
import type { SessionFile, SessionPlanning } from './core/session-storage';
import { OnlineApi, OnlineMatchConnection } from './online/client';
import { observationToRenderState } from './online/render-state';
import type { OnlineRenderState } from './online/render-state';
import { mountOnlineLobby } from './ui/OnlineLobby';
import type { OnlineMatchRequest } from './ui/OnlineLobby';
import { mountPlanningSession } from './game/PlanningSession';
import type { PlanningEditContext } from './game/PlanningSession';
import { SkirmishOptions } from './ui/SkirmishOptions';
import { SkirmishRoster } from './ui/SkirmishRoster';
import { mountTeamAITools } from './ui/TeamAITools';
import { normalizeAiConfig } from './core/ai-policy';
import { PlayerView } from './core/observation';
import { mountPracticeCoach } from './ui/PracticeCoach';
import { mountTournamentDashboard } from './ui/TournamentDashboard';
import { createTournamentDashboardSource } from './tournament/client';
import './ui/style.css';
declare const __OVF_BUILD_ID__:string;

const editedPackages=new WeakMap<GameState,{packageHash:string;worldHash:string;label?:string}>();
let game:Phaser.Game|undefined;
let scene:GameScene|undefined;
let scenarioOverlay:ScenarioOverlay|undefined;
let retiring:Phaser.Game|undefined;
let faction:FactionId='orcs';
let opponent:FactionId='fairies';
const benchmark=location.hostname==='127.0.0.1'&&new URLSearchParams(location.search).get('benchmark')==='1';
let collector=new FrameCollector();
let benchmarkCentered=false;
let renderDensity=1;
const root=document.querySelector<HTMLElement>('#app')!;
const shell=mountShell(root,start);
const setupHost=document.createElement('section');root.querySelector('.begin-match')!.before(setupHost);
let roster:SkirmishRoster;
const menuFaction=()=>root.querySelector<HTMLElement>('[data-faction].selected')!.dataset.faction as FactionId;
const menuOpponent=()=>root.querySelector<HTMLSelectElement>('#opponent')!.value as FactionId;
const aiOptions=new SkirmishOptions(setupHost,normalizeAiConfig(),config=>roster?.updateDefaults(menuFaction(),menuOpponent(),config));
roster=new SkirmishRoster(setupHost);roster.updateDefaults(menuFaction(),menuOpponent(),aiOptions.value);
for(const button of Array.from(root.querySelectorAll<HTMLElement>('[data-faction]')))button.addEventListener('click',()=>roster.updateDefaults(menuFaction(),menuOpponent(),aiOptions.value));
root.querySelector('#opponent')!.addEventListener('change',()=>roster.updateDefaults(menuFaction(),menuOpponent(),aiOptions.value));
const modLibrary=new ContentLibrary();
try{const installed=localStorage.getItem('ovf-mod-library-v1');if(installed)modLibrary.restore(JSON.parse(installed));}catch(error){console.error('Installed mods could not be restored',error);}
roster.setContent(modLibrary.bundle());
mountModLibrary(root.querySelector<HTMLElement>('.menu-content')!,{installed:()=>modLibrary.list(),install:input=>{const admitted=modLibrary.install(input);localStorage.setItem('ovf-mod-library-v1',JSON.stringify(modLibrary.list()));roster.setContent(modLibrary.bundle());return admitted;},launch:id=>{const size=root.querySelector<HTMLSelectElement>('#map-size')!.value as MapSize,seed=Number(root.querySelector<HTMLInputElement>('#map-seed')!.value);start(id as FactionId,root.querySelector<HTMLSelectElement>('#opponent')!.value as FactionId,size,seed);}});
const selectedBiome=mountWorldBiome(root.querySelector<HTMLElement>('.map-settings')??root.querySelector<HTMLElement>('#map-size')!.parentElement!);
const controls=new ControlProfiles();
const saves=new SaveRepository(localStorage);
let recorder:MatchRecorder|undefined,replay:ReplayPlayer|undefined;
let replayPlaying=false;
let replayComplete=false;
let replaySpeed:ReplaySpeed=1,replayPerspective:Side=0,replayAccumulated=0,replayClock=performance.now();
let sessionModal=false,modalScene:GameScene|undefined,pausedBeforeModal=false;
let objectiveOpen=false;
const openModals=new Set<string>();
let onlineConnection:OnlineMatchConnection|undefined,onlineRender:OnlineRenderState|undefined;
let onlineConnecting:OnlineMatchConnection|undefined;
const onlineApi=new OnlineApi();
let lastAutosaveTime=0,autosaveFailure=false,replacementGeneration=0;
const playerSide=():Side=>scene?.viewSide??0;
const callbacks:HudCallbacks={
 economyReserved:()=>onlineRender?.economy?.recruits.length??scene?.state.economy?.recruits.filter(r=>r.side===playerSide()).length??0,
 build:(role,definitionId)=>{scene?.setBuildRole(role,definitionId);shell.notice('Choose a clear location on explored ground. Right-click to cancel.');},
 train:(role,definitionId)=>{if(!scene)return;const id=scene.selected.find(id=>scene!.state.entities.some(e=>e.id===id&&e.side===playerSide()&&e.kind==='building'&&e.role===(role==='worker'?'hq':'barracks')));if(id===undefined||!scene.command({type:'train',id,role,definitionId}))shell.notice('Cannot recruit: check resources, population, and production building.');},
 cancelTrain:(id,index,expectedQueue)=>{if(!scene||scene.paused)return;const producer=scene.state.entities.find(e=>e.id===id);if(!producer||productionQueueKey(producer)!==expectedQueue)return;if(scene.command({type:'cancelTrain',id,index})){shell.update(scene.state,scene.selected,callbacks);shell.notice('Recruitment canceled. Resources refunded.');}},
 research:(upgrade,building)=>{if(!scene||scene.paused)return;const id=building??scene.selected.find(id=>scene!.state.entities.some(e=>e.id===id&&e.side===playerSide()&&e.kind==='building'&&e.role===upgradeFor(scene!.state,playerSide(),upgrade).building));if(id===undefined||!scene.command({type:'research',id,upgrade}))shell.notice('Cannot research: check resources and the production building.');},
 toggleGate:()=>{
  if(!scene||scene.paused)return;
  const gates=scene.state.entities.filter(e=>scene!.selected.includes(e.id)&&e.side===playerSide()&&e.role==='gate'&&e.hp>0&&e.progress===1),closing=gates.some(e=>e.gateOpen);
  const ids=gates.filter(e=>!!e.gateOpen===closing).map(e=>e.id);
  if(!scene.command({type:'toggleGate',ids}))shell.notice('Clear the doorway before closing the gate.');
  shell.update(scene.state,scene.selected,callbacks);
 },
 clearRally:()=>{if(scene&&!scene.paused&&scene.command({type:'clearRally',ids:scene.selected}))shell.update(scene.state,scene.selected,callbacks);},
 command:command=>scene?.command(command)??false,
 engineerBuild:kind=>{scene?.beginEngineerBuild(kind);},
 fieldRepair:()=>{scene?.beginFieldRepair();},
 ability:()=>{if(scene&&!scene.useAbility())shell.notice('No selected ability is ready or has an eligible target.');},
 hold:()=>{scene?.holdPosition();},
 attackMove:()=>scene?.beginAttackMove(),
 select:ids=>scene?.selectEntities(ids),
 stop:()=>{if(scene)scene.command({type:'stop',ids:scene.selected});},
 pause:()=>{if(scene)scene.togglePause();},
 restart:()=>{replacementGeneration++;campaignHost.clear();closeOnline();recorder?.dispose();recorder=undefined;replay?.dispose();replay=undefined;retireGame();shell.showMenu();tools.update(null);},
 toggleMuted:()=>scene?.toggleMuted(),
 isMuted:()=>scene?.muted??false,
 isPaused:()=>scene?.paused??false,
 isReplay:()=>!!replay,
 canCommand:()=>!!scene&&!scene.readOnly&&!scene.photoMode&&!scene.state.eliminated[playerSide()]&&!isGameOver(scene.state),
 canPause:()=>!onlineConnection,
 isInspection:()=>!!replay||!!scene?.readOnly,
 resourceMemory:()=>onlineRender?.resourceMemory,
 side:playerSide,
 level:()=>scene?.viewLevel??0,
 bindingLabel:action=>controls.bindingsFor(action as ControlAction).map(displayBinding).join(' / '),
 center:(x,y)=>scene?.centerOn(x,y),
 groups:()=>scene?.controlGroups()??{},
 recallGroup:group=>scene?.recallGroup(group),
 cameraCorners:()=>{if(!scene?.cameras?.main)return [];const c=scene.cameras.main;const {top,bottom}=shell.battlefieldBounds();return [[0,top],[innerWidth,top],[innerWidth,bottom],[0,bottom]].map(([x,y])=>{const p=c.getWorldPoint(x*renderDensity,y*renderDensity);return unproject(p.x,p.y);});}

};
function closeOnline(){onlineConnecting?.dispose();onlineConnecting=undefined;onlineConnection?.dispose();onlineConnection=undefined;onlineRender=undefined;}
function setModal(source:string,open:boolean){
 const wasOpen=!!openModals.size;
 if(open)openModals.add(source);else openModals.delete(source);
 sessionModal=!!openModals.size;
 if(sessionModal&&!wasOpen){modalScene=scene;pausedBeforeModal=scene?.paused??false;}
 if(scene){scene.inputBlocked=sessionModal||objectiveOpen;if(sessionModal)scene.paused=true;else if(wasOpen)scene.paused=replay?!replayPlaying:scene===modalScene?pausedBeforeModal:false;shell.update(scene.state,scene.selected,callbacks);}
 if(!sessionModal)modalScene=undefined;
}
function dispatchCommand(side:Side,command:Parameters<typeof issueCommand>[2]):boolean {
 if(!scene||scene.readOnly||replay||scene.photoMode||side!==playerSide()||scene.state.eliminated[side]||isGameOver(scene.state))return false;
 return onlineConnection?onlineConnection.dispatch(command):issueCommand(scene.state,side,command);
}
async function joinOnline(request:OnlineMatchRequest){
 const generation=++replacementGeneration;let latest:OnlineRenderState|undefined;
 onlineConnecting?.dispose();
 const connection=new OnlineMatchConnection({api:onlineApi,...request,
  onObservation:view=>{latest=observationToRenderState(view,request.role);if(onlineConnection===connection){onlineRender=latest;scene?.applyRemoteFrame(latest);}},
  onStatus:(_status,message)=>{if(onlineConnection===connection||onlineConnecting===connection)shell.notice(message);},
  onReceipt:receipt=>{if(onlineConnection!==connection)return;shell.notice(receipt.accepted?'The server accepted the order.':`The server rejected the order (${receipt.reason??'unavailable'}).`);},
  onNotice:message=>{if(onlineConnection===connection||onlineConnecting===connection)shell.notice(message);}
 });
 onlineConnecting=connection;
 try {await connection.connect();await connection.waitForSnapshot(45000);if(generation!==replacementGeneration||!latest)throw new Error('Another match replaced this connection request.');campaignHost.clear();launch(latest.state,undefined,undefined,{connection,render:latest},generation);}
 catch(error){connection.dispose();if(onlineConnecting===connection)onlineConnecting=undefined;throw error;}
}
function retireGame(onDestroyed?:()=>void){
 resetCoach();
 scenarioOverlay?.destroy();scenarioOverlay=undefined;
 objectives.close();
 if(retiring){retiring.events.once(Phaser.Core.Events.DESTROY,()=>onDestroyed?.());return;}
 if(!game){onDestroyed?.();return;}
 if(scene){scene.paused=true;scene.input.keyboard?.removeAllListeners('keydown');}
 const previous=game;game=undefined;scene=undefined;retiring=previous;
 previous.events.once(Phaser.Core.Events.DESTROY,()=>{if(retiring===previous)retiring=undefined;onDestroyed?.();});
 previous.destroy(true);
}
function start(next:FactionId,nextOpponent:FactionId=opponent,mapSize:MapSize="medium",seed=4127){
 try {
  const custom=next.includes(':')||nextOpponent.includes(':');
  roster.setContent(modLibrary.bundle());
  const state=benchmark?createPerformanceGame():custom||roster.enabled?createMatch({...(custom||modLibrary.list().length?{content:modLibrary.bundle()}:{}),map:{seed,size:mapSize,biome:selectedBiome()},players:roster.getPlayers(next,nextOpponent,aiOptions.value),rules:roster.getRules()}):createGame(next,seed,nextOpponent,{mapSize,biome:selectedBiome(),ai:[{},aiOptions.value]});
  campaignHost.clear();replacementGeneration++;launch(state);
 }catch(error){shell.notice(error instanceof Error?error.message:'Cannot start this skirmish.');}
}
/** Launch an admitted editor mission through the normal application host. */
export function launchAuthoredScenario(definition:unknown,label?:string):GameState {
 const session=createScenario(definition);campaignHost.clear();replacementGeneration++;launch(session.state);
 shell.notice(label??session.definition.title);return session.state;
}
function launch(state:GameState,history?:ReplayArchive,playback?:ReplayPlayer,remote?:{connection:OnlineMatchConnection;render:OnlineRenderState},generation=replacementGeneration,planningData?:SessionPlanning,inspectionReason?:string){
 if(generation!==replacementGeneration){remote?.connection.dispose();playback?.dispose();return;}
 if(game||retiring){retireGame(()=>launch(state,history,playback,remote,generation,planningData,inspectionReason));return;}
 if(onlineConnection!==remote?.connection){onlineConnection?.dispose();onlineConnection=remote?.connection;onlineRender=remote?.render;}
 if(remote&&onlineConnecting===remote.connection)onlineConnecting=undefined;
 recorder?.dispose();replay?.dispose();replay=playback;recorder=playback||remote||inspectionReason?undefined:new MatchRecorder(state,history);
 faction=state.players[0].faction;opponent=state.players[1]?.faction??faction;lastAutosaveTime=state.time;autosaveFailure=false;
 replayPlaying=false;replayAccumulated=0;replayClock=performance.now();shell.showGame();
 const human=state.controllers.findIndex(c=>c==='human'),external=state.controllers.findIndex(c=>c==='external');
 const side=(remote?remote.render.localSide:playback?replayPerspective:human>=0?human:external>=0?external:0) as Side;
 if(benchmark){collector=new FrameCollector();benchmarkCentered=false;}
 // Phaser scales the canvas in CSS; use a physical-pixel game size and
 // matching camera zoom so high-DPI displays do not stretch a low-res buffer.
 renderDensity=Math.min(2,Math.max(1,window.devicePixelRatio||1));
 scene=new GameScene({state,controls,viewSide:side,readOnly:!!playback||!!inspectionReason||remote?.render.role==='spectator',simulationEnabled:!playback&&!remote&&!inspectionReason,remoteFrame:remote?.render,pixelDensity:renderDensity,
  onCommand:(side,command)=>!sessionModal&&dispatchCommand(side,command),
  onSelection:ids=>{if(scene)shell.update(scene.state,ids,callbacks);},onNotice:text=>shell.notice(text),onReady:()=>{shell.ready();if(scene&&scenarioSessionForState(scene.state))scenarioOverlay=new ScenarioOverlay(scene,project);if(inspectionReason)shell.notice(inspectionReason);},
  onStep:()=>{campaignHost.step();planning.update({blocked:planningBlocked()});maybeAutosave();},onPhotoMode:enabled=>{root.classList.toggle('photo-mode',enabled);photoControls.hidden=!enabled;campaignHost.update({photo:enabled});planning.update({blocked:planningBlocked()});},
  onPause:()=>{if(scene){if(replay)replayPlaying=!scene.paused;shell.update(scene.state,scene.selected,callbacks);}},onActionSlot:slot=>{shell.activateActionSlot(slot);},
  viewBounds:()=>{const b=shell.battlefieldBounds();return {top:b.top*renderDensity,bottom:b.bottom*renderDensity};}});
 scene.inputBlocked=sessionModal||objectiveOpen;scene.paused=!!playback||!!inspectionReason||sessionModal;
 planning.reset(state);if(planningData&&!planning.restore(planningData,state))throw new Error('Saved construction planning could not be restored.');planning.update({blocked:planningBlocked()});
 game=new Phaser.Game({type:Phaser.AUTO,parent:'game-canvas',backgroundColor:'#14201e',antialias:true,roundPixels:false,scale:{mode:Phaser.Scale.FIT,width:Math.round(innerWidth*renderDensity),height:Math.round(innerHeight*renderDensity)},scene:[scene],render:{pixelArt:false,smoothPixelArt:true},fps:{target:60}});
 const currentGame=game,density=renderDensity;
 const resize=()=>currentGame.scale.setGameSize(Math.round(innerWidth*density),Math.round(innerHeight*density));
 window.addEventListener('resize',resize);
 currentGame.events.once(Phaser.Core.Events.DESTROY,()=>window.removeEventListener('resize',resize));
 if(benchmark)game.events.on('postrender',()=>{
  if(!scene||!game||!scene.cameras.main||scene.state.time<=0)return;
  if(!benchmarkCentered){scene.centerOn(PERFORMANCE_CENTER.x,PERFORMANCE_CENTER.y);benchmarkCentered=true;return;}
  const camera=scene.cameras.main,canvas=game.canvas,rect=canvas.getBoundingClientRect();
  const gl=game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer?game.renderer.gl:null;
  const phase=collector.record(performance.now(),{
   units:countPerformanceUnits(scene.state,e=>{const p=project(e.x,e.y);return camera.worldView.contains(p.x,p.y);}),
   viewport:{width:innerWidth,height:innerHeight},canvas:{width:rect.width,height:rect.height},
   drawingBuffer:{width:gl?.drawingBufferWidth??canvas.width,height:gl?.drawingBufferHeight??canvas.height},
   devicePixelRatio,renderDensity,documentVisible:document.visibilityState==='visible',artLoaded:scene.artStatus.loaded&&scene.artStatus.renderedUnits===100,paused:scene.paused
  });
  if(phase==='complete')scene.paused=true;
 });
 shell.update(state,[],callbacks);
}
function currentArchive():ReplayArchive {
 if(onlineConnection)throw new Error('Online replay exports are not available in this client yet.');
 if(replay)return replay.exportCurrent();
 if(!recorder||!scene)throw new Error('Start or load a match first.');
 return recorder.export();
}
function currentFile():SessionFile {
 if(!scene)throw new Error('Start or load a match first.');
 if(onlineConnection)throw new Error('Online matches are saved by the server. Local save exports are available for local matches.');
 return createSessionFile(scene.state,scene.readOnly&&!replay?undefined:currentArchive(),planning.snapshot()??undefined,campaignHost.snapshot());
}
function maybeAutosave(force=false){
 if(!scene||!recorder||replay||benchmark||autosaveFailure)return;
 try {
  const settings=saves.getAutosave();if(!settings.enabled||!force&&scene.state.time-lastAutosaveTime<settings.intervalSeconds)return;
  saves.save('Autosave',currentFile(),true);lastAutosaveTime=scene.state.time;
 }catch(error){autosaveFailure=true;shell.notice(`Autosave stopped: ${error instanceof Error?error.message:'storage is unavailable'}`);}
}
async function verifyArchive(archive:ReplayArchive):Promise<{player:ReplayPlayer;complete:boolean}> {
 const player=new ReplayPlayer(archive);
 try {while(!player.finished){player.advance(100);await new Promise<void>(resolve=>setTimeout(resolve,0));}player.archive.analysis=player.analysis;player.archive.technologies=player.technologyTimings;return {player,complete:isGameOver(player.state)};}
 finally {player.dispose();}
}
async function importReplay(input:unknown){
 const source=decodeReplay(input),request=++replacementGeneration,verified=await verifyArchive(source);
 if(request!==replacementGeneration)throw new Error('Another replay load replaced this request.');
 const player=verified.player.forkForSeek(source.initial.state.tick);
 campaignHost.clear();replayPerspective=0;replayComplete=verified.complete;launch(player.state,undefined,player);
}
async function installFile(input:unknown){
 const {file,state}=decodeSessionFile(input),request=++replacementGeneration;
 const oldHistory=file.replay&&!replayRulesCompatible(file.replay);
 if(file.replay&&!oldHistory)file.replay=(await verifyArchive(file.replay)).player.archive;
 if(request!==replacementGeneration)throw new Error('Another match load replaced this request.');
 const inspectionReason=campaignHost.install(file.scenarioProfile,state);
 launch(state,oldHistory?undefined:file.replay,undefined,undefined,request,file.planning,inspectionReason??undefined);
 if(oldHistory)shell.notice('Saved match loaded. Its replay uses older simulation rules; new replay history starts from this save.');
}
function analysisView(samples:AnalysisSample[],complete:boolean,timings:TechnologyTiming[]):SessionAnalysis {
 const technologies=timings.map(t=>({side:t.side,tick:t.tick,time:t.time,name:(()=>{try{return upgradeFor(scene!.state,t.side,t.upgrade as UpgradeId).name;}catch{return undefined;}})()??t.upgrade}));
 const player=(p:ArmySample)=>({wood:p.wood,ore:p.ore,crystal:p.crystal,army:p.units,losses:p.losses,gathered:p.gathered,buildings:p.buildings,armyValue:p.armyValue,buildingLosses:p.buildingLosses,lostValue:p.lostValue});
 return {complete,samples:samples.map<SessionAnalysis['samples'][number]>(s=>({tick:s.tick,time:s.time,players:s.players.map(player)})),technologies,playerNames:scene?.state.players.map((_p,side)=>factionFor(scene!.state,side as Side).name)};
}
function productionCommand(command:Parameters<typeof issueCommand>[2],expectedQueue?:string):boolean {
 if(!scene||replay||scene.photoMode)return false;
 if(expectedQueue!==undefined){if(!('id' in command))return false;const building=scene.state.entities.find(e=>e.id===command.id);if(!building||productionQueueKey(building)!==expectedQueue)return false;}
 const accepted=dispatchCommand(playerSide(),command);
 if(accepted)shell.update(scene.state,scene.selected,callbacks);return accepted;
}
const tools=mountSessionTools(root,{
 listSaves:()=>saves.list().map(s=>({id:s.id,name:s.name,savedAt:s.updatedAt,autosave:s.autosave})),
 save:name=>{saves.save(name,currentFile());},load:async id=>{await installFile(saves.load(id).file);},deleteSave:id=>saves.delete(id),
 importSave:installFile,exportSave:currentFile,
 getAutosave:()=>saves.getAutosave(),setAutosave:settings=>{saves.setAutosave(settings);autosaveFailure=false;lastAutosaveTime=scene?.state.time??0;},
 getReplay:()=>replay&&scene?{initialTick:replay.archive.initial.state.tick,tick:replay.state.tick,totalTicks:replay.archive.finalTick,playing:replayPlaying&&!replay.finished,speed:replaySpeed,perspective:replayPerspective,roster:scene.state.players.map((_p,id)=>({id:id as Side,name:factionFor(scene!.state,id as Side).name}))}:null,
 importReplay,
 exportReplay:()=>replay?.archive??currentArchive(),
 seekReplay:async tick=>{
  if(!replay||!scene)throw new Error('Import a replay first.');
  if(!Number.isSafeInteger(tick)||tick<replay.archive.initial.state.tick||tick>replay.archive.finalTick)throw new Error('Seek tick is outside this replay.');
  const target=replay,request=++replacementGeneration;replayPlaying=false;scene.paused=true;
  const candidate=target.forkForSeek(tick);
  try {while(candidate.state.tick<tick){candidate.advance(Math.min(100,tick-candidate.state.tick));await new Promise<void>(resolve=>setTimeout(resolve,0));if(request!==replacementGeneration)throw new Error('Replay seek was replaced by another request.');}}
  catch(error){candidate.dispose();throw error;}
  if(!scene||replay!==target){candidate.dispose();throw new Error('Replay is no longer active.');}
  target.dispose();replay=candidate;scene.restart(candidate.state);scene.paused=true;scene.inputBlocked=sessionModal;replayAccumulated=0;
 },
 setReplayPlaying:playing=>{if(!replay||!scene)throw new Error('Import a replay first.');if(playing&&replay.finished)throw new Error('Seek to an earlier tick before playing.');replayPlaying=playing;scene.paused=sessionModal||!playing;replayClock=performance.now();},
 setReplaySpeed:speed=>{if(![.25,.5,1,2,4].includes(speed))throw new Error('Unsupported playback speed.');replaySpeed=speed;},
 setReplayPerspective:side=>{if(!replay||!scene)throw new Error('Import a replay first.');replayPerspective=side;scene.viewSide=side;},
 getAnalysis:()=>{if(replay)return analysisView(replay.archive.analysis,replayComplete,replay.archive.technologies);if(!scene||!recorder||scene.state.winner===null&&!scene.state.draw)return null;return analysisView(recorder.analysis,true,recorder.technologyTimings);},
 train:(id,role,definitionId)=>productionCommand({type:'train',id,role,definitionId}),cancelTrain:(id,index,expected)=>productionCommand({type:'cancelTrain',id,index},expected),
 reorderTrain:(id,from,to,expected)=>productionCommand({type:'reorderTrain',id,from,to},expected),
 selectBuilding:id=>{scene?.selectEntities([id]);const building=scene?.state.entities.find(e=>e.id===id);if(building)scene?.centerOn(building.x,building.y);},
 getBindings:()=>CONTROL_ACTIONS.map(a=>({action:a.id,label:a.label,key:controls.bindingsFor(a.id).map(displayBinding).join(' or ')})),
 getBindingProfiles:()=>controls.profiles,
 setBinding:(action,key)=>{const keys=key.split(/\s+or\s+/).map(parseDisplayedBinding);if(keys.some(k=>!k))throw new Error('Choose a valid key combination.');const result=controls.setBinding(action as ControlAction,keys as string[]);if(!result.ok)throw new Error(result.error);if(controls.persistenceError)throw new Error(controls.persistenceError);},
 saveBindingProfile:name=>{const result=controls.saveProfile(name);if(!result.ok)throw new Error(result.error);if(controls.persistenceError)throw new Error(controls.persistenceError);},
 loadBindingProfile:name=>controls.selectProfile(name),resetBindings:()=>controls.resetDefaults(),getGamepadHelp:()=>GAMEPAD_HELP,
 photoExitHint:()=>`Press ${controls.bindingsFor('cancel').map(displayBinding).join(' or ')||'Photo mode'} or Select / View to leave photo mode.`,
 bugReport:description=>{if(!scene)throw new Error('Start or load a match first.');return createBugReport(description,scene.state,currentArchive(),{renderDensity,viewport:{width:innerWidth,height:innerHeight},fps:game?.loop.actualFps,art:scene.artStatus,userAgent:navigator.userAgent},__OVF_BUILD_ID__,planning.snapshot()??undefined);},
 photo:()=>{if(scene)scene.setPhotoMode(!scene.photoMode);},
 onModal:open=>setModal('session',open)
});
const sessionToolbar=root.querySelector<HTMLElement>('.session-toolbar')!;
const campaignHost=new ScenarioCampaignHost(root,sessionToolbar,{
 state:()=>scene?.state??null,launch:(session,reason)=>{replacementGeneration++;launch(session.state,undefined,undefined,undefined,replacementGeneration,undefined,reason);},
 menu:()=>{replacementGeneration++;closeOnline();recorder?.dispose();recorder=undefined;replay?.dispose();replay=undefined;retireGame(()=>shell.showMenu());tools.update(null);},
 select:ids=>scene?.selectEntities(ids),center:(x,y)=>scene?.centerOn(x,y),notice:shell.notice,visibility:open=>setModal('campaign',open),inspection:()=>replay?'Replay inspection is read-only.':null,
});
const canSubmitObjectives=()=>!!scene&&!scene.paused&&!scene.readOnly&&!scene.photoMode&&!sessionModal&&!isGameOver(scene.state)&&!scene.state.eliminated[playerSide()];
const objectives=mountObjectivePanel(root,{toolbar:sessionToolbar,getState:()=>scene?.state,getObservation:()=>scene?.objectiveObservation,getContent:()=>scene?.state.content,side:playerSide,blocked:()=>!!scene?.photoMode||sessionModal,onVisibility:open=>{objectiveOpen=open;if(scene)scene.inputBlocked=sessionModal||objectiveOpen;},canSubmit:canSubmitObjectives,submit:command=>canSubmitObjectives()&&dispatchCommand(playerSide(),command)});
mountOnlineLobby(root,{api:onlineApi,toolbar:sessionToolbar,onJoinMatch:joinOnline,onVisibility:open=>setModal('online',open)});
const teamAiTools=mountTeamAITools(root,{toolbar:sessionToolbar,command:command=>!teamAiBlocked()&&dispatchCommand(playerSide(),command),notice:shell.notice,onVisibility:open=>setModal('team-ai',open)});
function teamAiBlocked(){return !scene||!!replay||scene.readOnly||scene.photoMode||scene.state.eliminated[playerSide()]||isGameOver(scene.state)||Array.from(openModals).some(source=>source!=='team-ai')||(scene.paused&&(!openModals.has('team-ai')||pausedBeforeModal));}
const tournaments=mountTournamentDashboard(root,{source:createTournamentDashboardSource(),toolbar:sessionToolbar,onReplay:importReplay,onVisibility:open=>setModal('tournament',open)});
const packageBadge=document.createElement('p');packageBadge.className='editor-package-badge';packageBadge.setAttribute('aria-label','Running community package');packageBadge.hidden=true;root.append(packageBadge);
function rememberPackage(state:GameState,packageHash:string,worldHash:string,label?:string){editedPackages.set(state,{packageHash,worldHash,label});updatePackageBadge();}
function updatePackageBadge(){const value=scene&&editedPackages.get(scene.state);packageBadge.textContent=value?.label??'';packageBadge.hidden=!value?.label;}
function editorBlocked(source:string){return !!scene?.photoMode||Array.from(openModals).some(open=>open!==source);}
const communityLibrary=new CommunityLibrary({validators:communityPackageValidators});
const editor=mountEditorTools(root,{
 toolbar:sessionToolbar,blocked:()=>editorBlocked('editor'),onOpen:open=>setModal('editor',open),
 contentOptions:()=>[...(modLibrary.list().length?[{id:'local-mods',label:'Installed local mods',content:modLibrary.bundle()}]:[]),...communityLibrary.list().filter(record=>record.kind==='mod').map(record=>({id:record.hash,label:`${record.title} ${record.version}`,content:createContentBundle(communityLibrary.packagesFor(record.hash))}))],
 playMap:pkg=>{const state=createEditedMatch(pkg);campaignHost.clear();rememberPackage(state,pkg.hash,canonicalMapHash(pkg.map));replacementGeneration++;launch(state);},
 playScenario:pkg=>{const state=launchAuthoredScenario(pkg.scenario);rememberPackage(state,pkg.hash,pkg.map.contentHash);}
});
mountCommunityBrowser(root,{
 library:communityLibrary,toolbar:sessionToolbar,blocked:()=>editorBlocked('community'),onOpen:open=>setModal('community',open),
 getPublishedPackage:()=>editor.getMap(),getPublishedScenario:()=>editor.getScenarioPackage(),
 play:record=>{
  const label=`${record.title} · version ${record.version}`;
  if(record.kind==='scenario'){const pkg=decodeScenarioPackage(record.package),state=launchAuthoredScenario(pkg.scenario,label);rememberPackage(state,pkg.hash,pkg.map.contentHash,label);return;}
  const state=record.kind==='map'?createEditedMatch(record.package as MapPackage):(()=>{const pkg=decodeContentPackage(record.package);return createMatch({content:createContentBundle(communityLibrary.packagesFor(record.hash)),map:{seed:4127,size:'small'},players:[{id:0,teamId:0,factionId:pkg.factions[0].id,controller:'human'},{id:1,teamId:1,factionId:'orcs',controller:'ai',ai:aiOptions.value}]});})();
  campaignHost.clear();const pkg=record.package as {hash:string;contentHash?:string};rememberPackage(state,pkg.hash,pkg.contentHash??'',label);replacementGeneration++;launch(state);
 }
});
setInterval(updatePackageBadge,100);

function alignToolPanels(){root.style.setProperty('--tool-panel-top',`${Math.max(126,Math.ceil(sessionToolbar.getBoundingClientRect().bottom)+8)}px`);}
new ResizeObserver(alignToolPanels).observe(sessionToolbar);
new MutationObserver(alignToolPanels).observe(sessionToolbar.parentElement!,{attributes:true,attributeFilter:['class']});
window.addEventListener('resize',alignToolPanels);alignToolPanels();
function tournamentBlocked(){return !!scene?.photoMode||Array.from(openModals).some(source=>source!=='tournament');}
function planningBlocked(){return !!scene?.photoMode||Array.from(openModals).some(source=>source!=='planning');}
function canEditPlanning(side:Side,context:PlanningEditContext){
 if(!scene||replay||onlineConnection||scene.readOnly||scene.photoMode||isGameOver(scene.state)||scene.state.eliminated[side]||side!==playerSide()||planningBlocked())return false;
 return context==='dialog'||!scene.paused&&!sessionModal;
}
const planning=mountPlanningSession(root,{
 getState:()=>scene?.state??null,getSide:playerSide,canEdit:canEditPlanning,
 dispatch:(side,command)=>!!scene&&!onlineConnection&&!replay&&issueCommand(scene.state,side,command),
 selectedWorkerIds:()=>scene?.selected??[],onVisibility:open=>setModal('planning',open),
 beginPlacement:(role,point,cancel)=>{const current=scene;if(!current)throw new Error('Start a match before planning construction.');return current.beginBlueprintPlacement(role,point,cancel);},
 setBlueprints:(items,side)=>scene?.setBlueprints(items,side)
});
const coach=mountPracticeCoach(root,{focus:(ids,point)=>{
 if(!scene||onlineConnection||replay||sessionModal||scene.photoMode)return;
 const owned=ids.filter(id=>scene!.state.entities.some(entity=>entity.id===id&&entity.side===playerSide()&&entity.hp>0));
 scene.selectEntities(owned);if(point&&scene.cameras?.main)scene.centerOn(point.x,point.y);
}});
let coachState:GameState|undefined,coachSide:Side=0,coachView=new PlayerView(0),coachObservedAt=-Infinity;
function resetCoach(){coach.update(null);coachState=undefined;coachObservedAt=-Infinity;}
function updateCoach(){
 if(!scene||benchmark||onlineConnection||replay||scene.readOnly||scene.state.controllers[playerSide()]!=='human'||isGameOver(scene.state)){
  if(coachState)resetCoach();return;
 }
 const state=scene.state,side=playerSide();
 if(coachState!==state||coachSide!==side){resetCoach();coachState=state;coachSide=side;coachView=new PlayerView(side);}
 if(state.time-coachObservedAt<1)return;
 coachObservedAt=state.time;coach.update(coachView.observe(state));
}
function economyBlocked(){return !!scene?.photoMode||Array.from(openModals).some(source=>source!=='economy');}
let economyResourceView=new PlayerView(0);
const economyTools=mountEconomyTools(root,{
 getGame:()=>scene?.state??null,
 getView:()=>scene?onlineRender?.economy??observeEconomy(scene.state,playerSide(),{visible:(state,side,p)=>isVisible(state,side,p.x,p.y,p.level??0)}):null,
 knownResources:()=>{if(!scene)return [];if(onlineRender)return onlineRender.resourceMemory;if(economyResourceView.side!==playerSide())economyResourceView=new PlayerView(playerSide());return economyResourceView.resourcesFor(scene.state);},
 selectedIds:()=>scene?.selected??[],
 submit:command=>!economyBlocked()&&dispatchCommand(playerSide(),command),
 onModal:open=>setModal('economy',open)
});
const photoControls=document.createElement('section');photoControls.className='photo-controls';photoControls.hidden=true;
const photoHint=document.createElement('span');photoHint.textContent='Photo mode · Pan and zoom to compose your image';
const photoCapture=document.createElement('button');photoCapture.textContent='Download photo';photoCapture.onclick=()=>{
 if(!game||!scene?.photoMode)return;
 game.renderer.snapshot(image=>{if(!(image instanceof HTMLImageElement))return;const link=document.createElement('a');link.href=image.src;link.download=`orcs-vs-fairies-${scene?.state.tick??0}.png`;link.click();});
};
const photoExit=document.createElement('button');photoExit.textContent='Exit photo mode';photoExit.onclick=()=>scene?.setPhotoMode(false);
photoControls.append(photoHint,photoCapture,photoExit);root.append(photoControls);
setInterval(()=>{
 const now=performance.now(),elapsed=Math.min(.25,(now-replayClock)/1000);replayClock=now;
 if(!replay||!scene||scene.paused||scene.photoMode||replay.finished)return;
 replayAccumulated+=elapsed*20*replaySpeed;const ticks=Math.floor(replayAccumulated);if(!ticks)return;
 try {const advanced=replay.advance(ticks);replayAccumulated-=advanced;scene.state=replay.state;if(replay.finished){scene.paused=true;replayPlaying=false;}}
 catch(error){scene.paused=true;replayPlaying=false;shell.notice(`Replay stopped: ${error instanceof Error?error.message:'playback failed'}`);}
},16);
document.addEventListener('visibilitychange',()=>{if(document.hidden)maybeAutosave(true);});
window.addEventListener('pagehide',()=>maybeAutosave(true));
