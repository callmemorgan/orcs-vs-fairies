#!/usr/bin/env python3
"""Produce a fresh exact allowlist; never copy or delete the admitted sources."""
import argparse
import hashlib
import json
from pathlib import Path

WORK = Path(__file__).resolve().parent
RET = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/ai-83941bc-retry-prep-r1/retention')
DESTINATION = Path('docs/evidence/save401-ai-lossless-453c221-r1')
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True)
parser.add_argument('--include-review', action='store_true')
parser.add_argument('--reuse-verified-payloads', action='store_true',
                    help='Bind unchanged payloads to the prior full-read plan after slot release')
args = parser.parse_args()
output = WORK / args.output
assert output.parent == WORK and not output.exists()
records = []
prior_path = WORK / 'pre-review-import-plan.json'
prior_bytes = prior_path.read_bytes() if args.reuse_verified_payloads else None
prior = ({record['source']: record for record in json.loads(prior_bytes)['files']}
         if prior_bytes is not None else {})
reused_payloads = []

def add(source, destination, category):
    assert source.is_file() and not source.is_symlink(), str(source)
    old = prior.get(str(source))
    if (old is not None and
            category in ('native_retained_payload_or_receipt', 'encoded_sqlite')):
        assert source.stat().st_size == old['bytes'], 'Preserved payload size changed'
        assert old['destination'] == str(destination) and old['category'] == category
        records.append(dict(old))
        reused_payloads.append(str(source))
        return
    sha, total = hashlib.sha256(), 0
    with source.open('rb') as handle:
        while block := handle.read(1024 * 1024):
            sha.update(block)
            total += len(block)
    records.append({'source':str(source), 'destination':str(destination),
                    'category':category, 'bytes':total, 'sha256':sha.hexdigest()})

for source in sorted((RET / 'retained-actual-r1').rglob('*')):
    if source.is_file():
        add(source, DESTINATION / 'actual' / source.relative_to(RET / 'retained-actual-r1'),
            'native_retained_payload_or_receipt')
add(RET / 'sqlite-codec-r1/server.sqlite.gz', DESTINATION / 'sqlite/server.sqlite.gz', 'encoded_sqlite')
add(RET / 'sqlite-codec-r1/result.json', DESTINATION / 'sqlite/result.json', 'codec_receipt')
add(RET / 'restore-public-r1/restore-result.json', DESTINATION / 'public-restore-result.json', 'public_receipt')
for source in sorted(WORK.rglob('*')):
    if source.is_file() and source != output:
        add(source, DESTINATION / 'execution' / source.relative_to(WORK), 'execution_metadata')
review = RET / 'execution-review-r1'
if args.include_review:
    assert review.is_dir() and any(review.iterdir()), 'Independent review is absent'
    for source in sorted(review.rglob('*')):
        if source.is_file():
            add(source, DESTINATION / 'review' / source.relative_to(review), 'independent_review')
assert len({r['destination'] for r in records}) == len(records)
assert all('server.sqlite.decoded' not in r['source'] and '/restore-public-r1/dist/' not in r['source']
           and not r['source'].endswith('/server-data/server.sqlite') for r in records)
value = {'state':'exact_bounded_import_allowlist', 'source_pin':'453c2218af9973b9eca8fb78392435bd9d46a740',
         'proposed_repository_root':str(DESTINATION), 'files':records,
         'listed_files':len(records), 'listed_bytes':sum(r['bytes'] for r in records),
         'plan_self_excluded':True, 'plan_destination':str(DESTINATION / 'bounded-import-plan.json'),
         'plan_requires_separate_size_sha256_record':True,
         'native_payload_entries':195, 'native_payload_bytes':82174828,
         'encoded_sqlite_bytes':39472569, 'total_payload_bytes':121647397,
         'independent_review_included':args.include_review,
         'preserved_payload_hashes_bound_to_prior_full_reads':{
             'enabled':args.reuse_verified_payloads,
             'prior_plan':str(prior_path) if prior_bytes is not None else None,
             'prior_plan_sha256':hashlib.sha256(prior_bytes).hexdigest() if prior_bytes is not None else None,
             'reused_entries':len(reused_payloads),
             'paths':reused_payloads,
             'scope':'Previously read and hashed retained payloads and codec remain under sole-writer preservation; new metadata and review files are rehashed. No new payload read after slot release.'},
         'importer_must_verify_written_bytes_against_each_listed_size_sha256':True,
         'excluded_local_proofs':[
             {'path':str(RET / 'sqlite-codec-r1/server.sqlite.decoded'),'bytes':222466048,'reason':'Retain locally as byte equality proof; do not duplicate in repository import.'},
             {'path':str(RET / 'restore-public-r1/dist'),'bytes':68373454,'reason':'Retain locally as restoration proof; reconstruct indexed blobs from pinned Git objects.'}],
         'immutable_original_packet_retained':True,'local_disk_reclaimed_bytes':0,
         'no_import_or_deletion_performed':True,
         'git_object_dependency':'Retain reachable old 453 and comparison 839 commits and the indexed public blobs.',
         'limits':'Old 453 packet only. Hosted failed SQLite excluded. Root alone writes shared repository, trail and ledger.'}
with output.open('x') as handle:
    json.dump(value,handle,indent=2)
    handle.write('\n')
raw = output.read_bytes()
print(json.dumps({'path':str(output),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
                  'listed_files':value['listed_files'],'listed_bytes':value['listed_bytes']},indent=2))
