// @vitest-environment happy-dom
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchRecorder } from '../src/core/replays';
import { createMatch, stepGame } from '../src/core/simulation';
import { SAVE_VERSION } from '../src/core/saves';
import { tournamentContentText, tournamentMatchConfig, tournamentProgress, tournamentSha256, tournamentStateText } from '../src/tournament/report';
import type { AgentRunStats, TournamentChoice, TournamentConfig, TournamentDashboardSource, TournamentMatchStatus, TournamentProgress, TournamentReport } from '../src/tournament/types';
import { mountTournamentDashboard, TOURNAMENT_IMPORT_MAX_BYTES } from '../src/ui/TournamentDashboard';

type Dashboard = ReturnType<typeof mountTournamentDashboard>;
type Options = Parameters<typeof mountTournamentDashboard>[1];
const mounted: Dashboard[] = [];
beforeEach(() => { vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { for (const dashboard of mounted.splice(0)) dashboard.dispose(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
function button(root: ParentNode, label: string | RegExp): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(element => { const text = element.getAttribute('aria-label') ?? element.textContent ?? ''; return typeof label === 'string' ? text === label : label.test(text); });
  expect(found, `Missing button ${String(label)}`).toBeDefined(); return found!;
}
function setup(source?: TournamentDashboardSource, extra: Partial<Options> = {}) {
  const root = document.createElement('div'); document.body.append(root);
  const options = { onReplay: vi.fn<Options['onReplay']>(() => undefined), onVisibility: vi.fn<NonNullable<Options['onVisibility']>>(), download: vi.fn<NonNullable<Options['download']>>(() => true), source, ...extra };
  const dashboard = mountTournamentDashboard(root, options); mounted.push(dashboard); return { root, options, dashboard };
}
function open(root: ParentNode) { button(root, 'Tournaments').click(); return root.querySelector<HTMLElement>('[role="dialog"]')!; }
function notice(root: ParentNode) { return root.querySelector<HTMLElement>('.tournament-notice')!; }
function selectFile(root: ParentNode, file: { size: number; text: () => Promise<string> }) { const input = root.querySelector<HTMLInputElement>('[aria-label="Tournament report JSON"]')!; Object.defineProperty(input, 'files', { configurable: true, value: [file] }); return input; }
const fixtureConfig: TournamentConfig = {
  version: 1, id: 'short-idle', name: 'Short idle tournament', seeds: [4127], mapSize: 'small', bothSeats: false,
  maxSeconds: 1, decisionTicks: 20, responseTimeoutMs: 100, maxCommandsPerTurn: 1,
  agents: [{ id: 'orc', name: 'Orc bot', faction: 'orcs', command: ['node', 'orc.js'] }, { id: 'fairy', name: 'Fairy bot', faction: 'fairies', command: ['node', 'fairy.js'] }],
};
const choice: TournamentChoice = { id: fixtureConfig.id, name: fixtureConfig.name, agents: fixtureConfig.agents, seeds: fixtureConfig.seeds, mapSize: fixtureConfig.mapSize, bothSeats: fixtureConfig.bothSeats, maxSeconds: fixtureConfig.maxSeconds };
function stats(agentId: string, fault: string | null = null): AgentRunStats { return { agentId, pid: null, turns: 0, accepted: 0, rejected: 0, fault, stderr: '', stderrTruncated: false, exitCode: null, exitSignal: null }; }
/** Real archives and SHA-256 pins exercise the same verification used by imported and server reports. */
async function makeReport(status: Exclude<TournamentMatchStatus, 'battle'> = 'limit', id = 'run-proof'): Promise<TournamentReport> {
  const config = structuredClone(fixtureConfig), seats: [string, string] = ['orc', 'fairy'], matchConfig = tournamentMatchConfig(config, seats, 4127);
  const state = createMatch(matchConfig), recorder = new MatchRecorder(state), initial = await tournamentSha256(tournamentStateText(state));
  if (status === 'limit') for (let tick = 0; tick < 20; tick++) stepGame(state, .05);
  const final = await tournamentSha256(tournamentStateText(state)), replay = recorder.export(); recorder.dispose();
  const sources = [{ path: 'src/core/simulation.ts', sha256: 'a'.repeat(64) }];
  return {
    format: 'orcs-vs-fairies/tournament', version: 1, id, createdAt: '2026-10-01T00:00:00.000Z', finishedAt: '2026-10-01T00:00:01.000Z', status: status === 'aborted' ? 'canceled' : 'complete', error: null, config,
    provenance: { contentSha256: await tournamentSha256(tournamentContentText()), engineSha256: await tournamentSha256(JSON.stringify(sources)), sources, agents: config.agents.map(agent => ({ agentId: agent.id, command: agent.command, files: [{ path: agent.command[1], sha256: 'b'.repeat(64) }] })), node: 'v22.0.0', platform: 'linux', architecture: 'x64', saveVersion: SAVE_VERSION },
    matches: [{ id: 'match-001', index: 0, seed: 4127, seats, config: matchConfig, status, winnerAgentId: status === 'forfeit' ? 'fairy' : null, finalTick: state.tick, seconds: state.time, elapsedMs: 1,
      agents: [stats('orc', status === 'forfeit' || status === 'double-forfeit' ? 'Agent response timed out after 100 ms.' : null), stats('fairy', status === 'double-forfeit' ? 'Agent exited before replying.' : null)], finalStateSha256: final, transcriptSha256: await tournamentSha256('[]'), decisions: [], checkpoints: state.tick ? [{ tick: 0, stateSha256: initial }, { tick: state.tick, stateSha256: final }] : [{ tick: 0, stateSha256: final }], replay }],
  };
}
function liveProgress(id = 'run-proof', patch: Partial<TournamentProgress> = {}): TournamentProgress { return { id, status: 'running', totalMatches: 1, completedMatches: 0, current: { matchId: 'match-001', seats: ['orc', 'fairy'], tick: 3, seconds: .15 }, standings: [{ agentId: 'fairy', name: 'Fairy bot', played: 1, wins: 1, losses: 0, draws: 0, forfeits: 0, incomplete: 0, points: 3 }], error: null, ...patch }; }
function makeSource() { return { choices: vi.fn<TournamentDashboardSource['choices']>(async () => [choice]), start: vi.fn<TournamentDashboardSource['start']>(async () => ({ id: 'run-proof' })), status: vi.fn<TournamentDashboardSource['status']>(async () => liveProgress()), result: vi.fn<TournamentDashboardSource['result']>(), cancel: vi.fn<TournamentDashboardSource['cancel']>(async () => undefined) }; }
async function flush() { for (let index = 0; index < 10; index++) await Promise.resolve(); }

describe('verified tournament imports', () => {
  it('imports a real replay without a server, renders its pins and standings, and inspects the selected archive', async () => {
    const report = await makeReport('forfeit'), { root, dashboard, options } = setup(); open(root);
    await dashboard.loadReport(JSON.stringify(report));
    expect(root.querySelector<HTMLElement>('[aria-label="Run a tournament"]')!.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('[aria-label="Verified tournament report"]')!.hidden).toBe(false);
    for (const text of ['Short idle tournament', 'Fairy bot won by forfeit', 'Orc bot (Player 1): Agent response timed out after 100 ms.', report.provenance.contentSha256, report.provenance.engineSha256, 'src/core/simulation.ts', 'orc.js', 'Decision interval']) expect(root.textContent).toContain(text);
    const winner = root.querySelector<HTMLTableRowElement>('[aria-label="Verified tournament report"] tbody tr')!;
    expect(winner.textContent).toContain('Fairy bot (fairy)'); expect(winner.cells[1].textContent).toBe('3');
    button(root, 'Download report').click(); await vi.waitFor(() => expect(options.download).toHaveBeenCalledWith('orcs-vs-fairies-tournament-run-proof.json', report));
    button(root, /Inspect replay for match 1/).click(); await vi.waitFor(() => expect(options.onReplay).toHaveBeenCalledWith(report.matches[0].replay, report.matches[0], report));
    expect(root.querySelector<HTMLElement>('.tournament-overlay')!.hidden).toBe(true); expect(options.onVisibility).toHaveBeenLastCalledWith(false);
  });

  it('keeps a prior verified report when replay simulation or a provenance pin fails', async () => {
    const report = await makeReport(), { root, dashboard, options } = setup(); open(root); await dashboard.loadReport(report);
    const divergent = structuredClone(report); divergent.id = 'bad-state'; divergent.matches[0].replay.finalChecksum = '00000000';
    await expect(dashboard.loadReport(divergent)).rejects.toThrow('diverged');
    expect(notice(root).textContent).toContain('previous verified report has been kept'); expect(root.querySelector('[aria-label="Verified tournament report"]')!.textContent).toContain('run-proof');
    const badPin = structuredClone(report); badPin.provenance.contentSha256 = '0'.repeat(64); await expect(dashboard.loadReport(badPin)).rejects.toThrow('content version');
    button(root, /Inspect replay for match 1/).click(); await vi.waitFor(() => expect(options.onReplay).toHaveBeenCalledWith(report.matches[0].replay, report.matches[0], report));
  });

  it.each([['limit', 'Time limit reached · Incomplete'], ['double-forfeit', 'Both agents forfeited'], ['aborted', 'Match aborted · No result']] as const)('renders %s as its own outcome', async (status, text) => {
    const report = await makeReport(status), { root, dashboard } = setup(); await dashboard.loadReport(report);
    expect(root.querySelector('[data-match-status]')!.getAttribute('data-match-status')).toBe(status); expect(root.querySelector('.tournament-outcome')!.textContent).toBe(text);
  });

  it('does not interpret agent names, faults, or stderr as HTML and handles replay and download failures', async () => {
    const report = await makeReport('forfeit'), markup = '<img src=x onerror=alert(1)>'; report.config.agents[0].name = markup; Object.assign(report.matches[0].agents[0], { fault: markup, stderr: markup, stderrTruncated: true, exitCode: 2 });
    const { root, dashboard } = setup(undefined, { onReplay: vi.fn(async () => { throw new Error('Replay viewer unavailable'); }), download: vi.fn(async () => false) }); open(root); await dashboard.loadReport(report);
    expect(root.textContent).toContain(markup); expect(root.querySelector('img')).toBeNull(); expect(root.querySelector('pre')!.textContent).toContain('[Output truncated]');
    button(root, /Inspect replay for match 1/).click(); await vi.waitFor(() => expect(notice(root).textContent).toContain('Replay viewer unavailable')); expect(root.querySelector<HTMLElement>('.tournament-overlay')!.hidden).toBe(false);
    button(root, 'Download report').click(); await vi.waitFor(() => expect(notice(root).textContent).toContain('download could not be started'));
  });

  it('rejects missing, oversized, unreadable, and malformed files and prevents duplicate file reads', async () => {
    const { root } = setup(); open(root); button(root, 'Import report').click(); expect(notice(root).textContent).toContain('Choose a tournament report');
    const tooBig = { size: TOURNAMENT_IMPORT_MAX_BYTES + 1, text: vi.fn(async () => '{}') }; selectFile(root, tooBig); button(root, 'Import report').click(); expect(tooBig.text).not.toHaveBeenCalled(); expect(notice(root).textContent).toContain('64 MiB');
    const pending = deferred<string>(), text = vi.fn(() => pending.promise); selectFile(root, { size: 2, text }); button(root, 'Import report').click(); button(root, 'Import report').click(); expect(text).toHaveBeenCalledOnce(); expect(button(root, 'Import report').disabled).toBe(true);
    pending.reject(new Error('Unreadable file')); await vi.waitFor(() => expect(notice(root).textContent).toContain('Unreadable file')); expect(button(root, 'Import report').disabled).toBe(false);
    selectFile(root, { size: 2, text: async () => '[]' }); button(root, 'Import report').click(); await vi.waitFor(() => expect(notice(root).textContent).toContain('Invalid tournament report'));
  });

  it('ignores a stale file read after a newer programmatic import', async () => {
    const stale = await makeReport('forfeit', 'stale-report'), newer = await makeReport('limit', 'new-report'), { root, dashboard } = setup(); open(root);
    const pending = deferred<string>(); selectFile(root, { size: 2, text: () => pending.promise }); button(root, 'Import report').click(); await dashboard.loadReport(newer); pending.resolve(JSON.stringify(stale)); await flush();
    expect(root.querySelector('[aria-label="Verified tournament report"]')!.textContent).toContain('new-report'); expect(root.querySelector('[aria-label="Verified tournament report"]')!.textContent).not.toContain('stale-report');
  });
});

describe('server tournament runs', () => {
  it('starts only the selected registered configuration once and renders real live progress without replacing controls', async () => {
    vi.useFakeTimers(); const source = makeSource(), started = deferred<{ id: string }>(), firstStatus = deferred<TournamentProgress>(); source.start.mockReturnValue(started.promise); source.status.mockReturnValueOnce(firstStatus.promise);
    const { root } = setup(source); open(root); await flush(); const config = root.querySelector<HTMLSelectElement>('[aria-label="Tournament configuration"]')!, start = button(root, 'Start tournament');
    expect(config.value).toBe(choice.id); start.click(); start.click(); expect(source.start).toHaveBeenCalledExactlyOnceWith(choice.id); config.value = 'changed-after-submit';
    started.resolve({ id: 'run-proof' }); await flush(); expect(source.status).toHaveBeenCalledExactlyOnceWith('run-proof'); await vi.advanceTimersByTimeAsync(5000); expect(source.status).toHaveBeenCalledOnce();
    firstStatus.resolve(liveProgress()); await flush(); expect(root.querySelector('[aria-label="Current matchup"]')!.textContent).toContain('Orc bot vs Fairy bot · Tick 3'); expect(root.querySelector('[aria-label="Live tournament"] tbody')!.textContent).toContain('Fairy bot (fairy)3');
    expect(root.querySelector('[aria-label="Tournament configuration"]')).toBe(config); expect(button(root, 'Start tournament')).toBe(start); const bar = root.querySelector<HTMLProgressElement>('progress')!; expect(bar.value).toBe(0); expect(bar.max).toBe(1);
    await vi.advanceTimersByTimeAsync(999); expect(source.status).toHaveBeenCalledOnce(); await vi.advanceTimersByTimeAsync(1); expect(source.status).toHaveBeenCalledTimes(2);
    button(root, 'Close tournament dashboard').click(); await vi.advanceTimersByTimeAsync(5000); expect(source.status).toHaveBeenCalledTimes(2); open(root); await flush(); expect(source.status).toHaveBeenCalledTimes(3);
  });

  it('cancels through the source and waits for a verified final report before enabling another run', async () => {
    const final = await makeReport('aborted'), source = makeSource(); source.result.mockResolvedValue(final); const { root } = setup(source); open(root); await vi.waitFor(() => expect(button(root, 'Start tournament').disabled).toBe(false));
    button(root, 'Start tournament').click(); await vi.waitFor(() => expect(button(root, 'Stop tournament').disabled).toBe(false)); source.status.mockResolvedValue(tournamentProgress(final)); button(root, 'Stop tournament').click();
    await vi.waitFor(() => expect(source.cancel).toHaveBeenCalledExactlyOnceWith('run-proof')); await vi.waitFor(() => expect(root.querySelector<HTMLElement>('[aria-label="Verified tournament report"]')!.hidden).toBe(false));
    expect(root.querySelector('[aria-label="Verified tournament report"]')!.textContent).toContain('canceled'); expect(button(root, 'Start tournament').disabled).toBe(false); expect(source.result).toHaveBeenCalledExactlyOnceWith('run-proof');
  });

  it('handles choices, start, status, cancel, and final-report errors with retryable controls', async () => {
    vi.useFakeTimers(); const source = makeSource(); source.choices.mockRejectedValueOnce(new Error('Config service unavailable')); const { root } = setup(source); open(root); await flush(); expect(notice(root).textContent).toContain('Config service unavailable');
    button(root, 'Refresh configurations').click(); await flush(); source.start.mockRejectedValueOnce(new Error('Runner unavailable')); button(root, 'Start tournament').click(); await flush(); expect(notice(root).textContent).toContain('Runner unavailable'); expect(button(root, 'Start tournament').disabled).toBe(false);
    source.status.mockRejectedValueOnce(new Error('Status unavailable')); button(root, 'Start tournament').click(); await flush(); expect(notice(root).textContent).toContain('Status unavailable'); expect(button(root, 'Stop tournament').disabled).toBe(false);
    source.cancel.mockRejectedValueOnce(new Error('Cancel unavailable')); button(root, 'Stop tournament').click(); await flush(); expect(notice(root).textContent).toContain('Cancel unavailable'); expect(button(root, 'Stop tournament').disabled).toBe(false);
    source.status.mockResolvedValue(liveProgress('run-proof', { status: 'failed', error: 'Agent could not spawn', current: null })); source.result.mockRejectedValue(new Error('Report unavailable')); await vi.advanceTimersByTimeAsync(1000); expect(notice(root).textContent).toContain('Report unavailable'); expect(source.result).toHaveBeenCalledOnce(); await vi.advanceTimersByTimeAsync(1000); expect(source.result).toHaveBeenCalledTimes(2);
  });

  it('keeps a run started while closed and ignores late status responses after disposal', async () => {
    vi.useFakeTimers(); const source = makeSource(), started = deferred<{ id: string }>(), pending = deferred<TournamentProgress>(); source.start.mockReturnValue(started.promise); source.status.mockReturnValue(pending.promise); const { root, dashboard, options } = setup(source); open(root); await flush(); button(root, 'Start tournament').click(); button(root, 'Close tournament dashboard').click(); started.resolve({ id: 'run-proof' }); await flush(); expect(source.status).not.toHaveBeenCalled();
    open(root); await flush(); expect(source.status).toHaveBeenCalledExactlyOnceWith('run-proof'); dashboard.dispose(); pending.resolve(liveProgress('run-proof', { status: 'complete' })); await flush(); await vi.advanceTimersByTimeAsync(5000); expect(source.result).not.toHaveBeenCalled(); expect(root.children).toHaveLength(0); expect(options.onVisibility).toHaveBeenLastCalledWith(false);
  });
});

describe('tournament modal lifecycle', () => {
  it('traps focus, restores the launcher on Escape, and isolates keyboard and pointer input from the battlefield', () => {
    const { root, options, dashboard } = setup(), launch = button(root, 'Tournaments'); launch.focus(); const dialog = open(root), close = button(root, 'Close tournament dashboard'), file = root.querySelector<HTMLInputElement>('[aria-label="Tournament report JSON"]')!, last = button(root, 'Import report');
    expect(document.activeElement).toBe(close); expect(options.onVisibility).toHaveBeenCalledWith(true); expect(launch.getAttribute('aria-expanded')).toBe('true');
    const gameKey = vi.fn(), gamePointer = vi.fn(); root.addEventListener('keydown', gameKey); root.addEventListener('pointerdown', gamePointer); file.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })); dialog.dispatchEvent(new Event('pointerdown', { bubbles: true })); expect(gameKey).not.toHaveBeenCalled(); expect(gamePointer).not.toHaveBeenCalled();
    last.focus(); last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); expect(document.activeElement).toBe(close); close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })); expect(document.activeElement).toBe(last);
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); expect(document.activeElement).toBe(launch); expect(options.onVisibility).toHaveBeenLastCalledWith(false); expect(root.querySelector<HTMLElement>('.tournament-overlay')!.hidden).toBe(true);
    launch.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true })); expect(gameKey).toHaveBeenCalledOnce(); launch.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); expect(gameKey).toHaveBeenCalledOnce();
    dashboard.update({ blocked: true }); expect(launch.disabled).toBe(true); dashboard.update(); expect(launch.disabled).toBe(false); open(root); dashboard.dispose(); const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); document.dispatchEvent(escape); expect(escape.defaultPrevented).toBe(false); dashboard.update(); expect(root.children).toHaveLength(0);
  });
});
