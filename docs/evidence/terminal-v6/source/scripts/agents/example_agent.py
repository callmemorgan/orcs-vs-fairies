#!/usr/bin/env python3
"""Observation-only terminal player. Uses no engine imports or private game state."""
import argparse,json,math,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser()
p.add_argument('--faction',default='automata');p.add_argument('--opponent',default='tideborn')
p.add_argument('--map-size',default='small',choices=['small','medium','large']);p.add_argument('--seed',type=int,default=4127)
p.add_argument('--side',type=int,default=1,choices=[0,1]);p.add_argument('--seconds',type=int,default=2700)
p.add_argument('--log',type=Path,required=True);a=p.parse_args()
a.log.parent.mkdir(parents=True,exist_ok=True)
proc=subprocess.Popen(['node',str(ROOT/'dist-cli/rts.js'),'--log',str(a.log.resolve())],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True,bufsize=1)
requests=0;accepted=0;rejected=0

def ask(message):
 global requests
 requests+=1;proc.stdin.write(json.dumps(message)+'\n');proc.stdin.flush()
 line=proc.stdout.readline()
 if not line:raise RuntimeError(f'CLI exited with {proc.poll()}')
 reply=json.loads(line)
 if not reply['ok']:raise RuntimeError(reply['error'])
 return reply['result']

def command(c):
 global accepted,rejected
 ok=ask({'op':'command','command':c})['accepted'];accepted+=ok;rejected+=not ok;return ok

def distance(a,b):return math.hypot(a['x']-b['x'],a['y']-b['y'])

