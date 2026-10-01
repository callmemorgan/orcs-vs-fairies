#!/usr/bin/env python3
"""Light asset audit. Writes only beside this file; never runs game/build code."""
import datetime
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import zlib

OUT = Path(__file__).resolve().parent
ROOT = OUT.parent.parent
BASE = "c074cc5e610fc128d7b6ac894a61258d418463d4"
PROOF = "9e5fd2340b9a0823d1ab9f566c52b947a094278e"
PROOF_ROOT = Path("/home/morgana/Projects/orcs-vs-fairies-autosave-proof")
ICO_SHA = "5e0bf0f72488bc693d779cd7a3ebc7fdfca8db9916a6e3e0811fff59113253c2"
SOURCE_SHA = "e5e4c504c204867f652eb2444fe5455557e6a5c19727cace79b89a08affde2b7"
SOURCE_BLOB = "fceae80e0b1d46234207f79466b5c06c97c80211"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def git(*args, root=ROOT):
    return subprocess.check_output(["git", *args], cwd=root)


def fingerprint(path):
    data = path.read_bytes()
    return {"bytes": len(data), "sha256": sha(data)}


def png_chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def encode_png(width, height, rgba):
    assert len(rgba) == width * height * 4
    rows = b"".join(b"\0" + rgba[y * width * 4:(y + 1) * width * 4] for y in range(height))
    return (b"\x89PNG\r\n\x1a\n" +
            png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)) +
            png_chunk(b"IDAT", zlib.compress(rows, 9)) + png_chunk(b"IEND", b""))


def paeth(a, b, c):
    p = a + b - c
    distances = (abs(p - a), abs(p - b), abs(p - c))
    return (a, b, c)[distances.index(min(distances))]


