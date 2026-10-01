import { ReplayPlayer, replayChecksum } from '../../src/core/replays';
import { createTournamentDashboardSource } from '../../src/tournament/client';
import { tournamentSha256, tournamentStateText } from '../../src/tournament/report';
import type { TournamentReport } from '../../src/tournament/types';
import { mountTournamentDashboard } from '../../src/ui/TournamentDashboard';

const proof = {
  ready: true,
  visibility: [] as boolean[],
  runs: [] as Array<{ configId: string; id: string }>,
  polls: [] as Array<{ id: string; status: string; completed: number; tick: number | null }>,
  reports: [] as Array<{ id: string; status: string; matches: number }>,
  inspections: [] as Array<{ reportId: string; matchId: string; finalTick: number; sha256: string; checksum: string; midpoint: number }>,
};
const output = document.getElementById('proof-data')!;
const publish = () => { output.textContent = JSON.stringify(proof); };
const remote = createTournamentDashboardSource();
const source = {
  ...remote,
  async start(configId: string) {
    const run = await remote.start(configId); proof.runs.push({ configId, id: run.id }); publish(); return run;
  },
  async status(id: string) {
    const progress = await remote.status(id); proof.polls.push({ id, status: progress.status, completed: progress.completedMatches, tick: progress.current?.tick ?? null }); publish(); return progress;
  },
  async result(id: string): Promise<TournamentReport> {
    const report = await remote.result(id); proof.reports.push({ id: report.id, status: report.status, matches: report.matches.length }); publish(); return report;
  },
};
const dashboard = mountTournamentDashboard(document.getElementById('dashboard-root')!, {
  source,
  onVisibility(open) { proof.visibility.push(open); publish(); },
  async onReplay(archive, match, report) {
    const player = new ReplayPlayer(archive);
    try {
      while (!player.finished) { player.advance(200); await new Promise<void>(resolve => setTimeout(resolve, 0)); }
      const sha256 = await tournamentSha256(tournamentStateText(player.state));
      if (sha256 !== match.finalStateSha256) throw new Error('Inspected replay final state does not match the report.');
      const checksum = replayChecksum(player.state, archive.checksumVersion ?? archive.initial.version);
      const midpoint = Math.floor((archive.initial.state.tick + archive.finalTick) / 2);
      player.seek(midpoint); if (player.state.tick !== midpoint) throw new Error('Replay midpoint seek failed.');
      player.seek(archive.finalTick);
      if (await tournamentSha256(tournamentStateText(player.state)) !== sha256) throw new Error('Replay seek changed its final state.');
      proof.inspections.push({ reportId: report.id, matchId: match.id, finalTick: player.state.tick, sha256, checksum, midpoint }); publish();
    } finally { player.dispose(); }
  },
});
window.addEventListener('beforeunload', () => dashboard.dispose());
publish();