def play(obs):
 side=obs['side'];own=[e for e in obs['entities'] if e['side']==side]
 workers=[e for e in own if e['kind']=='unit' and e['role']=='worker'];buildings=[e for e in own if e['kind']=='building']
 hq=next((e for e in buildings if e['role']=='hq'),None)
 if not hq:return
 bank=obs['player'].copy();defs=obs['content']['faction'];nodes=[r for r in obs['resources'] if r['visible'] and r['amount']>0]
 queued=sum(len(e['queue']) for e in buildings)
 def afford(cost):return all(bank[k]>=cost[k] for k in ('wood','ore','crystal'))
 def pay(cost):
  for k in ('wood','ore','crystal'):bank[k]-=cost[k]
 # Assign workers by actual visible nodes and current orders.
 want_crystal=2 if any(e['role']=='barracks' for e in buildings) and bank['crystal']<80 else 0
 desired={'crystal':want_crystal,'wood':math.ceil((len(workers)-want_crystal)*.6),'ore':len(workers)-want_crystal-math.ceil((len(workers)-want_crystal)*.6)}
 assignments={k:0 for k in desired};by_id={n['id']:n for n in nodes}
 for w in workers:
  n=by_id.get(w['order'].get('target')) if w['order']['type']=='gather' else None
  if n:assignments[n['kind']]+=1
 for w in workers:
  if w['order']['type'] not in ('idle','gather'):continue
  current=by_id.get(w['order'].get('target'))
  if current and assignments[current['kind']]<=desired[current['kind']]:continue
  choices=sorted([k for k in desired if any(n['kind']==k for n in nodes)],key=lambda k:desired[k]-assignments[k],reverse=True)
  if choices:
   kind=choices[0];n=min([n for n in nodes if n['kind']==kind],key=lambda n:distance(w,n))
   if command({'type':'gather','ids':[w['id']],'target':n['id']}):
    if current:assignments[current['kind']]-=1
    assignments[kind]+=1
 # Resume a foundation if its builder was killed or reassigned.
 for site in [e for e in buildings if e['progress']<1]:
  if not any(w['order']['type']=='build' and w['order']['target']==site['id'] for w in workers):
   free=[w for w in workers if w['order']['type'] in ('idle','gather')]
   if free:command({'type':'repair','ids':[min(free,key=lambda w:distance(w,site))['id']],'target':site['id']})
 cost=defs['units']['worker']['cost']
 if len(workers)+hq['queue'].count('worker')<9 and len(hq['queue'])<2 and bank['population']+queued<bank['cap'] and afford(cost):
  if command({'type':'train','id':hq['id'],'role':'worker'}):pay(cost);queued+=1
 role=None
 if not any(e['role']=='barracks' for e in buildings):role='barracks'
 elif bank['cap']-bank['population']-queued<5 and bank['cap']<100 and not any(e['role']=='depot' and e['progress']<1 for e in buildings):role='depot'
 elif obs['time']>150 and sum(e['role']=='barracks' for e in buildings)<2:role='barracks'
 elif obs['time']>180 and not any(e['role']=='tower' for e in buildings):role='tower'
 if role and workers and afford(defs['buildings'][role]['cost']) and not any(w['order']['type']=='build' for w in workers):
  size=defs['buildings'][role]['size'];r=size/2;width=obs['map']['width'];height=obs['map']['height'];visible=set(obs['visible']);terrain=obs['map']['terrain']
  def placeable(x,y):
   if x-r<.5 or y-r<.5 or x+r>width-.5 or y+r>height-.5:return False
   if any(math.floor(y+dy)*width+math.floor(x+dx) not in visible for dx in (-r,0,r) for dy in (-r,0,r)):return False
   if any(terrain[ty*width+tx] not in ('grass','road') for ty in range(math.floor(y-r),math.ceil(y+r)) for tx in range(math.floor(x-r),math.ceil(x+r))):return False
   if any(abs(e['x']-x)<defs['buildings'][e['role']]['size']/2+r+.4 and abs(e['y']-y)<defs['buildings'][e['role']]['size']/2+r+.4 for e in buildings):return False
   return not any(abs(n['x']-x)<r+.8 and abs(n['y']-y)<r+.8 for n in nodes)
  done=False;direction=1 if side==0 else -1
  for radius in (5,7,9):
   if done:break
   for i in range(16):
    angle=i*math.pi/8;x=math.floor(hq['x']+math.cos(angle)*radius*direction)+.5;y=math.floor(hq['y']+math.sin(angle)*radius*direction)+.5
    if placeable(x,y) and command({'type':'build','ids':[workers[0]['id']],'role':role,'x':x,'y':y}):pay(defs['buildings'][role]['cost']);done=True;break
 army=[e for e in own if e['kind']=='unit' and e['role']!='worker' and not e['illusion']]
 planned=[e['role'] for e in army if not e.get('raised')]+[r for e in buildings for r in e['queue'] if r!='worker']
 composition=defs['ai'].get('composition',{'melee':.45,'ranged':.35,'special':.20})
 for b in [e for e in buildings if e['role']=='barracks' and e['progress']==1 and len(e['queue'])<2]:
  if bank['population']+queued>=bank['cap']:break
  choices=sorted(composition,key=lambda r:(len(planned)+1)*composition[r]-planned.count(r),reverse=True)
  for role in choices:
   cost=defs['units'][role]['cost']
   if afford(cost) and command({'type':'train','id':b['id'],'role':role}):pay(cost);queued+=1;planned.append(role);break
 seen=[e for e in obs['entities'] if e['side']!=side];threat=next((e for e in seen if distance(e,hq)<12),None)
 if army:
  target=threat or next((e for e in seen if e['kind']=='building' and e['role']=='hq'),None) or (seen[0] if seen else obs['map']['starts'][1-side])
  if threat or len(army)>=defs['ai']['armySize'] and int(obs['time'])%45<5:
   command({'type':'attackMove','ids':[e['id'] for e in army], 'x':target['x'],'y':target['y']})
  elif obs['time']>=65 and obs['time']<70:
   target=obs['map']['starts'][1-side];command({'type':'attackMove','ids':[army[0]['id']],'x':hq['x']+(target['x']-hq['x'])*.7,'y':hq['y']+(target['y']-hq['y'])*.7})
 for e in army:
  ability=defs['units'][e['role']].get('ability')
  if not ability or (e.get('abilityReadyAt') or 0)>obs['time']:continue
  near=any(distance(e,b)<defs['units'][e['role']]['range']+(3 if e['role']=='special' else 0)+1 for b in seen)
  if ability=='entrench':
   if near!=(e.get('entrenchedAt') is not None):command({'type':'ability','ids':[e['id']]})
  elif near:command({'type':'ability','ids':[e['id']]})

try:
 obs=ask({'op':'start','faction':a.faction,'opponent':a.opponent,'side':a.side,'seed':a.seed,'mapSize':a.map_size})
 while not obs['result']['finished'] and obs['time']<a.seconds:
  play(obs);obs=ask({'op':'advance','ticks':100})['observation']
 result=ask({'op':'result'});print(json.dumps({'agent':'example_agent.py','faction':a.faction,'opponent':a.opponent,'seed':a.seed,'mapSize':a.map_size,'requests':requests,'acceptedCommands':accepted,'rejectedCommands':rejected,'result':result},indent=2))
finally:
 proc.stdin.close();proc.wait(timeout=10)
