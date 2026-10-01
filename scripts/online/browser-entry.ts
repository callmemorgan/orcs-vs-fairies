import {OnlineApi,OnlineMatchConnection} from '../../src/online/client';
import {observationToRenderState} from '../../src/online/render-state';
import {mountOnlineLobby} from '../../src/ui/OnlineLobby';
import type {OnlineMatchRequest} from '../../src/ui/OnlineLobby';
import type {CommandAck,PlayerObservation} from '../../src/online/protocol';

// This fixture exercises the actual lobby/client against a real server. It does
// not advance or create GameState, and only receives the server's filtered view.
const root=document.querySelector<HTMLElement>('#app')!;
root.innerHTML='<main><h1>Online client verification</h1><p id="status" role="status">Disconnected</p><p id="summary">No snapshot</p><button id="train">Train worker</button><button id="reconnect">Reconnect player</button></main>';
const api=new OnlineApi();
let connection:OnlineMatchConnection|undefined,request:OnlineMatchRequest|undefined,view:PlayerObservation|undefined;
const receipts:CommandAck[]=[];
async function join(next:OnlineMatchRequest){
  connection?.dispose();request=next;
  connection=new OnlineMatchConnection({api,...next,onStatus:(_status,message)=>{document.querySelector('#status')!.textContent=message;},
    onObservation:observation=>{view=observation;const display=observationToRenderState(observation,next.role);
      document.querySelector('#summary')!.textContent=`Side ${display.localSide+1}, tick ${observation.tick}, ${observation.entities.length} visible units and buildings, ${observation.player.wood} own wood.`;},
    onReceipt:receipt=>receipts.push(receipt)});
  await connection.connect();
  await connection.waitForSnapshot();
}
const lobby=mountOnlineLobby(root,{api,onJoinMatch:join,pollIntervalMs:100});
document.querySelector<HTMLButtonElement>('#train')!.onclick=()=>{const hq=view?.entities.find(entity=>entity.side===view!.side&&entity.role==='hq');if(hq)connection?.dispatch({type:'train',id:hq.id,role:'worker'});};
document.querySelector<HTMLButtonElement>('#reconnect')!.onclick=()=>{if(request)void join(request);};
Object.assign(window,{onlineFixture:{lobby,get view(){return view;},get connection(){return connection;},receipts}});
