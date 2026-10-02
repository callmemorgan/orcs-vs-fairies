import os
import sys
print('READY', flush=True)
if input() != 'CHDIR':
    raise SystemExit(2)
os.chdir(sys.argv[1])
print('CHDIR_DONE', flush=True)
if input() != 'EXEC':
    raise SystemExit(2)
print('EXECING_SLEEP', flush=True)
os.execv('/usr/bin/sleep', ['/usr/bin/sleep', '0.8'])
