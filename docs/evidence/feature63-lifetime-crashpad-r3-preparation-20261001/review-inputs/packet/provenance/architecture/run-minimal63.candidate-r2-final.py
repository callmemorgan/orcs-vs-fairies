#!/usr/bin/env python3
"""Held dedicated feature 63 driver. Root admits capture and one-shot audit separately."""
import datetime
import hashlib
import json
import os
import re
import select
import signal
import stat
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

CHECKOUT = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
PREFIX_NAME = 'work/feature63-human-wave-composition-r2'
PREFIX = CHECKOUT / PREFIX_NAME
PROTECTED_ROOT = Path('/home/morgana/Projects/orcs-vs-Fairies')
PORTS = {'server': 5373, 'browser': 5374, 'protected': 4173}
REQUIRED_SOURCE = (
    'src/core/team-ai.ts', 'src/core/simulation.ts', 'src/core/saves.ts',
    'src/core/observation.ts', 'src/core/commands.ts', 'src/core/ally-directives.ts',
    'src/server/server.ts', 'src/server/store.ts', 'src/server/views.ts',
    'src/online/protocol.ts', 'src/online/render-state.ts', 'src/core/economy.ts',
    'src/core/economy-types.ts', 'src/core/tactics.ts', 'src/game/GameScene.ts',
    'src/game/Controls.ts', 'src/main.ts', 'src/ui/Hud.ts', 'src/ui/OnlineLobby.ts',
    'src/core/types.ts', 'src/core/navigation.ts', 'src/ui/SessionTools.ts',
)
MAX_ATTEMPT = 300
MAX_CLEANUP = 120
MAX_RAW_BYTES = 1024 * 1024 * 1024
MAX_PUBLIC_BYTES = 64 * 1024 * 1024
MAX_COLLECTOR_BYTES = 8 * 1024 * 1024
AUDIT_INPUTS = (
    'public-results.json', 'public-identities.json', 'public-windows.json',
    'public-cleanup.json', 'public-match-identity.json', 'human-one-wire.ndjson',
    'human-two-wire.ndjson', 'human-one-ui-actions.ndjson', 'human-two-ui-actions.ndjson',
)


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def raw_file(path, maximum):
    path = Path(path)
    require(path.is_absolute() and path.resolve() == path and not path.is_symlink(), 'Noncanonical file path')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_size <= maximum, 'Nonregular or oversized bound file')
        chunks = []
        remaining = before.st_size
        while remaining:
            chunk = os.read(fd, min(remaining, 1024 * 1024))
            require(bool(chunk), 'Short read of bound file')
            chunks.append(chunk)
            remaining -= len(chunk)
        require(not os.read(fd, 1), 'Bound file grew during read')
        after = os.fstat(fd)
        require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) ==
                (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns), 'Bound file changed during read')
        return b''.join(chunks)
    finally:
        os.close(fd)


def bound(descriptor, maximum=2 * 1024 * 1024):
    raw = raw_file(descriptor['path'], maximum)
    require(re.fullmatch('[0-9a-f]{64}', descriptor['sha256'] or '') and sha(raw) == descriptor['sha256'], 'Bound bytes differ')
    require(descriptor.get('bytes', len(raw)) == len(raw), 'Bound byte count differs')
    return raw


def receipt(descriptor, schema, pin):
    value = json.loads(bound(descriptor))
    require(value['schema'] == schema and value['sourcePin'] == pin and value['approved'] is True, 'Unapproved or mismatched receipt')
    return value


def write_new(path, value):
    raw = (json.dumps(value, indent=2, sort_keys=True) + '\n').encode()
    with path.open('xb') as handle:
        handle.write(raw)
        handle.flush()
        os.fsync(handle.fileno())
    return {'path': str(path), 'bytes': len(raw), 'sha256': sha(raw)}


def process_observation(pid):
    p = Path('/proc') / str(pid)
    try:
        text = (p / 'stat').read_text()
        fields = text[text.rfind(')') + 2:].split()
        if fields[0] in ('Z', 'X'):
            return None
        executable = os.readlink(p / 'exe')
        cwd = os.readlink(p / 'cwd')
        raw = (p / 'cmdline').read_bytes()
        after_text = (p / 'stat').read_text()
        after = after_text[after_text.rfind(')') + 2:].split()
        if after[0] in ('Z', 'X'):
            return None
        require((fields[19], fields[3]) == (after[19], after[3])
                and executable == os.readlink(p / 'exe') and cwd == os.readlink(p / 'cwd'),
                'Immutable process identity changed during observation')
        # /proc cmdline is NUL-delimited bytes. A joined Chrome process title stays one item.
        argv = [item.decode() for item in raw.split(b'\0') if item]
        ident = {'pid': pid, 'startTicks': int(fields[19]), 'executable': executable,
                 'cwd': cwd, 'argv': argv}
        immutable = {key: ident[key] for key in ('pid', 'startTicks', 'executable', 'cwd')}
        immutable['session'] = int(fields[3])
        return {'identity': ident, 'immutableIdentity': immutable,
                'cmdline': {'nulBytesHex': raw.hex(), 'nulSeparatedArgv': argv}}
    except (FileNotFoundError, ProcessLookupError):
        return None


def identity(pid):
    value = process_observation(pid)
    return None if value is None else value['identity']


def pidfd_live(fd):
    poller = select.poll()
    poller.register(fd, select.POLLIN | select.POLLHUP | select.POLLERR | select.POLLNVAL)
    ready = poller.poll(0)
    require(not any(flags & (select.POLLERR | select.POLLNVAL) for _fd, flags in ready),
            'Bound pidfd is invalid')
    return not ready


def require_managed_identity(ok, record, observed, message):
    if ok:
        return
    details = {'family': record['family'], 'admitted': record['admitted'],
               'directRoot': record['directRoot'], 'lifetimeIdentity': record['lifetimeIdentity'],
               'originalAdmittedSession': record['originalAdmittedSession'],
               'expectedRegisteredIdentity': record['immutableIdentity'],
               'actualObservation': observed, 'pidfdLiveBeforeObservation': True,
               'pidfdLiveAfterObservation': 'not checked because identity guard failed'}
    raise RuntimeError(message + '; comparison=' + json.dumps(details, sort_keys=True))


