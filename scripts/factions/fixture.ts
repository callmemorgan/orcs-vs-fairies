import Phaser from 'phaser';
import { issueCommand } from '../../src/core/simulation';
import { factionConcealment } from '../../src/core/faction-systems';
import type { FactionCommand } from '../../src/core/faction-systems';
import type { Command, Entity, FactionId } from '../../src/core/types';
import GameScene from '../../src/game/GameScene';
import { mountFactionTools } from '../../src/ui/FactionTools';
import { advanceFactionFixture, createFactionFixture } from './fixture-state';

let fixture=createFactionFixture(),ready=false;
const commands:{command:Command;accepted:boolean}[]=[];
function permitted():boolean{return !scene.readOnly&&!scene.photoMode&&!scene.paused&&!scene.inputBlocked&&scene.state.winner===null&&!scene.state.draw;}
function dispatch(command:Command):boolean{const accepted=permitted()&&issueCommand(scene.state,0,command);commands.push({command:structuredClone(command),accepted});publish();return accepted;}
const scene:GameScene=new GameScene({state:fixture.state,simulationEnabled:false,onSelection:()=>{tools.update();publish();},onNotice:text=>{document.querySelector('#fixture-notice')!.textContent=text;},onCommand:(_side,command)=>dispatch(command),onReady:()=>{ready=true;scene.selectEntities([fixture.soldier.id]);scene.centerOn(14,17);tools.open();publish();}});
const tools=mountFactionTools(document.querySelector<HTMLElement>('#faction-root')!,{state:()=>scene.state,selected:()=>scene.selected,side:()=>scene.viewSide,command:(command:FactionCommand)=>scene.command(command),coreCommand:command=>scene.command(command),enabled:()=>permitted()?true:'Faction commands are unavailable in this view.'});
new Phaser.Game({type:Phaser.CANVAS,parent:'game',width:1280,height:900,scene:[scene],fps:{target:60}});
document.querySelector<HTMLSelectElement>('#faction')!.addEventListener('change',event=>{fixture=createFactionFixture((event.target as HTMLSelectElement).value as FactionId);commands.length=0;scene.readOnly=false;scene.restart(fixture.state);scene.selectEntities([fixture.soldier.id]);scene.centerOn(14,17);tools.update();publish();});
for(const [name,get] of [['soldier',()=>fixture.soldier],['worker',()=>fixture.worker],['special',()=>fixture.special],['siege',()=>fixture.siege],['wagon',()=>fixture.wagon],['tower',()=>fixture.tower]] as const)document.querySelector(`#select-${name}`)!.addEventListener('click',()=>{const entity=get();scene.selectEntities(entity?[entity.id]:[]);tools.update();publish();});
for(const [id,seconds] of [['advance-one',1],['advance-thirty',30]] as const)document.querySelector(`#${id}`)!.addEventListener('click',()=>{advanceFactionFixture(scene.state,seconds);tools.update();publish();});
document.querySelector('#readonly')!.addEventListener('click',()=>{scene.readOnly=!scene.readOnly;tools.update();publish();});
function entitySummary(item:Entity){return {id:item.id,side:item.side,role:item.role,kind:item.kind,definitionId:item.definitionId,x:item.x,y:item.y,level:item.level??0,order:item.order,progress:item.progress,queue:item.queue,queueDefinitionIds:item.queueDefinitionIds,trainProgress:item.trainProgress,factionState:item.factionState,illusion:item.illusion,expires:item.expires,shield:item.shield,maxShield:item.maxShield,concealed:factionConcealment(scene.state,item)};}
function publish(){
  const {state}=scene;
  const snapshot={ready,faction:fixture.faction,tick:state.tick,time:state.time,width:state.width,height:state.height,selected:[...scene.selected],readOnly:scene.readOnly,commands,player:state.players[0],system:state.factionSystems,entities:state.entities.filter(item=>item.side===0).map(entitySummary),corpses:state.corpses,terrain:state.terrain,ids:{soldier:fixture.soldier.id,worker:fixture.worker.id,special:fixture.special.id,siege:fixture.siege.id,barracks:fixture.barracks.id,wagon:fixture.wagon?.id,corpse:fixture.corpse?.id,tower:fixture.tower?.id,tunnels:fixture.tunnels.map(item=>item.id)}};
  document.querySelector('#proof-data')!.textContent=JSON.stringify(snapshot,null,2);
  document.querySelector('#proof-status')!.textContent=JSON.stringify({ready,faction:snapshot.faction,tick:snapshot.tick,selected:snapshot.selected,readOnly:snapshot.readOnly,accepted:commands.filter(item=>item.accepted).map(item=>item.command),fury:state.factionSystems?.fury[0],powers:snapshot.entities.filter(item=>item.factionState||item.definitionId||item.illusion)},null,2);
}
publish();
