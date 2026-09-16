#!/usr/bin/env python3
"""Summarize completed regression matches without implying competitive balance."""
import argparse,json,statistics
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('directory',type=Path);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
games=[json.loads(path.read_text()) for path in sorted(a.directory.glob('*.json')) if not path.name.endswith('-unfinished.json')]
if not games:raise SystemExit('No match reports found')
factions={}
for game in games:
 for side,name in enumerate([game['faction'],game['opponent']]):
  item=factions.setdefault(name,{'games':0,'wins':0,'losses':0,'draws':0,'roles':set(),'buildings':set(),'citadelGames':0})
  item['games']+=1;item['roles'].update(game['roles'][side]);item['buildings'].update(game['built'][side]);item['citadelGames']+=game['ages'][side]==3
  item['draws' if game['draw'] else 'wins' if game['winner']==side else 'losses']+=1
for item in factions.values():
 for key in ['roles','buildings']:item[key]=sorted(item[key])
report={'matches':len(games),'seed':sorted({g['seed'] for g in games}),'durationSeconds':{'min':min(g['seconds'] for g in games),'median':statistics.median(g['seconds'] for g in games),'max':max(g['seconds'] for g in games)},'factions':factions,'limits':'Deterministic AI samples, including mirrors, on one default-map seed. These outcomes do not establish competitive balance or browser performance.'}
a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
