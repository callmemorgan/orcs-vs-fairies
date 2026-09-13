#!/usr/bin/env python3
"""Summarize read-only local browser telemetry; never drives or changes a match."""
import argparse,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--since',required=True);p.add_argument('--input',default='work/browser-session.jsonl');p.add_argument('--out',default='docs/evidence/ui-overhaul/browser-summary.json');a=p.parse_args()
sessions=[];last=None;current=None
with open(a.input) as stream:
 for line in stream:
  s=json.loads(line)
  if s['at']<a.since:continue
  identity=(s['players'][0]['faction'],s['players'][1]['faction'],s['mapSize'],s['seed'])
  if last is None or identity!=last[0] or s['time']<last[1]:
   current={'faction':identity[0],'opponent':identity[1],'mapSize':identity[2],'seed':identity[3],'firstAt':s['at'],'lastAt':s['at'],'firstTime':s['time'],'lastTime':s['time'],'winner':None,'snapshots':0,'viewports':[],'completedBuildings':set(),'recruitedRoles':set(),'maxQueue':0,'maxSelection':0,'maxBank':{'wood':0,'ore':0,'crystal':0},'gathering':set(),'abilityUsedRoles':set(),'emplaced':False,'lastBank':None,'artLoaded':False,'artAssets':0}
   sessions.append(current)
  current['snapshots']+=1;current['lastAt']=s['at'];current['lastTime']=s['time'];current['winner']=s['winner'];current['draw']=s.get('draw',False);current['lastBank']=s['players'][0];current['maxSelection']=max(current['maxSelection'],len(s['selected']))
  if s['viewport'] not in current['viewports']:current['viewports'].append(s['viewport'])
  for kind in current['maxBank']:current['maxBank'][kind]=max(current['maxBank'][kind],s['players'][0][kind])
  current['artLoaded']|=s['art'].get('loaded',False);current['artAssets']=max(current['artAssets'],s['art'].get('assets',0))
  for e in s['entities']:
   if e['side']!=0:continue
   if e['kind']=='building' and e['progress']>=1:current['completedBuildings'].add(e['role'])
   if e['kind']=='unit' and e['id']>14 and not e.get('illusion',False) and not e.get('raised',False):current['recruitedRoles'].add(e['role'])
   current['maxQueue']=max(current['maxQueue'],len(e['queue']))
   if e['order']['type']=='gather':
    r=next((r for r in s['resources'] if r['id']==e['order']['target']),None)
    if r:current['gathering'].add(r['kind'])
   if e.get('abilityReadyAt',0)>0:current['abilityUsedRoles'].add(e['role'])
   if e.get('entrenchedAt') is not None:current['emplaced']=True
  last=(identity,s['time'])
for s in sessions:
 for key,value in list(s.items()):
  if isinstance(value,set):s[key]=sorted(value)
Path(a.out).write_text(json.dumps({'since':a.since,'method':'Read-only browser telemetry emitted every five seconds. Recruitment identifies normal units with IDs above the 14 starting entities. A peak bank is not a deposit count. Screenshots and UI snapshots prove the control interactions separately.','sessions':sessions},indent=2)+'\n')
print(f'{len(sessions)} browser sessions summarized in {a.out}')
