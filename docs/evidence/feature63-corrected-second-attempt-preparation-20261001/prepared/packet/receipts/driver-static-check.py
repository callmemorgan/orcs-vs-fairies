"""Parse candidate text; never import, compile, or execute candidate code."""
import ast
import datetime
import hashlib
import json
from pathlib import Path

owned = Path('/tmp/ovf-feature63-corrective-r2-driver-vmhywo95')
source = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/scripts/feature63/run-minimal63.py')
base_raw = (owned / 'base-run-minimal63.py').read_bytes()
candidate_raw = (owned / 'run-minimal63.py').read_bytes()
base_text, candidate_text = base_raw.decode(), candidate_raw.decode()
base_tree = ast.parse(base_text, filename=str(owned / 'base-run-minimal63.py'))
candidate_tree = ast.parse(candidate_text, filename=str(owned / 'run-minimal63.py'))
base_sha = hashlib.sha256(base_raw).hexdigest()
candidate_sha = hashlib.sha256(candidate_raw).hexdigest()
assert base_sha == 'e333b6386e4a48ac4194ef760a6ee605bc567252b8fdae832f0d65a630e687be'
assert source.read_bytes() == base_raw

checks = []

def checked(name, assertion, detail):
    assert assertion, name
    checks.append({'check': name, 'status': 'PASS', 'detail': detail})

def dump(node):
    return ast.dump(node, include_attributes=False)

def top(tree, name):
    return next(n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.ClassDef)) and n.name == name)

def method(tree, name):
    return next(n for n in top(tree, 'Children').body if isinstance(n, ast.FunctionDef) and n.name == name)

def assignment(tree, name):
    return next(n for n in ast.walk(tree) if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == name for t in n.targets))

def line_of(text, needle):
    return text[:text.index(needle)].count('\n') + 1

checked('static syntax', isinstance(base_tree, ast.Module) and isinstance(candidate_tree, ast.Module),
        'Only ast.parse on source text. No candidate import, compile, function call, subprocess, or runtime action.')
untouched = ['require', 'now', 'sha', 'raw_file', 'bound', 'receipt', 'write_new',
             'process_state', 'session_id', 'sockets', 'listeners', 'inventory', 'guard',
             'request_json', 'final_protected_readback', 'runtime_budget', 'audit', 'main']
checked('semantic and audit guards unchanged', all(dump(top(base_tree, n)) == dump(top(candidate_tree, n)) for n in untouched),
        'AST equality for ' + ', '.join(untouched) + '.')
checked('manager output and release unchanged', all(dump(method(base_tree, n)) == dump(method(candidate_tree, n)) for n in ['__init__', 'event', 'finish']),
        'Children.__init__, event, and finish retain their original behavior.')
base_capture_final = next(n for n in top(base_tree, 'capture').body if isinstance(n, ast.Try)).finalbody
candidate_capture_final = next(n for n in top(candidate_tree, 'capture').body if isinstance(n, ast.Try)).finalbody
checked('capture final byte caps and result guards unchanged',
        len(base_capture_final) == len(candidate_capture_final)
        and all(dump(b) == dump(c) for b, c in zip(base_capture_final, candidate_capture_final)),
        'The entire capture finally block is AST-identical, including 16 MiB lifecycle cap, result accounting, per-family final cleanup, and protected final readback. Audit retains its 2 MiB cap.')
for constant in ['CHECKOUT', 'PROTECTED_ROOT', 'PORTS', 'REQUIRED_SOURCE', 'MAX_ATTEMPT', 'MAX_CLEANUP', 'MAX_RAW_BYTES', 'MAX_PUBLIC_BYTES', 'MAX_COLLECTOR_BYTES', 'AUDIT_INPUTS']:
    checked('constant ' + constant, dump(assignment(base_tree, constant)) == dump(assignment(candidate_tree, constant)), 'AST-identical.')
checked('fresh r2 prefix only', assignment(candidate_tree, 'PREFIX_NAME').value.value == 'work/feature63-human-wave-composition-r2',
        'r1 remains untouched; this is candidate text only and creates no runtime prefix.')
ident_assign = next(n for n in top(candidate_tree, 'process_observation').body[1].body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'ident' for t in n.targets))
checked('five-key public descriptor', {k.value for k in ident_assign.value.keys} == {'pid', 'startTicks', 'executable', 'cwd', 'argv'} and len(ident_assign.value.keys) == 5,
        'Public/collector identity dict remains exactly pid/startTicks/executable/cwd/argv. Immutable session and raw cmdline are separate.')
