#!/usr/bin/env python3
from pathlib import Path
import hashlib
import json
import os
import stat

OUT = Path('/tmp/feature63-r8-custody-expectation-candidate.a01Nf3yA')
ROOT = Path('/home/morgana/Projects/orcs-vs-Fairies')
OWNED = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
BINDINGS = Path('/tmp/ovf-root-feature63-r8-bindings-8v654jsk')
CONTROL = Path('/tmp/ovf-feature63-r8-capture-control-hsx9sgil')
PREFIX = OWNED / 'work/feature63-human-wave-composition-r8'
PRELAUNCH = Path('/tmp/ovf-feature63-r8-prelaunch-report-16s9_ezc/root-independent-prelaunch-readback.json')
STATIC = Path('/tmp/feature63-r8-custody-candidate.HXh6JaEg')
GUIDE = Path('/tmp/feature63-r8-custody-field-guide.eYIwQAAP')
PACKAGE = BINDINGS / 'root-fresh-package-result.json'
SOURCE_PIN = 'd28190fcd376156d6af016cd62fab8915d719fa7'
UTILITY_SHA = '8d913e9e3936170156162c23b917eeaa5c2e2a03ea48a0e136ab0a88a8b52939'
MATCH_ID = '290ede87-8469-42d7-bb74-0fb730e584e2'
RAW_PATH = PREFIX / 'server-data/server.sqlite'

AUTHORITY_PATHS = {
    'captureAssignment': BINDINGS / 'capture-assignment.json',
    'prelaunchReadback': PRELAUNCH,
    'independentClosure': CONTROL / 'independent-closure.json',
    'launch': CONTROL / 'launch.json',
    'captureAssignmentActual': CONTROL / 'capture-assignment.actual.json',
    'command': CONTROL / 'command.json',
    'captureLaunchConsumed': CONTROL / 'capture-launch-consumed.json',
    'captureResult': PREFIX / 'lifecycle/driver-result.json',
    'serverOwnership': PREFIX / 'lifecycle/server-ownership.json',
    'driverEvents': PREFIX / 'lifecycle/driver-events.ndjson',
    'sourceBinding': BINDINGS / 'source-binding.json',
    'buildBinding': BINDINGS / 'build-binding.json',
    'browserBinding': BINDINGS / 'browser-binding.json',
    'productInventory': Path('/tmp/ovf-main402-remaining-2e5-r1/tested-product-before.json'),
    'protectedInventory': Path('/tmp/ovf-main402-remaining-2e5-r1/protected-before.json'),
}
KNOWN_LIFECYCLE_SHA = {
    'independentClosure': '6a88075ce715da26cf2f5c307d3c926d8cda2028b30fa6513cf84bd20a2cb9fd',
    'launch': '949298f4cf10b837c5a750ce0ef091bd3fd9b83c7caa74dea2f179abb8149017',
    'captureAssignmentActual': '7b41320eb1f25651e5c73ad208159e9cdf705bd3cdf96d05da657a62eb6641ff',
    'command': 'b2d825e469238ae9280b654225055759623a0f9cc1f2a0f1b15045a22530c8ff',
    'captureLaunchConsumed': '7e145a12e54e4e894420e2d66d4d918e2ffd1ba47f7dc5b595b05afeffa070b8',
    'captureResult': 'b637ccd3643e7fc0ef010c12ada0a7f891938b8167086ff254d2b62a808e8500',
    'serverOwnership': 'f2eb74f4429d1e0dd834782ec3b6920a21c9a2d9d33a6866fe138671c73127aa',
    'driverEvents': '307500ec25fb08767e804ccec8bfeef447cc46ba2826ac3e671576ad257c2697',
}

def require(condition, message):
    if not condition:
        raise RuntimeError(message)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def signature(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns, info.st_mode, info.st_nlink)

