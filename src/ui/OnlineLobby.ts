import { FACTIONS } from '../core/content';
import type { FactionId, MapSize, Side } from '../core/types';
import { OnlineApi, OnlineRequestError } from '../online/client';
import type { Account, LobbyObservation, LobbySettings } from '../online/protocol';
import './online-lobby.css';

export interface OnlineMatchRequest { matchId:string;role:'player'|'spectator';perspective?:Side }
export interface OnlineLobbyOptions {
  api?:OnlineApi;onJoinMatch:(request:OnlineMatchRequest)=>void|Promise<void>;
  onVisibility?:(visible:boolean)=>void;pollIntervalMs?:number;
}
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const factionOptions=(selected:FactionId)=>Object.values(FACTIONS).map(faction=>`<option value="${faction.id}"${faction.id===selected?' selected':''}>${escape(faction.name)}</option>`).join('');

/** The lobby uses server revisions and accounts. A browser never invents a seat. */
export function mountOnlineLobby(root:HTMLElement,options:OnlineLobbyOptions) {
  const api=options.api??new OnlineApi();
  const host=document.createElement('section');host.className='online-tools';
  host.innerHTML=`<button class="online-open small-button" type="button">Online</button>
    <div class="online-overlay" hidden><section class="online-dialog" role="dialog" aria-modal="true" aria-label="Online play" tabindex="-1">
      <header><h2>Online play</h2><button type="button" class="online-close small-button" aria-label="Close online play">Close</button></header>
      <p class="online-message" role="status" aria-live="polite"></p>
      <form class="online-auth" aria-label="Online account"><label>Username<input aria-label="Online username" name="username" autocomplete="username" minlength="3" maxlength="32" pattern="[-_a-zA-Z0-9]{3,32}" required></label>
        <label>Password<input aria-label="Online password" name="password" type="password" autocomplete="current-password" minlength="8" maxlength="128" required></label>
        <div class="online-actions"><button type="submit" class="primary">Sign in</button><button type="button" data-online="register">Create account</button><button type="button" data-online="guest">Play as guest</button></div>
      </form>
      <section class="online-account" hidden><p>Signed in as <strong class="online-username"></strong></p><button type="button" data-online="logout">Sign out</button></section>
      <section class="online-browser" hidden><div class="online-heading"><h3>Lobbies</h3><button type="button" data-online="refresh">Refresh lobbies</button></div>
        <p class="online-rules">Matches run on the server. Opening menus or taking a photo keeps the match clock running. Spectators receive a delayed view.</p>
        <form class="online-create" aria-label="Create online lobby"><label>Map size<select aria-label="Lobby map size"><option value="small">Small</option><option value="medium" selected>Medium</option><option value="large">Large</option><option value="huge">Huge</option></select></label>
          <label>First faction<select aria-label="First lobby faction">${factionOptions('orcs')}</select></label><label>Second faction<select aria-label="Second lobby faction">${factionOptions('fairies')}</select></label>
          <button type="submit">Create lobby</button></form>
        <ul class="online-lobby-list" aria-label="Available online lobbies"></ul>
        <section class="online-current" aria-label="Current online lobby" hidden><h3>Current lobby</h3><p class="online-lobby-id"></p><ol class="online-seats"></ol>
          <form class="online-configure" aria-label="Configure online lobby"><label>Map size<select aria-label="Current lobby map size"><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option><option value="huge">Huge</option></select></label>
            <label>First faction<select aria-label="Current first faction">${factionOptions('orcs')}</select></label><label>Second faction<select aria-label="Current second faction">${factionOptions('fairies')}</select></label><button type="submit">Apply lobby settings</button></form>
          <div class="online-actions"><button type="button" data-online="ready">Ready</button><button type="button" data-online="start">Start match</button><button type="button" data-online="leave">Leave lobby</button><button type="button" data-online="rejoin" hidden>Rejoin match</button></div>
        </section>
        <form class="online-spectate" aria-label="Spectate online match"><label>Match ID<input aria-label="Spectator match ID" required maxlength="128"></label><label>Perspective<select aria-label="Spectator perspective"><option value="0">First player</option><option value="1">Second player</option></select></label><button type="submit">Spectate match</button></form>
      </section></section></div>`;
  root.append(host);
  const element=<T extends HTMLElement=HTMLElement>(selector:string)=>host.querySelector<T>(selector)!;
  const overlay=element('.online-overlay'),dialog=element('.online-dialog');
  let account:Account|null=null,lobbies:LobbyObservation[]=[],current:LobbyObservation|null=null,busy=false,disposed=false;
  let polling:ReturnType<typeof setTimeout>|undefined,previousFocus:HTMLElement|null=null,configDirty=false,requestEpoch=0;
  const message=(text:string)=>{element('.online-message').textContent=text;};
  const ownsSeat=(lobby:LobbyObservation)=>{const accountId=account?.id;return accountId?lobby.seats.find(seat=>seat.account?.id===accountId):undefined;};
  function render() {
    element('.online-auth').hidden=!!account;element('.online-account').hidden=!account;element('.online-browser').hidden=!account;
    element('.online-username').textContent=account?.username??'';
    for(const node of Array.from(host.querySelectorAll<HTMLButtonElement>('button')))node.disabled=busy;
    const list=element('.online-lobby-list');list.replaceChildren();
    for(const lobby of lobbies) {
      const row=document.createElement('li'),description=document.createElement('span');
      description.textContent=`${lobby.id.slice(0,8)} · ${lobby.settings.mapSize} · ${lobby.seats.filter(seat=>seat.account).length}/${lobby.seats.length} players${lobby.matchId?' · Match started':''}`;
      row.append(description);
      const button=document.createElement('button');button.type='button';
      button.textContent=ownsSeat(lobby)?(lobby.matchId?'Rejoin match':'View lobby'):'Join lobby';
      button.setAttribute('aria-label',`${button.textContent} ${lobby.id}`);button.disabled=busy||!!lobby.matchId&&!ownsSeat(lobby);
      button.onclick=()=>void run(async()=>{
        if(lobby.matchId){await enterMatch({matchId:lobby.matchId,role:'player'});return;}
        current=ownsSeat(lobby)?await api.lobby(lobby.id):await api.changeLobby(lobby,'join');configDirty=false;render();
      });row.append(button);
      if(lobby.matchId){const spectate=document.createElement('button');spectate.textContent='Spectate';spectate.type='button';spectate.disabled=busy;
        spectate.setAttribute('aria-label',`Spectate match ${lobby.matchId}`);spectate.onclick=()=>void run(()=>enterMatch({matchId:lobby.matchId!,role:'spectator',perspective:0}));row.append(spectate);}
      list.append(row);
    }
    if(!lobbies.length){const row=document.createElement('li');row.textContent='No lobbies yet. Create one to invite another player.';list.append(row);}
    element('.online-current').hidden=!current;
    if(!current)return;
    element('.online-lobby-id').textContent=current.id;
    const seats=element('.online-seats');seats.replaceChildren();
    for(const seat of current.seats){const row=document.createElement('li');row.textContent=`Player ${seat.side+1}: ${seat.account?.username??'Open seat'} · ${FACTIONS[current.settings.factions[seat.side]].name} · ${seat.ready?'Ready':'Not ready'}`;seats.append(row);}
    const own=ownsSeat(current),hosted=current.hostId===account?.id,started=!!current.matchId;
    element('.online-configure').hidden=!hosted||started;
    if(!configDirty){element<HTMLSelectElement>('[aria-label="Current lobby map size"]').value=current.settings.mapSize;
      element<HTMLSelectElement>('[aria-label="Current first faction"]').value=current.settings.factions[0];element<HTMLSelectElement>('[aria-label="Current second faction"]').value=current.settings.factions[1];}
    const ready=element<HTMLButtonElement>('[data-online="ready"]');ready.hidden=started;ready.disabled=busy||!own;ready.textContent=own?.ready?'Not ready':'Ready';ready.setAttribute('aria-pressed',String(!!own?.ready));
    const start=element<HTMLButtonElement>('[data-online="start"]');start.hidden=!hosted||started;start.disabled=busy||current.seats.some(seat=>!seat.account||!seat.ready);
    element<HTMLButtonElement>('[data-online="leave"]').hidden=started;
    element<HTMLButtonElement>('[data-online="rejoin"]').hidden=!started||!own;
  }
  async function refresh() {
    if(!account||disposed)return;
    const epoch=requestEpoch,accountId=account.id,currentId=current?.id;
    try {
      const nextLobbies=await api.lobbies();
      let nextCurrent=currentId?(nextLobbies.find(lobby=>lobby.id===currentId)??await api.lobby(currentId)):null;
      if(disposed||epoch!==requestEpoch||account?.id!==accountId)return;
      if(nextCurrent&&!ownsSeat(nextCurrent))nextCurrent=null;
      lobbies=nextLobbies;current=nextCurrent;render();
    }catch(error) {
      if(disposed||epoch!==requestEpoch||account?.id!==accountId)return;
      if(error instanceof OnlineRequestError&&error.status===401){account=null;current=null;lobbies=[];render();}
      throw error;
    }
  }
  async function run(action:()=>Promise<unknown>) {
    if(busy||disposed)return;requestEpoch++;busy=true;render();
    try {await action();}
    catch(error) {
      if(error instanceof OnlineRequestError&&error.status===401){account=null;current=null;lobbies=[];}
      message(error instanceof Error?error.message:'Online request failed.');
      if(error instanceof OnlineRequestError&&error.status===409)try{await refresh();}catch{}
    }finally {busy=false;if(!disposed)render();}
  }
  async function enterMatch(request:OnlineMatchRequest) {
    if(disposed)return;
    message(request.role==='spectator'?'Connecting to a delayed spectator view…':'Joining the match…');
    await options.onJoinMatch(request);hide();
  }
  function pollLater() {
    if(disposed||overlay.hidden||!account)return;
    polling=setTimeout(async()=>{
      if(!busy)try{await refresh();}catch(error){message(error instanceof Error?error.message:'Could not refresh lobbies.');}
      pollLater();
    },options.pollIntervalMs??2000);
  }
  async function show() {
    if(disposed)return;previousFocus=document.activeElement as HTMLElement|null;overlay.hidden=false;options.onVisibility?.(true);dialog.focus();
    await run(async()=>{account=await api.session();message(account?'Choose a lobby or create one.':'Sign in, create an account or play as a guest.');await refresh();});
    if(polling)clearTimeout(polling);pollLater();
  }
  function hide() {
    if(overlay.hidden)return;overlay.hidden=true;if(polling)clearTimeout(polling);polling=undefined;options.onVisibility?.(false);previousFocus?.focus();
  }
  const credentials=()=>({username:element<HTMLInputElement>('[aria-label="Online username"]').value.trim(),password:element<HTMLInputElement>('[aria-label="Online password"]').value});
  async function authenticate(mode:'login'|'register'|'guest') {
    if(mode!=='guest'&&!element<HTMLFormElement>('.online-auth').reportValidity())return;
    await run(async()=>{const value=credentials();account=mode==='guest'?await api.guest():await api[mode](value.username,value.password);
      element<HTMLInputElement>('[aria-label="Online password"]').value='';message(`Signed in as ${account.username}.`);await refresh();});
    if(polling)clearTimeout(polling);pollLater();
  }
  element<HTMLButtonElement>('.online-open').onclick=()=>void show();element<HTMLButtonElement>('.online-close').onclick=hide;
  element<HTMLFormElement>('.online-auth').onsubmit=event=>{event.preventDefault();void authenticate('login');};
  element<HTMLButtonElement>('[data-online="register"]').onclick=()=>void authenticate('register');element<HTMLButtonElement>('[data-online="guest"]').onclick=()=>void authenticate('guest');
  element<HTMLButtonElement>('[data-online="logout"]').onclick=()=>void run(async()=>{await api.logout();account=null;current=null;lobbies=[];message('Signed out.');});
  element<HTMLButtonElement>('[data-online="refresh"]').onclick=()=>void run(refresh);
  const settings=(prefix:''|'Current '):LobbySettings=>({
    mapSize:element<HTMLSelectElement>(`[aria-label="${prefix?prefix+'lobby':'Lobby'} map size"]`).value as MapSize,
    factions:prefix?[element<HTMLSelectElement>('[aria-label="Current first faction"]').value as FactionId,element<HTMLSelectElement>('[aria-label="Current second faction"]').value as FactionId]:[element<HTMLSelectElement>('[aria-label="First lobby faction"]').value as FactionId,element<HTMLSelectElement>('[aria-label="Second lobby faction"]').value as FactionId],
  });
  element<HTMLFormElement>('.online-create').onsubmit=event=>{event.preventDefault();void run(async()=>{current=await api.createLobby(settings(''));configDirty=false;message('Lobby created. Other players can join from the lobby list.');await refresh();});};
  element<HTMLFormElement>('.online-configure').onchange=()=>{configDirty=true;};
  element<HTMLFormElement>('.online-configure').onsubmit=event=>{event.preventDefault();if(current)void run(async()=>{current=await api.changeLobby(current!,'settings',{settings:settings('Current ')});configDirty=false;message('Settings updated. Players must ready up again.');await refresh();});};
  element<HTMLButtonElement>('[data-online="ready"]').onclick=()=>{if(current)void run(async()=>{current=await api.changeLobby(current!,'ready',{ready:!ownsSeat(current!)?.ready});await refresh();});};
  element<HTMLButtonElement>('[data-online="start"]').onclick=()=>{if(current)void run(async()=>{current=await api.changeLobby(current!,'start');await enterMatch({matchId:current.matchId!,role:'player'});});};
  element<HTMLButtonElement>('[data-online="leave"]').onclick=()=>{if(current)void run(async()=>{await api.changeLobby(current!,'leave');current=null;configDirty=false;message('Left the lobby.');await refresh();});};
  element<HTMLButtonElement>('[data-online="rejoin"]').onclick=()=>{if(current?.matchId)void run(()=>enterMatch({matchId:current!.matchId!,role:'player'}));};
  element<HTMLFormElement>('.online-spectate').onsubmit=event=>{event.preventDefault();if(!element<HTMLFormElement>('.online-spectate').reportValidity())return;
    void run(()=>enterMatch({matchId:element<HTMLInputElement>('[aria-label="Spectator match ID"]').value.trim(),role:'spectator',perspective:Number(element<HTMLSelectElement>('[aria-label="Spectator perspective"]').value) as Side}));};
  host.addEventListener('keydown',event=>{
    if(overlay.hidden)return;event.stopPropagation();
    if(event.key==='Escape'){event.preventDefault();hide();return;}
    if(event.key==='Tab') {
      const nodes=Array.from(dialog.querySelectorAll<HTMLElement>('button,input,select,[tabindex="0"]')).filter(node=>!node.closest('[hidden]')&&!('disabled' in node&&node.disabled));
      const first=nodes[0],last=nodes.at(-1);
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  });
  return {show,hide,get visible(){return !overlay.hidden;},get account(){return account;},get currentLobby(){return current;},refresh,
    dispose(){if(disposed)return;hide();disposed=true;requestEpoch++;if(polling)clearTimeout(polling);host.remove();}};
}
