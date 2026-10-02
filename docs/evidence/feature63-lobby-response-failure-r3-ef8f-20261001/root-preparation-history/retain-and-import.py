from pathlib import Path
import ast, datetime, hashlib, json, os, shutil, stat, subprocess, sys
ROOT=Path('/home/morgana/Projects/orcs-vs-Fairies')
OUT=Path(__file__).parent
STATIC=Path('/tmp/ovf-feature63-static-prep-r3-zsttudqb')
EXECUTION=Path(sys.argv[1])
GENERATOR=Path(sys.argv[2])
TARGET=ROOT/'docs/evidence/feature63-lifetime-crashpad-r3-preparation-20261001'
assert not TARGET.exists()
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()=='ad1313cd65cfb5c330c82467ea8d26bc136e4f11'
assert not subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def records(base):
 result=[]
 for p in sorted(base.rglob('*')):
  assert not p.is_symlink(),p
  if p.is_dir():continue
  s=p.stat();assert stat.S_ISREG(s.st_mode),p
  result.append({'path':str(p.relative_to(base)),'bytes':s.st_size,'sha256':sha(p.read_bytes()),'mode':stat.S_IMODE(s.st_mode)})
 return sorted(result,key=lambda r:r['path'])
def authenticate_seal(base,expected=None):
 p=base/'final-static-seal-r3.json';raw=p.read_bytes()
 if expected:assert sha(raw)==expected
 rows=json.loads(raw)['records']
 assert records(base)==sorted(rows+[{'path':p.name,'bytes':len(raw),'sha256':sha(raw),'mode':stat.S_IMODE(p.stat().st_mode)}],key=lambda r:r['path'])
 return {'path':str(p),'bytes':len(raw),'sha256':sha(raw)}
old=authenticate_seal(STATIC/'packet','733a21a32c8ae251161ac6af8ba8118a2283c645b0063cc670b09e50fd569dac')
new=authenticate_seal(EXECUTION)
review=EXECUTION/'review/candidate-review.json'
assert sha(review.read_bytes())=='532f1d49b7e6d16348be1849bf33d3e2344fecd88bbab989309336bf51f4a533'
status=json.loads(review.read_text())['status']
assert status=='PASS_STATIC_WITH_REQUIRED_FINALIZATION_GUARDS_RUNTIME_HELD'
draft=Path('/tmp/ovf-feature63-r3-generator-draft-S6wC5ekG/generate-root-bindings.r3.draft.py')
expected=draft.read_text().replace('DRAFT_READY_FOR_ROOT_BINDINGS = False','DRAFT_READY_FOR_ROOT_BINDINGS = True').replace('PACKET = None  # Pending final assembled r3 packet path; the staging directory is not authority.',f"PACKET = Path({str(EXECUTION)!r})  # Pending final assembled r3 packet path; the staging directory is not authority.").replace('SEAL_SHA = None  # Pending final r3 packet seal digest.',f"SEAL_SHA = {new['sha256']!r}  # Pending final r3 packet seal digest.").replace('CURRENT_CANDIDATE_REVIEW_STATUS = None  # Pending selected final r3 static review disposition.',f"CURRENT_CANDIDATE_REVIEW_STATUS = {status!r}  # Pending selected final r3 static review disposition.")
assert GENERATOR.read_text()==expected,'Generator differs outside four anchor substitutions'
ast.parse(GENERATOR.read_text())
architecture=Path('/tmp/ovf-feature63-r2-identity-semantics-architecture-nsYQLP8U/run-minimal63.candidate-r2-final.py')
assert architecture.read_text().replace('feature63-human-wave-composition-r2','feature63-human-wave-composition-r3').replace(" '--disable-crashpad-for-testing',",'')==(EXECUTION/'scripts/run-minimal63.py').read_text()
for n in ['public-producer.mjs','collect-launched-waves.py']:
 assert (ROOT/'scripts/feature63'/n).read_bytes().replace(b'feature63-human-wave-composition-r2',b'feature63-human-wave-composition-r3')==(EXECUTION/'scripts'/n).read_bytes()
