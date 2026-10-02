#!/usr/bin/env python3
from pathlib import Path
import copy
import datetime
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile

ROOT = Path('/home/morgana/Projects/orcs-vs-Fairies')
OWNED = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
PREVIOUS = Path('/tmp/ovf-root-feature63-r3-package-bind-aa0pwqy6/bindings')
PREFIX = OWNED / 'work/feature63-human-wave-composition-r8'
PRIOR = OWNED / 'work/feature63-human-wave-composition-r6'

R3_READBACK = PREVIOUS / 'binding-readback.json'
R3_READBACK_EXPECTED = {
    'path': str(R3_READBACK), 'bytes': 5665,
    'sha256': '510f81922a5987163247eb9623b138068cdcb1d727d5389582607cfc8195cb7f', 'mode': 0o644,
}
R6_READBACK = Path('/tmp/ovf-root-feature63-r6-bindings-xyvt_n02/root-binding-readback.json')
R6_READBACK_EXPECTED = {
    'path': str(R6_READBACK), 'bytes': 3541,
    'sha256': '6697c4abdbbaf43fbc0e6dffddccca604ac88e336af8185322995072a544229c', 'mode': 0o644,
}
R6_PACKAGE = Path('/tmp/ovf-root-feature63-r6-bindings-xyvt_n02/root-fresh-package-result.json')
R6_PACKAGE_EXPECTED = {
    'path': str(R6_PACKAGE), 'bytes': 87565,
    'sha256': 'c052f6e73d8f831f10ca66594fddcfdcc5cfaf1b00340565cea8f0698d2e17e3', 'mode': 0o644,
}
PRODUCT_ORIGINAL = Path('/tmp/ovf-main402-remaining-2e5-r1/tested-product-before.json')
PRODUCT_ORIGINAL_EXPECTED = {
    'path': str(PRODUCT_ORIGINAL), 'bytes': 101264,
    'sha256': '582f809d9a4e0180dd3d59147b7edfd881b091334f715d86bd56ea93c9db4a06', 'mode': 0o644,
}
PRODUCT_GIT_PATH = 'docs/evidence/main402-remaining-witness-2e5-20261001/raw/tested-product-before.json'
PROTECTED_ORIGINAL = Path('/tmp/ovf-main402-remaining-2e5-r1/protected-before.json')
PROTECTED_ORIGINAL_EXPECTED = {
    'path': str(PROTECTED_ORIGINAL), 'bytes': 74175,
    'sha256': 'ed80088ef418debe90883929c364a588521815d14dbdd9703d8c6927c5855a5b', 'mode': 0o644,
}
PROTECTED_GIT_PATH = 'docs/evidence/main402-remaining-witness-2e5-20261001/raw/protected-before.json'
LAUNCHER_TEMPLATE = Path('/tmp/ovf-feature63-static-prep-r3-zsttudqb/independent-launcher/launch-capture.r3.template.py')
LAUNCHER_TEMPLATE_EXPECTED = {
    'path': str(LAUNCHER_TEMPLATE), 'bytes': 19356,
    'sha256': '1b99137e822c004361ee4ff1906f10f4284453312914092441666dd721f0feb3', 'mode': 0o600,
}

EXPECTED_REVIEW_SCHEMA = 'feature63-r7-final-static-independent-review-v1'
EXPECTED_REVIEW_STATUS = 'PASS_STATIC_R7_PUBLIC_OWNER2_APPROACH_RUNTIME_HELD'
REVIEW_ROLES = {'wrapper', 'producer', 'collector', 'frozenAuditor', 'bindingUtility'}
SCRIPT_NAMES = {
    'wrapper': 'run-minimal63.py',
    'producer': 'public-producer.mjs',
    'collector': 'collect-launched-waves.py',
    'frozenAuditor': 'native-audit.py',
}
MAX_DEFINITION_BYTES = 4 * 1024 * 1024
MAX_INVENTORY_MEMBER_BYTES = 2 * 1024 * 1024 * 1024
DEFINITION_CACHE = {}


def require(value, message):
    if not value:
        raise RuntimeError(message)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def identity(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns,
            info.st_mode, info.st_nlink)