def stable_read(path, cap=512 * 1024 * 1024):
    require(path.is_absolute() and path.resolve() == path and not path.is_symlink(), f'noncanonical input: {path}')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1, f'input metadata differs: {path}')
        require(0 <= before.st_size <= cap, f'input too large: {path}')
        parts=[]
        remaining=before.st_size
        while remaining:
            chunk=os.read(fd,min(remaining,1024*1024))
            require(chunk, f'short read: {path}')
            parts.append(chunk)
            remaining -= len(chunk)
        require(os.read(fd,1) == b'', f'input grew: {path}')
        after=os.fstat(fd)
        named=path.lstat()
        require(signature(before)==signature(after)==signature(named), f'input changed: {path}')
        raw=b''.join(parts)
        return raw, before
    finally:
        os.close(fd)

def reject_pairs(pairs):
    value={}
    for key,item in pairs:
        require(key not in value, f'duplicate JSON key: {key}')
        value[key]=item
    return value

def parse(raw):
    return json.loads(raw.decode('utf-8'), object_pairs_hook=reject_pairs,
                      parse_constant=lambda item: (_ for _ in ()).throw(RuntimeError(f'nonfinite JSON: {item}')))

def descriptor(path, raw):
    return {'path': str(path), 'bytes': len(raw), 'sha256': sha(raw)}

def full_descriptor(path, raw, info):
    return {**descriptor(path,raw), 'mode': f'{stat.S_IMODE(info.st_mode):04o}', 'device': info.st_dev,
            'inode': info.st_ino, 'linkCount': info.st_nlink, 'stableSingleFdRead': True}

def write_json(path, value):
    raw=(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False)+'\n').encode()
    path.write_bytes(raw)
    return raw

def key_from_record(record):
    life=record['lifetimeIdentity']
    return (record['family'], life['pid'], life['startTicks'], record['originalAdmittedSession'], record['directRoot'])

def key_object(key):
    return {'family': key[0], 'pid': key[1], 'startTicks': key[2],
            'originalAdmittedSession': key[3], 'directRoot': key[4]}

schema_raw,schema_info=stable_read(STATIC/'expectation-schema.json')
utility_raw,utility_info=stable_read(STATIC/'fresh-r8-custody.py')
review_raw,review_info=stable_read(Path('/tmp/feature63-r8-custody-static-review-autosave-repair-admission-6sjliizz/review.json'))
field_map_raw,field_map_info=stable_read(GUIDE/'field-map.json')
package_raw,package_info=stable_read(PACKAGE)
require(sha(schema_raw)=='22fcf623fffd8509cbc2e0c11e36ee6a12fbd376fd286d796b678661cc7b0e03','schema digest differs')
require(sha(utility_raw)==UTILITY_SHA,'utility digest differs')
require(sha(review_raw)=='68efd3b01dc2203393953d1ddb65451f514e80c5ceaef83c5bfa9a27d071c328','review digest differs')
schema=parse(schema_raw); field_map=parse(field_map_raw); package=parse(package_raw)
require(schema['topLevelExactKeys']==['schema','approved','assignedBy','branch','sourcePin','utilitySha256','roots','paths','authority','expected','outputParent'],'schema top-level order differs')
require(schema['authorityExactKeys']==list(AUTHORITY_PATHS),'schema authority order differs')

raws={}; infos={}; values={}; authority={}
for name,path in AUTHORITY_PATHS.items():
    raw,info=stable_read(path)
    raws[name]=raw; infos[name]=info; authority[name]=descriptor(path,raw)
    if name!='driverEvents': values[name]=parse(raw)

for name,digest in KNOWN_LIFECYCLE_SHA.items():
    require(authority[name]['sha256']==digest, f'{name} completed digest differs')
known=field_map['topLevel']['fields']['authority']['knownNow']
for name in ('captureAssignment','prelaunchReadback','sourceBinding','buildBinding','browserBinding','productInventory','protectedInventory'):
    require(authority[name]==known[name], f'{name} frozen descriptor differs')