assert (ROOT/'scripts/feature63/native-audit.py').read_bytes()==(EXECUTION/'scripts/native-audit.py').read_bytes()
protected=json.loads(Path('/tmp/ovf-main402-remaining-2e5-r1/protected-before.json').read_text())['dist']
def mode(v):return int(v,8) if isinstance(v,str) else v
for r in protected:
 p=ROOT/'dist'/r['path'];assert p.stat().st_size==r['bytes'] and sha(p.read_bytes())==r['sha256'] and stat.S_IMODE(p.stat().st_mode)==mode(r['mode'])
assert len(records(ROOT/'dist'))==len(protected)==397
TARGET.mkdir()
sources={
 'review-inputs':STATIC,
 'execution-packet':EXECUTION,
 'generator-draft':draft.parent,
 'generator-final':GENERATOR.parent,
 'ownership-proofs':architecture.parent,
 'chromium-diagnosis':Path('/tmp/ovf-feature63-chromium-fd-diagnosis-fmaiiy3f'),
 'independent-static-review':Path('/tmp/ovf-feature63-r3-independent-static-review-gpt56sol-20261001'),
 'pending-extraction-map':Path('/tmp/feature63-r3-extraction-input-map-nfNB1jVK'),
 'ledger-reference-readback':Path('/tmp/ovf-root-original100-reference-readback-ccwnhnzu'),
 'root-preparation':OUT,
}
mapping=[]
for label,source in sources.items():
 before=records(source);shutil.copytree(source,TARGET/label,copy_function=shutil.copy2)
 assert records(source)==records(TARGET/label)==before
 mapping.append({'source':str(source),'retained':str(TARGET/label),'records':before})
for n in ['run-minimal63.py','public-producer.mjs','collect-launched-waves.py']:
 source=EXECUTION/'scripts'/n;target=ROOT/'scripts/feature63'/n
 shutil.copyfile(source,target);target.chmod(0o644);assert target.read_bytes()==source.read_bytes()
 if n.endswith('.py'):ast.parse(target.read_text())
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ROOT_STATIC_R3_IMPORT_AUTHENTICATED_RUNTIME_HELD','originalStaticSeal':old,'executionSeal':new,'generatorFourAnchorsOnly':True,'wrapperLifetimeAndMutableContextSeparated':True,'chromiumSingleFlagDeletionOnly':True,'failingR2ProcessOrMismatchFieldStillUnknown':True,'fixRuntimeUntested':True,'captureAuthorized':False,'databaseReadOrModified':False,'ledgerVerifiedCount':99,'feature63Pending':True,'requestedReviewerModel':'gpt-5.6-sol','actualProviderIdentity':'unavailable','freshClaudeRun':False,'protectedDist397Unchanged':True,'rootAuthenticationMatcherCorrection':'First read-only compare removed the following rather than preceding flag space and failed before any mutation; exact diff was inspected and corrected.','retainedTrees':mapping}
p=TARGET/'root-import-and-retention.json';p.write_text(json.dumps(result,indent=2)+'\n')
with (ROOT/'docs/features/decisions.tsv').open('a') as f:
 f.write('\t'.join([result['at'],'feature63-r3-lifetime-crashpad-preparation','Imported reviewed lifetime ownership correction and one Chromium flag deletion','PIDFD and PID/start bind admitted lifetime while later cwd/executable/session observations may change; children require native Crashpad setup','docs/evidence/feature63-lifetime-crashpad-r3-preparation-20261001/root-import-and-retention.json','Consolidated static review retained; four generator and eight launcher anchor guards; no capture/DB/audit; original63pending;99/1'])+'\n')
print(json.dumps({'target':str(TARGET),'files':len(records(TARGET)),'payloadBytes':sum(r['bytes'] for r in records(TARGET)),'status':result['status']}))
