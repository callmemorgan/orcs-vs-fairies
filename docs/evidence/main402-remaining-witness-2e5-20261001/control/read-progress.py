from pathlib import Path
import datetime,json,os
control=Path(__file__).parent
out=Path('/tmp/ovf-main402-remaining-2e5-r1')
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
def read(path):
 try:return json.loads(path.read_text())
 except FileNotFoundError:return None
 except json.JSONDecodeError:return {'readStatus':'file update in progress'}
def stat(pid):
 try:
  v=Path(f'/proc/{pid}/stat').read_text().rsplit(') ',1)[1].split();return {'pid':pid,'ppid':int(v[1]),'startTicks':int(v[19]),'state':v[0]}
 except FileNotFoundError:return None
state=read(out/'execution.json') or {};ctl=read(control/'control-execution.json') or {};browser=read(out/'browser/browser-main-smoke402.json') or {}
phases=state.get('phases',[])
last=phases[-1] if phases else None
known=[ctl.get('launcherIdentity'),ctl.get('wrapperIdentity')]+[p.get('child') for p in phases]+[state.get('ownedPreview')]
identities=[{'bound':r,'current':stat(r['pid'])} for r in known if r]
try:fd=os.readlink('/proc/1063/fd/22')
except FileNotFoundError:fd=None
summary={'at':now,'controlStatus':{k:ctl.get(k) for k in ['wrapperPid','exitCode','finishedAt']},'status':state.get('status'),'lastPhase':last,'phaseCount':len(phases),'browserGroupNames':list(browser.get('groups',{})),'activeCase':browser.get('canonicalProgress',{}).get('activeCase'),'completedCases':browser.get('canonicalProgress',{}).get('completedCases',[]),'nativeDownloads':len(browser.get('downloads',{})),'browserFailure':browser.get('failure'),'executionFailure':state.get('failure'),'cleanupErrors':state.get('cleanupErrors'),'rememberedIdentities':identities,'protected4173':{'identity':stat(1063),'fd22':fd}}
name='progress-'+now.replace(':','_')+'.json';(control/name).write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
