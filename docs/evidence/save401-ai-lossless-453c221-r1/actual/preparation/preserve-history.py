#!/usr/bin/env python3
import hashlib,json,pathlib,subprocess,sys
repo=pathlib.Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
roots=['docs/evidence/six-factions-save4-final-af44da4-r1','docs/evidence/six-factions-save401-ladder-c86e273-r1','docs/evidence/six-factions-save401-watchdog-c86e273-r1','work/ai-save401-final-c86e273-r1','work/final-ai-prep']
files={}
for rel in roots:
 base=repo/rel
 if not base.is_dir():raise RuntimeError('missing historical root '+rel)
 for p in sorted(base.rglob('*')):
  if p.is_symlink():files[str(p.relative_to(repo))]={'symlink':str(p.readlink())}
  elif p.is_file():
   data=p.read_bytes();files[str(p.relative_to(repo))]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'mode':oct(p.stat().st_mode&0o777)}
link=repo/'node_modules'
if not link.is_symlink():raise RuntimeError('dependencies not retained symlink')
files['node_modules']={'symlink':str(link.readlink()),'resolved':str(link.resolve())}
head=subprocess.check_output(['git','-C',str(repo),'rev-parse','HEAD']).decode().strip()
status=subprocess.check_output(['git','-C',str(repo),'status','--porcelain=v1','--untracked-files=no']).decode()
if status:raise RuntimeError('tracked checkout dirty')
record={'head':head,'roots':roots,'trackedClean':True,'files':files}
out=pathlib.Path(sys.argv[1]);out.write_text(json.dumps(record,indent=2)+'\n')
if len(sys.argv)>2:
 before=json.loads(pathlib.Path(sys.argv[2]).read_text())
 if before['roots']!=roots or before['files']!=files:raise RuntimeError('historical evidence/dependencies changed')
print(json.dumps({'head':head,'historicalEntries':len(files),'fileBytes':sum(f.get('bytes',0) for f in files.values()),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'sameAsBefore':len(sys.argv)>2}))
