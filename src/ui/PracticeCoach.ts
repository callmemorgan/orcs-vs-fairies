import { coachAdvice, createCoachMemory, dismissCoachAdvice } from '../core/coach';
import type { CoachAdvice, CoachMemory, CoachObservation, CoachTopic } from '../core/coach';
import type { Vec } from '../core/types';
import './practice-coach.css';

export const PRACTICE_COACH_STORAGE_KEY = 'orcs-vs-fairies/practice-coach/v1';
export interface CoachPreferences { version: 1; enabled: boolean; cooldownSeconds: 30 | 60 | 120 }
export interface PracticeCoachCallbacks { focus?: (entityIds: readonly number[], point?: Vec) => void }
const defaults = (): CoachPreferences => ({ version: 1, enabled: true, cooldownSeconds: 60 });
function preferences(value: unknown): CoachPreferences | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 3 || input.version !== 1 || typeof input.enabled !== 'boolean' || ![30, 60, 120].includes(input.cooldownSeconds as number)) return null;
  return { version: 1, enabled: input.enabled, cooldownSeconds: input.cooldownSeconds as CoachPreferences['cooldownSeconds'] };
}
function browserStorage(): Storage | null { try { return window.localStorage; } catch { return null; } }
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) => {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
};

/** The host supplies a filtered player observation. The coach never reads a GameState. */
export function mountPracticeCoach(root: HTMLElement, callbacks: PracticeCoachCallbacks = {}, storage: Storage | null = browserStorage()) {
  let view: CoachObservation | null = null, memory: CoachMemory | null = null, settings = defaults(), disposed = false;
  let saveMessage = '';
  if (storage) { try { const saved = storage.getItem(PRACTICE_COACH_STORAGE_KEY); if (saved) settings = preferences(JSON.parse(saved)) ?? defaults(); } catch { saveMessage = 'Coach preferences could not be read. Default settings are active.'; } }
  const host = element('aside', undefined, 'practice-coach'); host.dataset.practiceCoach = ''; host.setAttribute('aria-label', 'Practice coach'); host.hidden = true;
  const header = element('header'); header.append(element('h3', 'Practice coach'));
  const enable = element('input'); enable.type = 'checkbox'; enable.checked = settings.enabled; enable.setAttribute('aria-label', 'Enable practice coach');
  const enabledLabel = element('label', 'Enabled'); enabledLabel.prepend(enable); header.append(enabledLabel);
  const controls = element('details', undefined, 'practice-coach-settings'); controls.append(element('summary', 'Coach settings'));
  const cooldown = element('select'); cooldown.setAttribute('aria-label', 'Dismiss advice for');
  for (const seconds of [30, 60, 120]) { const option = element('option', `${seconds} seconds of match time`); option.value = String(seconds); cooldown.append(option); }
  cooldown.value = String(settings.cooldownSeconds); const cooldownLabel = element('label', 'Dismiss advice for'); cooldownLabel.append(cooldown); controls.append(cooldownLabel, element('p', 'Advice uses your visible information. Dismissal time stops while the match is paused.'));
  const notice = element('p', undefined, 'practice-coach-notice'); notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite'); notice.hidden = true;
  const empty = element('p', undefined, 'practice-coach-empty'); empty.setAttribute('aria-live', 'polite');
  const list = element('ol', undefined, 'practice-coach-list'); list.setAttribute('aria-label', 'Current practice advice');
  const cards = new Map<CoachTopic, { item: HTMLElement; title: HTMLElement; text: HTMLElement; show: HTMLButtonElement; dismiss: HTMLButtonElement; advice: CoachAdvice; remove(): void }>();
  const listeners: Array<() => void> = [];
  host.append(header, controls, notice, empty, list); root.append(host);
  function listen(target: HTMLElement, type: string, listener: EventListener) { target.addEventListener(type, listener); listeners.push(() => target.removeEventListener(type, listener)); }
  function message(text: string) { notice.textContent = text; notice.hidden = !text; }
  function save() {
    if (!storage) return;
    try { storage.setItem(PRACTICE_COACH_STORAGE_KEY, JSON.stringify(settings)); saveMessage = ''; message(''); }
    catch { saveMessage = 'This coach setting is active for this session. Browser storage could not save it.'; message(saveMessage); }
  }
  listen(enable, 'change', () => { if (disposed) return; settings = { ...settings, enabled: enable.checked }; save(); render(); });
  listen(cooldown, 'change', () => {
    if (disposed) return; const seconds = Number(cooldown.value);
    if (![30, 60, 120].includes(seconds)) { cooldown.value = String(settings.cooldownSeconds); return; }
    settings = { ...settings, cooldownSeconds: seconds as CoachPreferences['cooldownSeconds'] }; save();
  });
  const stop = (event: Event) => event.stopPropagation();
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel', 'keydown']) listen(host, type, stop);
  function makeCard(advice: CoachAdvice) {
    const item = element('li'); item.dataset.coachTopic = advice.id;
    const title = element('h4', advice.title), text = element('p', advice.message), actions = element('div', undefined, 'practice-coach-actions');
    const show = element('button', 'Show'), dismiss = element('button', 'Dismiss'); show.type = dismiss.type = 'button';
    show.disabled = !callbacks.focus; actions.append(show, dismiss); item.append(title, text, actions);
    const card = { item, title, text, show, dismiss, advice, remove: () => { show.removeEventListener('click', showAdvice); dismiss.removeEventListener('click', dismissAdvice); item.remove(); } };
    function showAdvice() {
      if (disposed || !view || !settings.enabled || !cards.has(card.advice.id)) return;
      const current = card.advice;
      try { callbacks.focus?.([...current.entityIds], current.point ? { ...current.point } : undefined); message(saveMessage); }
      catch { message('The highlighted units are no longer available. Advice will refresh with the next observation.'); }
    }
    function dismissAdvice() {
      if (disposed || !view || !memory || !settings.enabled || !cards.has(card.advice.id)) return;
      dismissCoachAdvice(memory, card.advice.id, view.time, settings.cooldownSeconds); render();
    }
    show.addEventListener('click', showAdvice); dismiss.addEventListener('click', dismissAdvice); return card;
  }
  function clearCards() { for (const card of cards.values()) card.remove(); cards.clear(); }
  function render() {
    if (disposed) return;
    message(saveMessage);
    const active = !!view && view.controller === 'human' && !view.result.finished && !view.eliminated[view.side];
    host.hidden = !active;
    if (!active) { clearCards(); return; }
    enable.checked = settings.enabled;
    if (!settings.enabled) { clearCards(); empty.hidden = false; empty.textContent = 'The practice coach is disabled. Enable it to see contextual advice.'; list.hidden = true; return; }
    if (!memory) memory = createCoachMemory(view!.side);
    const advice = coachAdvice(view!, memory), current = new Set(advice.map(item => item.id));
    for (const [id, card] of cards) if (!current.has(id)) { if (card.item.contains(document.activeElement)) enable.focus(); card.remove(); cards.delete(id); }
    for (const item of advice) {
      let card = cards.get(item.id); if (!card) { card = makeCard(item); cards.set(item.id, card); }
      card.advice = { ...item, entityIds: [...item.entityIds], ...(item.point ? { point: { ...item.point } } : {}) };
      card.title.textContent = item.title; card.text.textContent = item.message;
      card.show.setAttribute('aria-label', `Show ${item.title}`); card.dismiss.setAttribute('aria-label', `Dismiss ${item.title}`);
      if (list.children[advice.indexOf(item)] !== card.item) list.insertBefore(card.item, list.children[advice.indexOf(item)] ?? null);
    }
    empty.hidden = !!advice.length; empty.textContent = 'No current coaching reminders. Keep gathering, scouting and managing your army.'; list.hidden = !advice.length;
  }
  return {
    update(observation: CoachObservation | null) {
      if (disposed) return;
      if (!observation) { view = null; memory = null; render(); return; }
      if (!view || view.side !== observation.side || view.map.seed !== observation.map.seed || view.map.width !== observation.map.width || observation.time < view.time) memory = createCoachMemory(observation.side);
      view = observation; render();
    },
    getPreferences(): CoachPreferences { return { ...settings }; },
    dispose() { if (disposed) return; disposed = true; for (const remove of listeners.splice(0)) remove(); clearCards(); host.remove(); view = null; memory = null; },
  };
}
