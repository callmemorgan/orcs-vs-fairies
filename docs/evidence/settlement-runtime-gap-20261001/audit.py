from pathlib import Path
import hashlib,json,re,subprocess

out=Path(__file__).resolve().parent
root=out.parents[2]
source=json.loads((out/'source-manifest.json').read_text())
inputs=json.loads((out/'input-manifest.json').read_text())
artifacts=json.loads((out/'artifact-manifest.json').read_text())
for entry in artifacts['files']:
    data=(out/entry['path']).read_bytes()
    assert hashlib.sha256(data).hexdigest()==entry['sha256'],entry['path']
for entry in inputs['files']:
    data=(root/entry['path']).read_bytes()
    assert hashlib.sha256(data).hexdigest()==entry['sha256'],entry['path']
actualPaths={p.relative_to(root).as_posix() for p in (root/'src').rglob('*') if p.is_file()}
assert actualPaths=={entry['path'] for entry in source['files']}
for entry in source['files']:
    data=(root/entry['path']).read_bytes()
    assert hashlib.sha256(data).hexdigest()==entry['sha256'],entry['path']
    pinned=subprocess.check_output(['git','show',source['productionSourceCommit']+':'+entry['path']],cwd=root)
    assert data==pinned,entry['path']
fingerprint=hashlib.sha256()
for entry in sorted((e for e in source['files'] if e['path'].endswith(('.ts','.css'))),key=lambda e:e['path'][4:]):
    fingerprint.update(entry['path'][4:].encode())
    fingerprint.update((root/entry['path']).read_bytes())
assert fingerprint.hexdigest()==source['sourceFingerprint']
assert 'export const SAVE_VERSION=4;' in (root/'src/core/saves.ts').read_text()
assert "export const SIMULATION_REVISION = '4.0.0';" in (root/'src/core/versions.ts').read_text()
final=(out/'final-runtime.log').read_text()
assert re.search(r'Test Files\s+3 passed \(3\)',final)
assert re.search(r'Tests\s+24 passed \(24\)',final)
assert not (out/'final-types.log').read_bytes()
world=(out/'world-identity-failure.log').read_text()
assert 'serializes to the same string' in world
assert 'expected 4 to be greater than 4' in (out/'mining-first-observation-failure.log').read_text()
print(json.dumps({'productionSourceCommit':source['productionSourceCommit'],'executedTestCommit':source['executedTestCommit'],'sourceFingerprint':fingerprint.hexdigest(),'sourceFilesVerified':len(source['files']),'inputFilesVerified':len(inputs['files']),'evidenceFilesVerified':len(artifacts['files']),'passedTests':24,'passedTestFiles':3,'typecheckExit':0,'saveVersion':4,'simulationRevision':'4.0.0','nativeBrowserExecuted':False},indent=2))
