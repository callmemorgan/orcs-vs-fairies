import { normalizeMatchRules } from '../core/match-rules';
import { AGE_NAMES } from '../core/progression';
import { FACTIONS } from '../core/content';
import type { Age,Cost,FactionId, MapSize, Side } from '../core/types';
import { OnlineApi, OnlineRequestError } from '../online/client';
import type { Account, LobbyObservation,LobbyPlayerSettings,LobbySettings } from '../online/protocol';
import { definitionName, MatchRulesForm, MATCH_MODE_NAMES } from './MatchRules';
import { mountDraftPanel } from './ObjectivePanel';
import './online-lobby.css';

export interface OnlineMatchRequest { matchId:string;role:'player'|'spectator';perspective?:Side;view?:'player'|'team' }
export interface OnlineLobbyOptions {
  api?:OnlineApi;onJoinMatch:(request:OnlineMatchRequest)=>void|Promise<void>;
  onVisibility?:(visible:boolean)=>void;pollIntervalMs?:number;
  toolbar?:HTMLElement;
  onAccount?:(account:Account|null)=>void;
}
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const factionOptions=(selected:FactionId)=>Object.values(FACTIONS).map(faction=>`<option value="${faction.id}"${faction.id===selected?' selected':''}>${escape(faction.name)}</option>`).join('');
type LobbyPlayer=LobbyPlayerSettings;
type TeamSettings=LobbySettings;
const playerCountOptions=Array.from({length:7},(_,index)=>`<option value="${index+2}">${index+2} players</option>`).join('');

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
          <label>Players<select aria-label="Lobby player count">${playerCountOptions}</select></label><label>Starting age<select aria-label="Lobby starting age"><option value="1">Settlement</option><option value="2">Town</option><option value="3">Citadel</option></select></label>
          <label class="online-check"><input aria-label="Lobby shared vision" type="checkbox" checked>Share vision with allies</label><div class="online-player-settings"></div>
          <button type="submit">Create lobby</button></form>
        <ul class="online-lobby-list" aria-label="Available online lobbies"></ul>
        <section class="online-current" aria-label="Current online lobby" hidden><h3>Current lobby</h3><p class="online-lobby-id"></p><ol class="online-seats"></ol><section class="online-received-rules" aria-label="Received lobby rules"><h4>Match rules</h4><div class="online-received-rule-values"></div></section>
          <details class="online-configure-details"><summary>Lobby settings</summary><form class="online-configure" aria-label="Configure online lobby"><label>Map size<select aria-label="Current lobby map size"><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option><option value="huge">Huge</option></select></label>
            <label>Players<select aria-label="Current lobby player count">${playerCountOptions}</select></label><label>Starting age<select aria-label="Current lobby starting age"><option value="1">Settlement</option><option value="2">Town</option><option value="3">Citadel</option></select></label>
            <label class="online-check"><input aria-label="Current lobby shared vision" type="checkbox" checked>Share vision with allies</label><div class="online-player-settings"></div><button type="submit">Apply lobby settings</button></form></details>
          <div class="online-actions"><button type="button" data-online="ready">Ready</button><button type="button" data-online="start">Start match</button><button type="button" data-online="leave">Leave lobby</button><button type="button" data-online="rejoin" hidden>Rejoin match</button></div>
        </section>
        <form class="online-spectate" aria-label="Spectate online match"><label>Match ID<input aria-label="Spectator match ID" required maxlength="128"></label><label>Perspective<select aria-label="Spectator perspective">${Array.from({length:8},(_,index)=>`<option value="${index}">Player ${index+1}</option>`).join('')}</select></label>
          <label>View<select aria-label="Spectator view"><option value="player">Player</option><option value="team">Team</option></select></label><button type="submit">Spectate match</button></form>
      </section></section></div>`;
  root.append(host);
  const element=<T extends HTMLElement=HTMLElement>(selector:string)=>host.querySelector<T>(selector)!;
  const overlay=element('.online-overlay'),dialog=element('.online-dialog');
  let reportedAccountId:string|null|undefined;
  const setAccount=(next:Account|null)=>{account=next;const id=next?.id??null;if(reportedAccountId!==id){reportedAccountId=id;options.onAccount?.(next);}};
  let account:Account|null=null,lobbies:LobbyObservation[]=[],current:LobbyObservation|null=null,busy=false,disposed=false;
  let polling:ReturnType<typeof setTimeout>|undefined,previousFocus:HTMLElement|null=null,configDirty=false,requestEpoch=0;
  const message=(text:string)=>{element('.online-message').textContent=text;};
  const ownsSeat=(lobby:LobbyObservation)=>{const accountId=account?.id;return accountId?lobby.seats.find(seat=>seat.account?.id===accountId):undefined;};
  const defaultPlayers=(settings?:LobbySettings):LobbyPlayer[]=>{
    const teamSettings=settings as TeamSettings|undefined;
    return teamSettings?.players??(settings?.factions??['orcs','fairies']).map((factionId,index)=>({factionId:factionId as FactionId,teamId:index as Side,controller:'human'}));
  };
  function playerFields(form:HTMLFormElement,prefix:''|'Current ',players:LobbyPlayer[]) {
    const container=form.querySelector<HTMLElement>('.online-player-settings')!;container.replaceChildren();
    players.forEach((player,index)=>{
      const row=document.createElement('fieldset');row.dataset.player=String(index);row.dataset.resourceOverride=String(!!player.handicap?.startingResources);
      const scope=prefix?'Current':'Lobby';
      const factionLabel=prefix?(index===0?'Current first faction':index===1?'Current second faction':`Current player ${index+1} faction`):(index===0?'First lobby faction':index===1?'Second lobby faction':`Lobby player ${index+1} faction`);
      const resources=player.handicap?.startingResources??{wood:420,ore:220,crystal:0};
      row.innerHTML=`<legend>Player ${index+1}</legend><label>Faction<select data-field="faction" aria-label="${factionLabel}">${factionOptions(player.factionId)}</select></label>
        <label>Team<select data-field="team" aria-label="${scope} player ${index+1} team">${Array.from({length:8},(_,team)=>`<option value="${team}"${team===player.teamId?' selected':''}>Team ${team+1}</option>`).join('')}</select></label>
        <label>Controller<select data-field="controller" aria-label="${scope} player ${index+1} controller"><option value="human"${player.controller==='human'?' selected':''}>Human</option><option value="ai"${player.controller==='ai'?' selected':''}>AI</option></select></label>
        <details><summary>Handicap</summary><label>Starting wood<input data-field="wood" type="number" min="0" max="1000000" step="1" required aria-label="${scope} player ${index+1} starting wood" value="${resources.wood}"></label>
          <label>Starting ore<input data-field="ore" type="number" min="0" max="1000000" step="1" required aria-label="${scope} player ${index+1} starting ore" value="${resources.ore}"></label>
          <label>Starting crystal<input data-field="crystal" type="number" min="0" max="1000000" step="1" required aria-label="${scope} player ${index+1} starting crystal" value="${resources.crystal}"></label>
          <label>Income multiplier<input data-field="income" type="number" min="0" max="10" step="any" required aria-label="${scope} player ${index+1} income multiplier" value="${player.handicap?.incomeFactor??1}"></label>
          <label>Population limit<input data-field="population" type="number" min="1" max="500" step="1" required aria-label="${scope} player ${index+1} population limit" value="${player.handicap?.populationCap??100}"></label></details>`;
      row.addEventListener('input',event=>{const field=(event.target as HTMLElement).dataset.field;if(field&&['wood','ore','crystal'].includes(field))row.dataset.resourceOverride='true';});
      container.append(row);
    });
  }
  const createForm=element<HTMLFormElement>('.online-create'),configureForm=element<HTMLFormElement>('.online-configure');
  playerFields(createForm,'',defaultPlayers());playerFields(configureForm,'Current ',defaultPlayers());
  const createRules=new MatchRulesForm(createForm,{labelPrefix:'Lobby ',includeTeamSettings:false,onChange:()=>syncResources(createForm,createRules)});
  const configureRules=new MatchRulesForm(configureForm,{labelPrefix:'Current lobby ',includeTeamSettings:false,onChange:()=>{configDirty=true;syncResources(configureForm,configureRules);}});
  function syncResources(form:HTMLFormElement,rules:MatchRulesForm) { try { const resources=rules.value.startingResources; for(const row of Array.from(form.querySelectorAll<HTMLElement>('[data-player]'))) if(row.dataset.resourceOverride!=='true') for(const key of ['wood','ore','crystal'] as const) row.querySelector<HTMLInputElement>(`[data-field="${key}"]`)!.value=String(resources[key]); } catch {} }
  const draft=mountDraftPanel(element('.online-current'),{getDraft:()=>current?.settings.rules?.draft?.enabled?current?.draft:null,canSubmit:()=>!busy&&!disposed&&!!current&&!current.seats.some(seat=>seat.controller!=='ai'&&!seat.account),side:()=>current?ownsSeat(current)?.side:undefined,revision:()=>current?.revision,players:()=>current?defaultPlayers(current.settings).map((player,id)=>({id:id as Side,factionId:player.factionId})):[],submit:async definitionId=>current?await run(async()=>{current=await api.changeLobby(current!,'draft',{definitionId});await refresh();}):false});
  function receivedRules(lobby:LobbyObservation) {
    const summary=element('.online-received-rule-values'),key=JSON.stringify({revision:lobby.revision,settings:lobby.settings});
    if(summary.dataset.key===key)return;summary.dataset.key=key;summary.replaceChildren();
    const rules=normalizeMatchRules({...lobby.settings.rules,startingAge:lobby.settings.startingAge??lobby.settings.rules?.startingAge??1,sharedVision:lobby.settings.sharedVision??lobby.settings.rules?.sharedVision??true});
    const seconds=(ticks:number)=>`${ticks/20} seconds`,resources=(cost:Cost)=>`${cost.wood} wood, ${cost.ore} ore, ${cost.crystal} crystal`;
    const line=(text:string,className?:string)=>{const node=document.createElement('p');node.textContent=text;if(className)node.className=className;summary.append(node);return node;};
    line(`Server revision ${lobby.revision} · Map ${lobby.settings.mapSize} · ${MATCH_MODE_NAMES[rules.mode]}`);
    line(`Starting age: ${AGE_NAMES[rules.startingAge]} (${rules.startingAge}) · Shared team vision: ${rules.sharedVision?'On':'Off'} · Friendly fire: ${rules.friendlyFire?'On':'Off'}`);
    line(`Headquarters defeat: ${rules.standardDefeat?'On':'Off'} · Match starting resources: ${resources(rules.startingResources)}`);
    line(`Disabled definitions: ${rules.disabledDefinitionIds.length?rules.disabledDefinitionIds.map(id=>`${definitionName(id)} (${id})`).join(', '):'None'}`);
    if(rules.mode==='hill')line(`Hill radius: ${rules.hill.radius} tiles · Capture: ${seconds(rules.hill.captureTicks)} · Hold to win: ${seconds(rules.hill.holdTicks)}`);
    if(rules.mode==='relic')line(`Relics: ${rules.relic.count} · Required to win: ${rules.relic.required} · Hold to win: ${seconds(rules.relic.holdTicks)} · Pickup radius: ${rules.relic.pickupRadius} tiles`);
    if(rules.mode==='survival')line(`Survival: Team ${rules.survival.defenderTeam+1} defends · ${rules.survival.waveCount} waves · Base units per wave: ${rules.survival.unitsPerWave} · First wave after ${seconds(rules.survival.intervalTicks)} · Recovery: ${seconds(rules.survival.recoveryTicks)} · Reward per cleared wave for each defender: ${resources(rules.survival.rewardPerWave)}`);
    if(rules.mode==='scenario')line('The selected scenario supplies its scripted objectives.');
    line(rules.draft.enabled?`Army draft: On · ${rules.draft.banRounds} ban rounds · ${rules.draft.pickRounds} pick rounds · Turn: ${seconds(rules.draft.turnTicks)}. Each player starts with one combat soldier, replaced by their first picked combat unit. Every player must pick a combat unit. Recruitment and research are limited to that player’s picks. Workers and age technologies do not require a pick; disabled definitions and bans still apply.`:'Army draft: Off');
    defaultPlayers(lobby.settings).forEach((player,index)=>{const row=line(`Player ${index+1} · ${FACTIONS[player.factionId].name} · Team ${player.teamId+1} · ${player.controller==='ai'?'Computer':'Human'} · Starting resources: ${resources(player.handicap?.startingResources??rules.startingResources)} · Income ×${player.handicap?.incomeFactor??1} · Population limit ${player.handicap?.populationCap??100}`,'online-received-player');row.dataset.receivedPlayer=String(index);});
  }
  function render() {
    element('.online-auth').hidden=!!account;element('.online-account').hidden=!account;element('.online-browser').hidden=!account;
    element('.online-username').textContent=account?.username??'';
    for(const node of Array.from(host.querySelectorAll<HTMLButtonElement>('button')))node.disabled=busy;
    const list=element('.online-lobby-list'),listKey=JSON.stringify({accountId:account?.id,busy,lobbies});
    if(list.dataset.key!==listKey){list.dataset.key=listKey;list.replaceChildren();
    for(const lobby of lobbies) {
      const row=document.createElement('li'),description=document.createElement('span');
      const occupied=lobby.seats.filter(seat=>seat.account||seat.controller==='ai'||lobby.settings.players?.[seat.side]?.controller==='ai').length;
      description.textContent=`${lobby.id.slice(0,8)} · ${lobby.settings.mapSize} · ${MATCH_MODE_NAMES[lobby.settings.rules?.mode??'annihilation']} · ${occupied}/${lobby.seats.length} players${lobby.matchId?' · Match started':''}`;
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
    }
    element('.online-current').hidden=!current;
    createForm.hidden=!!current;
    if(!current)return;
    element('.online-lobby-id').textContent=`${current.id} · Server revision ${current.revision} · ${MATCH_MODE_NAMES[current.settings.rules?.mode??'annihilation']}`;
    receivedRules(current);draft.update();
    const seats=element('.online-seats');seats.replaceChildren();
    const factions:readonly FactionId[]=current.settings.factions;
    const settings=current.settings as TeamSettings;
    for(const seat of current.seats){const player=settings.players?.[seat.side],row=document.createElement('li');row.textContent=`Player ${seat.side+1}: ${player?.controller==='ai'?'AI':seat.account?.username??'Open seat'} · ${FACTIONS[factions[seat.side]].name} · Team ${(player?.teamId??seat.side)+1} · ${player?.controller==='ai'?'AI ready':seat.ready?'Ready':'Not ready'}`;seats.append(row);}
    const own=ownsSeat(current),hosted=current.hostId===account?.id,started=!!current.matchId;
    element('.online-configure').hidden=!hosted||started;
    element('.online-configure-details').hidden=!hosted||started;
    if(!configDirty&&configureForm.dataset.settings!==JSON.stringify(settings)){
      configureForm.dataset.settings=JSON.stringify(settings);element<HTMLSelectElement>('[aria-label="Current lobby map size"]').value=settings.mapSize;
      element<HTMLSelectElement>('[aria-label="Current lobby player count"]').value=String(settings.factions.length);
      element<HTMLSelectElement>('[aria-label="Current lobby starting age"]').value=String(settings.startingAge??1);element<HTMLInputElement>('[aria-label="Current lobby shared vision"]').checked=settings.sharedVision??true;
      playerFields(configureForm,'Current ',defaultPlayers(settings));configureRules.update(settings.rules);syncResources(configureForm,configureRules);
    }
    const ready=element<HTMLButtonElement>('[data-online="ready"]');ready.hidden=started;ready.disabled=busy||!own||current.draft?.status==='drafting';ready.textContent=own?.ready?'Not ready':'Ready';ready.setAttribute('aria-pressed',String(!!own?.ready));
    const start=element<HTMLButtonElement>('[data-online="start"]');start.hidden=!hosted||started;start.disabled=busy||current.draft?.status==='drafting'||current.seats.some(seat=>settings.players?.[seat.side]?.controller!=='ai'&&(!seat.account||!seat.ready));
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
      if(error instanceof OnlineRequestError&&error.status===401){setAccount(null);current=null;lobbies=[];render();}
      throw error;
    }
  }
  async function run(action:()=>Promise<unknown>) {
    if(busy||disposed)return false;requestEpoch++;busy=true;render();
    try {await action();return true;}
    catch(error) {
      if(error instanceof OnlineRequestError&&error.status===401){setAccount(null);current=null;lobbies=[];}
      message(error instanceof Error?error.message:'Online request failed.');
      if(error instanceof OnlineRequestError&&error.status===409)try{await refresh();}catch{}
      return false;
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
    await run(async()=>{setAccount(await api.session());message(account?'Choose a lobby or create one.':'Sign in, create an account or play as a guest.');await refresh();});
    if(polling)clearTimeout(polling);pollLater();
  }
  function hide() {
    if(overlay.hidden)return;overlay.hidden=true;if(polling)clearTimeout(polling);polling=undefined;options.onVisibility?.(false);previousFocus?.focus();
  }
  const credentials=()=>({username:element<HTMLInputElement>('[aria-label="Online username"]').value.trim(),password:element<HTMLInputElement>('[aria-label="Online password"]').value});
  async function authenticate(mode:'login'|'register'|'guest') {
    if(mode!=='guest'&&!element<HTMLFormElement>('.online-auth').reportValidity())return;
    await run(async()=>{const value=credentials(),signedIn=mode==='guest'?await api.guest():await api[mode](value.username,value.password);setAccount(signedIn);
      element<HTMLInputElement>('[aria-label="Online password"]').value='';message(`Signed in as ${signedIn.username}.`);await refresh();});
    if(polling)clearTimeout(polling);pollLater();
  }
  const launch=element<HTMLButtonElement>('.online-open');launch.onclick=()=>void show();element<HTMLButtonElement>('.online-close').onclick=hide;
  element<HTMLFormElement>('.online-auth').onsubmit=event=>{event.preventDefault();void authenticate('login');};
  element<HTMLButtonElement>('[data-online="register"]').onclick=()=>void authenticate('register');element<HTMLButtonElement>('[data-online="guest"]').onclick=()=>void authenticate('guest');
  element<HTMLButtonElement>('[data-online="logout"]').onclick=()=>void run(async()=>{await api.logout();setAccount(null);current=null;lobbies=[];message('Signed out.');});
  element<HTMLButtonElement>('[data-online="refresh"]').onclick=()=>void run(refresh);
  const readPlayers=(form:HTMLFormElement):LobbyPlayer[]=>Array.from(form.querySelectorAll<HTMLFieldSetElement>('[data-player]')).map(row=>{
    const value=(field:string)=>(row.querySelector<HTMLInputElement|HTMLSelectElement>(`[data-field="${field}"]`)!).value;
    const startingResources={wood:Number(value('wood')),ore:Number(value('ore')),crystal:Number(value('crystal'))},incomeFactor=Number(value('income')),populationCap=Number(value('population'));
    const matchResources=(form===configureForm?configureRules:createRules).value.startingResources;
    const handicap={...(row.dataset.resourceOverride==='true'||startingResources.wood!==matchResources.wood||startingResources.ore!==matchResources.ore||startingResources.crystal!==matchResources.crystal?{startingResources}:{}),...(incomeFactor!==1?{incomeFactor}:{}),...(populationCap!==100?{populationCap}:{})};
    return {factionId:value('faction') as FactionId,teamId:Number(value('team')) as Side,controller:value('controller') as 'human'|'ai',...(Object.keys(handicap).length?{handicap}:{})};
  });
  const readSettings=(prefix:''|'Current '):LobbySettings=>{
    const players=readPlayers(prefix?configureForm:createForm),scope=prefix?'Current lobby':'Lobby';
    return {mapSize:element<HTMLSelectElement>(`[aria-label="${scope} map size"]`).value as MapSize,factions:players.map(player=>player.factionId),players,
      sharedVision:element<HTMLInputElement>(`[aria-label="${scope} shared vision"]`).checked,startingAge:Number(element<HTMLSelectElement>(`[aria-label="${scope} starting age"]`).value) as Age,...((prefix?configureRules:createRules).isDefault?{}:{rules:{...(prefix?configureRules:createRules).value,sharedVision:element<HTMLInputElement>(`[aria-label="${scope} shared vision"]`).checked,startingAge:Number(element<HTMLSelectElement>(`[aria-label="${scope} starting age"]`).value) as Age}})} as TeamSettings;
  };
  const resizePlayers=(form:HTMLFormElement,prefix:''|'Current ')=>{
    const players=readPlayers(form),scope=prefix?'Current lobby':'Lobby',count=Number(element<HTMLSelectElement>(`[aria-label="${scope} player count"]`).value);
    playerFields(form,prefix,Array.from({length:count},(_,index)=>players[index]??{factionId:index%2?'fairies':'orcs',teamId:index as Side,controller:'human'}));
    syncResources(form,prefix?configureRules:createRules);if(prefix)configDirty=true;
  };
  element<HTMLSelectElement>('[aria-label="Lobby player count"]').onchange=()=>resizePlayers(createForm,'');element<HTMLSelectElement>('[aria-label="Current lobby player count"]').onchange=()=>resizePlayers(configureForm,'Current ');
  createForm.onsubmit=event=>{event.preventDefault();if(!createForm.reportValidity())return;void run(async()=>{current=await api.createLobby(readSettings(''));configDirty=false;message('Lobby created. Other players can join from the lobby list.');await refresh();});};
  configureForm.onchange=configureForm.oninput=()=>{configDirty=true;};
  configureForm.onsubmit=event=>{event.preventDefault();if(!configureForm.reportValidity())return;if(current)void run(async()=>{current=await api.changeLobby(current!,'settings',{settings:readSettings('Current ')});configDirty=false;message('Settings updated. Players must ready up again.');await refresh();});};
  element<HTMLButtonElement>('[data-online="ready"]').onclick=()=>{if(current)void run(async()=>{current=await api.changeLobby(current!,'ready',{ready:!ownsSeat(current!)?.ready});await refresh();});};
  element<HTMLButtonElement>('[data-online="start"]').onclick=()=>{if(current)void run(async()=>{current=await api.changeLobby(current!,'start');await enterMatch({matchId:current.matchId!,role:'player'});});};
  element<HTMLButtonElement>('[data-online="leave"]').onclick=()=>{if(current)void run(async()=>{await api.changeLobby(current!,'leave');current=null;configDirty=false;message('Left the lobby.');await refresh();});};
  element<HTMLButtonElement>('[data-online="rejoin"]').onclick=()=>{if(current?.matchId)void run(()=>enterMatch({matchId:current!.matchId!,role:'player'}));};
  element<HTMLFormElement>('.online-spectate').onsubmit=event=>{event.preventDefault();if(!element<HTMLFormElement>('.online-spectate').reportValidity())return;
    void run(()=>enterMatch({matchId:element<HTMLInputElement>('[aria-label="Spectator match ID"]').value.trim(),role:'spectator',perspective:Number(element<HTMLSelectElement>('[aria-label="Spectator perspective"]').value) as Side,
      view:element<HTMLSelectElement>('[aria-label="Spectator view"]').value as 'player'|'team'}));};
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
  if(options.toolbar)options.toolbar.append(launch);
  return {show,hide,get visible(){return !overlay.hidden;},get account(){return account;},get currentLobby(){return current;},refresh,
    dispose(){if(disposed)return;hide();disposed=true;requestEpoch++;if(polling)clearTimeout(polling);createRules.destroy();configureRules.destroy();draft.dispose();launch.remove();host.remove();}};
}
