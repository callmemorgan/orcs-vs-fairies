from pathlib import Path
import hashlib,json,subprocess,sys
from datetime import datetime,timezone
root=Path('/home/morgana/.codex/worktrees/assembled-combat/orcs-vs-Fairies')
out=root/'docs/evidence/assembled-combat-20261001'
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
assert commit=='470099e120ae270aa726d1eb831724d292006238'
h=hashlib.sha256()
for file in sorted((root/'src').rglob('*')):
    if file.is_file() and file.suffix in ('.ts','.css'):
        h.update(file.relative_to(root/'src').as_posix().encode());h.update(file.read_bytes())
build_id=h.hexdigest()
tests=['tests/captured-gravecaller-definition.test.ts', 'tests/captured-gravecaller-grove.test.ts', 'tests/captured-illusion-definition.test.ts', 'tests/combat-tactics.test.ts', 'tests/faction-save-semantics.test.ts', 'tests/faction-systems.test.ts', 'tests/faction-tools.test.ts', 'tests/joint-combat-integration.test.ts', 'tests/joint-special-surrender-fire.test.ts', 'tests/joint-trophy-ownership.test.ts', 'tests/joint-world-ignition.test.ts', 'tests/neutral-siege-shells.test.ts', 'tests/online-render-state.test.ts', 'tests/replays.test.ts', 'tests/saves.test.ts', 'tests/specialist-bridge-expiry.test.ts', 'tests/specialist-building-authority.test.ts', 'tests/specialist-command-analysis.test.ts', 'tests/specialist-gameplay.test.ts', 'tests/specialist-saves.test.ts', 'tests/specialist-world-integration.test.ts', 'tests/tactics-direction-saves.test.ts', 'tests/tactics-tools.test.ts', 'tests/team-observation.test.ts', 'tests/world-combined.test.ts', 'tests/world-interruptions.test.ts']
commands=[
 ('focused-tests',['node_modules/.bin/vitest','run',*tests,'--testTimeout=30000','--maxWorkers=2'],'final-tests.txt'),
 ('typecheck',['node_modules/.bin/tsc','--noEmit'],'final-typecheck.txt'),
 ('browser-build',['npm','run','build'],'final-build.txt'),
 ('cli-build',['npm','run','build:cli'],'final-cli-build.txt'),
 ('server-build',['npm','run','build:server'],'final-server-build.txt'),
 ('repository-tests',['node_modules/.bin/vitest','run','--exclude','tests/skirmish.test.ts','--testTimeout=30000','--maxWorkers=2'],'repository-excluding-soak-failed.txt'),
]
result={'sourceCommit':commit,'sourceBuildId':build_id,'commands':[]}
for name,command,log in commands:
    started=datetime.now(timezone.utc).isoformat()
    with (out/log).open('w') as handle:
        handle.write(json.dumps({'name':name,'command':command,'sourceCommit':commit,'sourceBuildId':build_id,'startedAt':started})+'\n');handle.flush()
        run=subprocess.run(command,cwd=root,stdout=handle,stderr=subprocess.STDOUT)
        completed=datetime.now(timezone.utc).isoformat()
        handle.write(json.dumps({'returncode':run.returncode,'completedAt':completed})+'\n')
    entry={'name':name,'command':command,'log':log,'returncode':run.returncode,'sourceBuildId':build_id,'startedAt':started,'completedAt':completed,'logSha256':hashlib.sha256((out/log).read_bytes()).hexdigest()}
    result['commands'].append(entry)
    (out/'verification-command-results.json').write_text(json.dumps(result,indent=2)+'\n')
    print(name,run.returncode,flush=True)
    if name!='repository-tests' and run.returncode: sys.exit(run.returncode)
