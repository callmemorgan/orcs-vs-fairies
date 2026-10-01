import type { ContentBundle } from '../core/content-registry';
import { levelOf, sameLevel } from '../core/world-map';
import type { Command, FactionId, GameState, Side } from '../core/types';
import { PlayerView } from '../core/observation';
import { legalDraftChoices, type DraftState } from '../core/match-rules';
import { definitionName, MATCH_MODE_NAMES, type MatchRulesValue } from './MatchRules';
import './objective-panel.css';

export type DraftView = DraftState;
export type ObjectiveCommand = Command | { type: 'collectRelic'; id: number; relicId: number } | { type: 'dropRelic'; id: number } | { type: 'draftChoice'; definitionId: string };
export interface ObjectiveView {
  players?: Array<{ faction: FactionId }>; allies?: Array<{ side: Side; faction: FactionId }>; opponents?: Array<{ side: Side; faction: FactionId }>; player?: { faction: FactionId };
  draftChoices?:string[];draftDefinitions?:Array<{id:string;name:string}>;
  tick: number; side?: Side; teamId?: Side; rules?: MatchRulesValue; draft?: DraftView;
  objectives?: {
    hill: { x: number; y: number; level?:number; ownerTeam: Side | null; captureTeam: Side | null; captureTicks: number; holdTicks: number; contested: boolean };
    relics: Array<{ id: number; x: number | null; y: number | null; level?:number; carrierId: number | null; heldTeam: Side | null }>;
    relicHoldTicks: number[];
    survival: { wave: number; nextWaveTick: number; spawnedIds: number[]; phase: 'waiting' | 'fighting' | 'recovery' | 'complete' };
  };
  entities: Array<{ id: number; side: Side; kind: string; role: string; x: number; y: number; level?:number; hp: number; illusion?: boolean }>;
  result?: { finished: boolean; outcome?: string|null }; winner?: Side | null; draw?: boolean; teams?: Side[];
}
interface DraftPanelOptions {
  getDraft: () => DraftView | null | undefined; side: () => Side | undefined;
  content?:()=>ContentBundle|undefined;choices?:()=>string[]|undefined;name?:(id:string)=>string;
  revision?: () => number | undefined; players: () => Array<{ id: Side; factionId: FactionId }>; canSubmit?: () => boolean; submit: (definitionId: string) => unknown | Promise<unknown>;
}
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) => {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
};
const seconds = (ticks: number) => `${Math.ceil(Math.max(0, ticks) / 20)}s`;
const teamName = (side: Side | null) => side === null ? 'Unclaimed' : `Team ${side + 1}`;

