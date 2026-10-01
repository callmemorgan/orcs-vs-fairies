#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { runTournament } from './runner';
import { verifyTournamentReport } from './report';

const args = process.argv.slice(2);
function option(name: string) { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; }
async function main() {
  if (args.includes('--help')) {
    console.log('Run: node dist-tournament/run.js --config PATH --output NEW_DIRECTORY [--cwd REPO]\nVerify: node dist-tournament/run.js --verify TOURNAMENT_JSON\nSee docs/AGENT_TOURNAMENTS.md.');
    return;
  }
  const verify = option('--verify');
  if (verify) {
    const report = await verifyTournamentReport(await readFile(verify, 'utf8'));
    console.log(JSON.stringify({ verified: true, id: report.id, matches: report.matches.length }));
    return;
  }
  const file = option('--config'), output = option('--output');
  if (!file || !output || args.some((arg, index) => index % 2 === 0 && !['--config', '--output', '--cwd'].includes(arg))) throw new Error('Use --config PATH --output NEW_DIRECTORY [--cwd REPO].');
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort();
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  try {
    const report = await runTournament(JSON.parse(await readFile(file, 'utf8')), { cwd: option('--cwd') ?? process.cwd(), outputDirectory: output,
      signal: cancellation.signal, onProgress: progress => process.stderr.write(JSON.stringify(progress) + '\n') });
    console.log(JSON.stringify({ id: report.id, status: report.status, matches: report.matches.length, file: path.resolve(output, 'tournament.json'), error: report.error }));
    if (report.status !== 'complete') process.exitCode = 1;
  } finally { process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
