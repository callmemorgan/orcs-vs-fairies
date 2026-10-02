import os
print('READY', flush=True)
if input() != 'SETSID':
    raise SystemExit(2)
os.setsid()
print('SETSID_DONE', flush=True)
if input() != 'EXIT':
    raise SystemExit(2)
