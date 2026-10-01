#!/usr/bin/env python3
"""Prepared hosted-only dispatcher. Execute only after root releases its heavy slot."""
import hashlib,json,os,re,signal,subprocess,sys,time
from pathlib import Path

HERE=Path(__file__).resolve().parent
PLAN=json.loads((HERE/'plan.json').read_bytes())
REPO=Path(PLAN['ownedCheckout'])
PIN=PLAN['targetPin']
OUT=Path(PLAN['freshPaths']['hostedOutput'])
STOP=False
owned={}

def sha_file(p):
    h=hashlib.sha256()
    with Path(p).open('rb') as f:
        for part in iter(lambda:f.read(1048576),b''):h.update(part)
    return h.hexdigest()
def pin_file(record):
    p=Path(record['path'])
    assert p.is_file() and p.stat().st_size==record['bytes'] and sha_file(p)==record['sha256'],str(p)
def git(*args):
    return subprocess.check_output(['git',*args],cwd=REPO).decode().strip()
def proc(pid):
    p=Path('/proc')/str(pid)
    try:
        f=(p/'stat').read_text().rsplit(')',1)[1].split()
        return {'pid':pid,'ppid':int(f[1]),'startTicks':int(f[19]),'state':f[0]}
    except (FileNotFoundError,ProcessLookupError,PermissionError):return None
