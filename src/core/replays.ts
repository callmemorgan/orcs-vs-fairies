import { validateCommand } from './commands';
import { subscribeSimulation } from './history-hooks';
import { FACTIONS } from './content';
import { saveGame, loadGame } from './saves';
import { issueCommand, stepGame, isGameOver } from './simulation';
import type { BuildingRole, Command, Entity, GameState, Side, UnitRole } from './types';

export type ReplayAction = {type:'command';side:Side;command:Command} | {type:'advance';dt:number;ticks:number};
export interface ArmySample {wood:number;ore:number;crystal:number;units:number;buildings:number;losses:number;gathered:number;upgrades:string[];armyValue?:number;buildingLosses?:number;lostValue?:number}
export interface AnalysisSample {tick:number;time:number;players:[ArmySample,ArmySample]}
export interface TechnologyTiming {side:Side;upgrade:string;tick:number;time:number}
export interface ReplayArchive {
  format:'orcs-vs-fairies/replay';version:1;
  initial:ReturnType<typeof saveGame>;
  actions:ReplayAction[];
  finalTick:number;finalChecksum:string;
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
export function replayChecksum(state:GameState):string {
  const text=JSON.stringify(saveGame(state));let hash=2166136261;
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16).padStart(8,'0');
}

function entityValue(s:GameState,e:Entity):number {
  const faction=FACTIONS[s.players[e.side].faction],cost=e.kind==='unit'?faction.units[e.role as UnitRole].cost:faction.buildings[e.role as BuildingRole].cost;
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
  private losses:[number,number]=[0,0];
  private gathered:[number,number]=[0,0];
  private buildingLosses:[number,number]=[0,0];
  private lostValue:[number,number]=[0,0];
  private technologies:TechnologyTiming[]=[];
  private knownUpgrades:[Set<string>,Set<string>];
  private sampledAt=-Infinity;
  private unsubscribe:()=>void;
  private error:string|null=null;
  constructor(private state:GameState,previous?:ReplayArchive) {
    this.knownUpgrades=[new Set(state.players[0].upgrades),new Set(state.players[1].upgrades)];
    if(previous){
      const archive=decodeReplay(previous);
      if(archive.finalTick!==state.tick||archive.finalChecksum!==replayChecksum(state))throw new Error('Saved replay does not match the saved game.');
      this.initial=archive.initial;this.actions=structuredClone(archive.actions);this.samples=structuredClone(archive.analysis);
      this.technologies=structuredClone(archive.technologies);
      const last=this.samples.at(-1);this.losses=last?[last.players[0].losses,last.players[1].losses]:[0,0];this.gathered=last?[last.players[0].gathered,last.players[1].gathered]:[0,0];
      this.buildingLosses=last?[last.players[0].buildingLosses??0,last.players[1].buildingLosses??0]:[0,0];this.lostValue=last?[last.players[0].lostValue??0,last.players[1].lostValue??0]:[0,0];
    }else this.initial=saveGame(state);
    this.sample(true);
    this.unsubscribe=subscribeSimulation(state,{
      command:(side,command)=>{if(this.actions.length>=MAX_ACTIONS){this.fail('Replay command limit reached.');return;}this.actions.push({type:'command',side,command});},
      step:dt=>{
        if(this.state.tick-this.initial.state.tick>MAX_TICKS){this.fail('Replay duration limit reached.');return;}
        const last=this.actions.at(-1);
        if(last?.type==='advance'&&last.dt===dt)last.ticks++;
        else if(this.actions.length<MAX_ACTIONS)this.actions.push({type:'advance',dt,ticks:1});
        else {this.fail('Replay command limit reached.');return;}
        for(const e of state.events){
          if(e.type==='death'){
            const entity=state.entities.find(x=>x.id===e.source);
            if(entity&&!entity.illusion&&!entity.raised){
              if(entity.kind==='unit')this.losses[e.side]++;else this.buildingLosses[e.side]++;
              this.lostValue[e.side]+=entityValue(state,entity)+entity.carried;
            }
          }
          if(e.type==='gather')this.gathered[e.side]+=e.amount??0;
        }
        for(const side of [0,1] as Side[])for(const upgrade of state.players[side].upgrades){
          if(this.knownUpgrades[side].has(upgrade))continue;
          this.knownUpgrades[side].add(upgrade);this.technologies.push({side,upgrade,tick:state.tick,time:state.time});
        }
        this.sample(isGameOver(state));
      }
    });
  }
  private fail(message:string){this.error=message;this.unsubscribe?.();}
  private sample(force=false){
    if(!force&&this.state.time-this.sampledAt<5)return;
    const sample:AnalysisSample={tick:this.state.tick,time:this.state.time,players:[armySample(this.state,0,this.losses[0],this.gathered[0],this.buildingLosses[0],this.lostValue[0]),armySample(this.state,1,this.losses[1],this.gathered[1],this.buildingLosses[1],this.lostValue[1])]};
    if(this.samples.at(-1)?.tick===sample.tick)this.samples[this.samples.length-1]=sample;else this.samples.push(sample);
    this.sampledAt=this.state.time;
  }
  get failure(){return this.error;}
  get analysis(){this.sample(true);return structuredClone(this.samples);}
  get technologyTimings(){return structuredClone(this.technologies);}
  export():ReplayArchive {
    if(this.error)throw new Error(this.error);
    this.sample(true);
    return {format:FORMAT,version:1,initial:structuredClone(this.initial),actions:structuredClone(this.actions),finalTick:this.state.tick,finalChecksum:replayChecksum(this.state),analysis:structuredClone(this.samples),technologies:this.technologyTimings};
  }
  dispose(){this.unsubscribe();}
}

