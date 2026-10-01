import type { ReplayArchive } from '../core/replays';
import { tournamentStandings, verifyTournamentReport } from '../tournament/report';
import type { TournamentChoice, TournamentDashboardSource, TournamentMatch, TournamentProgress, TournamentReport, TournamentStanding } from '../tournament/types';
import './tournament-dashboard.css';

export type { TournamentDashboardSource } from '../tournament/types';
export interface TournamentDashboardOptions {
  source?: TournamentDashboardSource;
  onReplay: (archive: ReplayArchive, match: TournamentMatch, report: TournamentReport) => void | Promise<void>;
  onVisibility?: (open: boolean) => void;
  download?: (filename: string, report: TournamentReport) => void | boolean | Promise<void | boolean>;
}
export const TOURNAMENT_IMPORT_MAX_BYTES = 64 * 1024 * 1024;
const POLL_MS = 1000;
const create = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
function button(text: string, action: () => void): HTMLButtonElement {
  const element = create('button', text); element.type = 'button'; element.addEventListener('click', action); return element;
}
function field(text: string, input: HTMLElement): HTMLLabelElement {
  const label = create('label', text, 'tournament-field'); label.append(input); return label;
}
function errorText(error: unknown): string { return error instanceof Error ? error.message : typeof error === 'string' ? error : 'The tournament action failed. Try again.'; }
function time(seconds: number): string { return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`; }
function summary(rows: Array<[string, string]>): HTMLDListElement {
  const list = create('dl', undefined, 'tournament-summary');
  for (const [label, value] of rows) list.append(create('dt', label), create('dd', value));
  return list;
}
function standingsTable(label: string): { host: HTMLElement; body: HTMLTableSectionElement } {
  const host = create('div', undefined, 'tournament-table-scroll'), table = create('table'), head = create('thead'), row = create('tr'), body = create('tbody');
  table.append(create('caption', label));
  for (const text of ['Agent', 'Points', 'Played', 'Wins', 'Losses', 'Draws', 'Forfeits', 'Incomplete']) { const cell = create('th', text); cell.scope = 'col'; row.append(cell); }
  head.append(row); table.append(head, body); host.append(table); return { host, body };
}
function fillStandings(body: HTMLTableSectionElement, standings: TournamentStanding[]): void {
  body.replaceChildren();
  for (const standing of standings) {
    const row = create('tr'); row.dataset.agentId = standing.agentId;
    const name = create('th', `${standing.name} (${standing.agentId})`); name.scope = 'row'; row.append(name);
    for (const value of [standing.points, standing.played, standing.wins, standing.losses, standing.draws, standing.forfeits, standing.incomplete]) row.append(create('td', String(value)));
    body.append(row);
  }
  if (!standings.length) { const row = create('tr'), cell = create('td', 'No results yet.'); cell.colSpan = 8; row.append(cell); body.append(row); }
}

/** Mount once alongside the session toolbar. Reports become inspectable only after every replay passes verification. */
export function mountTournamentDashboard(root: HTMLElement, options: TournamentDashboardOptions) {
  let opened = false, disposed = false, blocked = false, previousFocus: HTMLElement | null = null;
  let report: TournamentReport | null = null, choices: TournamentChoice[] = [], choicesLoaded = false, choicesBusy = false;
  let activeRun: string | null = null, progress: TournamentProgress | null = null, startBusy = false, cancelBusy = false, replayBusy = false, downloadBusy = false;
  let verifyRequest = 0, verifying = false, pollBusy = false, pollTimer: ReturnType<typeof setTimeout> | null = null;
  const host = create('section', undefined, 'tournament-dashboard'); host.setAttribute('aria-label', 'Tournament dashboard');
  const toolbar = create('nav', undefined, 'tournament-toolbar'); toolbar.setAttribute('aria-label', 'Tournament tools');
  const launch = button('Tournaments', open); launch.dataset.tournamentTool = 'dashboard'; launch.setAttribute('aria-haspopup', 'dialog'); launch.setAttribute('aria-expanded', 'false'); toolbar.append(launch);
  const overlay = create('div', undefined, 'tournament-overlay'); overlay.hidden = true;
  const dialog = create('section', undefined, 'tournament-dialog'); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-label', 'Tournament dashboard'); dialog.tabIndex = -1;
  const header = create('header'), closeButton = button('Close', close); closeButton.setAttribute('aria-label', 'Close tournament dashboard'); header.append(create('h2', 'Tournaments'), closeButton);
  const notice = create('p', undefined, 'tournament-notice'); notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite'); notice.hidden = true;
  const page = create('div', undefined, 'tournament-page');
  const controls = create('section'); controls.setAttribute('aria-label', 'Run a tournament');
  const config = create('select'); config.setAttribute('aria-label', 'Tournament configuration');
  const choiceDetails = create('p', undefined, 'tournament-choice-details');
  const refreshChoices = button('Refresh configurations', () => { void loadChoices(); });
  const start = button('Start tournament', () => { void startTournament(); });
  const stop = button('Stop tournament', () => { void cancelTournament(); });
  controls.append(create('h3', 'Run a tournament'), create('p', 'Choose a server-registered configuration to run its agents, seeds, and seat order.'), field('Tournament configuration', config), choiceDetails, refreshChoices, start, stop);
  const imports = create('section'); imports.setAttribute('aria-label', 'Import a tournament report');
  const fileInput = create('input'); fileInput.type = 'file'; fileInput.accept = '.json,application/json'; fileInput.setAttribute('aria-label', 'Tournament report JSON');
  const importButton = button('Import report', () => { void importFile(); });
  const exportButton = button('Download report', () => { void exportReport(); });
  imports.append(create('h3', 'Tournament reports'), create('p', 'Import a JSON report to verify its replays, compare agents, and inspect individual matches.'), field('Tournament report JSON', fileInput), importButton, exportButton);
  if (!options.source) { controls.hidden = true; imports.append(create('p', 'A tournament server is not connected. You can import reports here.')); }
  const live = create('section', undefined, 'tournament-live'); live.hidden = true; live.setAttribute('aria-label', 'Live tournament');
  const liveStatus = create('p'); liveStatus.setAttribute('role', 'status'); liveStatus.setAttribute('aria-live', 'polite');
  const liveProgress = create('progress'); liveProgress.setAttribute('aria-label', 'Tournament match progress');
  const current = create('p'); current.setAttribute('aria-label', 'Current matchup');
  const liveStandings = standingsTable('Live standings'); live.append(create('h3', 'Live tournament'), liveStatus, liveProgress, current, liveStandings.host);
  const results = create('section'); results.setAttribute('aria-label', 'Verified tournament report'); results.hidden = true;
  const reportTitle = create('h3'), reportSummary = create('div'), verifiedStandings = standingsTable('Verified standings');
  const provenance = create('details'), provenanceLabel = create('summary', 'Configuration and provenance'); provenanceLabel.tabIndex = 0; const provenanceBody = create('div'); provenance.append(provenanceLabel, provenanceBody);
  const matchList = create('ol', undefined, 'tournament-matches'); matchList.setAttribute('aria-label', 'Tournament matches');
  results.append(reportTitle, reportSummary, verifiedStandings.host, provenance, create('h3', 'Matches'), matchList);
  page.append(controls, imports, live, results); dialog.append(header, notice, page); overlay.append(dialog); host.append(toolbar, overlay); root.append(host);

  function message(text: string, failed = false): void {
    if (disposed) return; notice.textContent = text; notice.hidden = !text; notice.classList.toggle('tournament-error', failed);
  }
  function refresh(): void {
    if (disposed) return;
    launch.disabled = blocked && !opened;
    config.disabled = choicesBusy || startBusy || !!activeRun;
    refreshChoices.disabled = choicesBusy || startBusy || !!activeRun;
    start.disabled = !options.source || choicesBusy || startBusy || !!activeRun || verifying || !choices.some(choice => choice.id === config.value);
    stop.disabled = !activeRun || cancelBusy || progress !== null && progress.status !== 'running';
    importButton.disabled = fileInput.disabled = verifying || startBusy || !!activeRun || replayBusy;
    exportButton.disabled = !report || downloadBusy;
    for (const replay of Array.from(matchList.querySelectorAll<HTMLButtonElement>('button'))) replay.disabled = replayBusy || verifying;
    dialog.setAttribute('aria-busy', String(verifying));
  }
  function renderChoice(): void {
    const choice = choices.find(item => item.id === config.value);
    choiceDetails.textContent = choice ? `${choice.agents.map(agent => `${agent.name} (${agent.faction})`).join(', ')} · Seeds ${choice.seeds.join(', ')} · ${choice.mapSize} map · ${choice.bothSeats ? 'Both seat orders' : 'One seat order'} · ${time(choice.maxSeconds)} limit` : 'No registered configurations are available.';
    refresh();
  }
  config.addEventListener('change', renderChoice);
  async function loadChoices(): Promise<void> {
    if (disposed || !options.source || choicesBusy || activeRun || startBusy) return;
    choicesBusy = true; refresh();
    try {
      const next = await options.source.choices(); if (disposed) return;
      const selected = config.value; choices = next; choicesLoaded = true; config.replaceChildren();
      if (!next.length) { const empty = create('option', 'No registered configurations'); empty.value = ''; config.append(empty); }
      for (const choice of next) { const option = create('option', choice.name); option.value = choice.id; config.append(option); }
      config.value = next.some(choice => choice.id === selected) ? selected : next[0]?.id ?? '';
      renderChoice();
    } catch (error) { message(`Could not load configurations: ${errorText(error)}`, true); }
    finally { choicesBusy = false; refresh(); }
  }
  function renderProgress(): void {
    if (!progress) return;
    live.hidden = false;
    const text = `${progress.status === 'running' ? 'Running' : progress.status === 'complete' ? 'Complete' : progress.status === 'canceled' ? 'Canceled' : 'Failed'} · ${progress.completedMatches} of ${progress.totalMatches} matches finished`;
    if (liveStatus.textContent !== text) liveStatus.textContent = text;
    liveProgress.max = Math.max(1, progress.totalMatches); liveProgress.value = progress.completedMatches;
    const agentNames = new Map(choices.flatMap(choice => choice.agents).map(agent => [agent.id, agent.name]));
    current.textContent = progress.current ? `${progress.current.seats.map(id => agentNames.get(id) ?? id).join(' vs ')} · Tick ${progress.current.tick} · ${time(progress.current.seconds)} · ${progress.current.matchId}` : progress.status === 'running' ? 'Waiting for the next matchup.' : 'No match is running.';
    fillStandings(liveStandings.body, progress.standings);
    if (progress.error) message(progress.error, true);
    refresh();
  }
  async function startTournament(): Promise<void> {
    if (disposed || !options.source || start.disabled) return;
    const choiceId = config.value; startBusy = true; refresh(); message('Starting tournament…');
    try {
      const started = await options.source.start(choiceId); if (disposed) return;
      if (!started.id) throw new Error('The tournament server returned no run ID.');
      activeRun = started.id; progress = null; message('Tournament started. Loading live results…');
      void poll();
    } catch (error) { message(`Could not start tournament: ${errorText(error)}`, true); }
    finally { startBusy = false; refresh(); }
  }
  function clearPoll(): void { if (pollTimer !== null) clearTimeout(pollTimer); pollTimer = null; }
  function schedulePoll(): void {
    clearPoll();
    if (!disposed && opened && activeRun) pollTimer = setTimeout(() => { pollTimer = null; void poll(); }, POLL_MS);
  }
  async function poll(): Promise<void> {
    if (disposed || !opened || !activeRun || !options.source || pollBusy) return;
    clearPoll(); pollBusy = true; const id = activeRun;
    try {
      const next = await options.source.status(id); if (disposed || activeRun !== id) return;
      if (next.id !== id) throw new Error('The server returned progress for a different tournament.');
      progress = next; renderProgress();
      if (next.status !== 'running') {
        const result = await options.source.result(id); if (disposed || activeRun !== id) return;
        if (result.id !== id) throw new Error('The server returned a report for a different tournament.');
        if (result.status === 'running') throw new Error('The final tournament report is not ready yet.');
        await loadReport(result);
        if (!disposed && activeRun === id) { activeRun = null; refresh(); }
      }
    } catch (error) { message(`Could not update tournament: ${errorText(error)}`, true); }
    finally { pollBusy = false; refresh(); schedulePoll(); }
  }
  async function cancelTournament(): Promise<void> {
    if (disposed || !options.source || !activeRun || stop.disabled) return;
    const id = activeRun; cancelBusy = true; refresh();
    try {
      await options.source.cancel(id); if (disposed || activeRun !== id) return;
      message('Stop requested. Waiting for the final report.');
      if (!pollBusy) void poll();
    } catch (error) { message(`Could not stop tournament: ${errorText(error)}`, true); }
    finally { cancelBusy = false; refresh(); }
  }
  async function loadReport(input: unknown): Promise<void> {
    if (disposed) return;
    return verifyInput(input, ++verifyRequest);
  }
  async function verifyInput(input: unknown, request: number): Promise<void> {
    if (disposed || request !== verifyRequest) return;
    verifying = true; refresh(); message('Verifying tournament report…');
    try {
      const verified = await verifyTournamentReport(input, (completed, total) => {
        if (request === verifyRequest && !disposed) message(`Verifying replays: ${completed} of ${total}`);
      });
      if (disposed || request !== verifyRequest) return;
      report = verified; renderReport(); message('Report verified. Every recorded replay passed verification.');
    } catch (error) {
      if (request === verifyRequest) message(`Could not import report: ${errorText(error)}${report ? ' The previous verified report has been kept.' : ''}`, true);
      throw error;
    } finally { if (request === verifyRequest) { verifying = false; refresh(); } }
  }
  async function importFile(): Promise<void> {
    if (disposed || importButton.disabled) return;
    const file = fileInput.files?.[0];
    if (!file) { message('Choose a tournament report JSON file first.', true); fileInput.focus(); return; }
    if (file.size > TOURNAMENT_IMPORT_MAX_BYTES) { message('The report is too large. Choose a file smaller than 64 MiB.', true); return; }
    // Set the busy state before reading so a second click cannot start another read.
    const request = ++verifyRequest; verifying = true; refresh(); message('Reading tournament report…');
    try { const text = await file.text(); if (disposed || request !== verifyRequest) return; await verifyInput(text, request); if (!disposed && request === verifyRequest) fileInput.value = ''; }
    catch (error) { if (!disposed && request === verifyRequest && verifying) message(`Could not read report: ${errorText(error)}`, true); }
    finally { if (!disposed && request === verifyRequest && verifying) { verifying = false; refresh(); } }
  }
  async function exportReport(): Promise<void> {
    if (disposed || !report || downloadBusy) return;
    const snapshot = report, filename = `orcs-vs-fairies-tournament-${snapshot.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`; downloadBusy = true; refresh();
    try {
      if (options.download) { if (await options.download(filename, snapshot) === false) throw new Error('The report download could not be started.'); }
      else {
        const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })), link = create('a'); link.href = url; link.download = filename; link.hidden = true; host.append(link);
        try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 0); }
      }
      message('Tournament report downloaded.');
    } catch (error) { message(errorText(error), true); }
    finally { downloadBusy = false; refresh(); }
  }
  function renderReport(): void {
    if (!report) return;
    const snapshot = report, names = new Map(snapshot.config.agents.map(agent => [agent.id, agent.name]));
    results.hidden = false; reportTitle.textContent = snapshot.config.name;
    reportSummary.replaceChildren(summary([['Report ID', snapshot.id], ['Status', snapshot.status], ['Replay verification', 'Passed'], ['Matches', String(snapshot.matches.length)], ['Started', snapshot.createdAt], ['Finished', snapshot.finishedAt ?? 'Not finished']]));
    if (snapshot.error) reportSummary.append(create('p', snapshot.error, 'tournament-fault'));
    fillStandings(verifiedStandings.body, tournamentStandings(snapshot));
    const cfg = snapshot.config, provenance = snapshot.provenance;
    provenanceBody.replaceChildren(summary([
      ['Configuration ID', cfg.id], ['Agents', cfg.agents.map(agent => `${agent.name} (${agent.id}, ${agent.faction})`).join(', ')], ['Seeds', cfg.seeds.join(', ')], ['Map size', cfg.mapSize], ['Seat order', cfg.bothSeats ? 'Both seat orders' : 'One seat order'], ['Match time limit', time(cfg.maxSeconds)], ['Decision interval', `${cfg.decisionTicks} ticks`], ['Agent response timeout', `${cfg.responseTimeoutMs} ms`], ['Commands per turn', String(cfg.maxCommandsPerTurn)], ['Starting age', cfg.startingAge === undefined ? 'Default' : String(cfg.startingAge)], ['Starting resources', cfg.startingResources ? Object.entries(cfg.startingResources).map(([kind, value]) => `${value} ${kind}`).join(', ') : 'Default'],
      ['Content SHA-256', provenance.contentSha256], ['Engine SHA-256', provenance.engineSha256], ['Runtime', `${provenance.node} · ${provenance.platform} · ${provenance.architecture}`], ['Save version', String(provenance.saveVersion)],
    ]));
    const sourceList = create('ul'); sourceList.setAttribute('aria-label', 'Engine source hashes');
    for (const source of provenance.sources) sourceList.append(create('li', `${source.path} · ${source.sha256}`));
    provenanceBody.append(create('h4', 'Recorded engine sources'), sourceList);
    const agentList = create('ul'); agentList.setAttribute('aria-label', 'Agent provenance');
    for (const agent of provenance.agents) {
      const item = create('li', `${names.get(agent.agentId) ?? agent.agentId}: ${agent.command.join(' ')}`), files = create('ul');
      for (const file of agent.files) files.append(create('li', `${file.path} · ${file.sha256}`));
      item.append(files); agentList.append(item);
    }
    provenanceBody.append(create('h4', 'Recorded agents'), agentList); matchList.replaceChildren();
    for (const match of snapshot.matches) {
      const row = create('li'); row.dataset.tournamentMatch = match.id; row.dataset.matchStatus = match.status;
      row.append(create('h4', `${match.index + 1}. ${match.seats.map(id => names.get(id) ?? id).join(' vs ')}`));
      const winner = match.winnerAgentId ? names.get(match.winnerAgentId) ?? match.winnerAgentId : null;
      const outcome = match.status === 'battle' ? winner ? `${winner} won in battle` : 'Battle ended in a draw' : match.status === 'forfeit' ? `${winner ?? 'No agent'} won by forfeit` : match.status === 'double-forfeit' ? 'Both agents forfeited' : match.status === 'limit' ? 'Time limit reached · Incomplete' : 'Match aborted · No result';
      row.append(create('p', outcome, 'tournament-outcome'), create('p', `Seed ${match.seed} · Player 1: ${names.get(match.seats[0]) ?? match.seats[0]} · Player 2: ${names.get(match.seats[1]) ?? match.seats[1]} · Tick ${match.finalTick} · ${time(match.seconds)}`));
      for (const [side, agent] of match.agents.entries()) {
        const faults = Array.from(new Set([agent.fault, ...match.decisions.filter(decision => decision.side === side).map(decision => decision.fault)].filter((fault): fault is string => !!fault)));
        if (faults.length) row.append(create('p', `${names.get(agent.agentId) ?? agent.agentId} (Player ${side + 1}): ${faults.join('; ')}`, 'tournament-fault'));
        if (agent.stderr || agent.exitCode !== null && agent.exitCode !== 0 || agent.exitSignal) {
          const details = create('details'), label = create('summary', `${names.get(agent.agentId) ?? agent.agentId} process details`); label.tabIndex = 0;
          details.append(label, create('p', `Turns ${agent.turns} · Accepted commands ${agent.accepted} · Rejected commands ${agent.rejected} · Exit code ${agent.exitCode ?? 'not recorded'}${agent.exitSignal ? ` · Signal ${agent.exitSignal}` : ''}`));
          if (agent.stderr) details.append(create('pre', `${agent.stderr}${agent.stderrTruncated ? '\n[Output truncated]' : ''}`));
          row.append(details);
        }
      }
      const inspect = button('Inspect replay', () => { void inspectReplay(match, snapshot); }); inspect.setAttribute('aria-label', `Inspect replay for match ${match.index + 1}: ${match.seats.map(id => names.get(id) ?? id).join(' vs ')}`); row.append(inspect); matchList.append(row);
    }
    if (!snapshot.matches.length) matchList.append(create('li', 'No matches were recorded.'));
    refresh();
  }
  async function inspectReplay(match: TournamentMatch, snapshot: TournamentReport): Promise<void> {
    if (disposed || replayBusy || verifying) return;
    replayBusy = true; refresh();
    try { await options.onReplay(match.replay, match, snapshot); if (!disposed) close(); }
    catch (error) { message(`Could not inspect replay: ${errorText(error)}`, true); }
    finally { replayBusy = false; refresh(); }
  }
  function visibility(open: boolean): void { try { options.onVisibility?.(open); } catch (error) { message(errorText(error), true); } }
  function open(): void {
    if (disposed || blocked && !opened) return;
    if (!opened) { previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null; opened = true; overlay.hidden = false; launch.setAttribute('aria-expanded', 'true'); visibility(true); }
    closeButton.focus(); refresh();
    if (!choicesLoaded) void loadChoices();
    if (activeRun) void poll();
  }
  function close(): void {
    if (!opened) return;
    opened = false; overlay.hidden = true; launch.setAttribute('aria-expanded', 'false'); clearPoll(); visibility(false); refresh();
    if (previousFocus?.isConnected) previousFocus.focus(); previousFocus = null;
  }
  function keyboard(event: KeyboardEvent): void {
    if (!opened) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); return; }
    if (event.key === 'Tab') {
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],summary,[tabindex]')).filter(element => !element.closest('[hidden]') && (!element.closest('details:not([open])') || element.tagName === 'SUMMARY') && !('disabled' in element && element.disabled) && element.tabIndex >= 0);
      const first = focusable[0], last = focusable.at(-1);
      if (!first || !last) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    if (!dialog.contains(event.target as Node)) event.stopPropagation();
  }
  document.addEventListener('keydown', keyboard, true);
  const stopEvent = (event: Event) => event.stopPropagation();
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel']) host.addEventListener(type, stopEvent);
  host.addEventListener('keydown', event => { if (opened || event.target instanceof HTMLButtonElement && ['Enter', ' ', 'Spacebar'].includes(event.key)) event.stopPropagation(); });
  refresh();
  return {
    update(status: { blocked?: boolean } = {}): void { if (disposed) return; blocked = !!status.blocked; refresh(); },
    loadReport,
    dispose(): void { if (disposed) return; close(); disposed = true; ++verifyRequest; clearPoll(); document.removeEventListener('keydown', keyboard, true); host.remove(); },
  };
}
