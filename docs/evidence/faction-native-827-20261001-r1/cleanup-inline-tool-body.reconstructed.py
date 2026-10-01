import os,pathlib,hashlib,json,subprocess,datetime,stat,shutil,tarfile,base64
packet=pathlib.Path('/tmp/ovf-faction-827-readiness-20261001-r1')
plan=json.loads((packet/'execution-plan.json').read_bytes())
evidence=pathlib.Path(plan['evidenceParent']);logs=evidence/'logs';own=pathlib.Path(plan['ownedCheckout']);root=pathlib.Path('/home/morgana/Projects/orcs-vs-Fairies')
baseline=json.loads((logs/'protection-baseline.json').read_bytes())
def inventory(base):
    entries={}
    for current,dirs,files in os.walk(base,followlinks=False):
        for name in sorted(dirs+files):
            path=pathlib.Path(current)/name;rel=path.relative_to(base).as_posix();info=path.lstat()
            if stat.S_ISLNK(info.st_mode):entries[rel]={'kind':'symlink','target':os.readlink(path)}
            elif stat.S_ISREG(info.st_mode):
                h=hashlib.sha256()
                with path.open('rb') as stream:
                    while data:=stream.read(1024*1024):h.update(data)
                entries[rel]={'kind':'file','bytes':info.st_size,'mode':stat.S_IMODE(info.st_mode),'sha256':h.hexdigest()}
            elif stat.S_ISDIR(info.st_mode):entries[rel]={'kind':'directory'}
            else:entries[rel]={'kind':'other','mode':info.st_mode}
    return entries
units=[]
for unit in [p['unit'] for p in plan['phases']]+[plan['preview']['unit']]:
    argv=['systemctl','--user','show',unit,'--property=LoadState,ActiveState,SubState,MainPID,ControlGroup']
    result=subprocess.run(argv,text=True,capture_output=True)
    before={'argv':argv,'exitCode':result.returncode,'stdout':result.stdout,'stderr':result.stderr}
    stop=None
    if 'ActiveState=active\n' in result.stdout or 'ActiveState=activating\n' in result.stdout:
        stopped=subprocess.run(['systemctl','--user','stop',unit],text=True,capture_output=True)
        stop={'exitCode':stopped.returncode,'stdout':stopped.stdout,'stderr':stopped.stderr}
        if stopped.returncode:raise RuntimeError('Unable to stop owned unit '+unit)
        result=subprocess.run(argv,text=True,capture_output=True)
    if 'ActiveState=active\n' in result.stdout or 'MainPID=0\n' not in result.stdout:raise RuntimeError('Owned unit remains active '+unit)
    units.append({'unit':unit,'observedBefore':before,'stop':stop,'final':{'exitCode':result.returncode,'stdout':result.stdout,'stderr':result.stderr}})
owned_runtime=[]
for proc in pathlib.Path('/proc').iterdir():
    if not proc.name.isdigit():continue
    try:
        argv=(proc/'cmdline').read_bytes().split(b'\0');exe=os.readlink(proc/'exe');cwd=os.readlink(proc/'cwd')
    except (FileNotFoundError,ProcessLookupError,PermissionError):continue
    text=b' '.join(argv).decode(errors='replace')
    runtime=os.path.basename(exe).split()[0] in ('node','chrome','chromium','systemd-run')
    if runtime and (str(own) in text or str(evidence) in text or cwd==str(own)):
        owned_runtime.append({'pid':int(proc.name),'exe':exe,'cwd':cwd,'command':text})
if owned_runtime:raise RuntimeError('Owned runtime remains: '+repr(owned_runtime))
target=own/'node_modules'
if not target.is_dir() or target.is_symlink():raise RuntimeError('Private dependency directory differs')
private_inventory=inventory(target)
archive=logs/'owned-node-modules-after-failure.tar.gz'
with tarfile.open(archive,'x:gz',dereference=False) as tar:tar.add(target,arcname='node_modules',recursive=True)
shutil.rmtree(target)
preflight=json.loads((evidence/'preflight-readiness.json').read_bytes())
source={**preflight['productInputs'],**preflight['acceptanceInventory']}
for rel,item in source.items():
    path=own/rel;data=path.read_bytes();info=path.lstat()
    if len(data)!=item['bytes'] or hashlib.sha256(data).hexdigest()!=item['sha256'] or path.is_symlink():raise RuntimeError('Owned source differs '+rel)
    mode='100755' if info.st_mode&73 else '100644'
    if mode!=item['mode']:raise RuntimeError('Owned source mode differs '+rel)
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=own,text=True).strip();status=subprocess.check_output(['git','status','--porcelain'],cwd=own,text=True)
if head!=plan['executionPin'] or status:raise RuntimeError('Owned source not clean at pin')
deps=inventory(root/'node_modules');dist=inventory(root/'dist')
if deps!=baseline['installedDependencies']:raise RuntimeError('Installed dependency inventory differs')
if dist!=baseline['rootDist']:raise RuntimeError('Protected root dist inventory differs')
proc=pathlib.Path('/proc/1063');start=(proc/'stat').read_text().split(') ',1)[1].split()[19]
if start!=baseline['protectedPidStartTimeTicks'] or os.readlink(proc/'cwd')!=baseline['protectedPidCwd'] or base64.b64encode((proc/'cmdline').read_bytes()).decode()!=baseline['protectedPidCommandBase64']:raise RuntimeError('Protected PID identity differs')
ports=subprocess.check_output(['ss','-ltnp','( sport = :4173 or sport = :5298 )'],text=True)
if ':5298' in ports or ':4173' not in ports or 'pid=1063,' not in ports:raise RuntimeError('Protected or owned ports differ')
receipt={'kind':'faction-r1-cleanup-and-protection-check','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'executionPin':head,'sourceStatus':status,'verifiedSourceFiles':len(source),'sourceBytesAndModesUnchanged':True,'installedDependencyEntries':len(deps),'installedDependenciesMatchCompleteBaseline':True,'rootDistEntries':len(dist),'rootDistMatchesCompleteBaseline':True,'protectedPid':1063,'protectedPidIdentityUnchanged':True,'ports':ports,'ownedRuntimeProcesses':owned_runtime,'ownedUnits':units,'previewNeverStarted':True,'privateDependencyDirectoryRemoved':not target.exists(),'privateDependencyInventory':private_inventory,'privateDependencyArchive':{'path':str(archive),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()},'laterPhasesNotStarted':[p['name'] for p in plan['phases'][1:]],'originalIds21Through30RemainUnexecuted':True,'failureClassification':'Infrastructure: two historical focused-test inputs omitted by sparse checkout; no feature assertion failure observed','retryPerformed':False}
with (logs/'cleanup.receipt.json').open('x') as stream:json.dump(receipt,stream,indent=2);stream.write('\n')
print(json.dumps({key:receipt[key] for key in ('executionPin','verifiedSourceFiles','sourceBytesAndModesUnchanged','installedDependenciesMatchCompleteBaseline','rootDistMatchesCompleteBaseline','protectedPidIdentityUnchanged','ownedRuntimeProcesses','privateDependencyDirectoryRemoved','laterPhasesNotStarted','failureClassification')},indent=2))
print(json.dumps({'cleanupReceiptSha256':hashlib.sha256((logs/'cleanup.receipt.json').read_bytes()).hexdigest()},indent=2))
