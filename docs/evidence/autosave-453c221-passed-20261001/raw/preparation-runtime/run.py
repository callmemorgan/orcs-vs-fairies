import hashlib, json, os, pathlib, signal, subprocess, time
product=pathlib.Path('/home/morgana/.codex/worktrees/assembled-rules401/orcs-vs-Fairies')
pin='453c2218af9973b9eca8fb78392435bd9d46a740'
parent=product/'work/verification/ui-453c221-20261001'
runtime=parent/'preparation-runtime'
prepared=parent/'prepared'
def fingerprint(path):
    assert path.is_file() and not path.is_symlink(),str(path)
    b=path.read_bytes(); return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def dump(path,v): path.write_text(json.dumps(v,indent=2)+'\n')
args=['node','scripts/controls-proof/prepare.mjs',pin,str(prepared)]
receipt={'productPin':pin,'cwd':str(product),'args':args,'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'result':'running','node':{'path':subprocess.check_output(['which','node'],text=True).strip(),'version':subprocess.check_output(['node','--version'],text=True).strip()},'entry':fingerprint(product/'scripts/controls-proof/prepare.mjs')}
dump(runtime/'run.json',receipt)
with (runtime/'prepare.log').open('x') as log:
    child=subprocess.Popen(args,cwd=product,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
    receipt['pid']=child.pid; dump(runtime/'run.json',receipt)
    try: receipt['exitCode']=child.wait(timeout=180)
    except subprocess.TimeoutExpired:
        receipt['timedOut']=True; os.killpg(child.pid,signal.SIGTERM)
        try: child.wait(timeout=5)
        except subprocess.TimeoutExpired: os.killpg(child.pid,signal.SIGKILL); child.wait()
        receipt['exitCode']=child.returncode
receipt['finishedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
receipt['log']=fingerprint(runtime/'prepare.log')
try:
    assert receipt['exitCode']==0 and not receipt.get('timedOut'),'Preparation failed; first output preserved'
    assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=product,text=True).strip()==pin
    assert subprocess.check_output(['git','status','--porcelain'],cwd=product,text=True)==''
    before=json.loads((runtime/'product-inputs-before.json').read_text())
    after={name:fingerprint(product/name) for name in before}
    dump(runtime/'product-inputs-after.json',after)
    assert after==before,'Pinned input bytes changed during preparation'
    previous=json.loads((runtime/'old-evidence-before.json').read_text())
    current={name:fingerprint(product/name) for name in previous}
    dump(runtime/'old-evidence-after.json',current)
    assert current==previous,'Prior evidence changed during preparation'
    prepared_manifest={str(p.relative_to(prepared)):fingerprint(p) for p in sorted(prepared.rglob('*')) if p.is_file()}
    dump(runtime/'prepared-files.json',prepared_manifest)
    prep=json.loads((prepared/'prepare.json').read_text())
    build=json.loads((prepared/'build-manifest.json').read_text())
    modules=json.loads((prepared/'modules/manifest.json').read_text())
    assert prep['sourcePin']==build['sourcePin']==modules['sourcePin']==pin
    expected=prep['assetFiles']['public/favicon.ico']
    actual=fingerprint(prepared/'dist/favicon.ico')
    assert expected['bytes']==actual['bytes'] and expected['sha256']==actual['sha256']
    assert actual==fingerprint(product/'public/favicon.ico')
    for name,data in build['compiledFiles'].items(): assert prepared_manifest['dist/'+name]==data,name
    receipt.update(result='passed',frozenInputsUnchanged=True,oldEvidenceUnchanged=True,preparedFiles=len(prepared_manifest),inputCount=len(before),oldArtifactCount=len(previous),favicon=actual,buildId=build['buildId'])
except Exception as error: receipt.update(result='failed',failure=str(error))
dump(runtime/'run.json',receipt)
dump(runtime/'full-manifest.json',{str(p.relative_to(runtime)):fingerprint(p) for p in sorted(runtime.rglob('*')) if p.is_file() and p.name!='full-manifest.json'})
print(json.dumps(receipt),flush=True)
raise SystemExit(0 if receipt['result']=='passed' else 1)
