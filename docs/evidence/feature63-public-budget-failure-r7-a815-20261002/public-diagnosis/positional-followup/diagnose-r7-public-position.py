#!/usr/bin/env python3
"""Read-only positional follow-up for the Feature 63 R7 public capture."""

from __future__ import annotations

import hashlib
import io
import json
import math
import os
import stat
import sys
from collections import Counter
from pathlib import Path
from typing import Any


PUBLIC = Path("/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/work/feature63-human-wave-composition-r7/public")
PRODUCER = Path("/home/morgana/Projects/orcs-vs-Fairies/scripts/feature63/public-producer.mjs")
INPUTS = (
    PUBLIC / "human-one-wire.ndjson",
    PUBLIC / "human-two-wire.ndjson",
    PUBLIC / "human-one-ui-actions.ndjson",
    PUBLIC / "human-two-ui-actions.ndjson",
    PUBLIC / "public-status.ndjson",
    PUBLIC / "errors.ndjson",
    PRODUCER,
)
OUT = Path(__file__).resolve().parent
TICKS = (1652, 1708, 1876, 2148, 2300)


class Failure(RuntimeError):
    pass


def no_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise Failure(f"duplicate JSON key {key!r}")
        result[key] = value
    return result


def decode(raw: bytes, label: str) -> Any:
    try:
        return json.loads(raw.decode("utf-8"), object_pairs_hook=no_duplicates)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise Failure(f"invalid JSON in {label}: {exc}") from exc


