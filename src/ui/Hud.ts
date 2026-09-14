import { PlayerView } from '../core/observation';
import { ABILITIES, FACTIONS, UPGRADES } from '../core/content';
import type { BuildingRole, Cost, Entity, FactionId, GameState, MapSize, UnitRole, UpgradeId } from '../core/types';
import './style.css';
import { createTooltip } from './Tooltip';
import { abilityTargetReason } from './availability';

export interface HudCallbacks {
  build:(role:BuildingRole)=>void; train:(role:UnitRole)=>void; cancelTrain:(id:number,index:number,expectedQueue:string)=>void; research:(upgrade:UpgradeId)=>void; ability:()=>void; clearRally:()=>void;
  stop:()=>void; hold:()=>void; attackMove:()=>void; select:(ids:number[])=>void; pause:()=>void; restart:()=>void; center:(x:number,y:number)=>void;
  toggleMuted:()=>void; isMuted:()=>boolean;
  cameraCorners:()=>Array<{x:number;y:number}>; groups:()=>Record<string,number[]>; recallGroup:(group:string)=>void;
}
const traits:Record<FactionId,string>={orcs:'Armored troops • Battle momentum',fairies:'Swift archers • Illusions & healing',dwarves:'Engineers • Emplaced firepower',undead:'Expendable ranks • Raise the fallen',tideborn:'Amphibious troops • Healing surge',automata:'Recharging shields • Ward Engines'};
const art=(id:string)=>`/assets/selection-${id}.png`;
const costMarkup=(cost:Cost)=>`<span class="cost wood">${cost.wood}<i>wood</i></span><span class="cost ore">${cost.ore}<i>ore</i></span>${cost.crystal?`<span class="cost crystal">${cost.crystal}<i>crystal</i></span>`:''}`;
const escape = (value:string) => value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const costText = (cost:Cost) => `${cost.wood} wood · ${cost.ore} ore${cost.crystal?` · ${cost.crystal} crystal`:""}`;
export function mountShell(root:HTMLElement,onStart:(faction:FactionId,opponent:FactionId,mapSize:MapSize,seed:number)=>void) {
  let faction:FactionId='orcs';
  let callbacks:HudCallbacks|undefined;
  let paused=false;
  let state:GameState|undefined;
  const playerView=new PlayerView(0);
  let actionsKey='';
  let actionMode:'build'|'recruit'='build';
  let noticeUntil=0;
  const actions:Array<{button:HTMLButtonElement; cost?:Cost; train?:boolean; entity?:Entity; ability?:boolean; upgrade?:UpgradeId; description:string; name:string; hotkey?:string}> = [];
  root.innerHTML=`
  <main class="war-shell">
    <div id="game-canvas" aria-label="Skirmish battlefield"></div>
    <section class="war-menu" aria-label="Start a skirmish">
      <div class="menu-mist"></div><div class="menu-content">
        <div class="eyebrow">THE BATTLE FOR THE ELDERWOOD</div>
        <h1>Orcs <span>vs</span> Fairies</h1>
        <p class="menu-intro">Choose your banner</p>
        <div class="faction-grid">
          ${Object.values(FACTIONS).map(f=>`<button class="faction-card ${f.id}-card ${f.id==='orcs'?'selected':''}" data-faction="${f.id}" aria-pressed="${f.id==='orcs'}"><img class="faction-portrait" src="/assets/portrait-${f.id}.png" alt="" /><span class="faction-type">${f.id}</span><strong>${escape(f.name)}</strong><span class="faction-trait">${escape(traits[f.id])}</span></button>`).join('')}
        </div>
        <div class="banner-brief"><strong id="banner-brief-name">Ironclad</strong><span id="banner-brief-description">${escape(FACTIONS.orcs.description)}</span></div><div class="match-settings"><label class="opponent-label" for="opponent">AI opponent</label>
        <select id="opponent">${Object.values(FACTIONS).map(f=>`<option value="${f.id}" ${f.id==='fairies'?'selected':''}>${escape(f.id[0].toUpperCase()+f.id.slice(1))} · ${escape(f.name)}</option>`).join('')}</select>
        <label for="map-size">Map size</label><select id="map-size"><option value="small">Small · 36 × 36</option><option value="medium" selected>Medium · 48 × 48</option><option value="large">Large · 64 × 64</option></select><label for="map-seed">Seed</label><input id="map-seed" type="number" min="0" max="4294967295" step="1" value="4127" /></div>
        <button class="primary begin-match">Begin skirmish <span>→</span></button>

        <div class="menu-guide"><span><kbd>Drag</kbd> Select army</span><span><kbd>Right click</kbd> Give orders</span><span><kbd>A</kbd> Attack-move</span><span><kbd>Arrows</kbd> Pan camera</span></div>
        <p class="menu-objective">Gather wood, ore and crystal, build your settlement, then destroy the enemy stronghold.</p>
      </div>
    </section>
    <section class="war-hud" hidden aria-label="Game controls">
      <header class="resource-bar panel"><div class="banner"><img class="banner-icon" id="banner-portrait" src="/assets/portrait-orcs.png" alt="" /><div><small>YOUR FACTION</small><strong id="faction-name"></strong></div></div>
        <div class="resource" title="Workers gather wood from trees"><span class="wood-symbol">♠</span><div><small>WOOD</small><b id="wood">0</b></div></div>
        <div class="resource" title="Workers gather ore from deposits"><span class="ore-symbol">◆</span><div><small>ORE</small><b id="ore">0</b></div></div>
        <div class="resource" title="Crystal funds advanced troops and defensive towers"><span class="crystal-symbol">◆</span><div><small>CRYSTAL</small><b id="crystal">0</b></div></div>
        <div class="resource" title="Build a depot to raise your population limit"><span>⚑</span><div><small id="supply-label">SUPPLY</small><b id="population">0 / 0</b></div></div>
        <div class="match-clock" id="clock">00:00</div><button id="sound-button" class="small-button" aria-pressed="false">Mute sound</button><button id="pause-button" class="small-button">Pause</button><button id="restart-button" class="small-button">Restart</button>
      </header>
      <div class="objective-tag">Destroy the enemy stronghold</div>
      <div class="notice" role="status" aria-live="polite" hidden></div>
      <footer class="tactical-bar">
        <section class="minimap-panel panel"><div class="panel-label">ELDERWOOD <span>TACTICAL MAP</span></div><canvas id="minimap" width="216" height="216" title="Click to move your camera" aria-label="Tactical map; click to center the camera"></canvas></section>
        <section class="selection-panel panel"><div class="panel-label">SELECTION <span id="selection-count">NO UNITS</span></div><div class="selection-content"><div class="portrait" id="portrait">⚑</div><div class="selection-details"><h2 id="selection-name">Your command awaits</h2><div class="health-track" hidden><div id="health-fill"></div></div><div class="construction-track" hidden><i></i></div><p id="selection-status">Select a worker to gather resources or raise your first buildings.</p><p id="selection-description" hidden></p><div id="selection-stats"></div></div></div><div class="selection-roster" id="selection-roster"></div><div id="production-queue"></div><div class="saved-groups" id="saved-groups" aria-label="Control groups"></div><div class="key-guide"><span><kbd>F2</kbd> Army</span><span><kbd>Shift</kbd> Add selection</span><span><kbd>Ctrl + 1–9</kbd> Set group</span><span><kbd>1–9</kbd> Recall group</span><span><kbd>Space</kbd> Home</span></div></section>
        <section class="command-panel panel"><div class="panel-label">ORDERS <span id="command-hint">SELECT A UNIT</span><nav id="command-tabs" aria-label="Command category" hidden><button data-mode="build">Build</button><button data-mode="recruit">Recruit</button></nav></div><div id="action-buttons"></div><div class="command-note"><span id="order-hint">Right-click to give orders</span> <span><kbd>Esc</kbd> Cancel</span></div></section>
      </footer>
    </section>
    <div class="loading-battle" role="status" hidden><span>Preparing the battlefield…</span></div>
    <section class="game-overlay" hidden><div class="overlay-card panel"><div class="eyebrow" id="overlay-eyebrow">SKIRMISH</div><h2 id="overlay-title">Battle paused</h2><p id="overlay-description">Take a moment to plan your next move.</p><button id="resume-button" class="primary">Return to battle</button><button id="overlay-restart" class="small-button">New skirmish</button></div></section>
  </main>`;
  const el=<T extends HTMLElement=HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
  const tooltip=createTooltip(root);
  const menu=el('.war-menu'),hud=el('.war-hud'),overlay=el('.game-overlay');
  const setText=(selector:string,text:string)=>{const node=el(selector);if(node.textContent!==text)node.textContent=text;};
  const notice=(text:string)=>{setText('.notice',text);el('.notice').hidden=false;noticeUntil=performance.now()+4500;};
  const reset=()=>{tooltip.hide();el('.loading-battle').hidden=true;paused=false;overlay.hidden=true;actionsKey='';actionMode='build';el('#selection-roster').dataset.ids='';el('#selection-roster').replaceChildren();el('#production-queue').dataset.key='';el('#production-queue').replaceChildren();el('#saved-groups').replaceChildren();};
  root.querySelectorAll<HTMLButtonElement>('[data-faction]').forEach(button=>button.addEventListener('click',()=>{
    faction=button.dataset.faction as FactionId;
    setText('#banner-brief-name',FACTIONS[faction].name);setText('#banner-brief-description',FACTIONS[faction].description);
    root.querySelectorAll('[data-faction]').forEach(card=>{const active=(card as HTMLElement).dataset.faction===faction;card.classList.toggle('selected',active);card.setAttribute('aria-pressed',String(active));});
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button=>button.addEventListener('click',()=>{actionMode=button.dataset.mode as 'build'|'recruit';actionsKey='';}));
  el('.begin-match').addEventListener('click',()=>{
    const input=el<HTMLInputElement>('#map-seed'),seed=Number(input.value);input.setCustomValidity('');
    if(!input.value.trim()||!Number.isSafeInteger(seed)||seed<0||seed>4294967295){input.setCustomValidity('Enter a whole-number seed from 0 to 4294967295.');input.reportValidity();return;}
    onStart(faction,el<HTMLSelectElement>('#opponent').value as FactionId,el<HTMLSelectElement>('#map-size').value as MapSize,seed);
  });
  const togglePause=()=>{if(!callbacks||(state?.winner!==null||state?.draw))return;paused=!paused;callbacks.pause();};
  el('#pause-button').addEventListener('click',togglePause);
  el('#sound-button').addEventListener('click',()=>callbacks?.toggleMuted());
  el('#resume-button').addEventListener('click',togglePause);
  el('#restart-button').addEventListener('click',()=>{reset();callbacks?.restart();});
  el('#overlay-restart').addEventListener('click',()=>{reset();callbacks?.restart();});
  window.addEventListener('keydown',event=>{if(menu.hidden&&!overlay.hidden)return;if(!menu.hidden||event.repeat||event.ctrlKey||event.metaKey||event.altKey||(event.target as HTMLElement).closest('input,textarea,select'))return;const key=event.key.toUpperCase();if(!['Z','C','B','V'].includes(key))return;const action=actions.find(a=>a.hotkey===key);if(action){event.preventDefault();action.button.click();}});
  const map=el<HTMLCanvasElement>('#minimap'),ctx=map.getContext('2d')!;
  map.addEventListener('click',event=>{if(!state)return;const rect=map.getBoundingClientRect();callbacks?.center((event.clientX-rect.left)/rect.width*state.width,(event.clientY-rect.top)/rect.height*state.height);});
  function drawMinimap(s:GameState) {
    const cw=map.width/s.width,ch=map.height/s.height;
    ctx.fillStyle='#070e10';ctx.fillRect(0,0,map.width,map.height);
    for(const i of s.explored[0]){ctx.fillStyle=s.visible[0].has(i)?({grass:'#45654a',road:'#8e8058',mud:'#69593f',water:'#316579',shallows:'#609690',rock:'#7c8386',bridge:'#b49a6b'}[s.terrain[i]]):'#22342d';ctx.fillRect((i%s.width)*cw,Math.floor(i/s.width)*ch,Math.ceil(cw),Math.ceil(ch));}
    for(const r of playerView.resourcesFor(s)){const i=Math.floor(r.y)*s.width+Math.floor(r.x);if(r.amount<=0||!s.explored[0].has(i))continue;ctx.fillStyle=r.kind==='wood'?'#688c53':r.kind==='crystal'?'#b497e7':'#b49c76';ctx.fillRect(r.x*cw-1,r.y*ch-1,2,2);}
    for(const e of s.entities){if(e.hp<=0||e.side===1&&!s.visible[0].has(Math.floor(e.y)*s.width+Math.floor(e.x)))continue;ctx.fillStyle=e.side===0?'#d0eb96':'#ee785a';const size=e.kind==='building'?5:3;ctx.fillRect(e.x*cw-size/2,e.y*ch-size/2,size,size);}
    const corners=callbacks?.cameraCorners()??[];if(corners.length){ctx.strokeStyle='#fff0b6';ctx.lineWidth=1.5;ctx.beginPath();corners.forEach((p,i)=>{if(i===0)ctx.moveTo(p.x*cw,p.y*ch);else ctx.lineTo(p.x*cw,p.y*ch);});ctx.closePath();ctx.stroke();}
  }
  return {
    showMenu:()=>{reset();menu.hidden=false;hud.hidden=true;},
    showGame:()=>{reset();menu.hidden=true;hud.hidden=false;el('.loading-battle').hidden=false;},
    ready:()=>{el('.loading-battle').hidden=true;},
    battlefieldBounds:()=>({top:el('.resource-bar').getBoundingClientRect().bottom,bottom:el('.tactical-bar').getBoundingClientRect().top}),
    notice,
    update:(s:GameState,selected:number[],cb:HudCallbacks)=>{
      state=s;callbacks=cb;if(!menu.hidden)return;const player=s.players[0],definition=FACTIONS[player.faction];
      setText('#sound-button',cb.isMuted()?'Enable sound':'Mute sound');el('#sound-button').setAttribute('aria-pressed',String(cb.isMuted()));
      setText('#faction-name',definition.name);el<HTMLImageElement>('#banner-portrait').src=`/assets/portrait-${player.faction}.png`;setText('#wood',Math.floor(player.wood).toString());setText('#ore',Math.floor(player.ore).toString());setText('#crystal',Math.floor(player.crystal).toString());setText('#population',`${player.population} / ${player.cap}`);
      el('.objective-tag').textContent=`Destroy the enemy stronghold · ${s.mapSize} · seed ${s.seed}`;
      setText('#clock',`${Math.floor(s.time/60).toString().padStart(2,'0')}:${Math.floor(s.time%60).toString().padStart(2,'0')}`);
      if(performance.now()>noticeUntil)el('.notice').hidden=true;
      const entities=s.entities.filter(e=>selected.includes(e.id)&&e.hp>0&&(e.side===0||s.visible[0].has(Math.floor(e.y)*s.width+Math.floor(e.x))));const own=entities.filter(e=>e.side===0);const first=entities[0];
      const entityDef=first?(first.kind==='unit'?FACTIONS[s.players[first.side].faction].units[first.role as UnitRole]:FACTIONS[s.players[first.side].faction].buildings[first.role as BuildingRole]):null;
      setText('#selection-count',entities.length?`${entities.length} SELECTED`:'NO UNITS');
      setText('#selection-name',entities.length>1?`${entities.length} selected`:entityDef?.name??'Your command awaits');
      const portraitId=entityDef?.id??'';if(el('#portrait').dataset.asset!==portraitId){el('#portrait').dataset.asset=portraitId;el('#portrait').innerHTML=portraitId?`<img src="/assets/selection-${portraitId}.png" alt="${escape(entityDef!.name)}" />`:'⚑';}
      el('.health-track').hidden=!first;
      if(first){el('#health-fill').style.width=`${Math.max(0,first.hp/first.maxHp)*100}%`;setText('#selection-status',`${Math.ceil(first.hp)} / ${first.maxHp} health${first.progress<1?` · Building ${Math.floor(first.progress*100)}%`:first.kind==='unit'?` · ${first.order.type==='idle'?'Ready':first.order.type==='hold'?'Holding position':first.order.type}`:''}${first.entrenchedAt!==undefined?(s.time-first.entrenchedAt>=3?' · Emplaced':' · Preparing emplacement'):''}${first.maxShield?` · Shield ${Math.ceil(first.shield??0)}/${first.maxShield}`:''}${(first.surgeUntil??0)>s.time?' · Surging':''}${first.raised?' · Raised · '+Math.ceil(first.expires-s.time)+'s remaining':''}${first.rally?' · Rally set':''}${first.research?` · Researching ${UPGRADES[first.research].name} ${Math.floor(first.researchProgress*100)}%`:''}${first.side===1?' · Enemy':''}`);}
      else setText('#selection-status','Select a worker to gather resources or raise your first buildings.');
      const construction=el('.construction-track');construction.hidden=!first||(first.progress>=1&&!first.research);if(first)construction.querySelector<HTMLElement>('i')!.style.width=`${(first.progress<1?first.progress:first.researchProgress)*100}%`;
      if(entities.length>1){const hp=entities.reduce((total,e)=>total+e.hp,0),maxHp=entities.reduce((total,e)=>total+e.maxHp,0);el('#health-fill').style.width=`${hp/maxHp*100}%`;setText('#selection-status',`${Math.ceil(hp)} / ${maxHp} group health`);construction.hidden=true;}
      else if(first?.kind==='unit'){const gatherTarget=first.order.type==='gather'?first.order.target:undefined;const resource=s.resources.find(r=>r.id===gatherTarget);const status=resource?`Gathering ${resource.kind}`:({idle:'Ready',hold:'Holding position',move:'Moving',attackMove:'Advancing',attack:'Attacking',build:'Building'} as Record<string,string>)[first.order.type]??first.order.type;el('#selection-status').textContent=el('#selection-status').textContent!.replace(/ · (Ready|Holding position|idle|hold|move|attackMove|attack|gather|build)/,` · ${status}`);}
      const groupHost=el('#saved-groups'),groups=cb.groups();const groupKey=JSON.stringify(groups);
      if(groupHost.dataset.key!==groupKey){groupHost.dataset.key=groupKey;groupHost.replaceChildren();for(const [key,ids] of Object.entries(groups)){if(!ids.length)continue;const button=document.createElement('button');button.className='group-shortcut';button.dataset.group=key;button.setAttribute('aria-label',`Recall group ${key}`);button.dataset.tooltip=`<h3>Control group ${key}</h3><p>${ids.length} ${ids.length===1?'unit':'units'} • Click or press ${key} to recall. Ctrl + ${key} replaces this group with your selection.</p>`;button.innerHTML=`<kbd>${key}</kbd><span>${ids.length}</span>`;button.addEventListener('click',()=>callbacks?.recallGroup(key));groupHost.append(button);}}
      for(const button of Array.from(groupHost.querySelectorAll<HTMLElement>('[data-group]'))){const ids=groups[button.dataset.group!]??[];button.classList.toggle('active',ids.length===selected.length&&ids.every(id=>selected.includes(id)));}

      setText('#selection-description',entityDef?.description??'');
      el('#portrait').dataset.tooltip=entityDef?`<h3>${escape(entityDef.name)}</h3><p>${escape(entityDef.description)}</p>${first?.kind==='building'&&(first.role==='hq'||first.role==='barracks')?'<p>Right-click open ground to set a rally point for new units.</p>':''}`:'<h3>Select a unit</h3><p>Click a unit or drag across your army. Shift adds to your selection. F2 selects combat units.</p>';
      el('#portrait').tabIndex=0;
      const stats=el('#selection-stats');
      stats.innerHTML=first?.kind==='unit'&&entityDef&&'damage' in entityDef?`<span title="Attack damage">ATK <b>${entityDef.damage}</b></span><span title="Armor">ARM <b>${entityDef.armor}</b></span><span title="Weapon range">RNG <b>${entityDef.range}</b></span>${first.carried?`<span>Carrying <b>${first.carried} ${first.carriedKind}</b></span>`:''}`:'';
      const roster=el('#selection-roster');
      const rosterKey=entities.length>1?entities.map(e=>e.id).join(','):'';
      if(roster.dataset.ids!==rosterKey){roster.dataset.ids=rosterKey;roster.replaceChildren();if(entities.length>1)for(const e of entities){const d=e.kind==='unit'?FACTIONS[s.players[e.side].faction].units[e.role as UnitRole]:FACTIONS[s.players[e.side].faction].buildings[e.role as BuildingRole];const button=document.createElement('button');button.className='roster-unit';button.dataset.id=String(e.id);button.setAttribute('aria-label',`Select ${d.name} ${e.id}`);button.innerHTML=`<img src="${art(d.id)}" alt=""/><span class="mini-health"><i></i></span>`;button.addEventListener('click',event=>callbacks?.select(event.shiftKey?entities.filter(x=>x.id!==e.id).map(x=>x.id):[e.id]));roster.append(button);}}
      for(const button of Array.from(roster.querySelectorAll<HTMLElement>('.roster-unit'))){const e=entities.find(e=>e.id===Number(button.dataset.id));if(e){button.querySelector<HTMLElement>('i')!.style.width=`${e.hp/e.maxHp*100}%`;button.dataset.tooltip=`<h3>${escape((e.kind==='unit'?FACTIONS[s.players[e.side].faction].units[e.role as UnitRole]:FACTIONS[s.players[e.side].faction].buildings[e.role as BuildingRole]).name)}</h3><p>${Math.ceil(e.hp)} / ${e.maxHp} health</p><p>Click to select. Shift-click to remove from this selection.</p>`;}}

      const casters=own.filter(e=>e.kind==='unit'&&!e.illusion&&definition.units[e.role as UnitRole]?.ability);
      const abilityIds=[...new Set(casters.map(e=>definition.units[e.role as UnitRole].ability!))];
      const abilityName=abilityIds.length===1?ABILITIES[abilityIds[0]].name:'Use abilities';
      const hasWorkers=own.some(e=>e.kind==='unit'&&e.role==='worker');
      const selectedProducer=own.find(e=>e.kind==='building'&&(e.role==='hq'||e.role==='barracks'));
      el('#command-tabs').hidden=!(hasWorkers&&selectedProducer);
      root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===actionMode)));
      const key=`${actionMode}:${player.faction}:${own.map(e=>`${e.id}/${e.progress>=1}/${!!e.rally}`).join(',')}:${abilityIds.join(',')}`;
      if(key!==actionsKey){
        actionsKey=key;actions.length=0;const container=el('#action-buttons');container.replaceChildren();
        const add=(name:string,asset:string,description:string,run:()=>void,cost?:Cost,train=false,entity?:Entity,hotkey?:string)=>{const button=document.createElement('button');button.className='action-button';button.setAttribute('aria-label',name);button.innerHTML=`<img class="action-icon" src="${asset}" alt=""/>${hotkey?`<kbd>${hotkey}</kbd>`:''}<strong>${escape(name)}</strong>${cost?`<small>${costMarkup(cost)}</small>`:''}<span class="action-state"></span>`;button.addEventListener('click',()=>{if(button.getAttribute('aria-disabled')!=='true')run();});container.append(button);actions.push({button,cost,train,entity,description,name,hotkey});};
        if(hasWorkers&&(!selectedProducer||actionMode==='build'))for(const [index,role] of (['hq','depot','barracks','tower'] as BuildingRole[]).entries()){const d=definition.buildings[role];add(d.name,art(d.id),`${d.description} • ${d.buildTime}s construction`,()=>callbacks?.build(role),d.cost,false,undefined,['Z','C','B','V'][index]);}
        const producer=selectedProducer;
        if(producer&&(!hasWorkers||actionMode==='recruit'))for(const [index,role] of ((producer.role==='hq'?['worker']:['melee','ranged','special']) as UnitRole[]).entries()){const d=definition.units[role];add(d.name,art(d.id),`${d.description} • ${d.trainTime}s recruitment`,()=>callbacks?.train(role),d.cost,true,producer,['Z','C','B'][index]);}
        if(producer&&(!hasWorkers||actionMode==='recruit')){const recruitSlots=producer.role==='hq'?1:3;for(const [index,u] of Object.values(UPGRADES).filter(u=>u.building===producer.role).entries()){add(u.name,art(definition.units[u.appliesTo].id),`${u.description} • ${u.researchTime}s research`,()=>callbacks?.research(u.id),u.cost,false,producer,['Z','C','B','V'][recruitSlots+index]);actions[actions.length-1].upgrade=u.id;}}
        if(selectedProducer&&(!hasWorkers||actionMode==='recruit')&&own.some(e=>e.rally))add('Clear rally','/assets/ui-halt.png','Remove the rally point. New recruits will wait outside this building.',()=>callbacks?.clearRally());
        if(own.some(e=>e.kind==='unit')){add('Attack move',art(definition.units.melee.id),'Move to a destination and fight enemies along the way. Click a destination after choosing this order.',()=>callbacks?.attackMove(),undefined,false,undefined,'A');add('Halt','/assets/ui-halt.png','Stop current orders. Units may pursue nearby enemies.',()=>callbacks?.stop(),undefined,false,undefined,'X');add('Hold position','/assets/ui-hold.png','Attack enemies in weapon range without pursuing.',()=>callbacks?.hold(),undefined,false,undefined,'H');if(casters.length){add(abilityName,art(definition.units[casters[0].role as UnitRole].id),abilityIds.map(id=>`${ABILITIES[id].name}: ${ABILITIES[id].description} (${ABILITIES[id].cooldown}s cooldown)`).join(' • '),()=>callbacks?.ability(),undefined,false,undefined,'Q');actions[actions.length-1].ability=true;}}
        setText('#command-hint',hasWorkers&&selectedProducer?'':own.length?'YOUR ORDERS':'SELECT A UNIT');
      }
      el('#order-hint').textContent=selectedProducer?'Right-click ground to set rally':'Right-click to give orders';
      const reserved=s.entities.filter(e=>e.side===0&&e.hp>0).reduce((sum,e)=>sum+e.queue.length,0);
      setText('#supply-label',reserved?`SUPPLY · +${reserved}`:'SUPPLY');el('#population').classList.toggle('supply-full',player.population+reserved>=player.cap);el('#population').parentElement!.parentElement!.dataset.tooltip=`<h3>Army supply</h3><p>${player.population} in the field • ${reserved} places reserved by recruitment • ${player.cap} capacity</p><p>Build a depot to increase capacity.</p>`;
      for(const action of actions){
        const missing=action.cost?(['wood','ore','crystal'] as const).filter(kind=>player[kind]<action.cost![kind]).map(kind=>`${Math.ceil(action.cost![kind]-player[kind])} ${kind}`):[];
        let reason=missing.length?`Need ${missing.join(', ')}`:'';
        if(action.train){if(action.entity!.progress<1)reason='Under construction';else if(action.entity!.queue.length>=5)reason='Queue full';else if(player.population+reserved>=player.cap)reason='Build a depot for supply';}
        if(action.upgrade){if(action.entity!.progress<1)reason='Under construction';else if(action.entity!.research)reason=`Researching ${UPGRADES[action.entity!.research].name}`;else if(player.upgrades.includes(action.upgrade))reason='Researched';}
        if(action.ability){const remaining=Math.max(0,Math.ceil(Math.min(...casters.map(e=>(e.abilityReadyAt??0)-s.time))));if(remaining>0)reason=`${remaining}s cooldown`;else reason=abilityTargetReason(s,casters);action.button.style.setProperty('--cooldown',`${remaining?Math.min(100,remaining/Math.max(...abilityIds.map(id=>ABILITIES[id].cooldown))*100):0}%`);}
        if(paused)reason='Battle paused';if(s.winner!==null||s.draw)reason='Match ended';
        action.button.setAttribute('aria-disabled',String(!!reason));action.button.classList.toggle('unavailable',!!reason);
        action.button.querySelector<HTMLElement>('.action-state')!.textContent=action.ability?(reason.includes('cooldown')?reason.replace(' cooldown',''):reason?'Unavailable':'Ready'):reason?'×':'';
        action.button.dataset.tooltip=`<h3>${escape(action.name)} ${action.hotkey?`<kbd>${action.hotkey}</kbd>`:''}</h3>${action.cost?`<div class="tooltip-cost">${costMarkup(action.cost)}</div>`:''}<p>${escape(action.description)}</p>${reason?`<p class="unavailable-reason">${escape(reason)}</p>`:'<p class="ready-reason">Ready</p>'}`;
      }
      const producers=own.filter(e=>e.queue.length>0);const queue=el('#production-queue');
      const queueKey=producers.map(e=>`${e.id}:${e.queue.join(',')}`).join(';');
      if(queue.dataset.key!==queueKey){queue.dataset.key=queueKey;queue.innerHTML=producers.map(producer=>`<div class="queue-row" data-producer="${producer.id}"><span class="queue-label">RECRUITING</span>${producer.queue.map((role,i)=>`<button type="button" class="queue-item" data-index="${i}" aria-label="Cancel ${escape(definition.units[role].name)} in queue slot ${i+1}" data-tooltip="${escape(`<h3>${definition.units[role].name}</h3><p>${i===0?'In production':'Queued'} • ${definition.units[role].trainTime}s recruitment</p><p>Click to cancel. Full refund: ${costText(definition.units[role].cost)}.</p>`)}"><img src="${art(definition.units[role].id)}" alt="${escape(definition.units[role].name)}"/>${i===0?'<b></b><span class="queue-progress"><i></i></span>':`<em>${i+1}</em>`}</button>`).join('')}</div>`).join('');}
      for(const producer of producers){const row=queue.querySelector<HTMLElement>(`[data-producer="${producer.id}"]`)!;for(const button of Array.from(row.querySelectorAll<HTMLButtonElement>('.queue-item'))){button.disabled=paused||s.winner!==null||s.draw;const expected=JSON.stringify(producer.queue);button.onclick=()=>callbacks?.cancelTrain(producer.id,Number(button.dataset.index),expected);}}
      for(const producer of producers){const row=queue.querySelector<HTMLElement>(`[data-producer="${producer.id}"]`)!;row.querySelector('b')!.textContent=`${Math.ceil((1-producer.trainProgress)*definition.units[producer.queue[0]].trainTime)}s`;row.querySelector<HTMLElement>('.queue-progress i')!.style.width=`${producer.trainProgress*100}%`;}
      tooltip.refresh();
      overlay.hidden=!paused&&s.winner===null&&!s.draw;
      if(!overlay.hidden){const ended=s.winner!==null||s.draw;setText('#overlay-title',ended?s.draw?'Draw':s.winner===0?'Victory':'Defeat':'Battle paused');setText('#overlay-eyebrow',ended?'THE BATTLE IS OVER':'SKIRMISH');setText('#overlay-description',ended?s.draw?'Both strongholds fell in the same exchange.':s.winner===0?'The enemy stronghold has fallen. The Elderwood is yours.':'Your stronghold has fallen. Raise your banner and try again.':'Take a moment to plan your next move.');el('#resume-button').hidden=ended;}
      setText('#pause-button',paused?'Resume':'Pause');drawMinimap(s);
    }
  };
}