/** Displays received draft state; clicking always submits against the current server revision. */
export function mountDraftPanel(root: HTMLElement, options: DraftPanelOptions) {
  const host = element('section', undefined, 'match-draft-panel'); host.setAttribute('aria-label', 'Army draft');
  const heading = element('h3', 'Army draft'), status = element('p', undefined, 'match-draft-status'), revision = element('p', undefined, 'match-draft-revision');
  status.setAttribute('role', 'status');
  const name=(id:string)=>options.name?.(id)??definitionName(id,options.content?.());
  const bans = element('p'), picks = element('div', undefined, 'match-draft-picks'), choices = element('div', undefined, 'match-draft-choices'), message = element('p', undefined, 'match-draft-message');
  message.setAttribute('role', 'status'); host.append(heading, status, revision, bans, picks, choices, message); root.append(host);
  let disposed = false, pending = false, key = '';
  function update() {
    if (disposed) return;
    const draft = options.getDraft(); host.hidden = !draft; if (!draft) return;
    const turn = draft.order[draft.turn], own = turn?.side === options.side() && (options.canSubmit?.() ?? true), remaining = seconds(draft.remainingTicks);
    status.textContent = draft.status === 'complete' ? 'Draft complete. The chosen armies are ready.' : `Player ${(turn?.side ?? 0) + 1} ${turn?.action === 'ban' ? 'bans' : 'picks'} · ${remaining} remaining${own ? ' · Your turn' : ''}`;
    const number = options.revision?.(); revision.hidden = number === undefined; revision.textContent = number === undefined ? '' : `Server revision ${number}`;
    bans.textContent = `Banned: ${draft.banned.length ? draft.banned.map(name).join(', ') : 'None'}`;
    const nextKey = JSON.stringify({ status: draft.status, turn: draft.turn, pool: draft.pool, banned: draft.banned, picks: draft.picks, own, pending,definitions:draft.pool.map(name),choices:options.choices?.() });
    if (key === nextKey) { for (const button of Array.from(choices.querySelectorAll<HTMLButtonElement>('button'))) button.disabled = !own || pending; return; } key = nextKey; picks.replaceChildren();
    draft.picks.forEach((ids, side) => picks.append(element('p', `Player ${side + 1} picks: ${ids.length ? ids.map(name).join(', ') : 'None yet'}`)));
    choices.replaceChildren(); if (draft.status === 'complete') return;
    const available = turn && options.players()[turn.side] ? options.choices?.()??legalDraftChoices(draft, options.players(), turn.side,options.content?.()) : [];
    for (const id of available) {
      const button = element('button', name(id)); button.type = 'button'; button.dataset.draftChoice = id;
      button.setAttribute('aria-label', `${turn?.action === 'ban' ? 'Ban' : 'Pick'} ${name(id)}`); button.disabled = !own || pending;
      button.onclick = async () => {
        const current = options.getDraft(), currentTurn = current?.order[current.turn];
        if (disposed || pending || current?.status !== 'drafting' || currentTurn?.side !== options.side() || !(options.canSubmit?.() ?? true)) return;
        pending = true; message.textContent = 'Sending draft choice…'; update();
        try { const accepted = await options.submit(id); if (accepted === false) throw new Error('Draft choice was rejected. Wait for the current turn.'); if (!disposed) message.textContent = ''; }
        catch (error) { if (!disposed) message.textContent = error instanceof Error ? error.message : 'Could not submit the draft choice.'; }
        finally { pending = false; update(); }
      }; choices.append(button);
    }
  }
  update(); return { update, dispose() { if (disposed) return; disposed = true; host.remove(); } };
}
export interface ObjectivePanelOptions {
  getState: () => GameState | null | undefined;
  getObservation?: () => ObjectiveView | null | undefined;
  getContent?:()=>ContentBundle|undefined;
  side: Side | (() => Side);
  submit: (command: ObjectiveCommand) => unknown | Promise<unknown>;
  canSubmit?: () => boolean;
  toolbar?:HTMLElement;
}

