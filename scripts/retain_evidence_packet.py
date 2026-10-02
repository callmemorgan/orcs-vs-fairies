#!/usr/bin/env python3
"""Retain an explicit sealed packet, including ignored files, and verify its index blobs.

Does not commit or execute packet files. Historical import scripts remain unchanged.
"""
import argparse
import datetime
import hashlib
import json
import pathlib
import stat
import subprocess
import sys


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def git(root, *args):
    return subprocess.run(['git', '-C', str(root), *args], check=True, capture_output=True).stdout


def read_original(path, length, digest, mode=None):
    path = pathlib.Path(path)
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode), f'Not a regular original: {path}')
    data = path.read_bytes()
    require(len(data) == length and sha(data) == digest, f'Original bytes differ: {path}')
    if mode is not None:
        require(stat.S_IMODE(info.st_mode) == int(mode, 8), f'Original mode differs: {path}')
    return data


def safe_destination(root, prefix, relative):
    path = pathlib.PurePosixPath(relative)
    require(not path.is_absolute() and '..' not in path.parts, f'Unsafe destination: {relative}')
    require(path.is_relative_to(prefix), f'Outside packet: {relative}')
    target = root / path
    for ancestor in [target, *target.parents]:
        if ancestor == root:
            break
        require(not ancestor.is_symlink(), f'Symlink in destination: {ancestor}')
    require(target.resolve().is_relative_to(root), f'Destination escapes repository: {relative}')
    return target


def retain(root, plan_path, plan_digest, expected_head):
    root = pathlib.Path(root).resolve()
    require(git(root, 'rev-parse', 'HEAD').decode().strip() == expected_head, 'Root HEAD changed')
    raw_plan = pathlib.Path(plan_path).read_bytes()
    require(sha(raw_plan) == plan_digest, 'Normalized plan seal differs')
    plan = json.loads(raw_plan)
    prefix = pathlib.PurePosixPath(plan['prefix'])
    require(prefix.is_relative_to('docs/evidence') and len(prefix.parts) > 2, 'Invalid packet prefix')
    read_original(plan['sourcePlan'], pathlib.Path(plan['sourcePlan']).stat().st_size, plan['sourcePlanSha256'])
    rows = plan['rows']
    require(len({r['destination'] for r in rows}) == len(rows), 'Duplicate destinations')
    verified = []
    # Complete source and destination preflight before any copy or staging.
    for row in rows:
        target = safe_destination(root, prefix, row['destination'])
        data = read_original(row['source'], row['bytes'], row['sha256'], row['mode'])
        if row.get('originalSource'):
            require(read_original(row['originalSource'], row['bytes'], row['sha256']) == data, 'Original source differs')
        if row.get('originalGitBlob'):
            require(git(root, 'cat-file', 'blob', row['originalGitBlob']) == data, 'Original Git blob differs')
        if target.exists():
            require(read_original(target, row['bytes'], row['sha256'], row['mode']) == data, 'Existing destination differs')
    immutable = []
    for row in plan.get('immutableReferences', []):
        identity = git(root, 'rev-parse', f"{row['commit']}:{row['repositoryPath']}").decode().strip()
        require(identity == row['gitBlob'], f"Immutable Git identity differs: {row['repositoryPath']}")
        immutable.append({**row, 'gitIdentityVerified': True, 'renewedFullByteHash': False})
    for row in rows:
        target = safe_destination(root, prefix, row['destination'])
        data = read_original(row['source'], row['bytes'], row['sha256'], row['mode'])
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            with target.open('xb') as handle:
                handle.write(data)
            target.chmod(int(row['mode'], 8))
        require(read_original(target, row['bytes'], row['sha256'], row['mode']) == data, 'Destination readback differs')
        ignored = subprocess.run(['git', '-C', str(root), 'check-ignore', '--no-index', '--quiet', '--', row['destination']], capture_output=True)
        require(ignored.returncode in (0, 1), f"Ignore check failed: {row['destination']}")
        verified.append({**row, 'sourceAndDestinationFullByteVerified': True, 'matchedIgnoreRule': ignored.returncode == 0})
    # Only the explicit packet allowlist is force-added. A failure exits before a success receipt.
    git(root, 'add', '-f', '--', *[r['destination'] for r in rows])
    for row in verified:
        blob = git(root, 'show', ':' + row['destination'])
        require(len(blob) == row['bytes'] and sha(blob) == row['sha256'], f"Index bytes differ: {row['destination']}")
        entry = git(root, 'ls-files', '-s', '--', row['destination']).decode().strip().split()
        expected_mode = '100755' if int(row['mode'], 8) & 0o111 else '100644'
        require(len(entry) >= 3 and entry[0] == expected_mode and entry[2] == '0', 'Index mode/stage differs')
        row.update(gitIndexFullByteVerified=True, gitBlob=entry[1], gitMode=entry[0])
    receipt = {
        'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'producer': {'harness': 'Codex', 'model': 'GPT-6', 'agent': '/root', 'scriptSha256': sha(pathlib.Path(__file__).read_bytes())},
        'interpreter': {'executable': sys.executable, 'version': sys.version, 'optimization': sys.flags.optimize},
        'rootHead': expected_head, 'normalizedPlanSha256': plan_digest,
        'sourcePlanSha256': plan['sourcePlanSha256'],
        'copiedFiles': len(rows), 'copiedBytes': sum(r['bytes'] for r in rows),
        'rows': verified, 'immutableReferences': immutable,
        'externalRawReferences': plan.get('externalRawReferences', []),
        'externalReferenceQualification': 'Original references preserved verbatim; no database, dependency-tree, or codec reads by this importer.',
        'outcome': plan.get('outcome'),
        'status': 'explicit_original_allowlist_full_byte_copy_and_git_index_verified',
        'authenticityLimit': 'Byte equality establishes retention against the supplied seals. It does not authenticate model identity or independent authorship of review artifacts.'
    }
    receipt_path = safe_destination(root, prefix, str(prefix / 'root-retention-v2.json'))
    require(not receipt_path.exists(), 'Success receipt already exists')
    receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt_path


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True)
    parser.add_argument('--plan', required=True)
    parser.add_argument('--plan-sha256', required=True)
    parser.add_argument('--expected-head', required=True)
    args = parser.parse_args()
    try:
        print(retain(args.root, args.plan, args.plan_sha256, args.expected_head))
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f'Retention failed: {error}', file=sys.stderr)
        sys.exit(1)
