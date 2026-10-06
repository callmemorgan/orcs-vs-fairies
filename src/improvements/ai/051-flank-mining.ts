import { registerGameImprovement } from '../../core/improvements';
import { isVisible, issueCommand } from '../../core/simulation';
import type { GameState, JsonValue, ResourceNode, Side } from '../../core/types';
import { buildNear, computer, distance, moveTo, owned, seen } from './shared';

interface Expedition {memory:ResourceNode[];deposit:number|null;crew:number[];dropoff:number|null;delivered:number;retryAt:number;placementAttempts:number}
export interface State {sides:Expedition[]}
function workFlank(game:GameState,side:Side,state:Expedition):void {
  const ours=owned(game,side),hq=ours.find(e=>e.role==='hq');if(!hq)return;
  for(const node of game.resources.filter(n=>isVisible(game,side,n.x,n.y))){
    const old=state.memory.findIndex(n=>n.id===node.id);if(old<0)state.memory.push({...node});else state.memory[old]={...node};
  }
  const workers=ours.filter(e=>e.kind==='unit'&&e.role==='worker'),crewCap=Math.max(0,Math.min(3,workers.length-3));
  state.crew=state.crew.filter(id=>workers.some(w=>w.id===id)).slice(0,crewCap);
  let deposit=state.memory.find(n=>n.id===state.deposit);
  if(deposit?.amount===0){state.deposit=null;state.crew=[];state.dropoff=null;deposit=undefined;}
  const enemies=seen(game,side);
  if(!deposit&&workers.length>=5){
    deposit=state.memory.filter(n=>n.amount>300&&distance(n,hq)>18&&!enemies.some(e=>distance(e,n)<9)).sort((a,b)=>distance(a,hq)-distance(b,hq)||a.id-b.id)[0];
    if(deposit){state.deposit=deposit.id;state.retryAt=0;}
  }
  if(!deposit)return;
  if(enemies.some(e=>e.kind==='unit'&&e.role!=='worker'&&distance(e,deposit)<8)){
    for(const id of state.crew)moveTo(game,side,workers.find(w=>w.id===id)!,hq);
    return;
  }
  const open=crewCap-state.crew.length;
  if(open>0)state.crew.push(...workers.filter(w=>!state.crew.includes(w.id)&&(w.order.type==='idle'||w.order.type==='gather')).sort((a,b)=>distance(a,deposit)-distance(b,deposit)).slice(0,open).map(w=>w.id));
  const dropoff=ours.find(e=>e.kind==='building'&&(e.role==='depot'||e.role==='hq')&&distance(e,deposit)<8);
  state.dropoff=dropoff?.id??null;
  for(const [index,id] of state.crew.entries()){
    const worker=workers.find(w=>w.id===id)!;
    if(index===0&&!dropoff&&worker.carried===0&&game.time>=state.retryAt){
      state.retryAt=game.time+4;state.placementAttempts++;
      if(buildNear(game,side,worker,'depot',deposit))continue;
      // Failed placement still leaves the crew lead productive at the observed camp.
    }
    if(index===0&&dropoff&&dropoff.progress<1){if(worker.order.type!=='build'||worker.order.target!==dropoff.id)issueCommand(game,side,{type:'repair',ids:[id],target:dropoff.id});continue;}
    // A gather order includes its return trip, even when the deposit leaves vision.
    if(worker.order.type==='gather'&&worker.order.target===deposit.id)continue;
    if(isVisible(game,side,deposit.x,deposit.y))issueCommand(game,side,{type:'gather',ids:[id],target:deposit.id});
    else moveTo(game,side,worker,deposit);
  }
}
registerGameImprovement({
  id:'feature-051',initialState:()=>({sides:[0,1].map(()=>({memory:[],deposit:null,crew:[],dropoff:null,delivered:0,retryAt:0,placementAttempts:0}))}),
  step(game,_dt,json){const state=json as unknown as State;for(const side of [0,1] as Side[])if(computer(game,side)){
    const expedition=state.sides[side];for(const event of game.events)if(event.type==='gather'&&event.side===side&&event.source!==undefined&&expedition.crew.includes(event.source))expedition.delivered+=event.amount??0;
    workFlank(game,side,expedition);
  }},
  observe(_game,side,json){return (json as {sides:JsonValue[]}).sides[side];}
});
