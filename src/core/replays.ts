import { validateCommand } from './commands';
import { subscribeSimulation } from './history-hooks';
import { entityDefinition } from './content-registry';
import { saveGame, loadGame, SAVE_VERSION } from './saves';
import { issueCommand, stepGame, isGameOver } from './simulation';
import { LEGACY_SIMULATION_REVISIONS, SIMULATION_REVISION } from './versions';
import type { BuildingRole, Command, Entity, GameEvent, GameState, Side, UnitRole } from './types';

export type ReplayAction = {type:'command';side:Side;command:Command} | {type:'advance';dt:number;ticks:number};
export interface ArmySample {wood:number;ore:number;crystal:number;units:number;buildings:number;losses:number;gathered:number;upgrades:string[];armyValue?:number;buildingLosses?:number;lostValue?:number}
export interface AnalysisSample {tick:number;time:number;players:ArmySample[]}
export interface TechnologyTiming {side:Side;upgrade:string;tick:number;time:number}
export interface ReplayArchive {
  format:'orcs-vs-fairies/replay';version:1;
  initial:ReturnType<typeof saveGame>;
  actions:ReplayAction[];
  finalTick:number;finalChecksum:string;checksumVersion?:number;simulationRevision?:string;
  analysis:AnalysisSample[];
  technologies:TechnologyTiming[];
}
const FORMAT='orcs-vs-fairies/replay';
const MAX_TICKS=432_000;
const MAX_ACTIONS=100_000;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const exactKeys=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).every(k=>keys.includes(k));

/** A divergence check, not a signature or a claim of trusted authorship. */
export function replayChecksum(state:GameState,version=SAVE_VERSION):string {
  const saved=saveGame(state);
  if(![1,2,SAVE_VERSION].includes(version))throw new Error('Replay checksum version is unsupported by this build.');
  if(version===1&&state.players.length!==2)throw new Error('Legacy replay checksums require two players.');
  const legacy=saved as unknown as {version:number;state:Record<string,unknown>;runtime:Record<string,unknown>};
  legacy.version=version;
  if(version<3){
    delete legacy.state.aiConfigs;
    for(const key of ['aiDecisionAt','aiDecisionTurns','aiBatchTurns','knownEnemyUnits','retreating','producedFighters'])delete legacy.runtime[key];
  }
  if(version===1){
    // The two-player envelope remains readable; its checksum excludes fields added in v2.
    for(const key of ['teams','incomeFactors','populationLimits','sharedVision','eliminated','winningTeam'])delete legacy.state[key];
    delete legacy.runtime.clearedEnemyStarts;
  }
  const text=JSON.stringify(saved);let hash=2166136261;
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16).padStart(8,'0');
}

function entityValue(s:GameState,e:Entity):number {
  const cost=entityDefinition(s,e).cost;
  return cost.wood+cost.ore+cost.crystal;
}
function armySample(s:GameState,side:Side,losses:number,gathered:number,buildingLosses:number,lostValue:number):ArmySample {
  const p=s.players[side],living=s.entities.filter(e=>e.side===side&&e.hp>0&&!e.illusion&&!e.raised);
  const armyValue=living.filter(e=>e.kind==='unit'&&e.role!=='worker').reduce((sum,e)=>sum+entityValue(s,e),0);
  return {wood:p.wood,ore:p.ore,crystal:p.crystal,units:living.filter(e=>e.kind==='unit').length,buildings:living.filter(e=>e.kind==='building'&&e.progress===1).length,losses,gathered,armyValue,buildingLosses,lostValue,upgrades:[...p.upgrades]};
}

