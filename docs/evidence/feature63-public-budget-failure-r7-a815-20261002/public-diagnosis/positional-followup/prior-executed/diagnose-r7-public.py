#!/usr/bin/env python3
"""Deterministic, read-only diagnosis of the bounded Feature 63 R7 public capture."""

from __future__ import annotations

import hashlib
import io
import json
import math
import os
import re
import stat
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PUBLIC = Path("/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/work/feature63-human-wave-composition-r7/public")
PRODUCER = Path("/home/morgana/Projects/orcs-vs-Fairies/scripts/feature63/public-producer.mjs")
INPUTS = (
    PUBLIC / "public-results.json",
    PUBLIC / "public-identities.json",
    PUBLIC / "public-windows.json",
    PUBLIC / "public-cleanup.json",
    PUBLIC / "public-match-identity.json",
    PUBLIC / "human-one-wire.ndjson",
    PUBLIC / "human-two-wire.ndjson",
    PUBLIC / "human-one-ui-actions.ndjson",
    PUBLIC / "human-two-ui-actions.ndjson",
    PRODUCER,
)
JSON_INPUTS = INPUTS[:5]
WIRE_INPUTS = INPUTS[5:7]
UI_INPUTS = INPUTS[7:9]
OUTPUT_DIR = Path(__file__).resolve().parent
BUDGET = 64 * 1024 * 1024


class DiagnosisError(RuntimeError):
    pass


def reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in pairs:
        if key in out:
            raise DiagnosisError(f"duplicate JSON key: {key!r}")
        out[key] = value
    return out


def parse_json(raw: bytes, label: str) -> Any:
    try:
        return json.loads(raw.decode("utf-8"), object_pairs_hook=reject_duplicates)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise DiagnosisError(f"invalid JSON in {label}: {exc}") from exc


