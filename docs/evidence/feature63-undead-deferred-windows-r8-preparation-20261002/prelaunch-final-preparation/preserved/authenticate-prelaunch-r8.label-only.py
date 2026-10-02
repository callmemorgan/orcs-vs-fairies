#!/usr/bin/env python3
import sys

if sys.flags.optimize != 0:
    raise RuntimeError('Optimized Python is forbidden before any authority input is read')

from pathlib import Path, PurePosixPath
import ast
import datetime
import hashlib
import json
import os
import re
import stat
import subprocess

ROOT = Path('/home/morgana/Projects/orcs-vs-Fairies')
OWNED = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
RELATIVE_PREFIX = 'work/feature63-human-wave-composition-r8'
PREFIX = OWNED / RELATIVE_PREFIX
MAX_DEFINITION_BYTES = 4 * 1024 * 1024
MAX_MEMBER_BYTES = 2 * 1024 * 1024 * 1024
REPORT_NAME = 'root-independent-prelaunch-readback.json'
EXPECTATION_SCHEMA = 'feature63-r8-root-prelaunch-expectation-v1'
REVIEW = {
    'path': '/tmp/ovf-feature63-r8-final-static-independent-review-upsx1DQX/review.json',
    'bytes': 10341, 'mode': 0o644,
    'sha256': '9be9b64bdd2a5637bed71ad6d8a36423b0e4242c3f1bd9afe519f172f3c9bd53',
}
TEMPLATE = {
    'path': '/tmp/ovf-feature63-static-prep-r3-zsttudqb/independent-launcher/launch-capture.r3.template.py',
    'bytes': 19356, 'mode': 0o600,
    'sha256': '1b99137e822c004361ee4ff1906f10f4284453312914092441666dd721f0feb3',
}
PRODUCT = {
    'path': '/tmp/ovf-main402-remaining-2e5-r1/tested-product-before.json',
    'bytes': 101264, 'mode': 0o644,
    'sha256': '582f809d9a4e0180dd3d59147b7edfd881b091334f715d86bd56ea93c9db4a06',
}
PROTECTED = {
    'path': '/tmp/ovf-main402-remaining-2e5-r1/protected-before.json',
    'bytes': 74175, 'mode': 0o644,
    'sha256': 'ed80088ef418debe90883929c364a588521815d14dbdd9703d8c6927c5855a5b',
}
PRODUCT_GIT_PATH = 'docs/evidence/main402-remaining-witness-2e5-20261001/raw/tested-product-before.json'
PROTECTED_GIT_PATH = 'docs/evidence/main402-remaining-witness-2e5-20261001/raw/protected-before.json'
PACKET = Path('/tmp/ovf-root-feature63-r8-static-packet-9l53j4bl')
REVIEWED = {
    'wrapper': ('script-candidates/candidates/run-minimal63.py', 54514,
                '054a652dff3c718fbc0d8b1093578a1e7b9c37badd9cde60c1e4f0f3572713f0'),
    'producer': ('script-candidates/candidates/public-producer.mjs', 54689,
                 '6c8e203732d9e33a72645fa55c9bee4b1e6148725c4b88c9db2d3ea3c9c1c8eb'),
    'collector': ('script-candidates/candidates/collect-launched-waves.py', 18600,
                  'd6b1eee12bca979a0ff77a7fde7e7d9dbea22bb569ef2055cbdf7da871ec20ec'),
    'frozenAuditor': ('script-candidates/originals/native-audit.py', 64185,
                      '4862672ef96aba39799d3ef9c6280be9fbeaa8194391b3f2b5acefb5e7cd76fb'),
    'bindingUtility': ('binding-utility/fresh-r8-bindings.py', 23873,
                       'bbeb0bc68b2dd5cd24679f8ade43baa2403d748e9877a7e24bcf2c7fe1c1dc02'),
}
SCRIPT_NAMES = {
    'wrapper': 'run-minimal63.py', 'producer': 'public-producer.mjs',
    'collector': 'collect-launched-waves.py', 'frozenAuditor': 'native-audit.py',
}
BINDING_NAMES = {
    'sourceBinding': 'source-binding.json', 'buildBinding': 'build-binding.json',
    'testedBuildReceipt': 'tested-build.json', 'reviewReceipt': 'root-review.json',
    'browserBinding': 'browser-binding.json',
}
OUTPUT_NAMES = set(BINDING_NAMES.values()) | {
    'root-fresh-package-result.json', 'capture-assignment.json',
    'root-capture-disposition.json', 'launch-capture.r8.py',
}
FILES = {}
DIRECTORIES = {}
COMPLETE_SETS = {}


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def identity(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns,
            info.st_ctime_ns, info.st_mode, info.st_nlink, info.st_uid, info.st_gid)


def canonical(path):
    require(isinstance(path, (str, Path)), 'Path must be a string or Path')
    path = Path(path)
    require(path.is_absolute() and path.resolve() == path and not path.is_symlink(),
            'Noncanonical or symlinked path: ' + str(path))
    return path