def stable_read(path, cap):
    path = Path(path)
    require(path.is_absolute() and path.resolve() == path and not path.is_symlink(), 'Noncanonical or symlinked file: ' + str(path))
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and 0 <= before.st_size <= cap, 'Nonregular or oversized file: ' + str(path))
        chunks = []
        remaining = before.st_size
        while remaining:
            chunk = os.read(fd, min(remaining, 1024 * 1024))
            require(bool(chunk), 'Short read: ' + str(path))
            chunks.append(chunk)
            remaining -= len(chunk)
        require(not os.read(fd, 1), 'File grew while reading: ' + str(path))
        after = os.fstat(fd)
        named = path.lstat()
        require(identity(before) == identity(after) == identity(named), 'File changed while reading: ' + str(path))
        return b''.join(chunks), before
    finally:
        os.close(fd)


def record(path, raw, info, include_mode=False):
    value = {'path': str(path), 'bytes': len(raw), 'sha256': digest(raw)}
    if include_mode:
        value['mode'] = stat.S_IMODE(info.st_mode)
    return value


def fresh_descriptor(path, include_mode=False, cap=MAX_INVENTORY_MEMBER_BYTES):
    raw, info = stable_read(path, cap)
    return record(Path(path), raw, info, include_mode), raw


def definition(path, expected, parse_json=True, cap=MAX_DEFINITION_BYTES):
    path = Path(path)
    require(path not in DEFINITION_CACHE, 'Definition reloaded after verification: ' + str(path))
    raw, info = stable_read(path, cap)
    actual = record(path, raw, info, include_mode=True)
    require(actual == expected, 'Pinned definition differs: ' + str(path))
    value = json.loads(raw) if parse_json else raw
    entry = {'descriptor': {key: actual[key] for key in ('path', 'bytes', 'sha256')},
             'mode': actual['mode'], 'raw': raw, 'value': value}
    DEFINITION_CACHE[path] = entry
    return entry


def mode(value):
    return int(value, 8) if isinstance(value, str) else value


def inventory(base):
    rows = []
    for path in base.rglob('*'):
        if path.is_file():
            actual, _raw = fresh_descriptor(path, include_mode=True)
            actual['path'] = str(path.relative_to(base))
            rows.append(actual)
    return sorted(rows, key=lambda row: row['path'])


def authenticate_inventory(base, rows, complete=False):
    normalized = []
    for row in rows:
        path = base / row['path']
        actual, _raw = fresh_descriptor(path, include_mode=True)
        expected = {'path': str(path), 'bytes': row['bytes'], 'sha256': row['sha256'], 'mode': mode(row['mode'])}
        require(actual == expected, 'Inventory member differs: ' + str(path))
        normalized.append({**row, 'mode': mode(row['mode'])})
    if complete:
        require(inventory(base) == sorted(normalized, key=lambda row: row['path']),
                'Complete inventory differs: ' + str(base))


def git_output(base, arguments):
    return subprocess.check_output(['git'] + arguments, cwd=base, env=dict(os.environ, GIT_OPTIONAL_LOCKS='0'))


def git_blob(base, pin, relative_path):
    return git_output(base, ['cat-file', 'blob', pin + ':' + relative_path])


def json_bytes(value):
    return (json.dumps(value, indent=2, sort_keys=True) + '\n').encode()


def put(output, name, value):
    path = output / name
    raw = json_bytes(value)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, 'wb', closefd=False) as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(fd)
        os.fchmod(fd, 0o644)
    finally:
        os.close(fd)
    actual, _raw = fresh_descriptor(path)
    return actual


