# Modes proof retention at 453c221

This is an external retention plan for the sealed modes packet at `/tmp/ovf-modes-complete-packet-453c221.dgl9yk4w`. It does not change that packet or delete external originals. Root owns copying, commits, and the feature ledger. Original feature 69 is the only proposed status promotion.

Copy the 153 regular files listed in `retain-paths.txt`, preserving their packet-relative paths. They total 26,216,711 bytes. Also retain this index directory and the final independent admission review/audit when it is available. `retained-packet-files.json` records each copied file's bytes and SHA256. Generated evidence paths may require force-add under repository ignore rules.

Omit 596 physical source-input copies and 393 public dist asset copies only as documented in `git-preserved-omissions.json` and its TSV. Each omitted path is mapped to the immutable commit `453c2218af9973b9eca8fb78392435bd9d46a740`, repository path, Git mode/type/blob, byte count, and SHA256. Every duplicate was compared with the corresponding Git blob. The omitted copies total 139,079,685 bytes. The dist favicon remains in the retained list alongside the recorded HTTP response bytes.

The external server `node_modules` symlink is represented by its target text and hash in `external-link-metadata.json`; copying the link is not required. Full installed dependency bytes are outside the packet. Keep the existing preparation and dependency receipts. This metadata does not supply portable dependencies.

All generated HTML/JS/CSS, server and verifier bundles, module metadata, runtime/browser/native payloads, screenshots, raw logs, launch/preparation/recipe receipts, HTTP favicon evidence, cleanup observations, historical failure records, plans, reviews, payload audits, and both full packet index files stay in the retained list. The failed first temporary bind remains failed. Its cause is unestablished; the later successful observation does not replace it.

The retained subset preserves the full original manifest and hash index unchanged. It is a bounded evidence archive, not a newly executed acceptance root. Original absolute runtime paths remain original paths. The full packet's `verify-packet.py` is for the full packet; it will not pass against an intentionally reduced subset.

Verify the planned or copied subset with `python3 verify-retention.py PACKET_OR_RETAINED_SUBSET GIT_REPOSITORY`. That script reads retained files and authenticates every omitted copy against pinned Git blobs. It may also compare original duplicate files if they remain present. It imports no product code and executes no simulation, browser, build, or server.

`external-packet-seal.json` is an unchanged copy of the external seal. `sealed-packet-verifier.*` records the successful full packet byte/path check. `retention-verifier.*` records the successful mapping check. `retention-index-hashes.tsv` authenticates this directory except for that index itself.
