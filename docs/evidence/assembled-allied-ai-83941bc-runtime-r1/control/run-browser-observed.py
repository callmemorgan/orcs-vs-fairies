#!/usr/bin/env python3
"""Run one reviewed browser phase and invoke the frozen live observer at launch."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

CONTROL = Path(__file__).resolve().parent
REPO = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
PREP = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/ai-83941bc-retry-prep-r1')
PIN = '83941bc80ce9ec08840b0645d9b33e8018d5309a'
phase = sys.argv[1]
assert phase in ('coop-ui', 'online-ui')
assert Path.cwd() == REPO
assert subprocess.check_output(['git','rev-parse','HEAD']).decode().strip() == PIN
if phase == 'online-ui':
    coop = json.loads((REPO / 'work/ai-save401-final-83941bc-r1/audits/coop-ui-envelope.json').read_text())
    assert coop['result'] == 'passed' and coop['sourcePin'] == PIN
driver = PREP / 'recipe/followup-83941bc-r1-chromium1243.sh'
assert hashlib.sha256(driver.read_bytes()).hexdigest() == '81e0f62d4012a50338819d82466556a5a093cac78a69d884619e51f8b5ea84da'
observer = PREP / 'observers/capture-browser-process-r3.py'
static = json.loads((PREP / 'prepared-files.json').read_text())['files']['observers/capture-browser-process-r3.py']
assert hashlib.sha256(observer.read_bytes()).hexdigest() == static['sha256']
receipts = CONTROL / 'receipts'
paths = {key: receipts / (phase + suffix) for key,suffix in
         [('start','-start.json'),('end','-end.json'),('log','.log'),('observer','-live-observer.log')]}
assert not any(path.exists() for path in paths.values())

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def identity(pid):
    p = Path('/proc') / str(pid)
    fields = (p / 'stat').read_text().rsplit(') ',1)[1].split()
    return {'pid':pid,'exe':os.readlink(p / 'exe'),'cwd':os.readlink(p / 'cwd'),
            'argv':[a.decode(errors='replace') for a in (p / 'cmdline').read_bytes().split(b'\0') if a],
            'start_ticks':int(fields[19])}

command = ['bash',str(driver),phase]
environment = dict(os.environ,DEBUG='pw:browser')
observations = []
with paths['log'].open('xb') as log, paths['observer'].open('xb') as observer_log:
    child = subprocess.Popen(command,cwd=REPO,env=environment,stdin=subprocess.DEVNULL,
                             stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True)
    initial = identity(child.pid)
    with paths['start'].open('x') as out:
        json.dump({'started_at':now(),'command':command,'cwd':str(REPO),
                   'environment':{'DEBUG':'pw:browser'},'child_identity':initial,
                   'observer':str(observer),'observer_sha256':static['sha256']},out,indent=2)
        out.write('\n')
    assert child.stdout is not None
    for line in iter(child.stdout.readline,b''):
        log.write(line)
        log.flush()
        match = re.search(rb'pw:browser <launched> pid=(\d+)',line)
        if not match:
            continue
        pid = int(match.group(1))
        observe_command = ['python3',str(observer),str(pid),phase]
        observe = subprocess.Popen(observe_command,cwd=REPO,stdin=subprocess.DEVNULL,
                                   stdout=observer_log,stderr=subprocess.STDOUT)
        observe_identity = identity(observe.pid)
        observe_exit = observe.wait()
        observer_log.flush()
        observations.append({'browser_pid':pid,'command':observe_command,
                             'child_identity':observe_identity,'exit_code':observe_exit,
                             'pid_path_absent_after_wait':not (Path('/proc') / str(observe.pid)).exists()})
        print(json.dumps({'phase':phase,'browser_pid':pid,'live_observer_exit':observe_exit}),flush=True)
    child.stdout.close()
    code = child.wait()
    log.flush()
    observer_log.flush()
    os.fsync(log.fileno())
    os.fsync(observer_log.fileno())
current = identity(child.pid) if (Path('/proc') / str(child.pid)).exists() else None
same_live = current is not None and current['start_ticks'] == initial['start_ticks']
observer_passed = len(observations) == 1 and all(r['exit_code'] == 0 for r in observations)
result = {'ended_at':now(),'exit_code':code,'child_identity':initial,
          'pid_path_absent_after_wait':current is None,'same_process_live_after_wait':same_live,
          'current_pid_identity':current,'log':str(paths['log']),
          'live_browser_observations':observations,'live_browser_observer_passed':observer_passed,
          'limits':'Frozen canonical command ran once. A failed observer is preserved and does not authorize a retry or another phase.'}
with paths['end'].open('x') as out:
    json.dump(result,out,indent=2)
    out.write('\n')
print(json.dumps(result,indent=2),flush=True)
assert not same_live, 'Owned phase driver remains live'
raise SystemExit(code if code else (0 if observer_passed else 1))