def stable_read(path, cap):
    path = canonical(path)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and 0 <= before.st_size <= cap,
                'Nonregular or oversized file: ' + str(path))
        chunks = []
        remaining = before.st_size
        while remaining:
            chunk = os.read(fd, min(remaining, 1024 * 1024))
            require(bool(chunk), 'Short file read: ' + str(path))
            chunks.append(chunk)
            remaining -= len(chunk)
        require(not os.read(fd, 1), 'File grew while reading: ' + str(path))
        after = os.fstat(fd)
        named = path.lstat()
        require(identity(before) == identity(after) == identity(named),
                'File changed while reading: ' + str(path))
        return b''.join(chunks), before
    finally:
        os.close(fd)


def descriptor_shape(desc, with_mode):
    keys = {'path', 'bytes', 'sha256'} | ({'mode'} if with_mode else set())
    require(type(desc) is dict and set(desc) == keys, 'Descriptor fields differ')
    canonical(desc['path'])
    require(type(desc['bytes']) is int and 0 <= desc['bytes'] <= MAX_MEMBER_BYTES,
            'Descriptor byte count differs')
    require(type(desc['sha256']) is str and re.fullmatch('[0-9a-f]{64}', desc['sha256']),
            'Descriptor SHA-256 differs')
    if with_mode:
        require(type(desc['mode']) is int and 0 <= desc['mode'] <= 0o7777,
                'Descriptor mode must be an integer permission mode')


def without_mode(desc):
    return {key: desc[key] for key in ('path', 'bytes', 'sha256')}


def verified_file(expected, keep_raw=False, cap=MAX_MEMBER_BYTES):
    descriptor_shape(expected, 'mode' in expected)
    path = Path(expected['path'])
    if path in FILES:
        entry = FILES[path]
        require(identity(path.lstat()) == entry['identity'], 'Verified file changed: ' + str(path))
    else:
        raw, info = stable_read(path, cap)
        actual = {'path': str(path), 'bytes': len(raw), 'sha256': sha256(raw),
                  'mode': stat.S_IMODE(info.st_mode)}
        entry = {'descriptor': actual, 'identity': identity(info), 'parsed': False}
        if keep_raw:
            entry['raw'] = raw
        FILES[path] = entry
    require({key: entry['descriptor'][key] for key in expected} == expected,
            'Bound file descriptor differs: ' + str(path))
    require(entry['descriptor']['bytes'] <= cap, 'Bound file exceeds size cap: ' + str(path))
    require(not keep_raw or 'raw' in entry, 'Definition buffer was not retained: ' + str(path))
    return entry


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, 'Duplicate JSON object key: ' + key)
        value[key] = item
    return value


def reject_constant(value):
    raise RuntimeError('Nonfinite JSON number: ' + value)


def parsed(entry):
    if not entry['parsed']:
        entry['value'] = json.loads(entry['raw'], object_pairs_hook=unique_object,
                                    parse_constant=reject_constant)
        entry['parsed'] = True
    return entry['value']


def definition(expected):
    return verified_file(expected, keep_raw=True, cap=MAX_DEFINITION_BYTES)


def directory(path, private=False, empty=False):
    path = canonical(path)
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        require(stat.S_ISDIR(before.st_mode), 'Not a directory: ' + str(path))
        if private:
            require(stat.S_IMODE(before.st_mode) == 0o700 and before.st_uid == os.getuid(),
                    'Directory is not private and UID-owned: ' + str(path))
        names = set(os.listdir(fd))
        require(not empty or not names, 'Directory is not empty: ' + str(path))
        require(identity(before) == identity(os.fstat(fd)) == identity(path.lstat()),
                'Directory changed during inspection: ' + str(path))
        if path in DIRECTORIES:
            require(DIRECTORIES[path] == identity(before), 'Previously inspected directory changed: ' + str(path))
        else:
            DIRECTORIES[path] = identity(before)
        return names
    finally:
        os.close(fd)


def relative_path(value):
    require(type(value) is str and value and '\\' not in value and '\x00' not in value,
            'Invalid inventory relative path')
    path = PurePosixPath(value)
    require(not path.is_absolute() and str(path) == value and
            all(part not in ('', '.', '..') for part in path.parts),
            'Noncanonical inventory relative path: ' + value)
    require(not any(part in ('server-data', 'browser-profile') for part in path.parts) and
            not re.search(r'\.(?:sqlite(?:3)?|db)(?:-(?:wal|shm|journal))?$', value),
            'Runtime database/profile member is forbidden: ' + value)
    return Path(value)


def normalized_rows(rows):
    require(type(rows) is list, 'Inventory must be a list')
    result = {}
    for row in rows:
        require(type(row) is dict and set(row) == {'path', 'bytes', 'sha256', 'mode'},
                'Inventory record fields differ')
        name = str(relative_path(row['path']))
        require(name not in result, 'Duplicate inventory path: ' + name)
        permission = row['mode']
        if type(permission) is str:
            require(re.fullmatch('(?:0o)?0?[0-7]{3,4}', permission), 'Invalid octal inventory mode')
            permission = int(permission, 8)
        require(type(permission) is int and 0 <= permission <= 0o7777, 'Invalid inventory mode')
        require(type(row['bytes']) is int and 0 <= row['bytes'] <= MAX_MEMBER_BYTES,
                'Invalid inventory byte count')
        require(type(row['sha256']) is str and re.fullmatch('[0-9a-f]{64}', row['sha256']),
                'Invalid inventory SHA-256')
        result[name] = {**row, 'mode': permission}
    return result