def stable_read(path: Path) -> tuple[bytes, dict[str, Any]]:
    literal = str(path)
    if os.path.realpath(literal) != literal:
        raise Failure(f"non-canonical input path: {literal}")
    fd = os.open(literal, os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0))
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode):
            raise Failure(f"not a regular file: {literal}")
        chunks: list[bytes] = []
        digest = hashlib.sha256()
        while True:
            chunk = os.read(fd, 1024 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
            digest.update(chunk)
        after = os.fstat(fd)
    finally:
        os.close(fd)
    current = os.stat(literal, follow_symlinks=False)
    fields = ("st_dev", "st_ino", "st_mode", "st_size", "st_mtime_ns", "st_ctime_ns")
    if any(getattr(before, field) != getattr(after, field) or getattr(after, field) != getattr(current, field) for field in fields):
        raise Failure(f"input identity changed while reading: {literal}")
    raw = b"".join(chunks)
    if len(raw) != before.st_size:
        raise Failure(f"input size changed while reading: {literal}")
    return raw, {
        "path": literal,
        "canonicalPath": literal,
        "bytes": len(raw),
        "mode": format(stat.S_IMODE(before.st_mode), "04o"),
        "sha256": digest.hexdigest(),
        "stableIdentity": {"device": before.st_dev, "inode": before.st_ino, "size": before.st_size, "mtimeNs": before.st_mtime_ns, "ctimeNs": before.st_ctime_ns},
        "regularFile": True,
        "symlinkFollowed": False,
    }


def ndjson(raw: bytes, label: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for number, line in enumerate(io.BytesIO(raw), 1):
        if not line.strip():
            raise Failure(f"blank NDJSON row in {label}:{number}")
        value = decode(line, f"{label}:{number}")
        if not isinstance(value, dict):
            raise Failure(f"non-object NDJSON row in {label}:{number}")
        rows.append(value)
    return rows


def point(entity: dict[str, Any]) -> dict[str, float]:
    return {"x": entity["x"], "y": entity["y"]}


def distance(first: dict[str, Any], second: dict[str, Any]) -> float:
    return math.hypot(first["x"] - second["x"], first["y"] - second["y"])


def actor(entity: dict[str, Any], attack_range: float | None) -> dict[str, Any]:
    order = entity.get("order")
    return {
        "id": entity.get("id"), "side": entity.get("side"), "owner": entity.get("owner"), "role": entity.get("role"),
        "position": point(entity), "hp": entity.get("hp"), "maxHp": entity.get("maxHp"), "order": order,
        "animation": entity.get("animation"), "publicBaseAttackRange": attack_range,
    }


def event_excerpt(event: dict[str, Any]) -> dict[str, Any]:
    keys = ("eventId", "tick", "side", "source", "target", "amount", "targetSide", "frameTick", "wireOrdinal", "profile")
    return {key: event.get(key) for key in keys if key in event}


def main() -> None:
    if len(sys.argv) != 1:
        raise Failure("no arguments or path overrides are accepted")
    raw: dict[Path, bytes] = {}
    descriptors = []
    for path in INPUTS:
        value, descriptor = stable_read(path)
        raw[path] = value
        descriptors.append(descriptor)

    producer_text = raw[PRODUCER].decode("utf-8")
    for fragment in ("publicApproach(profile, commonHq.id)", "public combat from AI owner 2 approaches the common HQ", "groundTarget(approach.hq, hostile"):
        if fragment not in producer_text:
            raise Failure(f"producer logic fragment missing: {fragment}")

    ui: dict[str, list[dict[str, Any]]] = {}
    for profile in ("human-one", "human-two"):
        rows = ndjson(raw[PUBLIC / f"{profile}-ui-actions.ndjson"], profile)
        if any(row.get("profile") != profile for row in rows):
            raise Failure(f"UI profile mismatch for {profile}")
        ui[profile] = rows
    accepted = []
    began = {}
    for rows in ui.values():
        for row in rows:
            if row.get("state") == "began":
                began[row.get("actionId")] = row
            if row.get("action") == "canvas-attack-move" and row.get("state") == "accepted":
                item = dict(row)
                item["detail"] = began.get(row.get("actionId"), {}).get("detail")
                accepted.append(item)
    renewed = [row for row in accepted if row.get("detail", {}).get("reason") == "public combat from AI owner 2 approaches the common HQ"]
    if len(renewed) != 2 or {row.get("side") for row in renewed} != {0, 1}:
        raise Failure("renewed public attack pair is incomplete")
    commanded_ids = {row["side"]: row["eligibleCommandedIds"] for row in renewed}
    target_points = {(row["command"]["command"]["x"], row["command"]["command"]["y"]) for row in renewed}
    if len(target_points) != 1:
        raise Failure("renewed attacks do not share one ground target")
    release_target = {"x": next(iter(target_points))[0], "y": next(iter(target_points))[1]}

    status_rows = ndjson(raw[PUBLIC / "public-status.ndjson"], "public-status.ndjson")
    error_rows = ndjson(raw[PUBLIC / "errors.ndjson"], "errors.ndjson") if raw[PUBLIC / "errors.ndjson"] else []
    approach_status = [row for row in status_rows if row.get("action") == "public-ai-owner-2-combat-observed"]
    latch_status = [row for row in status_rows if row.get("action") == "public-ai-owner-2-approach-acquisition-latched"]
    if len(approach_status) != 1 or len(latch_status) != 1:
        raise Failure("public approach/latch status records are incomplete")

    profiles: dict[str, Any] = {}
    public_stats: dict[str, Any] = {}
    unique_events: dict[tuple[Any, ...], dict[str, Any]] = {}
    owner2_spans: dict[int, list[dict[str, Any]]] = {}
    match_ids = set()
    for profile in ("human-one", "human-two"):
        rows = ndjson(raw[PUBLIC / f"{profile}-wire.ndjson"], f"{profile}-wire.ndjson")
        observed: dict[int, dict[str, Any]] = {}
        frames: dict[int, dict[str, Any]] = {}
        expected = 1
        for wire in rows:
            if wire.get("profile") != profile or wire.get("ordinal") != expected:
                raise Failure(f"wire provenance/ordinal mismatch for {profile} at {expected}")
            expected += 1
            message = decode(wire["payload"].encode("utf-8"), f"{profile} wire payload {wire['ordinal']}")
            if message.get("matchId"):
                match_ids.add(message["matchId"])
            if message.get("kind") != "snapshot":
                continue
            tick = message["tick"]
            view = message["view"]
            entities = view.get("entities", [])
            by_id = {entity["id"]: entity for entity in entities}
            for entity in entities:
                observed[entity["id"]] = {"side": entity.get("side"), "owner": entity.get("owner"), "kind": entity.get("kind"), "lastObservedTick": tick}
                if entity.get("side") == 2 and entity.get("owner") == 2 and entity.get("kind") == "unit":
                    owner2_spans.setdefault(entity["id"], []).append({"profile": profile, "tick": tick, "wireOrdinal": wire["ordinal"], "entity": entity})
            faction = (view.get("content") or {}).get("faction") or {}
            units = faction.get("units") or {}
            public_stats[faction.get("id", profile)] = {role: {key: definition.get(key) for key in ("id", "name", "role", "hp", "damage", "range", "speed", "sight")} for role, definition in units.items()}
            for raw_event in view.get("events", []):
                if raw_event.get("type") != "attack" or not isinstance(raw_event.get("eventId"), str):
                    continue
                source = by_id.get(raw_event.get("source"))
                target = observed.get(raw_event.get("target"))
                event = dict(raw_event)
                event.update({"profile": profile, "frameTick": tick, "wireOrdinal": wire["ordinal"], "sourceRole": source.get("role") if source else None, "targetSide": target.get("side") if target else None, "targetOwner": target.get("owner") if target else None})
                key = (event["eventId"], event.get("tick"), event.get("source"), event.get("target"), event.get("amount"))
                previous = unique_events.get(key)
                if previous is None or (previous.get("targetSide") is None and event.get("targetSide") is not None):
                    unique_events[key] = event
            if tick in TICKS or tick in (1644, 1668, 1864, 1884):
                frames[tick] = {"tick": tick, "wireOrdinal": wire["ordinal"], "capturedAt": wire["capturedAt"], "entities": by_id}
        profiles[profile] = {"frames": frames, "wireRows": len(rows), "lastOrdinal": expected - 1}
    if len(match_ids) != 1:
        raise Failure(f"public wire match ids disagree: {match_ids}")

    ranges = {
        7: public_stats["orcs"]["melee"]["range"],
        14: public_stats["fairies"]["melee"]["range"],
        21: public_stats["orcs"]["melee"]["range"],
        91: public_stats["orcs"]["ranged"]["range"],
    }
    requested_frames = []
    own_profile_for_actor = {7: "human-one", 14: "human-two"}
    for tick in TICKS:
        common = profiles["human-one"]["frames"][tick]
        owner2 = [entity for entity in common["entities"].values() if entity.get("side") == 2 and entity.get("owner") == 2 and entity.get("kind") == "unit"]
        humans = []
        for actor_id, own_profile in own_profile_for_actor.items():
            own_frame = profiles[own_profile]["frames"][tick]
            entity = own_frame["entities"].get(actor_id)
            if entity is None:
                raise Failure(f"commanded human actor {actor_id} missing at tick {tick}")
            distances = []
            for enemy in owner2:
                measured = distance(entity, enemy)
                distances.append({
                    "owner2Id": enemy["id"], "distance": measured, "humanBaseRange": ranges[actor_id],
                    "distanceBeyondHumanBaseRange": measured - ranges[actor_id], "owner2BaseRange": ranges.get(enemy["id"]),
                    "withinHumanBaseRange": measured <= ranges[actor_id], "withinOwner2BaseRange": (measured <= ranges[enemy["id"]] if enemy["id"] in ranges else None),
                })
            humans.append({"actor": actor(entity, ranges[actor_id]), "ownViewProfile": own_profile, "ownViewWireOrdinal": own_frame["wireOrdinal"], "distanceToReleaseGroundTarget": distance(entity, release_target), "distancesToVisibleOwner2": distances})
        requested_frames.append({
            "tick": tick,
            "sharedPublicView": {"profile": "human-one", "wireOrdinal": common["wireOrdinal"], "capturedAt": common["capturedAt"]},
            "commandedHumans": humans,
            "visibleOwner2": [actor(enemy, ranges.get(enemy["id"])) for enemy in owner2],
        })

    spans = []
    for entity_id, rows in sorted(owner2_spans.items()):
        distinct = {(row["tick"], row["wireOrdinal"], row["profile"]): row for row in rows}
        by_profile = {}
        for profile in profiles:
            values = sorted([row for row in distinct.values() if row["profile"] == profile], key=lambda row: row["tick"])
            if values:
                by_profile[profile] = {"firstTick": values[0]["tick"], "firstWireOrdinal": values[0]["wireOrdinal"], "lastTick": values[-1]["tick"], "lastWireOrdinal": values[-1]["wireOrdinal"], "frameCount": len(values)}
        sample = rows[0]["entity"]
        spans.append({"id": entity_id, "side": sample.get("side"), "owner": sample.get("owner"), "role": sample.get("role"), "hp": sample.get("hp"), "maxHp": sample.get("maxHp"), "publicBaseAttackRange": ranges.get(entity_id), "visibilityByProfile": by_profile})

    events = sorted(unique_events.values(), key=lambda event: (event.get("tick", -1), event.get("eventId", "")))
    owner2_events = [event for event in events if event.get("side") == 2 or event.get("targetSide") == 2]
    commanded_attacks = {}
    for actor_id in (7, 14):
        raw_attacks = [event for event in events if event.get("source") == actor_id]
        attributed = [event for event in raw_attacks if event.get("targetSide") is not None]
        commanded_attacks[str(actor_id)] = {
            "rawEventCount": len(raw_attacks),
            "fullyAttributedEventCount": len(attributed),
            "targetOwnerCounts": {str(key): value for key, value in sorted(Counter(event["targetSide"] for event in attributed).items())},
            "first": event_excerpt(raw_attacks[0]) if raw_attacks else None,
            "last": event_excerpt(raw_attacks[-1]) if raw_attacks else None,
        }
    other_owner0 = [event for event in events if event.get("side") == 0 and event.get("source") != 7]

    renewal_report = []
    for row in sorted(renewed, key=lambda item: item["side"]):
        renewal_report.append({
            "profile": row["profile"], "side": row["side"], "actionId": row["actionId"], "eligibleCommandedIds": row["eligibleCommandedIds"],
            "eligibilityFrameTick": row["eligibilityFrameTick"], "commandWireOrdinal": row["commandWireOrdinal"], "ackWireOrdinal": row["ackWireOrdinal"],
            "appliedTick": row["appliedTick"], "groundTarget": release_target, "accepted": row["ack"]["accepted"],
        })

    report = {
        "schema": "feature63-r7-public-positional-followup-v1",
        "scope": {
            "readOnly": True, "inputCount": len(INPUTS), "noRetryOrImplementation": True,
            "noDatabaseCheckpointRuntimeNativeAuditPrivateOrProfileInputAccess": True,
            "originalFrozenDiagnosisReadOrModified": False,
        },
        "identity": {"matchId": next(iter(match_ids))},
        "publicStatus": {"approach": approach_status[0], "latch": latch_status[0], "errorRowCount": len(error_rows)},
        "renewedOrdinaryUiAttacks": {"sharedGroundTarget": release_target, "commands": renewal_report, "commandedIdsBySide": {str(key): value for key, value in commanded_ids.items()}},
        "publicUnitDefinitions": {
            "commandedHuman7": public_stats["orcs"]["melee"],
            "commandedHuman14": public_stats["fairies"]["melee"],
            "owner2Melee21": public_stats["orcs"]["melee"],
            "owner2Ranged91": public_stats["orcs"]["ranged"],
            "interpretation": "Ranges are base ranges exposed in each public snapshot's content definition. The report does not infer hidden modifiers.",
        },
        "requestedTicks": requested_frames,
        "owner2PublicVisibility": spans,
        "combat": {
            "owner2RelatedEvents": [event_excerpt(event) for event in owner2_events],
            "commandedHumanAttackEvents": commanded_attacks,
            "otherOwner0AttackEventsExcludedFromCommandedActorProof": {"count": len(other_owner0), "sourceIds": sorted({event.get("source") for event in other_owner0}), "first": event_excerpt(other_owner0[0]) if other_owner0 else None},
        },
        "findings": {
            "whyOwner2Melee21WasNotHit": "Owner-2 melee 21 was visible only from ticks 1644 through 1668. The first renewed attack applied at tick 1676 and the second at tick 1705, after 21 had left both public views. The ordinary attackMove targeted a ground point, not entity 21. By tick 1708 actor 7 was idle 0.63 units from that point and actor 14 still had the attackMove order 1.69 units away, while no owner-2 unit was publicly visible.",
            "laterOwner2Ranged91": "Owner-2 ranged 91 was visible from ticks 1864 through 1884. At tick 1876 it was 6.53 units from actor 7 and 6.41 units from actor 14. Public base ranges are 1.4 and 1.5 for the humans and 6.5 for ranged 91. Event a30885d0-e1d4-4056-add3-8d96d7d8a3d2 records 91 attacking 14 at event tick 1873 for 19 damage. Both humans were idle in their own public views at tick 1876.",
            "commandedActorAttribution": "Commanded actor 7 produced seven public attack events and commanded actor 14 produced nine; every fully attributed target was owner 3. Aggregate owner-0 events from source 5 are excluded because source 5 was not in the accepted command's eligibleCommandedIds.",
            "nativeMembership": "The public data authenticates owner, side, role, position, health, visibility, and one attack event. It does not identify whether owner-2 units 21 or 91 belonged to the same native coordinated wave. Unit 21 may have been a scout or another ordinary AI actor; that cannot be decided from public evidence.",
        },
        "boundedRecommendation": {
            "text": "A second ordinary UI attackMove issued while ranged owner-2 unit 91 was publicly visible, with a ground target near its current public position, could have moved actors 7 and 14 inside their 1.4 and 1.5 base ranges. This is plausible because 91 stayed about 6.4 to 7.3 units away while it could fire at 6.5 range and both humans were idle. It is not a pass guarantee: 91 was visible for only ticks 1864 through 1884, attackMove remains a ground command, movement and target selection can change, and native wave membership remains unverified.",
            "implementationPerformed": False,
            "predicateOrBudgetChangeProposed": False,
        },
    }

    descriptors_doc = {"schema": "feature63-r7-public-positional-input-descriptors-v1", "inputCount": len(descriptors), "inputs": descriptors}
    (OUT / "input-descriptors.json").write_text(json.dumps(descriptors_doc, indent=2) + "\n")
    (OUT / "positional-diagnosis.json").write_text(json.dumps(report, indent=2) + "\n")
    records = []
    for path in (Path(__file__).resolve(), OUT / "input-descriptors.json", OUT / "positional-diagnosis.json"):
        data = path.read_bytes()
        records.append({"name": path.name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "mode": format(stat.S_IMODE(path.stat().st_mode), "04o")})
    (OUT / "manifest.json").write_text(json.dumps({"schema": "feature63-r7-public-positional-manifest-v1", "deterministic": True, "readOnlyInputs": True, "artifacts": records}, indent=2) + "\n")


if __name__ == "__main__":
    try:
        main()
    except Failure as exc:
        print(f"positional diagnosis failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