export class MatchRecorder {
  private initial:ReturnType<typeof saveGame>;
  private actions:ReplayAction[]=[];
  private samples:AnalysisSample[]=[];
  private losses:number[];
  private gathered:number[];
  private buildingLosses:number[];
  private lostValue:number[];
  private technologies:TechnologyTiming[]=[];
  private knownUpgrades:Set<string>[];
  private consumedEvents:WeakSet<GameEvent>;
  private sampledBucket=-1;
  private unsubscribe:()=>void;
  private error:string|null=null;
  constructor(private state:GameState,previous?:ReplayArchive) {
    this.consumedEvents=new WeakSet(state.events);
    this.knownUpgrades=state.players.map(p=>new Set(p.upgrades));
    this.losses=state.players.map(()=>0);this.gathered=state.players.map(()=>0);this.buildingLosses=state.players.map(()=>0);this.lostValue=state.players.map(()=>0);
    if(previous){
      const archive=decodeReplay(previous);
      if(!replayRulesCompatible(archive))throw new Error('Older replay history cannot be continued under the current simulation rules. Start new replay history from the saved match.');
      if(archive.finalTick!==state.tick||archive.finalChecksum!==replayChecksum(state,archive.checksumVersion??archive.initial.version))throw new Error('Saved replay does not match the saved game.');
      this.initial=saveGame(loadGame(archive.initial));this.actions=structuredClone(archive.actions);
      this.samples=structuredClone(archive.analysis).filter(sample=>{const bucket=this.sampleBucket(sample.time);if(bucket<=this.sampledBucket)return false;this.sampledBucket=bucket;return true;});
      this.technologies=structuredClone(archive.technologies);
      const last=archive.analysis.at(-1);if(last){this.losses=last.players.map(p=>p.losses);this.gathered=last.players.map(p=>p.gathered);this.buildingLosses=last.players.map(p=>p.buildingLosses??0);this.lostValue=last.players.map(p=>p.lostValue??0);}
    }else {this.initial=saveGame(state);this.sample(true);}
    this.unsubscribe=subscribeSimulation(state,{
      command:(side,command)=>{if(this.actions.length>=MAX_ACTIONS){this.fail('Replay command limit reached.');return;}this.actions.push({type:'command',side,command});this.collectEvents();this.sample(isGameOver(state));},
      step:dt=>{
        if(this.state.tick-this.initial.state.tick>MAX_TICKS){this.fail('Replay duration limit reached.');return;}
        const last=this.actions.at(-1);
        if(last?.type==='advance'&&last.dt===dt)last.ticks++;
        else if(this.actions.length<MAX_ACTIONS)this.actions.push({type:'advance',dt,ticks:1});
        else {this.fail('Replay command limit reached.');return;}
        this.collectEvents();
        for(const side of state.players.map((_,i)=>i as Side))for(const upgrade of state.players[side].upgrades){
          if(this.knownUpgrades[side].has(upgrade))continue;
          this.knownUpgrades[side].add(upgrade);this.technologies.push({side,upgrade,tick:state.tick,time:state.time});
        }
        this.sample(isGameOver(state));
      }
    });
  }
  private collectEvents(){
    const state=this.state;
    for(const event of state.events){
      if(this.consumedEvents.has(event))continue;
      this.consumedEvents.add(event);
      if(event.type==='death'){
        const entity=state.entities.find(e=>e.id===event.source);
        if(entity&&!entity.illusion&&!entity.raised){
          if(entity.kind==='unit')this.losses[event.side]++;else this.buildingLosses[event.side]++;
          // Death events preserve carried stock before economy cleanup transfers it into salvage.
          this.lostValue[event.side]+=entityValue(state,entity)+(event.amount??entity.carried);
        }
      }
      if(event.type==='gather')this.gathered[event.side]+=event.amount??0;
    }
  }
  private fail(message:string){this.error=message;this.unsubscribe?.();}
  private sampleBucket(time:number){return Math.floor((time-this.initial.state.time+1e-8)/5);}
  private sampleValue():AnalysisSample {return {tick:this.state.tick,time:this.state.time,players:this.state.players.map((_,side)=>armySample(this.state,side as Side,this.losses[side],this.gathered[side],this.buildingLosses[side],this.lostValue[side]))};}
  private sample(force=false){
    const bucket=this.sampleBucket(this.state.time);if(!force&&bucket<=this.sampledBucket)return;
    const sample=this.sampleValue();
    if(this.samples.at(-1)?.tick===sample.tick)this.samples[this.samples.length-1]=sample;else this.samples.push(sample);
    this.sampledBucket=bucket;
  }
  get failure(){return this.error;}
  get analysis(){const samples=structuredClone(this.samples),sample=this.sampleValue();if(samples.at(-1)?.tick===sample.tick)samples[samples.length-1]=sample;else samples.push(sample);return samples;}
  get technologyTimings(){return structuredClone(this.technologies);}
  export():ReplayArchive {
    if(this.error)throw new Error(this.error);
    return {format:FORMAT,version:1,checksumVersion:SAVE_VERSION,simulationRevision:SIMULATION_REVISION,initial:structuredClone(this.initial),actions:structuredClone(this.actions),finalTick:this.state.tick,finalChecksum:replayChecksum(this.state),analysis:this.analysis,technologies:this.technologyTimings};
  }
  dispose(){this.unsubscribe();}
}