raw_split_calls = [n for n in ast.walk(top(candidate_tree, 'process_observation')) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and isinstance(n.func.value, ast.Name) and n.func.value.id == 'raw' and n.func.attr == 'split']
checked('cmdline NUL parsing only', len(raw_split_calls) == 1 and len(raw_split_calls[0].args) == 1 and isinstance(raw_split_calls[0].args[0], ast.Constant) and raw_split_calls[0].args[0].value == b'\0',
        'Raw bytes are preserved as hex with NUL bytes; decoded argv splits only on NUL. Chrome joined titles are never whitespace- or shell-split.')
checked('protected full identity equality retained', "require(identity(1063) == expected, 'Protected process identity changed')" in candidate_text,
        'Protected PID 1063/startTicks 874/cwd, full five-key argv equality, 4173 holder, namespace, and bound listener sockets remain strict.')
b_protected, c_protected = top(base_tree, 'protected'), top(candidate_tree, 'protected')
checked('protected root guards retained', all(dump(b) == dump(c) for b,c in zip(b_protected.body[:7], c_protected.body[:7])),
        'All protected root statements before candidate checks are AST-identical. Candidate checks use bound PIDFD and immutable tuple around socket disjointness.')
identity_calls = [n for n in ast.walk(candidate_tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == 'identity']
checked('no owned current-argv equality remains', len(identity_calls) == 1 and identity_calls[0].args[0].value == 1063,
        'The only current five-key identity call is the full protected root check. Owned liveness flows through immutableIdentity equality and pidfd_live.')
popen_base = next(n for n in ast.walk(method(base_tree,'start')) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == 'Popen')
popen_candidate = next(n for n in ast.walk(method(candidate_tree,'start')) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == 'Popen')
checked('initial Popen argv unchanged', dump(popen_base) == dump(popen_candidate) and "submittedArgv=list(command)" in candidate_text,
        'Popen receives the same command list with cwd=CHECKOUT and start_new_session=True; event records the submitted argv separately.')
checked('initial launch argv validation retained', "require(ident is not None and ident['argv'] == command and ident['cwd'] == str(CHECKOUT), 'New child launch identity differs; reserved root retained for guarded cleanup')" in candidate_text,
        'The captured initial argv must exactly equal the submitted command. Initial descriptor is never replaced with a later Chrome title.')
browser_base = assignment(base_tree,'browser_command').value
browser_candidate = assignment(candidate_tree,'browser_command').value
added_flags = ['--no-sandbox', '--enable-unsafe-swiftshader']
filtered_candidate = ast.List(elts=[n for n in browser_candidate.elts if not (isinstance(n, ast.Constant) and n.value in added_flags)], ctx=ast.Load())
checked('only root-selected Chrome additions', dump(browser_base) == dump(filtered_candidate) and all(sum(isinstance(n, ast.Constant) and n.value == flag for n in browser_candidate.elts) == 1 for flag in added_flags),
        'Only --no-sandbox and --enable-unsafe-swiftshader were added. Parent conveyed root selection on 2026-10-01. These align known passing main15 launch; FD crash causality remains unproved.')
signals = [n for n in ast.walk(candidate_tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr in {'pidfd_send_signal','kill','killpg','send_signal','terminate'}]
checked('PIDFD-only individual signaling', len(signals) == 1 and isinstance(signals[0].func.value,ast.Name) and signals[0].func.value.id == 'signal' and signals[0].func.attr == 'pidfd_send_signal',
        'Only signal.pidfd_send_signal(record[pidfd], signum); immutable/PIDFD observation precedes protected socket checks and is repeated immediately before signal.')
waits = [n for n in ast.walk(candidate_tree) if isinstance(n, ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr == 'wait']
checked('unreaped root reservation retained', len(waits) == 2 and all(n in list(ast.walk(method(candidate_tree,'stop_family'))) for n in waits) and 'Direct root was reaped before owned-session closure' in candidate_text,
        'No Popen.poll or early wait. Both wait calls stay in stop_family; live-session reservations include PID/startTicks/session and final closure retains two observed-session scans.')
checked('original-session-only admission retained', "family = None if state is None else sessions.get(state['session'])" in candidate_text and "immutable['session'] == root['pid']" in candidate_text and "state['session'] == root['session'] == root['pid']" in candidate_text,
        'Only observed members of the reserved original kernel session are admitted. Numeric PPID alone admits nothing. Cleanup remains family-filtered.')
checked('no cgroup or unobserved-descendant claim', 'cgroup' not in candidate_text and candidate_text.count('unobservedDescendantsExcluded=False') == base_text.count('unobservedDescendantsExcluded=False') and "'unobservedDescendantsExcluded': False" in candidate_text,
        'No cgroup gate or unobserved descendant absence claim. Root independent native lifetime disposition remains required.')

callsite_rows = [
    (100, 'def process_observation(pid):', 'identity snapshot', 'Adds stable PID/start/session/executable/cwd snapshot plus raw NUL cmdline bytes/list. identity() still returns the original five public keys.'),
    (154, "require(identity(1063) == expected", 'protected root equality', 'Retained full strict five-key comparison, including argv. No owned-process exception applies to protected PID 1063.'),
    (160, 'observed = owned_observation(candidate)', 'protected candidate equality', 'Replaces mutable current-argv equality with bound immutable tuple/PIDFD liveness before and after protected socket disjointness.'),
    (259, "require(record['immutableIdentity'] == immutable", 'repeat registration equality', 'Compares complete immutable tuple plus family; cmdline changes only produce separate events.'),
    (263, "require(owned_observation(record) is not None, 'Process exited while opening pidfd')", 'PIDFD opening revalidation', 'Revalidates immutable tuple and PIDFD liveness after opening the kernel descriptor. A later process title cannot invalidate ownership.'),
    (274, "require(state['startTicks'] == root['startTicks'] and state['session']", 'direct root exit identity', 'Adds immutable original session equality to reserved startTicks. Bound live roots additionally authenticate through observe/PIDFD without reaping.'),
    (289, "and state['session'] == root['session'] == root['pid']", 'direct PID/session reservation', 'Retains unreaped PID/startTicks reservation and pins the stored original session ID to the direct PID.'),
    (304, "require(observed['immutableIdentity']['session'] == self.roots[family]['pid']", 'descendant session admission', 'Uses one stable snapshot session; registration also requires original root session and immutable/PIDFD binding.'),
    (314, "require(observed['immutableIdentity']['session'] == self.roots[value['family']]['pid']", 'refresh ownership equality', 'observe validates immutable tuple/PIDFD; this check retains original-family session membership. Raw cmdline changes are audit events only.'),
    (341, "require(ident is not None and ident['argv'] == command", 'initial launch argv equality', 'Retained strict captured-initial argv comparison with submitted Popen command; initial descriptor remains immutable as stored data.'),
    (342, "require(session_id(process.pid) == process.pid", 'initial launch session equality', 'Retained direct session ownership check; registration separately binds this session into immutableIdentity.'),
    (347, 'if self.observe(record) is None:', 'signal target liveness', 'Uses bound PIDFD liveness and immutable tuple; mutable argv never determines a live signal target.'),
    (349, 'check = protected(self.assignment, record)', 'signal equality before sockets', 'The preceding observe authenticates immutable ownership. Protected candidate receives the bound resource and rechecks it around socket disjointness.'),
    (351, "require(self.observe(record) is not None, 'Signal target exited after socket check')", 'signal equality after sockets', 'Repeats immutable/PIDFD authentication immediately before the only individual signal primitive.'),
    (362, 'actual = process_observation(self.children[family].pid)', 'cleanup direct root observation', 'Obtains immutable/session/raw cmdline snapshot; registration uses immutable tuple rather than full current argv.'),
    (364, "and state['session'] == self.roots[family]['session'] == self.roots[family]['pid']", 'cleanup direct root reservation equality', 'Adds stored original session to reserved startTicks equality before any direct-root registration or cleanup.'),
    (384, 'if not any(self.observe(v) is not None for v in records):', 'parent grace survival equality', 'Replaces full current identity equality with immutable/PIDFD-authenticated liveness for this family.'),
    (390, "if record['family'] == family and self.observe(record) is not None:", 'family SIGTERM selection equality', 'Keeps family filter and selects only immutable/PIDFD-authenticated live records; send repeats protected checks.'),
    (396, 'if not any(self.observe(v) is not None for v in records):', 'descendant grace survival equality', 'Uses the same immutable/PIDFD liveness helper; no argv-based false absence.'),
    (403, 'survivors = [v for v in records if self.observe(v) is not None]', 'first final-scan survival equality', 'Uses immutable/PIDFD liveness, retaining the original-session scan and family filter.'),
    (408, 'survivors = [v for v in records if self.observe(v) is not None]', 'second final-scan survival equality', 'Same helper in the repeated observed-session scan before first reap; no global absence claim.'),
    (447, 'protected(children.assignment, children.resource(owner))', 'listener ownership and timeout protection', 'Converts five-key descriptor to its bound internal resource; protected root/4173/socket disjointness remains adjacent to startup and timeout checks.'),
    (454, 'protected(children.assignment, children.resource(owner))', 'listener timeout candidate protection', 'Same bound-resource candidate check immediately before startup timeout failure.'),
    (535, 'require(manager.alive(server) and manager.alive(chrome)', 'capture owner liveness equality', 'Both owned server/browser use the immutable/PIDFD helper instead of full current argv; strict protected root and attempt timeout checks remain.'),
]
occurrences = {}
rows = []
for original_line, needle, purpose, change in callsite_rows:
    lines = [i+1 for i,line in enumerate(candidate_text.splitlines()) if needle in line]
    index = occurrences.get(needle,0)
    if index >= len(lines):
        index = 0
    occurrences[needle] = index + 1
    rows.append({'originalLine': original_line, 'candidateLine': lines[index], 'purpose': purpose, 'change': change})

receipt = {'schema':'feature63-corrective-r2-driver-static-check-v1','status':'PASS_STATIC_ONLY',
           'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
           'basePath':str(source),'baseSha256':base_sha,
           'candidatePath':str(owned/'run-minimal63.py'),'candidateSha256':candidate_sha,
           'candidateBytes':len(candidate_raw),'candidateMode':oct((owned/'run-minimal63.py').stat().st_mode & 0o7777),
           'diffPath':str(owned/'run-minimal63.patch'),'diffSha256':hashlib.sha256((owned/'run-minimal63.patch').read_bytes()).hexdigest(),
           'candidateWasImported':False,'candidateFunctionsWereCalled':False,'candidateWasExecuted':False,
           'runtimeApprovalImplied':False,'runtimeValidationPerformed':False,
           'writeScope':str(owned),'checks':checks,'processAuthenticationCallsites':rows,
           'knownIncident':{'pid':1804106,'startTicks':9074516,'session':1804106,
                            'change':'argv changed to one joined title 8 ms after initial strict registration; immutable owner fields stayed the same',
                            'automaticRetryAuthorized':False,'r1PrefixPreserved':True},
           'launchFlagEvidence':{'addedFlags':added_flags,'authorization':'Parent conveyed root-selected additions after initial writer task',
                                 'comparison':'Known passing main15 native launch used both','fdCrashCausalityProved':False}}
(owned/'static-check-receipt.json').write_text(json.dumps(receipt,indent=2,sort_keys=True)+'\n')
md = ['The r2 candidate passes static syntax and preservation checks. It has not been imported or executed. The only writes from this writer are inside '+str(owned)+'.',
      '', 'The five-key process descriptor stays compatible with the public producer and collector. Ownership uses a separate immutable PID/startTicks/session/executable/cwd tuple with a bound PIDFD. Raw `/proc/<pid>/cmdline` bytes are stored as hex alongside the NUL-separated list. A joined Chrome title remains one item.',
      '', 'The initial submitted Popen argv and strict initial launch validation remain. Protected PID 1063 keeps its complete five-key identity equality, including argv, and the startTicks 874, cwd, network namespace, 4173 socket-holder checks. Signals use only individual PIDFD calls after immutable and protected socket checks.',
      '', 'The only native launch additions are `--no-sandbox` and `--enable-unsafe-swiftshader`, as root selected through the parent. They align the known passing main15 launch. The FD crash cause remains unproved.',
      '', 'Original source/build/feature/output guards, the capture final block, 16 MiB lifecycle cap, 64 MiB public audit-input cap, and 2 MiB native audit cap remain unchanged. Original-session admission, direct unreaped session reservations, per-family cleanup, and two final observed-session scans remain. No cgroup gate or unobserved descendant absence claim was added.',
      '', 'Process authentication callsites are listed below for review. Line numbers refer to the pinned base and this candidate.', '', '| Base | Candidate | Callsite | Change |', '| --- | --- | --- | --- |']
for row in rows:
    md.append(f"| {row['originalLine']} | {row['candidateLine']} | {row['purpose']} | {row['change']} |")
md += ['', 'Static checks', '', '| Check | Result |', '| --- | --- |']
for row in checks:
    md.append('| '+row['check']+' | '+row['status']+' |')
md += ['', 'Base SHA256: `'+base_sha+'`.', '', 'Candidate SHA256: `'+candidate_sha+'`.', '', 'This receipt provides static review evidence only. It does not authorize another runtime attempt. The failed r1 prefix remains in place.']
(owned/'static-check-receipt.md').write_text('\n'.join(md)+'\n')
print(json.dumps({'status':receipt['status'],'candidatePath':receipt['candidatePath'],'candidateSha256':candidate_sha,'diffPath':receipt['diffPath'],'diffSha256':receipt['diffSha256'],'receiptPath':str(owned/'static-check-receipt.json'),'checks':len(checks),'callsites':len(rows)},sort_keys=True))
