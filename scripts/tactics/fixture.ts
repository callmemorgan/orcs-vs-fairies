import Phaser from 'phaser';
import { issueCommand, refreshVisibility } from '../../src/core/simulation';
import { canAmbush, isCrewless } from '../../src/core/tactics';
import type { TacticsCommand } from '../../src/core/tactics';
import type { Command } from '../../src/core/types';
import GameScene, { project } from '../../src/game/GameScene';
import { mountTacticsTools } from '../../src/ui/TacticsTools';
import type { TacticsAction } from '../../src/ui/TacticsTools';
import { createTacticsFixture } from './fixture-state';

const fixture=createTacticsFixture(),{state,army,worker,engine}=fixture;
const commands:{command:Command;accepted:boolean}[]=[];
let ready=false;
const bindings:Partial<Record<TacticsAction,string>>={formationLine:'Alt+KeyL',formationWedge:'Alt+KeyW',formationSquare:'Alt+KeyS',formationLoose:'Alt+KeyO',face:'Alt+KeyF',ambush:'Alt+KeyA',releaseAmbush:'Alt+KeyR',captureSiege:'Alt+KeyC'};
function permitted(){return !scene.readOnly&&!scene.photoMode&&!scene.paused&&!scene.inputBlocked&&state.winner===null&&!state.draw;}
function dispatch(command:Command){const accepted=permitted()&&issueCommand(state,0,command);commands.push({command:structuredClone(command),accepted});publish();return accepted;}
const scene=new GameScene({state,onSelection:()=>{tools.update();publish();},onNotice:text=>{document.querySelector('#fixture-notice')!.textContent=text;},onCommand:(_side,command)=>dispatch(command),onStep:()=>{tools.update();publish();},onReady:()=>{ready=true;scene.selectEntities(army.map(item=>item.id));const center=project(12,14);scene.cameras.main.centerOn(center.x,center.y);tools.open();publish();}});
const tools=mountTacticsTools(document.querySelector<HTMLElement>('#tactics-root')!,{state:()=>state,selected:()=>scene.selected,side:()=>scene.viewSide,command:(command:TacticsCommand)=>scene.command(command),enabled:()=>permitted()?true:'Tactics commands are unavailable in this view.',keyFor:action=>bindings[action]});
new Phaser.Game({type:Phaser.CANVAS,parent:'game',width:1280,height:900,scene:[scene],fps:{target:60}});
document.querySelector('#select-army')!.addEventListener('click',()=>{scene.selectEntities(army.map(item=>item.id));publish();});
document.querySelector('#select-worker')!.addEventListener('click',()=>{scene.selectEntities([worker.id]);publish();});
document.querySelector('#select-engine')!.addEventListener('click',()=>{scene.selectEntities([engine.id]);publish();});
document.querySelector('#woodland')!.addEventListener('click',()=>{
  // Explicit scenario reset for repeatable ambush proof, not a product action.
  for(const [index,item] of army.entries()){issueCommand(state,0,{type:'stop',ids:[item.id]});if(item.tactics){delete item.tactics.formation;delete item.tactics.ambush;}item.x=12+index*.3;item.y=14.2;}
  refreshVisibility(state);scene.selectEntities(army.map(item=>item.id));tools.update();publish();
});
document.querySelector('#readonly')!.addEventListener('click',()=>{scene.readOnly=!scene.readOnly;tools.update();publish();});
function publish(){
  const destination=project(16,14),points=ready?{formationMove:{x:(destination.x-scene.cameras.main.scrollX)*scene.cameras.main.zoom,y:(destination.y-scene.cameras.main.scrollY)*scene.cameras.main.zoom}}:null;
  const snapshot={ready,tick:state.tick,selected:[...scene.selected],readOnly:scene.readOnly,commands,points,army:army.map(item=>({id:item.id,side:item.side,x:item.x,y:item.y,order:item.order,facing:item.facing,tactics:item.tactics,canAmbush:canAmbush(state,item)})),worker:{id:worker.id,order:worker.order,tactics:worker.tactics},engine:{id:engine.id,side:engine.side,faction:engine.definitionFaction,uncrewed:isCrewless(engine),crew:engine.tactics?.siegeCrew}};
  document.querySelector('#proof-data')!.textContent=JSON.stringify(snapshot,null,2);
  document.querySelector('#proof-status')!.textContent=JSON.stringify({ready,selected:snapshot.selected,readOnly:snapshot.readOnly,accepted:commands.filter(item=>item.accepted).map(item=>item.command),formation:army.map(item=>item.tactics?.formation?.kind??null),facing:army.map(item=>item.facing),ambush:army.map(item=>item.tactics?.ambush??null),engine:snapshot.engine},null,2);
}
publish();
