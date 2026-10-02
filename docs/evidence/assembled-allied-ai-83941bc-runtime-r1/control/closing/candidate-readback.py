#!/usr/bin/env python3
"""Authenticate the external candidate and re-read its pure Node qualification."""
from pathlib import Path
import datetime, hashlib, json, subprocess

BASE = Path('/home/morgana/.codex/worktrees/assembled-allied-ai')
REPO = BASE / 'orcs-vs-Fairies'
PACKET = REPO / 'work/ai-save401-final-83941bc-r1'
CANDIDATE = BASE / 'ai-839-online-optional-proof-r1'
PIN = '83941bc80ce9ec08840b0645d9b33e8018d5309a'
OUT = BASE / 'ai-839-runtime-control-r1/closing/candidate-readback.json'
assert not OUT.exists(), 'Append-only receipt must be fresh'

def digest(data):
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

provenance = json.loads((CANDIDATE / 'provenance.json').read_bytes())
checks = []
def check(name, condition, details=None):
    assert condition, name
    checks.append({'name': name, 'passed': True, 'details': details})

source = (CANDIDATE / provenance['sourceCopy']['path']).read_bytes()
candidate = (CANDIDATE / provenance['candidate']['path']).read_bytes()
pinned = subprocess.check_output(['git', 'show', f'{PIN}:scripts/verify_assembled_online.mjs'], cwd=REPO)
check('complete external source copy equals pinned839 Git blob', source == pinned, digest(source))
for key in ['sourceCopy', 'candidate', 'patch']:
    record = provenance[key]
    actual = digest((CANDIDATE / record['path']).read_bytes())
    check(f'{key} small native bytes equal recorded seal', actual == {'bytes': record['bytes'], 'sha256': record['sha256']}, actual)

old = b'    if(privateSides.includes(player))assert.deepEqual(render.players[player],disclosedPlayers.get(player),`Private player ${player} must match its authorized server view`);'
new = b'    if(privateSides.includes(player)) {\n      const privatePlayer={...render.players[player]};if(privatePlayer.heroRecovery===undefined)delete privatePlayer.heroRecovery;\n      assert.deepEqual(privatePlayer,disclosedPlayers.get(player),`Private player ${player} must match its authorized server view`);\n    }'
check('one narrow private-player block is the entire candidate difference', source.count(old) == 1 and candidate == source.replace(old, new))
check('all bytes outside the optional-field block including complete save/replay guards remain unchanged', candidate.replace(new, old) == source)

node = '/home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/bin/node'
run = subprocess.run([node, str(CANDIDATE / 'qualification/qualify.mjs')], capture_output=True, check=False)
recorded = (CANDIDATE / 'qualification/result.json').read_bytes()
check('pure Node qualification exits zero with no stderr', run.returncode == 0 and not run.stderr, {'command': [node, str(CANDIDATE / 'qualification/qualify.mjs')], 'exit': run.returncode})
check('pure Node qualification output equals retained result bytes', run.stdout == recorded, digest(recorded))
qualification = json.loads(recorded)
check('qualification contains eleven cases and no product runtime import', qualification['passed'] == 11 and qualification['productRuntimeImported'] is False)

sealed = json.loads((PACKET / 'final-manifest.json').read_bytes())
for key, relative in [('stderr', 'envelopes/online-ui/stderr.log'), ('results', 'online-ui/results.json')]:
    actual = digest((PACKET / relative).read_bytes())
    check(f'original failed online {key} retains final packet seal', actual == sealed['files'][relative], actual)
results = json.loads((PACKET / 'online-ui/results.json').read_bytes())
check('online remains failed after six partial checks', results['completed'] is False and len(results['checks']) == 6 and 'failure' in results)
stderr = (PACKET / 'envelopes/online-ui/stderr.log').read_text()
actual_start = stderr.index('  actual: {')
expected_start = stderr.index('  expected: {', actual_start)
actual_block = stderr[actual_start:expected_start]
expected_block = stderr[expected_start:stderr.index("  operator: 'deepStrictEqual'", expected_start)]
check('recorded first private-player0 diagnostic distinguishes only displayed heroRecovery key presence', 'heroRecovery: undefined,' in actual_block and 'heroRecovery' not in expected_block)

payload = {
    'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'scope': 'Small file authentication plus pure Node assertion qualification only. No product import, browser, server, build, simulation or retry.',
    'sourcePin': PIN,
    'checks': checks,
    'passed': True,
    'diagnostic': {
        'assertion': 'Private player 0 must match its authorized server view',
        'sourceLine': 100,
        'callSiteLine': 177,
        'rawStderrPath': str(PACKET / 'envelopes/online-ui/stderr.log'),
        'actualRawBlock': actual_block,
        'expectedRawBlock': expected_block,
        'typedFields': {
            'faction': {'actual': 'orcs', 'expected': 'orcs'},
            'wood': {'actual': 420, 'expected': 420},
            'ore': {'actual': 220, 'expected': 220},
            'crystal': {'actual': 0, 'expected': 0},
            'population': {'actual': 6, 'expected': 6},
            'cap': {'actual': 12, 'expected': 12},
            'upgrades': {'actual': [], 'expected': []},
            'heroRecovery': {'actual': {'present': True, 'type': 'undefined'}, 'expected': {'present': False}},
        },
        'qualification': 'Typed fields transcribe the exact retained Node diagnostic for the first private-player0 object only. No later player or assertion result is inferred.',
    },
    'limits': ['Candidate is external and has not run against the browser or product runtime.', 'Second private-player comparison and all later online checks remain unrun.', 'Original failed diagnostic, results and sealed packet remain unchanged.'],
}
OUT.write_text(json.dumps(payload, indent=2) + '\n')
print(json.dumps({'receipt': str(OUT), **digest(OUT.read_bytes()), 'checks': len(checks), 'passed': True}, indent=2))
