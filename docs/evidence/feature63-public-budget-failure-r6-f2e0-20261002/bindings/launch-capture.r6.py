import datetime,hashlib,json,os,pathlib,select,stat,subprocess,time
Path=pathlib.Path
ROOT_RUNTIME_ANCHORS_FILLED=True
CONTROL=Path('/tmp/ovf-feature63-r6-capture-control-2crngtsw')
CHECKOUT=pathlib.Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
PREFIX=CHECKOUT/'work/feature63-human-wave-composition-r6'
ASSIGNMENT=Path('/tmp/ovf-root-feature63-r6-bindings-xyvt_n02/capture-assignment.json')
DIGEST='470e711127a4bb12c9e00e30a06a97529e2bd0e46ade9d1da6d637f1931210e5'
DISPOSITION=Path('/tmp/ovf-root-feature63-r6-bindings-xyvt_n02/root-capture-disposition.json')
DISPOSITION_SHA='06e2eb935c28da4a34b42634162e4d14c616dc3797058de41be3d13fea5331c5'
PIN='f2e0025937b8caf5dc8f6f9f3de134d92a2d547a'
SLOT_TOKEN='heavy-runtime-1-feature63-r6-f2e0025937b8-xyvt_n02'
WRAPPER_SHA='04bd5e0f8ddeb9633324d72be1eeb7c266a73ec074cb287e1bd641f4cdf579db'
# This static template has no filled runtime authority and must not be invoked.
def require(ok,message):
    if not ok:raise RuntimeError(message)
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
def pidfd_live(fd):
    poller = select.poll()
    poller.register(fd, select.POLLIN | select.POLLHUP | select.POLLERR | select.POLLNVAL)
    ready = poller.poll(0)
    require(not any(flags & (select.POLLERR | select.POLLNVAL) for _fd, flags in ready),
            'Bound pidfd is invalid')
    return not ready

def managed_process_observation(record):
    # Admitted lifetime ownership is separate from mutable process context.
    pid = record['lifetimeIdentity']['pid']
    p = Path('/proc') / str(pid)
    unavailable = []

    def read_stat():
        try:
            raw = (p / 'stat').read_text()
            fields = raw[raw.rfind(')') + 2:].split()
            return None if fields[0] in ('Z', 'X') else fields
        except (FileNotFoundError, ProcessLookupError):
            return None

    def read_link(name, phase):
        try:
            return os.readlink(p / name)
        except OSError as error:
            unavailable.append({'field': name, 'phase': phase, 'error': type(error).__name__})
            return None

    before = read_stat()
    if before is None:
        return None
    context_before = {'session': int(before[3]), 'executable': read_link('exe', 'before'),
                      'cwd': read_link('cwd', 'before')}
    try:
        raw = (p / 'cmdline').read_bytes()
    except OSError as error:
        unavailable.append({'field': 'cmdline', 'phase': 'single read', 'error': type(error).__name__})
        raw = None
    context_after = {'executable': read_link('exe', 'after'), 'cwd': read_link('cwd', 'after')}
    after = read_stat()
    if after is None:
        return None
    context_after['session'] = int(after[3])
    argv = None if raw is None else [part.decode(errors='replace') for part in raw.split(b'\0') if part]
    kernel_before = {'pid': pid, 'startTicks': int(before[19])}
    kernel_after = {'pid': pid, 'startTicks': int(after[19])}
    current = {**kernel_after, **context_after}
    return {'observedAt': now(), 'identity': {**kernel_after, 'executable': context_after['executable'],
            'cwd': context_after['cwd'], 'argv': argv}, 'immutableIdentity': current,
            'kernelBefore': kernel_before, 'kernelAfter': kernel_after,
            'mutableSnapshots': {'before': context_before, 'after': context_after},
            'ambiguity': {'mutableContextChanged': context_before != context_after,
                          'unavailableFields': unavailable},
            'cmdline': {'nulBytesHex': None if raw is None else raw.hex(), 'nulSeparatedArgv': argv}}

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
assert ROOT_RUNTIME_ANCHORS_FILLED is True, 'Inactive r3 launcher template; no runtime authority is filled'
assert isinstance(CONTROL,Path) and isinstance(ASSIGNMENT,Path) and isinstance(DISPOSITION,Path)
assert all(isinstance(v,str) and v for v in (DIGEST,DISPOSITION_SHA,PIN,SLOT_TOKEN,WRAPPER_SHA))
assert SLOT_TOKEN.startswith('heavy-runtime-1-feature63-r6-')
raw=ASSIGNMENT.read_bytes();assert hashlib.sha256(raw).hexdigest()==DIGEST;a=json.loads(raw)
dis=DISPOSITION.read_bytes();assert hashlib.sha256(dis).hexdigest()==DISPOSITION_SHA;d=json.loads(dis)
assert a['approved'] is True and a['phase']=='capture' and a['sourcePin']==PIN and a['assignedBy']=='/root'
assert d['captureAdmitted'] is True and d['slotExclusivelyAssignedTo']=='/root/ai_modes' and d['noAutomaticRetryAuthorized'] is True
assert a['exclusiveHeavyApproval']['token']==SLOT_TOKEN and a['freshPrefix']=='work/feature63-human-wave-composition-r6'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=CHECKOUT,text=True).strip()==PIN
assert subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=CHECKOUT,text=True)==''
assert {p.name for p in PREFIX.iterdir()}=={'dist','server'}
wrapper=CHECKOUT/'scripts/feature63/run-minimal63.py';assert hashlib.sha256(wrapper.read_bytes()).hexdigest()==a['wrapperSha256']==WRAPPER_SHA
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
resources={};last={};family_original_sessions={};events_seen=0;deadline=time.monotonic()+600