require(raws['captureAssignmentActual']==raws['captureAssignment'],'actual assignment bytes differ')
assignment=values['captureAssignment']; prelaunch=values['prelaunchReadback']; closure=values['independentClosure']
launch=values['launch']; command=values['command']; consumed=values['captureLaunchConsumed']
capture=values['captureResult']; server=values['serverOwnership']
require(assignment['sourcePin']==SOURCE_PIN and assignment['phase']=='capture' and assignment['approved'] is True,'capture assignment differs')
for name in ('sourceBinding','buildBinding','browserBinding'):
    require(assignment[name]==authority[name], f'assignment {name} descriptor differs')
require(package['productInventoryOriginal']=={**authority['productInventory'],'gitPath':package['productInventoryOriginal']['gitPath']} or False,'product inventory package descriptor differs')
require(package['protectedInventoryOriginal']=={**authority['protectedInventory'],'gitPath':package['protectedInventoryOriginal']['gitPath']} or False,'protected inventory package descriptor differs')
require(prelaunch['status']=='PASS_ROOT_EXPECTATION_BOUND_R8_PRELAUNCH_AUTHENTICATION_ONLY' and prelaunch['sourcePin']==SOURCE_PIN and prelaunch['allBoundFilesAuthenticatedWithStableSingleFdReads'] is True,'prelaunch readback differs')
require({k:prelaunch['assignment'][k] for k in ('path','bytes','sha256')}==authority['captureAssignment'],'prelaunch assignment readback differs')
require(capture['schema']=='feature63-dedicated-capture-result-v1' and capture['status']=='CAPTURE_PASS_ROOT_SEAL_AND_EXTRACTION_PENDING','capture status differs')
require(capture['sourcePin']==SOURCE_PIN and capture['matchId']==MATCH_ID and capture['firstFailure'] is None,'capture identity differs')
require(capture['cleanupFailures']==[] and capture['automaticRetries']==0 and capture['protectedFinalReadback']['status']=='PASS','capture completion differs')
require(closure['schema']=='feature63-r3-private-launcher-closure-v1' and closure['wrapperExitCode']==0 and closure['automaticRetries']==0,'closure result differs')
require(closure['allRememberedRegisteredIdentitiesNotLive'] is True and closure['everyRememberedLifetimeObservationComplete'] is True and closure['privateListenersAbsent'] is True and closure['unobservedDescendantsExcluded'] is False,'closure summary differs')
require(launch['wrapper']==closure['wrapperInitial'] and launch['controlDirectory']==str(CONTROL) and launch['wrapperPidfdOpened'] is True,'launch/closure wrapper readback differs')
require(consumed['assignmentSha256']==authority['captureAssignment']['sha256'] and consumed['automaticRetries']==0 and consumed['captureInvocations']==1,'capture consumption differs')
require(command['sourcePin']==SOURCE_PIN and command['cwd']==str(OWNED) and command['environmentAnchor']['OVF_FEATURE63_WRAPPER_ASSIGNMENT_SHA256']==consumed['assignmentSha256'],'command chain differs')
require(server['schema']=='feature63-owned-server-v1' and server['sourcePin']==SOURCE_PIN and server['freshPrefix']=='work/feature63-human-wave-composition-r8','server ownership differs')
require(capture['closedFreshDatabaseIdentity']==server['freshDatabase'],'result/server raw identity differs')
raw_identity=server['freshDatabase']
require(raw_identity=={'device':52,'inode':43333851,'path':str(RAW_PATH)},'declared raw identity differs')
raw_stat=os.stat(RAW_PATH, follow_symlinks=False)
require(stat.S_ISREG(raw_stat.st_mode) and raw_stat.st_dev==52 and raw_stat.st_ino==43333851,'raw stat identity differs')
require(raw_stat.st_size==130916352 and stat.S_IMODE(raw_stat.st_mode)==0o644 and raw_stat.st_nlink==1,'raw stat metadata differs')

registered=[]
for line_number,line in enumerate(raws['driverEvents'].splitlines(),1):
    if not line: continue
    event=parse(line)
    if event.get('action')=='registered native resource': registered.append(key_from_record(event))
