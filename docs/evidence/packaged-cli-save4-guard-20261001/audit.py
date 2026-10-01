from pathlib import Path
import gzip,hashlib,json,subprocess
archive=Path('docs/evidence/packaged-cli-save4-guard-20261001')
manifest=json.loads((archive/'archive-manifest.json').read_text())
assert manifest['runCount']==1
for row in manifest['files']:
    file=archive/row['path'];data=file.read_bytes()
    assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'],row['path']
    decoded=gzip.decompress(data) if row['encoding']=='gzip' else data
    assert len(decoded)==row['decodedBytes'] and hashlib.sha256(decoded).hexdigest()==row['decodedSha256'],row['path']
def read_json(name):
    file=archive/name;data=file.read_bytes()
    return json.loads(gzip.decompress(data) if file.suffix=='.gz' else data)
pre=read_json('support/production-and-driver-preflight.json.gz')
before=read_json('run/source-before.json.gz');after=read_json('run/source-after.json.gz')
assert before==after and before['head']==manifest['sourcePin'] and before['workingTree']==''
assert before['files']==pre['files'] and before['sha256']==pre['sha256']
combined=hashlib.sha256();process=subprocess.Popen(['git','cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
for name,row in pre['files'].items():
    process.stdin.write(f'{manifest["sourcePin"]}:{name}\n'.encode());process.stdin.flush()
    header=process.stdout.readline().decode().strip().split(' ');assert len(header)==3 and header[1]=='blob',(name,header)
    size=int(header[2]);digest=hashlib.sha256();remaining=size;combined.update(name.encode());combined.update(b'\0')
    while remaining:
        block=process.stdout.read(min(remaining,1024*1024));assert block
        digest.update(block);combined.update(block);remaining-=len(block)
    assert process.stdout.read(1)==b'\n'
    assert size==row['bytes'] and digest.hexdigest()==row['sha256'],name
    combined.update(b'\0')
process.stdin.close();assert process.wait()==0
assert combined.hexdigest()==pre['sha256']
assert read_json('support/dependencies-before.json.gz')==read_json('support/dependencies-after.json.gz')
assert read_json('run/builds-before.json.gz')==read_json('run/builds-after.json.gz')
for name in ['scripts/tournaments/verify-packaged-cli-parity.mjs','scripts/tournaments/packaged-cli-entry.ts','package.json','package-lock.json']:
    decoded=gzip.decompress((archive/f'frozen-source/{name}.gz').read_bytes())
    assert len(decoded)==pre['files'][name]['bytes'] and hashlib.sha256(decoded).hexdigest()==pre['files'][name]['sha256']
inputs=read_json('run/compiled-inputs-against-git.json.gz')
for name in ['productionCLI','directCoreReference']:
    for path,row in inputs[name]['files'].items():assert row==pre['files'][path],path
result=read_json('run/result.json');versions=read_json('run/versions.json');guard=read_json('run/guard-audit.json')
assert result['status']==guard['status']=='passed'
assert versions['save']==versions['archiveInitialVersion']==4 and versions['simulationRevision']==versions['archiveRevision']=='4.0.0'
assert result['checks'][0]['ticksChecked']==2402 and result['checks'][0]['commandsChecked']==6
assert result['checks'][1]['checkpointTick']==1201 and [row['ticks'] for row in result['checks'][1]['batches']]==[1200,1]
for name in ['main','continuation']:
    status=read_json(f'run/{name}.process.json');assert status['code']==0 and not status['signal']
    assert gzip.decompress((archive/f'run/{name}.stderr.log.gz').read_bytes())==b''
    with gzip.open(archive/f'run/{name}.stdin.ndjson.gz','rt') as file:requests=sum(1 for line in file)
    with gzip.open(archive/f'run/{name}.stdout.ndjson.gz','rt') as file:
        responses=0;rejected=0
        for line in file:responses+=1;rejected+=json.loads(line)['ok'] is False
    assert requests==responses==status['requests'] and rejected==(2 if name=='continuation' else 0)
summary={'status':'passed','sourcePin':manifest['sourcePin'],'runCount':1,'archiveArtifactsVerified':len(manifest['files']),'archiveBytesVerified':sum(row['bytes'] for row in manifest['files']),'decodedBytesVerified':sum(row['decodedBytes'] for row in manifest['files']),'trackedSourceFilesVerifiedAgainstGit':len(pre['files']),'allTrackedSha256':pre['sha256'],'productionCLICompilerInputFiles':len(inputs['productionCLI']['files']),'productionCLIInputSha256':inputs['productionCLI']['sha256'],'referenceCompilerInputFiles':len(inputs['directCoreReference']['files']),'sourceDriverPackagesAndIndependentDependenciesBeforeAfterEqual':True,'versions':versions,'nativeFixtureAndProtocolRetained':True,'scope':'Existing retained proof only; no new simulation, CLI proof, dependency cache copy, root ledger or trail changes.'}
(archive/'archive-audit.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