def pidfd_events(fd):
    poller=select.poll();poller.register(fd,select.POLLIN|select.POLLHUP|select.POLLERR|select.POLLNVAL)
    return poller.poll(0)

def unbound_pid_start_observation(record):
    # No held PIDFD: only bounded PID/start readback, never executable/cwd/SID equality.
    pid=record['lifetimeIdentity']['pid'];p=Path('/proc')/str(pid)
    try:
        first=(p/'stat').read_text();one=first[first.rfind(')')+2:].split()
        last=(p/'stat').read_text();two=last[last.rfind(')')+2:].split()
    except (FileNotFoundError,ProcessLookupError):return None
    require(one[19]==two[19],'Unbound PID/start changed during independent observation')
    return {'pid':pid,'startTicks':int(two[19]),'state':two[0],'observedSession':int(two[3])}

def independent_lifetime(record):
    fd=record['pidfd'];expected=record['lifetimeIdentity']
    if fd is None:
        value=unbound_pid_start_observation(record)
        same=value is not None and {'pid':value['pid'],'startTicks':value['startTicks']}==expected
        return {'actualObservation':value,'rememberedIdentityStillLive':same,
                'evidenceScope':'NO_INDEPENDENT_HELD_PIDFD_BOUNDED_PID_START_OBSERVATION',
                'independentPidfdEvents':None,'observationFailure':None}
    value=None;before_live=None;after_live=None
    try:
        before_live=pidfd_live(fd)
        if not before_live:
            return {'actualObservation':None,'rememberedIdentityStillLive':False,
                    'evidenceScope':'INDEPENDENT_HELD_PIDFD_READY_EXIT',
                    'independentPidfdEvents':pidfd_events(fd),'observationFailure':None}
        value=managed_process_observation(record)
        if value is None:
            if not pidfd_live(fd):
                return {'actualObservation':None,'rememberedIdentityStillLive':False,
                        'evidenceScope':'INDEPENDENT_HELD_PIDFD_READY_DURING_OBSERVATION',
                        'independentPidfdEvents':pidfd_events(fd),'observationFailure':None}
            require(False,'Independent managed snapshot unavailable while held PIDFD remains live; never classify as exit')
        require(value['kernelBefore']==value['kernelAfter']==expected,
                'Independent managed PID/start observation differs from registered lifetime')
        if record['directRoot']:
            require(value['mutableSnapshots']['before']['session']==value['mutableSnapshots']['after']['session']==
                    record['originalAdmittedSession']==expected['pid'],
                    'Independent direct-root reserved session changed; observation failure, never exit')
        after_live=pidfd_live(fd)
        return {'actualObservation':value,'rememberedIdentityStillLive':after_live,
                'evidenceScope':'INDEPENDENT_HELD_PIDFD_AND_PID_START',
                'independentPidfdEvents':pidfd_events(fd),'observationFailure':None}
    except (RuntimeError,OSError,ValueError) as error:
        # Failure is retained conservatively. It cannot produce a false closure.
        return {'actualObservation':value,'rememberedIdentityStillLive':True,
                'evidenceScope':'INCONCLUSIVE_HELD_PIDFD_OBSERVATION_FAILURE',
                'independentPidfdEvents':None,'observationFailure':{'type':type(error).__name__,'message':str(error),
                  'lifetimeIdentity':expected,'originalAdmittedSession':record['originalAdmittedSession'],
                  'directRoot':record['directRoot'],'actualObservation':value,
                  'pidfdLiveBeforeObservation':before_live,'pidfdLiveAfterObservation':after_live}}

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
            immutable=event['immutableIdentity'];lifetime=event['lifetimeIdentity'];family=event['family']
            original_session=event['originalAdmittedSession'];direct=event['directRoot']
            require(set(lifetime)=={'pid','startTicks'} and lifetime=={k:immutable[k] for k in ('pid','startTicks')},
                    'Registered lifetime fields differ from historical identity')
            require(lifetime=={k:event['identity'][k] for k in ('pid','startTicks')},'Registered source identity lifetime differs')
            require(type(original_session) is int and type(direct) is bool,'Registered session/direct-root fields differ')
            if direct:
                require(original_session==lifetime['pid'] and family not in family_original_sessions,
                        'Source direct-root original session admission differs or repeats')
                family_original_sessions[family]=original_session
            require(family in family_original_sessions and original_session==family_original_sessions[family],
                    'New resource lacks source-admitted original owned session')
            # Source event is emitted only after wrapper admission. Historical tuple SID can differ
            # from originalAdmittedSession if a new descendant changed SID during first binding.
            # Delayed independent PIDFD binding never demands mutable context equality/current SID.
            key=(lifetime['pid'],lifetime['startTicks']);require(key not in resources,'Registered lifetime event repeated')
            record={'registeredIdentity':event['identity'],'immutableIdentity':immutable,'lifetimeIdentity':lifetime,
                    'originalAdmittedSession':original_session,'directRoot':direct,'admitted':True,'family':family,
                    'pidfd':None,'firstIndependentObservation':None,'independentPidfdOpenedWhileLive':False}
            current=managed_process_observation(record)
            record['firstIndependentObservation']=current
            if current is not None and current['kernelBefore']==current['kernelAfter']==lifetime:
                try:record['pidfd']=os.pidfd_open(lifetime['pid'])
                except ProcessLookupError:pass
                if record['pidfd'] is not None:
                    first=independent_lifetime(record)
                    record['firstIndependentLifetimeReadback']=first
                    record['independentPidfdOpenedWhileLive']=(first['rememberedIdentityStillLive'] and first['observationFailure'] is None)
                    if not record['independentPidfdOpenedWhileLive']:
                        # Never keep an FD whose post-open PID/start binding was not established.
                        os.close(record['pidfd']);record['pidfd']=None
            resources[key]=record
            note({'action':'remembered registered native resource','family':family,'registeredImmutableIdentity':immutable,
                  'lifetimeIdentity':lifetime,'originalAdmittedSession':original_session,'directRoot':direct,
                  'actualObservation':current,'pidfdOpened':record['pidfd'] is not None,
                  'independentPidfdOpenedWhileLive':record['independentPidfdOpenedWhileLive']})
    events_seen=len(lines)
    for key,record in resources.items():
        current=independent_lifetime(record)
        snapshot=dict(current)
        if isinstance(snapshot.get('actualObservation'),dict):
            snapshot['actualObservation']={k:v for k,v in snapshot['actualObservation'].items() if k!='observedAt'}
        if snapshot!=last.get(key):
            note({'action':'actual remembered lifetime observation changed','registeredImmutableIdentity':record['immutableIdentity'],
                  'lifetimeIdentity':record['lifetimeIdentity'],'originalAdmittedSession':record['originalAdmittedSession'],
                  'directRoot':record['directRoot'],'current':current})
            last[key]=snapshot