def complete_names(base):
    base = canonical(base)
    files = set()
    pending = [base]
    while pending:
        current = pending.pop()
        directory(current)
        with os.scandir(current) as members:
            for member in members:
                path = Path(member.path)
                info = member.stat(follow_symlinks=False)
                require(not stat.S_ISLNK(info.st_mode), 'Symlinked inventory member: ' + str(path))
                if stat.S_ISDIR(info.st_mode):
                    pending.append(path)
                else:
                    require(stat.S_ISREG(info.st_mode), 'Nonregular inventory member: ' + str(path))
                    files.add(str(path.relative_to(base)))
        require(identity(current.lstat()) == DIRECTORIES[current], 'Inventory directory changed: ' + str(current))
    return files


def authenticate_inventory(base, rows, count, complete=False):
    base = canonical(base)
    records = normalized_rows(rows)
    require(len(records) == count, 'Inventory count differs: ' + str(base))
    if complete:
        names = complete_names(base)
        require(names == set(records), 'Complete inventory filenames differ: ' + str(base))
        COMPLETE_SETS[base] = names
    for name, row in records.items():
        verified_file({**row, 'path': str(base / name)})
    return records


def git_bytes(base, args):
    return subprocess.check_output(['git', '-c', 'core.fsmonitor=false', '--no-optional-locks'] + args,
                                   cwd=base, env=dict(os.environ, GIT_OPTIONAL_LOCKS='0'))


def clean_checkouts(pin):
    for base in (ROOT, OWNED):
        require(git_bytes(base, ['rev-parse', 'HEAD']).decode().strip() == pin,
                'Checkout HEAD differs from expected future pin: ' + str(base))
        require(git_bytes(base, ['status', '--porcelain', '--untracked-files=no']) == b'',
                'Tracked checkout is dirty: ' + str(base))


def flags(value, names, label):
    require(all(value.get(name) is True for name in names), label + ' approval flags differ')


def check_slot(slot, expected_token):
    require(type(slot) is dict and set(slot) == {'approved', 'holder', 'token', 'validUntil'},
            'Exclusive slot fields differ')
    require(slot['approved'] is True and slot['holder'] == '/root/ai_modes' and
            slot['token'] == expected_token, 'Exclusive slot relationship differs')
    require(type(slot['validUntil']) is str, 'Slot expiry must be a string')
    expiry = datetime.datetime.fromisoformat(slot['validUntil'])
    require(expiry.tzinfo is not None and expiry.utcoffset() == datetime.timedelta(0),
            'Slot expiry must be UTC')
    remaining = (expiry - datetime.datetime.now(datetime.timezone.utc)).total_seconds()
    require(remaining > 510, 'Exclusive slot has no more than 510 seconds remaining')
    return remaining


def proc_bytes(path, cap):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        chunks = []
        total = 0
        while True:
            chunk = os.read(fd, min(65536, cap + 1 - total))
            if not chunk:
                return b''.join(chunks)
            chunks.append(chunk)
            total += len(chunk)
            require(total <= cap, 'Oversized proc read: ' + str(path))
    finally:
        os.close(fd)


def protected_snapshot(expected):
    base = Path('/proc/1063')

    def process_stat():
        raw = proc_bytes(base / 'stat', 65536).decode()
        require(raw.startswith('1063 ('), 'Protected PID stat differs')
        fields = raw[raw.rfind(')') + 2:].split()
        require(len(fields) >= 20 and fields[0] not in ('Z', 'X'), 'Protected process is absent or exited')
        return {'pid': 1063, 'startTicks': int(fields[19]), 'session': int(fields[3])}

    first = process_stat()
    cwd_one = os.readlink(base / 'cwd')
    exe_one = os.readlink(base / 'exe')
    argv_one = proc_bytes(base / 'cmdline', 65536)
    socket_one = os.readlink(base / 'fd/22')
    namespace_one = os.readlink(base / 'ns/net')
    argv_two = proc_bytes(base / 'cmdline', 65536)
    cwd_two = os.readlink(base / 'cwd')
    exe_two = os.readlink(base / 'exe')
    socket_two = os.readlink(base / 'fd/22')
    namespace_two = os.readlink(base / 'ns/net')
    second = process_stat()
    require(first == second == {'pid': 1063, 'startTicks': 874, 'session': 1063},
            'Protected PID/start/SID changed')
    require(argv_one == argv_two and argv_one.endswith(b'\0'), 'Protected argv changed or lacks terminal NUL')
    argv = [part.decode(errors='surrogateescape') for part in argv_one[:-1].split(b'\0')]
    observed = {'pid': 1063, 'startTicks': 874, 'cwd': cwd_two, 'executable': exe_two, 'argv': argv}
    require(observed == expected and cwd_one == cwd_two and exe_one == exe_two,
            'Protected current argv/cwd/executable differs from bound assignment')
    require(socket_one == socket_two == 'socket:[3783]', 'Protected fd22 differs')
    require(namespace_one == namespace_two == os.readlink('/proc/self/ns/net'), 'Protected network namespace differs')
    return {'process': observed, 'session': 1063, 'fd22': socket_two, 'networkNamespace': namespace_two}