export function decodeReplay(input:unknown):ReplayArchive {
  if(typeof input==='string'){if(input.length>20*1024*1024)throw new Error('Replay exceeds 20 MiB.');try{input=JSON.parse(input);}catch{throw new Error('Invalid replay JSON.');}}
  if(!record(input)||!exactKeys(input,['format','version','initial','actions','finalTick','finalChecksum','analysis','technologies'])||input.format!==FORMAT||input.version!==1)throw new Error('Unsupported replay format or version.');
  const initial=loadGame(input.initial);
  if(!Array.isArray(input.actions)||input.actions.length>MAX_ACTIONS)throw new Error('Invalid replay actions.');
  let ticks=0;
  for(const action of input.actions){
    if(!record(action))throw new Error('Malformed replay action.');
    if(action.type==='command'){
      if(!exactKeys(action,['type','side','command'])||(action.side!==0&&action.side!==1)||!validateCommand(action.command))throw new Error('Malformed replay command.');
    }else if(action.type==='advance'){
      if(!exactKeys(action,['type','dt','ticks'])||typeof action.dt!=='number'||!Number.isFinite(action.dt)||action.dt<=0||action.dt>.25||!integer(action.ticks)||action.ticks<1)throw new Error('Invalid replay timestep.');
      ticks+=action.ticks;if(ticks>MAX_TICKS)throw new Error('Replay exceeds six hours at 20 ticks per second.');
    }else throw new Error('Unknown replay action.');
  }
  if(!integer(input.finalTick)||input.finalTick!==initial.tick+ticks||typeof input.finalChecksum!=='string'||!/^[0-9a-f]{8}$/.test(input.finalChecksum))throw new Error('Invalid replay final state.');
  if(!Array.isArray(input.analysis)||input.analysis.length>MAX_TICKS+1)throw new Error('Invalid replay analysis.');
  let lastTick=initial.tick-1;
  for(const sample of input.analysis){
    if(!record(sample)||!exactKeys(sample,['tick','time','players'])||!integer(sample.tick)||sample.tick<=lastTick||sample.tick>input.finalTick||typeof sample.time!=='number'||!Number.isFinite(sample.time)||sample.time<initial.time||!Array.isArray(sample.players)||sample.players.length!==2)throw new Error('Malformed replay sample.');
    lastTick=sample.tick;
    for(const player of sample.players){
      if(!record(player)||!exactKeys(player,['wood','ore','crystal','units','buildings','losses','gathered','upgrades','armyValue','buildingLosses','lostValue'])||!['wood','ore','crystal','units','buildings','losses','gathered'].every(k=>typeof player[k]==='number'&&Number.isFinite(player[k])&&(player[k] as number)>=0)||!['armyValue','buildingLosses','lostValue'].every(k=>player[k]===undefined||typeof player[k]==='number'&&Number.isFinite(player[k])&&(player[k] as number)>=0)||!Array.isArray(player.upgrades)||!player.upgrades.every(x=>typeof x==='string'&&x.length<80))throw new Error('Malformed replay army sample.');
    }
  }
  if(!Array.isArray(input.technologies)||input.technologies.length>200)throw new Error('Invalid technology history.');
  for(const tech of input.technologies){
    if(!record(tech)||!exactKeys(tech,['side','upgrade','tick','time'])||(tech.side!==0&&tech.side!==1)||typeof tech.upgrade!=='string'||tech.upgrade.length>80||!integer(tech.tick)||tech.tick<initial.tick||tech.tick>input.finalTick||typeof tech.time!=='number'||!Number.isFinite(tech.time)||tech.time<initial.time)throw new Error('Invalid technology timing.');
  }
  return structuredClone(input) as unknown as ReplayArchive;
}

export class ReplayPlayer {
  readonly archive:ReplayArchive;
  state:GameState;
  private cursor=0;
  private stepOffset=0;
  private recorder:MatchRecorder;
  private checkpoints:Array<{save:ReturnType<typeof saveGame>;history:ReplayArchive;cursor:number;offset:number}>=[];
  constructor(input:unknown){this.archive=decodeReplay(input);this.state=loadGame(this.archive.initial);this.recorder=new MatchRecorder(this.state);this.settleCommands();}
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
    if(this.finished&&replayChecksum(this.state)!==this.archive.finalChecksum)throw new Error('Replay final state diverged.');
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
