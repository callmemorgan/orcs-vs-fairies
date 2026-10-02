#!/usr/bin/env python3
"""Preparation only. Root may run this after script import and isolated packaging.

Reads authenticated files and Git metadata; writes a fresh external receipt directory.
Never builds, imports a candidate, launches a match, reads a database, or signals a PID.
"""
import ast
import datetime
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
from pathlib import Path

CHECKOUT = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
PROTECTED = Path('/home/morgana/Projects/orcs-vs-Fairies')
PACKET = Path('/tmp/ovf-feature63-second-attempt-prep-r2-4kTK32yI/packet')
HISTORICAL_PACKET = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/feature63-dedicated-wrapper-readiness-r1')
PREFIX_NAME = 'work/feature63-human-wave-composition-r2'
PREFIX = CHECKOUT / PREFIX_NAME
TESTED_PACKET = Path('/tmp/ovf-id6-composed-full-build-f7-r2-o0w9akew')
TESTED_WEB = Path('/tmp/ovf-id6-integration-703fc-20261001/dist')
TESTED_PIN = 'f7f3e187ea40079492589a6fce39f0b33f77f04a'
TESTED_ID = '9c5d2f1ff26bd6849b1ad5e311300669fb5f02feebbe4d311b6f8d670df243e1'
SEAL_SHA = 'fd11e341714b1fcbf6a26ff0d0e5482df5dfe8ade0f0d68281874daeedc4e811'
HISTORICAL_SEAL_SHA = '88d08b5409ed13d3f8d783b7d8e40ddb95a6a3843992a0cae5599731b55d3034'
TESTED_MANIFEST_SHA = '7439266f468c658d419b2c801b6a741a20b202aa8459169c96b47532640d3ec2'
SCRIPT_MAP = {
    'wrapper': ('scripts/run-minimal63.py', 'scripts/feature63/run-minimal63.py'),
    'publicProducer': ('scripts/public-producer.mjs', 'scripts/feature63/public-producer.mjs'),
    'collector': ('scripts/collect-launched-waves.py', 'scripts/feature63/collect-launched-waves.py'),
    'auditor': ('scripts/native-audit.py', 'scripts/feature63/native-audit.py'),
}


def need(ok, message):
    if not ok:
        raise ValueError(message)


def canonical(value):
    p = Path(value)
    need(p.is_absolute() and p.resolve() == p and not p.is_symlink(), 'Use a canonical absolute path: ' + str(p))
    return p


def safe_relative(value):
    p = Path(value)
    need(isinstance(value, str) and value and not p.is_absolute() and '..' not in p.parts
         and p.as_posix() == value and value != '.', 'Unsafe relative file path: ' + str(value))
    return p


def no_database(p):
    name = p.name.lower()
    need(not any(name.endswith(x) for x in ('.sqlite', '.sqlite3', '.db', '-wal', '-shm'))
         and '.sqlite-' not in name, 'This generator does not read databases: ' + str(p))