def managed_process_observation(record):
    # Admitted lifetime ownership is separate from mutable process context.
    pid = record['lifetimeIdentity']['pid']
    p = Path('/proc') / str(pid)
    unavailable = []

    def read_stat():
        try:
            raw = (p / 'stat').read_text()
            fields = raw[raw.rfind(')') + 2:].split()
            return None if fields[0] in ('Z', 'X') else fields
        except (FileNotFoundError, ProcessLookupError):
            return None

    def read_link(name, phase):
        try:
            return os.readlink(p / name)
        except OSError as error:
            unavailable.append({'field': name, 'phase': phase, 'error': type(error).__name__})
            return None

    before = read_stat()
    if before is None:
        return None
    context_before = {'session': int(before[3]), 'executable': read_link('exe', 'before'),
                      'cwd': read_link('cwd', 'before')}
    try:
        raw = (p / 'cmdline').read_bytes()
    except OSError as error:
        unavailable.append({'field': 'cmdline', 'phase': 'single read', 'error': type(error).__name__})
        raw = None
    context_after = {'executable': read_link('exe', 'after'), 'cwd': read_link('cwd', 'after')}
    after = read_stat()
    if after is None:
        return None
    context_after['session'] = int(after[3])
    argv = None if raw is None else [part.decode(errors='replace') for part in raw.split(b'\0') if part]
    kernel_before = {'pid': pid, 'startTicks': int(before[19])}
    kernel_after = {'pid': pid, 'startTicks': int(after[19])}
    current = {**kernel_after, **context_after}
    return {'observedAt': now(), 'identity': {**kernel_after, 'executable': context_after['executable'],
            'cwd': context_after['cwd'], 'argv': argv}, 'immutableIdentity': current,
            'kernelBefore': kernel_before, 'kernelAfter': kernel_after,
            'mutableSnapshots': {'before': context_before, 'after': context_after},
            'ambiguity': {'mutableContextChanged': context_before != context_after,
                          'unavailableFields': unavailable},
            'cmdline': {'nulBytesHex': None if raw is None else raw.hex(), 'nulSeparatedArgv': argv}}


def protected_descendant_binding(assignment, record):
    # Validate every protected-preview invariant before handling target exit races.
    check = protected(assignment)
    observed = owned_observation(record)
    if observed is None:
        return False  # owned_observation returns None only when the held pidfd is ready.
    pid = record['lifetimeIdentity']['pid']
    require(pid != 1063, 'Descendant is the protected process')
    namespace = os.readlink('/proc/self/ns/net')
    try:
        require(os.readlink('/proc/' + str(pid) + '/ns/net') == namespace,
                'Candidate network namespace differs')
        require(not (sockets(pid) & set(check['listeningSockets'])),
                'Candidate holds a protected 4173 listening socket')
    except (FileNotFoundError, ProcessLookupError):
        if not pidfd_live(record['pidfd']):
            return False
        raise RuntimeError('Candidate namespace/socket snapshot unavailable while bound pidfd remains live; no signal is permitted')
    return owned_observation(record) is not None


def owned_observation(record):
    if not pidfd_live(record['pidfd']):
        return None
    value = (process_observation(record['immutableIdentity']['pid'])
             if record['directRoot'] and not record['admitted'] else managed_process_observation(record))
    if value is None:
        if not pidfd_live(record['pidfd']):
            return None
        require_managed_identity(False, record, None,
            'Managed process snapshot unavailable while bound pidfd remains live; no signal is permitted')
    if record['directRoot'] and not record['admitted']:
        require_managed_identity(value['immutableIdentity'] == record['immutableIdentity'], record, value,
            'Managed PID/start/session/executable/cwd changed during initial binding; no signal is permitted')
    else:
        require_managed_identity(value['kernelBefore'] == record['lifetimeIdentity']
            and value['kernelAfter'] == record['lifetimeIdentity'], record, value,
            'Managed PID/start changed; no signal is permitted')
        if record['directRoot']:
            require_managed_identity(value['mutableSnapshots']['before']['session'] ==
                value['mutableSnapshots']['after']['session'] == record['originalAdmittedSession'] ==
                record['lifetimeIdentity']['pid'], record, value,
                'Managed direct-root reserved session changed; no signal is permitted')
    return value if pidfd_live(record['pidfd']) else None


def process_state(pid):
    try:
        text = (Path('/proc') / str(pid) / 'stat').read_text()
        fields = text[text.rfind(')') + 2:].split()
        return {'pid': pid, 'state': fields[0], 'parentPid': int(fields[1]),
                'session': int(fields[3]), 'startTicks': int(fields[19])}
    except (FileNotFoundError, ProcessLookupError):
        return None


def session_id(pid):
    value = process_state(pid)
    return None if value is None else value['session']


def sockets(pid):
    result = set()
    for path in (Path('/proc') / str(pid) / 'fd').iterdir():
        try:
            link = os.readlink(path)
            if link.startswith('socket:['):
                result.add(link)
        except FileNotFoundError:
            pass
    return result


def listeners(port):
    result = set()
    for name in ('tcp', 'tcp6'):
        for line in (Path('/proc/net') / name).read_text().splitlines()[1:]:
            values = line.split()
            if len(values) > 9 and values[3] == '0A' and int(values[1].rsplit(':', 1)[1], 16) == port:
                result.add('socket:[' + values[9] + ']')
    return result


def protected(assignment, candidate=None):
    expected = assignment['protectedProcess']
    require(expected['pid'] == 1063 and expected['startTicks'] == 874 and expected['cwd'] == str(PROTECTED_ROOT), 'Protected identity not admitted')
    require(identity(1063) == expected, 'Protected process identity changed')
    namespace = os.readlink('/proc/self/ns/net')
    require(os.readlink('/proc/1063/ns/net') == namespace, 'Protected network namespace differs')
    live = listeners(PORTS['protected'])
    require(live and live == set(assignment['protectedListenerSockets']) and live <= sockets(1063), 'Protected 4173 socket holder changed')
    if candidate is not None:
        observed = owned_observation(candidate)
        require(observed is not None and observed['immutableIdentity']['pid'] != 1063,
                'Candidate exited or differs before protected check')
        pid = candidate['immutableIdentity']['pid']
        require(os.readlink('/proc/' + str(pid) + '/ns/net') == namespace, 'Candidate network namespace differs')
        require(not (sockets(pid) & live), 'Candidate holds a protected 4173 listening socket')
        require(owned_observation(candidate) is not None, 'Candidate exited after protected socket check')
    return {'at': now(), 'process': expected, 'listeningSockets': sorted(live), 'holderPid': 1063}


