import subprocess
import sys
child = subprocess.Popen([sys.executable, '-I', '-u', sys.argv[1]],
                         stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
assert child.stdout.readline().strip() == 'READY'
print('CHILD_READY ' + str(child.pid), flush=True)
assert input() == 'SETSID'
child.stdin.write('SETSID\n')
child.stdin.flush()
assert child.stdout.readline().strip() == 'SETSID_DONE'
print('SETSID_DONE', flush=True)
assert input() == 'EXIT'
child.stdin.write('EXIT\n')
child.stdin.flush()
assert child.wait(timeout=3) == 0
print('CHILD_EXITED', flush=True)
assert input() == 'FINAL_EXIT'
child.stdin.close()
child.stdout.close()