def listeners():
    ports = {4173: set(), 5373: set(), 5374: set()}
    for name in ('tcp', 'tcp6'):
        raw = proc_bytes(Path('/proc/self/net') / name, 4 * 1024 * 1024).decode()
        lines = raw.splitlines()
        require(lines and 'local_address' in lines[0], 'Malformed listener table')
        for line in lines[1:]:
            row = line.split()
            require(len(row) >= 10, 'Short listener table row')
            port = int(row[1].rsplit(':', 1)[1], 16)
            if row[3] == '0A' and port in ports:
                ports[port].add('socket:[' + row[9] + ']')
    result = {str(port): sorted(values) for port, values in ports.items()}
    require(result == {'4173': ['socket:[3783]'], '5373': [], '5374': []},
            'Protected/private listener state differs')
    return result


def revalidate_files_and_sets():
    for path, entry in FILES.items():
        require(canonical(path) == path and identity(path.lstat()) == entry['identity'],
                'Authenticated file changed before report: ' + str(path))
    for path, expected in DIRECTORIES.items():
        require(canonical(path) == path and identity(path.lstat()) == expected,
                'Authenticated directory changed before report: ' + str(path))
    for base, names in COMPLETE_SETS.items():
        require(complete_names(base) == names, 'Complete filename set changed before report: ' + str(base))


