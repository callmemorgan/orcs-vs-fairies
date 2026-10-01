/** Browser verification host for the standalone mounts, not the shipped game entry. */
import { mountOnlineLobby } from '../../src/ui/OnlineLobby';
import { mountCompetitionTools } from '../../src/ui/CompetitionTools';
import { OnlineApi, OnlineMatchConnection } from '../../src/online/client';
import type { OnlineMatchRequest } from '../../src/ui/OnlineLobby';

const root=document.querySelector<HTMLElement>('#app')!;
root.innerHTML='<main><h1>Competition browser verification</h1><p>This host exercises the standalone account and competition screens against the authoritative server.</p><section aria-label="Hosted match" hidden><h2>Hosted match</h2><p class="hosted-status" role="status"></p><pre class="hosted-frame"></pre><button type="button" class="hosted-surrender">Surrender hosted match</button></section></main>';
let connection:OnlineMatchConnection|undefined;
async function join(request:OnlineMatchRequest){
  connection?.dispose();const area=root.querySelector<HTMLElement>('[aria-label="Hosted match"]')!;
  const status=root.querySelector<HTMLElement>('.hosted-status')!,frame=root.querySelector<HTMLElement>('.hosted-frame')!;
  const next=new OnlineMatchConnection({api:new OnlineApi(),...request,onObservation:(view,tick)=>{
    area.hidden=false;frame.textContent=JSON.stringify({matchId:request.matchId,tick,side:view.side,controller:view.controller,entities:view.entities.length,result:view.result},null,2);
    root.querySelector<HTMLButtonElement>('.hosted-surrender')!.disabled=view.result.finished;
  },onStatus:(_value,text)=>{status.textContent=text;}});
  await next.connect();await next.waitForSnapshot();connection=next;
}
root.querySelector<HTMLButtonElement>('.hosted-surrender')!.onclick=()=>{void connection?.send({type:'surrender'});};
mountOnlineLobby(root,{onJoinMatch:join,pollIntervalMs:3000});
mountCompetitionTools(root,{onJoinMatch:join,pollIntervalMs:3000});