def process_identity(pid):
    p=Path('/proc')/str(pid);r=proc(pid);assert r
    return {'pid':pid,'startTicks':r['startTicks'],'cmdline':(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(),'cwd':str((p/'cwd').resolve())}
def protected_snapshot():
    expected=json.loads(Path(PLAN['protectedRoot']['preparedSnapshot']['path']).read_bytes())
    dist=Path(expected['rootDist'])
    current={'pid':process_identity(1063),'port4173':subprocess.check_output(['ss','-lntp','sport','=',':4173'],text=True),
        'rootDist':str(dist),'distFiles':{str(p.relative_to(dist)):{'bytes':p.stat().st_size,'sha256':sha_file(p)} for p in sorted(dist.rglob('*')) if p.is_file()}}
    assert current['pid']==expected['pid'],'Protected PID identity changed'
    assert 'pid=1063,' in current['port4173'],'Protected4173 listener changed'
    assert current['distFiles']==expected['distFiles'],'Protected root dist changed'
    return current
def scan_owned(leader):
    rows={}
    for p in Path('/proc').iterdir():
        if p.name.isdigit():
            r=proc(int(p.name))
            if r:rows[r['pid']]=r
    ancestors={pid for pid,start in owned.items() if pid in rows and rows[pid]['startTicks']==start}
    if leader in rows:ancestors.add(leader)
    changed=True
    while changed:
        changed=False
        for pid,r in rows.items():
            if r['ppid'] in ancestors and pid not in ancestors:ancestors.add(pid);changed=True
    for pid in ancestors:
        assert pid!=1063 and pid!=os.getpid(),'Protected process entered owned descendant set'
        owned[pid]=rows[pid]['startTicks']
def live_owned():
    return [pid for pid,start in owned.items() if (r:=proc(pid)) and r['startTicks']==start and r['state']!='Z']
def signal_owned(sig):
    for pid in reversed(live_owned()):
        assert pid!=1063 and pid!=os.getpid()
        try:os.kill(pid,sig)
        except ProcessLookupError:pass
def interrupted(signum,frame):
    global STOP
    STOP=True
def write(name,data):
    (HERE/name).write_text(json.dumps(data,indent=2)+'\n')

assert sys.argv[1:]==['--execute-after-root-release'],'This dispatcher is held; use only after explicit root assignment.'
assert os.environ.get('OVF_HEAVY_SLOT_RELEASE')==PIN,'Root heavy-slot release must name the prepared pin.'
assert git('rev-parse','HEAD')==PIN,'Root must authorize/perform the owned checkout move before this dispatcher.'
assert git('diff','--name-only','HEAD')=='','Owned tracked source is dirty'
assert not OUT.exists() and not Path(PLAN['freshPaths']['audit']).exists(),'Retry output must be new'
assert not (HERE/'execution-receipt.json').exists(),'Do not reuse a completed dispatch packet'
for record in PLAN['preparedExecutableFiles']+PLAN['runtime']['currentByteRecords']+PLAN['preservedOriginal473Artifacts']:pin_file(record)
expected=json.loads(Path(PLAN['sourceManifest']['path']).read_bytes())
selected=re.compile(PLAN['sourceSelectionPattern'])
paths=sorted(p for p in git('ls-files','-z','--cached','--others','--exclude-standard').split('\0') if selected.search(p))
assert paths==sorted(expected['files']),'Owned source path inventory differs from target pin'
for p,record in expected['files'].items():
    assert (REPO/p).stat().st_size==record['bytes'] and sha_file(REPO/p)==record['sha256'],p
before=protected_snapshot();write('protected-root-before-dispatch.json',before)
env=os.environ.copy();env['OVF_PLAYWRIGHT_MODULE']=PLAN['runtime']['module']
for key in ['PWDEBUG','PLAYWRIGHT_BROWSERS_PATH','XDG_CACHE_HOME']:
    assert not env.get(key),f'Unexpected browser selection override {key}'
command=PLAN['invocation']
failure=None;status=None;after=None;child=None;owned_ports=[]
started=time.monotonic()
for sig in [signal.SIGINT,signal.SIGTERM]:signal.signal(sig,interrupted)
try:
    with (HERE/'hosted-supervisor.log').open('xb') as log:
        child=subprocess.Popen(command,cwd=REPO,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        scan_owned(child.pid)
        while child.poll() is None:
            scan_owned(child.pid)
            if STOP:raise RuntimeError('Hosted retry cancelled')
            if time.monotonic()-started>1260:raise TimeoutError('Hosted retry dispatcher exceeded21minutes')
            time.sleep(.25)
        status=child.returncode
        scan_owned(child.pid)
    assert status==0,f'Hosted supervisor exited{status}; retained log/result/audit identify failure'
except BaseException as error:
    failure=repr(error)
finally:
    # Stop only retained PID/start-time identities from this supervisor's descendants.
    # No pkill, all-browser sweep, root PID kill, or shared port-based kill.
    if child:
        scan_owned(child.pid)
        if live_owned():
            signal_owned(signal.SIGTERM)
            end=time.monotonic()+8
            while live_owned() and time.monotonic()<end:time.sleep(.1)
            if live_owned():signal_owned(signal.SIGKILL)
            end=time.monotonic()+5
            while live_owned() and time.monotonic()<end:time.sleep(.1)
        try:child.wait(timeout=1)
        except subprocess.TimeoutExpired:failure=failure or 'Owned supervisor did not exit after bounded cleanup'
    for p in OUT.glob('server-*.log') if OUT.exists() else []:
        m=re.search(r'authoritative server: http://127\.0\.0\.1:(\d+)',p.read_text())
        if m and int(m.group(1)) not in owned_ports:owned_ports.append(int(m.group(1)))
    ports={str(p):subprocess.check_output(['ss','-lntp','sport','=',f':{p}'],text=True) for p in owned_ports}
    if live_owned() or any('LISTEN' in value for value in ports.values()):failure=failure or 'Owned process/port remained after cleanup'
    try:
        after=protected_snapshot();write('protected-root-after-dispatch.json',after)
        for record in PLAN['preservedOriginal473Artifacts']+PLAN['runtime']['currentByteRecords']:pin_file(record)
        assert git('rev-parse','HEAD')==PIN and git('diff','--name-only','HEAD')==''
    except BaseException as error:failure=failure or repr(error)
    write('execution-receipt.json',{'targetPin':PIN,'producer':PLAN['producer'],'invocation':command,
        'supervisorExit':status,'elapsedSeconds':time.monotonic()-started,'failure':failure,
        'protectedRootBefore':before,'protectedRootAfter':after,'ownedPidStartIdentities':owned,
        'ownedSurvivors':live_owned(),'ownedPortsAfterCleanup':ports,'original473ArtifactsRechecked':True if after and not failure else 'Read failure/guards above',
        'scope':'Hosted only. Root must inspect actual result/audit/native receipts before admission; no canonical/daily dispatch and no status promotion.'})
if failure:raise RuntimeError(failure)
print('Hosted retry finished; inspect result/audit and execution-receipt before admission.')
