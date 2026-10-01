import { SkirmishRoster } from '../../src/ui/SkirmishRoster';
import { mountObjectivePanel } from '../../src/ui/ObjectivePanel';
import { createMatch, issueCommand, stepGame } from '../../src/core/simulation';
import { PlayerView } from '../../src/core/observation';
import { mountOnlineLobby } from '../../src/ui/OnlineLobby';
import type { GameState, Side } from '../../src/core/types';

const app = document.querySelector<HTMLElement>('#app')!;
let state: GameState | null = null;
const roster = new SkirmishRoster(app);
const start = document.createElement('button'); start.textContent = 'Start configured match'; start.type = 'button'; app.append(start);
start.onclick = () => { state = createMatch({ map: { seed: 4127, size: 'small' }, players: roster.getPlayers('orcs', 'fairies'), rules: roster.getRules() }); objective.update(); };
const move = document.createElement('button'); move.textContent = 'Move a unit to the closest relic'; move.type = 'button'; app.append(move);
move.onclick = () => { if (!state) return; const unit = state.entities.find(entity => entity.side === 0 && entity.kind === 'unit' && entity.role !== 'worker'); const relic = unit ? [...state.objectives.relics].sort((a,b)=>Math.hypot(a.x-unit.x,a.y-unit.y)-Math.hypot(b.x-unit.x,b.y-unit.y))[0] : undefined; if (relic && unit) issueCommand(state, 0, { type: 'move', ids: [unit.id], x: relic.x, y: relic.y }); };
const observer = new PlayerView(0);
const objective = mountObjectivePanel(app, { getState: () => state, getObservation: () => state ? observer.observe(state) : null, side: 0, submit: command => state ? issueCommand(state, 0, command) : false });
const lobby = mountOnlineLobby(app, { onJoinMatch: () => undefined, pollIntervalMs: 50 });
setInterval(() => { if (state) { stepGame(state, .05); objective.update(); } }, 50);
Object.defineProperty(window, 'modesFixture', { get: () => ({ state, observation: state ? observer.observe(state) : null, lobby }) });