require(len(registered)==25 and len(set(registered))==25,'registered driver keys differ')
remembered=closure['rememberedResources']
closure_keys=[key_from_record(row) for row in remembered]
require(len(closure_keys)==25 and len(set(closure_keys))==25 and set(closure_keys)==set(registered),'driver/closure key set differs')
require(closure_keys==registered,'driver/closure key order differs')
require(all(row['rememberedIdentityStillLive'] is False and row['observationFailure'] is None and row['independentPidfdOpenedWhileLive'] is True and bool(row['independentPidfdEvents']) for row in remembered),'remembered resource closure differs')
launcher_lifetime={k:launch['launcher']['identity'][k] for k in ('pid','startTicks')}
wrapper_lifetime={k:launch['wrapper']['identity'][k] for k in ('pid','startTicks')}
require(launcher_lifetime=={'pid':1957316,'startTicks':11606863},'launcher lifetime differs')
require(wrapper_lifetime=={'pid':1957341,'startTicks':11606865},'wrapper lifetime differs')

candidate={
 'schema':'feature63-r8-custody-expectation-v1',
 'approved':False,
 'assignedBy':'/root',
 'branch':'success',
 'sourcePin':SOURCE_PIN,
 'utilitySha256':UTILITY_SHA,
 'roots':{'root':str(ROOT),'owned':str(OWNED)},
 'paths':{'bindingsRoot':str(BINDINGS),'controlRoot':str(CONTROL),'freshPrefix':'work/feature63-human-wave-composition-r8'},
 'authority':authority,
 'expected':{
   'matchId':MATCH_ID,
   'wrapperExitCode':closure['wrapperExitCode'],
   'firstFailure':capture['firstFailure'],
   'registeredNativeKeys':[key_object(k) for k in registered],
   'launcherLifetime':launcher_lifetime,
   'wrapperLifetime':wrapper_lifetime,
   'rawIdentity':{'path':raw_identity['path'],'device':raw_identity['device'],'inode':raw_identity['inode']},
 },
 'outputParent':'/tmp',
}
require(list(candidate)==schema['topLevelExactKeys'],'candidate top-level order differs')
require(list(candidate['authority'])==schema['authorityExactKeys'],'candidate authority order differs')
require(list(candidate['expected'])==schema['expectedExactKeys'],'candidate expected order differs')

