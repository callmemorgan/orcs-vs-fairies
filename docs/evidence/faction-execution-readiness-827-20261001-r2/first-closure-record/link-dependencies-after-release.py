import os
import subprocess
from pathlib import Path

if os.environ.get('OVF_FACTION_HEAVY_RELEASE') != '1':
    raise RuntimeError('Root must release execution first')
root = Path('/home/morgana/.codex/worktrees/faction-economy-cleanup/orcs-vs-Fairies')
pin = '827496b06bb660b6639257e5113ac2f199be29ba'
if subprocess.check_output(['git', '--no-replace-objects', 'rev-parse', 'HEAD'], cwd=root, text=True).strip() != pin:
    raise RuntimeError('Owned checkout must equal the integrated execution pin')
source = Path('/home/morgana/Projects/orcs-vs-Fairies/node_modules')
target = root / 'node_modules'
if not source.is_dir() or source.is_symlink():
    raise RuntimeError('Installed dependency source must be a real directory')
if target.exists() or target.is_symlink():
    raise RuntimeError('Owned dependency directory must be absent')
links = []
for entry in source.iterdir():
    if entry.name.startswith('.') and entry.name != '.bin':
        continue
    resolved = entry.resolve(strict=True)
    if not resolved.is_relative_to(source.resolve(strict=True)):
        raise RuntimeError('Installed dependency target escapes its authenticated root: ' + entry.name)
    links.append((entry.name, resolved, entry.is_dir()))
target.mkdir()
for name, resolved, is_directory in links:
    (target / name).symlink_to(resolved, target_is_directory=is_directory)
print('Linked installed packages without changing package files; Vite cache directories remain private to the owned checkout.')
