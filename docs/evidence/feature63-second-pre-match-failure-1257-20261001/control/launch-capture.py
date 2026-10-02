import datetime,hashlib,json,os,pathlib,select,stat,subprocess,time
CONTROL=pathlib.Path("/tmp/ovf-feature63-r2-capture-control-V8aSd0IH")
CHECKOUT=pathlib.Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
PREFIX=CHECKOUT/'work/feature63-human-wave-composition-r2'
ASSIGNMENT=pathlib.Path('/tmp/ovf-root-feature63-r2-bindings-3jv6a1en/capture-assignment.json')
DIGEST='8f0e36dde392d934a3a684b1e3da7fa4a486500aad79c50e196bf128199bd6e1'
DISPOSITION=pathlib.Path('/tmp/ovf-root-feature63-r2-binding-control-3jv6a1en/root-generated-bindings-disposition.json')
DISPOSITION_SHA='622a343dd4a12a5fa2be800a928f7624b6a3b53c6f2c0c3351d2801e4232b555'
PIN='1257b24db0121a72a12a6de10592397dc4996038'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def put(name,value):
    raw=(json.dumps(value,indent=2,sort_keys=True)+'\n').encode()
    fd=os.open(CONTROL/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as f:f.write(raw)
def note(value):
    with (CONTROL/'independent-observations.ndjson').open('ab') as f:f.write((json.dumps({'at':now(),**value},sort_keys=True)+'\n').encode())
def bound(desc):
    p=pathlib.Path(desc['path']);assert p.resolve()==p and p.is_file() and not p.is_symlink()
    b=p.read_bytes();assert len(b)==desc['bytes'] and hashlib.sha256(b).hexdigest()==desc['sha256']
    return b
def observation(pid):
    p=pathlib.Path('/proc')/str(pid)
    try:
        one=(p/'stat').read_text();v=one[one.rfind(')')+2:].split()
        exe=os.readlink(p/'exe');cwd=os.readlink(p/'cwd');raw=(p/'cmdline').read_bytes()
        two=(p/'stat').read_text();w=two[two.rfind(')')+2:].split()
        assert (v[19],v[3])==(w[19],w[3]) and exe==os.readlink(p/'exe') and cwd==os.readlink(p/'cwd')
        ident={'pid':pid,'startTicks':int(v[19]),'executable':exe,'cwd':cwd,'argv':[x.decode(errors='surrogateescape') for x in raw.split(b'\0') if x]}
        immutable={k:ident[k] for k in ('pid','startTicks','executable','cwd')};immutable['session']=int(v[3])
        return {'identity':ident,'immutableIdentity':immutable,'state':w[0],'rawCmdlineHex':raw.hex()}
    except (FileNotFoundError,ProcessLookupError):return None
def listeners(port):
    result=set()
    for name in ('tcp','tcp6'):
        for line in (pathlib.Path('/proc/self/net')/name).read_text().splitlines()[1:]:
            row=line.split()
            if row[3]=='0A' and int(row[1].rsplit(':',1)[1],16)==port:result.add('socket:['+row[9]+']')
    return sorted(result)
def socket_set(pid):
    result=set()
    try:
        for p in (pathlib.Path('/proc')/str(pid)/'fd').iterdir():
            try:
                link=os.readlink(p)
                if link.startswith('socket:['):result.add(link)
            except FileNotFoundError:pass
    except FileNotFoundError:pass
    return result
def protected(a):
    value=observation(1063);assert value is not None and value['identity']==a['protectedProcess'] and value['immutableIdentity']['session']==1063
    expected=sorted(a['protectedListenerSockets']);actual=listeners(4173)
    assert actual==expected and set(actual)<=socket_set(1063) and os.readlink('/proc/1063/fd/22')=='socket:[3783]'
    assert os.readlink('/proc/1063/ns/net')==os.readlink('/proc/self/ns/net')
    return {'at':now(),'process':value,'listeningSockets':actual,'fd22':os.readlink('/proc/1063/fd/22')}
raw=ASSIGNMENT.read_bytes();assert hashlib.sha256(raw).hexdigest()==DIGEST;a=json.loads(raw)
dis=DISPOSITION.read_bytes();assert hashlib.sha256(dis).hexdigest()==DISPOSITION_SHA;d=json.loads(dis)
assert a['approved'] is True and a['phase']=='capture' and a['sourcePin']==PIN and a['assignedBy']=='/root'
assert d['captureAdmitted'] is True and d['slotExclusivelyAssignedTo']=='/root/ai_modes' and d['noAutomaticRetryAuthorized'] is True
assert a['exclusiveHeavyApproval']['token']=='heavy-runtime-1-feature63-r2-1257b24db012-3jv6a1en'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=CHECKOUT,text=True).strip()==PIN
assert subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=CHECKOUT,text=True)==''
assert {p.name for p in PREFIX.iterdir()}=={'dist','server'}
wrapper=CHECKOUT/'scripts/feature63/run-minimal63.py';assert hashlib.sha256(wrapper.read_bytes()).hexdigest()==a['wrapperSha256']=='f1aeeca031e80029f49d3dd4327ccda6caf02848f427bc8a21df72b87ff9618d'
for k in ('pythonExecutable','nodeExecutable','publicProducer','collector','auditor'):bound(a[k])
put('capture-assignment.actual.json',a);put('root-disposition.actual.json',d)
for key in ('sourceBinding','buildBinding','testedBuildReceipt','reviewReceipt','browserBinding'):
    b=bound(a[key]);fd=os.open(CONTROL/(key+'.actual.json'),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as f:f.write(b)
before=protected(a);assert listeners(5373)==listeners(5374)==[]
command=[a['pythonExecutable']['path'],'scripts/feature63/run-minimal63.py','capture',str(ASSIGNMENT)]
put('command.json',{'at':now(),'command':command,'cwd':str(CHECKOUT),'environmentAnchor':{'OVF_FEATURE63_WRAPPER_ASSIGNMENT_SHA256':DIGEST},'wrapperSha256':a['wrapperSha256'],'sourcePin':PIN,'slot':a['exclusiveHeavyApproval'],'protectedBefore':before,'automaticRetries':0})
put('capture-launch-consumed.json',{'at':now(),'captureInvocations':1,'automaticRetries':0,'assignmentSha256':DIGEST})
env=dict(os.environ,OVF_FEATURE63_WRAPPER_ASSIGNMENT_SHA256=DIGEST)
stdout=os.fdopen(os.open(CONTROL/'driver.stdout',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb')
stderr=os.fdopen(os.open(CONTROL/'driver.stderr',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb')
launcher=observation(os.getpid());process=subprocess.Popen(command,cwd=CHECKOUT,env=env,stdin=subprocess.DEVNULL,stdout=stdout,stderr=stderr,start_new_session=True)
wrapper_obs=observation(process.pid);assert wrapper_obs is not None and wrapper_obs['immutableIdentity']['session']==process.pid
wrapper_fd=os.pidfd_open(process.pid)
put('launch.json',{'at':now(),'launcher':launcher,'wrapper':wrapper_obs,'wrapperPidfdOpened':True,'controlDirectory':str(CONTROL)})
print(json.dumps({'controlDirectory':str(CONTROL),'wrapper':wrapper_obs,'launcher':launcher}),flush=True)
resources={};last={};events_seen=0;deadline=time.monotonic()+600
def ingest():
    global events_seen
    p=PREFIX/'lifecycle/driver-events.ndjson'
    if not p.exists():return
    b=p.read_bytes();assert len(b)<=16*1024*1024
    lines=b.splitlines()
    if b and not b.endswith(b'\n'):lines=lines[:-1]
    for line in lines[events_seen:]:
        event=json.loads(line)
        if event.get('action')=='registered native resource':
            immutable=event['immutableIdentity'];key=(immutable['pid'],immutable['startTicks'])
            current=observation(immutable['pid']);fd=None
            if current is not None and current['immutableIdentity']==immutable and current['state'] not in ('Z','X'):
                try:
                    fd=os.pidfd_open(immutable['pid']);again=observation(immutable['pid'])
                    if again is None or again['immutableIdentity']!=immutable:os.close(fd);fd=None
                except ProcessLookupError:pass
            resources[key]={'registeredIdentity':event['identity'],'immutableIdentity':immutable,'family':event['family'],'pidfd':fd,'firstIndependentObservation':current}
            note({'action':'remembered registered native resource','family':event['family'],'registeredImmutableIdentity':immutable,'actualObservation':current,'pidfdOpened':fd is not None})
    events_seen=len(lines)
    for key,record in resources.items():
        current=observation(key[0])
        if current!=last.get(key):
            note({'action':'actual remembered resource observation changed','registeredImmutableIdentity':record['immutableIdentity'],'current':current})
            last[key]=current
while process.poll() is None and time.monotonic()<deadline:
    ingest();time.sleep(.25)
ingest();code=process.poll();stdout.close();stderr.close()
after=protected(a);final=[]
for key,record in resources.items():
    current=observation(key[0]);matches=current is not None and current['immutableIdentity']==record['immutableIdentity']
    ready=None
    if record['pidfd'] is not None:
        poll=select.poll();poll.register(record['pidfd'],select.POLLIN|select.POLLHUP|select.POLLERR|select.POLLNVAL);ready=poll.poll(0)
    final.append({k:v for k,v in record.items() if k!='pidfd'}|{'finalActualObservation':current,'rememberedIdentityStillLive':matches and current['state'] not in ('Z','X'),'independentPidfdEvents':ready})
private={'5373':listeners(5373),'5374':listeners(5374)}
value={'schema':'feature63-r2-private-launcher-closure-v1','at':now(),'wrapperExitCode':code,'wrapperInitial':wrapper_obs,'wrapperFinalActualObservation':observation(process.pid),'rememberedResources':final,'protectedBefore':before,'protectedAfter':after,'privateListenersAfter':private,'allRememberedRegisteredIdentitiesNotLive':all(not r['rememberedIdentityStillLive'] for r in final),'privateListenersAbsent':all(not v for v in private.values()),'unobservedDescendantsExcluded':False,'rootNativeLifetimeDispositionRequired':True,'noSignalsSentByLauncher':True,'databaseContentReadHashedCopiedSealedOrAuditedByLauncher':False,'automaticRetries':0}
put('independent-closure.json',value)
for r in resources.values():
    if r['pidfd'] is not None:os.close(r['pidfd'])
os.close(wrapper_fd)
print(json.dumps({'wrapperExitCode':code,'independentClosure':str(CONTROL/'independent-closure.json'),'allRememberedRegisteredIdentitiesNotLive':value['allRememberedRegisteredIdentitiesNotLive'],'privateListenersAbsent':value['privateListenersAbsent']}),flush=True)

