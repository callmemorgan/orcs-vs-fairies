"""Summarize a versioned six-faction ladder; the 64-game baseline is immutable."""
import argparse,hashlib,json,os
from pathlib import Path
from statistics import median
p=argparse.ArgumentParser();p.add_argument('--run',default=os.environ.get('LADDER_RUN','six-factions-v1'));a=p.parse_args()
if not a.run.startswith('six-factions-') or '/' in a.run:raise ValueError('Choose a versioned six-factions-* run.')
root=Path(__file__).resolve().parents[2];out=root/'docs/evidence'/a.run
method=json.loads((out/'method.json').read_text())
for name,digest in method['sourceSha256'].items():
 source=out/'source'/name
 assert hashlib.sha256(source.read_bytes()).hexdigest()==digest,f'Source snapshot mismatch: {name}'
matches=[json.loads(p.read_text()) for p in sorted(out.glob('*.json')) if p.name not in ('method.json','summary.json')]
assert len(matches)==method['games'],f'Expected {method["games"]} games, got {len(matches)}'
assert len({(m['seed'],m['mapSize'],m['faction'],m['opponent']) for m in matches})==len(matches)
factions=list(dict.fromkeys(m['faction'] for m in matches));cross=[m for m in matches if m['faction']!=m['opponent']]
standings={f:dict(wins=0,losses=0,draws=0,timeouts=0,side0Wins=0,side1Wins=0,games=0) for f in factions}
for m in cross:
 for side,f in enumerate((m['faction'],m['opponent'])):
  r=standings[f];r['games']+=1
  if m['timeout']:r['timeouts']+=1
  elif m['draw']:r['draws']+=1
  elif m['winner']==side:r['wins']+=1;r[f'side{side}Wins']+=1
  else:r['losses']+=1
