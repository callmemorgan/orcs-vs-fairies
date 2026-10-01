#!/usr/bin/env python3
"""File-only audit for original requirement 53 evidence."""

import hashlib
import json
import math
import os
import pathlib
import re
import subprocess
import sys
from collections import Counter

SOURCE = pathlib.Path('/tmp/orcs-id53-executable-453c221-hvEbs6')
BUILD = pathlib.Path('/tmp/orcs-id53-build-453c221-hvEbs6')
RUN = pathlib.Path('/tmp/orcs-id53-run-453c221-hvEbs6')
REPO = pathlib.Path('/home/morgana/Projects/orcs-vs-Fairies')
PIN = '453c2218af9973b9eca8fb78392435bd9d46a740'
REQUESTED_ROOT = '202b739fb398d1f94fd2c53f659e10860eba3fc6'
ROOT = '37bf0e794e7f62cf33347d2e92c739d593bf1cc4'
REQ = 'opponents use recognizable builds with exploitable weaknesses.'
EXPECTED_FINAL_SHA = 'b2e110667230bfb6c37806581f3259dedd15e3bdb1e30c2c704eb01e19afe547'
ARMS = ('infantry-control', 'depot-first-pressure')

checks = []

def add(name, ok, **details):
    checks.append({'name': name, 'passed': bool(ok), 'details': details})