def read_actual(path, retain=False, maximum=1024 * 1024 * 1024):
    p = canonical(path)
    no_database(p)
    fd = os.open(p, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        need(stat.S_ISREG(before.st_mode) and before.st_size <= maximum, 'Nonregular or oversized file: ' + str(p))
        digest = hashlib.sha256()
        chunks = []
        remaining = before.st_size
        while remaining:
            b = os.read(fd, min(remaining, 1024 * 1024))
            need(bool(b), 'Short read: ' + str(p))
            digest.update(b)
            if retain:
                chunks.append(b)
            remaining -= len(b)
        need(not os.read(fd, 1), 'File grew during read: ' + str(p))
        after = os.fstat(fd)
        attrs = ('st_dev', 'st_ino', 'st_size', 'st_mtime_ns', 'st_ctime_ns', 'st_mode')
        need(all(getattr(before, k) == getattr(after, k) for k in attrs), 'File changed during read: ' + str(p))
        return {'path': str(p), 'bytes': before.st_size, 'sha256': digest.hexdigest()}, stat.S_IMODE(before.st_mode), b''.join(chunks)
    finally:
        os.close(fd)


def bound_json(descriptor):
    d, mode, raw = read_actual(descriptor['path'], retain=True, maximum=2 * 1024 * 1024)
    need(d == descriptor, 'Bound JSON descriptor differs: ' + d['path'])
    return json.loads(raw), d, mode


def permission(value):
    if type(value) is int:
        need(0 <= value <= 4095, 'Invalid numeric permission mode')
        return value
    need(isinstance(value, str) and re.fullmatch(r'0o[0-7]+', value), 'Expected numeric permission or 0o-prefixed historical mode')
    return int(value[2:], 8)


def inventory(root):
    root = canonical(root)
    need(root.is_dir(), 'Inventory root is not a directory: ' + str(root))
    records = []
    for p in sorted(root.rglob('*')):
        need(not p.is_symlink(), 'Symlink in complete inventory: ' + str(p))
        if p.is_dir():
            continue
        d, mode, _ = read_actual(p)
        records.append({'path': p.relative_to(root).as_posix(), 'bytes': d['bytes'], 'sha256': d['sha256'], 'mode': mode})
    return records


def normalize(rows, strip=''):
    output = []
    names = set()
    for r in rows:
        path = r['path']
        if strip:
            need(path.startswith(strip), 'Historical inventory prefix differs: ' + path)
            path = path[len(strip):]
        safe_relative(path)
        need(path not in names, 'Duplicate inventory path: ' + path)
        names.add(path)
        output.append({'path': path, 'bytes': r['bytes'], 'sha256': r['sha256'], 'mode': permission(r['mode'])})
    return sorted(output, key=lambda r: r['path'])


def selected_inventory(root, paths):
    records = []
    for name in sorted(set(paths)):
        d, mode, _ = read_actual(root / safe_relative(name))
        records.append({'path': name, 'bytes': d['bytes'], 'sha256': d['sha256'], 'mode': mode})
    return records


def schema_check(value, spec, schemas, where='$'):
    """Validate the keywords used by this sealed field schema; no runtime imports."""
    if '$ref' in spec:
        name = spec['$ref'].removeprefix('#/$defs/')
        need(spec['$ref'] == '#/$defs/' + name, 'Unsupported schema reference')
        schema_check(value, schemas['$defs'][name], schemas, where)
    if 'oneOf' in spec:
        count = 0
        for choice in spec['oneOf']:
            try:
                schema_check(value, choice, schemas, where)
                count += 1
            except ValueError:
                pass
        need(count == 1, where + ': oneOf failed')
    for choice in spec.get('allOf', []):
        schema_check(value, choice, schemas, where)
    if 'if' in spec:
        try:
            schema_check(value, spec['if'], schemas, where)
            applicable = True
        except ValueError:
            applicable = False
        if applicable and 'then' in spec:
            schema_check(value, spec['then'], schemas, where)
    if 'const' in spec:
        need(type(value) is type(spec['const']) and value == spec['const'], where + ': const differs')
    if 'enum' in spec:
        need(value in spec['enum'], where + ': enum differs')
    types = {'object': dict, 'array': list, 'string': str, 'integer': int, 'null': type(None), 'boolean': bool}
    if 'type' in spec:
        names = spec['type'] if isinstance(spec['type'], list) else [spec['type']]
        need(any(type(value) is types[n] for n in names), where + ': type differs')
    if isinstance(value, dict):
        need(all(k in value for k in spec.get('required', [])), where + ': required fields absent')
        props = spec.get('properties', {})
        if spec.get('additionalProperties') is False:
            need(set(value) <= set(props), where + ': extra fields')
        for k, item in value.items():
            if k in props:
                schema_check(item, props[k], schemas, where + '.' + k)
    if isinstance(value, list):
        need(len(value) >= spec.get('minItems', 0), where + ': too few items')
        for item in value:
            if 'items' in spec:
                schema_check(item, spec['items'], schemas, where + '[]')
        if 'contains' in spec:
            found = False
            for item in value:
                try:
                    schema_check(item, spec['contains'], schemas, where + '[]')
                    found = True
                except ValueError:
                    pass
            need(found, where + ': required contained record absent')
    if isinstance(value, str):
        need(len(value) >= spec.get('minLength', 0), where + ': string too short')
        if 'pattern' in spec:
            need(re.search(spec['pattern'], value) is not None, where + ': pattern differs')
        if spec.get('format') == 'date-time':
            need(datetime.datetime.fromisoformat(value.replace('Z', '+00:00')).tzinfo is not None, where + ': timezone absent')
    if type(value) is int:
        need(value >= spec.get('minimum', value) and value <= spec.get('maximum', value), where + ': numeric bound differs')


def main():
    need(len(sys.argv) == 3, 'Syntax: generate-root-bindings.py ABSOLUTE_ROOT_PARAMETERS ROOT_PARAMETERS_SHA256')
    parameter_desc, _, parameter_raw = read_actual(sys.argv[1], retain=True, maximum=128 * 1024)
    need(re.fullmatch('[a-f0-9]{64}', sys.argv[2]) and parameter_desc['sha256'] == sys.argv[2], 'External root parameter digest differs')
    params = json.loads(parameter_raw)
    need(params['schema'] == 'feature63-root-binding-generator-input-v1', 'Parameter schema differs')
    pin = params['sourcePin']
    need(isinstance(pin, str) and re.fullmatch('[a-f0-9]{40}', pin), 'Root must supply the future full scripts-only pin')
    need(params['testedBuildId'] == TESTED_ID, 'Use the authenticated tested f7 build ID')
    admission = params['rootAdmission']
    for k in ('approved', 'sourceInputSetAuthenticated', 'sourceAndBuiltBytesMatchTested402',
              'dedicatedReviewApproved', 'allDependencyBytesAuthenticated'):
        need(admission[k] is True, 'Pending root assertion: ' + k)
    output = canonical(params['outputDirectory'])
    need(not output.exists(), 'Output must be a fresh external directory; partial failures stay preserved')
    for forbidden in (CHECKOUT, PROTECTED, PACKET, HISTORICAL_PACKET, TESTED_PACKET, TESTED_WEB.parent):
        need(output != forbidden and not output.is_relative_to(forbidden), 'Receipt output must be external to source and evidence trees')
    need(output.parent.is_dir(), 'Output parent must already exist')
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=CHECKOUT, text=True).strip()
    need(head == pin, 'Owned source HEAD differs from future root pin')
    need(subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=no'], cwd=CHECKOUT, text=True) == '', 'Tracked source is dirty')
    tracked = set(subprocess.check_output(['git', 'ls-files', '-z'], cwd=CHECKOUT).decode().rstrip('\0').split('\0'))

    need(re.fullmatch('[a-f0-9]{64}', SEAL_SHA) is not None, 'Root must replace the pending current packet seal anchor')
    seal_desc, _, seal_raw = read_actual(PACKET / 'final-static-seal-r2.json', retain=True, maximum=2 * 1024 * 1024)
    need(seal_desc['sha256'] == SEAL_SHA, 'Current static packet seal differs')
    sealed = {r['path']: r for r in json.loads(seal_raw)['records']}
    historical_seal_desc, _, historical_seal_raw = read_actual(HISTORICAL_PACKET / 'final-static-seal-r1.json', retain=True, maximum=2 * 1024 * 1024)
    need(historical_seal_desc['sha256'] == HISTORICAL_SEAL_SHA, 'Historical r1 static packet seal differs')
    historical_sealed = {r['path']: r for r in json.loads(historical_seal_raw)['records']}

    def packet_json(name):
        r = sealed[name]
        d = {'path': str(PACKET / name), 'bytes': r['bytes'], 'sha256': r['sha256']}
        value, actual, mode = bound_json(d)
        need(mode == r['mode'], 'Sealed metadata mode differs: ' + name)
        return value, actual

    def historical_packet_json(name):
        r = historical_sealed[name]
        d = {'path': str(HISTORICAL_PACKET / name), 'bytes': r['bytes'], 'sha256': r['sha256']}
        value, actual, mode = bound_json(d)
        need(mode == r['mode'], 'Historical sealed metadata mode differs: ' + name)
        return value, actual

    schemas, schema_desc = packet_json('root-integration/assignment-field-schemas.json')
    candidates = {}
    for key, (old, current) in SCRIPT_MAP.items():
        r = sealed[old]
        old_desc, old_mode, raw = read_actual(PACKET / old, retain=True)
        need(old_desc['sha256'] == r['sha256'] and old_desc['bytes'] == r['bytes'] and old_mode == r['mode'], 'Sealed candidate differs: ' + old)
        d, mode, _ = read_actual(CHECKOUT / current)
        need(d['sha256'] == r['sha256'] and d['bytes'] == r['bytes'] and mode == r['mode'], 'Imported current script differs: ' + current)
        if old.endswith('.py'):
            ast.parse(raw, filename=old)
        candidates[key] = d
    candidate_review, candidate_review_desc = packet_json('review/candidate-review.json')
    need(candidate_review['status'] == 'PASS_STATIC_CORRECTIVE_R2_CANDIDATE_RUNTIME_HELD', 'Current corrective candidate static review disposition differs')
    r4, r4_desc = historical_packet_json('review-driver-pidfd-r4/review.json')
    r3, r3_desc = historical_packet_json('review-driver-pidfd-r3/review.json')
    cdp, cdp_desc = historical_packet_json('dependency-review-r1/receipt.json')
    need(r4['status'] == 'PASS', 'Historical retained static review disposition differs')
    need(cdp['status'] == 'PASS_STATIC_CDP_CONTEXT_SCOPE' and cdp['runtimeAdmissionGranted'] is False, 'Static dependency proof scope differs')

    original_desc, _, original_raw = read_actual(TESTED_PACKET / 'run-artifact-manifest.json', retain=True, maximum=2 * 1024 * 1024)
    need(original_desc['sha256'] == TESTED_MANIFEST_SHA, 'Original tested manifest anchor differs')
    original = json.loads(original_raw)
    need(original['sourcePin'] == TESTED_PIN, 'Original tested manifest pin differs')
    original_rows = {r['path']: r for r in original['files']}

    def tested_json(name):
        r = original_rows[name]
        d = {'path': str(TESTED_PACKET / name), 'bytes': r['bytes'], 'sha256': r['sha256']}
        value, actual, mode = bound_json(d)
        need(mode == permission(r['mode']), 'Original tested metadata mode differs: ' + name)
        return value, actual

    baseline, baseline_desc = tested_json('expected-git-inputs.json')
    web_baseline, web_baseline_desc = tested_json('owned-build-outputs.json')
    execution, execution_desc = tested_json('execution.json')
    need(baseline['sourcePin'] == web_baseline['sourcePin'] == TESTED_PIN, 'Original inventory pin differs')
    need(web_baseline['expectedBuildId'] == execution['buildId'] == TESTED_ID, 'Original tested build ID differs')
    suite = execution['fullSuite']
    need(execution['authorizedSourceCommit'] == TESTED_PIN and execution['status'] == 'passed'
         and execution['buildExecuted'] is True and suite['success'] is True
         and suite['failed'] == 0 and suite['passed'] == suite['tests'] and suite['tests'] > 0
         and any(p['label'] == 'build' and p['exitCode'] == 0 for p in execution['phases']), 'Original full-suite/build pass not established')
    baseline_records = normalize(baseline['files'])
    configs = {r['path'] for r in baseline_records if '/' not in r['path']}
    product_expected = [r for r in baseline_records if r['path'].startswith(('src/', 'public/')) or r['path'] in configs]
    product_names = {r['path'] for r in product_expected}
    current_product_names = {n for n in tracked if n.startswith(('src/', 'public/')) or n in configs}
    need(current_product_names == product_names, 'Scripts-only pin changes the tested product filename set')
    need(selected_inventory(CHECKOUT, product_names) == product_expected, 'Future-pin product bytes/modes differ from tested f7')
    build_script = next(r for r in baseline_records if r['path'] == 'scripts/build-server.mjs')
    need(selected_inventory(CHECKOUT, [build_script['path']]) == [build_script], 'Server packaging script differs from tested source')
    source_names = {n for n in tracked if n.startswith(('src/', 'tests/', 'scripts/', 'public/'))} | configs
    source_names |= set(baseline['externalFixtures']) | set(params.get('additionalSourcePaths', []))
    source_records = selected_inventory(CHECKOUT, source_names)
    web_expected = normalize(web_baseline['files'], strip='dist/')
    original_web_records = inventory(TESTED_WEB)
    need(original_web_records == web_expected, 'Actual original tested web inventory differs')
    web_records = inventory(PREFIX / 'dist')
    need(web_records == original_web_records, 'Packaged web copy differs from original tested inventory')
    for name in web_baseline['embeddedBuildIdPaths']:
        need(name.startswith('dist/'), 'Embedded build path prefix differs')
        _, _, raw = read_actual(TESTED_WEB / safe_relative(name[5:]), retain=True)
        need(TESTED_ID.encode() in raw, 'Embedded original tested build ID absent')
    server_records = inventory(PREFIX / 'server')
    need({'rts-server.js', 'canonical-campaign.mjs'} <= {r['path'] for r in server_records}, 'Packaged server outputs absent')
    package_desc = None
    historical_package_desc = None
    package_source_pin = None
    if params.get('rootPackagingReceipt') is not None:
        fresh_package, package_desc, _ = bound_json(params['rootPackagingReceipt'])
        prior_prefix = CHECKOUT / 'work/feature63-human-wave-composition-r1'
        need(type(fresh_package['schema']) is int and fresh_package['schema'] == 1
             and fresh_package['status'] == 'EXACT_WEB_AND_SERVER_COPY_PASSED', 'Fresh root package-copy receipt scope differs')
        need(fresh_package['sourcePrefix'] == str(prior_prefix) and fresh_package['freshPrefix'] == str(PREFIX),
             'Fresh root package-copy receipt prefixes differ')
        for field in ('productBuildExecuted', 'serverBrowserDatabaseRuntimeExecuted', 'databaseProfileOrOldDataCopied',
                      'sourcePrefixRuntimeDataRead', 'captureAuthorized'):
            need(fresh_package[field] is False, 'Fresh root package-copy receipt exceeds declared scope: ' + field)
        need(fresh_package['rootProtectedIdentityUnchanged'] is True, 'Fresh root package-copy receipt lacks protected identity declaration')
        copy_inventories = {r['directory']: normalize(r['files']) for r in fresh_package['completeInventories']}
        need(len(copy_inventories) == len(fresh_package['completeInventories']) == 2
             and set(copy_inventories) == {'dist', 'server'}
             and fresh_package['counts'] == {'dist': 398, 'server': 22}
             and fresh_package['counts'] == {'dist': len(web_records), 'server': len(server_records)}
             and copy_inventories['dist'] == web_records and copy_inventories['server'] == server_records,
             'Fresh root package-copy inventories differ from actual packaged trees')
        package, historical_package_desc, _ = bound_json(fresh_package['priorPackagingReceipt'])
        package_source_pin = package['sourcePin']
        package_inventories = {r['directory']: normalize(r['files']) for r in package['completeInventories']}
        need(package['prefix'] == str(prior_prefix) and package['testedBuildId'] == TESTED_ID
             and package['buildExitCode'] == 0 and package_inventories['dist'] == web_records
             and package_inventories['server'] == server_records, 'Historical root packaging receipt differs from actual packaged copies')

    node, node_mode, _ = read_actual(params['nodeExecutablePath'])
    python, python_mode, _ = read_actual(params['pythonExecutablePath'])
    playwright_root = canonical(params['playwrightDependencyRoot'])
    chromium_root = canonical(params['chromiumDependencyRoot'])
    for root in (playwright_root, chromium_root):
        need(not output.is_relative_to(root), 'Receipt output overlaps dependency inventory')
    dependency_records = inventory(playwright_root)
    chromium_records = inventory(chromium_root)
    entry, _, _ = read_actual(params['playwrightModulePath'])
    chromium, chromium_mode, _ = read_actual(params['chromiumExecutablePath'])
    need(Path(entry['path']).is_relative_to(playwright_root) and Path(chromium['path']).is_relative_to(chromium_root), 'Executable/module not inside declared dependency root')
    reviewed_package_root = Path(cdp['package']['directory'])
    cdp_live_records = []
    for r in cdp['package']['files']:
        rel = Path(r['path']).relative_to(reviewed_package_root)
        d, mode, _ = read_actual(playwright_root / rel)
        need(d['bytes'] == r['bytes'] and d['sha256'] == r['sha256'], 'Reviewed Playwright source bytes differ: ' + str(rel))
        cdp_live_records.append({'path': rel.as_posix(), 'bytes': d['bytes'], 'sha256': d['sha256'], 'mode': mode})
    slot = params['exclusiveHeavyApproval']
    until = datetime.datetime.fromisoformat(slot['validUntil'].replace('Z', '+00:00'))
    need(until.tzinfo is not None and until.timestamp() > datetime.datetime.now(datetime.timezone.utc).timestamp() + 510, 'Existing wrapper slot-expiry requirement not met')
    stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    provenance = {'rootParameters': parameter_desc, 'staticPacketSeal': seal_desc,
                  'historicalStaticPacketSealR1': historical_seal_desc, 'currentCandidateReview': candidate_review_desc,
                  'fieldSchemas': schema_desc,
                  'originalTestedManifest': original_desc, 'originalTestedInputs': baseline_desc,
                  'originalTestedWebInventory': web_baseline_desc, 'originalTestedExecution': execution_desc}
    if package_desc is not None:
        provenance['rootPackagingReceipt'] = package_desc
        provenance['historicalRootPackagingReceipt'] = historical_package_desc
    payloads = {}

    def plan(name, value, definition=None, maximum=2 * 1024 * 1024):
        if definition:
            schema_check(value, schemas['$defs'][definition], schemas, name)
        raw = (json.dumps(value, indent=2, sort_keys=True) + '\n').encode()
        need(len(raw) <= maximum, 'Existing bound-file limit exceeded: ' + name)
        payloads[name] = raw
        return {'path': str(output / name), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}

    common = {'sourcePin': pin, 'approved': True, 'createdAt': stamp, 'assignedBy': '/root'}
    source = {**common, 'schema': 'feature63-new-source-binding-v1', 'status': 'PASS',
              'authenticatedInputs': admission['sourceInputSetAuthenticated'], 'inputCount': len(source_records),
              'includesSourceConfigPublicBuildAndProof': True, 'requiredInputSetAuthenticatedByRoot': admission['sourceInputSetAuthenticated'],
              'selection': 'All current tracked src/tests/scripts/public paths, original 12 root configs and seven historical fixtures, plus explicit root additionalSourcePaths.',
              'records': source_records, 'testedProductInputCount': len(product_expected),
              'testedProductBytesModesAndFilenameSetMatched': True, 'provenance': provenance}
    source_d = plan('source-binding.json', source, 'sourceBinding')
    build = {**common, 'schema': 'feature63-build-binding-v1', 'productVersion': '4.0.2',
             'producerSha256': candidates['publicProducer']['sha256'], 'publicDriverSha256': candidates['wrapper']['sha256'],
             'webDistPath': str(PREFIX / 'dist'), 'serverBuildPath': str(PREFIX / 'server'), 'testedBuildId': TESTED_ID,
             'webRecords': web_records, 'serverRecords': server_records,
             'originalTestedWebPath': str(TESTED_WEB), 'originalTestedWebRecords': original_web_records,
             'rootPackagingSourcePin': package_source_pin, 'provenance': provenance}
    build_d = plan('build-binding.json', build, 'buildBinding')
    tested = {**common, 'schema': 'feature63-tested-build-v1', 'testedBuildId': TESTED_ID,
              'sourceAndBuiltBytesMatchTested402': admission['sourceAndBuiltBytesMatchTested402'],
              'fullSuitePassed': True, 'buildPassed': True, 'originalTestedSourcePin': TESTED_PIN,
              'originalFullSuite': suite, 'originalWebFiles': len(original_web_records),
              'originalWebBytes': sum(r['bytes'] for r in original_web_records),
              'testedProductInputCount': len(product_expected), 'sourceBinding': source_d, 'buildBinding': build_d,
              'originalAndPackagedWebBytesModesAndFilenameSetsMatch': True, 'provenance': provenance}
    tested_d = plan('tested-build.json', tested, 'testedBuildReceipt')
    review = {**common, 'schema': 'feature63-dedicated-wrapper-review-v1', 'status': 'PASS',
              'wrapperSha256': candidates['wrapper']['sha256'], 'restoredBothOwnerHumanTargetUnion': True,
              'publicProducerSha256': candidates['publicProducer']['sha256'], 'collectorSha256': candidates['collector']['sha256'],
              'auditorSha256': candidates['auditor']['sha256'], 'nodeExecutableSha256': node['sha256'],
              'pythonExecutableSha256': python['sha256'], 'rootAdmission': admission, 'staticDriverReviews': [r3_desc, r4_desc, candidate_review_desc],
              'nativeExecutableRecords': [{**node, 'mode': node_mode}, {**python, 'mode': python_mode}, {**chromium, 'mode': chromium_mode}],
              'reviewScope': 'Root admits these current bytes and bindings; the corrective candidate review is static and runtime-held, and retained r1 reviews supply their stated bounded scopes.',
              'provenance': provenance}
    review_d = plan('root-review.json', review, 'rootRuntimeReviewReceipt')
    browser = {**common, 'schema': 'feature63-browser-binding-v1', 'producerSha256': candidates['publicProducer']['sha256'],
               'buildBindingSha256': build_d['sha256'], 'exclusiveSlotToken': slot['token'], 'contextCount': 2,
               'browserCount': 1, 'headless': True, 'nativeLifecycleOwner': 'dedicated-wrapper',
               'reviewedCdpDisconnectHasNoNativeSignals': True, 'nativeLifetimeReviewRequiredByRoot': True,
               'cdpBaseUrl': 'http://127.0.0.1:5374', 'allDependencyBytesAuthenticated': admission['allDependencyBytesAuthenticated'],
               'playwrightEntry': entry, 'chromiumExecutable': chromium, 'playwrightModulePath': entry['path'],
               'dependencyRoot': str(playwright_root), 'dependencyRecords': dependency_records,
               'chromiumDependencyRoot': str(chromium_root), 'chromiumDependencyRecords': chromium_records,
               'staticCdpProof': cdp_desc, 'reviewedPlaywrightRecordsMatched': cdp_live_records,
               'staticCdpProofScope': 'Only the seven reviewed Playwright files establish URL-CDP disconnect-only close and explicit returned-context-ID disposal. Full inventory authentication does not broaden that source review to Chromium/native lifetime.',
               'unobservedDescendantsExcluded': False, 'rootNativeLifetimeDispositionRequired': True,
               'provenance': provenance}
    browser_d = plan('browser-binding.json', browser, 'browserDependencyBinding')
    pending, _ = packet_json('capture-assignment.pending.json')
    assignment = pending
    assignment.update({'approved': True, 'sourcePin': pin, 'testedBuildId': TESTED_ID,
                       'wrapperSha256': candidates['wrapper']['sha256'],
                       'exclusiveHeavyApproval': slot, 'protectedProcess': params['protectedProcess'],
                       'protectedListenerSockets': params['protectedListenerSockets'], 'sourceBinding': source_d,
                       'buildBinding': build_d, 'testedBuildReceipt': tested_d, 'reviewReceipt': review_d,
                       'browserBinding': browser_d, 'publicProducer': candidates['publicProducer'],
                       'collector': candidates['collector'], 'auditor': candidates['auditor'],
                       'nodeExecutable': node, 'pythonExecutable': python})
    public = assignment['publicAssignmentTemplate']
    public.update({'approved': True, 'sourcePin': pin, 'review': {'approved': True, 'reviewedBy': '/root'},
                   'reviewedProducer': candidates['publicProducer'], 'exclusiveHeavyApproval': slot,
                   'sourceBinding': source_d, 'buildBinding': build_d, 'browserBinding': browser_d,
                   'serverOwnership': None, 'externalBrowserOwnership': None})
    collector = assignment['collectorAssignmentTemplate']
    collector.update({'rootApproved': True, 'sourcePin': pin, 'sourceInventory': source_d, 'reviewReceipt': review_d,
                      'heavySlot': {'assigned': True, 'exclusive': True, 'slotId': slot['token']}, 'publicMatchIdentity': None})
    assignment_d = plan('capture-assignment.json', assignment, 'rootDriverAssignment', maximum=128 * 1024)
    final = {'schema': 'feature63-generated-binding-readback-v1', 'createdAt': stamp, 'sourcePin': pin,
             'captureAssignment': assignment_d, 'externalAssignmentAnchorEnvironment': 'OVF_FEATURE63_WRAPPER_ASSIGNMENT_SHA256',
             'rootParameters': parameter_desc, 'provenance': provenance, 'generated': [
                 {'path': str(output / n), 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest(), 'mode': 420}
                 for n, b in sorted(payloads.items())],
             'sourceInputCount': len(source_records), 'testedProductInputCount': len(product_expected),
             'webFileCount': len(web_records), 'serverFileCount': len(server_records),
             'playwrightFileCount': len(dependency_records), 'chromiumFileCount': len(chromium_records),
             'runtimeLaunchBuildDatabaseSignalCgroupOrSourceWrite': False,
             'qualification': 'These are root-admitted capture bindings, not a runtime result, native-lifetime proof, extraction admission, or feature qualification.'}
    plan('binding-readback.json', final)
    output.mkdir(mode=0o700)
    for name, raw in payloads.items():
        p = output / name
        fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
        with os.fdopen(fd, 'wb') as handle:
            os.fchmod(handle.fileno(), 0o644)
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
        actual, mode, reread = read_actual(p, retain=True, maximum=2 * 1024 * 1024)
        need(reread == raw and mode == 420 and actual['sha256'] == hashlib.sha256(raw).hexdigest(), 'Generated actual readback differs: ' + name)
    print(json.dumps({'outputDirectory': str(output), 'captureAssignment': assignment_d,
                      'OVF_FEATURE63_WRAPPER_ASSIGNMENT_SHA256': assignment_d['sha256'],
                      'runtimeExecuted': False}, indent=2))


if __name__ == '__main__':
    main()