summary={'reporterSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'games':len(matches),'standings':standings,'completed':sum(not m['timeout'] for m in matches),'draws':sum(m['draw'] for m in matches),'timeouts':sum(m['timeout'] for m in matches),'side0Wins':sum(m['winner']==0 for m in matches),'side1Wins':sum(m['winner']==1 for m in matches),'mirrorSide0Wins':sum(m['winner']==0 and m['faction']==m['opponent'] for m in matches),'mirrorSide1Wins':sum(m['winner']==1 and m['faction']==m['opponent'] for m in matches),'medianSeconds':median(m['seconds'] for m in matches),'minSeconds':min(m['seconds'] for m in matches),'maxSeconds':max(m['seconds'] for m in matches),'movementStallEpisodes':sum(len(m['pathStalls']) for m in matches),'gamesWithMovementStalls':sum(bool(m['pathStalls']) for m in matches),'gamesEndingWithoutCombatFor180s':sum(m['secondsWithoutCombat']>=180 for m in matches),'invalidEconomy':sum(m['invalidEconomy'] for m in matches),'invalidPosition':sum(m['invalidPosition'] for m in matches)}
def duration(s):n=round(s);return f'{n//60}:{n%60:02}'
def score(mm,f):
 w=sum(m['winner'] is not None and (m['faction'],m['opponent'])[m['winner']]==f for m in mm);d=sum(m['draw'] or m['timeout'] for m in mm);return f'{w}–{len(mm)-w-d}–{d}'
lines=[f'# {len(matches)}-game six-faction ladder','',f'Run `{a.run}` uses seeds {method["seeds"]} on {", ".join(method["sizes"])} maps, with all ordered faction pairings and mirrors. Both AI controllers think on the same simulation ticks; command order alternates each pulse. Cross-faction games determine the standings. Mirrors measure side effects separately.','', 'These are deterministic AI matches on a small seed sample, not independent trials or evidence of competitive balance. Map changes, movement, economy, AI choices and combat stats all affect the results. The original [64-game baseline](../ladder-64/REPORT.md) uses different maps and scheduling, so its results are not a controlled comparison of unit stats.','', '## Standings','', '| Faction | Games | W–L–D | Timeouts | Win rate | Side 0 wins | Side 1 wins |','| --- | --- | --- | --- | --- | --- | --- |']
for f in sorted(factions,key=lambda f:-standings[f]['wins']):
 r=standings[f];lines.append(f'| {f.title()} | {r["games"]} | {r["wins"]}–{r["losses"]}–{r["draws"]} | {r["timeouts"]} | {r["wins"]/r["games"]:.1%} | {r["side0Wins"]} | {r["side1Wins"]} |')
lines+=['','## Matchups','','Cells are row faction wins–losses–draws/timeouts.','', '| Faction | '+' | '.join(f.title() for f in factions)+' |','| --- | '+' | '.join('---' for f in factions)+' |']
for f in factions:lines.append('| '+f.title()+' | '+' | '.join('—' if f==o else score([m for m in cross if {m['faction'],m['opponent']}=={f,o}],f) for o in factions)+' |')
lines+=['','## Map size and starting side','','| Size | Games | Side 0 wins | Side 1 wins | Draws | Timeouts | Median | Movement stalls |','| --- | --- | --- | --- | --- | --- | --- | --- |']
for size in method['sizes']:
 mm=[m for m in matches if m['mapSize']==size];lines.append(f'| {size} | {len(mm)} | {sum(m["winner"]==0 for m in mm)} | {sum(m["winner"]==1 for m in mm)} | {sum(m["draw"] for m in mm)} | {sum(m["timeout"] for m in mm)} | {duration(median(m["seconds"] for m in mm))} | {sum(len(m["pathStalls"]) for m in mm)} |')
lines+=['','| Mirror faction | Side 0 wins | Side 1 wins | Draws/timeouts |','| --- | --- | --- | --- |']
for f in factions:
 mm=[m for m in matches if m['faction']==m['opponent']==f];lines.append(f'| {f.title()} | {sum(m["winner"]==0 for m in mm)} | {sum(m["winner"]==1 for m in mm)} | {sum(m["draw"] or m["timeout"] for m in mm)} |')
lines+=['','## Completion and movement','',f'{summary["completed"]}/{len(matches)} matches finished; {summary["timeouts"]} reached 45 minutes. Duration: {duration(summary["minSeconds"])} minimum, {duration(summary["medianSeconds"])} median, {duration(summary["maxSeconds"])} maximum. Economy violations: {summary["invalidEconomy"]}; non-finite/out-of-bounds samples: {summary["invalidPosition"]}.','',f'The movement diagnostic flagged {summary["movementStallEpisodes"]} episodes in {summary["gamesWithMovementStalls"]} games. It detects a movement order stuck for 20 seconds far from its destination without a nearby visible enemy. Crowding, blocked destinations and inaccessible routes can all trigger it. Individual reports retain positions, times and targets for reproduction. {summary["gamesEndingWithoutCombatFor180s"]} games ended with at least 180 seconds since the last attack.','', '## Roster and resource use','','| Faction | Armies | Missing combat-role hits | Missing building types | No crystal deposited | No special ability used |','| --- | --- | --- | --- | --- | --- |']
for f in factions:
 entries=[(m,i) for m in matches for i,v in enumerate((m['faction'],m['opponent'])) if v==f]
 missing=sum(any(m['hitsByRole'][i].get(r,0)==0 for r in ['melee','ranged','special']) for m,i in entries)
 buildings=sum(set(m['built'][i])!={'hq','barracks','depot','tower'} for m,i in entries)
 crystals=sum(m['deposited'][i]['crystal']==0 for m,i in entries);abilities=sum(m['abilities'][i].get('special',0)==0 for m,i in entries)
 lines.append(f'| {f.title()} | {len(entries)} | {missing} | {buildings} | {crystals} | {abilities} |')
lines+=['','Some short or losing games end before every roster role fights or every building finishes. The reports record that absence rather than treating it as evidence that the mechanic never works.','', '## Reproduce','', 'Run `LADDER_RUN=six-factions-new-name npm run test:ladder`. Existing run names are refused to preserve evidence. Use `LADDER_SEEDS` and `LADDER_SIZES` for comma-separated subsets. To summarize an existing run, use `python3 scripts/ladder/report.py --run '+a.run+'`. Each run saves the simulation source and hashes in `source/` and `method.json`; replay an older version by copying that snapshot into a separate checkout.','']
(out/'REPORT.md').write_text('\n'.join(lines));(out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
