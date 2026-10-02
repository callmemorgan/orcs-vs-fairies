from pathlib import Path
import json,subprocess,datetime,hashlib,traceback
control=Path(__file__).parent
record=json.loads((control/'launch-command.json').read_text())
assert hashlib.sha256(Path(record['argv'][1]).read_bytes()).hexdigest()==record['wrapperSha256']
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
record['startedAt']=now()
with (control/'wrapper.stdout.log').open('wb') as stdout,(control/'wrapper.stderr.log').open('wb') as stderr:
 proc=subprocess.Popen(record['argv'],cwd=record['cwd'],stdout=stdout,stderr=stderr)
 record['wrapperPid']=proc.pid
 try:
  values=Path(f'/proc/{proc.pid}/stat').read_text().rsplit(') ',1)[1].split()
  record['wrapperIdentity']={'pid':proc.pid,'ppid':int(values[1]),'startTicks':int(values[19])}
 except FileNotFoundError:record['wrapperIdentityRead']='Wrapper exited before immediate identity read.'
 (control/'control-execution.json').write_text(json.dumps(record,indent=2)+'\n')
 result=proc.wait()
record.update(exitCode=result,finishedAt=now())
(control/'control-execution.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'control':str(control),'wrapperPid':record['wrapperPid'],'exitCode':result,'finishedAt':record['finishedAt']},indent=2),flush=True)
raise SystemExit(result)