def inventory(records, root, complete=False):
    root = Path(root)
    require(root.is_absolute() and root.resolve() == root and not root.is_symlink(), 'Inventory root is noncanonical')
    seen = set()
    for row in records:
        relative = Path(row['path'])
        require(not relative.is_absolute() and '..' not in relative.parts and row['path'] not in seen, 'Inventory path is invalid or duplicate')
        path = root / relative
        bound({'path': str(path), 'bytes': row['bytes'], 'sha256': row['sha256']}, MAX_RAW_BYTES)
        require(stat.S_IMODE(path.stat().st_mode) == row['mode'], 'Inventory mode differs')
        seen.add(row['path'])
    if complete:
        actual = set()
        for path in root.rglob('*'):
            require(not path.is_symlink(), 'Symlink in complete inventory')
            if path.is_file():
                actual.add(path.relative_to(root).as_posix())
        require(actual == seen, 'Complete inventory filename set differs')
    return seen


def guard(path, phase):
    raw = raw_file(path, 128 * 1024)
    anchor = os.environ.get('OVF_FEATURE63_WRAPPER_ASSIGNMENT_SHA256', '')
    require(re.fullmatch('[0-9a-f]{64}', anchor) and sha(raw) == anchor, 'Root must supply the external assignment digest')
    a = json.loads(raw)
    require(a['schema'] == 'feature63-dedicated-wrapper-assignment-v1' and a['approved'] is True and a['assignedBy'] == '/root', 'Dedicated wrapper is held')
    require(a['phase'] == phase and a['sourceRoot'] == str(CHECKOUT) and a['freshPrefix'] == PREFIX_NAME, 'Phase/checkout/prefix differs')
    require(Path.cwd().resolve() == CHECKOUT and CHECKOUT.resolve() == CHECKOUT, 'Use the owned checkout cwd')
    pin = a['sourcePin']
    require(re.fullmatch('[0-9a-f]{40}', pin or '') and a['productVersion'] == '4.0.2', 'Root source pin/version missing')
    require(a['wrapperSha256'] == sha(Path(__file__).read_bytes()), 'Wrapper bytes differ')
    require(subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=CHECKOUT, text=True).strip() == pin, 'Source HEAD differs')
    require(subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=no'], cwd=CHECKOUT, text=True) == '', 'Tracked source is dirty')
    slot = a['exclusiveHeavyApproval']
    require(slot['approved'] is True and slot['holder'] == '/root/ai_modes' and len(slot['token']) >= 16, 'Exclusive slot absent')
    until = datetime.datetime.fromisoformat(slot['validUntil'].replace('Z', '+00:00')).timestamp()
    require(until > time.time() + MAX_ATTEMPT + MAX_CLEANUP + 90, 'Exclusive slot expires too soon')
    protected(a)
    source = receipt(a['sourceBinding'], 'feature63-new-source-binding-v1', pin)
    require(source['authenticatedInputs'] is True and source['includesSourceConfigPublicBuildAndProof'] is True, 'Source binding scope incomplete')
    paths = inventory(source['records'], CHECKOUT)
    require(set(REQUIRED_SOURCE) <= paths and source['inputCount'] == len(paths), 'Required source paths absent')
    require(source['requiredInputSetAuthenticatedByRoot'] is True, 'Root has not admitted the complete product/build/proof input set')
    build = receipt(a['buildBinding'], 'feature63-build-binding-v1', pin)
    require(build['productVersion'] == '4.0.2' and build['publicDriverSha256'] == a['wrapperSha256'], 'Build version/driver differs')
    require(build['webDistPath'] == str(PREFIX / 'dist') and build['serverBuildPath'] == str(PREFIX / 'server'), 'Build paths differ')
    inventory(build['webRecords'], PREFIX / 'dist', complete=True)
    inventory(build['serverRecords'], PREFIX / 'server', complete=True)
    require(build['testedBuildId'] == a['testedBuildId'] and bool(a['testedBuildId']), 'Tested build ID differs')
    tests = receipt(a['testedBuildReceipt'], 'feature63-tested-build-v1', pin)
    require(tests['testedBuildId'] == a['testedBuildId'] and tests['sourceAndBuiltBytesMatchTested402'] is True
            and tests['fullSuitePassed'] is True and tests['buildPassed'] is True, 'Tested 4.0.2 binding absent')
    review = receipt(a['reviewReceipt'], 'feature63-dedicated-wrapper-review-v1', pin)
    require(review['status'] == 'PASS' and review['wrapperSha256'] == a['wrapperSha256']
            and review['restoredBothOwnerHumanTargetUnion'] is True, 'Dedicated wrapper/scope review absent')
    for key in ('publicProducer', 'collector', 'auditor', 'nodeExecutable', 'pythonExecutable'):
        bound(a[key], MAX_RAW_BYTES)
        require(review[key + 'Sha256'] == a[key]['sha256'], 'Review candidate/dependency differs')
    require(build['producerSha256'] == a['publicProducer']['sha256'], 'Build producer binding differs')
    browser = receipt(a['browserBinding'], 'feature63-browser-binding-v1', pin)
    require(browser['producerSha256'] == a['publicProducer']['sha256'] and browser['buildBindingSha256'] == a['buildBinding']['sha256']
            and browser['exclusiveSlotToken'] == slot['token'], 'Browser dependency binding differs')
    require(browser['contextCount'] == 2 and browser['browserCount'] == 1 and browser['headless'] is True
            and browser['nativeLifecycleOwner'] == 'dedicated-wrapper' and browser['reviewedCdpDisconnectHasNoNativeSignals'] is True
            and browser['cdpBaseUrl'] == 'http://127.0.0.1:5374' and browser['allDependencyBytesAuthenticated'] is True
            and browser['nativeLifetimeReviewRequiredByRoot'] is True,
            'External browser lifecycle/dependency review absent')
    bound(browser['playwrightEntry'], MAX_RAW_BYTES)
    bound(browser['chromiumExecutable'], MAX_RAW_BYTES)
    inventory(browser['dependencyRecords'], Path(browser['dependencyRoot']), complete=True)
    require(browser['playwrightModulePath'] == browser['playwrightEntry']['path'], 'Playwright module differs')
    return a, build, browser


class Children:
    def __init__(self, assignment, output):
        self.assignment = assignment
        self.output = output
        self.children = {}
        self.roots = {}
        self.closed_families = set()
        self.resources = {}
        self.logs = []

    def event(self, action, **values):
        with (self.output / 'driver-events.ndjson').open('ab') as handle:
            handle.write((json.dumps({'at': now(), 'action': action, **values}, sort_keys=True) + '\n').encode())
            handle.flush()

    def observe(self, record):
        value = owned_observation(record)
        if value is not None:
            snapshot = {key: item for key, item in value.items() if key != 'observedAt'}
            if snapshot != record['lastObservation']:
                self.event('native process mutable observation changed', identity=record['identity'],
                           immutableIdentity=record['immutableIdentity'], family=record['family'],
                           lifetimeIdentity=record['lifetimeIdentity'],
                           originalAdmittedSession=record['originalAdmittedSession'],
                           directRoot=record['directRoot'], previousObservation=record['lastObservation'],
                           observation=value)
                record['lastObservation'] = snapshot
        return value

    def resource(self, ident):
        record = self.resources[(ident['pid'], ident['startTicks'])]
        require(all(ident[key] == record['immutableIdentity'][key]
                    for key in ('pid', 'startTicks', 'executable', 'cwd')), 'Owned descriptor differs from bound resource')
        return record

    def alive(self, ident):
        return self.observe(self.resource(ident)) is not None

    def register(self, observed, family):
        ident = observed['identity']
        immutable = observed['immutableIdentity']
        root = self.roots[family]
        require(root is not None, 'Original owned root reservation is missing')
        key = (ident['pid'], ident['startTicks'])
        if key in self.resources:
            record = self.resources[key]
            require(record['lifetimeIdentity'] == {key: immutable[key] for key in ('pid', 'startTicks')}
                    and record['family'] == family, 'Previously registered lifetime identity or family changed')
            self.observe(record)
            return
        direct_root = ident['pid'] == root['pid']
        admission_session = immutable['session'] if direct_root else observed['admissionSession']
        lifetime = ({key: immutable[key] for key in ('pid', 'startTicks')} if direct_root else
                    observed['admissionLifetimeIdentity'])
        require(admission_session == root['pid'], 'Resource was not initially observed in its original owned session')
        if not direct_root:
            require(observed['kernelBefore'] == observed['kernelAfter'] == lifetime,
                    'New descendant PID/start changed during original-session observation; comparison=' +
                    json.dumps({'expectedLifetimeIdentity': lifetime, 'actualObservation': observed}, sort_keys=True))

        def skipped(reason):
            protected(self.assignment)  # Target disappearance never suppresses a preview failure.
            self.event('transient native descendant not admitted', family=family,
                       identity=ident, immutableIdentity=immutable, lifetimeIdentity=lifetime,
                       originalAdmittedSession=admission_session, directRoot=False,
                       originalObservation=observed, reason=reason, signalsSent=0,
                       unobservedDescendantsExcluded=False)

        require(hasattr(os, 'pidfd_open') and hasattr(signal, 'pidfd_send_signal'), 'Kernel-bound pidfd signaling is required')
        try:
            fd = os.pidfd_open(ident['pid'])
        except ProcessLookupError:
            if direct_root:
                raise
            skipped('pidfd_open reported that the initially observed descendant PID vanished')
            return
        record = {'identity': ident, 'immutableIdentity': immutable, 'family': family,
                  'pidfd': fd, 'admitted': False, 'directRoot': direct_root,
                  'lifetimeIdentity': lifetime, 'originalAdmittedSession': admission_session,
                  'lastObservation': {key: item for key, item in observed.items() if key != 'observedAt'}}
        try:
            bound_observation = owned_observation(record)
            if bound_observation is None and not direct_root:
                skipped('held pidfd reported descendant exit during initial binding')
                return
            require(bound_observation is not None, 'Process exited while opening pidfd')
            if direct_root:
                protected(self.assignment, record)
            elif not protected_descendant_binding(self.assignment, record):
                skipped('held pidfd reported descendant exit during protected candidate checks')
                return
            record['admitted'] = True  # Bound lifetime and all protected checks have passed.
            self.resources[key] = record
            self.event('registered native resource', identity=ident, immutableIdentity=immutable,
                       cmdline=observed['cmdline'], family=family, lifetimeIdentity=record['lifetimeIdentity'],
                       originalAdmittedSession=record['originalAdmittedSession'], directRoot=record['directRoot'])
            self.observe(record)
        finally:
            if key not in self.resources:
                os.close(fd)

    def exited(self, family):
        # Observing /proc never wait()s or reaps a child. The direct PID remains reserved.
        process = self.children[family]
        state = process_state(process.pid)
        root = self.roots.get(family)
        if root is not None and state is not None:
            require(state['startTicks'] == root['startTicks'] and state['session'] == root['session'] == root['pid'],
                    'Unreaped direct root start tick or session changed')
        record = None if root is None else self.resources.get((root['pid'], root['startTicks']))
        if state is None or state['state'] in ('Z', 'X'):
            return True if record is None else self.observe(record) is None
        return False if record is None else self.observe(record) is None

    def refresh(self, selected_family=None):
        sessions = {}
        for family, root in self.roots.items():
            if selected_family is not None and family != selected_family:
                continue
            if root is None:
                continue
            if family in self.closed_families:
                continue
            process = self.children[family]
            require(process.returncode is None, 'Direct root was reaped before owned-session closure')
            state = process_state(root['pid'])
            require(state is not None and state['startTicks'] == root['startTicks']
                    and state['session'] == root['session'] == root['pid'], 'Unreaped direct PID/session reservation changed')
            sessions[root['pid']] = family
        # Only kernel session membership admits descendants. Numeric PPID alone never does.
        # The unreaped direct root reserves the session ID until the final scan and wait().
        for path in Path('/proc').iterdir():
            if not path.name.isdigit():
                continue
            pid = int(path.name)
            state = process_state(pid)
            family = None if state is None else sessions.get(state['session'])
            if family is None or state['state'] in ('Z', 'X'):
                continue
            known = self.resources.get((pid, state['startTicks']))
            if known is not None:
                require(known['family'] == family, 'Registered lifetime family changed')
                self.observe(known)
                continue
            # The first stat observed membership in a still-reserved original SID.
            lifetime = {'pid': pid, 'startTicks': state['startTicks']}
            if pid == self.roots[family]['pid']:
                observed = process_observation(pid)
                require(observed is not None, 'Direct-root admission snapshot unavailable; no transient skip')
                self.register(observed, family)
                continue
            observed = managed_process_observation({'lifetimeIdentity': lifetime})
            if observed is None:
                protected(self.assignment)
                self.event('transient native descendant not admitted', family=family,
                           lifetimeIdentity=lifetime, originalAdmittedSession=state['session'],
                           directRoot=False, originalProcessState=state,
                           reason='Required proc snapshot unavailable or terminal before held-pidfd binding; no lifetime exit conclusion',
                           signalsSent=0, unobservedDescendantsExcluded=False)
                continue
            observed['admissionSession'] = state['session']
            observed['admissionLifetimeIdentity'] = lifetime
            self.register(observed, family)
        for value in self.resources.values():
            if selected_family is not None and value['family'] != selected_family:
                continue
            if value['family'] in self.closed_families:
                continue
            observed = self.observe(value)
            if observed is not None and value['directRoot']:
                require(observed['immutableIdentity']['session'] == self.roots[value['family']]['pid'],
                        'Managed direct root left its reserved session; no signal is permitted')

    def start(self, label, command, env):
        protected(self.assignment)
        out = (self.output / (label + '.stdout')).open('xb')
        err = (self.output / (label + '.stderr')).open('xb')
        self.logs += [out, err]
        process = subprocess.Popen(command, cwd=CHECKOUT, env=env, stdout=out, stderr=err, stdin=subprocess.DEVNULL, start_new_session=True)
        self.children[label] = process
        state = process_state(process.pid)
        self.roots[label] = None if state is None else {'pid': process.pid, 'startTicks': state['startTicks'], 'session': state['session']}
        self.event('reserved direct child before launch authentication', family=label, pid=process.pid, processState=state, command=command, submittedArgv=list(command))
        deadline = time.monotonic() + 2
        ident = None
        while time.monotonic() < deadline:
            candidate = process_observation(process.pid)
            if candidate is not None:
                # A Popen child stays unreaped; its numeric PID cannot be replaced during this binding.
                # Retain the initial five-key descriptor even if launch argv validation will reject it.
                self.register(candidate, label)
                ident = candidate['identity']
                break
            if self.exited(label):
                break
            time.sleep(0.02)
        protected(self.assignment)
        require(ident is not None and ident['argv'] == command and ident['cwd'] == str(CHECKOUT), 'New child launch identity differs; reserved root retained for guarded cleanup')
        require(session_id(process.pid) == process.pid, 'New child must own a distinct kernel session')
        return ident

    def send(self, record, signum):
        require(record['admitted'] is True, 'Only admitted held-pidfd lifetimes may receive signals')
        ident = record['identity']
        if self.observe(record) is None:
            return
        check = protected(self.assignment, record)
        require(self.observe(record) is not None, 'Signal target exited after socket check')
        signal.pidfd_send_signal(record['pidfd'], signum)
        self.event('sent signal through bound pidfd', target=ident, immutableIdentity=record['immutableIdentity'],
                   signal=signum, protectedSocketCheck=check)

    def stop_family(self, family, grace):
        if family not in self.children or family in self.closed_families:
            return
        require(family in self.roots and self.children[family].returncode is None, 'Direct launch reservation is missing or was prematurely reaped')
        state = process_state(self.children[family].pid)
        if self.roots[family] is None and state is not None:
            self.roots[family] = {'pid': state['pid'], 'startTicks': state['startTicks'], 'session': state['session']}
        root = self.roots[family]
        known = None if root is None else self.resources.get((root['pid'], root['startTicks']))
        actual = self.observe(known) if known is not None else process_observation(self.children[family].pid)
        if actual is not None:
            require(state is not None and self.roots[family] is not None and state['startTicks'] == self.roots[family]['startTicks']
                    and state['session'] == self.roots[family]['session'] == self.roots[family]['pid'],
                    'Reserved direct root start ticks or session changed')
            self.register(actual, family)
        if state is None:
            # A vanished own child needs no signal. Its Popen object has never been reaped here.
            protected(self.assignment)
            self.children[family].wait(timeout=2)
            self.closed_families.add(family)
            self.event('reserved direct child already exited', family=family, exitCode=self.children[family].returncode,
                       unobservedDescendantsExcluded=False)
            return
        self.refresh(family)
        direct = self.children[family]
        records = [v for v in self.resources.values() if v['family'] == family]
        for record in records:
            if record['identity']['pid'] == direct.pid:
                self.send(record, signal.SIGTERM)
        deadline = time.monotonic() + grace
        while time.monotonic() < deadline:
            self.refresh(family)
            records = [v for v in self.resources.values() if v['family'] == family]
            if not any(self.observe(v) is not None for v in records):
                break
            time.sleep(0.1)
        # Discover again after graceful parent exit; the direct root is still unreaped.
        self.refresh(family)
        for record in list(self.resources.values()):
            if record['family'] == family and self.observe(record) is not None:
                self.send(record, signal.SIGTERM)
        term_deadline = time.monotonic() + 2
        while time.monotonic() < term_deadline:
            self.refresh(family)
            records = [v for v in self.resources.values() if v['family'] == family]
            if not any(self.observe(v) is not None for v in records):
                break
            time.sleep(0.1)
        kill_deadline = time.monotonic() + 3
        while True:
            self.refresh(family)
            records = [v for v in self.resources.values() if v['family'] == family]
            survivors = [v for v in records if self.observe(v) is not None]
            if not survivors:
                # Repeat observed-session discovery; this is not an atomic global empty-membership proof.
                self.refresh(family)
                records = [v for v in self.resources.values() if v['family'] == family]
                survivors = [v for v in records if self.observe(v) is not None]
                if not survivors:
                    break
            protected(self.assignment)
            require(time.monotonic() < kill_deadline, 'Owned-session cleanup deadline reached; no retry')
            for record in survivors:
                self.send(record, signal.SIGKILL)
            time.sleep(0.05)
        require(self.exited(family), 'Direct child not confirmed exited')
        protected(self.assignment)
        direct.wait(timeout=2)  # First reap occurs only after both final owned-session scans.
        self.closed_families.add(family)
        self.event('resource family closed', family=family, exitCode=direct.returncode,
                   identities=[v['identity'] for v in records], observedSessionScans=2, unobservedDescendantsExcluded=False)

    def finish(self):
        for handle in self.logs:
            handle.close()
        for value in self.resources.values():
            os.close(value['pidfd'])


def request_json(url, maximum=1024 * 1024):
    with urllib.request.urlopen(url, timeout=1) as response:
        raw = response.read(maximum + 1)
        require(response.status == 200 and len(raw) <= maximum, 'Bound HTTP probe failed or exceeded limit')
        return raw


def final_protected_readback(assignment):
    try:
        return {'status': 'PASS', **protected(assignment)}
    except Exception as error:
        return {'status': 'FAIL', 'at': now(), 'error': str(error)}


def await_listener(owner, label, children, seconds=20):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        children.refresh()
        protected(children.assignment, children.resource(owner))
        require(not children.exited(label), label + ' exited during startup')
        live = listeners(PORTS[label])
        if live:
            require(live <= sockets(owner['pid']), 'Owned port has another socket holder')
            return sorted(live)
        time.sleep(0.1)
    protected(children.assignment, children.resource(owner))
    raise RuntimeError(label + ' startup timeout; no retry')


def runtime_budget():
    for sub, cap in (('server-data', MAX_RAW_BYTES), ('native-collector', MAX_COLLECTOR_BYTES), ('public', MAX_RAW_BYTES), ('lifecycle', 16 * 1024 * 1024)):
        path = PREFIX / sub
        if path.exists():
            total = 0
            for item in path.rglob('*'):
                require(not item.is_symlink(), 'Symlink in owned runtime output')
                if item.is_file():
                    total += item.stat().st_size
            require(total <= cap, sub + ' byte budget exceeded; bytes preserved')
    public = PREFIX / 'public'
    if public.exists():
        require(sum((public / name).stat().st_size for name in AUDIT_INPUTS if (public / name).exists()) <= MAX_PUBLIC_BYTES,
                'Auditor public-input 64 MiB budget exceeded; bytes preserved')


def capture(assignment_path):
    a, build, browser = guard(assignment_path, 'capture')
    require(not listeners(5373) and not listeners(5374), 'Owned ports must be unused before launch')
    require(PREFIX.is_dir() and {p.name for p in PREFIX.iterdir()} == {'dist', 'server'}, 'Fresh prefix may contain only authenticated build directories')
    lifecycle = PREFIX / 'lifecycle'
    lifecycle.mkdir()
    manager = Children(a, lifecycle)
    failure = None
    result = {'schema': 'feature63-dedicated-capture-result-v1', 'sourcePin': a['sourcePin'], 'testedBuildId': a['testedBuildId'],
              'startedAt': now(), 'feature63Qualified': False, 'rootSealAndExtractionRequired': True, 'automaticRetries': 0,
              'nativeClosureEvidenceScope': 'Direct unreaped roots and bound observed original-session descendants only',
              'unobservedDescendantsExcluded': False, 'rootNativeLifetimeDispositionRequired': True}
    env = {key: value for key, value in os.environ.items() if not key.startswith('RTS_') and key not in ('NODE_OPTIONS', 'PYTHONOPTIMIZE')}
    try:
        env.update({'RTS_HOST': '127.0.0.1', 'RTS_PORT': '5373', 'RTS_DATA_DIR': str(PREFIX / 'server-data'),
                    'RTS_STATIC_DIR': str(PREFIX / 'dist'), 'RTS_ORIGIN': 'http://127.0.0.1:5373'})
        server = manager.start('server', [a['nodeExecutable']['path'], str(PREFIX / 'server/rts-server.js')], env)
        server_sockets = await_listener(server, 'server', manager)
        health = json.loads(request_json('http://127.0.0.1:5373/api/health'))
        require(health['ok'] is True and health['protocolVersion'] == 1, 'Owned server health differs')
        served_index = request_json('http://127.0.0.1:5373/')
        require(served_index == (PREFIX / 'dist/index.html').read_bytes(), 'Served index differs from authenticated build')
        db = PREFIX / 'server-data/server.sqlite'
        info = db.lstat()
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and db.resolve() == db and info.st_size <= MAX_RAW_BYTES, 'Fresh DB identity invalid')
        fresh_db = {'path': str(db), 'device': info.st_dev, 'inode': info.st_ino}
        server_receipt = write_new(lifecycle / 'server-ownership.json', {
            'schema': 'feature63-owned-server-v1', 'approved': True, 'sourcePin': a['sourcePin'], 'pid': server['pid'],
            'startTicks': str(server['startTicks']), 'port': 5373, 'baseUrl': 'http://127.0.0.1:5373', 'freshPrefix': PREFIX_NAME,
            'exclusiveSlotToken': a['exclusiveHeavyApproval']['token'], 'protectedRootPort': 4173, 'protectedRootUnaffected': True,
            'processIdentity': server, 'listenerSockets': server_sockets, 'freshDatabase': fresh_db})
        browser_command = [browser['chromiumExecutable']['path'], '--headless=new', '--no-sandbox',
                           '--enable-unsafe-swiftshader', '--disable-dev-shm-usage',
                           '--disable-crash-reporter', '--disable-breakpad', '--disable-crashpad-for-testing',
                           '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=5374',
                           '--user-data-dir=' + str(PREFIX / 'browser-profile'), '--no-first-run', '--no-default-browser-check', 'about:blank']
        chrome = manager.start('browser', browser_command, env)
        browser_sockets = await_listener(chrome, 'browser', manager)
        version = json.loads(request_json('http://127.0.0.1:5374/json/version'))
        require(isinstance(version.get('webSocketDebuggerUrl'), str) and version['webSocketDebuggerUrl'].startswith('ws://127.0.0.1:5374/'), 'Owned CDP endpoint differs')
        browser_receipt = write_new(lifecycle / 'browser-ownership.json', {
            'schema': 'feature63-owned-browser-v1', 'approved': True, 'sourcePin': a['sourcePin'], 'pid': chrome['pid'],
            'startTicks': str(chrome['startTicks']), 'executable': chrome['executable'], 'processIdentity': chrome,
            'port': 5374, 'cdpBaseUrl': browser['cdpBaseUrl'], 'listenerSockets': browser_sockets,
            'exclusiveSlotToken': a['exclusiveHeavyApproval']['token'], 'protectedRootPort': 4173, 'protectedRootUnaffected': True})
        public = dict(a['publicAssignmentTemplate'])
        require(public['schema'] == 'feature63-public-producer-assignment-v1' and public['sourcePin'] == a['sourcePin']
                and public['approved'] is True and public['reviewedProducer'] == a['publicProducer']
                and public['publicDriverSha256'] == a['wrapperSha256'] and public['maxRetainedBytes'] == MAX_RAW_BYTES
                and public['sourceBinding'] == a['sourceBinding'] and public['buildBinding'] == a['buildBinding']
                and public['browserBinding'] == a['browserBinding'] and public['exclusiveHeavyApproval'] == a['exclusiveHeavyApproval'], 'Root public template differs')
        public.update({'serverOwnership': server_receipt, 'externalBrowserOwnership': browser_receipt})
        public_descriptor = write_new(lifecycle / 'public-assignment.json', public)
        public_env = dict(env, OVF_FEATURE63_PUBLIC_ASSIGNMENT=public_descriptor['path'])
        manager.start('public', [a['nodeExecutable']['path'], a['publicProducer']['path']], public_env)
        public_start = time.monotonic()
        collector_started = None
        match_identity = None
        while not manager.exited('public'):
            manager.refresh()
            protected(a)
            runtime_budget()
            require(manager.alive(server) and manager.alive(chrome), 'Owned server/browser exited or changed')
            protected(a)
            require(time.monotonic() - public_start <= MAX_ATTEMPT + 5, 'Public attempt exceeded wrapper bound')
            if collector_started is None:
                path = PREFIX / 'public/public-match-identity.json'
                if path.exists():
                    try:
                        value = json.loads(raw_file(path, 1024 * 1024))
                    except json.JSONDecodeError:
                        value = None
                    if value is not None:
                        require(value['schema'] == 'feature63-public-match-identity-v1' and value['sourcePin'] == a['sourcePin']
                                and bool(value['matchId']), 'Early public match identity differs')
                        match_identity = {'path': str(path), 'bytes': path.stat().st_size, 'sha256': sha(path.read_bytes())}
                        collector = dict(a['collectorAssignmentTemplate'])
                        require(collector['rootApproved'] is True and collector['sourcePin'] == a['sourcePin']
                                and collector['collectorSha256'] == a['collector']['sha256']
                                and collector['sourceInventory'] == a['sourceBinding']
                                and collector['heavySlot'] == {'assigned': True, 'exclusive': True, 'slotId': a['exclusiveHeavyApproval']['token']},
                                'Root collector template or exclusive slot token differs')
                        collector.update({'publicMatchIdentity': match_identity, 'ownedServer': server, 'freshDatabase': fresh_db})
                        descriptor = write_new(lifecycle / 'collector-assignment.json', collector)
                        manager.start('collector', [a['pythonExecutable']['path'], a['collector']['path'], descriptor['path']], env)
                        collector_started = time.monotonic()
                        result['matchId'] = value['matchId']
            elif manager.exited('collector'):
                manager.stop_family('collector', 0)
                require(manager.children['collector'].returncode == 0, 'Collector first failure')
                value = json.loads(raw_file(PREFIX / 'native-collector/collector-receipt.json', MAX_COLLECTOR_BYTES))
                require(value['status'] == 'PASS' and value['closed'] is True and value['activeQuery'] is None, 'Collector closure failed')
            time.sleep(0.1)
        manager.stop_family('public', 0)
        require(manager.children['public'].returncode == 0 and collector_started is not None, 'Public first failure or collector never started')
        public_result = json.loads(raw_file(PREFIX / 'public/public-results.json', MAX_PUBLIC_BYTES))
        require(public_result['publicCandidatePassed'] is True and public_result['cleanupPassed'] is True
                and public_result['feature63Qualified'] is False and public_result['matchId'] == result['matchId'], 'Public capture did not pass')
        require(sha(raw_file(match_identity['path'], 1024 * 1024)) == match_identity['sha256'], 'Public match identity changed after collector binding')
        manager.stop_family('collector', 3)
        collector_receipt = json.loads(raw_file(PREFIX / 'native-collector/collector-receipt.json', MAX_COLLECTOR_BYTES))
        require(collector_receipt['status'] == 'PASS' and collector_receipt['closed'] is True
                and collector_receipt['activeQuery'] is None and collector_receipt['matchId'] == result['matchId'], 'Final collector closure differs')
        # Prompt owned-server closure preserves the ordinary final checkpoint where possible.
        manager.stop_family('server', 3)
        manager.stop_family('public', 0)
        manager.stop_family('browser', 3)
        runtime_budget()
        require(not listeners(5373) and not listeners(5374), 'Owned listener remains after closure')
        result['status'] = 'CAPTURE_PASS_ROOT_SEAL_AND_EXTRACTION_PENDING'
    except Exception as error:
        failure = {'type': type(error).__name__, 'message': str(error), 'at': now()}
        result['status'] = 'FAIL_FIRST_FAILURE_NO_RETRY'
        manager.event('first runtime failure; no retry', failure=failure)
    finally:
        cleanup_failures = []
        for family in ('public', 'collector', 'server', 'browser'):
            try:
                manager.stop_family(family, 2)
            except Exception as error:
                cleanup_failures.append({'family': family, 'error': str(error), 'at': now()})
        result.update({'firstFailure': failure, 'cleanupFailures': cleanup_failures, 'finishedAt': now(),
                       'protectedFinalReadback': final_protected_readback(a), 'closedFreshDatabaseIdentity': result.get('matchId') and fresh_db})
        if cleanup_failures or result['protectedFinalReadback']['status'] != 'PASS':
            result['status'] = 'FAIL_CLEANUP_HELD_NO_UNVERIFIED_SIGNAL'
        lifecycle_bytes = sum(p.stat().st_size for p in lifecycle.rglob('*') if p.is_file())
        result_size = len((json.dumps(result, indent=2, sort_keys=True) + '\n').encode())
        if lifecycle_bytes + result_size > 16 * 1024 * 1024:
            result['status'] = 'FAIL_LIFECYCLE_OUTPUT_BUDGET_NO_RETRY'
            result['firstFailure'] = result['firstFailure'] or {
                'type': 'OutputBudget', 'message': 'Complete lifecycle output exceeded 16 MiB; bytes preserved', 'at': now()}
            result['lifecycleBytesBeforeFinalResult'] = lifecycle_bytes
        write_new(lifecycle / 'driver-result.json', result)
        manager.finish()
    return 0 if result['status'] == 'CAPTURE_PASS_ROOT_SEAL_AND_EXTRACTION_PENDING' else 1