while process.poll() is None and time.monotonic()<deadline:
    ingest();time.sleep(.25)
ingest();code=process.poll();stdout.close();stderr.close()
after=protected(a);final=[]
for key,record in resources.items():
    current=independent_lifetime(record)
    final.append({k:v for k,v in record.items() if k!='pidfd'}|{'finalActualObservation':current['actualObservation'],
                  'rememberedIdentityStillLive':current['rememberedIdentityStillLive'],
                  'lifetimeEvidenceScope':current['evidenceScope'],'independentPidfdEvents':current['independentPidfdEvents'],
                  'observationFailure':current['observationFailure']})
wrapper_record={'pidfd':wrapper_fd,'admitted':True,'directRoot':True,'family':'wrapper',
                'lifetimeIdentity':{k:wrapper_obs['identity'][k] for k in ('pid','startTicks')},
                'originalAdmittedSession':wrapper_obs['immutableIdentity']['session'],
                'immutableIdentity':wrapper_obs['immutableIdentity']}
wrapper_final=independent_lifetime(wrapper_record)
private={'5373':listeners(5373),'5374':listeners(5374)}
value={'schema':'feature63-r3-private-launcher-closure-v1','at':now(),'wrapperExitCode':code,
       'wrapperInitial':wrapper_obs,'wrapperFinalActualObservation':wrapper_final['actualObservation'],
       'wrapperLifetimeReadback':wrapper_final,'rememberedResources':final,'protectedBefore':before,'protectedAfter':after,
       'privateListenersAfter':private,
       'allRememberedRegisteredIdentitiesNotLive':all(not r['rememberedIdentityStillLive'] for r in final),
       'everyRememberedLifetimeObservationComplete':all(r['observationFailure'] is None for r in final),
       'privateListenersAbsent':all(not v for v in private.values()),'unobservedDescendantsExcluded':False,
       'rootNativeLifetimeDispositionRequired':True,'noSignalsSentByLauncher':True,
       'databaseContentReadHashedCopiedSealedOrAuditedByLauncher':False,'automaticRetries':0}
put('independent-closure.json',value)
for r in resources.values():
    if r['pidfd'] is not None:os.close(r['pidfd'])
os.close(wrapper_fd)
print(json.dumps({'wrapperExitCode':code,'independentClosure':str(CONTROL/'independent-closure.json'),
                 'allRememberedRegisteredIdentitiesNotLive':value['allRememberedRegisteredIdentitiesNotLive'],
                 'privateListenersAbsent':value['privateListenersAbsent']}),flush=True)