/** Match progress and relic orders use only the player's latest observation when supplied. */
export function mountObjectivePanel(root: HTMLElement, options: ObjectivePanelOptions) {
  const host = element('section', undefined, 'objective-panel'); host.setAttribute('aria-label', 'Match objectives');
  const heading = element('h3'), status = element('p', undefined, 'objective-panel-status'), progress = element('progress'), details = element('div', undefined, 'objective-panel-details');
  const relics = element('div', undefined, 'objective-panel-relics'), message = element('p', undefined, 'objective-panel-message'); message.setAttribute('role', 'status');
  host.append(heading, status, progress, details, relics, message);
  const overlay=options.toolbar?element('div',undefined,'objective-overlay'):undefined;
  const launch=options.toolbar?element('button','Objectives'):undefined;
  let open=false,lastState:GameState|null|undefined,observed=false;
  function show(value:boolean){open=value;if(overlay)overlay.hidden=!open;launch?.setAttribute('aria-expanded',String(open));}
  const close=overlay?element('button','Close objectives'):undefined;
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&open)show(false);};
  if(overlay&&launch&&close){launch.type='button';launch.dataset.objectiveTool='progress';launch.setAttribute('aria-controls','match-objectives');launch.setAttribute('aria-expanded','false');host.id='match-objectives';close.type='button';close.className='objective-panel-close';close.onclick=()=>show(false);host.prepend(close);overlay.append(host);overlay.hidden=true;root.append(overlay);options.toolbar!.append(launch);launch.onclick=()=>show(!open);overlay.onclick=event=>{if(event.target===overlay)show(false);};document.addEventListener('keydown',escape);}else root.append(host);
  const side = () => typeof options.side === 'function' ? options.side() : options.side;
  const localViews = new Map<Side, PlayerView>();
  const view = (): ObjectiveView | null | undefined => { if (options.getObservation) return options.getObservation(); const state = options.getState(); if (!state) return null; const currentSide = side(); let observer = localViews.get(currentSide); if (!observer) { observer = new PlayerView(currentSide); localViews.set(currentSide, observer); } return observer.observe(state); };
  const roster = () => { const current = view(); if (!current) return []; if (current.players) return current.players.map((player, id) => ({ id: id as Side, factionId: player.faction })); return [...(current.player ? [{ side: current.side ?? side(), faction: current.player.faction }] : []), ...(current.allies ?? []), ...(current.opponents ?? [])].sort((a, b) => a.side - b.side).map(player => ({ id: player.side, factionId: player.faction })); };
  const draft = mountDraftPanel(host, { getDraft: () => view()?.rules?.draft.enabled ? view()?.draft : null, side, players: roster, content:options.getContent,choices:()=>view()?.draftChoices,name:id=>view()?.draftDefinitions?.find(definition=>definition.id===id)?.name??definitionName(id,options.getContent?.()),canSubmit: options.canSubmit, submit: definitionId => options.submit({ type: 'draftChoice', definitionId }) });
  let disposed = false, pending = false;
  const relicRows = new Map<number, { row: HTMLElement; label: HTMLElement; button: HTMLButtonElement }>();
  function allowed(current: ObjectiveView) { return !pending && !current.result?.finished && current.winner == null && !current.draw && (options.canSubmit?.() ?? true); }
  async function submit(command: ObjectiveCommand) {
    const current = view(); if (!current || !allowed(current) || disposed) return;
    if(command.type==='collectRelic'||command.type==='dropRelic'){
      const unit=current.entities.find(entity=>entity.id===command.id&&entity.side===side()&&entity.kind==='unit'&&entity.hp>0&&!entity.illusion),items=current.objectives?.relics??[];
      if(!unit)return;
      if(command.type==='dropRelic'){if(!items.some(relic=>relic.carrierId===unit.id))return;}
      else {const relic=items.find(item=>item.id===command.relicId);if(!relic||relic.carrierId!==null||relic.x===null||relic.y===null||items.some(item=>item.carrierId===unit.id)||!sameLevel(unit,{x:relic.x,y:relic.y,level:relic.level})||Math.hypot(unit.x-relic.x,unit.y-relic.y)>(current.rules?.relic.pickupRadius??0))return;}
    }
    pending = true; message.textContent = 'Sending relic order…'; update();
    try { const accepted = await options.submit(command); if (accepted === false) throw new Error('Relic order rejected. Move a living unit within pickup range.'); if (!disposed) message.textContent = command.type === 'dropRelic' ? 'Relic drop order sent.' : 'Relic collection order sent.'; }
    catch (error) { if (!disposed) message.textContent = error instanceof Error ? error.message : 'Could not issue the relic order.'; }
    finally { pending = false; update(); }
  }
  function update() {
    if (disposed) return;
    const current = view(), rules = current?.rules; host.hidden = !current || !rules;
    if(launch){launch.hidden=!current||!rules;const state=options.getState();if(state!==lastState||!observed&&current){lastState=state;observed=!!current;show(!!rules?.draft.enabled&&current?.draft?.status==='drafting');}if(!current){observed=false;show(false);}}
    if (!current || !rules) return;
    const objectives = current.objectives, mode = rules.mode, team = current.teamId ?? current.teams?.[side()] ?? side();
    heading.textContent = MATCH_MODE_NAMES[mode]; progress.hidden = true; details.replaceChildren(); relics.hidden = mode !== 'relic';
    if (mode === 'annihilation') status.textContent = 'Destroy the opposing teams’ headquarters to win.';
    if (mode === 'scenario') status.textContent = 'Complete the objectives shown by the active scenario.';
    if (mode === 'hill' && objectives) {
      const hill = objectives.hill; status.textContent = `${teamName(hill.ownerTeam)}${hill.contested ? ' · Contested' : hill.captureTeam !== null && hill.captureTeam !== hill.ownerTeam ? ` · ${teamName(hill.captureTeam)} capturing` : ' · Hold the hill'}`;
      progress.hidden = false; progress.max = rules.hill.holdTicks; progress.value = hill.holdTicks; progress.setAttribute('aria-label', 'Hill victory progress');
      details.append(element('p', `Hold: ${seconds(hill.holdTicks)} / ${seconds(rules.hill.holdTicks)} · Capture: ${seconds(hill.captureTicks)} / ${seconds(rules.hill.captureTicks)}`), element('p', `Hill at ${hill.x.toFixed(1)}, ${hill.y.toFixed(1)} · Radius ${rules.hill.radius}`));
    }
    if (mode === 'survival' && objectives) {
      const wave = objectives.survival; status.textContent = `Wave ${wave.wave} / ${rules.survival.waveCount} · ${wave.phase === 'complete' ? (current.result?.outcome === 'win' ? 'All waves cleared' : 'Survival ended') : wave.phase === 'fighting' ? 'Defeat the wave' : wave.phase === 'recovery' ? 'Recover and prepare' : 'Preparing first wave'}`;
      progress.hidden = false; progress.max = rules.survival.waveCount; progress.value = Math.max(0, wave.wave - (wave.phase === 'fighting' ? 1 : 0)); progress.setAttribute('aria-label', 'Survival waves cleared');
      details.append(element('p', `${teamName(rules.survival.defenderTeam)} defending${wave.phase === 'waiting' || wave.phase === 'recovery' ? ` · Next wave in ${seconds(wave.nextWaveTick - current.tick)}` : ''}`));
      const reward = rules.survival.rewardPerWave; details.append(element('p', `Each cleared wave: ${reward.wood} wood, ${reward.ore} ore, ${reward.crystal} crystal per defender`));
    }
    if (mode === 'relic' && objectives) {
      const held = objectives.relics.filter(relic => relic.heldTeam === team).length, ticks = objectives.relicHoldTicks[team] ?? 0;
      status.textContent = `${teamName(team)} holds ${held} / ${rules.relic.required} required relics · ${seconds(ticks)} / ${seconds(rules.relic.holdTicks)}`;
      progress.hidden = false; progress.max = rules.relic.holdTicks; progress.value = ticks; progress.setAttribute('aria-label', 'Relic victory progress');
      const own = current.entities.filter(entity => entity.side === side() && entity.kind === 'unit' && entity.hp > 0 && !entity.illusion);
      for (const [id, item] of relicRows) if (!objectives.relics.some(relic => relic.id === id)) { item.row.remove(); relicRows.delete(id); }
      for (const relic of objectives.relics) {
        let item = relicRows.get(relic.id);
        if (!item) { const row = element('div', undefined, 'objective-panel-relic'), label = element('span'), button = element('button'); row.dataset.relicId = String(relic.id); button.type = 'button'; row.append(label, button); relics.append(row); item = { row, label, button }; relicRows.set(relic.id, item); }
        const { label, button } = item;
        label.textContent = `Relic ${relic.id} · ${teamName(relic.heldTeam)}${relic.carrierId !== null ? ` · Carried by unit ${relic.carrierId}` : relic.x === null || relic.y === null ? ' · Location hidden' : ` · ${relic.x.toFixed(1)}, ${relic.y.toFixed(1)}${relic.level===undefined?'':` · Level ${relic.level+1}`}`}`;
        const carrier = own.find(entity => entity.id === relic.carrierId);
        const available = own.filter(entity => !objectives.relics.some(other => other.carrierId === entity.id));
        const nearest = relic.x === null || relic.y === null ? undefined : available.filter(entity=>sameLevel(entity,{x:relic.x!,y:relic.y!,level:relic.level})).map(entity => ({ entity, distance: Math.hypot(entity.x - relic.x!, entity.y - relic.y!) })).sort((a, b) => a.distance - b.distance)[0];
        button.textContent = carrier ? 'Drop relic' : 'Collect relic'; button.setAttribute('aria-label', `${carrier ? 'Drop' : 'Collect'} relic ${relic.id}`);
        button.disabled = !allowed(current) || !carrier && (relic.carrierId !== null || !nearest || nearest.distance > rules.relic.pickupRadius);
        button.title = carrier ? `Unit ${carrier.id} will drop this relic.` : nearest && nearest.distance <= rules.relic.pickupRadius ? `Unit ${nearest.entity.id} will collect this relic.` : `Move an owned unit within ${rules.relic.pickupRadius} tiles to collect it.`;
        button.onclick = () => { if (carrier) void submit({ type: 'dropRelic', id: carrier.id }); else if (nearest) void submit({ type: 'collectRelic', id: nearest.entity.id, relicId: relic.id }); };
      }
    }
    draft.update();
  }
  update(); return { update,close:()=>show(false), dispose() { if (disposed) return; disposed = true; draft.dispose(); host.remove();overlay?.remove();launch?.remove();document.removeEventListener('keydown',escape); } };
}
