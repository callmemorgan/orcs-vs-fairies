#!/usr/bin/env python3
"""HELD, UNEXECUTED recipe. Preserve raw bytes; create and verify sidecars only."""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import zlib

ROOT = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/ai-83941bc-retry-prep-r1/retention')
PACKET = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/work/ai-save401-final-453c221-r1')
SOURCE_PIN = '453c2218af9973b9eca8fb78392435bd9d46a740'
MANIFEST_SHA256 = 'bf8ed2449d14c0f3bcf00d32af4ca831885c08212be96fecc96ebd8d581ee681'
RAW_PATH = PACKET / 'server-data/server.sqlite'
RAW_BYTES = 222466048
RAW_SHA256 = '68634fdb8c709812659afbd36558b97ff98eb3874df918ef631355b106f346d5'
CHUNK = 1024 * 1024
MAX_ENCODED_BYTES = RAW_BYTES + 8 * CHUNK
READ_FLAGS = os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC
DIR_FLAGS = READ_FLAGS | os.O_DIRECTORY


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def signature(st):
    return (st.st_dev, st.st_ino, st.st_mode, st.st_size,
            st.st_mtime_ns, st.st_ctime_ns)


def identity(st):
    return (st.st_dev, st.st_ino, st.st_mode)


def stable_source(handle, initial):
    require(signature(os.fstat(handle.fileno())) == initial,
            'Source descriptor identity or metadata changed')
    require(signature(RAW_PATH.lstat()) == initial,
            'Source pathname identity or metadata changed')


def stable_directories(root_fd, run_fd, run_name):
    require(identity(ROOT.lstat()) == identity(os.fstat(root_fd)),
            'Pinned retention directory pathname changed')
    require(identity(os.stat(run_name, dir_fd=root_fd, follow_symlinks=False)) ==
            identity(os.fstat(run_fd)), 'Pinned run directory pathname changed')


def sidecar_stat(run_fd, name):
    return os.stat(name, dir_fd=run_fd, follow_symlinks=False)


def new_sidecar(run_fd, name):
    fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW |
                 os.O_CLOEXEC, 0o600, dir_fd=run_fd)
    return os.fdopen(fd, 'wb')


def read_sidecar(run_fd, name):
    fd = os.open(name, READ_FLAGS, dir_fd=run_fd)
    if not stat.S_ISREG(os.fstat(fd).st_mode):
        os.close(fd)
        raise RuntimeError('Sidecar is not a regular file')
    return os.fdopen(fd, 'rb')


def flush_file(handle):
    handle.flush()
    os.fsync(handle.fileno())


def decode_strict(run_fd, run_dir):
    """Reject extra gzip members, trailing bytes, truncation and excess output."""
    encoded_name, decoded_name = 'server.sqlite.gz', 'server.sqlite.decoded'
    decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
    encoded_hash = hashlib.sha256()
    encoded_bytes = decoded_bytes = 0
    encoded_initial = signature(sidecar_stat(run_fd, encoded_name))
    require(encoded_initial[3] <= MAX_ENCODED_BYTES,
            'Encoded artifact exceeds the retention input bound')
    with read_sidecar(run_fd, encoded_name) as encoded, new_sidecar(run_fd, decoded_name) as decoded:
        require(signature(os.fstat(encoded.fileno())) == encoded_initial,
                'Encoded descriptor differs from pinned artifact')
        while True:
            block = encoded.read(CHUNK)
            if not block:
                break
            encoded_hash.update(block)
            encoded_bytes += len(block)
            require(encoded_bytes <= MAX_ENCODED_BYTES,
                    'Encoded input exceeds the retention input bound')
            require(not decoder.eof, 'Bytes follow the first gzip member')
            pending = block
            while True:
                limit = min(CHUNK, RAW_BYTES - decoded_bytes + 1)
                require(limit > 0, 'Decoded bytes exceed the pinned raw size')
                chunk = decoder.decompress(pending, limit)
                decoded_bytes += len(chunk)
                require(decoded_bytes <= RAW_BYTES, 'Decoded bytes exceed the pinned raw size')
                decoded.write(chunk)
                pending = decoder.unconsumed_tail
                if decoder.eof:
                    require(not decoder.unused_data and not pending,
                            'Trailing bytes or another gzip member')
                    break
                if pending:
                    continue
                if not chunk:
                    break
                pending = b''
        require(decoder.eof, 'Truncated gzip member')
        require(not decoder.unused_data and not decoder.unconsumed_tail,
                'Unconsumed or trailing encoded bytes')
        require(decoded_bytes == RAW_BYTES, 'Decoded size differs from pinned raw size')
        flush_file(decoded)
        require(signature(os.fstat(encoded.fileno())) == encoded_initial,
                'Encoded descriptor changed during verification')
    require(signature(sidecar_stat(run_fd, encoded_name)) == encoded_initial,
            'Encoded artifact changed during verification')
    require(encoded_bytes == encoded_initial[3], 'Encoded byte count differs from file size')
    return {'path': str(run_dir / encoded_name), 'bytes': encoded_bytes,
            'sha256': encoded_hash.hexdigest()}


