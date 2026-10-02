from pathlib import Path
import json,hashlib,os,sys,subprocess,datetime
out=Path(__file__).parent
specs=[('/tmp/feature63-r7-custody-utility.ggy3gNvB/fresh-r7-custody.py','da53c2865998eb6a6851eeb99a4b7e3cae85ef0b474baffc90059a5c5623e824'),('/tmp/ovf-root-feature63-r7-failure-custody-expectation-nya_z2g8/expectation.json','55f2d2874acfb0bb4b1515abb5f965620a549d71869725fa73fd59d4f300d2a2'),('/tmp/ovf-feature63-r7-failure-custody-expectation-architecture-4pLZeedb/root-expectation-comparison.json','3d6824d3b261330a8baa281c5e1e8cc5a6db3ba071798c3529e0530a78599b51')]
for p,h in specs:
 if hashlib.sha256(Path(p).read_bytes()).hexdigest()!=h:raise RuntimeError('anchor changed '+p)
args=[sys.executable,specs[0][0],specs[1][0],specs[1][1]]
env=dict(os.environ);env.pop('PYTHONOPTIMIZE',None);env['PYTHONDONTWRITEBYTECODE']='1'
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
with (out/'stdout').open('xb') as so,(out/'stderr').open('xb') as se:
 completed=subprocess.run(args,stdout=so,stderr=se,env=env,check=False)
def descriptor(p):
 b=p.read_bytes();return {'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
record={'schema':'feature63-r7-root-custody-execution-v1','startedAt':start,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':args,'exitCode':completed.returncode,'invocations':1,'automaticRetries':0,'expectationSha256':specs[1][1],'utilitySha256':specs[0][1],'stdout':descriptor(out/'stdout'),'stderr':descriptor(out/'stderr'),'pythonOptimizationDisabled':True,'feature63Qualified':False,'extractionOrAuditExecuted':False}
(out/'execution.json').write_text(json.dumps(record,indent=2,sort_keys=True)+'\n')
for p in out.iterdir():p.chmod(0o400)
print(json.dumps(record,sort_keys=True))
print((out/'stdout').read_text());print((out/'stderr').read_text())
sys.exit(completed.returncode)
