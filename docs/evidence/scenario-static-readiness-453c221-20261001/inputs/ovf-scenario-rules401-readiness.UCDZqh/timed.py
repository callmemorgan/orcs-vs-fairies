import datetime
import json
import os
import signal
import pathlib
import resource
import subprocess
import sys
import time

destination = pathlib.Path(sys.argv[1])
command = sys.argv[2:]
assert command and not destination.exists()
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
initial_cpu = resource.getrusage(resource.RUSAGE_CHILDREN)
initial_wall = time.perf_counter()
status, failure, process_id, process = 1, None, None, None
class StageSignal(InterruptedError):
    def __init__(self, signum):
        self.signum = signum
        super().__init__('Stage wrapper received signal ' + str(signum))

def interrupt_stage(signum, frame):
    raise StageSignal(signum)

for owned_signal in [signal.SIGTERM, signal.SIGHUP]:
    signal.signal(owned_signal, interrupt_stage)

try:
    process = subprocess.Popen(command, start_new_session=True)
    process_id = process.pid
    status = process.wait()
except BaseException as error:
    failure = {'name': type(error).__name__, 'message': str(error), 'signal': getattr(error, 'signum', None)}
    for cleanup_signal in [signal.SIGINT, signal.SIGTERM, signal.SIGHUP]:
        signal.signal(cleanup_signal, signal.SIG_IGN)
    if process is not None:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            status = process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            status = process.wait()
        # The child owns a new process group. Clear any remaining stage workers
        # even if the direct child exited before reaping those descendants.
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    raise
finally:
    final_cpu = resource.getrusage(resource.RUSAGE_CHILDREN)
    report = {'format': 'orcs-vs-fairies-scenario-stage-timing', 'version': 1,
              'command': command, 'processId': process_id,
              'startedAt': started, 'finishedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'wallSeconds': time.perf_counter() - initial_wall,
              'cpuUserSeconds': final_cpu.ru_utime - initial_cpu.ru_utime,
              'cpuSystemSeconds': final_cpu.ru_stime - initial_cpu.ru_stime,
              'exitCode': status, 'failure': failure,
              'cpuScope': 'Reaped direct child; descendant CPU included when that child reaped its workers.'}
    with destination.open('x') as stream:
        json.dump(report, stream, indent=2)
        stream.write('\n')
sys.exit(status)