export function decodeReplay(input:unknown):ReplayArchive {
  if(typeof input==='string'){if(input.length>20*1024*1024)throw new Error('Replay exceeds 20 MiB.');try{input=JSON.parse(input);}catch{throw new Error('Invalid replay JSON.');}}
  if(!record(input)||!exactKeys(input,['format','version','initial','actions','finalTick','finalChecksum','analysis','technologies','checksumVersion','simulationRevision'])||input.format!==FORMAT||input.version!==1)throw new Error('Unsupported replay format or version.');
  const initial=loadGame(input.initial);
  if(!record(input.initial)||!integer(input.initial.version)||![1,2,SAVE_VERSION].includes(input.initial.version)||input.checksumVersion!==undefined&&input.checksumVersion!==input.initial.version)throw new Error('Replay checksum version must match its original save version.');
  if(input.simulationRevision!==undefined&&(typeof input.simulationRevision!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(input.simulationRevision)))throw new Error('Invalid simulation rules revision.');
  const validSide=(side:unknown)=>integer(side)&&side<initial.players.length;
  if(!Array.isArray(input.actions)||input.actions.length>MAX_ACTIONS)throw new Error('Invalid replay actions.');
  let ticks=0;
  for(const action of input.actions){
    if(!record(action))throw new Error('Malformed replay action.');
    if(action.type==='command'){
      if(!exactKeys(action,['type','side','command'])||!validSide(action.side)||!validateCommand(action.command))throw new Error('Malformed replay command.');
    }else if(action.type==='advance'){
      if(!exactKeys(action,['type','dt','ticks'])||typeof action.dt!=='number'||!Number.isFinite(action.dt)||action.dt<=0||action.dt>.25||!integer(action.ticks)||action.ticks<1)throw new Error('Invalid replay timestep.');
      ticks+=action.ticks;if(ticks>MAX_TICKS)throw new Error('Replay exceeds six hours at 20 ticks per second.');
    }else throw new Error('Unknown replay action.');
  }
  if(!integer(input.finalTick)||input.finalTick!==initial.tick+ticks||typeof input.finalChecksum!=='string'||!/^[0-9a-f]{8}$/.test(input.finalChecksum))throw new Error('Invalid replay final state.');
  if(!Array.isArray(input.analysis)||input.analysis.length>MAX_TICKS+1)throw new Error('Invalid replay analysis.');
  let lastTick=initial.tick-1;
  for(const sample of input.analysis){
    if(!record(sample)||!exactKeys(sample,['tick','time','players'])||!integer(sample.tick)||sample.tick<=lastTick||sample.tick>input.finalTick||typeof sample.time!=='number'||!Number.isFinite(sample.time)||sample.time<initial.time||!Array.isArray(sample.players)||sample.players.length!==initial.players.length)throw new Error('Malformed replay sample.');
    lastTick=sample.tick;
    for(const player of sample.players){
      if(!record(player)||!exactKeys(player,['wood','ore','crystal','units','buildings','losses','gathered','upgrades','armyValue','buildingLosses','lostValue'])||!['wood','ore','crystal','units','buildings','losses','gathered'].every(k=>typeof player[k]==='number'&&Number.isFinite(player[k])&&(player[k] as number)>=0)||!['armyValue','buildingLosses','lostValue'].every(k=>player[k]===undefined||typeof player[k]==='number'&&Number.isFinite(player[k])&&(player[k] as number)>=0)||!Array.isArray(player.upgrades)||!player.upgrades.every(x=>typeof x==='string'&&x.length<80))throw new Error('Malformed replay army sample.');
    }
  }
  if(!Array.isArray(input.technologies)||input.technologies.length>200)throw new Error('Invalid technology history.');
  for(const tech of input.technologies){
    if(!record(tech)||!exactKeys(tech,['side','upgrade','tick','time'])||!validSide(tech.side)||typeof tech.upgrade!=='string'||tech.upgrade.length>80||!integer(tech.tick)||tech.tick<initial.tick||tech.tick>input.finalTick||typeof tech.time!=='number'||!Number.isFinite(tech.time)||tech.time<initial.time)throw new Error('Invalid technology timing.');
  }
  const decoded=structuredClone(input) as unknown as ReplayArchive;
  decoded.checksumVersion=input.initial.version;
  decoded.simulationRevision=input.simulationRevision as string|undefined??LEGACY_SIMULATION_REVISIONS[input.initial.version];
  return decoded;
}