def compare_written_decoded(raw, run_fd, run_dir, initial):
    """Read back decoded sidecar, hash both streams, and compare every byte."""
    name = 'server.sqlite.decoded'
    raw.seek(0)
    raw_hash, decoded_hash = hashlib.sha256(), hashlib.sha256()
    total = 0
    decoded_initial = signature(sidecar_stat(run_fd, name))
    with read_sidecar(run_fd, name) as decoded:
        require(signature(os.fstat(decoded.fileno())) == decoded_initial,
                'Decoded descriptor differs from pinned artifact')
        while True:
            raw_chunk = raw.read(CHUNK)
            decoded_chunk = decoded.read(CHUNK)
            require(raw_chunk == decoded_chunk, 'Decoded sidecar differs from raw source')
            if not raw_chunk:
                break
            total += len(raw_chunk)
            require(total <= RAW_BYTES, 'Compared source exceeds pinned size')
            raw_hash.update(raw_chunk)
            decoded_hash.update(decoded_chunk)
        require(signature(os.fstat(decoded.fileno())) == decoded_initial,
                'Decoded descriptor changed during comparison')
    require(total == RAW_BYTES, 'Read-back byte count differs from pinned raw size')
    require(raw_hash.hexdigest() == RAW_SHA256, 'Raw source hash changed')
    require(decoded_hash.hexdigest() == RAW_SHA256, 'Decoded sidecar hash differs')
    require(signature(sidecar_stat(run_fd, name)) == decoded_initial,
            'Decoded artifact changed during comparison')
    stable_source(raw, initial)
    return {'path': str(run_dir / name), 'bytes': total,
            'sha256': decoded_hash.hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--heavy-slot-released', action='store_true',
                        help='Required acknowledgement after the current owner explicitly releases the slot')
    parser.add_argument('--run-name', required=True,
                        help='New directory name beneath the pinned retention directory')
    args = parser.parse_args()
    require(args.heavy_slot_released, 'Compression is HELD; explicit slot release is required')
    require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,63}', args.run_name),
            'Invalid run directory name')
    require(ROOT.is_dir() and not ROOT.is_symlink(), 'Pinned retention directory is unavailable')
    require(RAW_PATH.is_absolute() and not RAW_PATH.is_symlink(), 'Raw source must be a regular absolute path')
    manifest_bytes = (PACKET / 'final-manifest.json').read_bytes()
    require(hashlib.sha256(manifest_bytes).hexdigest() == MANIFEST_SHA256,
            'Sealed manifest hash differs')
    manifest = json.loads(manifest_bytes)
    require(manifest['sourcePin'] == SOURCE_PIN, 'Original source pin differs')
    require(manifest['files']['server-data/server.sqlite'] ==
            {'bytes': RAW_BYTES, 'sha256': RAW_SHA256}, 'Pinned raw record differs')
    root_fd = os.open(ROOT, DIR_FLAGS)
    run_fd = None
    try:
        require(identity(ROOT.lstat()) == identity(os.fstat(root_fd)),
                'Retention directory changed during open')
        os.mkdir(args.run_name, mode=0o700, dir_fd=root_fd)
        run_fd = os.open(args.run_name, DIR_FLAGS, dir_fd=root_fd)
        run_dir = ROOT / args.run_name
        stable_directories(root_fd, run_fd, args.run_name)
        result = {'state': 'unverified_failure', 'execution_performed': True,
                  'original_packet': str(PACKET), 'original_source_pin': SOURCE_PIN,
                  'sealed_manifest_sha256': MANIFEST_SHA256,
                  'raw': {'path': str(RAW_PATH), 'bytes': RAW_BYTES, 'sha256': RAW_SHA256},
                  'codec': {'format': 'single-member-gzip', 'compression_level': 6, 'mtime': 0,
                            'max_encoded_bytes': MAX_ENCODED_BYTES},
                  'encoded': None, 'decoded': None, 'full_byte_equality': None,
                  'source_stable': None, 'raw_removal_allowed': False}
        error = None
        try:
            fd = os.open(RAW_PATH, READ_FLAGS)
            with os.fdopen(fd, 'rb') as raw:
                initial_stat = os.fstat(raw.fileno())
                require(stat.S_ISREG(initial_stat.st_mode), 'Raw source is not a regular file')
                require(initial_stat.st_size == RAW_BYTES, 'Raw source size differs')
                initial = signature(initial_stat)
                stable_source(raw, initial)
                raw_hash = hashlib.sha256()
                total = 0
                with new_sidecar(run_fd, 'server.sqlite.gz') as encoded:
                    with gzip.GzipFile(filename='', mode='wb', compresslevel=6,
                                       fileobj=encoded, mtime=0) as compressor:
                        while True:
                            chunk = raw.read(CHUNK)
                            if not chunk:
                                break
                            total += len(chunk)
                            require(total <= RAW_BYTES, 'Raw source exceeds pinned size')
                            raw_hash.update(chunk)
                            compressor.write(chunk)
                    flush_file(encoded)
                require(total == RAW_BYTES and raw_hash.hexdigest() == RAW_SHA256,
                        'Raw source hash or byte count differs')
                stable_source(raw, initial)
                stable_directories(root_fd, run_fd, args.run_name)
                result['encoded'] = decode_strict(run_fd, run_dir)
                result['decoded'] = compare_written_decoded(raw, run_fd, run_dir, initial)
                stable_directories(root_fd, run_fd, args.run_name)
                result['full_byte_equality'] = True
                result['source_stable'] = True
                result['state'] = 'verified_lossless_sidecars_raw_retained'
                result['added_sidecar_bytes'] = result['encoded']['bytes'] + result['decoded']['bytes']
        except BaseException as caught:
            error = caught
            result['error'] = f'{type(caught).__name__}: {caught}'
        try:
            receipt_bytes = (json.dumps(result, indent=2) + '\n').encode()
            with new_sidecar(run_fd, 'result.json') as receipt:
                receipt.write(receipt_bytes)
                flush_file(receipt)
        except BaseException as receipt_error:
            if error is not None:
                raise error from receipt_error
            raise
        if error is not None:
            raise error
        print(json.dumps(result, indent=2))
    finally:
        if run_fd is not None:
            os.close(run_fd)
        os.close(root_fd)


if __name__ == '__main__':
    main()
