import hashlib,json,os,stat,subprocess
from pathlib import Path
from datetime import datetime,timezone

OWN=Path('/home/morgana/.codex/worktrees/faction-economy-cleanup/orcs-vs-Fairies')
ROOT=Path('/home/morgana/Projects/orcs-vs-Fairies')
OUT=Path('/tmp/ovf-faction-seven-file-import-453-8b96-20261001')
SOURCE='906e0bd25577a9d99473c88cc50e71700235754a'
RECIPE='0bd7d51476cd855505b91ce76b232795afae867f'
TARGET='8b96f5197adf5b4ddfa160c2fe5a550afdf7e9d8'
PRODUCT='453c2218af9973b9eca8fb78392435bd9d46a740'
PREVIOUS_PRODUCT='c074cc5e610fc128d7b6ac894a61258d418463d4'
CONFIGS=['editor.html','index.html','package-lock.json','package.json','tsconfig.json','vite.config.ts','vitest.ai-recovery.config.ts','vitest.ai-team.config.ts','vitest.ai.config.ts','vitest.config.ts','vitest.ladder.config.ts']
FILES=['docs/features/FACTION_FINAL_VERIFICATION.md','scripts/acceptance/audit-faction-powers.ts','scripts/acceptance/faction-powers-fixtures.ts','scripts/acceptance/faction-powers.mjs','scripts/acceptance/native-audit.ts','scripts/acceptance/native-fixtures.ts','scripts/acceptance/verify-native-acceptance.mjs']
RETAIN=['scripts/acceptance/direction-defense-fixtures.ts','scripts/acceptance/direction-defense.mjs','scripts/acceptance/native-context.mjs']

def git(*args,cwd=OWN,env=None):return subprocess.check_output(['git',*args],cwd=cwd,env=env)
def sha(data):return hashlib.sha256(data).hexdigest()
def blob(pin,path):return git('show',pin+':'+path)
def tree(pin):
 out={}
 for row in git('ls-tree','-r','-z',pin).split(b'\0'):
  if not row:continue
  meta,path=row.split(b'\t',1);mode,kind,oid=meta.decode().split()
  out[path.decode()]={'mode':mode,'type':kind,'gitBlob':oid}
 return out
def selector(rows):return sorted(p for p in rows if p.startswith(('src/','public/')) or p in CONFIGS)
def live_paths(root):return sorted(p.relative_to(root).as_posix() for d in ('src','public') for p in (root/d).rglob('*') if p.is_file() or p.is_symlink())
def live_matches(root,path,data,mode):
 p=root/path;s=p.lstat()
 assert stat.S_ISREG(s.st_mode) and not p.is_symlink(),str(p)
 assert ('100755' if s.st_mode&0o111 else '100644')==mode,str(p)+' mode'
 assert p.read_bytes()==data,str(p)+' bytes'

def entry(rows,pin,path):
 r=rows[path];assert r['type']=='blob';data=blob(pin,path)
 return {**r,'bytes':len(data),'sha256':sha(data)},data

assert git('rev-parse','HEAD').decode().strip()==SOURCE
assert not git('status','--porcelain')
assert git('rev-parse','HEAD',cwd=ROOT).decode().strip()==TARGET
assert not git('status','--porcelain',cwd=ROOT)
source,recipe,target,product,previous=map(tree,[SOURCE,RECIPE,TARGET,PRODUCT,PREVIOUS_PRODUCT])
paths=selector(product);oldpaths=selector(previous)
assert len(paths)==568 and len(oldpaths)==567
assert sorted(set(paths)-set(oldpaths))==['public/favicon.ico'] and not set(oldpaths)-set(paths)
assert selector(target)==paths
assert {p:target[p] for p in paths}=={p:product[p] for p in paths}
assert {p:product[p] for p in oldpaths}=={p:previous[p] for p in oldpaths}
assert selector(source)==oldpaths
assert {p:source[p] for p in oldpaths}=={p:product[p] for p in oldpaths}
assert live_paths(ROOT)==[p for p in paths if p.startswith(('src/','public/'))]
assert live_paths(OWN)==[p for p in oldpaths if p.startswith(('src/','public/'))]

product_inputs={}
for path in paths:
 info,data=entry(product,PRODUCT,path);live_matches(ROOT,path,data,info['mode'])
 info['rootTargetGitMatchesProduct']=True;info['rootLiveMatchesProduct']=True
 if path in oldpaths:
  live_matches(OWN,path,data,info['mode']);info['previous567AndOwnedSourceMatchProduct']=True
 else:info['newProductAssetOutsideProofImport']=True
 product_inputs[path]=info

