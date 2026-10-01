from pathlib import Path
import gzip,hashlib,json,subprocess
archive=Path('docs/evidence/packaged-cli-parity-20261001')
manifest=json.loads((archive/'archive-manifest.json').read_text())
for entry in manifest['files']:
    path=archive/entry['path'];raw=path.read_bytes()
    assert len(raw)==entry['bytes'] and hashlib.sha256(raw).hexdigest()==entry['sha256'],entry['path']
    decoded=gzip.decompress(raw) if entry['encoding']=='gzip' else raw
    assert len(decoded)==entry['decodedBytes'] and hashlib.sha256(decoded).hexdigest()==entry['decodedSha256'],entry['path']

def read_json(name):
    file=archive/name
    raw=gzip.decompress(file.read_bytes()) if file.suffix=='.gz' else file.read_bytes()
    return json.loads(raw)
source=read_json('clean-pin-13d4fbc/source-before.json.gz')
after=read_json('clean-pin-13d4fbc/source-after.json.gz')
assert source==after
assert source['head']==manifest['sourcePin'] and source['workingTree']==''
composite=hashlib.sha256()
process=subprocess.Popen(['git','cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
for name,expected in source['files'].items():
    composite.update(name.encode());composite.update(b'\0')
    process.stdin.write(f'{source["head"]}:{name}\n'.encode());process.stdin.flush()
    header=process.stdout.readline().decode().strip();parts=header.split(' ')
    assert len(parts)==3 and parts[1]=='blob',(name,header)
    size=int(parts[2]);digest=hashlib.sha256();remaining=size
    while remaining:
        block=process.stdout.read(min(remaining,1024*1024));assert block
        digest.update(block);composite.update(block);remaining-=len(block)
    assert process.stdout.read(1)==b'\n'
    assert size==expected['bytes'] and digest.hexdigest()==expected['sha256'],name
    composite.update(b'\0')
process.stdin.close();assert process.wait()==0
assert composite.hexdigest()==source['sha256']
runs=['clean-pin-13d4fbc','command-only-13d4fbc','one-tick-13d4fbc','one-tick-gzip-13d4fbc']
for name in runs:
    result=read_json(f'{name}/result.json');assert result['status']=='passed'
    assert result['source']['head']==manifest['sourcePin'] and result['source']['workingTree']==''
    assert read_json(f'{name}/source-before.json.gz')==read_json(f'{name}/source-after.json.gz')
    assert read_json(f'{name}/builds-before.json.gz')==read_json(f'{name}/builds-after.json.gz')
    checkpoint=read_json(f'{name}/continuation-checkpoint.json.gz')
    assert checkpoint['save']['state']['tick']==result['checks'][1]['checkpointTick']
    for prefix in ['main','continuation']:
        status=read_json(f'{name}/{prefix}.process.json');assert status['code']==0 and not status['signal']
        with gzip.open(archive/f'{name}/{prefix}.stdin.ndjson.gz','rt') as f:requests=[json.loads(line) for line in f]
        assert len(requests)==status['requests']
        with gzip.open(archive/f'{name}/{prefix}.stdout.ndjson.gz','rt') as f:
            responses=0;rejected=0
            for line in f:
                response=json.loads(line);responses+=1
                if response['ok'] is False:rejected+=1
        assert responses==len(requests)
        assert rejected==(2 if prefix=='continuation' else 0)
for name in ['human-controller','other-command-side','different-dt']:
    assert read_json(f'reject-{name}-13d4fbc/result.json')['status']=='failed'
output={'archiveFilesVerified':len(manifest['files']),'archiveBytesVerified':sum(entry['bytes'] for entry in manifest['files']),'decodedBytesVerified':sum(entry['decodedBytes'] for entry in manifest['files']),'sourcePin':manifest['sourcePin'],'sourceFilesVerifiedAgainstGitBlobs':len(source['files']),'sourceSha256':source['sha256'],'passedRuns':runs,'checkpointsPresent':True,'sourceAndBuildBeforeAfterEqual':True,'publicRequestResponseCountsEqual':True,'processExitsZeroAndExpectedErrorsRetained':True,'unsupportedArchivesRejected':True}
(archive/'artifact-audit.json').write_text(json.dumps(output,indent=2)+'\n')
print(json.dumps(output))
