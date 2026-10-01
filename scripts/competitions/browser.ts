/** Browser verification host for the standalone mounts, not the shipped game entry. */
import { mountOnlineLobby } from '../../src/ui/OnlineLobby';
import { mountCompetitionTools } from '../../src/ui/CompetitionTools';
import { OnlineApi, OnlineMatchConnection } from '../../src/online/client';
import type { OnlineMatchRequest } from '../../src/ui/OnlineLobby';
import { mountCosmeticTools, renderCosmeticIdentity } from '../../src/ui/CosmeticTools';
import { drawCosmeticBuilding } from '../../src/game/Cosmetics';
import type { CosmeticGraphics, CosmeticLoadout } from '../../src/game/Cosmetics';
import type { FactionId } from '../../src/core/types';

const root=document.querySelector<HTMLElement>('#app')!;
root.innerHTML='<main><h1>Competition browser verification</h1><p>This host exercises the standalone account and competition screens against the authoritative server.</p><section aria-label="Hosted match" hidden><h2>Hosted match</h2><p class="hosted-status" role="status"></p><pre class="hosted-frame"></pre><button type="button" class="hosted-surrender">Surrender hosted match</button></section><section aria-label="Cosmetic rendering"><h2>Cosmetic rendering</h2><div class="cosmetic-identity"></div><canvas class="cosmetic-canvas" width="320" height="220"></canvas></section></main>';
let connection:OnlineMatchConnection|undefined;
let faction:FactionId='orcs';const loadouts=new Map<FactionId,CosmeticLoadout>();
function drawCosmetics(){
  const canvas=root.querySelector<HTMLCanvasElement>('.cosmetic-canvas')!,ctx=canvas.getContext('2d')!;
  ctx.clearRect(0,0,320,220);ctx.fillStyle='#132321';ctx.fillRect(0,0,320,220);ctx.fillStyle='#3e5b4d';ctx.fillRect(95,90,130,95);ctx.fillStyle='#697b58';ctx.beginPath();ctx.moveTo(85,90);ctx.lineTo(160,45);ctx.lineTo(235,90);ctx.closePath();ctx.fill();ctx.fillStyle='#101c20';ctx.fillRect(145,143,30,42);
  const graphics:CosmeticGraphics={fillStyle(color,alpha=1){ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.globalAlpha=alpha;},lineStyle(width,color,alpha=1){ctx.lineWidth=width;ctx.strokeStyle='#'+color.toString(16).padStart(6,'0');ctx.globalAlpha=alpha;},fillRect(x,y,w,h){ctx.fillRect(x,y,w,h);},strokeRect(x,y,w,h){ctx.strokeRect(x,y,w,h);},lineBetween(x1,y1,x2,y2){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();},fillTriangle(x1,y1,x2,y2,x3,y3){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.closePath();ctx.fill();},fillCircle(x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();},strokeCircle(x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();}};
  const loadout=loadouts.get(faction)??{};drawCosmeticBuilding(graphics,loadout,{x:160,y:183},60);renderCosmeticIdentity(root.querySelector('.cosmetic-identity')!,loadout);
}
drawCosmetics();
async function join(request:OnlineMatchRequest){
  connection?.dispose();const area=root.querySelector<HTMLElement>('[aria-label="Hosted match"]')!;
  const status=root.querySelector<HTMLElement>('.hosted-status')!,frame=root.querySelector<HTMLElement>('.hosted-frame')!;
  const next=new OnlineMatchConnection({api:new OnlineApi(),...request,onObservation:(view,tick)=>{
    faction=view.player.faction;drawCosmetics();
    area.hidden=false;frame.textContent=JSON.stringify({matchId:request.matchId,tick,side:view.side,controller:view.controller,entities:view.entities.length,result:view.result},null,2);
    root.querySelector<HTMLButtonElement>('.hosted-surrender')!.disabled=view.result.finished;
  },onStatus:(_value,text)=>{status.textContent=text;}});
  await next.connect();await next.waitForSnapshot();connection=next;
}
root.querySelector<HTMLButtonElement>('.hosted-surrender')!.onclick=()=>{void connection?.send({type:'surrender'});};
mountOnlineLobby(root,{onJoinMatch:join,pollIntervalMs:3000});
mountCompetitionTools(root,{onJoinMatch:join,pollIntervalMs:3000});
mountCosmeticTools(root,{getFaction:()=>faction,onEquipment:(id,loadout)=>{loadouts.set(id,loadout);drawCosmetics();}});