def main():
    require(len(sys.argv) == 4, 'Usage: fresh-r8-bindings.py FUTURE_PIN REVIEW_PATH REVIEW_SHA256')
    pin = sys.argv[1]
    review_path = Path(sys.argv[2])
    review_sha = sys.argv[3]
    require(re.fullmatch('[0-9a-f]{40}', pin) is not None, 'Future root pin must be a full lowercase commit ID')
    require(re.fullmatch('[0-9a-f]{64}', review_sha) is not None, 'Review digest must be lowercase SHA-256')

    # First gate: no output directory, prefix, assignment, control, or slot exists before this completes.
    review_entry = definition(review_path, {
        'path': str(review_path), 'bytes': review_path.stat().st_size, 'sha256': review_sha,
        'mode': stat.S_IMODE(review_path.stat().st_mode),
    })
    review = review_entry['value']
    require(review.get('schema') == EXPECTED_REVIEW_SCHEMA and review.get('status') == EXPECTED_REVIEW_STATUS
            and review.get('runtimeExecuted') is False, 'Independent R7 review is absent or has the wrong scope')
    reviewed_files = review.get('reviewedFiles')
    require(isinstance(reviewed_files, list) and len(reviewed_files) == 5, 'Independent review must contain five reviewed roles')
    reviewed_roles = {row.get('role'): row for row in reviewed_files if isinstance(row, dict)}
    require(set(reviewed_roles) == REVIEW_ROLES and all(re.fullmatch('[0-9a-f]{64}', row.get('sha256', ''))
                                                        for row in reviewed_roles.values()),
            'Independent review role set or digest differs')

    self_path = Path(__file__)
    require(self_path.is_absolute(), 'Binding utility must be invoked by absolute path')
    self_descriptor, _self_raw = fresh_descriptor(self_path)
    require(self_descriptor['sha256'] == reviewed_roles['bindingUtility']['sha256'],
            'Binding utility differs from independently reviewed bytes')
    reviewed_actual = {}
    for role, name in SCRIPT_NAMES.items():
        reviewed_actual[role] = {}
        for label, base in (('root', ROOT), ('owned', OWNED)):
            actual, _raw = fresh_descriptor(base / 'scripts/feature63' / name)
            require(actual['sha256'] == reviewed_roles[role]['sha256'],
                    'Actual script differs from independently reviewed bytes: ' + role + '/' + label)
            reviewed_actual[role][label] = actual

    # Stable definitions and prior receipts are each read once, hashed, then parsed from those same bytes.
    r3_readback_entry = definition(R3_READBACK, R3_READBACK_EXPECTED)
    r3_records = {Path(row['path']).name: row for row in r3_readback_entry['value']['generated']}
    r3_loaded = {}

    def load_r3(name):
        require(name not in r3_loaded, 'Historical R3 definition loaded twice: ' + name)
        row = r3_records[name]
        expected = {'path': str(PREVIOUS / name), 'bytes': row['bytes'], 'sha256': row['sha256'], 'mode': mode(row['mode'])}
        entry = definition(PREVIOUS / name, expected)
        r3_loaded[name] = entry
        return copy.deepcopy(entry['value'])

    r6_readback_entry = definition(R6_READBACK, R6_READBACK_EXPECTED)
    r6_readback = r6_readback_entry['value']
    require(r6_readback.get('runtimeExecuted') is False, 'Immediate-prior R6 readback records runtime execution')
    r6_package_rows = [row for row in r6_readback['completeOutputRecords'] if row['path'] == R6_PACKAGE.name]
    require(len(r6_package_rows) == 1, 'Immediate-prior R6 package record missing or ambiguous')
    expected_package_row = {key: R6_PACKAGE_EXPECTED[key] for key in ('bytes', 'sha256', 'mode')}
    require({key: r6_package_rows[0][key] for key in ('bytes', 'sha256', 'mode')} == expected_package_row,
            'Immediate-prior R6 package record differs from pinned descriptor')
    r6_package_entry = definition(R6_PACKAGE, R6_PACKAGE_EXPECTED)
    r6_package = r6_package_entry['value']
    require(r6_package.get('status') == 'EXACT_WEB_AND_SERVER_COPY_PASSED'
            and r6_package.get('captureAuthorized') is False, 'Immediate-prior R6 package is held')

    product_entry = definition(PRODUCT_ORIGINAL, PRODUCT_ORIGINAL_EXPECTED)
    protected_entry = definition(PROTECTED_ORIGINAL, PROTECTED_ORIGINAL_EXPECTED)
    for base in (ROOT, OWNED):
        require(product_entry['raw'] == git_blob(base, pin, PRODUCT_GIT_PATH),
                'External product inventory differs from pinned Git original')
        require(protected_entry['raw'] == git_blob(base, pin, PROTECTED_GIT_PATH),
                'External protected inventory differs from pinned Git original')
    launcher_template_entry = definition(LAUNCHER_TEMPLATE, LAUNCHER_TEMPLATE_EXPECTED, parse_json=False)

    for base in (ROOT, OWNED):
        require(git_output(base, ['rev-parse', 'HEAD']).decode().strip() == pin, 'Checkout HEAD differs from future root pin')
        require(git_output(base, ['status', '--porcelain', '--untracked-files=no']) == b'', 'Tracked checkout is dirty')
    require(not PREFIX.exists(), 'R8 prefix already exists')

    previous = load_r3('capture-assignment.json')
    source = load_r3('source-binding.json')
    build = load_r3('build-binding.json')
    tests = load_r3('tested-build.json')
    runtime_review = load_r3('root-review.json')
    browser = load_r3('browser-binding.json')
    product = product_entry['value']
    protected = protected_entry['value']['dist']

    for base in (ROOT, OWNED):
        authenticate_inventory(base, product)
    authenticate_inventory(ROOT / 'dist', protected, complete=True)
    require(len(product) == 570 and len(protected) == 397, 'Pinned product or protected inventory count differs')
    require(len(browser['dependencyRecords']) == 114 and len(browser['chromiumDependencyRecords']) == 303,
            'Browser dependency inventory count differs')
    require(len(build['webRecords']) == 398 and len(build['serverRecords']) == 22,
            'Build inventory count differs')
    for key in ('dependencyRecords', 'chromiumDependencyRecords'):
        dependency_root = Path(browser['dependencyRoot' if key == 'dependencyRecords' else 'chromiumDependencyRoot'])
        authenticate_inventory(dependency_root, browser[key], complete=True)
    for row in source['records']:
        actual, _raw = fresh_descriptor(ROOT / row['path'], include_mode=True)
        row.update({'bytes': actual['bytes'], 'sha256': actual['sha256'], 'mode': actual['mode']})
    authenticate_inventory(OWNED, source['records'])
    require(len(source['records']) == 966, 'Source inventory count differs')
    for key in ('nodeExecutable', 'pythonExecutable'):
        actual, _raw = fresh_descriptor(Path(previous[key]['path']))
        require(actual == previous[key], 'Frozen executable descriptor differs: ' + key)
    require(reviewed_actual['frozenAuditor']['owned'] == previous['auditor'], 'Frozen auditor descriptor differs')
    previous['publicProducer'] = reviewed_actual['producer']['owned']
    previous['collector'] = reviewed_actual['collector']['owned']
    previous['wrapperSha256'] = reviewed_actual['wrapper']['owned']['sha256']
    for name, rows in (('dist', build['webRecords']), ('server', build['serverRecords'])):
        authenticate_inventory(PRIOR / name, rows, complete=True)

    # All read-only gates have passed. Filesystem writes start here.
    output = Path(tempfile.mkdtemp(prefix='ovf-root-feature63-r8-bindings-', dir='/tmp'))
    print(json.dumps({'rootOutput': str(output)}), flush=True)
    stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    PREFIX.mkdir()
    for name, rows in (('dist', build['webRecords']), ('server', build['serverRecords'])):
        shutil.copytree(PRIOR / name, PREFIX / name, copy_function=shutil.copy2)
        authenticate_inventory(PREFIX / name, rows, complete=True)
    require(sorted(path.name for path in PREFIX.iterdir()) == ['dist', 'server'], 'Fresh R8 prefix contains unexpected entries')

    package = put(output, 'root-fresh-package-result.json', {
        'schema': 1,
        'status': 'EXACT_WEB_AND_SERVER_COPY_PASSED',
        'sourcePin': pin,
        'sourcePrefix': str(PRIOR),
        'freshPrefix': str(PREFIX),
        'counts': {'dist': 398, 'server': 22},
        'completeInventories': [{'directory': name, 'files': inventory(PREFIX / name)} for name in ('dist', 'server')],
        'priorBindingReadback': r6_readback_entry['descriptor'],
        'priorPackagingReceipt': r6_package_entry['descriptor'],
        'productInventoryOriginal': {**product_entry['descriptor'], 'gitPath': PRODUCT_GIT_PATH},
        'protectedInventoryOriginal': {**protected_entry['descriptor'], 'gitPath': PROTECTED_GIT_PATH},
        'productBuildExecuted': False,
        'serverBrowserDatabaseRuntimeExecuted': False,
        'databaseProfileOrOldDataCopied': False,
        'sourcePrefixRuntimeDataRead': False,
        'captureAuthorized': False,
    })
    slot = {
        'approved': True,
        'holder': '/root/ai_modes',
        'token': 'heavy-runtime-1-feature63-r8-' + pin[:12] + '-' + output.name.rsplit('-', 1)[-1],
        'validUntil': (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=2)).isoformat(),
    }

    r3_name_by_schema = {
        'feature63-new-source-binding-v1': 'source-binding.json',
        'feature63-build-binding-v1': 'build-binding.json',
        'feature63-tested-build-v1': 'tested-build.json',
        'feature63-dedicated-wrapper-review-v1': 'root-review.json',
        'feature63-browser-binding-v1': 'browser-binding.json',
    }
    for value in (source, build, tests, runtime_review, browser):
        value.update({'sourcePin': pin, 'createdAt': stamp})
        value['provenance'] = {
            'priorR3Binding': r3_loaded[r3_name_by_schema[value['schema']]]['descriptor'],
            'r7StaticReview': review_entry['descriptor'],
            'r6RootBindingReadback': r6_readback_entry['descriptor'],
            'r6RootPackage': r6_package_entry['descriptor'],
            'scope': 'Root independently authenticated current bytes and files; retained R3 descriptors are historical provenance only; R6 package and readback are the immediate copy lineage.',
        }
    source_d = put(output, 'source-binding.json', source)
    build.update({
        'producerSha256': previous['publicProducer']['sha256'],
        'publicDriverSha256': previous['wrapperSha256'],
        'webDistPath': str(PREFIX / 'dist'),
        'serverBuildPath': str(PREFIX / 'server'),
    })
    build_d = put(output, 'build-binding.json', build)
    tests.update({'sourceBinding': source_d, 'buildBinding': build_d})
    tests_d = put(output, 'tested-build.json', tests)
    runtime_review.update({
        'wrapperSha256': previous['wrapperSha256'],
        'publicProducerSha256': previous['publicProducer']['sha256'],
        'collectorSha256': previous['collector']['sha256'],
        'staticDriverReviews': runtime_review['staticDriverReviews'] + [review_entry['descriptor']],
        'reviewScope': 'Root admits exact current R7 bytes and fresh bindings after the independent public-owner-2 approach static review. Prior reviews retain their original scopes. Runtime remains held.',
    })
    runtime_review_d = put(output, 'root-review.json', runtime_review)
    browser.update({
        'producerSha256': previous['publicProducer']['sha256'],
        'buildBindingSha256': build_d['sha256'],
        'exclusiveSlotToken': slot['token'],
    })
    browser_d = put(output, 'browser-binding.json', browser)

    assignment_value = previous
    assignment_value.update({
        'sourcePin': pin,
        'freshPrefix': 'work/feature63-human-wave-composition-r8',
        'exclusiveHeavyApproval': slot,
        'sourceBinding': source_d,
        'buildBinding': build_d,
        'testedBuildReceipt': tests_d,
        'reviewReceipt': runtime_review_d,
        'browserBinding': browser_d,
    })
    public = assignment_value['publicAssignmentTemplate']
    public.update({
        'sourcePin': pin,
        'freshPrefix': assignment_value['freshPrefix'],
        'outputRoot': str(PREFIX / 'public'),
        'publicDriverSha256': assignment_value['wrapperSha256'],
        'reviewedProducer': assignment_value['publicProducer'],
        'exclusiveHeavyApproval': slot,
        'sourceBinding': source_d,
        'buildBinding': build_d,
        'browserBinding': browser_d,
        'serverOwnership': None,
        'externalBrowserOwnership': None,
    })
    collector = assignment_value['collectorAssignmentTemplate']
    collector.update({
        'sourcePin': pin,
        'outputPrefix': assignment_value['freshPrefix'],
        'sourceInventory': source_d,
        'reviewReceipt': runtime_review_d,
        'collectorSha256': assignment_value['collector']['sha256'],
        'heavySlot': {'assigned': True, 'exclusive': True, 'slotId': slot['token']},
        'freshDatabase': {**collector['freshDatabase'], 'path': str(PREFIX / 'server-data/server.sqlite')},
        'publicMatchIdentity': None,
    })
    assignment = put(output, 'capture-assignment.json', assignment_value)
    control = Path(tempfile.mkdtemp(prefix='ovf-feature63-r8-capture-control-', dir='/tmp'))
    require(not list(control.iterdir()) and stat.S_IMODE(control.stat().st_mode) == 0o700,
            'Fresh R8 capture control is not empty and private')
    disposition_value = {
        'schema': 1,
        'status': 'PASS_ROOT_R8_FRESH_CAPTURE_BINDINGS_AUTHENTICATED',
        'at': stamp,
        'captureAdmitted': True,
        'captureInvocationsAuthorized': 1,
        'slotExclusivelyAssignedTo': '/root/ai_modes',
        'noAutomaticRetryAuthorized': True,
        'sourcePin': pin,
        'captureAssignment': assignment,
        'slot': slot,
        'feature63Qualified': False,
        'unobservedDescendantsExcluded': False,
        'freshPrivateEmptyControl': {'path': str(control), 'mode': 0o700, 'filenames': []},
        'rootProduct570BothSource966OwnedAndProtectedDist397Authenticated': True,
        'dependency114Playwright303ChromiumAuthenticated': True,
        'web398Server22FreshIndependentCopies': True,
        'priorFailedDbProfileBindingsNotReused': True,
    }
    disposition = put(output, 'root-capture-disposition.json', disposition_value)

    text = launcher_template_entry['raw'].decode()
    text = text.replace('feature63-human-wave-composition-r3', 'feature63-human-wave-composition-r8')
    text = text.replace("SLOT_TOKEN.startswith('heavy-runtime-1-feature63-r3-')",
                        "SLOT_TOKEN.startswith('heavy-runtime-1-feature63-r8-')")
    mapping = {
        'ROOT_RUNTIME_ANCHORS_FILLED=False': 'ROOT_RUNTIME_ANCHORS_FILLED=True',
        'CONTROL=None': 'CONTROL=Path(' + repr(str(control)) + ')',
        'ASSIGNMENT=None': 'ASSIGNMENT=Path(' + repr(assignment['path']) + ')',
        'DIGEST=None': 'DIGEST=' + repr(assignment['sha256']),
        'DISPOSITION=None': 'DISPOSITION=Path(' + repr(disposition['path']) + ')',
        'DISPOSITION_SHA=None': 'DISPOSITION_SHA=' + repr(disposition['sha256']),
        'PIN=None': 'PIN=' + repr(pin),
        'SLOT_TOKEN=None': 'SLOT_TOKEN=' + repr(slot['token']),
        "WRAPPER_SHA='f5b5428c531e99f15885cd48a513d4167aea02bab461f998a99719315d9ddc70'":
            'WRAPPER_SHA=' + repr(assignment_value['wrapperSha256']),
    }
    for old, new in mapping.items():
        require(text.count(old) == 1, 'Launcher template anchor count differs: ' + old)
        text = text.replace(old, new)
    launcher = output / 'launch-capture.r8.py'
    with os.fdopen(os.open(launcher, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), 'w') as handle:
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())
    launcher_descriptor, _raw = fresh_descriptor(launcher)

    readback = put(output, 'root-binding-readback.json', {
        'schema': 1,
        'sourcePin': pin,
        'r7StaticReview': review_entry['descriptor'],
        'priorR6BindingReadback': r6_readback_entry['descriptor'],
        'priorR6Package': r6_package_entry['descriptor'],
        'captureAssignment': assignment,
        'launcher': launcher_descriptor,
        'launcherChanges': mapping,
        'freshControl': str(control),
        'completeOutputRecords': inventory(output),
        'runtimeExecuted': False,
        'qualification': 'Bindings authorize one capture; no feature qualification, native custody, extraction, audit, or complete descendant enumeration is asserted.',
    })
    require(not list(control.iterdir()), 'Fresh R8 capture control changed while binding')
    print(json.dumps({
        'rootOutput': str(output),
        'captureAssignment': assignment,
        'disposition': disposition,
        'launcher': launcher_descriptor,
        'readback': readback,
        'control': str(control),
        'slot': slot,
        'sourcePin': pin,
    }))


if __name__ == '__main__':
    main()
