#!/usr/bin/env python3
"""Prepare an isolated content-only browser fixture without changing production."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
OVERRIDE = """

// Isolated browser verification fixture: only this copied content changes.
Object.assign(FACTIONS.orcs.units.worker, {
 id: 'fairy-worker',
 name: 'Grove Scrapper',
 hp: 95,
 cost: { wood: 35, ore: 0 },
 trainTime: 6,
 ability: 'illusion',
});
"""
WRAPPER = """import { defineConfig, mergeConfig } from 'vite';
import baseConfig from './vite.config';

// Keep dependency caches inside the fixture, outside symlinked node_modules.
export default defineConfig(async env => mergeConfig(
  typeof baseConfig === 'function' ? await baseConfig(env) : await baseConfig,
  { cacheDir: 'work/vite-cache' },
));
"""


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare(output: Path) -> None:
    output = output.resolve()
    work = (ROOT / 'work').resolve()
    if output == work or work not in output.parents:
        raise ValueError('The fixture must be a new directory inside project work/.')
    if output.exists():
        raise FileExistsError(f'Refusing to replace retained fixture: {output}. Choose another --output.')
    inputs = [ROOT / name for name in ('src', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts')]
    for path in inputs + [ROOT / 'node_modules', ROOT / 'public']:
        if not path.exists():
            raise FileNotFoundError(path)
    source_files = sorted(p for p in (ROOT / 'src').rglob('*') if p.is_file())
    originals = {str(p.relative_to(ROOT)): sha256(p) for p in source_files + inputs[1:]}
    output.mkdir(parents=True)
    for path in inputs:
        target = output / path.name
        if path.is_dir():
            shutil.copytree(path, target)
        else:
            shutil.copy2(path, target)
    for name in ('node_modules', 'public'):
        (output / name).symlink_to(ROOT / name, target_is_directory=True)
    content = output / 'src/core/content.ts'
    with content.open('ab') as stream:
        stream.write(OVERRIDE.encode('utf-8'))
    (output / 'vite.variant.config.ts').write_text(WRAPPER)
    package_path = output / 'package.json'
    package = json.loads(package_path.read_text())
    # The runner also avoids Vite's default node_modules/.vite-temp config bundle.
    package['scripts']['dev'] = 'vite --host 127.0.0.1 --config vite.variant.config.ts --configLoader runner'
    package_path.write_text(json.dumps(package, indent=2) + '\n')
    changed_source = [name for name, digest in originals.items() if name.startswith('src/') and sha256(output / name) != digest]
    if changed_source != ['src/core/content.ts']:
        raise RuntimeError(f'Unexpected copied source changes: {changed_source}')
    for name, digest in originals.items():
        if sha256(ROOT / name) != digest:
            raise RuntimeError(f'Primary source changed during preparation: {name}. Retain this fixture for inspection and prepare a new snapshot after edits settle.')
    metadata = {
        'createdAt': datetime.now(timezone.utc).isoformat(),
        'sourceRoot': str(ROOT), 'fixtureRoot': str(output),
        'sourceHashes': originals,
        'fixtureHashes': {name: sha256(output / name) for name in originals},
        'changedSourceFiles': changed_source,
        'fixtureSupportChanges': ['package.json dev script', 'vite.variant.config.ts'],
        'sharedReadOnlyUsage': {name: str(ROOT / name) for name in ('node_modules', 'public')},
        'override': {'faction': 'orcs', 'role': 'worker', 'id': 'fairy-worker', 'name': 'Grove Scrapper', 'hp': 95, 'cost': {'wood': 35, 'ore': 0}, 'trainTime': 6, 'ability': 'illusion'},
        'launch': 'npm run dev -- --port 5174',
        'browserUrl': 'http://127.0.0.1:5174/?qa=1',
        'status': 'prepared; browser verification not performed',
    }
    (output / 'fixture-manifest.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps({'fixture': str(output), 'changedSourceFiles': changed_source, 'launch': metadata['launch'], 'url': metadata['browserUrl']}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, epilog='Run only after current source edits settle. Never run npm install or asset generation inside the fixture; node_modules and public are shared symlinks.')
    parser.add_argument('--output', type=Path, default=ROOT / 'work/content-variant', help='New fixture directory inside project work/ (existing directories are never replaced).')
    arguments = parser.parse_args()
    prepare(arguments.output)