export function replayRulesCompatible(archive:ReplayArchive):boolean {return archive.initial.version===SAVE_VERSION&&(archive.simulationRevision??LEGACY_SIMULATION_REVISIONS[archive.initial.version])===SIMULATION_REVISION;}

export class ReplayPlayer {
  readonly archive:ReplayArchive;
  state:GameState;
  private cursor=0;
  private stepOffset=0;
  private recorder:MatchRecorder;
  private checkpoints:Array<{save:ReturnType<typeof saveGame>;history:ReplayArchive;cursor:number;offset:number}>=[];
  constructor(input:unknown){this.archive=decodeReplay(input);if(!replayRulesCompatible(this.archive))throw new Error(`This replay uses simulation version ${this.archive.initial.version}, rules ${this.archive.simulationRevision}. This build plays version ${SAVE_VERSION}, rules ${SIMULATION_REVISION}. Its saved match can be loaded with new replay history.`);this.state=loadGame(this.archive.initial);this.recorder=new MatchRecorder(this.state);this.settleCommands();}
  get finished(){return this.cursor===this.archive.actions.length;}
  /** Recompute charts from playback rather than trusting imported chart values. */
  get analysis(){return this.recorder.analysis;}
  get technologyTimings(){return this.recorder.technologyTimings;}
  exportCurrent(){return this.recorder.export();}
  private settleCommands(){
    while(this.cursor<this.archive.actions.length){
      const action=this.archive.actions[this.cursor];if(action.type!=='command')break;
      if(!issueCommand(this.state,action.side,action.command))throw new Error(`Replay command rejected at tick ${this.state.tick}.`);
      this.cursor++;
    }
    if(this.finished&&replayChecksum(this.state,this.archive.checksumVersion??this.archive.initial.version)!==this.archive.finalChecksum)throw new Error('Replay final state diverged.');
  }
  /** Advance bounded work; callers can yield between batches to keep the UI responsive. */
  advance(ticks:number):number {
    if(!Number.isSafeInteger(ticks)||ticks<0||ticks>MAX_TICKS)throw new Error('Invalid playback tick count.');
    let advanced=0;
    while(advanced<ticks&&!this.finished){
      const action=this.archive.actions[this.cursor];if(action.type!=='advance'){this.settleCommands();continue;}
      const before=this.state.tick;stepGame(this.state,action.dt);
      if(this.state.tick!==before+1)throw new Error(`Replay ended early at tick ${before}.`);
      advanced++;this.stepOffset++;
      if(this.stepOffset===action.ticks){this.cursor++;this.stepOffset=0;this.settleCommands();}
      if((this.state.tick-this.archive.initial.state.tick)%600===0&&!this.checkpoints.some(c=>c.save.state.tick===this.state.tick)){
        this.checkpoints.push({save:saveGame(this.state),history:this.recorder.export(),cursor:this.cursor,offset:this.stepOffset});
        if(this.checkpoints.length>16)this.checkpoints.shift();
      }
    }
    return advanced;
  }
  reset(){this.recorder.dispose();this.state=loadGame(this.archive.initial);this.recorder=new MatchRecorder(this.state);this.cursor=0;this.stepOffset=0;this.settleCommands();}
  dispose(){this.recorder.dispose();}
  /** A new independent player starts at the nearest proven checkpoint before the target. */
  forkForSeek(tick:number):ReplayPlayer {
    if(!Number.isSafeInteger(tick)||tick<this.archive.initial.state.tick||tick>this.archive.finalTick)throw new Error('Seek tick is outside the replay.');
    const candidate=new ReplayPlayer(this.archive);candidate.checkpoints=[...this.checkpoints];candidate.restoreCheckpoint(tick);return candidate;
  }
  private restoreCheckpoint(tick:number){
    const checkpoint=this.checkpoints.filter(c=>c.save.state.tick<=tick).sort((a,b)=>b.save.state.tick-a.save.state.tick)[0];
    if(!checkpoint){this.reset();return;}
    this.recorder.dispose();this.state=loadGame(checkpoint.save);this.recorder=new MatchRecorder(this.state,checkpoint.history);this.cursor=checkpoint.cursor;this.stepOffset=checkpoint.offset;
  }
  seek(tick:number){
    if(!Number.isSafeInteger(tick)||tick<this.archive.initial.state.tick||tick>this.archive.finalTick)throw new Error('Seek tick is outside the replay.');
    if(tick<this.state.tick)this.restoreCheckpoint(tick);
    this.advance(tick-this.state.tick);
  }
}