def load(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def rows(path):
    with open(path, 'r', encoding='utf-8') as f:
        return [json.loads(line) for line in f]

def digest_bytes(data):
    return hashlib.sha256(data).hexdigest()

def stat_hash(path):
    path = pathlib.Path(path)
    data = path.read_bytes()
    return {'bytes': len(data), 'sha256': digest_bytes(data)}

def same_number(a, b, tol=1e-8):
    return isinstance(a, (int, float)) and isinstance(b, (int, float)) and math.isclose(a, b, rel_tol=tol, abs_tol=tol)

def cost_sub(before, after):
    return {k: before[k] - after[k] for k in ('wood', 'ore', 'crystal')}

def cost_equal(a, b):
    return all(same_number(a.get(k), b.get(k)) for k in ('wood', 'ore', 'crystal'))

def git(*args, binary=False):
    out = subprocess.check_output(['git', '-C', str(REPO), *args])
    return out if binary else out.decode().strip()

def git_bytes(ref, path):
    return git('show', f'{ref}:{path}', binary=True)

def walk_files(root, exclude=()):
    excluded = set(exclude)
    result = []
    for p in sorted(root.rglob('*')):
        if p.is_symlink():
            raise AssertionError(f'symlink in evidence: {p}')
        if p.is_file() and p.relative_to(root).as_posix() not in excluded:
            result.append(p)
    return result

def verify_entries(name, base, entries, expected_relative=None):
    failures = []
    seen = []
    for entry in entries:
        rel = entry.get('path')
        p = pathlib.Path(rel) if os.path.isabs(str(rel)) else base / rel
        seen.append(p.relative_to(base).as_posix() if p.is_relative_to(base) else str(p))
        if not p.is_file() or p.is_symlink():
            failures.append({'path': str(p), 'reason': 'missing-or-not-regular'})
            continue
        actual = stat_hash(p)
        if actual['bytes'] != entry.get('bytes') or actual['sha256'] != entry.get('sha256'):
            failures.append({'path': str(p), 'reason': 'size-or-hash', 'expected': {'bytes': entry.get('bytes'), 'sha256': entry.get('sha256')}, 'actual': actual})
    set_ok = True
    set_details = {}
    if expected_relative is not None:
        expected = set(expected_relative)
        actual = set(seen)
        set_ok = actual == expected and len(seen) == len(actual)
        set_details = {'missing': sorted(expected - actual), 'extra': sorted(actual - expected), 'duplicateCount': len(seen) - len(actual)}
    add(name, not failures and set_ok, entries=len(entries), failures=failures, **set_details)
    return not failures and set_ok

def deep_differences(a, b, path='$'):
    if type(a) is not type(b):
        return [{'path': path, 'left': a, 'right': b}]
    if isinstance(a, dict):
        result = []
        for key in sorted(set(a) | set(b)):
            if key not in a or key not in b:
                result.append({'path': f'{path}.{key}', 'left': a.get(key), 'right': b.get(key)})
            else:
                result.extend(deep_differences(a[key], b[key], f'{path}.{key}'))
        return result
    if isinstance(a, list):
        if len(a) != len(b):
            return [{'path': path + '.length', 'left': len(a), 'right': len(b)}]
        result = []
        for i, (left, right) in enumerate(zip(a, b)):
            result.extend(deep_differences(left, right, f'{path}[{i}]'))
        return result
    return [] if a == b else [{'path': path, 'left': a, 'right': b}]

# Immutable identities and requirement state.
head = git('rev-parse', 'HEAD')
add('current root identity', head == ROOT, expected=ROOT, actual=head)
requirements = {}
for ref in (PIN, REQUESTED_ROOT, ROOT):
    document = json.loads(git_bytes(ref, 'docs/features/requirements.json'))
    matches = [item for item in document['features'] if item.get('id') == 53]
    requirements[ref] = matches[0] if len(matches) == 1 else None
add('requirement 53 unchanged and still open',
    requirements[PIN] == requirements[REQUESTED_ROOT] == requirements[ROOT] and requirements[ROOT] == {
        'id': 53, 'title': 'AI opening strategies', 'requirement': REQ,
        'status': 'in-progress', 'evidence': []},
    productPin=requirements[PIN], requestedRoot=requirements[REQUESTED_ROOT], currentRoot=requirements[ROOT])

# Master inventory: hash all entries and prove there are no omitted or extra files.
artifact_inventory = load(SOURCE / 'artifact-inventory.json')
source_actual = walk_files(SOURCE, ('artifact-inventory.json',))
build_actual = walk_files(BUILD)
run_actual = walk_files(RUN)
expected_absolute = {str(p) for p in source_actual + build_actual + run_actual}
inventory_absolute = {entry['path'] for entry in artifact_inventory['files']}
inventory_failures = []
for entry in artifact_inventory['files']:
    p = pathlib.Path(entry['path'])
    if not p.is_file() or p.is_symlink():
        inventory_failures.append({'path': str(p), 'reason': 'missing-or-not-regular'})
        continue
    actual = stat_hash(p)
    if actual != {'bytes': entry['bytes'], 'sha256': entry['sha256']}:
        inventory_failures.append({'path': str(p), 'expected': {'bytes': entry['bytes'], 'sha256': entry['sha256']}, 'actual': actual})
actual_total = sum(p.stat().st_size for p in source_actual + build_actual + run_actual)
group_counts = Counter(entry['group'] for entry in artifact_inventory['files'])
add('master artifact inventory hashes and coverage',
    not inventory_failures and expected_absolute == inventory_absolute
    and artifact_inventory['fileCount'] == len(artifact_inventory['files']) == 44
    and artifact_inventory['bytes'] == actual_total
    and artifact_inventory['inventoryExcludes'] == [str(SOURCE / 'artifact-inventory.json')],
    fileCount=len(inventory_absolute), bytes=actual_total, groupCounts=dict(group_counts), failures=inventory_failures,
    missing=sorted(expected_absolute - inventory_absolute), extra=sorted(inventory_absolute - expected_absolute))
add('supplied final receipt digest', stat_hash(RUN / 'final-receipt.json')['sha256'] == EXPECTED_FINAL_SHA,
    expected=EXPECTED_FINAL_SHA, actual=stat_hash(RUN / 'final-receipt.json')['sha256'])

# Nested inventories and receipt references.
final_receipt = load(RUN / 'final-receipt.json')
driver_receipt = load(RUN / 'driver-receipt.json')
final_expected = [p.relative_to(RUN).as_posix() for p in walk_files(RUN, ('final-receipt.json',))]
verify_entries('final receipt 20-file inventory', RUN, final_receipt['files'], final_expected)
driver_excluded = ('driver-receipt.json', 'final-receipt.json', 'supervisor-receipt.json',
                   'infantry-control/endpoint-verification.json', 'depot-first-pressure/endpoint-verification.json')
driver_expected = [p.relative_to(RUN).as_posix() for p in walk_files(RUN, driver_excluded)]
verify_entries('driver receipt 16-file inventory', RUN, driver_receipt['files'], driver_expected)

arm_receipts = {}
verifications = {}
for arm in ARMS:
    arm_root = RUN / arm
    receipt = load(arm_root / 'run-receipt.json')
    verification = load(arm_root / 'endpoint-verification.json')
    arm_receipts[arm] = receipt
    verifications[arm] = verification
    arm_expected = [p.relative_to(arm_root).as_posix() for p in walk_files(arm_root, ('run-receipt.json', 'endpoint-verification.json'))]
    verify_entries(f'{arm} six-file run inventory', arm_root, receipt['files'], arm_expected)
    ref_failures = []
    for entry in verification['verified']:
        p = pathlib.Path(entry['path'])
        actual = stat_hash(p) if p.is_file() else None
        if actual != {'bytes': entry['bytes'], 'sha256': entry['sha256']}:
            ref_failures.append({'path': str(p), 'reason': 'hash'})
            continue
        session = load(p)
        if session.get('format') != 'orcs-vs-fairies/session' or session.get('game', {}).get('state', {}).get('tick') != entry['tick'] or session.get('replay', {}).get('finalTick') != entry['tick']:
            ref_failures.append({'path': str(p), 'reason': 'session-tick-or-format'})
        flags = ('completeDecoderSessionEqual', 'completeResaveEnvelopeEqual', 'completeReplayEnvelopeEqual', 'analysisEqual', 'technologyTimingsEqual')
        if not all(entry.get(flag) is True for flag in flags) or entry.get('replayedTicks') != entry.get('tick'):
            ref_failures.append({'path': str(p), 'reason': 'native-verification-flags'})
    add(f'{arm} native endpoint references', verification['status'] == 'passed' and len(verification['verified']) == 2 and not ref_failures and verification['continuation'] == 'not-run; no survival gate',
        verifiedSessions=len(verification['verified']), continuation=verification['continuation'], failures=ref_failures)

# Build manifest, metafiles, bundle inputs, and Git object identity at both refs.
manifest_path = BUILD / 'build-manifest.json'
manifest = load(manifest_path)
product_failures = []
for entry in manifest['product']['files']:
    for ref in (PIN, REQUESTED_ROOT, ROOT):
        try:
            data = git_bytes(ref, entry['path'])
            blob = git('rev-parse', f"{ref}:{entry['path']}")
        except subprocess.CalledProcessError:
            product_failures.append({'path': entry['path'], 'ref': ref, 'reason': 'missing'})
            continue
        actual = {'bytes': len(data), 'sha256': digest_bytes(data), 'gitBlob': blob}
        expected = {'bytes': entry['bytes'], 'sha256': entry['sha256'], 'gitBlob': entry['gitBlob']}
        if actual != expected or entry.get('bytesMatchGit') is not True:
            product_failures.append({'path': entry['path'], 'ref': ref, 'expected': expected, 'actual': actual})
product_digest = digest_bytes(''.join(f"{e['path']}\0{e['sha256']}\n" for e in manifest['product']['files']).encode())
config_paths = {'package.json','package-lock.json','vite.config.ts','tsconfig.json','vitest.config.ts','index.html','editor.html'}
def product_paths(ref):
    out = git('ls-tree', '-r', '--name-only', ref).splitlines()
    return {p for p in out if p.startswith('src/') or p in config_paths}
manifest_product_paths = {e['path'] for e in manifest['product']['files']}
add('build manifest product identity and current-root applicability',
    manifest['status'] == 'built-not-executed' and manifest['product']['sourcePin'] == PIN
    and product_digest == manifest['product']['digest'] and not product_failures
    and manifest_product_paths == product_paths(PIN) == product_paths(REQUESTED_ROOT) == product_paths(ROOT),
    productFiles=len(manifest_product_paths), digest=product_digest, failures=product_failures,
    pinSetDifference=sorted(manifest_product_paths ^ product_paths(PIN)),
    requestedRootSetDifference=sorted(manifest_product_paths ^ product_paths(REQUESTED_ROOT)),
    rootSetDifference=sorted(manifest_product_paths ^ product_paths(ROOT)))

verify_entries('build helper files', pathlib.Path(manifest['helper']['directory']), manifest['helper']['files'])
helper_digest = digest_bytes(''.join(f"{e['path']}\0{e['sha256']}\n" for e in manifest['helper']['files']).encode())
add('build helper digest', helper_digest == manifest['helper']['digest'], expected=manifest['helper']['digest'], actual=helper_digest)
for kind in ('driver', 'validator'):
    bundle = manifest['bundles'][kind]
    bundle_ok = stat_hash(bundle['path']) == {'bytes': bundle['bytes'], 'sha256': bundle['sha256']}
    meta_ok = stat_hash(bundle['metafile']['path']) == {'bytes': bundle['metafile']['bytes'], 'sha256': bundle['metafile']['sha256']}
    input_ok = verify_entries(f'{kind} bundle input hashes', pathlib.Path('/'), bundle['inputs'])
    metafile = load(bundle['metafile']['path'])
    meta_inputs = {os.path.realpath(REPO / p) for p in metafile.get('inputs', {})}
    manifest_inputs = {os.path.realpath(e['path']) for e in bundle['inputs']}
    output_records = list(metafile.get('outputs', {}).values())
    output_bytes = sum(int(o.get('bytes', 0)) for o in output_records)
    add(f'{kind} bundle and metafile linkage', bundle_ok and meta_ok and input_ok and meta_inputs == manifest_inputs and len(output_records) == 1 and output_bytes == bundle['bytes'],
        metafileInputs=len(meta_inputs), manifestInputs=len(manifest_inputs), inputDifference=sorted(meta_inputs ^ manifest_inputs), outputBytes=output_bytes)

# Provenance copied into runtime receipts must match the retained build manifest.
provenance_failures = []
for label, provenance in [('driver', driver_receipt['provenance'])] + [(arm, verifications[arm]['provenance']) for arm in ARMS]:
    product = dict(provenance['product']); product.pop('repository', None)
    kind = provenance['kind']; bundle = manifest['bundles'][kind]
    expected_manifest = stat_hash(manifest_path)
    if product != manifest['product'] or provenance['helper'] != manifest['helper']:
        provenance_failures.append({'receipt': label, 'reason': 'product-or-helper'})
    if provenance['manifest'] != {'path': str(manifest_path), **expected_manifest}:
        provenance_failures.append({'receipt': label, 'reason': 'manifest-reference'})
    if provenance['executable'] != {k: bundle[k] for k in ('path','bytes','sha256')} or provenance['metafile'] != bundle['metafile'] or provenance['inputs'] != bundle['inputs']:
        provenance_failures.append({'receipt': label, 'reason': 'bundle-provenance'})
add('runtime provenance matches retained build', not provenance_failures, failures=provenance_failures)

# Deep comparison of the two complete initial SAVE4 envelopes.
initials = {arm: load(RUN / arm / 'initial-save4.json') for arm in ARMS}
initial_diffs = deep_differences(initials['infantry-control'], initials['depot-first-pressure'])
expected_diff = [{'path': '$.state.aiConfigs[1].opening', 'left': 'infantry-rush', 'right': 'fast-expansion'}]
add('initial SAVE4 envelopes differ only by opening', initial_diffs == expected_diff, differences=initial_diffs)

# Every policy command must be justified by the observation saved before issueCommand.
command_summaries = {}
command_rows_by_arm = {}
for arm in ARMS:
    data = rows(RUN / arm / 'command-observations.jsonl')
    command_rows_by_arm[arm] = data
    failures = []
    accepted_types = Counter()
    for index, record in enumerate(data, 1):
        cmd = record['command']; obs = record['observation']; ctype = cmd['type']
        if record['commandOrdinal'] != index or record['side'] != 0 or obs.get('side') != 0 or record['tick'] != obs.get('tick') or not same_number(record['time'], obs.get('time')):
            failures.append({'ordinal': index, 'reason': 'record-observation-header'})
        entities = {e['id']: e for e in obs.get('entities', [])}
        resources = {r['id']: r for r in obs.get('resources', [])}
        actor_ids = cmd.get('ids', [cmd['id']] if 'id' in cmd else [])
        for actor_id in actor_ids:
            actor = entities.get(actor_id)
            if not actor or actor.get('side') != 0 or actor.get('owner', 0) != 0:
                failures.append({'ordinal': index, 'reason': 'actor-not-observed-owned', 'id': actor_id})
            if ctype in ('build', 'gather') and actor and not (actor.get('kind') == 'unit' and actor.get('role') == 'worker'):
                failures.append({'ordinal': index, 'reason': 'worker-command-nonworker', 'id': actor_id})
        if ctype == 'gather':
            target = resources.get(cmd['target'])
            if not target or target.get('visible') is not True or target.get('amount', 0) <= 0:
                failures.append({'ordinal': index, 'reason': 'resource-not-observed-visible'})
        if ctype == 'attack':
            target = entities.get(cmd['target'])
            if not target or not (target.get('side') == 1 and target.get('kind') == 'unit' and target.get('role') == 'worker'):
                failures.append({'ordinal': index, 'reason': 'target-not-observed-enemy-worker'})
        if ctype == 'attackMove' and cmd.get('x') != obs['map']['starts'][1]['x'] or ctype == 'attackMove' and cmd.get('y') != obs['map']['starts'][1]['y']:
            failures.append({'ordinal': index, 'reason': 'attack-move-not-public-map-start'})
        if ctype == 'train' and record['accepted']:
            actor = entities.get(cmd['id'])
            before_q = next((q['queue'] for q in record['beforeQueues'] if q['id'] == cmd['id']), None)
            after_q = next((q['queue'] for q in record['afterQueues'] if q['id'] == cmd['id']), None)
            cost = obs['content']['faction']['units'][cmd['role']]['cost']
            if not actor or actor.get('kind') != 'building' or cmd['role'] != 'melee' or not cost_equal(cost_sub(record['beforeBank'], record['afterBank']), cost) or before_q is None or after_q != before_q + ['melee']:
                failures.append({'ordinal': index, 'reason': 'train-payment-or-queue'})
        if ctype == 'build' and record['accepted']:
            cost = obs['content']['faction']['buildings'][cmd['role']]['cost']
            if cmd['role'] != 'barracks' or not cost_equal(cost_sub(record['beforeBank'], record['afterBank']), cost):
                failures.append({'ordinal': index, 'reason': 'build-payment'})
        if not record['accepted'] and not cost_equal(record['beforeBank'], record['afterBank']):
            failures.append({'ordinal': index, 'reason': 'rejected-command-bank-change'})
        if record['accepted']:
            accepted_types[ctype] += 1
    train_rows = [r for r in data if r['command']['type'] == 'train' and r['accepted']]
    policy_signature = [(r['tick'], r['command']['role'], cost_sub(r['beforeBank'], r['afterBank'])) for r in train_rows]
    command_summaries[arm] = {'rows': len(data), 'acceptedTypes': dict(accepted_types), 'paidTrainSignature': policy_signature}
    add(f'{arm} public-observation command audit', not failures and len(train_rows) == 3,
        rows=len(data), acceptedTypes=dict(accepted_types), failures=failures, paidTrainSignature=policy_signature)
add('matched ordinary paid attacker policy',
    command_summaries['infantry-control']['paidTrainSignature'] == command_summaries['depot-first-pressure']['paidTrainSignature']
    == [(180, 'melee', {'wood': 70, 'ore': 25, 'crystal': 0})] * 3,
    infantry=command_summaries['infantry-control']['paidTrainSignature'], expansion=command_summaries['depot-first-pressure']['paidTrainSignature'])

# Source inspection backs the recorded observation policy and rules out alternate command paths.
driver_text = (SOURCE / 'driver.ts').read_text(encoding='utf-8')
source_facts = {
    'playerViewConstructors': len(re.findall(r'new PlayerView\(0\)', driver_text)),
    'issueCommandCalls': len(re.findall(r'\bissueCommand\s*\(', driver_text)),
    'stepGameCalls': len(re.findall(r'\bstepGame\s*\(', driver_text)),
    'directStateAssignments': len(re.findall(r'\bstate(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\])\s*=(?!=)', driver_text)),
    'observesImmediatelyBeforeCommand': 'const own=view.observe(state),beforeBank=' in driver_text and 'const accepted=issueCommand(state,0,value),after=view.observe(state);' in driver_text,
    'publicStartGuidance': "...own.map.starts[1]" in driver_text,
    'readOnlyAuditBoundary': ('This auditor receives full state only after policy decisions.' in driver_text
                              and 'Its results never' in driver_text
                              and 'choose a gameplay actor, target, economy command or pressure release time.' in driver_text),
}
add('driver public-observation policy source inspection',
    source_facts == {'playerViewConstructors': 1, 'issueCommandCalls': 1, 'stepGameCalls': 1, 'directStateAssignments': 0,
                     'observesImmediatelyBeforeCommand': True, 'publicStartGuidance': True, 'readOnlyAuditBoundary': True},
    **source_facts)

# Derive spend, production, opening milestones, and hit linkage from JSONL records.
derived = {}
for arm in ARMS:
    receipt = arm_receipts[arm]
    audits = rows(RUN / arm / 'paid-spend-and-production.jsonl')
    hits = rows(RUN / arm / 'ordinary-hit-events.jsonl')
    step_audits = [r for r in audits if r.get('type') == 'read-only-step-audit']
    external_foundations = [r for r in audits if r.get('type') == 'external-paid-foundation']
    failures = []
    if len(external_foundations) != 1 or external_foundations[0]['tick'] != 20 or not cost_equal(external_foundations[0]['paidCost'], {'wood':160,'ore':50,'crystal':0}) or not cost_equal(cost_sub(external_foundations[0]['beforeBank'], external_foundations[0]['afterBank']), {'wood':160,'ore':50,'crystal':0}):
        failures.append({'reason': 'external-barracks-payment'})
    first_paid_building = None
    first_barracks_foundation = None
    first_barracks_complete = None
    first_combat_queue = None
    first_defender_fighter = None
    first_attacker_completion = None
    seen_paid = set()
    for row in step_audits:
        before, after, events = row['before'], row['after'], row['events']
        before_entities = {e['id']: e for e in before['entities']}
        after_entities = {e['id']: e for e in after['entities']}
        before_paid = {p['entityId'] for p in before.get('paidCosts', [])}
        for paid in after.get('paidCosts', []):
            entity = after_entities.get(paid['entityId'])
            if paid['entityId'] not in before_paid and entity and entity.get('side') == 1 and entity.get('kind') == 'building' and entity.get('role') != 'hq':
                candidate = (row['tick'], entity['id'], entity['role'], paid['stock'])
                if first_paid_building is None: first_paid_building = candidate
                if entity['role'] == 'barracks' and first_barracks_foundation is None: first_barracks_foundation = candidate
        for entity in after['entities']:
            old = before_entities.get(entity['id'])
            if entity.get('side') == 1 and entity.get('kind') == 'building' and entity.get('role') == 'barracks' and entity.get('progress') == 1 and old and old.get('progress', 0) < 1 and first_barracks_complete is None:
                first_barracks_complete = (row['tick'], entity['id'])
        account = row.get('accounts', [None, None])[1]
        if account and first_combat_queue is None:
            added = [q for q in account.get('queueChanges', []) if q.get('role') != 'worker' and q.get('added', 0) > 0]
            if added: first_combat_queue = (row['tick'], added)
        for event in events:
            if event.get('type') != 'train': continue
            actor = after_entities.get(event.get('source'))
            if not actor or actor.get('kind') != 'unit' or actor.get('role') == 'worker': continue
            if event.get('side') == 0 and first_attacker_completion is None:
                paid = next((p for p in after.get('paidCosts', []) if p['entityId'] == actor['id']), None)
                first_attacker_completion = (row['tick'], actor['id'], actor['role'], paid['stock'] if paid else None)
            if event.get('side') == 1 and first_defender_fighter is None:
                paid = next((p for p in after.get('paidCosts', []) if p['entityId'] == actor['id']), None)
                first_defender_fighter = (row['tick'], actor['id'], actor['role'], paid['stock'] if paid else None)
    expected_milestones = {
        'firstPaidBuilding': (receipt['firstPaidBuilding']['tick'], receipt['firstPaidBuilding']['id'], receipt['firstPaidBuilding']['role'], receipt['firstPaidBuilding']['paidCost']),
        'firstBarracksFoundation': (receipt['firstBarracksFoundation']['tick'], receipt['firstBarracksFoundation']['id'], receipt['firstBarracksFoundation']['role'], receipt['firstBarracksFoundation']['paidCost']),
        'firstBarracksComplete': (receipt['firstBarracksComplete']['tick'], receipt['firstBarracksComplete']['id']),
        'firstCombatQueueTick': receipt['firstCombatQueue']['tick'],
        'firstPaidFighter': (receipt['firstPaidFighter']['tick'], receipt['firstPaidFighter']['id'], receipt['firstPaidFighter']['role'], receipt['firstPaidFighter']['paidCost']),
        'firstAttackerCompletion': (receipt['ownPaidCompletions'][0]['completionTick'], receipt['ownPaidCompletions'][0]['unitId'], receipt['ownPaidCompletions'][0]['nativeActor']['role'], receipt['ownPaidCompletions'][0]['paidCost']),
    }
    actual_milestones = {'firstPaidBuilding': first_paid_building, 'firstBarracksFoundation': first_barracks_foundation,
                         'firstBarracksComplete': first_barracks_complete,
                         'firstCombatQueueTick': first_combat_queue[0] if first_combat_queue else None,
                         'firstPaidFighter': first_defender_fighter, 'firstAttackerCompletion': first_attacker_completion}
    if actual_milestones != expected_milestones:
        failures.append({'reason': 'raw-milestone-mismatch', 'expected': expected_milestones, 'actual': actual_milestones})
    command_by_ordinal = {r['commandOrdinal']: r for r in command_rows_by_arm[arm]}
    qualifying = []
    worker_projections = []
    for hit in hits:
        event = hit['event']; victim = hit.get('victimBefore') or hit.get('victimAfter')
        worker = event.get('side') == 0 and victim and victim.get('side') == 1 and victim.get('kind') == 'unit' and victim.get('role') == 'worker' and event.get('amount', 0) > 0
        paid_completion = hit.get('paidCompletion')
        paid_record = hit.get('nativePaidRecord')
        paid = bool(paid_completion and paid_record and paid_completion.get('unitId') == event.get('source') and paid_record.get('entityId') == event.get('source') and cost_equal(paid_record.get('stock', {}), {'wood':70,'ore':25,'crystal':0}))
        accepted = hit.get('acceptedAttack')
        observed_entity = None
        if accepted:
            observed_entity = next((e for e in accepted['observation']['entities'] if e['id'] == event.get('target')), None)
        observed = bool(accepted and accepted.get('target') == event.get('target') and observed_entity and observed_entity.get('side') == 1 and observed_entity.get('kind') == 'unit' and observed_entity.get('role') == 'worker')
        resolved = hit.get('hpBefore') is not None and ((hit.get('hpAfter') is not None and hit['hpAfter'] < hit['hpBefore']) or bool(hit.get('death')))
        q = bool(worker and paid and observed and resolved)
        if (hit.get('workerHit'), hit.get('paidSource'), hit.get('observedTarget'), hit.get('resolvedLoss'), hit.get('qualifying')) != (bool(worker), paid, observed, resolved, q):
            failures.append({'reason': 'hit-flag-mismatch', 'tick': hit['tick']})
        if q:
            qualifying.append(hit)
            cmd = command_by_ordinal.get(accepted['commandOrdinal'])
            if not cmd or not cmd['accepted'] or cmd['tick'] != accepted['tick'] or cmd['command'] != {'type':'attack','ids':[event['source']],'target':event['target']}:
                failures.append({'reason': 'accepted-attack-link', 'tick': hit['tick']})
        if worker:
            worker_projections.append({'tick':hit['tick'],'time':hit['time'],'source':event.get('source'),'target':event.get('target'),'amount':event.get('amount'),'qualifying':q,'paidSource':paid,'observedTarget':observed,'resolvedLoss':resolved,'commandOrdinal':accepted.get('commandOrdinal') if accepted else None})
    first_hit_tick = min((h['tick'] for h in qualifying), default=None)
    if worker_projections != receipt['allWorkerHits'] or first_hit_tick != receipt['firstPaidWorkerHitTick']:
        failures.append({'reason': 'hit-receipt-projection', 'derivedFirst': first_hit_tick, 'receiptFirst': receipt['firstPaidWorkerHitTick']})
    pre_hit = [first_barracks_foundation[0], first_barracks_complete[0], first_combat_queue[0]] if first_barracks_foundation and first_barracks_complete and first_combat_queue else []
    if len(pre_hit) != 3 or not all(t < first_hit_tick for t in pre_hit):
        failures.append({'reason': 'pre-hit-milestones', 'ticks': pre_hit, 'hit': first_hit_tick})
    derived[arm] = {'milestones': actual_milestones, 'firstQualifyingWorkerHitTick': first_hit_tick, 'qualifyingWorkerHits': len(qualifying), 'preHitMilestoneTicks': pre_hit}
    add(f'{arm} raw spend, production, and hit audit', not failures, stepAuditRows=len(step_audits), hitRows=len(hits), qualifyingWorkerHits=len(qualifying), derived=derived[arm], failures=failures)

# The measured weakness is the difference in a common milestone under matched setup/policy.
control_fighter = derived['infantry-control']['milestones']['firstPaidFighter'][0]
expansion_fighter = derived['depot-first-pressure']['milestones']['firstPaidFighter'][0]
delay = expansion_fighter - control_fighter
foundation_delay = (derived['depot-first-pressure']['milestones']['firstBarracksFoundation'][0]
                    - derived['infantry-control']['milestones']['firstBarracksFoundation'][0])
completion_delay = (derived['depot-first-pressure']['milestones']['firstBarracksComplete'][0]
                    - derived['infantry-control']['milestones']['firstBarracksComplete'][0])
queue_delay = (derived['depot-first-pressure']['milestones']['firstCombatQueueTick']
               - derived['infantry-control']['milestones']['firstCombatQueueTick'])
control_queue_to_fighter = control_fighter - derived['infantry-control']['milestones']['firstCombatQueueTick']
expansion_queue_to_fighter = expansion_fighter - derived['depot-first-pressure']['milestones']['firstCombatQueueTick']
control_exposure = control_fighter - derived['infantry-control']['firstQualifyingWorkerHitTick']
expansion_exposure = expansion_fighter - derived['depot-first-pressure']['firstQualifyingWorkerHitTick']
opening_shapes = {
    arm: {'opening': arm_receipts[arm]['opening'], 'advertisedOpening': arm_receipts[arm]['advertisedOpening'],
          'firstPaidBuildingRole': derived[arm]['milestones']['firstPaidBuilding'][2]}
    for arm in ARMS
}
add('recognizable runtime opening shapes',
    opening_shapes['infantry-control']['opening'] == 'infantry-rush'
    and opening_shapes['infantry-control']['firstPaidBuildingRole'] == 'barracks'
    and opening_shapes['depot-first-pressure']['opening'] == 'fast-expansion'
    and opening_shapes['depot-first-pressure']['firstPaidBuildingRole'] == 'depot'
    and all(v['advertisedOpening'].get('plan') and v['advertisedOpening'].get('weakness') for v in opening_shapes.values()),
    openings=opening_shapes)
add('measured exploitable early military delay',
    delay == 500 and delay * 50 == 25000 and foundation_delay == 500 and completion_delay == 485
    and queue_delay == 500 and control_queue_to_fighter == expansion_queue_to_fighter == 800
    and control_exposure == 100 and expansion_exposure == 631,
    controlFirstPaidFighterTick=control_fighter, expansionFirstPaidFighterTick=expansion_fighter,
    barracksFoundationDelayTicks=foundation_delay, barracksCompletionDelayTicks=completion_delay,
    combatQueueDelayTicks=queue_delay, queueToFighterTicks={'control':control_queue_to_fighter,'expansion':expansion_queue_to_fighter},
    openingDelayTicks=delay, openingDelayMilliseconds=delay * 50,
    hitBeforeFirstPaidFighterTicks={'control':control_exposure,'expansion':expansion_exposure},
    scope='Fixed ordinary paid infantry pressure; later harassment may compound the delay.')

# Top-level execution, bounded stop, and no-victory/no-continuation scope.
supervisor = load(RUN / 'supervisor-receipt.json')
process_failures = [p for p in supervisor['processes'] if p.get('exit', {}).get('code') != 0]
stop_summary = {arm: arm_receipts[arm]['stop'] for arm in ARMS}
add('bounded native execution completed cleanly',
    final_receipt['status'] == 'passed' and final_receipt['runtimeExit'] == 0 and final_receipt['errors'] == []
    and supervisor['status'] == 'guarded-native-processes-complete' and supervisor['runtimeExit'] == 0
    and supervisor['deadlineReached'] is False and supervisor['remainingOwnedRunnableGroups'] == 0 and not process_failures,
    observedWallSeconds=final_receipt['observedWallSeconds'], nativeWallSeconds=supervisor['nativeWallSeconds'], processFailures=process_failures)
add('nonterminal endpoints and explicit continuation scope',
    all(stop['reason'] == 'completed-12-second-response-window' and stop['terminal'] is False for stop in stop_summary.values())
    and all(verifications[arm]['continuation'] == 'not-run; no survival gate' for arm in ARMS),
    stops=stop_summary, continuation={arm: verifications[arm]['continuation'] for arm in ARMS})

failed = [check for check in checks if not check['passed']]
output = {
    'schemaVersion': 1,
    'review': 'original-requirement-53-file-only-runtime-evidence',
    'verdict': 'pass' if not failed else 'fail',
    'requirement': {'id': 53, 'text': REQ},
    'currentRoot': ROOT,
    'requestedRoot': REQUESTED_ROOT,
    'productPin': PIN,
    'constraints': {'repositoryMutated': False, 'runtimeExecutedByReviewer': False, 'method': 'static Git/file/JSON/JSONL inspection'},
    'scope': {'proved': 'Two recognized AI openings and a 500-tick (25-second) first-paid-fighter delay for the fast-expansion arm under the same ordinary paid infantry pressure.',
              'notClaimed': ['full-match victory', 'post-endpoint continuation or survival', 'an unpressured causal baseline']},
    'summary': {'checks': len(checks), 'passed': len(checks) - len(failed), 'failed': len(failed)},
    'checks': checks,
}
json.dump(output, sys.stdout, indent=2)
sys.stdout.write('\n')
sys.exit(0 if not failed else 1)