checks=[
 ('schema_and_exact_key_order',True),('all_15_authority_files_stable_single_fd_read',len(authority)==15),
 ('frozen_known_descriptors_match',True),('completed_lifecycle_hashes_match',True),
 ('assignment_actual_bytes_equal_binding_assignment',raws['captureAssignmentActual']==raws['captureAssignment']),
 ('assignment_binding_descriptors_match',True),('prelaunch_assignment_readback_matches',True),
 ('capture_pass_and_protected_readback_pass',True),('capture_source_pin_and_match_id_match',True),
 ('no_retry_cleanup_or_first_failure',True),('launch_wrapper_matches_closure_wrapper',True),
 ('wrapper_and_launcher_lifetimes_derived',True),('driver_registered_key_count_unique',len(registered)==len(set(registered))==25),
 ('driver_and_closure_registered_key_order_match',registered==closure_keys),
 ('all_remembered_identities_closed',True),('result_server_and_lstat_raw_identity_match',True),
 ('raw_database_access_limited_to_lstat',True),('candidate_unapproved',candidate['approved'] is False),
]
comparison={
 'schema':'feature63-r8-custody-expectation-comparison-v1','status':'PASS',
 'sourcePin':SOURCE_PIN,'matchId':MATCH_ID,'authorityCount':15,'registeredNativeKeyCount':25,
 'checks':[{'name':name,'passed':passed} for name,passed in checks],
 'rawDatabaseRead':False,'rawDatabaseStat':{'path':str(RAW_PATH),'bytes':raw_stat.st_size,'mode':f'{stat.S_IMODE(raw_stat.st_mode):04o}','device':raw_stat.st_dev,'inode':raw_stat.st_ino,'linkCount':raw_stat.st_nlink},
}
require(all(row['passed'] for row in comparison['checks']),'comparison failed')
provenance={
 'schema':'feature63-r8-custody-expectation-field-provenance-v1','status':'PASS_NON_AUTHORIZING_CANDIDATE',
 'candidateApproval':False,'outputParentSelection':{'value':'/tmp','selectedBy':'/root'},
 'authority':{name:{'derivation':'stable single-FD read of completed metadata bytes','source':str(AUTHORITY_PATHS[name]),'comparisons':['descriptor bytes and SHA-256 reauthenticated']}
              for name in AUTHORITY_PATHS},
 'expected':{
   'matchId':{'value':MATCH_ID,'sources':['captureResult.matchId']},
   'wrapperExitCode':{'value':0,'sources':['independentClosure.wrapperExitCode']},
   'firstFailure':{'value':None,'sources':['captureResult.firstFailure','captureResult.status']},
   'registeredNativeKeys':{'count':25,'sources':['driverEvents registered native resource rows','independentClosure.rememberedResources'],'comparison':'ordered lists and unique key sets equal'},
   'launcherLifetime':{'value':launcher_lifetime,'sources':['launch.launcher.identity']},
   'wrapperLifetime':{'value':wrapper_lifetime,'sources':['launch.wrapper.identity','independentClosure.wrapperInitial.identity']},
   'rawIdentity':{'value':candidate['expected']['rawIdentity'],'sources':['captureResult.closedFreshDatabaseIdentity','serverOwnership.freshDatabase','raw database lstat'],'databaseContentRead':False},
 },
 'static':{'schema':descriptor(STATIC/'expectation-schema.json',schema_raw),'utility':descriptor(STATIC/'fresh-r8-custody.py',utility_raw),'independentReview':descriptor(Path('/tmp/feature63-r8-custody-static-review-autosave-repair-admission-6sjliizz/review.json'),review_raw)},
}
input_descriptors={
 'schema':'feature63-r8-custody-expectation-input-descriptors-v1','status':'PASS',
 'authority':{name:full_descriptor(AUTHORITY_PATHS[name],raws[name],infos[name]) for name in AUTHORITY_PATHS},
 'reviewedStatic':{
  'expectationSchema':full_descriptor(STATIC/'expectation-schema.json',schema_raw,schema_info),
  'utility':full_descriptor(STATIC/'fresh-r8-custody.py',utility_raw,utility_info),
  'independentReview':full_descriptor(Path('/tmp/feature63-r8-custody-static-review-autosave-repair-admission-6sjliizz/review.json'),review_raw,review_info),
  'fieldMap':full_descriptor(GUIDE/'field-map.json',field_map_raw,field_map_info),
  'packageReceipt':full_descriptor(PACKAGE,package_raw,package_info),
 },
 'rawDatabase':{'path':str(RAW_PATH),'bytes':raw_stat.st_size,'mode':f'{stat.S_IMODE(raw_stat.st_mode):04o}','device':raw_stat.st_dev,'inode':raw_stat.st_ino,'linkCount':raw_stat.st_nlink,'access':'lstat only'},
}
artifacts={}
for filename,value in (
 ('custody-expectation.candidate.json',candidate),('field-provenance.json',provenance),
 ('comparison.json',comparison),('input-descriptors.json',input_descriptors)):
 raw=write_json(OUT/filename,value); artifacts[filename]=descriptor(OUT/filename,raw)
builder_raw=(OUT/'build-candidate.py').read_bytes()
artifacts['build-candidate.py']=descriptor(OUT/'build-candidate.py',builder_raw)
manifest={'schema':'feature63-r8-custody-expectation-candidate-manifest-v1','status':'PASS_NON_AUTHORIZING_CANDIDATE','approved':False,'artifactDirectory':str(OUT),'artifacts':artifacts}
write_json(OUT/'manifest.json',manifest)
for path in OUT.iterdir(): path.chmod(0o444)
print(str(OUT))