def audit(assignment_path):
    a, _build, _browser = guard(assignment_path, 'audit')
    require(not listeners(5373) and not listeners(5374), 'Capture resources must close before audit')
    capture_result = json.loads(bound(a['captureResult']))
    require(capture_result['status'] == 'CAPTURE_PASS_ROOT_SEAL_AND_EXTRACTION_PENDING' and capture_result['sourcePin'] == a['sourcePin'], 'Root has not admitted a passing closed capture')
    # Root must seal/extract the fresh closed DB separately. This driver never reads SQLite.
    ready = receipt(a['rootExtractionAdmission'], 'feature63-root-extraction-admission-v1', a['sourcePin'])
    require(ready['closedFreshRawAuthenticated'] is True and ready['completeSelectedTextAndQueryMetadataAuthenticated'] is True
            and ready['matchId'] == capture_result['matchId'] and ready['auditorSha256'] == a['auditor']['sha256']
            and ready['ownedNativeLifetimeIndependentlyAdmitted'] is True, 'Root native extraction/seal/lifetime admission absent')
    root_assignment = bound(a['nativeAuditAssignment'])
    require(a['nativeAuditAssignment']['sha256'] == ready['rootAssignmentSha256'], 'External native root assignment trust anchor differs')
    bundle = Path(a['nativeBundle'])
    require(bundle.is_absolute() and bundle.resolve() == bundle and bundle.is_dir() and PROTECTED_ROOT not in bundle.parents, 'Native bundle is outside the owned extracted location')
    require(str(bundle) == ready['bundlePath'], 'Root native bundle differs')
    inventory(ready['bundleRecords'], bundle, complete=True)
    output = PREFIX / 'native-audit'
    output.mkdir()  # Existing output prohibits a second invocation.
    write_new(output / 'one-shot-admission.json', {'schema': 'feature63-audit-one-shot-v1', 'at': now(), 'sourcePin': a['sourcePin'],
        'rootAssignmentSha256': sha(root_assignment), 'auditorSha256': a['auditor']['sha256'], 'automaticRetries': 0})
    manager = Children(a, output)
    command = [a['pythonExecutable']['path'], a['auditor']['path'], '--bundle', str(bundle),
               '--assignment-sha256', sha(root_assignment)]
    env = {key: value for key, value in os.environ.items() if key not in ('PYTHONOPTIMIZE', 'PYTHONPATH')}
    failure = None
    code = 1
    try:
        manager.start('native-audit', command, env)
        deadline = time.monotonic() + 60
        while not manager.exited('native-audit'):
            manager.refresh()
            protected(a)
            require(time.monotonic() < deadline, 'Native audit timeout; one invocation only')
            require(sum(p.stat().st_size for p in output.iterdir() if p.is_file()) <= 2 * 1024 * 1024,
                    'Native audit output exceeded 2 MiB; original bytes preserved')
            time.sleep(0.1)
        manager.stop_family('native-audit', 0)
        code = manager.children['native-audit'].returncode
        require(code == 0, 'Native auditor first failure; preserve stdout/stderr, no retry')
    except Exception as error:
        failure = {'type': type(error).__name__, 'message': str(error), 'at': now()}
    finally:
        try:
            manager.stop_family('native-audit', 2)
        except Exception as error:
            failure = failure or {'type': type(error).__name__, 'message': str(error), 'at': now()}
        manager.finish()
        # Check final stdout/stderr/events before reporting success; preserve all produced bytes.
        final_bytes = sum(p.stat().st_size for p in output.iterdir() if p.is_file())
        if final_bytes > 2 * 1024 * 1024:
            failure = failure or {'type': 'OutputBudget', 'message': 'Final native audit output exceeded 2 MiB; bytes preserved', 'at': now()}
        # Complete stdout is kept byte-for-byte under the required native-audit.json name.
        (output / 'native-audit.stdout').rename(output / 'native-audit.json')
        (output / 'native-audit.stderr').rename(output / 'native-audit.stderr.txt')
        audit_result = {'schema': 'feature63-audit-driver-result-v1', 'sourcePin': a['sourcePin'],
            'status': 'PASS' if failure is None and code == 0 else 'FAIL_NO_RETRY', 'firstFailure': failure,
            'auditorExitCode': code, 'nativeAuditInvocations': 1, 'protectedFinalReadback': final_protected_readback(a), 'finishedAt': now()}
        if audit_result['protectedFinalReadback']['status'] != 'PASS':
            failure = failure or {'type': 'ProtectedReadback', 'message': 'Final protected process/socket readback failed', 'at': now()}
            audit_result.update({'status': 'FAIL_NO_RETRY', 'firstFailure': failure})
        result_size = len((json.dumps(audit_result, indent=2, sort_keys=True) + '\n').encode())
        if final_bytes + result_size > 2 * 1024 * 1024:
            failure = failure or {'type': 'OutputBudget', 'message': 'Complete native audit output exceeded 2 MiB; bytes preserved', 'at': now()}
            audit_result.update({'status': 'FAIL_NO_RETRY', 'firstFailure': failure})
        write_new(output / 'driver-result.json', audit_result)
    return 0 if failure is None and code == 0 else 1


def main():
    require(sys.flags.optimize == 0 and len(sys.argv) == 3 and sys.argv[1] in ('capture', 'audit'), 'Use explicit capture|audit plus root-bound assignment; no other CLI overrides')
    assignment = Path(sys.argv[2])
    return capture(assignment) if sys.argv[1] == 'capture' else audit(assignment)


if __name__ == '__main__':
    raise SystemExit(main())