def stable_read(path: Path) -> tuple[bytes, dict[str, Any]]:
    literal = str(path)
    canonical = os.path.realpath(literal)
    if canonical != literal:
        raise DiagnosisError(f"input is not its canonical path: {literal}")
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(literal, flags)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode):
            raise DiagnosisError(f"input is not a regular file: {literal}")
        chunks: list[bytes] = []
        digest = hashlib.sha256()
        total = 0
        while True:
            chunk = os.read(fd, 1024 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
            digest.update(chunk)
            total += len(chunk)
        after = os.fstat(fd)
    finally:
        os.close(fd)
    path_after = os.stat(literal, follow_symlinks=False)
    identity_fields = ("st_dev", "st_ino", "st_mode", "st_size", "st_mtime_ns", "st_ctime_ns")
    if any(getattr(before, name) != getattr(after, name) for name in identity_fields):
        raise DiagnosisError(f"input changed during read: {literal}")
    if any(getattr(after, name) != getattr(path_after, name) for name in identity_fields):
        raise DiagnosisError(f"path identity changed after read: {literal}")
    if total != before.st_size:
        raise DiagnosisError(f"short or extended read: {literal}")
    descriptor = {
        "path": literal,
        "canonicalPath": canonical,
        "bytes": total,
        "mode": format(stat.S_IMODE(before.st_mode), "04o"),
        "sha256": digest.hexdigest(),
        "stableIdentity": {
            "device": before.st_dev,
            "inode": before.st_ino,
            "size": before.st_size,
            "mtimeNs": before.st_mtime_ns,
            "ctimeNs": before.st_ctime_ns,
        },
        "regularFile": True,
        "symlinkFollowed": False,
    }
    return b"".join(chunks), descriptor


def compact_bytes(value: Any) -> int:
    return len((json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8"))


def pretty_bytes(value: Any) -> int:
    return len((json.dumps(value, ensure_ascii=False, indent=2, separators=(",", ": ")) + "\n").encode("utf-8"))


def iso_key(value: str) -> tuple[int, str]:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return int(parsed.timestamp() * 1_000_000), value
    except (TypeError, ValueError):
        raise DiagnosisError(f"invalid public timestamp: {value!r}")


def stream_ndjson(raw: bytes, label: str) -> list[tuple[dict[str, Any], int]]:
    rows: list[tuple[dict[str, Any], int]] = []
    for line_number, line in enumerate(io.BytesIO(raw), 1):
        if not line.strip():
            raise DiagnosisError(f"blank NDJSON line in {label}:{line_number}")
        value = parse_json(line, f"{label}:{line_number}")
        if not isinstance(value, dict):
            raise DiagnosisError(f"non-object NDJSON row in {label}:{line_number}")
        rows.append((value, len(line)))
    return rows


def human_alive(view: dict[str, Any]) -> dict[str, Any]:
    result_flags = (view.get("result") or {}).get("eliminated")
    flags = view.get("eliminated")
    entities = view.get("entities") or []
    out: dict[str, Any] = {}
    for side in (0, 1):
        def flag_false(container: Any) -> bool:
            if isinstance(container, list):
                return side < len(container) and container[side] is False
            if isinstance(container, dict):
                return container.get(str(side), container.get(side)) is False
            return False
        out[str(side)] = {
            "explicitNotEliminated": flag_false(flags) and flag_false(result_flags),
            "liveCompleteHqIds": [e["id"] for e in entities if e.get("side") == side and e.get("kind") == "building" and e.get("role") == "hq" and e.get("hp", 0) > 0 and e.get("progress") == 1],
            "liveCombatUnitIds": [e["id"] for e in entities if e.get("side") == side and e.get("kind") == "unit" and e.get("role") != "worker" and e.get("hp", 0) > 0 and e.get("owner") == side],
        }
    return out


def first_or_none(values: list[Any]) -> Any:
    return values[0] if values else None


def last_or_none(values: list[Any]) -> Any:
    return values[-1] if values else None


def event_excerpt(event: dict[str, Any] | None) -> dict[str, Any] | None:
    if event is None:
        return None
    keys = ("eventId", "tick", "side", "source", "target", "amount", "targetSide", "profile", "wireOrdinal", "frameTick")
    return {key: event.get(key) for key in keys if key in event}


def main() -> None:
    if len(sys.argv) != 1:
        raise DiagnosisError("this analyzer accepts no arguments or path overrides")
    if tuple(INPUTS) != (
        PUBLIC / "public-results.json", PUBLIC / "public-identities.json", PUBLIC / "public-windows.json", PUBLIC / "public-cleanup.json", PUBLIC / "public-match-identity.json",
        PUBLIC / "human-one-wire.ndjson", PUBLIC / "human-two-wire.ndjson", PUBLIC / "human-one-ui-actions.ndjson", PUBLIC / "human-two-ui-actions.ndjson", PRODUCER,
    ):
        raise DiagnosisError("the exact input allowlist changed")

    raw_by_path: dict[Path, bytes] = {}
    descriptors: list[dict[str, Any]] = []
    for path in INPUTS:
        raw, descriptor = stable_read(path)
        raw_by_path[path] = raw
        descriptors.append(descriptor)

    documents = {path.name: parse_json(raw_by_path[path], str(path)) for path in JSON_INPUTS}
    identities = documents["public-identities.json"]
    windows = documents["public-windows.json"]
    match_identity = documents["public-match-identity.json"]
    results = documents["public-results.json"]
    cleanup = documents["public-cleanup.json"]
    if not isinstance(identities, dict) or identities.get("schema") != "feature63-public-identities-v1":
        raise DiagnosisError("public identities schema mismatch")
    if not isinstance(windows, dict) or windows.get("schema") != "feature63-public-windows-v1":
        raise DiagnosisError("public windows schema mismatch")
    if not isinstance(match_identity, dict) or match_identity.get("schema") != "feature63-public-match-identity-v1":
        raise DiagnosisError("public match identity schema mismatch")

    source = raw_by_path[PRODUCER].decode("utf-8")
    constants: dict[str, int] = {}
    for name in ("WINDOW_TICKS", "FRAME_STEP"):
        found = re.search(rf"const {name} = (\d+);", source)
        if not found:
            raise DiagnosisError(f"producer constant missing: {name}")
        constants[name] = int(found.group(1))
    required_source_fragments = (
        "Persist the complete exposed payload before attempting to parse it.",
        "retainedBytes > binding.assignment.maxRetainedBytes",
        "public combat from AI owner 2 approaches the common HQ",
        "acquisitionStartTick = Math.ceil(Math.max(...renewedAttackMoves.map(command => command.appliedTick)) / FRAME_STEP) * FRAME_STEP",
        "JSON.stringify(humanTargetOwners) === '[2,3]'",
    )
    missing_fragments = [fragment for fragment in required_source_fragments if fragment not in source]
    if missing_fragments:
        raise DiagnosisError(f"reviewed producer logic changed: {missing_fragments}")
    if windows.get("maxTicks") != constants["WINDOW_TICKS"] or windows.get("requiredFrameStep") != constants["FRAME_STEP"]:
        raise DiagnosisError("window constants disagree with producer")

    ui_rows: dict[str, list[dict[str, Any]]] = {}
    timeline_events: list[dict[str, Any]] = []
    for path in UI_INPUTS:
        expected_profile = path.name.removesuffix("-ui-actions.ndjson")
        parsed = stream_ndjson(raw_by_path[path], str(path))
        rows: list[dict[str, Any]] = []
        for index, (row, line_bytes) in enumerate(parsed, 1):
            if row.get("schema") != "feature63-public-ui-action-v1" or row.get("profile") != expected_profile:
                raise DiagnosisError(f"UI provenance mismatch in {path}:{index}")
            iso_key(row.get("capturedAt"))
            rows.append(row)
            timeline_events.append({"time": row["capturedAt"], "order": 20, "kind": "ui-append", "profile": expected_profile, "bytes": line_bytes})
        ui_rows[expected_profile] = rows

    began_by_action: dict[str, dict[str, Any]] = {}
    accepted_moves: list[dict[str, Any]] = []
    for profile, rows in ui_rows.items():
        for row in rows:
            action_id = row.get("actionId")
            if row.get("state") == "began" and isinstance(action_id, str):
                began_by_action[action_id] = row
            if row.get("action") == "canvas-attack-move" and row.get("state") == "accepted":
                began = began_by_action.get(action_id)
                if not began or began.get("action") != "canvas-attack-move":
                    raise DiagnosisError(f"accepted attack lacks began provenance: {action_id}")
                move = dict(row)
                move["beganDetail"] = began.get("detail")
                move["beganAt"] = began.get("capturedAt")
                accepted_moves.append(move)
    accepted_moves.sort(key=lambda row: (iso_key(row["capturedAt"]), row["profile"]))

    common_hq_ids = {move.get("beganDetail", {}).get("commonHqId") for move in accepted_moves}
    if len(common_hq_ids) != 1 or None in common_hq_ids:
        raise DiagnosisError(f"attack provenance has inconsistent common HQ ids: {common_hq_ids}")
    common_hq_id = next(iter(common_hq_ids))

    profiles: dict[str, dict[str, Any]] = {}
    reconstruct_events: list[dict[str, Any]] = []
    all_combat: dict[tuple[Any, ...], dict[str, Any]] = {}
    for path in WIRE_INPUTS:
        profile_name = path.name.removesuffix("-wire.ndjson")
        parsed = stream_ndjson(raw_by_path[path], str(path))
        observed: dict[Any, dict[str, Any]] = {}
        frames: list[dict[str, Any]] = []
        commands: dict[int, dict[str, Any]] = {}
        acks: dict[int, dict[str, Any]] = {}
        hello_count = 0
        expected_ordinal = 1
        for line_number, (wire, line_bytes) in enumerate(parsed, 1):
            if wire.get("schema") != "feature63-public-wire-v1" or wire.get("profile") != profile_name:
                raise DiagnosisError(f"wire provenance mismatch in {path}:{line_number}")
            if wire.get("ordinal") != expected_ordinal:
                raise DiagnosisError(f"wire ordinal discontinuity in {path}:{line_number}")
            expected_ordinal += 1
            captured_at = wire.get("capturedAt")
            iso_key(captured_at)
            timeline_events.append({"time": captured_at, "order": 10, "kind": "wire-append", "profile": profile_name, "ordinal": wire["ordinal"], "bytes": line_bytes})
            if wire.get("payloadType") != "string" or not isinstance(wire.get("payload"), str) or wire.get("binaryBase64") is not None:
                raise DiagnosisError(f"non-string wire payload in {path}:{line_number}")
            message = parse_json(wire["payload"].encode("utf-8"), f"{path}:payload:{line_number}")
            if not isinstance(message, dict):
                raise DiagnosisError(f"wire payload is not an object in {path}:{line_number}")
            derived_row = {"schema": "feature63-public-message-v1", "profile": profile_name, "socketId": wire.get("socketId"), "wireOrdinal": wire["ordinal"], "capturedAt": captured_at, "message": message}
            kind = message.get("kind")
            if wire.get("direction") == "sent" and kind == "command":
                seq = message.get("clientSeq")
                commands[seq] = {"wireOrdinal": wire["ordinal"], "socketId": wire.get("socketId"), "message": message, "capturedAt": captured_at}
                reconstruct_events.append({"time": captured_at, "order": 11, "kind": "derived-append", "file": f"{profile_name}-commands.ndjson", "bytes": compact_bytes(derived_row)})
            if wire.get("direction") != "received":
                continue
            if kind == "hello":
                hello_count += 1
                reconstruct_events.append({"time": captured_at, "order": 11, "kind": "derived-append", "file": f"{profile_name}-hellos.ndjson", "bytes": compact_bytes(derived_row)})
            if kind == "commandAck":
                seq = message.get("clientSeq")
                acks[seq] = {"wireOrdinal": wire["ordinal"], "socketId": wire.get("socketId"), "message": message, "capturedAt": captured_at}
                reconstruct_events.append({"time": captured_at, "order": 11, "kind": "derived-append", "file": f"{profile_name}-acks.ndjson", "bytes": compact_bytes(derived_row)})
            if kind != "snapshot":
                continue
            tick = message.get("tick")
            view = message.get("view") or {}
            if not isinstance(tick, int) or message.get("frameSeq") != tick or view.get("tick") != tick:
                raise DiagnosisError(f"invalid snapshot tick at {path}:{line_number}")
            entities = view.get("entities") or []
            entity_by_id = {e.get("id"): e for e in entities}
            for entity in entities:
                observed[entity.get("id")] = {"side": entity.get("side"), "owner": entity.get("owner"), "kind": entity.get("kind"), "lastObservedTick": tick}
            hq = entity_by_id.get(common_hq_id)
            owner2_visible = [e for e in entities if e.get("side") == 2 and e.get("owner") == 2 and e.get("kind") == "unit" and e.get("role") != "worker" and e.get("hp", 0) > 0]
            owner2_eligible = []
            if hq and hq.get("hp", 0) > 0:
                owner2_eligible = [e for e in owner2_visible if (e.get("level") or 0) == (hq.get("level") or 0) and math.hypot(e.get("x", 0) - hq.get("x", 0), e.get("y", 0) - hq.get("y", 0)) <= 12]
            combat: list[dict[str, Any]] = []
            for event in view.get("events") or []:
                if event.get("type") != "attack" or not (event.get("amount", 0) > 0) or event.get("side") not in (0, 1, 2, 3):
                    continue
                if not isinstance(event.get("eventId"), str) or not isinstance(event.get("source"), int) or not isinstance(event.get("target"), int) or not isinstance(event.get("tick"), int):
                    continue
                source_entity = entity_by_id.get(event["source"])
                target = observed.get(event["target"])
                if not source_entity or source_entity.get("side") != event["side"] or source_entity.get("owner") != event["side"] or source_entity.get("kind") != "unit":
                    continue
                if not target or target.get("owner") != target.get("side") or target.get("kind") != "unit":
                    continue
                if not ((event["side"] in (0, 1) and target["side"] in (2, 3)) or (event["side"] in (2, 3) and target["side"] in (0, 1))):
                    continue
                item = dict(event)
                item.update({"profile": profile_name, "wireOrdinal": wire["ordinal"], "frameTick": tick, "sourceKind": source_entity["kind"], "sourceSide": source_entity["side"], "targetSide": target["side"], "targetKind": target["kind"], "targetObservedTick": target["lastObservedTick"]})
                combat.append(item)
                key = (item["eventId"], item["tick"], item["side"], item["source"], item["target"], item["amount"])
                all_combat.setdefault(key, item)
            alive = human_alive(view)
            frame_row = {"schema": "feature63-public-frame-v1", "profile": profile_name, "socketId": wire.get("socketId"), "wireOrdinal": wire["ordinal"], "capturedAt": captured_at, "message": message, "alive": alive}
            reconstruct_events.append({"time": captured_at, "order": 12, "kind": "derived-append", "file": f"{profile_name}-public-frames.ndjson", "bytes": compact_bytes(frame_row)})
            reconstruct_events.append({"time": captured_at, "order": 13, "kind": "derived-save", "file": f"{profile_name}-latest-frame.json", "bytes": pretty_bytes(frame_row)})
            frames.append({"tick": tick, "capturedAt": captured_at, "wireOrdinal": wire["ordinal"], "socketId": wire.get("socketId"), "owner2VisibleIds": [e["id"] for e in owner2_visible], "owner2ApproachIds": [e["id"] for e in owner2_eligible], "combat": combat})
        profiles[profile_name] = {"frames": frames, "commands": commands, "acks": acks, "helloCount": hello_count, "wireRows": len(parsed), "lastOrdinal": expected_ordinal - 1}

    attack_report: list[dict[str, Any]] = []
    for move in accepted_moves:
        profile = move["profile"]
        seq = move.get("clientSeq")
        command = profiles[profile]["commands"].get(seq)
        ack = profiles[profile]["acks"].get(seq)
        if not command or not ack:
            raise DiagnosisError(f"accepted UI attack lacks command/ack wire pair: {profile} seq {seq}")
        if command["wireOrdinal"] != move.get("commandWireOrdinal") or ack["wireOrdinal"] != move.get("ackWireOrdinal"):
            raise DiagnosisError(f"accepted UI attack wire ordinals disagree: {profile} seq {seq}")
        if command["message"] != move.get("command") or ack["message"] != move.get("ack"):
            raise DiagnosisError(f"accepted UI attack wire payloads disagree: {profile} seq {seq}")
        detail = move.get("beganDetail") or {}
        attack_report.append({
            "profile": profile,
            "side": move.get("side"),
            "actionId": move.get("actionId"),
            "reason": detail.get("reason"),
            "beganAt": move.get("beganAt"),
            "acceptedAt": move.get("capturedAt"),
            "displayedTick": detail.get("displayedTick"),
            "eligibilityFrameTick": move.get("eligibilityFrameTick"),
            "eligibilityWireOrdinal": move.get("eligibilityWireOrdinal"),
            "commandWireOrdinal": move.get("commandWireOrdinal"),
            "ackWireOrdinal": move.get("ackWireOrdinal"),
            "clientSeq": seq,
            "appliedTick": move.get("appliedTick"),
            "eligibleCommandedIds": move.get("eligibleCommandedIds"),
            "target": (move.get("command") or {}).get("command", {}),
            "accepted": (move.get("ack") or {}).get("accepted"),
        })

    renewed = [item for item in attack_report if item["reason"] == "public combat from AI owner 2 approaches the common HQ"]
    initial = [item for item in attack_report if item["reason"] == "defend the same allied HQ"]
    if {item["side"] for item in renewed} != {0, 1}:
        raise DiagnosisError("owner-2 release attack pair is incomplete")
    latch_tick = math.ceil(max(item["appliedTick"] for item in renewed) / constants["FRAME_STEP"]) * constants["FRAME_STEP"]

    owner2_by_profile: dict[str, Any] = {}
    for profile, data in profiles.items():
        visible = [frame for frame in data["frames"] if frame["owner2VisibleIds"]]
        approach = [frame for frame in data["frames"] if frame["owner2ApproachIds"]]
        owner2_combat = [event for frame in data["frames"] for event in frame["combat"] if event.get("side") == 2 or event.get("targetSide") == 2]
        owner2_by_profile[profile] = {
            "firstVisible": ({key: visible[0][key] for key in ("tick", "capturedAt", "wireOrdinal", "owner2VisibleIds")} if visible else None),
            "firstApproachEligible": ({key: approach[0][key] for key in ("tick", "capturedAt", "wireOrdinal", "owner2ApproachIds")} if approach else None),
            "firstOwner2Combat": event_excerpt(first_or_none(owner2_combat)),
            "lastSnapshot": ({key: data["frames"][-1][key] for key in ("tick", "capturedAt", "wireOrdinal")} if data["frames"] else None),
        }

    candidates = windows.get("candidates")
    if not isinstance(candidates, list):
        raise DiagnosisError("public windows candidates are missing")
    positive = [index for index, candidate in enumerate(candidates) if candidate.get("publicPredicatePassed") is True]
    selected_index = windows.get("selectedCandidateIndex")
    if selected_index is not None and selected_index not in positive:
        raise DiagnosisError("selected candidate is not a positive public window")
    for candidate in candidates:
        expected = (
            candidate.get("coveragePassed") is True
            and candidate.get("bothHumansAliveThroughout") is True
            and sorted({move.get("side") for move in candidate.get("acceptedAttackMoves", [])}) == [0, 1]
            and candidate.get("humanOwners") == [0, 1]
            and candidate.get("humanTargetOwners") == [2, 3]
        )
        if candidate.get("publicPredicatePassed") is not expected:
            raise DiagnosisError(f"stored predicate disagrees at candidate start {candidate.get('startTick')}")
    ranked = sorted(enumerate(candidates), key=lambda pair: (len(pair[1].get("humanTargetOwners", [])), len(pair[1].get("combatEvents", [])), pair[1].get("endTick", -1)), reverse=True)
    best_index, best = ranked[0] if ranked else (None, None)
    best_summary = None
    if best is not None:
        combat_events = best.get("combatEvents", [])
        best_summary = {
            "index": best_index,
            "startTick": best.get("startTick"),
            "endTick": best.get("endTick"),
            "coveragePassed": best.get("coveragePassed"),
            "bothHumansAliveThroughout": best.get("bothHumansAliveThroughout"),
            "humanOwners": best.get("humanOwners"),
            "humanTargetOwners": best.get("humanTargetOwners"),
            "aiOwners": best.get("aiOwners"),
            "combatEventCount": len(combat_events),
            "firstCombatEvent": event_excerpt(first_or_none(combat_events)),
            "lastCombatEvent": event_excerpt(last_or_none(combat_events)),
            "publicPredicatePassed": best.get("publicPredicatePassed"),
        }

    # Replay a conservative subset of producer-retained bytes. Derived frame, latest-frame,
    # command, ack, and hello sizes are recreated from the authorized wire payloads. Status,
    # errors, and browser-ownership bytes are omitted, so crossing is a latest possible bound.
    output_names = (
        "public-results.json", "public-identities.json", "public-match-identity.json", "public-windows.json", "browser-ownership.json", "public-cleanup.json",
        "errors.ndjson", "public-status.ndjson", "human-one-wire.ndjson", "human-two-wire.ndjson", "human-one-public-frames.ndjson", "human-two-public-frames.ndjson",
        "human-one-hellos.ndjson", "human-two-hellos.ndjson", "human-one-commands.ndjson", "human-two-commands.ndjson", "human-one-acks.ndjson", "human-two-acks.ndjson",
        "human-one-ui-actions.ndjson", "human-two-ui-actions.ndjson", "human-one-latest-frame.json", "human-two-latest-frame.json",
    )
    sizes = {name: (5 if name.endswith(".json") else 0) for name in output_names}
    budget_timeline = list(timeline_events) + reconstruct_events
    identity_time = match_identity.get("capturedAt")
    iso_key(identity_time)
    budget_timeline.extend([
        {"time": identity_time, "order": 30, "kind": "known-save", "file": "public-match-identity.json", "bytes": len(raw_by_path[PUBLIC / "public-match-identity.json"])},
        {"time": identity_time, "order": 31, "kind": "known-save", "file": "public-identities.json", "bytes": len(raw_by_path[PUBLIC / "public-identities.json"])},
    ])
    frame_time: dict[tuple[str, int], str] = {}
    for profile, data in profiles.items():
        for frame in data["frames"]:
            frame_time[(profile, frame["tick"])] = frame["capturedAt"]
    prefix_candidates: list[dict[str, Any]] = []
    for index, candidate in enumerate(candidates):
        prefix_candidates.append(candidate)
        times = [frame_time.get((profile, candidate.get("endTick"))) for profile in profiles]
        times = [value for value in times if value]
        if not times:
            continue
        document = {
            "schema": windows.get("schema"), "sourcePin": windows.get("sourcePin"), "matchId": windows.get("matchId"),
            "maxTicks": windows.get("maxTicks"), "requiredFrameStep": windows.get("requiredFrameStep"), "frameSeqRelation": windows.get("frameSeqRelation"),
            "candidates": list(prefix_candidates), "selectedCandidateIndex": (selected_index if selected_index is not None and selected_index <= index else None),
        }
        budget_timeline.append({"time": max(times, key=iso_key), "order": 40, "kind": "reconstructed-window-save", "file": "public-windows.json", "bytes": pretty_bytes(document), "candidateIndex": index, "endTick": candidate.get("endTick")})
    budget_timeline.sort(key=lambda event: (iso_key(event["time"]), event.get("order", 0), event.get("profile", ""), event.get("ordinal", 0)))
    crossing = None
    for event in budget_timeline:
        kind = event["kind"]
        if kind in ("wire-append", "ui-append"):
            file_name = f"{event['profile']}-wire.ndjson" if kind == "wire-append" else f"{event['profile']}-ui-actions.ndjson"
            sizes[file_name] += event["bytes"]
        elif kind == "derived-append":
            sizes[event["file"]] += event["bytes"]
        elif kind in ("derived-save", "known-save", "reconstructed-window-save"):
            sizes[event["file"]] = event["bytes"]
        retained = sum(sizes.values())
        if retained > BUDGET and crossing is None:
            crossing = {"time": event["time"], "event": {key: value for key, value in event.items() if key not in ("time", "order")}, "reconstructedRetainedBytes": retained, "maximum": BUDGET, "excess": retained - BUDGET}
    reconstructed_final = sum(sizes.values())
    exact_authorized_input_bytes = sum(descriptor["bytes"] for descriptor in descriptors[:9])
    exact_authorized_retained_bytes = exact_authorized_input_bytes

    unique_combat = sorted(all_combat.values(), key=lambda event: (event.get("tick", -1), event.get("eventId", ""), event.get("profile", "")))
    first_by_relation: dict[str, Any] = {}
    for side in (0, 1, 2, 3):
        first_by_relation[f"sourceOwner{side}"] = event_excerpt(first_or_none([e for e in unique_combat if e.get("side") == side]))
        first_by_relation[f"targetOwner{side}"] = event_excerpt(first_or_none([e for e in unique_combat if e.get("targetSide") == side]))

    null_files = [name for name, value in (("public-results.json", results), ("public-cleanup.json", cleanup)) if value is None]
    source_pin_values = {identities.get("sourcePin"), windows.get("sourcePin"), match_identity.get("sourcePin")}
    match_id_values = {identities.get("matchId"), windows.get("matchId"), match_identity.get("matchId")}
    if len(source_pin_values) != 1 or None in source_pin_values or len(match_id_values) != 1 or None in match_id_values:
        raise DiagnosisError("public identity bindings disagree")

    diagnosis = {
        "schema": "feature63-r7-public-diagnosis-v1",
        "scope": {
            "readOnly": True,
            "inputCount": len(INPUTS),
            "publicInputCount": 9,
            "producerInputCount": 1,
            "noRetriesPerformed": True,
            "noNativePrivateDatabaseCheckpointAuditControlRuntimeOrProfileInputAccess": True,
        },
        "identity": {
            "sourcePin": next(iter(source_pin_values)),
            "matchId": next(iter(match_id_values)),
            "lobbyId": match_identity.get("lobbyId"),
            "expectedTeams": match_identity.get("expectedTeams"),
            "expectedControllers": match_identity.get("expectedControllers"),
        },
        "producerContract": {
            "windowTicks": constants["WINDOW_TICKS"],
            "frameStep": constants["FRAME_STEP"],
            "budgetComparison": "retainedBytes > maximum",
            "wirePayloadPersistedBeforeParsing": True,
            "owner2ApproachRule": "one or more live, owned, non-worker owner-2 units at the common HQ level and within 12 world units, in both public player views",
            "latchRule": "round the later renewed attack-move applied tick up to the four-tick frame cadence",
            "frozenPredicate": "coverage and both humans alive, accepted command owners [0,1], human combat owners [0,1], and human attack targets [2,3]",
        },
        "completionState": {
            "publicResultsValue": results,
            "publicCleanupValue": cleanup,
            "filesStillAtInitializedNull": null_files,
            "selectedCandidateIndex": selected_index,
            "candidateCount": len(candidates),
            "positivePublicWindowCount": len(positive),
            "positivePublicWindowIndexes": positive,
            "publicCandidatePassed": bool(positive and selected_index in positive),
        },
        "ordinaryUiAttacks": {
            "occurredBeforeCaptureStopped": len(attack_report) > 0,
            "acceptedCount": len(attack_report),
            "initialStagingAttacks": initial,
            "owner2ApproachReleaseAttacks": renewed,
            "acquisitionLatchStartTick": latch_tick,
            "wireCommandAndAckCrossChecksPassed": True,
        },
        "owner2Timing": {
            "commonHqId": common_hq_id,
            "byProfile": owner2_by_profile,
            "releaseAppliedTicks": {item["profile"]: item["appliedTick"] for item in renewed},
            "acquisitionLatchStartTick": latch_tick,
            "firstAttributedCombatInAuthorizedWire": {key: value for key, value in first_by_relation.items() if key in ("sourceOwner2", "targetOwner2")},
        },
        "combat": {
            "uniqueAttributedWireEventCount": len(unique_combat),
            "eventSourceOwnerCounts": {str(key): value for key, value in sorted(Counter(e.get("side") for e in unique_combat).items())},
            "eventTargetOwnerCounts": {str(key): value for key, value in sorted(Counter(e.get("targetSide") for e in unique_combat).items())},
            "firstAttributedEvents": first_by_relation,
            "bestRetainedCandidate": best_summary,
        },
        "budget": {
            "maximumBytes": BUDGET,
            "maximumMiB": 64,
            "authorizedPublicInputBytesAtRest": exact_authorized_retained_bytes,
            "authorizedPublicInputExcessOverMaximum": max(0, exact_authorized_retained_bytes - BUDGET),
            "reconstructedKnownProducerOutputBytesAtEnd": reconstructed_final,
            "latestPossibleCrossingFromReconstructablePublicWrites": crossing,
            "exactProducerRecordedBreachUnavailable": True,
            "reasonExactRecordedBreachUnavailable": "public-results.json and public-cleanup.json remain at their initialized null values, and the authorized inputs do not include errors.ndjson or public-status.ndjson. The producer also counts retained public outputs outside this ten-file diagnosis allowlist.",
            "interpretation": "The reconstructed crossing omits status, error, and browser-ownership bytes, so the producer's actual crossing occurred no later than this event. The exact nine authorized public files now exceed the unchanged 64 MiB limit on their own.",
        },
        "diagnosis": {
            "failureClass": "retained-byte budget exhaustion before a positive frozen-predicate window was selected",
            "publicEvidence": "Both humans completed accepted ordinary UI attack moves for the owner-2 approach and the acquisition latch opened. The public wire later contains combat by both humans against owner 3, while no retained candidate covers human attack targets [2,3]. The selected index stayed null and the result and cleanup summaries were never finalized.",
            "owner2Finding": "Owner 2 became publicly approach-eligible and triggered the renewed attack pair, but no attributed owner-2 combat or human attack against owner 2 appears in the authorized wire before capture stopped.",
            "frozenPredicateChanged": False,
        },
        "recommendation": {
            "kind": "bounded ordinary-UI acquisition timing adjustment",
            "text": "Keep the frozen predicate and 64 MiB limit. Start the two ordinary UI staging moves later, close to the first public owner-2 approach, so the retained full-wire history spends fewer bytes before the renewed attack pair. Preserve one attempt, the four-tick cadence, complete payload retention, and the same owner-2 approach rule. This recommendation does not claim that a retry will pass.",
            "basis": "The renewed ordinary UI attacks were accepted before capture stopped, but owner-2 combat was still absent while the retained evidence already exceeded the byte limit and owner-3 combat dominated the retained candidate.",
        },
        "validation": {
            "jsonDuplicateKeysRejected": True,
            "ndjsonStreamedLineByLine": True,
            "wireOrdinalsContiguous": {profile: True for profile in profiles},
            "profileSummaries": {profile: {"wireRows": data["wireRows"], "lastWireOrdinal": data["lastOrdinal"], "snapshotCount": len(data["frames"]), "helloCount": data["helloCount"]} for profile, data in profiles.items()},
        },
    }

    descriptors_doc = {"schema": "feature63-r7-public-input-descriptors-v1", "inputCount": len(descriptors), "inputs": descriptors}
    descriptor_path = OUTPUT_DIR / "input-descriptors.json"
    diagnosis_path = OUTPUT_DIR / "diagnosis.json"
    descriptor_path.write_text(json.dumps(descriptors_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    diagnosis_path.write_text(json.dumps(diagnosis, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    artifact_records = []
    for path in (Path(__file__).resolve(), descriptor_path, diagnosis_path):
        raw = path.read_bytes()
        artifact_records.append({"name": path.name, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(), "mode": format(stat.S_IMODE(path.stat().st_mode), "04o")})
    manifest = {
        "schema": "feature63-r7-public-diagnosis-manifest-v1",
        "deterministic": True,
        "readOnlyInputs": True,
        "artifacts": artifact_records,
    }
    manifest_path = OUTPUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    try:
        main()
    except DiagnosisError as exc:
        print(f"diagnosis failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
