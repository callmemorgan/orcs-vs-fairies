#!/usr/bin/env python3
"""Authenticate and seal one completed R7 capture. Root supplies an exact post-capture expectation."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import re
import select
import stat
import subprocess
import sys
import tempfile

ROOT = Path('/home/morgana/Projects/orcs-vs-Fairies')
OWNED = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
PRODUCT_GIT_PATH = 'docs/evidence/main402-remaining-witness-2e5-20261001/raw/tested-product-before.json'
PROTECTED_GIT_PATH = 'docs/evidence/main402-remaining-witness-2e5-20261001/raw/protected-before.json'
AUTHORITY_NAMES = {
    'captureAssignment', 'prelaunchReadback', 'independentClosure', 'launch',
    'captureAssignmentActual', 'command', 'captureLaunchConsumed', 'captureResult',
    'serverOwnership', 'driverEvents', 'sourceBinding', 'buildBinding', 'browserBinding',
    'productInventory', 'protectedInventory',
}
TOP_LEVEL_NAMES = {
    'schema', 'approved', 'assignedBy', 'branch', 'sourcePin', 'utilitySha256',
    'roots', 'paths', 'authority', 'expected', 'outputParent',
}
PATH_NAMES = {'bindingsRoot', 'controlRoot', 'freshPrefix'}
EXPECTED_NAMES = {
    'matchId', 'wrapperExitCode', 'firstFailure', 'registeredNativeKeys',
    'launcherLifetime', 'wrapperLifetime', 'rawIdentity',
}
REGISTERED_KEY_NAMES = {'family', 'pid', 'startTicks', 'originalAdmittedSession', 'directRoot'}
MAX_AUTHORITY_BYTES = 512 * 1024 * 1024
MAX_INVENTORY_MEMBER_BYTES = 2 * 1024 * 1024 * 1024
MAX_RAW_BYTES = 1024 * 1024 * 1024
DEFINITION_BYTES = {}
DEFINITION_JSON = {}


def require(value, message):
    if not value:
        raise RuntimeError(message)


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def exact(value, names, label):
    require(type(value) is dict and set(value) == set(names), label + ' fields differ')
    return value


def integer(value, label, low=0, high=2**63 - 1):
    require(type(value) is int and low <= value <= high, label + ' is not a bounded integer')
    return value


def digest(value, label):
    require(type(value) is str and re.fullmatch('[0-9a-f]{64}', value) is not None,
            label + ' is not lowercase SHA-256')
    return value


def identity(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns,
            info.st_mode, info.st_nlink)


def canonical_existing(path, label):
    path = Path(path)
    require(path.is_absolute() and path.resolve() == path and not path.is_symlink(), label + ' is not canonical')
    return path


def parse_json(raw, label):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, label + ' contains duplicate JSON key: ' + key)
            result[key] = value
        return result

    return json.loads(raw.decode('utf-8'), object_pairs_hook=pairs,
                      parse_constant=lambda item: (_ for _ in ()).throw(RuntimeError(label + ' contains ' + item)))


def descriptor(path, raw):
    return {'path': str(path), 'bytes': len(raw), 'sha256': sha256(raw)}


def stable_read(path, cap, expected=None, single_link=True):
    path = canonical_existing(path, 'Input path')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode), 'Input is not regular: ' + str(path))
        require(not single_link or before.st_nlink == 1, 'Input link count differs: ' + str(path))
        require(0 <= before.st_size <= cap, 'Input exceeds size bound: ' + str(path))
        chunks = []
        remaining = before.st_size
        while remaining:
            chunk = os.read(fd, min(remaining, 1024 * 1024))
            require(bool(chunk), 'Short input read: ' + str(path))
            chunks.append(chunk)
            remaining -= len(chunk)
        require(not os.read(fd, 1), 'Input grew while reading: ' + str(path))
        after = os.fstat(fd)
        named = path.lstat()
        require(identity(before) == identity(after) == identity(named), 'Input changed while reading: ' + str(path))
        raw = b''.join(chunks)
        actual = descriptor(path, raw)
        if expected is not None:
            require(actual == expected, 'Input descriptor differs: ' + str(path))
        return raw, before
    finally:
        os.close(fd)


def validate_descriptor(record, label, cap=MAX_AUTHORITY_BYTES, expected_path=None):
    exact(record, ('path', 'bytes', 'sha256'), label)
    path = Path(record['path'])
    integer(record['bytes'], label + ' bytes', 0, cap)
    digest(record['sha256'], label + ' digest')
    require(path.suffix not in ('.sqlite', '.db') and not any(path.name.endswith(suffix)
            for suffix in ('.sqlite-wal', '.sqlite-shm', '.sqlite-journal')),
            label + ' may not describe a database')
    if expected_path is not None:
        require(path == expected_path, label + ' path differs')
    return path


def load_definition(name, record, parse=True, cap=MAX_AUTHORITY_BYTES, expected_path=None):
    path = validate_descriptor(record, name, cap, expected_path)
    require(path not in DEFINITION_BYTES, 'Definition loaded more than once: ' + str(path))
    raw, _info = stable_read(path, cap, record)
    DEFINITION_BYTES[path] = raw
    value = parse_json(raw, name) if parse else raw
    DEFINITION_JSON[path] = value if parse else None
    return value, raw


def mode_value(value):
    return int(value, 8) if type(value) is str else value


def read_inventory_member(path, row):
    exact(row, ('path', 'bytes', 'sha256', 'mode'), 'Inventory row')
    integer(row['bytes'], 'Inventory bytes', 0, MAX_INVENTORY_MEMBER_BYTES)
    digest(row['sha256'], 'Inventory digest')
    raw, info = stable_read(path, MAX_INVENTORY_MEMBER_BYTES, {
        'path': str(path), 'bytes': row['bytes'], 'sha256': row['sha256'],
    })
    require(stat.S_IMODE(info.st_mode) == mode_value(row['mode']), 'Inventory mode differs: ' + str(path))
    return raw


def inventory(base):
    rows = []
    for path in base.rglob('*'):
        if path.is_file():
            raw, info = stable_read(path, MAX_INVENTORY_MEMBER_BYTES)
            rows.append({'path': str(path.relative_to(base)), 'bytes': len(raw), 'sha256': sha256(raw),
                         'mode': stat.S_IMODE(info.st_mode)})
    return sorted(rows, key=lambda row: row['path'])


def authenticate_inventory(base, rows, complete=False):
    require(type(rows) is list, 'Inventory rows are absent: ' + str(base))
    normalized = []
    seen = set()
    for row in rows:
        rel = Path(row.get('path', ''))
        require(not rel.is_absolute() and '..' not in rel.parts and str(rel) == row.get('path')
                and str(rel) not in seen, 'Inventory relative path differs: ' + str(rel))
        read_inventory_member(base / rel, row)
        normalized.append({**row, 'mode': mode_value(row['mode'])})
        seen.add(str(rel))
    if complete:
        require(inventory(base) == sorted(normalized, key=lambda row: row['path']),
                'Complete inventory differs: ' + str(base))


def git_output(base, arguments):
    return subprocess.check_output(['git'] + arguments, cwd=base,
                                   env=dict(os.environ, GIT_OPTIONAL_LOCKS='0'))


def kernel(pid):
    try:
        path = Path('/proc') / str(pid)
        text = (path / 'stat').read_text()
        fields = text[text.rfind(')') + 2:].split()
        return {'pid': pid, 'startTicks': int(fields[19]), 'session': int(fields[3]), 'state': fields[0]}
    except (FileNotFoundError, ProcessLookupError):
        return None


def observed_exit(lifetime):
    exact(lifetime, ('pid', 'startTicks'), 'Lifetime identity')
    pid = integer(lifetime['pid'], 'Lifetime PID', 1)
    start = integer(lifetime['startTicks'], 'Lifetime start ticks', 1)
    first = kernel(pid)
    if first is None or first['startTicks'] != start:
        return {'lifetimeIdentity': lifetime, 'actual': first, 'rememberedLifetimeExited': True,
                'scope': 'bounded PID/start absent or different'}
    fd = os.pidfd_open(pid)
    try:
        second = kernel(pid)
        require(second is not None and second['startTicks'] == start, 'Lifetime changed while opening pidfd')
        poller = select.poll()
        poller.register(fd, select.POLLIN | select.POLLHUP | select.POLLERR | select.POLLNVAL)
        ready = poller.poll(0)
        require(ready and not any(flags & (select.POLLERR | select.POLLNVAL) for _fd, flags in ready),
                'Remembered lifetime is live or invalid')
        return {'lifetimeIdentity': lifetime, 'actual': second, 'pidfdEvents': ready,
                'rememberedLifetimeExited': True,
                'scope': 'root held PIDFD readiness after matching PID/start'}
    finally:
        os.close(fd)


def listening_ports():
    result = {str(port): [] for port in (4173, 5373, 5374)}
    for name in ('tcp', 'tcp6'):
        for line in (Path('/proc/net') / name).read_text().splitlines()[1:]:
            fields = line.split()
            port = str(int(fields[1].rsplit(':', 1)[1], 16))
            if fields[3] == '0A' and port in result:
                result[port].append('socket:[' + fields[9] + ']')
    return result


def raw_holders(device, inode):
    holders = []
    for process in Path('/proc').iterdir():
        if not process.name.isdigit():
            continue
        try:
            for entry in (process / 'fd').iterdir():
                try:
                    info = entry.stat()
                    if (info.st_dev, info.st_ino) == (device, inode):
                        holders.append(str(entry))
                except (FileNotFoundError, ProcessLookupError):
                    pass
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            pass
    return sorted(holders)


def registered_key(record):
    lifetime = record['lifetimeIdentity']
    return (record['family'], lifetime['pid'], lifetime['startTicks'],
            record['originalAdmittedSession'], record['directRoot'])


def expected_key(record):
    exact(record, REGISTERED_KEY_NAMES, 'Expected registered key')
    require(type(record['family']) is str and bool(record['family']), 'Registered family differs')
    integer(record['pid'], 'Registered PID', 1)
    integer(record['startTicks'], 'Registered start ticks', 1)
    integer(record['originalAdmittedSession'], 'Registered session', 1)
    require(type(record['directRoot']) is bool, 'Registered directRoot differs')
    return (record['family'], record['pid'], record['startTicks'],
            record['originalAdmittedSession'], record['directRoot'])


def output_bytes(value):
    return (json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False, allow_nan=False) + '\n').encode('utf-8')


def put(output, name, value):
    path = output / name
    raw = output_bytes(value)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    info = None
    try:
        with os.fdopen(fd, 'wb', closefd=False) as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(fd)
        os.fchmod(fd, 0o444)
        info = os.fstat(fd)
        require(stat.S_ISREG(info.st_mode) and info.st_size == len(raw) and info.st_nlink == 1
                and stat.S_IMODE(info.st_mode) == 0o444, 'Generated receipt metadata differs')
    finally:
        os.close(fd)
    require(info is not None, 'Generated receipt metadata was not recorded')
    require(identity(path.lstat()) == identity(info), 'Generated receipt changed after write')
    return descriptor(path, raw)


def path_is_within(path, parent):
    return path == parent or parent in path.parents


def validate_expectation(value):
    exact(value, TOP_LEVEL_NAMES, 'Expectation')
    require(value['schema'] == 'feature63-r7-custody-expectation-v1' and value['approved'] is True
            and value['assignedBy'] == '/root', 'Expectation is not root-approved')
    require(value['branch'] in ('success', 'failure'), 'Expectation branch differs')
    require(type(value['sourcePin']) is str and re.fullmatch('[0-9a-f]{40}', value['sourcePin']),
            'Expectation source pin differs')
    digest(value['utilitySha256'], 'Utility digest')
    exact(value['roots'], ('root', 'owned'), 'Expectation roots')
    require(value['roots'] == {'root': str(ROOT), 'owned': str(OWNED)}, 'Expectation roots differ')
    exact(value['paths'], PATH_NAMES, 'Expectation paths')
    exact(value['authority'], AUTHORITY_NAMES, 'Expectation authority')
    exact(value['expected'], EXPECTED_NAMES, 'Expectation actual values')
    require(value['paths']['freshPrefix'] == 'work/feature63-human-wave-composition-r7', 'R7 prefix differs')
    expected = value['expected']
    require(type(expected['matchId']) is str and bool(expected['matchId']), 'Expected match ID differs')
    require(type(expected['wrapperExitCode']) is int, 'Expected wrapper exit differs')
    require(type(expected['registeredNativeKeys']) is list and expected['registeredNativeKeys'],
            'Expected registered native keys are absent')
    expected_keys = [expected_key(row) for row in expected['registeredNativeKeys']]
    require(len(expected_keys) == len(set(expected_keys)), 'Expected registered native keys are not unique')
    exact(expected['launcherLifetime'], ('pid', 'startTicks'), 'Expected launcher lifetime')
    exact(expected['wrapperLifetime'], ('pid', 'startTicks'), 'Expected wrapper lifetime')
    integer(expected['launcherLifetime']['pid'], 'Expected launcher PID', 1)
    integer(expected['launcherLifetime']['startTicks'], 'Expected launcher start', 1)
    integer(expected['wrapperLifetime']['pid'], 'Expected wrapper PID', 1)
    integer(expected['wrapperLifetime']['startTicks'], 'Expected wrapper start', 1)
    exact(expected['rawIdentity'], ('path', 'device', 'inode'), 'Expected raw identity')
    integer(expected['rawIdentity']['device'], 'Expected raw device')
    integer(expected['rawIdentity']['inode'], 'Expected raw inode', 1)
    if value['branch'] == 'success':
        require(expected['wrapperExitCode'] == 0 and expected['firstFailure'] is None,
                'Success expectation exit/failure differs')
    else:
        require(expected['wrapperExitCode'] != 0 and type(expected['firstFailure']) is dict
                and bool(expected['firstFailure']), 'Failure expectation exit/failure differs')
    return expected_keys


def main():
    require(sys.flags.optimize == 0, 'Python optimization is prohibited')
    require(len(sys.argv) == 3, 'Usage: fresh-r7-custody.py EXPECTATION_JSON EXPECTATION_SHA256')
    expectation_path = canonical_existing(sys.argv[1], 'Expectation path')
    expectation_sha = digest(sys.argv[2], 'Expectation command-line digest')
    expectation_raw, _info = stable_read(expectation_path, 1024 * 1024)
    require(sha256(expectation_raw) == expectation_sha, 'Expectation command-line digest differs')
    expectation = parse_json(expectation_raw, 'Expectation')
    expected_keys = validate_expectation(expectation)
    source_pin = expectation['sourcePin']
    branch = expectation['branch']
    paths = expectation['paths']
    bindings = canonical_existing(paths['bindingsRoot'], 'Bindings root')
    control = canonical_existing(paths['controlRoot'], 'Control root')
    prefix = canonical_existing(OWNED / paths['freshPrefix'], 'R7 prefix')
    output_parent = canonical_existing(expectation['outputParent'], 'Output parent')
    require(output_parent.is_dir() and not path_is_within(output_parent, ROOT)
            and not path_is_within(output_parent, OWNED), 'Output parent is not external')

    self_path = canonical_existing(__file__, 'Utility path')
    self_raw, _self_info = stable_read(self_path, 1024 * 1024)
    require(sha256(self_raw) == expectation['utilitySha256'], 'Utility differs from root expectation')

    authority = expectation['authority']
    literal_paths = {
        'captureAssignment': bindings / 'capture-assignment.json',
        'independentClosure': control / 'independent-closure.json',
        'launch': control / 'launch.json',
        'captureAssignmentActual': control / 'capture-assignment.actual.json',
        'command': control / 'command.json',
        'captureLaunchConsumed': control / 'capture-launch-consumed.json',
        'captureResult': prefix / 'lifecycle/driver-result.json',
        'serverOwnership': prefix / 'lifecycle/server-ownership.json',
        'driverEvents': prefix / 'lifecycle/driver-events.ndjson',
    }
    loaded = {}
    raw_definitions = {}
    for name in sorted(AUTHORITY_NAMES):
        parse = name != 'driverEvents'
        expected_path = literal_paths.get(name)
        value, raw = load_definition(name, authority[name], parse=parse, expected_path=expected_path)
        loaded[name] = value
        raw_definitions[name] = raw

    assignment = loaded['captureAssignment']
    capture = loaded['captureResult']
    closure = loaded['independentClosure']
    launch = loaded['launch']
    command = loaded['command']
    consumed = loaded['captureLaunchConsumed']
    server = loaded['serverOwnership']
    source = loaded['sourceBinding']
    build = loaded['buildBinding']
    browser = loaded['browserBinding']
    prelaunch = loaded['prelaunchReadback']
    product = loaded['productInventory']
    protected = loaded['protectedInventory']
    expected = expectation['expected']

    require(loaded['captureAssignmentActual'] == assignment, 'Actual capture assignment differs')
    require(assignment.get('schema') == 'feature63-dedicated-wrapper-assignment-v1'
            and assignment.get('phase') == 'capture' and assignment.get('approved') is True
            and assignment.get('assignedBy') == '/root' and assignment.get('sourcePin') == source_pin
            and assignment.get('sourceRoot') == str(OWNED)
            and assignment.get('freshPrefix') == paths['freshPrefix']
            and assignment.get('productVersion') == '4.0.2', 'Capture assignment differs')
    require(assignment.get('sourceBinding') == authority['sourceBinding']
            and assignment.get('buildBinding') == authority['buildBinding']
            and assignment.get('browserBinding') == authority['browserBinding'],
            'Capture assignment binding descriptors differ')
    slot = assignment.get('exclusiveHeavyApproval')
    require(type(slot) is dict and slot.get('approved') is True and slot.get('holder') == '/root/ai_modes'
            and type(slot.get('token')) is str
            and slot['token'].startswith('heavy-runtime-1-feature63-r7-'), 'Capture slot differs')

    for value, label in ((source, 'source'), (build, 'build'), (browser, 'browser'), (capture, 'capture')):
        require(value.get('sourcePin') == source_pin, label + ' source pin differs')
    require(source.get('schema') == 'feature63-new-source-binding-v1'
            and source.get('approved') is True and source.get('status') == 'PASS'
            and source.get('authenticatedInputs') is True
            and source.get('requiredInputSetAuthenticatedByRoot') is True
            and build.get('schema') == 'feature63-build-binding-v1'
            and build.get('approved') is True, 'Source/build schema or approval differs')
    require(build.get('webDistPath') == str(prefix / 'dist')
            and build.get('serverBuildPath') == str(prefix / 'server'), 'R7 build paths differ')
    require(capture.get('schema') == 'feature63-dedicated-capture-result-v1'
            and capture.get('matchId') == expected['matchId']
            and capture.get('cleanupFailures') == []
            and capture.get('protectedFinalReadback', {}).get('status') == 'PASS', 'Capture result differs')
    if branch == 'success':
        require(capture.get('status') == 'CAPTURE_PASS_ROOT_SEAL_AND_EXTRACTION_PENDING'
                and capture.get('firstFailure') is None, 'Passing capture result differs')
    else:
        require(capture.get('status') == 'FAIL_FIRST_FAILURE_NO_RETRY'
                and capture.get('firstFailure') == expected['firstFailure'], 'Failed capture result differs')

    script_names = {
        'wrapper': 'run-minimal63.py', 'publicProducer': 'public-producer.mjs',
        'collector': 'collect-launched-waves.py', 'auditor': 'native-audit.py',
    }
    for role, name in script_names.items():
        actual = {}
        for label, base in (('root', ROOT), ('owned', OWNED)):
            raw, _info = stable_read(base / 'scripts/feature63' / name, MAX_AUTHORITY_BYTES)
            actual[label] = descriptor(base / 'scripts/feature63' / name, raw)
        require(actual['root']['sha256'] == actual['owned']['sha256'], 'Both-root script differs: ' + role)
        if role == 'wrapper':
            require(actual['owned']['sha256'] == assignment.get('wrapperSha256'), 'Wrapper digest differs')
        else:
            require(actual['owned'] == assignment.get(role), 'Assignment script descriptor differs: ' + role)

    for base in (ROOT, OWNED):
        require(git_output(base, ['rev-parse', 'HEAD']).decode().strip() == source_pin,
                'Checkout HEAD differs from generated assignment pin')
        require(git_output(base, ['status', '--porcelain', '--untracked-files=no']) == b'',
                'Tracked checkout is dirty')
        require(raw_definitions['productInventory'] == git_output(base, ['cat-file', 'blob', source_pin + ':' + PRODUCT_GIT_PATH]),
                'Product inventory differs from pinned Git bytes')
        require(raw_definitions['protectedInventory'] == git_output(base, ['cat-file', 'blob', source_pin + ':' + PROTECTED_GIT_PATH]),
                'Protected inventory differs from pinned Git bytes')

    require(type(product) is list and type(protected) is dict and type(protected.get('dist')) is list,
            'Product/protected inventory schema differs')
    for base in (ROOT, OWNED):
        authenticate_inventory(base, product)
    authenticate_inventory(ROOT / 'dist', protected['dist'], complete=True)
    authenticate_inventory(Path(build['webDistPath']), build['webRecords'], complete=True)
    authenticate_inventory(Path(build['serverBuildPath']), build['serverRecords'], complete=True)
    authenticate_inventory(Path(browser['dependencyRoot']), browser['dependencyRecords'], complete=True)
    authenticate_inventory(Path(browser['chromiumDependencyRoot']), browser['chromiumDependencyRecords'], complete=True)
    require([len(source['records']), len(product), len(protected['dist']), len(build['webRecords']),
             len(build['serverRecords']), len(browser['dependencyRecords']), len(browser['chromiumDependencyRecords'])]
            == [966, 570, 397, 398, 22, 114, 303], 'Inventory counts differ')
    for base in (ROOT, OWNED):
        authenticate_inventory(base, source['records'])

    require(command.get('sourcePin') == source_pin and command.get('cwd') == assignment.get('sourceRoot') == str(OWNED)
            and command.get('wrapperSha256') == assignment.get('wrapperSha256')
            and command.get('slot') == assignment.get('exclusiveHeavyApproval'), 'Command assignment chain differs')
    require(command.get('environmentAnchor', {}).get('OVF_FEATURE63_WRAPPER_ASSIGNMENT_SHA256')
            == consumed.get('assignmentSha256') == authority['captureAssignment']['sha256'],
            'Consumed assignment digest differs')
    require(consumed.get('captureInvocations') == 1 and consumed.get('automaticRetries') == 0,
            'Capture invocation count differs')
    require(command.get('command') == [assignment['pythonExecutable']['path'],
            'scripts/feature63/run-minimal63.py', 'capture', str(bindings / 'capture-assignment.json')],
            'Capture invocation differs')
    require(command.get('protectedBefore') == closure.get('protectedBefore')
            and closure.get('protectedBefore', {}).get('process', {}).get('identity')
            == closure.get('protectedAfter', {}).get('process', {}).get('identity')
            == assignment.get('protectedProcess'), 'Protected command/closure chain differs')
    require(launch.get('wrapper') == closure.get('wrapperInitial')
            and launch.get('controlDirectory') == str(control)
            and launch.get('wrapperPidfdOpened') is True, 'Launch/closure wrapper chain differs')
    require(server.get('schema') == 'feature63-owned-server-v1' and server.get('sourcePin') == source_pin
            and server.get('freshPrefix') == paths['freshPrefix']
            and server.get('exclusiveSlotToken') == assignment.get('exclusiveHeavyApproval', {}).get('token'),
            'Server ownership chain differs')
    require(capture.get('closedFreshDatabaseIdentity') == server.get('freshDatabase') == expected['rawIdentity'],
            'Fresh database identity chain differs')
    require(prelaunch.get('sourcePin') == source_pin, 'Prelaunch source pin differs')

    launch_lifetimes = {name: {key: launch[name]['identity'][key] for key in ('pid', 'startTicks')}
                        for name in ('launcher', 'wrapper')}
    require(launch_lifetimes['launcher'] == expected['launcherLifetime']
            and launch_lifetimes['wrapper'] == expected['wrapperLifetime'], 'Expected launch lifetimes differ')
    require(closure.get('wrapperExitCode') == expected['wrapperExitCode']
            and closure.get('wrapperLifetimeReadback', {}).get('rememberedIdentityStillLive') is False
            and closure.get('wrapperLifetimeReadback', {}).get('observationFailure') is None,
            'Wrapper closure differs')
    require(closure.get('allRememberedRegisteredIdentitiesNotLive') is True
            and closure.get('everyRememberedLifetimeObservationComplete') is True
            and closure.get('privateListenersAbsent') is True
            and closure.get('unobservedDescendantsExcluded') is False, 'Independent closure summary differs')
    resources = closure.get('rememberedResources')
    require(type(resources) is list and len(resources) == len(expected_keys), 'Remembered resource count differs')
    closure_keys = [registered_key(record) for record in resources]
    require(len(closure_keys) == len(set(closure_keys)) and set(closure_keys) == set(expected_keys),
            'Remembered resource keys are not unique or differ from expectation')
    require(all(record.get('observationFailure') is None
                and record.get('rememberedIdentityStillLive') is False
                and record.get('independentPidfdOpenedWhileLive') is True
                and bool(record.get('independentPidfdEvents'))
                and str(record.get('lifetimeEvidenceScope', '')).startswith('INDEPENDENT_HELD_PIDFD_READY')
                for record in resources), 'Independent held-PIDFD evidence differs')

    events = [parse_json(line, 'Driver event') for line in raw_definitions['driverEvents'].splitlines() if line]
    registered = [event for event in events if event.get('action') == 'registered native resource']
    registered_keys = [registered_key(record) for record in registered]
    require(len(registered_keys) == len(set(registered_keys)) and set(registered_keys) == set(expected_keys),
            'Driver registered resource keys are not unique or differ from expectation')

    root_lifetimes = [{'pid': key[1], 'startTicks': key[2]} for key in expected_keys]
    root_lifetimes.extend((expected['wrapperLifetime'], expected['launcherLifetime']))
    lifetime_readbacks = [observed_exit(value) for value in root_lifetimes]
    require(len(lifetime_readbacks) == len(expected_keys) + 2
            and all(row['rememberedLifetimeExited'] is True for row in lifetime_readbacks),
            'Finite root lifetime readback differs')

    protected_actual = kernel(1063)
    require(protected_actual is not None and protected_actual['startTicks'] == 874
            and protected_actual['session'] == 1063, 'Protected preview lifetime differs')
    protected_assignment = assignment['protectedProcess']
    require(os.readlink('/proc/1063/cwd') == protected_assignment['cwd']
            and os.readlink('/proc/1063/exe') == protected_assignment['executable']
            and [item.decode() for item in Path('/proc/1063/cmdline').read_bytes().split(b'\0') if item]
            == protected_assignment['argv'], 'Protected preview identity differs')
    ports = listening_ports()
    require(ports == {'4173': ['socket:[3783]'], '5373': [], '5374': []}
            and os.readlink('/proc/1063/fd/22') == 'socket:[3783]', 'Protected/private listener state differs')

    raw = canonical_existing(expected['rawIdentity']['path'], 'Fresh R7 raw path')
    require(raw == prefix / 'server-data/server.sqlite', 'Fresh raw path differs')
    before = raw.lstat()
    require(stat.S_ISREG(before.st_mode) and before.st_dev == expected['rawIdentity']['device']
            and before.st_ino == expected['rawIdentity']['inode'] and before.st_nlink == 1
            and 0 < before.st_size <= MAX_RAW_BYTES, 'Fresh raw metadata differs')
    require(branch != 'failure' or output_parent.stat().st_dev == before.st_dev,
            'Failure custody output parent cannot hardlink the fresh raw inode')
    require(all(not os.path.lexists(str(raw) + suffix) for suffix in ('-wal', '-shm', '-journal')),
            'Fresh raw sidecar is present')
    holders = raw_holders(before.st_dev, before.st_ino)
    require(not holders, 'Fresh raw has open holders')

    # Every read-only gate and holder/sidecar check has passed. The one-shot seal starts here.
    raw_fd = os.open(raw, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    output = None
    try:
        opened = os.fstat(raw_fd)
        require(identity(opened) == identity(before), 'Fresh raw changed before seal')
        os.fchmod(raw_fd, 0o444)
        sealed = os.fstat(raw_fd)
        require(stat.S_IMODE(sealed.st_mode) == 0o444 and sealed.st_nlink == 1
                and (sealed.st_dev, sealed.st_ino, sealed.st_size) == (before.st_dev, before.st_ino, before.st_size),
                'Fresh raw seal differs')
        hasher = hashlib.sha256()
        while True:
            chunk = os.read(raw_fd, 1024 * 1024)
            if not chunk:
                break
            hasher.update(chunk)
        after_hash = os.fstat(raw_fd)
        require(identity(sealed) == identity(after_hash) == identity(raw.lstat()),
                'Fresh raw changed while hashing')
        raw_record = {'path': str(raw), 'bytes': sealed.st_size, 'sha256': hasher.hexdigest(),
                      'device': sealed.st_dev, 'inode': sealed.st_ino}

        output = Path(tempfile.mkdtemp(prefix='ovf-root-feature63-r7-' + branch + '-custody-',
                                      dir=str(output_parent)))
        require(stat.S_IMODE(output.stat().st_mode) == 0o700 and not list(output.iterdir()),
                'Fresh custody output is not empty and private')
        stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        expectation_record = descriptor(expectation_path, expectation_raw)
        capture_record = authority['captureResult']
        closure_record = authority['independentClosure']
        common_closure = {
            'sourcePin': source_pin,
            'matchId': expected['matchId'],
            'captureResult': capture_record,
            'expectation': expectation_record,
            'at': stamp,
            'wrapperExitCode': expected['wrapperExitCode'],
            'registeredNativeCount': len(expected_keys),
            'wrapperClosedSeparately': True,
            'launcherClosedSeparately': True,
            'rootFiniteLifetimeReadbacks': lifetime_readbacks,
            'independentLauncherClosure': closure_record,
            'ports': ports,
            'protectedLifetime': protected_actual,
            'rawOpenHoldersObserved': holders,
            'rawSidecarsAbsent': True,
            'unobservedDescendantsExcluded': False,
            'limit': 'Finite registered, wrapper, and launcher PID/start observations do not exclude missed forks or reparenting.',
            'priorFailedRawAccessed': False,
            'rawContentsReadOnlyAfterAllReadOnlyGates': True,
        }

        if branch == 'success':
            require(os.fstat(raw_fd).st_nlink == 1 and identity(os.fstat(raw_fd)) == identity(raw.lstat()),
                    'Passing raw lost single-link custody')
            independent = put(output, 'root-independent-native-closure.json', {
                'schema': 'feature63-root-independent-native-closure-v1',
                'status': 'ROOT_R7_PASSING_CAPTURE_LIFETIMES_CLOSED',
                **common_closure,
            })
            lifetime = put(output, 'root-native-lifetime.json', {
                'schema': 'feature63-root-native-lifetime-disposition-v1',
                'approved': True,
                'assignedBy': '/root',
                'sourcePin': source_pin,
                'matchId': expected['matchId'],
                'captureResult': capture_record,
                'ownedNativeLifetimeIndependentlyAdmitted': True,
                'closureEvidenceDescriptors': [independent, closure_record],
                'unobservedDescendantsExcluded': False,
            })
            closed = put(output, 'closed-raw.json', {
                'schema': 'feature63-closed-raw-v1',
                'sourcePin': source_pin,
                'matchId': expected['matchId'],
                'sealId': 'feature63-r7-' + source_pin[:12] + '-' + output.name.rsplit('-', 1)[-1],
                'producerClosed': True,
                'ownedProcessesClosed': True,
                'rootSealed': True,
                'sidecarsAbsent': True,
                'dbIdentity': {'device': raw_record['device'], 'inode': raw_record['inode']},
                'rawBytes': raw_record['bytes'],
                'rawSha256': raw_record['sha256'],
            })
            custody = put(output, 'root-custody.json', {
                'schema': 'feature63-root-raw-custody-v1',
                'approved': True,
                'assignedBy': '/root',
                'sourcePin': source_pin,
                'matchId': expected['matchId'],
                'rawDatabase': raw_record,
                'captureResult': capture_record,
                'closedRawReceipt': closed,
                'freshDatabaseAuthenticated': True,
                'oldRawNeverReadOrReused': True,
                'rootSealed': True,
                'noLivePrivateReadback': True,
                'links': 1,
                'mode': 0o444,
                'nativeSchemaReviewIssued': False,
            })
            final_raw_expected = sealed
            report = {
                'schema': 'feature63-r7-custody-result-v1',
                'status': 'PASSING_R7_RAW_SEALED_SINGLE_LINK_EXTRACTION_INPUTS_PENDING',
                'sourcePin': source_pin,
                'branch': branch,
                'rootOutput': str(output),
                'nativeLifetime': lifetime,
                'closedRaw': closed,
                'custody': custody,
                'rawDatabase': raw_record,
                'nativeSchemaReviewIssued': False,
                'extractionExecuted': False,
                'sqlExecuted': False,
            }
        else:
            retained = output / 'closed-server.sqlite'
            os.link(raw, retained, follow_symlinks=False)
            linked = os.fstat(raw_fd)
            require(linked.st_nlink == 2 and stat.S_IMODE(linked.st_mode) == 0o444
                    and identity(linked) == identity(raw.lstat()) == identity(retained.lstat()),
                    'Failed raw hardlink custody differs')
            retained_record = {'path': str(retained), 'bytes': linked.st_size, 'sha256': raw_record['sha256'],
                               'device': linked.st_dev, 'inode': linked.st_ino, 'mode': 0o444, 'links': 2}
            lifetime = put(output, 'root-native-lifetime-disposition.json', {
                'schema': 'feature63-r7-failed-native-lifetime-disposition-v1',
                'status': 'ROOT_R7_FAILED_CAPTURE_REGISTERED_LIFETIMES_CLOSED',
                **common_closure,
                'helperCompatibleApprovalIssued': False,
            })
            failure = put(output, 'root-failure-disposition.json', {
                'schema': 'feature63-r7-failure-custody-v1',
                'status': 'FAILED_R7_RAW_RETAINED_NO_EXTRACTION',
                'sourcePin': source_pin,
                'matchId': expected['matchId'],
                'captureResult': capture_record,
                'expectation': expectation_record,
                'originalPath': str(raw),
                'retainedRaw': retained_record,
                'firstFailure': expected['firstFailure'],
                'captureInvocations': 1,
                'automaticRetries': 0,
                'sidecarsAbsent': True,
                'rootNativeLifetimeDisposition': lifetime,
                'sqlExtractionOrAudit': False,
                'feature63Qualified': False,
                'helperCompatibleApprovalIssued': False,
                'slotReleasedByThisUtility': False,
            })
            final_raw_expected = linked
            report = {
                'schema': 'feature63-r7-custody-result-v1',
                'status': 'FAILED_R7_RAW_SEALED_AND_RETAINED_NO_EXTRACTION',
                'sourcePin': source_pin,
                'branch': branch,
                'rootOutput': str(output),
                'nativeLifetimeDisposition': lifetime,
                'failureDisposition': failure,
                'retainedRaw': retained_record,
                'extractionExecuted': False,
                'sqlExecuted': False,
            }

        final_raw = os.fstat(raw_fd)
        require(identity(final_raw) == identity(final_raw_expected) == identity(raw.lstat()),
                'Fresh raw identity changed after receipt construction')
        if branch == 'failure':
            require(identity(final_raw) == identity(retained.lstat()),
                    'Retained failed raw link changed after receipt construction')
        require(all(not os.path.lexists(str(raw) + suffix) for suffix in ('-wal', '-shm', '-journal')),
                'Fresh raw sidecar appeared after receipt construction')
        result_descriptor = put(output, 'root-custody-result.json', report)
        report['result'] = result_descriptor
        for child in output.iterdir():
            require(child.is_file() and not child.is_symlink() and stat.S_IMODE(child.stat().st_mode) == 0o444,
                    'Custody output member is not immutable')
        os.chmod(output, 0o555)
        require(stat.S_IMODE(output.stat().st_mode) == 0o555, 'Custody output directory is not immutable')
        print(json.dumps(report, sort_keys=True, allow_nan=False))
        return 0
    finally:
        os.close(raw_fd)
        if output is not None and output.exists() and stat.S_IMODE(output.stat().st_mode) != 0o555:
            for child in output.iterdir():
                if child.is_file() and not child.is_symlink():
                    try:
                        child.chmod(0o444)
                    except OSError:
                        pass
            try:
                output.chmod(0o555)
            except OSError:
                pass


if __name__ == '__main__':
    raise SystemExit(main())
