import { FACTIONS } from '../core/content';
import type { FactionId } from '../core/types';
import type { Account, LobbyObservation } from '../online/protocol';
import { CompetitionApi } from '../online/competition-client';
import { OnlineRequestError } from '../online/client';
import type { OnlineMatchRequest } from './OnlineLobby';
import './competition-tools.css';

export interface CompetitionToolsOptions {api?:CompetitionApi;onJoinMatch:(request:OnlineMatchRequest)=>void|Promise<void>;onVisibility?:(visible:boolean)=>void;pollIntervalMs?:number}
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const factionOptions=Object.values(FACTIONS).map(faction=>`<option value="${faction.id}">${escape(faction.name)}</option>`).join('');

/** All dates, ratings and scores shown here come from the authoritative server. */
export function mountCompetitionTools(root:HTMLElement,options:CompetitionToolsOptions){
  const api=options.api??new CompetitionApi(),host=document.createElement('section');host.className='competition-tools';
  host.innerHTML=`<button type="button" class="competition-open small-button">Competitions</button><div class="competition-overlay" hidden><section class="competition-dialog" role="dialog" aria-modal="true" aria-label="Competitions" tabindex="-1">
    <header><h2>Competitions</h2><button type="button" class="competition-close">Close</button></header><p class="competition-message" role="status" aria-live="polite"></p>
    <p class="competition-account"></p><button type="button" data-competition="refresh">Refresh competitions</button>
    <section aria-label="Ranked seasons"><h3>Ranked seasons</h3><p class="competition-season"></p><p class="competition-ranked-rules"></p>
    <label>Season standings<select aria-label="Season standings"></select></label><div class="competition-rankings"></div>
    <form class="competition-create" aria-label="Create ranked lobby"><label>Your faction<select aria-label="Ranked host faction">${factionOptions}</select></label><label>Opponent faction<select aria-label="Ranked opponent faction">${factionOptions}</select></label><button type="submit">Create ranked lobby</button></form>
    <ul class="competition-lobbies" aria-label="Ranked lobbies"></ul><section class="competition-current" aria-label="Current ranked lobby" hidden></section><ul class="competition-history" aria-label="Your ranked matches"></ul></section>
    <section aria-label="Daily seeded challenge"><h3>Daily seeded challenge</h3><p class="competition-daily"></p><p class="competition-daily-rules"></p><button type="button" data-competition="daily">Start or resume daily challenge</button><div class="competition-daily-scores"></div></section>
    </section></div>`;
  root.append(host);
  const element=<T extends HTMLElement>(selector:string)=>host.querySelector<T>(selector)!;
  const overlay=element<HTMLDivElement>('.competition-overlay'),dialog=element<HTMLElement>('.competition-dialog'),seasonSelect=element<HTMLSelectElement>('[aria-label="Season standings"]');
  element<HTMLSelectElement>('[aria-label="Ranked opponent faction"]').value='fairies';
  let visible=false,busy=false,disposed=false,account:Account|null=null,current:LobbyObservation|null=null,previousFocus:HTMLElement|null=null,timer:ReturnType<typeof setInterval>|undefined,lobbySignature='';
  const message=(text:string)=>{element('.competition-message').textContent=text;};
  const paint=(selector:string,html:string)=>{const node=element(selector);if(node.innerHTML!==html)node.innerHTML=html;};
  function controls(){for(const button of Array.from(host.querySelectorAll<HTMLButtonElement>('button')))if(!button.classList.contains('competition-close')&&!button.classList.contains('competition-open'))button.disabled=busy||(!account&&button.dataset.competition!=='refresh');for(const select of Array.from(host.querySelectorAll<HTMLSelectElement>('select')))select.disabled=busy;}
  async function run(action:()=>Promise<void>){if(busy||disposed)return;busy=true;controls();try{await action();}catch(error){
    if(error instanceof OnlineRequestError&&error.status===409){try{await refresh();}catch{}message('Lobby changed. Review the current players and readiness, then try again.');}
    else message(error instanceof Error?error.message:'Competition request failed.');
  }finally{busy=false;if(!disposed)controls();}}
  function table(headers:string[],rows:string[][]){return rows.length?`<table><thead><tr>${headers.map(header=>`<th scope="col">${escape(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(value=>`<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<p>No results yet.</p>';}
  async function rankings(){const response=await api.standings(seasonSelect.value||undefined);if(disposed)return;paint('.competition-rankings',table(['Rank','Player','Rating','Played','Wins','Draws','Losses'],response.standings.map(row=>[String(row.rank),row.account.username,String(row.rating),String(row.played),String(row.wins),String(row.draws),String(row.losses)])));}
  function drawLobby(){
    const area=element('.competition-current');area.hidden=!current;
    const signature=JSON.stringify({current,accountId:account?.id});if(signature===lobbySignature)return;lobbySignature=signature;if(!current)return;
    const own=current.seats.find(seat=>seat.account?.id===account?.id);
    area.innerHTML=`<h4>Your ranked lobby</h4><p>${escape(current.id)}</p><ul>${current.seats.map(seat=>`<li>${escape(seat.account?.username??'Waiting for opponent')}: ${seat.ready?'ready':'not ready'} (${escape(FACTIONS[current!.settings.factions[seat.side]].name)})</li>`).join('')}</ul>${current.matchId?'<button type="button" data-current="play">Enter ranked match</button>':`<button type="button" data-current="ready">${own?.ready?'Unready':'Ready'}</button>${current.hostId===account?.id?'<button type="button" data-current="start">Start ranked match</button>':''}<button type="button" data-current="leave">Leave lobby</button>`}`;
    for(const button of Array.from(area.querySelectorAll<HTMLButtonElement>('[data-current]')))button.onclick=()=>void run(async()=>{
      if(!current)return;const action=button.dataset.current;
      if(action==='play'){await enter(current.matchId!);return;}
      current=await api.changeLobby(current,action as 'ready'|'start'|'leave',action==='ready'?{ready:!own?.ready}:{});
      if(action==='leave')current=null;
      if(action==='start'&&current?.matchId){await enter(current.matchId);return;}
      await refresh();
    });
  }
  async function refresh(){
    const [user,seasons,daily]=await Promise.all([api.session(),api.seasons(),api.daily()]);if(disposed)return;account=user;
    element('.competition-account').textContent=user?`Signed in as ${user.username}.`:'Sign in or create an account through Online play to enter a competition.';
    element('.competition-season').textContent=`Season ${seasons.current.id}. Reset: ${seasons.current.endsAt}. Starting rating: ${seasons.current.initialRating}.`;
    element('.competition-ranked-rules').textContent=seasons.rules;
    const chosen=seasonSelect.value;paint('[aria-label="Season standings"]',seasons.seasons.map(season=>`<option value="${season.id}">${season.id}</option>`).join(''));seasonSelect.value=seasons.seasons.some(season=>season.id===chosen)?chosen:seasons.current.id;
    const challenge=daily.challenge;
    element('.competition-daily').textContent=`UTC ${challenge.date}. Seed ${challenge.seed}. ${FACTIONS[challenge.config.players[0].factionId].name} versus ${FACTIONS[challenge.config.players[1].factionId].name}; small map, age 1, normal AI. Next challenge: ${challenge.expiresAt}.`;
    element('.competition-daily-rules').textContent=daily.rules;
    paint('.competition-daily-scores',table(['Rank','Player','Victory time'],daily.standings.map(row=>[String(row.rank),row.account.username,`${row.seconds.toFixed(2)} seconds`])));
    await rankings();
    const lobbies=user?(await api.lobbies()).filter(lobby=>lobby.ranked):[];if(disposed)return;
    if(current)current=lobbies.find(lobby=>lobby.id===current!.id&&lobby.seats.some(seat=>seat.account?.id===user?.id))??null;
    else current=lobbies.find(lobby=>!lobby.matchId&&lobby.seats.some(seat=>seat.account?.id===user?.id))??null;
    paint('.competition-lobbies',lobbies.filter(lobby=>!lobby.matchId&&lobby.id!==current?.id).map(lobby=>`<li><span>${escape(lobby.seats.find(seat=>seat.account)?.account?.username??'Open lobby')} · ${escape(lobby.settings.mapSize)} · ${lobby.seats.filter(seat=>seat.account).length}/2 players</span><button type="button" data-lobby="${escape(lobby.id)}">Join ranked lobby</button></li>`).join(''));
    for(const button of Array.from(host.querySelectorAll<HTMLButtonElement>('[data-lobby]')))button.onclick=()=>void run(async()=>{const lobby=await api.lobby(button.dataset.lobby!);current=await api.changeLobby(lobby,'join');await refresh();});
    const history=user?(await api.myMatches()).matches:[];if(disposed)return;
    paint('.competition-history',lobbies.filter(lobby=>lobby.matchId&&lobby.seats.some(seat=>seat.account?.id===user?.id)).map(lobby=>{
      const status=history.find(match=>match.id===lobby.matchId);return `<li><span>${escape(lobby.matchId!)} · ${status?.failed?'paused after server failure':status?.finished?'finished':'in progress'}</span> <button type="button" data-rejoin="${escape(lobby.matchId!)}">${status?.finished&&!status?.failed?'Inspect ranked result':'Rejoin ranked match'}</button></li>`;
    }).join(''));
    for(const button of Array.from(host.querySelectorAll<HTMLButtonElement>('[data-rejoin]')))button.onclick=()=>void run(()=>enter(button.dataset.rejoin!));
    drawLobby();controls();
  }
  async function enter(matchId:string){await options.onJoinMatch({matchId,role:'player'});setVisible(false);}
  function setVisible(next:boolean){if(disposed||visible===next)return;visible=next;overlay.hidden=!next;options.onVisibility?.(next);if(next){previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;dialog.focus();void run(refresh);timer=setInterval(()=>{if(visible)void run(refresh);},options.pollIntervalMs??3000);}else{if(timer)clearInterval(timer);timer=undefined;previousFocus?.focus();}}
  element<HTMLButtonElement>('.competition-open').onclick=()=>setVisible(true);element<HTMLButtonElement>('.competition-close').onclick=()=>setVisible(false);
  element<HTMLButtonElement>('[data-competition="refresh"]').onclick=()=>void run(refresh);seasonSelect.onchange=()=>void run(rankings);
  element<HTMLFormElement>('.competition-create').onsubmit=event=>{event.preventDefault();void run(async()=>{if(!account)throw new Error('Sign in through Online play first.');const factions=[element<HTMLSelectElement>('[aria-label="Ranked host faction"]').value,element<HTMLSelectElement>('[aria-label="Ranked opponent faction"]').value] as FactionId[];current=await api.createRanked({mapSize:'small',factions,startingAge:1});message('Ranked lobby created. Both players must ready up.');await refresh();});};
  element<HTMLButtonElement>('[data-competition="daily"]').onclick=()=>void run(async()=>{const result=await api.startDaily();await enter(result.lobby.matchId!);});
  const onKey=(event:KeyboardEvent)=>{if(!visible)return;if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setVisible(false);}else if(event.key==='Tab'){const focusable=Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled)')).filter(node=>!node.closest('[hidden]'));if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1)!;if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};
  document.addEventListener('keydown',onKey,true);
  return {get visible(){return visible;},open:()=>setVisible(true),close:()=>setVisible(false),dispose(){if(disposed)return;if(visible){options.onVisibility?.(false);previousFocus?.focus();}disposed=true;if(timer)clearInterval(timer);document.removeEventListener('keydown',onKey,true);host.remove();}};
}