def write_report(report_directory, value):
    directory(report_directory, private=True, empty=True)
    fd = os.open(report_directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        require(identity(os.fstat(fd)) == DIRECTORIES[report_directory] == identity(report_directory.lstat()),
                'Report directory identity changed')
        require(not os.listdir(fd), 'Report directory ceased to be empty')
        value['slotSecondsRemainingAtFinalGate'] = check_slot(value['slot'], value['slot']['token'])
        raw = (json.dumps(value, indent=2, sort_keys=True) + '\n').encode()
        # First and only filesystem write. O_EXCL makes this expectation one-shot.
        report_fd = os.open(REPORT_NAME, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                            0o400, dir_fd=fd)
        try:
            offset = 0
            while offset < len(raw):
                written = os.write(report_fd, raw[offset:])
                require(written > 0, 'Short report write')
                offset += written
            os.fsync(report_fd)
            info = os.fstat(report_fd)
            require(stat.S_ISREG(info.st_mode) and stat.S_IMODE(info.st_mode) == 0o400 and
                    info.st_nlink == 1 and info.st_size == len(raw), 'Final report metadata differs')
            require(identity(info) == identity(os.stat(REPORT_NAME, dir_fd=fd, follow_symlinks=False)),
                    'Final report named identity differs')
        finally:
            os.close(report_fd)
        os.fsync(fd)
        require(identity(os.fstat(fd)) == identity(report_directory.lstat()), 'Final report directory identity differs')
    finally:
        os.close(fd)
    actual_raw, actual_info = stable_read(report_directory / REPORT_NAME, MAX_DEFINITION_BYTES)
    require(actual_raw == raw and stat.S_IMODE(actual_info.st_mode) == 0o400,
            'Saved immutable report differs from completed report bytes')
    return {'path': str(report_directory / REPORT_NAME), 'bytes': len(actual_raw),
            'sha256': sha256(actual_raw), 'mode': 0o400}


def main():
    require(sys.flags.optimize == 0 and 'PYTHONOPTIMIZE' not in os.environ,
            'Invoke with PYTHONOPTIMIZE removed and without -O/-OO')
    require(len(sys.argv) == 3, 'Usage: authenticate-prelaunch-r8.py EXPECTATION_JSON EXPECTATION_SHA256')
    expectation_path = canonical(sys.argv[1])
    expected_sha = sys.argv[2]
    require(re.fullmatch('[0-9a-f]{64}', expected_sha), 'Expectation SHA-256 must be lowercase')
    raw, info = stable_read(expectation_path, MAX_DEFINITION_BYTES)
    require(sha256(raw) == expected_sha, 'Root expectation digest differs')
    expectation_descriptor = {'path': str(expectation_path), 'bytes': len(raw),
                              'sha256': expected_sha, 'mode': stat.S_IMODE(info.st_mode)}
    require(info.st_uid == os.getuid() and stat.S_IMODE(info.st_mode) in (0o400, 0o600),
            'Root expectation must be UID-owned and mode 0400 or 0600')
    expectation_entry = {'descriptor': expectation_descriptor, 'identity': identity(info),
                         'raw': raw, 'parsed': False}
    FILES[expectation_path] = expectation_entry
    expectation = parsed(expectation_entry)
    expected_keys = {'schema', 'sourcePin', 'bindingDirectory', 'controlDirectory', 'reportDirectory',
                     'readback', 'assignment', 'launcher', 'disposition', 'r8StaticReview', 'launcherTemplate'}
    require(type(expectation) is dict and set(expectation) == expected_keys and
            expectation['schema'] == EXPECTATION_SCHEMA, 'Root expectation schema/fields differ')
    pin = expectation['sourcePin']
    require(type(pin) is str and re.fullmatch('[0-9a-f]{40}', pin), 'Future pin must be a full lowercase commit ID')
    binding = canonical(expectation['bindingDirectory'])
    control = canonical(expectation['controlDirectory'])
    report_directory = canonical(expectation['reportDirectory'])
    for path, pattern in ((binding, 'ovf-root-feature63-r8-bindings-[A-Za-z0-9_-]+'),
                          (control, 'ovf-feature63-r8-capture-control-[A-Za-z0-9_-]+'),
                          (report_directory, 'ovf-feature63-r8-prelaunch-report-[A-Za-z0-9_-]+')):
        require(path.parent == Path('/tmp') and re.fullmatch(pattern, path.name),
                'Unexpected external directory: ' + str(path))
    require(len({binding, control, report_directory}) == 3 and
            expectation_path.parent not in (binding, control, report_directory),
            'Authority/report/control directories overlap')
    directory(binding, private=True)
    directory(control, private=True, empty=True)
    directory(report_directory, private=True, empty=True)
    require(expectation['r8StaticReview'] == REVIEW and expectation['launcherTemplate'] == TEMPLATE,
            'Root review or frozen template anchor differs')
    top_names = {'readback': 'root-binding-readback.json', 'assignment': 'capture-assignment.json',
                 'launcher': 'launch-capture.r8.py', 'disposition': 'root-capture-disposition.json'}
    top = {}
    for key, name in top_names.items():
        desc = expectation[key]
        descriptor_shape(desc, True)
        require(desc['path'] == str(binding / name) and desc['mode'] == (0o600 if key == 'launcher' else 0o644),
                'Root supplied artifact path/mode differs: ' + key)
        top[key] = definition(desc)
    review_entry = definition(REVIEW)
    template_entry = definition(TEMPLATE)
    review = parsed(review_entry)
    require(review.get('schema') == 'feature63-r8-final-static-independent-review-v1' and
            review.get('status') == 'PASS_STATIC_R8_UNDEAD_DEFERRED_WINDOWS_RUNTIME_HELD' and
            review.get('runtimeExecuted') is False, 'Known R8 review scope differs')
    require(review.get('captureAuthorization', {}).get('authorizedByThisReview') is False,
            'Static review cannot authorize capture')
    reviewed_files = review.get('reviewedFiles')
    require(type(reviewed_files) is list and len(reviewed_files) == 5, 'Five reviewed roles are required')
    roles = {}
    for row in reviewed_files:
        require(type(row) is dict and set(row) == {'role', 'path', 'bytes', 'sha256'} and
                row['role'] in REVIEWED and row['role'] not in roles, 'Reviewed role fields/set differ')
        role = row['role']
        relative, byte_count, digest = REVIEWED[role]
        expected = {'path': str(PACKET / relative), 'bytes': byte_count, 'sha256': digest}
        require(without_mode(row) == expected, 'Fixed reviewed role descriptor differs: ' + role)
        verified_file(expected)
        roles[role] = expected
    require(set(roles) == set(REVIEWED), 'Reviewed role set differs')

    readback = parsed(top['readback'])
    assignment = parsed(top['assignment'])
    disposition = parsed(top['disposition'])
    require(readback.get('schema') == 1 and readback.get('sourcePin') == pin and
            readback.get('runtimeExecuted') is False, 'Readback pin/schema/runtime scope differs')
    require(readback.get('r8StaticReview') == without_mode(REVIEW) and
            readback.get('captureAssignment') == without_mode(expectation['assignment']) and
            readback.get('launcher') == without_mode(expectation['launcher']) and
            readback.get('freshControl') == str(control), 'Readback authority relationships differ')
    output_records = normalized_rows(readback.get('completeOutputRecords'))
    require(set(output_records) == OUTPUT_NAMES, 'Readback output inventory must contain the nine generated files')
    require(directory(binding, private=True) == OUTPUT_NAMES | {'root-binding-readback.json'},
            'Generated binding directory filenames differ')
    COMPLETE_SETS[binding] = OUTPUT_NAMES | {'root-binding-readback.json'}
    output_entries = {}
    for name, row in output_records.items():
        require(row['mode'] == (0o600 if name == 'launch-capture.r8.py' else 0o644),
                'Generated file mode differs: ' + name)
        output_entries[name] = definition({**row, 'path': str(binding / name)})
    for key, name in top_names.items():
        if key != 'readback':
            require(output_entries[name]['descriptor'] == expectation[key], 'Root/output descriptor disagreement: ' + key)

    require(assignment.get('schema') == 'feature63-dedicated-wrapper-assignment-v1' and
            assignment.get('approved') is True and assignment.get('assignedBy') == '/root' and
            assignment.get('phase') == 'capture' and assignment.get('sourcePin') == pin and
            assignment.get('sourceRoot') == str(OWNED) and assignment.get('freshPrefix') == RELATIVE_PREFIX and
            assignment.get('productVersion') == '4.0.2', 'R8 capture assignment guards differ')
    definitions = {}
    schemas = {'sourceBinding': 'feature63-new-source-binding-v1', 'buildBinding': 'feature63-build-binding-v1',
               'testedBuildReceipt': 'feature63-tested-build-v1', 'reviewReceipt': 'feature63-dedicated-wrapper-review-v1',
               'browserBinding': 'feature63-browser-binding-v1'}
    for key, name in BINDING_NAMES.items():
        require(assignment.get(key) == without_mode(output_entries[name]['descriptor']),
                'Assignment bound definition differs: ' + key)
        value = parsed(output_entries[name])
        require(value.get('schema') == schemas[key] and value.get('sourcePin') == pin and
                value.get('approved') is True and value.get('assignedBy') == '/root',
                'Definition schema/pin/approval differs: ' + key)
        require(value.get('provenance', {}).get('r8StaticReview') == without_mode(REVIEW),
                'Definition R8 review provenance differs: ' + key)
        definitions[key] = value
    source, build, tests, runtime_review, browser = (definitions[key] for key in BINDING_NAMES)
    flags(source, ['authenticatedInputs', 'includesSourceConfigPublicBuildAndProof',
                   'requiredInputSetAuthenticatedByRoot', 'testedProductBytesModesAndFilenameSetMatched'], 'Source')
    require(source.get('status') == 'PASS' and source.get('inputCount') == 966 and
            source.get('testedProductInputCount') == 570, 'Source count/status differs')
    require(build.get('webDistPath') == str(PREFIX / 'dist') and build.get('serverBuildPath') == str(PREFIX / 'server'),
            'Build paths differ from R8 prefix')
    require(directory(PREFIX) == {'dist', 'server'}, 'R8 prefix contains unexpected entries')
    require(build.get('webRecords') == build.get('originalTestedWebRecords'), 'Copied web records differ from tested records')
    flags(tests, ['buildPassed', 'fullSuitePassed', 'originalAndPackagedWebBytesModesAndFilenameSetsMatch',
                  'sourceAndBuiltBytesMatchTested402'], 'Tested build')
    require(tests.get('sourceBinding') == assignment['sourceBinding'] and tests.get('buildBinding') == assignment['buildBinding'] and
            tests.get('testedProductInputCount') == 570 and tests.get('originalWebFiles') == 398 and
            tests.get('testedBuildId') == build.get('testedBuildId') == assignment.get('testedBuildId') ==
            '9c5d2f1ff26bd6849b1ad5e311300669fb5f02feebbe4d311b6f8d670df243e1',
            'Tested build relationships differ')
    require(runtime_review.get('status') == 'PASS' and without_mode(REVIEW) in runtime_review.get('staticDriverReviews', []),
            'Runtime review does not contain admitted R8 static review')

    for role, name in SCRIPT_NAMES.items():
        for base in (ROOT, OWNED):
            expected = {**roles[role], 'path': str(base / 'scripts/feature63' / name)}
            verified_file(expected)
    require(assignment.get('wrapperSha256') == roles['wrapper']['sha256'], 'Assignment wrapper digest differs')
    for key, role in (('publicProducer', 'producer'), ('collector', 'collector'), ('auditor', 'frozenAuditor')):
        expected = {**roles[role], 'path': str(OWNED / 'scripts/feature63' / SCRIPT_NAMES[role])}
        require(assignment.get(key) == expected, 'Assignment reviewed role differs: ' + key)
        verified_file(expected)
    for key in ('nodeExecutable', 'pythonExecutable'):
        descriptor_shape(assignment[key], False)
        matches = [row for row in runtime_review.get('nativeExecutableRecords', [])
                   if type(row) is dict and row.get('path') == assignment[key]['path']]
        require(len(matches) == 1 and without_mode(matches[0]) == assignment[key],
                'Native executable mode/descriptor receipt differs: ' + key)
        verified_file(matches[0])
    for field, digest in (
        ('wrapperSha256', assignment['wrapperSha256']), ('publicProducerSha256', assignment['publicProducer']['sha256']),
        ('collectorSha256', assignment['collector']['sha256']), ('auditorSha256', assignment['auditor']['sha256']),
        ('nodeExecutableSha256', assignment['nodeExecutable']['sha256']), ('pythonExecutableSha256', assignment['pythonExecutable']['sha256'])):
        require(runtime_review.get(field) == digest, 'Runtime review digest differs: ' + field)
    require(build.get('producerSha256') == assignment['publicProducer']['sha256'] and
            build.get('publicDriverSha256') == assignment['wrapperSha256'] and
            browser.get('producerSha256') == assignment['publicProducer']['sha256'] and
            browser.get('buildBindingSha256') == assignment['buildBinding']['sha256'], 'Build/browser digest relationships differ')

    token = 'heavy-runtime-1-feature63-r8-' + pin[:12] + '-' + binding.name.rsplit('-', 1)[-1]
    slot = assignment['exclusiveHeavyApproval']
    check_slot(slot, token)
    require(browser.get('exclusiveSlotToken') == token and browser.get('cdpBaseUrl') == 'http://127.0.0.1:5374' and
            browser.get('browserCount') == 1 and browser.get('contextCount') == 2 and browser.get('headless') is True and
            browser.get('nativeLifecycleOwner') == 'dedicated-wrapper' and browser.get('unobservedDescendantsExcluded') is False,
            'Browser token/private ownership relationships differ')
    public = assignment['publicAssignmentTemplate']
    collector = assignment['collectorAssignmentTemplate']
    require(public.get('schema') == 'feature63-public-producer-assignment-v1' and public.get('approved') is True and
            public.get('assignedBy') == '/root' and public.get('sourcePin') == pin and public.get('sourceRoot') == str(OWNED) and
            public.get('freshPrefix') == RELATIVE_PREFIX and public.get('outputRoot') == str(PREFIX / 'public') and
            public.get('baseUrl') == 'http://127.0.0.1:5373' and public.get('exclusiveHeavyApproval') == slot and
            public.get('publicDriverSha256') == assignment['wrapperSha256'] and
            public.get('reviewedProducer') == assignment['publicProducer'] and public.get('serverOwnership') is None and
            public.get('externalBrowserOwnership') is None, 'Public assignment template relationships differ')
    for key in ('sourceBinding', 'buildBinding', 'browserBinding'):
        require(public.get(key) == assignment[key], 'Public template binding differs: ' + key)
    require(collector.get('kind') == 'feature63-passive-wave-collector-assignment-v1' and collector.get('rootApproved') is True and
            collector.get('checkout') == str(OWNED) and collector.get('sourcePin') == pin and
            collector.get('outputPrefix') == RELATIVE_PREFIX and collector.get('sourceInventory') == assignment['sourceBinding'] and
            collector.get('reviewReceipt') == assignment['reviewReceipt'] and collector.get('collectorSha256') == assignment['collector']['sha256'] and
            collector.get('heavySlot') == {'assigned': True, 'exclusive': True, 'slotId': token} and
            collector.get('freshDatabase') == {'path': str(PREFIX / 'server-data/server.sqlite'), 'device': None, 'inode': None} and
            collector.get('ownedServer') == {key: None for key in ('argv', 'cwd', 'executable', 'pid', 'startTicks')} and
            collector.get('publicMatchIdentity') is None, 'Collector template relationships differ')
    require(disposition.get('schema') == 1 and disposition.get('status') == 'PASS_ROOT_R8_FRESH_CAPTURE_BINDINGS_AUTHENTICATED' and
            disposition.get('sourcePin') == pin and disposition.get('captureAssignment') == without_mode(expectation['assignment']) and
            disposition.get('captureAdmitted') is True and type(disposition.get('captureInvocationsAuthorized')) is int and
            disposition['captureInvocationsAuthorized'] == 1 and disposition.get('slotExclusivelyAssignedTo') == '/root/ai_modes' and
            disposition.get('noAutomaticRetryAuthorized') is True and disposition.get('slot') == slot and
            disposition.get('feature63Qualified') is False and disposition.get('unobservedDescendantsExcluded') is False and
            disposition.get('freshPrivateEmptyControl') == {'path': str(control), 'mode': 0o700, 'filenames': []},
            'Root capture disposition relationships differ')

    mapping = {
        'ROOT_RUNTIME_ANCHORS_FILLED=False': 'ROOT_RUNTIME_ANCHORS_FILLED=True',
        'CONTROL=None': 'CONTROL=Path(' + repr(str(control)) + ')',
        'ASSIGNMENT=None': 'ASSIGNMENT=Path(' + repr(expectation['assignment']['path']) + ')',
        'DIGEST=None': 'DIGEST=' + repr(expectation['assignment']['sha256']),
        'DISPOSITION=None': 'DISPOSITION=Path(' + repr(expectation['disposition']['path']) + ')',
        'DISPOSITION_SHA=None': 'DISPOSITION_SHA=' + repr(expectation['disposition']['sha256']),
        'PIN=None': 'PIN=' + repr(pin), 'SLOT_TOKEN=None': 'SLOT_TOKEN=' + repr(token),
        "WRAPPER_SHA='f5b5428c531e99f15885cd48a513d4167aea02bab461f998a99719315d9ddc70'":
            'WRAPPER_SHA=' + repr(assignment['wrapperSha256']),
    }
    require(readback.get('launcherChanges') == mapping, 'Launcher change map differs from root-approved anchors')
    text = template_entry['raw'].decode('utf-8')
    text = text.replace('feature63-human-wave-composition-r3', 'feature63-human-wave-composition-r8')
    text = text.replace("SLOT_TOKEN.startswith('heavy-runtime-1-feature63-r3-')",
                        "SLOT_TOKEN.startswith('heavy-runtime-1-feature63-r8-')")
    for old, new in mapping.items():
        require(text.count(old) == 1, 'Frozen launcher anchor is missing or repeated: ' + old)
        text = text.replace(old, new)
    require(text.encode('utf-8') == top['launcher']['raw'], 'Launcher has changes beyond permitted literals and anchors')
    ast.parse(text, filename=expectation['launcher']['path'])

    product_entry = definition(PRODUCT)
    protected_entry = definition(PROTECTED)
    product_rows = parsed(product_entry)
    protected_rows = parsed(protected_entry)['dist']
    clean_checkouts(pin)
    for base in (ROOT, OWNED):
        require(git_bytes(base, ['cat-file', 'blob', pin + ':' + PRODUCT_GIT_PATH]) == product_entry['raw'] and
                git_bytes(base, ['cat-file', 'blob', pin + ':' + PROTECTED_GIT_PATH]) == protected_entry['raw'],
                'Frozen inventory differs from expected Git original: ' + str(base))
        authenticate_inventory(base, source['records'], 966)
        authenticate_inventory(base, product_rows, 570)
    authenticate_inventory(ROOT / 'dist', protected_rows, 397, complete=True)
    authenticate_inventory(PREFIX / 'dist', build['webRecords'], 398, complete=True)
    authenticate_inventory(PREFIX / 'server', build['serverRecords'], 22, complete=True)
    dependency_root = canonical(browser['dependencyRoot'])
    chromium_root = canonical(browser['chromiumDependencyRoot'])
    authenticate_inventory(dependency_root, browser['dependencyRecords'], 114, complete=True)
    authenticate_inventory(chromium_root, browser['chromiumDependencyRecords'], 303, complete=True)
    require(browser.get('playwrightModulePath') == str(dependency_root / 'index.mjs') and
            browser.get('playwrightEntry', {}).get('path') == str(dependency_root / 'index.mjs') and
            browser.get('chromiumExecutable', {}).get('path') == str(chromium_root / 'chrome'),
            'Browser module/executable paths differ')
    verified_file(browser['playwrightEntry'])
    verified_file(browser['chromiumExecutable'])
    package = parsed(output_entries['root-fresh-package-result.json'])
    require(package.get('status') == 'EXACT_WEB_AND_SERVER_COPY_PASSED' and package.get('sourcePin') == pin and
            package.get('freshPrefix') == str(PREFIX) and package.get('counts') == {'dist': 398, 'server': 22} and
            package.get('productInventoryOriginal') == {**without_mode(PRODUCT), 'gitPath': PRODUCT_GIT_PATH} and
            package.get('protectedInventoryOriginal') == {**without_mode(PROTECTED), 'gitPath': PROTECTED_GIT_PATH} and
            package.get('productBuildExecuted') is False and package.get('serverBrowserDatabaseRuntimeExecuted') is False and
            package.get('databaseProfileOrOldDataCopied') is False and package.get('sourcePrefixRuntimeDataRead') is False and
            package.get('captureAuthorized') is False, 'Fresh packaging receipt scope differs')

    clean_checkouts(pin)
    revalidate_files_and_sets()
    directory(binding, private=True)
    directory(control, private=True, empty=True)
    require(directory(PREFIX) == {'dist', 'server'}, 'R8 prefix changed before report')
    protected_process = assignment['protectedProcess']
    require(type(protected_process) is dict and set(protected_process) == {'pid', 'startTicks', 'cwd', 'executable', 'argv'} and
            type(protected_process['pid']) is int and protected_process['pid'] == 1063 and
            type(protected_process['startTicks']) is int and protected_process['startTicks'] == 874 and
            protected_process['cwd'] == str(ROOT) and assignment.get('protectedListenerSockets') == ['socket:[3783]'],
            'Bound protected identity/port anchors differ')
    protected_before = protected_snapshot(protected_process)
    listener_before = listeners()
    listener_after = listeners()
    protected_after = protected_snapshot(protected_process)
    require(protected_before == protected_after and listener_before == listener_after,
            'Protected preview/private listeners changed during observation')
    remaining = check_slot(slot, token)
    directory(control, private=True, empty=True)
    require(directory(binding, private=True) == OUTPUT_NAMES | {'root-binding-readback.json'},
            'Bindings changed immediately before report')
    require(directory(PREFIX) == {'dist', 'server'}, 'R8 prefix changed immediately before report')
    revalidate_files_and_sets()
    report = {
        'schema': 'feature63-r8-independent-prelaunch-readback-v1',
        'status': 'PASS_ROOT_EXPECTATION_BOUND_R8_PRELAUNCH_AUTHENTICATION_ONLY',
        'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'sourcePin': pin, 'rootExpectation': expectation_descriptor,
        'bindingDirectory': str(binding), 'assignment': expectation['assignment'],
        'launcher': expectation['launcher'], 'disposition': expectation['disposition'],
        'bindingReadback': expectation['readback'], 'r8StaticReview': REVIEW, 'frozenLauncherTemplate': TEMPLATE,
        'counts': {'sourceEachCheckout': 966, 'productEachCheckout': 570, 'protectedDist': 397,
                   'web': 398, 'server': 22, 'playwright': 114, 'chromium': 303},
        'allBoundFilesAuthenticatedWithStableSingleFdReads': True,
        'definitionsParsedOnceFromAuthenticatedBytes': True,
        'completeBindingInventoryExcludesOnlyReadbackItself': True,
        'rootAndOwnedHeadMatchExpectedPinAndTrackedStateClean': True,
        'launcherOnlyReviewedR3ToR8LiteralsAndRootAnchors': True,
        'control': {'path': str(control), 'mode': 0o700, 'empty': True},
        'slot': slot, 'slotSecondsRemainingAtFinalGate': remaining,
        'protectedPreview': protected_after, 'listeners': listener_after,
        'captureLaunchedByThisUtility': False, 'captureAuthorityExpandedByThisUtility': False,
        'serverBrowserOrProductRuntimeLaunchedByThisUtility': False,
        'databaseProfileOrExistingCustodyAccessed': False,
        'nativeCustodyAdmitted': False, 'extractionPerformedOrAdmitted': False,
        'nativeAuditPerformedOrAdmitted': False, 'feature63Qualified': False,
        'unobservedDescendantsExcluded': False,
        'qualification': 'Prelaunch authentication only. No launch, native custody, extraction, audit, feature63 qualification, or complete descendant exclusion is asserted.',
    }
    result = write_report(report_directory, report)
    print(json.dumps({'report': result, 'status': report['status'], 'captureLaunched': False}, sort_keys=True))


if __name__ == '__main__':
    main()
