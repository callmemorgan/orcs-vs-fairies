#!/usr/bin/env python3
"""Retain 195 native entries and verify all 590 derivative representations."""
import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess

WORK = Path(__file__).resolve().parent
REPO = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
PACKET = REPO / 'work/ai-save401-final-453c221-r1'
RET = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/ai-83941bc-retry-prep-r1/retention')
ACTUAL = RET / 'retained-actual-r1'
PUBLIC = RET / 'restore-public-r1'
CODEC = RET / 'sqlite-codec-r1'
PIN = '453c2218af9973b9eca8fb78392435bd9d46a740'
NEW_PIN = '83941bc80ce9ec08840b0645d9b33e8018d5309a'
SEAL = 'bf8ed2449d14c0f3bcf00d32af4ca831885c08212be96fecc96ebd8d581ee681'
CHUNK = 1024 * 1024

def require(condition, message):
    if not condition:
        raise RuntimeError(message)

def signature(st):
    return (st.st_dev, st.st_ino, st.st_mode, st.st_size, st.st_mtime_ns, st.st_ctime_ns)

def read_file(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    handle = os.fdopen(fd, 'rb')
    require(stat.S_ISREG(os.fstat(fd).st_mode), 'Non-regular input: ' + str(path))
    return handle

def equal_files(source, target, expected):
    initial = signature(source.lstat())
    target_initial = signature(target.lstat())
    sha = hashlib.sha256()
    total = 0
    with read_file(source) as left, read_file(target) as right:
        require(signature(os.fstat(left.fileno())) == initial, 'Source identity differs')
        require(signature(os.fstat(right.fileno())) == target_initial, 'Target identity differs')
        while True:
            a, b = left.read(CHUNK), right.read(CHUNK)
            require(a == b, 'Bytes differ: ' + str(target))
            if not a:
                break
            total += len(a)
            sha.update(a)
        require(signature(os.fstat(left.fileno())) == initial, 'Source descriptor changed')
        require(signature(os.fstat(right.fileno())) == target_initial, 'Target descriptor changed')
    require(signature(source.lstat()) == initial, 'Source path changed')
    require(signature(target.lstat()) == target_initial, 'Target path changed')
    require({'bytes': total, 'sha256': sha.hexdigest()} == expected, 'Sealed bytes differ')
    return {'bytes': total, 'sha256': sha.hexdigest(), 'full_byte_equality': True}

def digest(path):
    sha = hashlib.sha256()
    total = 0
    with read_file(path) as handle:
        while block := handle.read(CHUNK):
            total += len(block)
            sha.update(block)
    return {'bytes': total, 'sha256': sha.hexdigest()}

def write_json(path, value):
    with path.open('x') as handle:
        json.dump(value, handle, indent=2)
        handle.write('\n')

def rows(name):
    with (WORK / 'metadata' / name).open(newline='') as handle:
        return list(csv.DictReader(handle, delimiter='\t'))

def manifest():
    raw = (PACKET / 'final-manifest.json').read_bytes()
    require(hashlib.sha256(raw).hexdigest() == SEAL, 'Original seal differs')
    value = json.loads(raw)
    require(value['sourcePin'] == PIN and len(value['files']) == 590, 'Manifest scope differs')
    return value, raw

def copy_actual():
    value, raw = manifest()
    native = [r for r in rows('retain-actual-bytes.tsv') if r['original_path'] != 'server-data/server.sqlite']
    require(len(native) == 195 and sum(int(r['original_bytes']) for r in native) == 82174828,
            'Actual-byte subset differs')
    require(len({r['original_path'] for r in native}) == 195, 'Duplicate native path')
    ACTUAL.mkdir(mode=0o700, exist_ok=False)
    records = []
    for row in native:
        rel = row['original_path']
        require(not Path(rel).is_absolute() and '..' not in Path(rel).parts, 'Unsafe path')
        expected = value['files'][rel]
        require(expected == {'bytes': int(row['original_bytes']), 'sha256': row['original_sha256']},
                'Native index record differs')
        source, target = PACKET / rel, ACTUAL / rel
        initial = signature(source.lstat())
        target.parent.mkdir(parents=True, exist_ok=True)
        with read_file(source) as left, target.open('xb') as right:
            require(signature(os.fstat(left.fileno())) == initial, 'Native source identity differs')
            while block := left.read(CHUNK):
                right.write(block)
            right.flush()
            os.fsync(right.fileno())
            require(signature(os.fstat(left.fileno())) == initial, 'Native source changed while copying')
        require(signature(source.lstat()) == initial, 'Native source path changed')
        records.append({'path': rel, **equal_files(source, target, expected)})
    with (ACTUAL / 'final-manifest.json').open('xb') as handle:
        handle.write(raw)
    require((ACTUAL / 'final-manifest.json').read_bytes() == raw, 'Copied seal differs')
    result = {'state': 'retained_and_full_byte_verified', 'original_source_pin': PIN,
              'original_manifest_sha256': SEAL, 'entries': len(records),
              'bytes': sum(r['bytes'] for r in records), 'files': records,
              'extra_copied_manifest': {'bytes': len(raw), 'sha256': SEAL},
              'raw_sqlite_included': False, 'original_packet_mutated': False}
    write_json(ACTUAL / 'retained-result.json', result)
    print(json.dumps({k: v for k, v in result.items() if k != 'files'}, indent=2))

def verify():
    value, raw = manifest()
    codec = json.loads((CODEC / 'result.json').read_text())
    require(codec['state'] == 'verified_lossless_sidecars_raw_retained' and
            codec['full_byte_equality'] is True and codec['source_stable'] is True and
            codec['raw_removal_allowed'] is False, 'Codec result differs')
    for key in ('encoded', 'decoded'):
        require(digest(Path(codec[key]['path'])) == {k: codec[key][k] for k in ('bytes','sha256')},
                'Codec sidecar readback differs')
    public_rows = rows('source-backed-public-duplicates.tsv')
    native_rows = rows('retain-actual-bytes.tsv')
    public_set = {r['original_path'] for r in public_rows}
    native_set = {r['original_path'] for r in native_rows}
    require(len(public_set) == 394 and len(native_set) == 196 and not (public_set & native_set),
            'Partition differs')
    require(public_set | native_set == set(value['files']), 'Partition does not cover all 590 files')
    records = []
    for rel, expected in sorted(value['files'].items()):
        if rel == 'server-data/server.sqlite':
            target, representation = CODEC / 'server.sqlite.decoded', 'verified_gzip_decoded_sidecar'
        elif rel in public_set:
            target, representation = PUBLIC / rel, 'restored_pinned_git_public_blob'
        else:
            target, representation = ACTUAL / rel, 'retained_actual_bytes'
        records.append({'path': rel, 'derivative_path': str(target), 'representation': representation,
                        **equal_files(PACKET / rel, target, expected)})
    require((ACTUAL / 'final-manifest.json').read_bytes() == raw, 'Copied original manifest differs')
    for pin in (PIN, NEW_PIN):
        subprocess.run(['git','cat-file','-e',pin+'^{commit}'],cwd=REPO,check=True)
    require(subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO).decode().strip() == PIN,
            'Checkout pin changed')
    require(not subprocess.check_output(['git','status','--porcelain=v1','--untracked-files=no'],cwd=REPO),
            'Tracked checkout changed')
    raw_bytes, encoded_bytes = codec['raw']['bytes'], codec['encoded']['bytes']
    savings = raw_bytes - encoded_bytes
    result = {'state':'all_590_derivative_representations_full_byte_equal',
              'original_source_pin':PIN,'public_comparison_source_pin':NEW_PIN,
              'original_manifest_sha256':SEAL,'entries':len(records),
              'bytes':sum(r['bytes'] for r in records),'files':records,
              'sqlite':{'raw':codec['raw'],'encoded':codec['encoded'],'decoded':codec['decoded'],
                        'full_byte_equality':True,'representation_saved_bytes':savings,
                        'representation_saved_percent':savings/raw_bytes*100},
              'retained_native_entries':195,'retained_native_bytes':82174828,
              'restored_public_entries':394,'restored_public_bytes':68373454,
              'derivative_payload_bytes_excluding_public_restore_and_decoded_proof':82174828+encoded_bytes,
              'raw_originals_retained':True,'decoded_proof_retained':True,
              'local_disk_reclaimed_bytes':0,
              'git_object_store':str(REPO), 'git_pinned_commit_objects_reachable':True,
              'scope':'Old 453 packet only; hosted failed SQLite excluded; no acceptance results relabeled.'}
    write_json(WORK / 'receipts' / 'full-derivative-equality.json', result)
    print(json.dumps({k:v for k,v in result.items() if k != 'files'},indent=2))

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('mode',choices=['copy','verify'])
args = parser.parse_args()
copy_actual() if args.mode == 'copy' else verify()
