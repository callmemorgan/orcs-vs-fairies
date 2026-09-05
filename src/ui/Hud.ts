import { ABILITIES, FACTIONS } from '../core/content';
import type { BuildingRole, Cost, Entity, FactionId, GameState, UnitRole } from '../core/types';
import './style.css';

export interface HudCallbacks {
  build:(role:BuildingRole)=>void; train:(role:UnitRole)=>void; ability:()=>void;
  stop:()=>void; hold:()=>void; pause:()=>void; restart:()=>void; center:(x:number,y:number)=>void;
  toggleMuted:()=>void; isMuted:()=>boolean;
}
const icons:Record<string,string> = {worker:'⚒',melee:'⚔',ranged:'➶',special:'✧',hq:'♜',depot:'▣',barracks:'⚑',tower:'♖'};
const escape = (value:string) => value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const costText = (cost:Cost) => `${cost.wood} wood · ${cost.ore} ore`;
export function mountShell(root:HTMLElement,onStart:(faction:FactionId)=>void) {
  let faction:FactionId='orcs';
  let callbacks:HudCallbacks|undefined;
  let paused=false;
  let state:GameState|undefined;
  let actionsKey='';
  let noticeUntil=0;
  const actions:Array<{button:HTMLButtonElement; cost?:Cost; train?:boolean; entity?:Entity; ability?:boolean}> = [];
  root.innerHTML=`
  <main class="war-shell">
    <div id="game-canvas" aria-label="Skirmish battlefield"></div>
    <section class="war-menu" aria-label="Start a skirmish">
      <div class="menu-mist"></div><div class="menu-content">
        <div class="eyebrow">THE BATTLE FOR THE ELDERWOOD</div>
        <h1>Orcs <span>vs</span> Fairies</h1>
        <p class="menu-intro">Iron at the forest's edge. Magic beneath its roots.<br>Choose your banner. Build your army. Claim the wood.</p>
        <div class="faction-grid">
          <button class="faction-card orc-card selected" data-faction="orcs" aria-pressed="true">
            <span class="crest">⚔</span><span class="eyebrow">THE ORCS</span><strong>Ironclad</strong>
            <span class="faction-summary">Raise iron strongholds and commit armored troops to battle. Sustained combat builds their momentum.</span>
            <span class="faction-trait">ARMOR &nbsp; / &nbsp; MOMENTUM</span>
          </button>
          <button class="faction-card fairy-card" data-faction="fairies" aria-pressed="false">
            <span class="crest">✧</span><span class="eyebrow">THE FAIRIES</span><strong>Wild Court</strong>
            <span class="faction-summary">Grow a living settlement. Strike with swift warriors, conjure illusions, and recover beneath healing groves.</span>
            <span class="faction-trait">MOBILITY &nbsp; / &nbsp; ILLUSIONS</span>
          </button>
        </div>
        <button class="primary begin-match">Begin skirmish <span>→</span></button>
        <p class="match-caption">ELDERWOOD &nbsp; · &nbsp; SINGLE PLAYER VS AI &nbsp; · &nbsp; 10–15 MIN</p>
        <div class="menu-guide"><span><kbd>Drag</kbd> Select army</span><span><kbd>Right click</kbd> Give orders</span><span><kbd>A</kbd> Attack-move</span><span><kbd>Arrows</kbd> Pan camera</span></div>
        <p class="menu-objective">Gather wood and ore, build your settlement, then destroy the enemy stronghold.</p>
      </div>
    </section>
    <section class="war-hud" hidden aria-label="Game controls">
      <header class="resource-bar panel"><div class="banner"><span class="banner-icon">⚑</span><div><small>YOUR BANNER</small><strong id="faction-name"></strong></div></div>
        <div class="resource" title="Workers gather wood from trees"><span class="wood-symbol">♠</span><div><small>WOOD</small><b id="wood">0</b></div></div>
        <div class="resource" title="Workers gather ore from deposits"><span class="ore-symbol">◆</span><div><small>ORE</small><b id="ore">0</b></div></div>
        <div class="resource" title="Build a depot to raise your population limit"><span>⚑</span><div><small>ARMY</small><b id="population">0 / 0</b></div></div>
        <div class="match-clock" id="clock">00:00</div><button id="sound-button" class="small-button" aria-pressed="false">Mute sound</button><button id="pause-button" class="small-button">Pause</button><button id="restart-button" class="small-button">Restart</button>
      </header>
      <div class="objective-tag">Destroy the enemy stronghold</div>
      <div class="notice" role="status" aria-live="polite" hidden></div>
      <footer class="tactical-bar">
        <section class="minimap-panel panel"><div class="panel-label">ELDERWOOD <span>TACTICAL MAP</span></div><canvas id="minimap" width="176" height="176" title="Click to move your camera" aria-label="Tactical map; click to center the camera"></canvas></section>
        <section class="selection-panel panel"><div class="panel-label">SELECTION <span id="selection-count">NO UNITS</span></div><div class="selection-content"><div class="portrait" id="portrait">⚑</div><div class="selection-details"><h2 id="selection-name">Your command awaits</h2><div class="health-track" hidden><div id="health-fill"></div></div><p id="selection-status">Select a worker to gather resources or raise your first buildings.</p><p id="selection-description"></p></div></div><div id="production-queue"></div><div class="key-guide"><span><kbd>F2</kbd> Army</span><span><kbd>Shift</kbd> Add selection</span><span><kbd>Ctrl + 1–9</kbd> Set group</span><span><kbd>1–9</kbd> Recall group</span><span><kbd>Space</kbd> Home</span></div></section>
        <section class="command-panel panel"><div class="panel-label">ORDERS <span id="command-hint">SELECT A UNIT</span></div><div id="action-buttons"></div><div class="command-note">Right click to move, gather, build, or attack.<br><kbd>A</kbd> then click to attack-move. <kbd>Esc</kbd> cancels placement.</div></section>
      </footer>
    </section>
    <section class="game-overlay" hidden><div class="overlay-card panel"><div class="eyebrow" id="overlay-eyebrow">SKIRMISH</div><h2 id="overlay-title">Battle paused</h2><p id="overlay-description">Take a moment to plan your next move.</p><button id="resume-button" class="primary">Return to battle</button><button id="overlay-restart" class="small-button">New skirmish</button></div></section>
  </main>`;
  const el=<T extends HTMLElement=HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
  const menu=el('.war-menu'),hud=el('.war-hud'),overlay=el('.game-overlay');
  const setText=(selector:string,text:string)=>{const node=el(selector);if(node.textContent!==text)node.textContent=text;};
  const notice=(text:string)=>{setText('.notice',text);el('.notice').hidden=false;noticeUntil=performance.now()+4500;};
  const reset=()=>{paused=false;overlay.hidden=true;actionsKey='';};
  root.querySelectorAll<HTMLButtonElement>('[data-faction]').forEach(button=>button.addEventListener('click',()=>{
    faction=button.dataset.faction as FactionId;
    root.querySelectorAll('[data-faction]').forEach(card=>{const active=(card as HTMLElement).dataset.faction===faction;card.classList.toggle('selected',active);card.setAttribute('aria-pressed',String(active));});
  }));
  el('.begin-match').addEventListener('click',()=>onStart(faction));
  const togglePause=()=>{if(!callbacks||state?.winner!==null)return;paused=!paused;callbacks.pause();};
  el('#pause-button').addEventListener('click',togglePause);
  el('#sound-button').addEventListener('click',()=>callbacks?.toggleMuted());
  el('#resume-button').addEventListener('click',togglePause);
  el('#restart-button').addEventListener('click',()=>{reset();callbacks?.restart();});
  el('#overlay-restart').addEventListener('click',()=>{reset();callbacks?.restart();});
  const map=el<HTMLCanvasElement>('#minimap'),ctx=map.getContext('2d')!;
  map.addEventListener('click',event=>{if(!state)return;const rect=map.getBoundingClientRect();callbacks?.center((event.clientX-rect.left)/rect.width*state.width,(event.clientY-rect.top)/rect.height*state.height);});
  function drawMinimap(s:GameState) {
    const cw=map.width/s.width,ch=map.height/s.height;
    ctx.fillStyle='#070e10';ctx.fillRect(0,0,map.width,map.height);
    for(const i of s.explored[0]){ctx.fillStyle=s.visible[0].has(i)?'#45654a':'#22342d';ctx.fillRect((i%s.width)*cw,Math.floor(i/s.width)*ch,Math.ceil(cw),Math.ceil(ch));}
    for(const r of s.resources){const i=Math.floor(r.y)*s.width+Math.floor(r.x);if(r.amount<=0||!s.explored[0].has(i))continue;ctx.fillStyle=r.kind==='wood'?'#688c53':'#b49c76';ctx.fillRect(r.x*cw-1,r.y*ch-1,2,2);}
    for(const e of s.entities){if(e.hp<=0||e.side===1&&!s.visible[0].has(Math.floor(e.y)*s.width+Math.floor(e.x)))continue;ctx.fillStyle=e.side===0?'#d0eb96':'#ee785a';const size=e.kind==='building'?5:3;ctx.fillRect(e.x*cw-size/2,e.y*ch-size/2,size,size);}
  }
  return {
    showMenu:()=>{reset();menu.hidden=false;hud.hidden=true;},
    showGame:()=>{reset();menu.hidden=true;hud.hidden=false;},
    notice,
    update:(s:GameState,selected:number[],cb:HudCallbacks)=>{
      state=s;callbacks=cb;const player=s.players[0],definition=FACTIONS[player.faction];
      setText('#sound-button',cb.isMuted()?'Enable sound':'Mute sound');el('#sound-button').setAttribute('aria-pressed',String(cb.isMuted()));
      setText('#faction-name',definition.name);setText('#wood',Math.floor(player.wood).toString());setText('#ore',Math.floor(player.ore).toString());setText('#population',`${player.population} / ${player.cap}`);
      setText('#clock',`${Math.floor(s.time/60).toString().padStart(2,'0')}:${Math.floor(s.time%60).toString().padStart(2,'0')}`);
      if(performance.now()>noticeUntil)el('.notice').hidden=true;
      const entities=s.entities.filter(e=>selected.includes(e.id)&&e.hp>0&&(e.side===0||s.visible[0].has(Math.floor(e.y)*s.width+Math.floor(e.x))));const own=entities.filter(e=>e.side===0);const first=entities[0];
      const entityDef=first?(first.kind==='unit'?FACTIONS[s.players[first.side].faction].units[first.role as UnitRole]:FACTIONS[s.players[first.side].faction].buildings[first.role as BuildingRole]):null;
      setText('#selection-count',entities.length?`${entities.length} SELECTED`:'NO UNITS');
      setText('#selection-name',entities.length>1?`${entities.length} units selected`:entityDef?.name??'Your command awaits');
      setText('#portrait',first?icons[first.role]:'⚑');
      el('.health-track').hidden=!first;
      if(first){el('#health-fill').style.width=`${Math.max(0,first.hp/first.maxHp)*100}%`;setText('#selection-status',`${Math.ceil(first.hp)} / ${first.maxHp} health${first.progress<1?` · Building ${Math.floor(first.progress*100)}%`:first.kind==='unit'?` · ${first.order.type==='idle'?'Ready':first.order.type==='hold'?'Holding position':first.order.type}`:''}${first.side===1?' · Enemy':''}`);}
      else setText('#selection-status','Select a worker to gather resources or raise your first buildings.');
      setText('#selection-description',entityDef?.description??'');
      const casters=own.filter(e=>e.kind==='unit'&&!e.illusion&&definition.units[e.role as UnitRole]?.ability);
      const abilityIds=[...new Set(casters.map(e=>definition.units[e.role as UnitRole].ability!))];
      const abilityName=abilityIds.length===1?ABILITIES[abilityIds[0]].name:'Use abilities';
      const key=`${player.faction}:${own.map(e=>`${e.id}/${e.progress>=1}`).join(',')}:${abilityIds.join(',')}`;
      if(key!==actionsKey){
        actionsKey=key;actions.length=0;const container=el('#action-buttons');container.replaceChildren();
        const add=(name:string,icon:string,description:string,run:()=>void,cost?:Cost,train=false,entity?:Entity)=>{const button=document.createElement('button');button.className='action-button';button.innerHTML=`<span class="action-icon">${icon}</span><strong>${escape(name)}</strong>${cost?`<small>${costText(cost)}</small>`:''}`;button.title=description;button.addEventListener('click',run);container.append(button);actions.push({button,cost,train,entity});};
        if(own.some(e=>e.kind==='unit'&&e.role==='worker'))for(const role of ['hq','depot','barracks','tower'] as BuildingRole[]){const d=definition.buildings[role];add(d.name,icons[role],`${d.description} • ${costText(d.cost)}`,()=>callbacks?.build(role),d.cost);}
        const producer=own.find(e=>e.kind==='building'&&(e.role==='hq'||e.role==='barracks'));
        if(producer)for(const role of (producer.role==='hq'?['worker']:['melee','ranged','special']) as UnitRole[]){const d=definition.units[role];add(d.name,icons[role],`${d.description} • ${d.trainTime}s • ${costText(d.cost)}`,()=>callbacks?.train(role),d.cost,true,producer);}
        if(own.some(e=>e.kind==='unit')){add('Halt','■','Stop current orders; units may pursue nearby enemies (X)',()=>callbacks?.stop());add('Hold position','▣','Attack enemies in weapon range without pursuing (H)',()=>callbacks?.hold());if(casters.length){add(abilityName,'✧',abilityIds.map(id=>`${ABILITIES[id].name}: ${ABILITIES[id].description} (${ABILITIES[id].cooldown}s cooldown)`).join(' • ')+' • Q',()=>callbacks?.ability());actions[actions.length-1].ability=true;}}
        setText('#command-hint',own.length?'YOUR ORDERS':'SELECT A UNIT');
      }
      const reserved=s.entities.filter(e=>e.side===0&&e.hp>0).reduce((sum,e)=>sum+e.queue.length,0);
      for(const action of actions){const insufficient=action.cost&&(player.wood<action.cost.wood||player.ore<action.cost.ore);action.button.disabled=!!insufficient||!!(action.train&&(player.population+reserved>=player.cap||action.entity!.progress<1||action.entity!.queue.length>=5))||paused||s.winner!==null;
        if(action.ability){const remaining=Math.max(0,Math.ceil(Math.min(...casters.map(e=>(e.abilityReadyAt??0)-s.time))));action.button.disabled ||= remaining>0;action.button.querySelector('strong')!.textContent=remaining>0?`${abilityName} · ${remaining}s`:`${abilityName} [Q]`;}
      }
      const producer=own.find(e=>e.queue.length>0);const queue=el('#production-queue');
      if(producer){queue.innerHTML=`<span class="queue-label">RECRUITING</span> ${producer.queue.map((role,i)=>`<span class="queue-item">${escape(definition.units[role].name)}${i===0?` <b>${Math.floor(producer.trainProgress*100)}%</b>`:''}</span>`).join('')}`;}else queue.textContent='';
      overlay.hidden=!paused&&s.winner===null;
      if(!overlay.hidden){const ended=s.winner!==null;setText('#overlay-title',ended?s.winner===0?'Victory':'Defeat':'Battle paused');setText('#overlay-eyebrow',ended?'THE BATTLE IS OVER':'SKIRMISH');setText('#overlay-description',ended?s.winner===0?'The enemy stronghold has fallen. The Elderwood is yours.':'Your stronghold has fallen. Raise your banner and try again.':'Take a moment to plan your next move.');el('#resume-button').hidden=ended;}
      setText('#pause-button',paused?'Resume':'Pause');drawMinimap(s);
    }
  };
}