seven={}
for path in FILES:
 assert source[path]==recipe[path],path+' immutable recipe Git identity'
 info,data=entry(source,SOURCE,path);live_matches(OWN,path,data,info['mode'])
 info['immutableRecipeMatchesSource']=True;info['ownedLiveMatchesSource']=True
 before=None
 if path in target:
  before,before_data=entry(target,TARGET,path);live_matches(ROOT,path,before_data,before['mode'])
 else:assert not (ROOT/path).exists(),path+' new target file'
 info['targetBefore']=before;info['change']='M' if before else 'A';seven[path]=info

# Use a separate temporary index. This writes Git tree objects only; neither
# checkout nor either managed index changes, and no integrated commit is created.
index_env={**os.environ,'GIT_INDEX_FILE':str(OUT/'candidate.index')}
git('read-tree',TARGET,env=index_env)
for path in FILES:
 row=source[path];git('update-index','--add','--cacheinfo',row['mode'],row['gitBlob'],path,env=index_env)
candidate_tree=git('write-tree',env=index_env).decode().strip();candidate=tree(candidate_tree)
changed=git('diff-tree','--no-commit-id','--name-only','-r',TARGET,candidate_tree).decode().splitlines()
assert sorted(changed)==sorted(FILES)
assert selector(candidate)==paths and {p:candidate[p] for p in paths}=={p:product[p] for p in paths}
for path in FILES:assert candidate[path]==source[path]
retained={}
for path in RETAIN:
 assert path not in FILES and candidate[path]==target[path]
 info,data=entry(target,TARGET,path);live_matches(ROOT,path,data,info['mode']);info['candidateRetainsTargetExactly']=True
 info['isolatedSourceDiffers']=source[path]!=target[path];retained[path]=info
assert 'window.rts?.mode' in blob(TARGET,'scripts/acceptance/native-context.mjs').decode()
assert 'nativePointerInputs' in blob(TARGET,'scripts/acceptance/native-context.mjs').decode()
assert 'source.y = target.y = 23.9' in blob(TARGET,'scripts/acceptance/direction-defense-fixtures.ts').decode()

patch=git('diff','--binary','--full-index','--no-ext-diff',TARGET,SOURCE,'--',*FILES)
with (OUT/'seven-file-import.patch').open('xb') as f:f.write(patch)
with (OUT/'seven-files.txt').open('x') as f:f.write('\n'.join(FILES)+'\n')
result={
 'kind':'exact-seven-file-faction-proof-import-preparation',
 'checkedAt':datetime.now(timezone.utc).isoformat(),
 'sourcePin':SOURCE,'immutableRecipePin':RECIPE,'targetRootPin':TARGET,
 'immutableProductPin':PRODUCT,'previousProductPin':PREVIOUS_PRODUCT,
 'productInputCount':568,'former567InputsUnchanged':True,'onlyNewProductPath':'public/favicon.ico',
 'all568TargetProductPathsModesBlobsAndRootLiveBytesMatch':True,
 'allFormer567SourceProductPathsModesBlobsAndOwnedLiveBytesMatch':True,
 'all7SourceProofIdentitiesAndOwnedLiveBytesMatchImmutableRecipe':True,
 'candidateTree':candidate_tree,'candidateIsPreviewTreeNotIntegratedCommit':True,
 'candidateChangedPaths':changed,'candidateRetainsAll568ProductInputs':True,
 'sourceFiles':seven,'productInputs':product_inputs,'retainedApprovedProofFiles':retained,
 'patch':{'path':str(OUT/'seven-file-import.patch'),'bytes':len(patch),'sha256':sha(patch)},
 'rootImportNotPerformed':True,'realIntegratedProofPin':'Must be created and reported by root after exact seven-file import and light checks.',
 'preservedAcceptanceBoundary':'The patch adds the explicitly selected factions group only. Existing default direction,capture,specialists selection and their full save/runtime/replay assertions remain unchanged; no new original requirement gate.',
 'provenanceLimit':'Source906 preserves original recipe common helpers. Root native-context contains approved null-safe replay wait and pointer observations, and root direction proof contains approved grazing-rock lane. All are outside the seven imported paths and the candidate retains root identities exactly.',
 'executionLimits':'Git object/live byte inspection and a separate scratch Git index only. No dependencies, application imports, builds, tests, fixture generation, browser, simulation or server execution. No root worktree/index, ledger/trail/4173/dist writes.',
 'mismatches':[],'allChecksPassed':True,
}
assert git('rev-parse','HEAD').decode().strip()==SOURCE and not git('status','--porcelain')
assert git('rev-parse','HEAD',cwd=ROOT).decode().strip()==TARGET and not git('status','--porcelain',cwd=ROOT)
with (OUT/'import-manifest.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({k:result[k] for k in ['sourcePin','immutableRecipePin','targetRootPin','immutableProductPin','productInputCount','candidateTree','allChecksPassed']},indent=2))
print('manifestSha256='+sha((OUT/'import-manifest.json').read_bytes()))
print('patchSha256='+sha(patch))
for path,row in seven.items():print(row['change'],row['mode'],row['gitBlob'],row['sha256'],path)