def decode_png(data):
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    offset = 8
    compressed = bytearray()
    metadata = None
    while offset < len(data):
        length = struct.unpack_from(">I", data, offset)[0]
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        crc = struct.unpack_from(">I", data, offset + 8 + length)[0]
        assert zlib.crc32(kind + payload) == crc
        offset += 12 + length
        if kind == b"IHDR":
            metadata = struct.unpack(">IIBBBBB", payload)
        elif kind == b"IDAT":
            compressed.extend(payload)
        elif kind == b"IEND":
            assert offset == len(data)
            break
    width, height, bits, color, compression, filtering, interlace = metadata
    assert (bits, color, compression, filtering, interlace) == (8, 6, 0, 0, 0)
    raw = zlib.decompress(compressed)
    stride = width * 4
    assert len(raw) == height * (stride + 1)
    previous = bytearray(stride)
    result = bytearray()
    for y in range(height):
        row_offset = y * (stride + 1)
        filter_type = raw[row_offset]
        assert filter_type <= 4
        row = bytearray(raw[row_offset + 1:row_offset + 1 + stride])
        for x in range(stride):
            left = row[x - 4] if x >= 4 else 0
            above = previous[x]
            diagonal = previous[x - 4] if x >= 4 else 0
            adjustment = (0, left, above, (left + above) // 2, paeth(left, above, diagonal))[filter_type]
            row[x] = (row[x] + adjustment) & 255
        result.extend(row)
        previous = row
    return width, height, bytes(result)


assert OUT == ROOT / "work/favicon-independent-review"
assert git("rev-parse", "HEAD").decode().strip() == BASE
status_before = git("status", "--short", "--untracked-files=all").decode()
assert status_before == "?? public/favicon.ico\n", status_before
tracked_diff = git("diff", BASE, "--binary")
assert tracked_diff == b""
assert git("diff", BASE, "--name-only", "--", "index.html", "scripts", "src", "docs") == b""
assert git("check-ignore", "work/favicon-independent-review/receipt.json").decode().strip() == "work/favicon-independent-review/receipt.json"
assert git("rev-parse", "HEAD", root=PROOF_ROOT).decode().strip() == PROOF
assert git("diff", PROOF, "--name-only", "--", "scripts/session-recovery", root=PROOF_ROOT) == b""
assert git("status", "--short", "--untracked-files=all", "--", "scripts/session-recovery", root=PROOF_ROOT) == b""

source = (ROOT / "public/assets/portrait-orcs.png").read_bytes()
ico = (ROOT / "public/favicon.ico").read_bytes()
assert sha(source) == SOURCE_SHA
assert sha(ico) == ICO_SHA and len(ico) == 32038
assert git("rev-parse", BASE + ":public/assets/portrait-orcs.png").decode().strip() == SOURCE_BLOB
assert git("show", BASE + ":public/assets/portrait-orcs.png") == source
source_width, source_height, source_rgba = decode_png(source)
assert (source_width, source_height) == (78, 109)

reserved, icon_type, count = struct.unpack_from("<HHH", ico)
assert (reserved, icon_type, count) == (0, 1, 4)
frames = []
next_offset = 6 + 16 * count
for i, size in enumerate((64, 48, 32, 16)):
    width, height, colors, entry_reserved, planes, bits, length, offset = struct.unpack_from("<BBBBHHII", ico, 6 + i * 16)
    assert (width, height, colors, entry_reserved, planes, bits) == (size, size, 0, 0, 1, 32)
    assert offset == next_offset and offset + length <= len(ico)
    header = struct.unpack_from("<IiiHHIIiiII", ico, offset)
    header_size, dib_width, doubled_height, dib_planes, dib_bits, compression, image_size, xppm, yppm, used, important = header
    assert (header_size, dib_width, doubled_height, dib_planes, dib_bits, compression) == (40, size, size * 2, 1, 32, 0)
    assert (xppm, yppm, used, important) == (0, 0, 0, 0)
    xor_bytes = size * size * 4
    mask_bytes = ((size + 31) // 32) * 4 * size
    assert length == header_size + xor_bytes + mask_bytes
    rgba = bytearray()
    for y in range(size):
        row_start = offset + header_size + (size - 1 - y) * size * 4
        for x in range(size):
            blue, green, red, alpha = ico[row_start + x * 4:row_start + x * 4 + 4]
            rgba.extend((red, green, blue, alpha))
    rgba = bytes(rgba)
    alpha = rgba[3::4]
    assert (min(alpha), max(alpha)) == (0, 255)
    decoded_path = OUT / f"decoded-{size}.png"
    decoded_path.write_bytes(encode_png(size, size, rgba))
    assert decode_png(decoded_path.read_bytes()) == (size, size, rgba)
    frames.append({"width": size, "height": size, "planes": planes, "bits": bits,
                   "bytes": length, "offset": offset, "dibImageBytes": image_size,
                   "maskBytes": mask_bytes, "rgbaSha256": sha(rgba),
                   "alphaMinimum": min(alpha), "alphaMaximum": max(alpha),
                   "decodedPreview": decoded_path.name, "rgba": rgba})
    next_offset = offset + length
assert next_offset == len(ico)

expected = bytearray(64 * 64 * 4)
for y in range(56):
    start = (y * source_width + 4) * 4
    target = ((y + 4) * 64 + 4) * 4
    expected[target:target + 56 * 4] = source_rgba[start:start + 56 * 4]
assert bytes(expected) == frames[0]["rgba"]

sheet_width, sheet_height = 640, 288
sheet = bytearray(sheet_width * sheet_height * 4)
for y in range(sheet_height):
    for x in range(sheet_width):
        shade = 188 if ((x // 8 + y // 8) % 2) else 224
        at = (y * sheet_width + x) * 4
        sheet[at:at + 4] = bytes((shade, shade, shade, 255))
for frame, origin in zip(frames, (16, 288, 448, 576)):
    size = frame["width"]
    scale = 4 if size == 64 else 2
    for y in range(size * scale):
        for x in range(size * scale):
            red, green, blue, alpha = frame["rgba"][((y // scale) * size + x // scale) * 4:((y // scale) * size + x // scale) * 4 + 4]
            at = ((16 + y) * sheet_width + origin + x) * 4
            background = sheet[at]
            sheet[at:at + 4] = bytes(((red * alpha + background * (255 - alpha) + 127) // 255,
                                    (green * alpha + background * (255 - alpha) + 127) // 255,
                                    (blue * alpha + background * (255 - alpha) + 127) // 255, 255))
(OUT / "decoded-preview.png").write_bytes(encode_png(sheet_width, sheet_height, sheet))
for frame in frames:
    del frame["rgba"]

patch = subprocess.run(["git", "diff", "--no-index", "--binary", "--", "/dev/null", "public/favicon.ico"], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
assert patch.returncode == 1 and patch.stderr == b""
(OUT / "product-diff.patch").write_bytes(patch.stdout)
(OUT / "tracked-diff.patch").write_bytes(tracked_diff)

protected_proof = {}
for path in git("ls-tree", "-r", "--name-only", PROOF, "--", "scripts/session-recovery", root=PROOF_ROOT).decode().splitlines():
    pinned_bytes = git("show", PROOF + ":" + path, root=PROOF_ROOT)
    assert (PROOF_ROOT / path).read_bytes() == pinned_bytes
    protected_proof[path] = {"bytes": len(pinned_bytes), "sha256": sha(pinned_bytes),
                             "gitBlob": git("rev-parse", PROOF + ":" + path, root=PROOF_ROOT).decode().strip()}
assert protected_proof

receipt = {
    "kind": "independent-light-favicon-asset-review", "result": "passed",
    "checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "baseProductPin": BASE, "reviewedCandidate": "untracked public/favicon.ico at the recorded base",
    "source": {"path": "public/assets/portrait-orcs.png", "gitBlob": SOURCE_BLOB,
               "bytes": len(source), "sha256": sha(source), "width": source_width, "height": source_height},
    "asset": {"path": "public/favicon.ico", "bytes": len(ico), "sha256": sha(ico), "frames": frames},
    "recipe": "magick public/assets/portrait-orcs.png -crop 56x56+4+0 +repage -background none -gravity center -extent 64x64 -strip -define icon:auto-resize=64,48,32,16 public/favicon.ico",
    "pixelComparison": {"result": "byte-identical", "frame": "64x64",
                        "sourceCrop": {"x": 4, "y": 0, "width": 56, "height": 56},
                        "transparentCanvas": {"width": 64, "height": 64, "placementX": 4, "placementY": 4},
                        "comparedRgbaBytes": len(expected), "rgbaSha256": sha(expected)},
    "scope": {"productChanges": ["public/favicon.ico"], "gitStatus": status_before,
              "trackedDiffEmpty": True, "htmlUnchanged": True,
              "sourceScriptsDocsAndEvidenceUnchanged": True, "reviewWrites": "work/favicon-independent-review only"},
    "protectedProof": {"sourcePin": PROOF, "worktree": str(PROOF_ROOT), "unchanged": True, "files": protected_proof},
    "freeze": "Commit the exact reviewed asset; compare the committed ICO SHA-256 to this receipt. Any future native proof must use the new full committed product pin, fresh preparation and fresh output. Public and compiled asset inventories change. browser-common.mjs hashes src .ts/.css for build ID, so adding this public asset alone need not change build ID. Preserve proof9e5, old failed evidence and the ledger.",
    "limits": "No build, browser, game helper, simulation or native validators ran. Absence of the /favicon.ico 404 remains unverified until authorized live execution. The second old console string remains unattributed.",
    "artifacts": {p.name: fingerprint(p) for p in sorted(OUT.iterdir()) if p.is_file()}
}
(OUT / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
(OUT / "receipt.md").write_text(
    "The independent light asset review passed. The only product change is public/favicon.ico; tracked HTML, source, scripts, documentation and evidence match base " + BASE + ". No asset or scope defect was found.\n\n"
    "The reviewed ICO is 32,038 bytes and has SHA-256 " + ICO_SHA + ". Its 64, 48, 32 and 16 pixel frames decode as valid 32-bit uncompressed DIB icons with transparency, contiguous entries and no trailing data. The actual 64 pixel RGBA frame is byte-identical to the recorded 56 pixel portrait crop on a transparent 64 pixel canvas. The source PNG has SHA-256 " + SOURCE_SHA + " and Git blob " + SOURCE_BLOB + ".\n\n"
    "Decoded previews come from the actual ICO bytes. decoded-preview.png shows the frames left to right at 4x, 2x, 2x and 2x; decoded-64.png, decoded-48.png, decoded-32.png and decoded-16.png retain native dimensions and alpha. product-diff.patch records the sole added binary asset. tracked-diff.patch is empty. audit.py is the standalone comparator; receipt.json includes frame data, hashes and the unchanged proof-file inventory.\n\n"
    "The autosave proof checkout remains at " + PROOF + ", and every scripts/session-recovery file matches that proof commit byte for byte. This review wrote only to its ignored work/favicon-independent-review directory.\n\n"
    "Commit the reviewed ICO and compare its committed SHA-256 to this receipt. Future native proof needs the new full committed product pin, fresh preparation and fresh output because public and compiled asset inventories change. The build ID in scripts/controls-proof/browser-common.mjs hashes only src .ts/.css files, so an unchanged build ID does not establish unchanged assets. Preserve proof9e5, old failed evidence and the ledger.\n\n"
    "No build, browser, game helper, simulation or native validators ran. Live absence of the favicon 404 remains unverified. The second old console string remains unattributed.\n"
)
assert git("status", "--short", "--untracked-files=all").decode() == status_before
assert git("diff", BASE, "--binary") == tracked_diff
inventory = {p.name: fingerprint(p) for p in sorted(OUT.iterdir()) if p.is_file() and p.name != "retained-artifact-hashes.json"}
(OUT / "retained-artifact-hashes.json").write_text(json.dumps(inventory, indent=2) + "\n")
print(json.dumps({"result": "passed", "assetSha256": sha(ico), "decodedFrames": len(frames),
                  "sourcePixelComparison": "byte-identical", "proofFilesUnchanged": len(protected_proof),
                  "retainedDirectory": str(OUT)}, indent=2))
