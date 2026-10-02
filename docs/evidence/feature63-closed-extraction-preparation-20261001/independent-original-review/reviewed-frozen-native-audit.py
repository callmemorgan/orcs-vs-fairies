#!/usr/bin/env python3
"""Closed export auditor candidate. Reads literal JSON/NDJSON only, never SQLite.

This file has not been executed or qualified. All checks use explicit branches,
so Python -O cannot remove them. The root assignment digest is a trust anchor
supplied separately by root, not a value accepted from the bundle being audited.
"""
import argparse
import hashlib
import json
import math
import os
import re
import stat
import sys
from pathlib import Path

SCHEMA = "feature63-closed-native-audit-v1"
PROFILES = {"human-one": 0, "human-two": 1}
CONTROLLERS = ["external", "external", "ai", "ai"]
TEAMS = [0, 0, 1, 1]
MAX_NATIVE_BYTES = 8 * 1024 * 1024
COLLECTOR_METADATA_RESERVE_BYTES = 2 * 1024 * 1024
MAX_NATIVE_FRAMES = 16
MAX_PUBLIC_BYTES = 64 * 1024 * 1024
MAX_RECEIPT_BYTES = 1024 * 1024
PUBLIC_NAMES = (
    "public-results.json", "public-identities.json", "public-windows.json",
    "public-cleanup.json", "public-match-identity.json", "human-one-wire.ndjson", "human-two-wire.ndjson",
    "human-one-ui-actions.ndjson", "human-two-ui-actions.ndjson",
)
RECEIPT_NAMES = (
    "root-assignment.json", "source-binding-receipt.json",
    "closed-raw-receipt.json", "extraction-receipt.json", "collector-receipt.json",
)
FRAME_NAMES = tuple(f"native-frame-{n:02d}.json" for n in range(1, 17))
WAVE_CHECKPOINT_NAMES = tuple(f"native-wave-checkpoint-{n:02d}.json" for n in range(1, 5))
NATIVE_NAMES = ("match-row.json", "native-checkpoint.json") + FRAME_NAMES + WAVE_CHECKPOINT_NAMES
SOURCE_PATHS = (
    "src/core/team-ai.ts", "src/core/simulation.ts", "src/core/saves.ts",
    "src/core/observation.ts", "src/core/commands.ts", "src/core/ally-directives.ts",
    "src/server/server.ts", "src/server/store.ts", "src/server/views.ts",
    "src/online/protocol.ts", "src/online/render-state.ts",
    "src/core/economy.ts", "src/core/economy-types.ts", "src/core/tactics.ts",
    "src/game/GameScene.ts", "src/game/Controls.ts", "src/main.ts",
    "src/ui/Hud.ts", "src/ui/OnlineLobby.ts", "src/core/types.ts",
    "src/core/navigation.ts", "src/ui/SessionTools.ts",
)
COLLECTOR_QUERY = "SELECT id,tick,checkpoint_tick,\n length(CAST(checkpoint AS BLOB)) AS checkpoint_bytes,\n CASE WHEN length(CAST(checkpoint AS BLOB))<=?\n AND length(CAST(generation AS BLOB))<=4096 AND length(CAST(config AS BLOB))<=65536\n THEN checkpoint ELSE NULL END AS checkpoint,\n CASE WHEN length(CAST(generation AS BLOB))<=4096 THEN generation ELSE NULL END AS generation,\n CASE WHEN length(CAST(config AS BLOB))<=65536 THEN config ELSE NULL END AS config\n FROM matches WHERE id=? AND EXISTS (\n SELECT 1 FROM json_each(json_extract(checkpoint,'$.runtime.teamAI.coordinator.waves')) AS w\n WHERE json_extract(w.value,'$.launched')=1\n AND json_extract(w.value,'$.id') NOT IN (SELECT value FROM json_each(?))\n AND EXISTS (SELECT 1 FROM json_each(json_extract(w.value,'$.participants')) AS p WHERE json_extract(p.value,'$.side')=2)\n AND EXISTS (SELECT 1 FROM json_each(json_extract(w.value,'$.participants')) AS p WHERE json_extract(p.value,'$.side')=3))"


class Rejection(Exception):
    pass


def require(condition, reason):
    if not condition:
        raise Rejection(reason)


def obj(value, name):
    require(type(value) is dict, f"{name}: expected object")
    return value


def exact(value, fields, name):
    value = obj(value, name)
    require(set(value) == set(fields), f"{name}: missing or unexpected fields")
    return value


def integer(value, name, low=0, high=2**53 - 1):
    require(type(value) is int and low <= value <= high, f"{name}: invalid integer")
    return value


def number(value, name, low=0):
    require(type(value) in (int, float) and math.isfinite(value) and value >= low,
            f"{name}: invalid finite number")
    return value


def text(value, name):
    require(type(value) is str and 0 < len(value) <= 256 and
            not any(ord(c) < 32 for c in value), f"{name}: invalid text")
    return value


def digest(value, name):
    require(type(value) is str and re.fullmatch(r"[0-9a-f]{64}", value) is not None,
            f"{name}: invalid SHA-256")
    return value


def pin(value, name):
    require(type(value) is str and re.fullmatch(r"[0-9a-f]{40}", value) is not None,
            f"{name}: root-assigned source pin is missing or invalid")
    return value


def ids(value, name, maximum=500):
    require(type(value) is list and 0 < len(value) <= maximum, f"{name}: invalid IDs")
    values = [integer(v, name, 1, 0x7fffffff) for v in value]
    require(len(set(values)) == len(values), f"{name}: duplicate IDs")
    return values


def reject_duplicates(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, f"duplicate JSON key: {key}")
        value[key] = item
    return value


def parse(raw, name):
    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=reject_duplicates,
                           parse_constant=lambda item: (_ for _ in ()).throw(
                               Rejection(f"{name}: nonfinite JSON number {item}")))
        pending = [value]
        while pending:
            item = pending.pop()
            if type(item) is float:
                require(math.isfinite(item), f"{name}: nonfinite JSON number")
            elif type(item) is dict:
                pending.extend(item.values())
            elif type(item) is list:
                pending.extend(item)
        return value
    except (UnicodeError, json.JSONDecodeError, RecursionError) as error:
        raise Rejection(f"{name}: invalid UTF-8 JSON: {error}") from error


def semantic(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=False, allow_nan=False).encode("utf-8")


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


class Bundle:
    def __init__(self, directory):
        self.directory = Path(directory)
        require(self.directory.is_dir() and not self.directory.is_symlink(),
                "bundle must be a real directory")
        self.identities = []
        self.byte_totals = {"native": 0, "public": 0, "receipt": 0}

    def read(self, name, group, descriptor=None):
        allowed = {"native": NATIVE_NAMES, "public": PUBLIC_NAMES,
                   "receipt": RECEIPT_NAMES}[group]
        require(name in allowed, "filename is outside literal input allowlist")
        path = self.directory / name
        try:
            fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        except OSError as error:
            raise Rejection(f"{name}: cannot open regular input: {error}") from error
        try:
            info = os.fstat(fd)
            require(stat.S_ISREG(info.st_mode) and info.st_nlink >= 1,
                    f"{name}: input is not a regular file")
            cap = {"native": MAX_NATIVE_BYTES, "public": MAX_PUBLIC_BYTES,
                   "receipt": MAX_RECEIPT_BYTES}[group]
            require(info.st_size <= cap - self.byte_totals[group],
                    f"{group} byte bound would be exceeded")
            chunks, remaining = [], info.st_size
            while remaining:
                chunk = os.read(fd, min(remaining, 1024 * 1024))
                require(bool(chunk), f"{name}: short read")
                chunks.append(chunk)
                remaining -= len(chunk)
            require(not os.read(fd, 1), f"{name}: grew while reading")
            after = os.fstat(fd)
            require((info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns,
                     info.st_ctime_ns) == (after.st_dev, after.st_ino,
                     after.st_size, after.st_mtime_ns, after.st_ctime_ns),
                    f"{name}: changed while reading")
            raw = b"".join(chunks)
        finally:
            os.close(fd)
        identity = {"file": name, "bytes": len(raw), "sha256": sha(raw), "group": group}
        self.byte_totals[group] += len(raw)
        self.identities.append(identity)
        if descriptor is not None:
            exact(descriptor, ["file", "bytes", "sha256"], f"{name} descriptor")
            require(descriptor["file"] == name and
                    integer(descriptor["bytes"], name) == len(raw) and
                    digest(descriptor["sha256"], name) == identity["sha256"],
                    f"{name}: authenticated byte identity differs")
        return raw

    def json(self, name, group, descriptor=None):
        return parse(self.read(name, group, descriptor), name)


def descriptor_map(values, allowed, name):
    require(type(values) is list and len(values) <= len(allowed), f"{name}: invalid list")
    result = {}
    for value in values:
        exact(value, ["file", "bytes", "sha256"], name)
        require(value["file"] in allowed and value["file"] not in result,
                f"{name}: duplicate or unexpected file")
        integer(value["bytes"], name)
        digest(value["sha256"], name)
        result[value["file"]] = value
    return result


def entity_map(view, name):
    require(type(view.get("entities")) is list, f"{name}: entities missing")
    result = {}
    for entity in view["entities"]:
        obj(entity, name)
        eid = integer(entity.get("id"), name, 1, 0x7fffffff)
        require(eid not in result, f"{name}: duplicate entity")
        integer(entity.get("side"), name, 0, 3)
        number(entity.get("hp"), name)
        result[eid] = entity
    return result


def alive(view, name):
    eliminated = view.get("eliminated")
    require(type(eliminated) is list and len(eliminated) == 4 and
            all(type(x) is bool for x in eliminated), f"{name}: elimination state missing")
    require(eliminated == obj(view.get("result"), name).get("eliminated"),
            f"{name}: elimination views disagree")
    require(eliminated[0] is False and eliminated[1] is False,
            f"{name}: a human is eliminated")
    entities = entity_map(view, name)
    for side in (0, 1):
        require(any(e["side"] == side and e.get("owner") == side and
                    e.get("kind") == "building" and e.get("role") == "hq" and
                    e["hp"] > 0 and e.get("progress") == 1 for e in entities.values()),
                f"{name}: complete living human HQ {side} missing")
    return entities


def check_view(view, side, tick, name):
    obj(view, name)
    integer(view.get("side"), f"{name} side", 0, 3)
    integer(view.get("teamId"), f"{name} team", 0, 1)
    integer(view.get("tick"), f"{name} tick")
    require(view.get("version") == 1 and view.get("side") == side and
            view.get("tick") == tick and view.get("teamId") == TEAMS[side] and
            view.get("controller") == CONTROLLERS[side] and
            obj(view.get("rules"), name).get("mode") == "annihilation" and
            view["rules"].get("standardDefeat") is True and
            view.get("sharedVision") is True, f"{name}: native roster or mode differs")
    number(view.get("time"), name)
    roster = {x.get("side"): x.get("teamId") for x in
              view.get("allies", []) + view.get("opponents", [])}
    roster[side] = view["teamId"]
    require(roster == dict(enumerate(TEAMS)), f"{name}: public team roster differs")
    require(type(view.get("events")) is list, f"{name}: complete events missing")
    entity_map(view, name)


def ndjson(raw, name):
    require(raw.endswith(b"\n") or not raw, f"{name}: incomplete final NDJSON line")
    lines = raw.splitlines()
    require(len(lines) <= 200000, f"{name}: row bound exceeded")
    require(all(line.strip() for line in lines), f"{name}: empty NDJSON line")
    return [obj(parse(line, name), name) for line in lines]


def eligible_owned_ids(view, side):
    entities = entity_map(view, "public command eligibility")
    economy = view.get("economy") or {}
    caravans = obj(economy, "public economy eligibility").get("caravans", [])
    require(type(caravans) is list, "public caravan eligibility list is invalid")
    economy_ids = {value if type(value) is int else obj(value, "public caravan").get("entityId") for value in caravans}
    result = set()
    for eid, entity in entities.items():
        tactics = entity.get("tactics") or {}
        crew = obj(tactics, "public eligibility tactics").get("siegeCrew") or {}
        if (entity.get("owner") == side and entity["side"] == side and entity.get("kind") == "unit"
                and entity.get("role") != "worker" and entity["hp"] > 0 and entity.get("illusion") is False
                and entity.get("definitionId") != "economy:caravan" and eid not in economy_ids
                and obj(crew, "public eligibility crew").get("uncrewed") is not True):
            result.add(eid)
    return result


def public_wire(bundle, descriptors, profile, match_id):
    name = f"{profile}-wire.ndjson"
    rows = ndjson(bundle.read(name, "public", descriptors[name]), name)
    wire, snapshots, hellos, commands, acknowledgements = {}, {}, [], {}, {}
    previous = 0
    sockets = set()
    for row in rows:
        require(row.get("schema") == "feature63-public-wire-v1" and
                row.get("profile") == profile, f"{name}: wire schema differs")
        ordinal = integer(row.get("ordinal"), name, 1)
        require(ordinal == previous + 1, f"{name}: missing or reordered wire row")
        previous = ordinal
        text(row.get("capturedAt"), name)
        sockets.add(text(row.get("socketId"), name))
        require(row.get("payloadType") == "string" and type(row.get("payload")) is str
                and row.get("binaryBase64") is None, f"{name}: binary or incomplete payload")
        message = obj(parse(row["payload"].encode("utf-8"), name), name)
        wire[ordinal] = (row, message, sha(row["payload"].encode("utf-8")))
        direction = row.get("direction")
        require(direction in ("sent", "received"), f"{name}: direction missing")
        if direction == "sent" and message.get("kind") == "command":
            require(message.get("protocolVersion") == 1, f"{name}: command protocol differs")
            seq = integer(message.get("clientSeq"), name, 1)
            integer(message.get("observedTick"), name)
            require(seq not in commands, f"{name}: repeated command sequence")
            require(obj(message.get("command"), name).get("type") not in
                    ("allyDirective", "transferResources", "cancelAllyDirective"),
                    f"{name}: natural AI was directed by a human")
            commands[seq] = (ordinal, message)
        if direction != "received":
            continue
        if message.get("kind") == "hello":
            require(message.get("matchId") == match_id and message.get("side") == PROFILES[profile]
                    and message.get("role") == "player" and message.get("protocolVersion") == 1
                    and message.get("perspective") in (None, "player")
                    and message.get("delayTicks") == 0, f"{name}: player hello binding differs")
            hellos.append((ordinal, message))
        elif message.get("kind") == "snapshot":
            require(bool(hellos), f"{name}: snapshot precedes authenticated hello")
            tick = integer(message.get("tick"), name)
            require(message.get("matchId") == match_id and message.get("frameSeq") == tick,
                    f"{name}: snapshot match or frame sequence differs")
            require(tick not in snapshots, f"{name}: repeated snapshot tick")
            check_view(message.get("view"), PROFILES[profile], tick, name)
            snapshots[tick] = (ordinal, message)
        elif message.get("kind") == "commandAck":
            seq = integer(message.get("clientSeq"), name, 1)
            require(seq not in acknowledgements, f"{name}: duplicate command acknowledgement")
            integer(message.get("appliedTick"), name)
            require(type(message.get("accepted")) is bool, f"{name}: ack acceptance missing")
            acknowledgements[seq] = (ordinal, message)
        elif message.get("kind") == "error":
            raise Rejection(f"{name}: server error retained")
    require(len(sockets) == 1 and bool(hellos) and bool(snapshots),
            f"{name}: replacement socket or incomplete public capture")
    return {"wire": wire, "snapshots": snapshots, "commands": commands,
            "acks": acknowledgements, "hellos": hellos}


def audit(bundle, anchor, report):
    assignment_raw = bundle.read("root-assignment.json", "receipt")
    require(sha(assignment_raw) == digest(anchor, "external root assignment digest"),
            "root assignment does not match separately supplied root digest")
    assignment = exact(parse(assignment_raw, "root-assignment.json"),
                       ["schema", "scope", "sourcePin", "productVersion", "auditAuthorized",
                        "auditorSha256", "publicProducerSha256", "publicDriverSha256",
                        "sourceBindingReceipt", "closedRawReceipt", "extractionReceipt", "collectorReceipt"], "assignment")
    require(assignment["schema"] == "feature63-root-audit-assignment-v1" and
            assignment["scope"] == "original-feature63-closed-native-composition" and
            assignment["productVersion"] == "4.0.2" and assignment["auditAuthorized"] is True,
            "root assignment is absent, held, or for another scope")
    source_pin = pin(assignment["sourcePin"], "assignment.sourcePin")
    require(assignment["auditorSha256"] == sha(Path(__file__).read_bytes()),
            "auditor bytes differ from root-frozen assignment")
    digest(assignment["publicProducerSha256"], "public producer")
    digest(assignment["publicDriverSha256"], "public driver")
    report["sourcePin"] = source_pin
    report["assignmentSha256"] = anchor
    source = bundle.json("source-binding-receipt.json", "receipt", assignment["sourceBindingReceipt"])
    require(source.get("schema") == "feature63-source-binding-v1" and
            source.get("sourcePin") == source_pin and source.get("productVersion") == "4.0.2"
            and source.get("allActualInputsAuthenticated") is True,
            "source input binding is incomplete")
    review = obj(source.get("schemaReview"), "source schema review")
    require(review.get("status") == "approved" and
            review.get("auditorSha256") == assignment["auditorSha256"] and
            review.get("sourcePin") == source_pin,
            "source-derived assumptions review is missing or for different bytes")
    records = source.get("inputs")
    require(type(records) is list and records, "source input identities missing")
    paths = set()
    for record in records:
        obj(record, "source identity")
        path = text(record.get("path"), "source path")
        require(path not in paths and record.get("gitMode") in ("100644", "100755") and
                re.fullmatch(r"[0-9a-f]{40}", str(record.get("gitBlob"))) is not None,
                "source mode/blob identity missing or duplicated")
        integer(record.get("bytes"), path)
        digest(record.get("sha256"), path)
        paths.add(path)
    require(set(SOURCE_PATHS) <= paths, "source assumptions were not bound to all required files")
    report["sourceInputs"] = records
    digest(source.get("serverBuildSha256"), "bound server build")
    closed = bundle.json("closed-raw-receipt.json", "receipt", assignment["closedRawReceipt"])
    require(closed.get("schema") == "feature63-closed-raw-v1" and closed.get("sourcePin") == source_pin
            and closed.get("producerClosed") is True and closed.get("ownedProcessesClosed") is True
            and closed.get("rootSealed") is True and closed.get("sidecarsAbsent") is True,
            "authenticated closed raw custody receipt is incomplete")
    closed_id = text(closed.get("sealId"), "closed raw seal ID")
    digest(closed.get("rawSha256"), "root-provided closed raw digest")
    integer(closed.get("rawBytes"), "root-provided raw bytes", 1, 2 * 1024**3)
    # The raw digest is retained as receipt data. No raw path is opened or hashed.
    report["closedRawReference"] = {k: closed[k] for k in ("sealId", "rawSha256", "rawBytes")}
    extraction = bundle.json("extraction-receipt.json", "receipt", assignment["extractionReceipt"])
    require(extraction.get("schema") == "feature63-native-extraction-v1" and
            extraction.get("sourcePin") == source_pin and extraction.get("sealId") == closed_id and
            extraction.get("closedOnly") is True and extraction.get("rawUnchanged") is True and
            extraction.get("noLivePrivateReadback") is True and extraction.get("noReplay") is True,
            "native extraction receipt is incomplete or not bound to sealed raw")
    match_id = text(extraction.get("matchId"), "native match ID")
    lobby_id = text(extraction.get("lobbyId"), "native lobby ID")
    require(closed.get("matchId") == match_id, "closed custody match differs")
    native_descriptors = descriptor_map(extraction.get("nativeFiles"), NATIVE_NAMES, "native files")
    public_descriptors = descriptor_map(extraction.get("publicFiles"), PUBLIC_NAMES, "public files")
    require(set(PUBLIC_NAMES) == set(public_descriptors), "literal public inputs incomplete")
    require({"match-row.json", "native-checkpoint.json"} <= set(native_descriptors),
            "native match/checkpoint missing")
    frame_names = sorted(set(native_descriptors) & set(FRAME_NAMES))
    wave_checkpoint_names = sorted(set(native_descriptors) & set(WAVE_CHECKPOINT_NAMES))
    require(2 <= len(frame_names) <= MAX_NATIVE_FRAMES and frame_names == list(FRAME_NAMES[:len(frame_names)]),
            "native frame count or literal contiguous frame names invalid")
    require(wave_checkpoint_names == list(WAVE_CHECKPOINT_NAMES[:len(wave_checkpoint_names)]),
            "collector checkpoint names must be literal and contiguous")
    require(sum(d["bytes"] for d in native_descriptors.values()) <= MAX_NATIVE_BYTES and
            sum(d["bytes"] for d in public_descriptors.values()) <= MAX_PUBLIC_BYTES,
            "authenticated input totals exceed bounds before content read")
    row = bundle.json("match-row.json", "native", native_descriptors["match-row.json"])
    checkpoint = bundle.json("native-checkpoint.json", "native", native_descriptors["native-checkpoint.json"])
    require(row.get("id") == match_id and row.get("lobby_id") == lobby_id,
            "native match/lobby row differs")
    config = obj(row.get("config"), "native match config")
    players = obj(config.get("matchConfig"), "native normalized match config").get("players")
    require(type(players) is list and len(players) == 4 and
            all(type(p.get("id")) is int and type(p.get("teamId")) is int for p in players) and
            [p.get("id") for p in players] == [0, 1, 2, 3] and
            [p.get("controller") for p in players] == CONTROLLERS and
            [p.get("teamId") for p in players] == TEAMS,
            "native config controllers or teams differ")
    require(obj(config.get("rules"), "native rules").get("mode") == "annihilation" and
            config["rules"].get("standardDefeat") is True and config.get("sharedVision") is True,
            "native mode differs")
    require(checkpoint.get("format") == "orcs-vs-fairies-save" and checkpoint.get("version") == 4,
            "native checkpoint envelope differs")
    state, runtime = obj(checkpoint.get("state"), "native state"), obj(checkpoint.get("runtime"), "native runtime")
    cp_tick = integer(state.get("tick"), "checkpoint tick")
    cp_time = number(state.get("time"), "checkpoint time")
    require(row.get("checkpoint_tick") == cp_tick and integer(row.get("tick"), "match tick") >= cp_tick
            and state.get("controllers") == CONTROLLERS and state.get("teams") == TEAMS
            and all(type(team) is int for team in state["teams"]),
            "native checkpoint row/roster binding differs")
    digest(row.get("engine_hash"), "native engine hash")
    digest(row.get("state_hash"), "native state hash")
    require(row["engine_hash"] == source.get("serverBuildSha256"), "native engine build differs")
    report["finalNativeCheckpoint"] = {"tick": cp_tick, "time": cp_time,
                                        "sha256": native_descriptors["native-checkpoint.json"]["sha256"]}
    selected_checkpoint = extraction.get("candidateCheckpointFile")
    require(selected_checkpoint in ("native-checkpoint.json",) + WAVE_CHECKPOINT_NAMES,
            "candidate checkpoint selector is outside literal allowlist")
    collector_generation = None
    if wave_checkpoint_names:
        require(assignment["collectorReceipt"] is not None, "collector checkpoint lacks authenticated closure receipt")
        collector = bundle.json("collector-receipt.json", "receipt", assignment["collectorReceipt"])
        require(collector.get("schema") == "feature63-passive-wave-collector-v1" and
                collector.get("sourcePin") == source_pin and collector.get("matchId") == match_id and
                collector.get("closed") is True and collector.get("readOnly") is True and
                collector.get("noFeedback") is True and collector.get("status") == "PASS" and
                collector.get("failure") is None and collector.get("activeQuery") is None,
                "passive collector is not closed, source-bound, read-only, and independent of UI feedback")
        for key in ("sourceInventory", "publicMatchIdentity", "assignmentIdentity", "reviewIdentity"):
            identity = obj(collector.get(key), f"collector {key}")
            integer(identity.get("bytes"), f"collector {key} bytes", 1)
            digest(identity.get("sha256"), f"collector {key} digest")
        require(source.get("collectorSourceInventorySha256") == collector["sourceInventory"]["sha256"],
                "root source binding does not authenticate the collector source inventory")
        db_identity = exact(collector.get("dbIdentity"), ["device", "inode"], "collector database metadata identity")
        integer(db_identity["device"], "collector device")
        integer(db_identity["inode"], "collector inode", 1)
        require(closed.get("dbIdentity") == db_identity, "collector watched a different raw database identity")
        require(collector.get("bounds") == {"totalCollectorBytes": MAX_NATIVE_BYTES,
                    "metadataReserveBytes": COLLECTOR_METADATA_RESERVE_BYTES,
                    "checkpointPayloadUpperBoundBytes": MAX_NATIVE_BYTES - COLLECTOR_METADATA_RESERVE_BYTES,
                    "queryLogBytes": 640 * 1024, "maxSeconds": 300, "pollSeconds": 1,
                    "maxQueries": 300, "maxRecords": 4}, "collector complete-output bounds differ")
        collector_rows = collector.get("rows")
        references = extraction.get("waveCheckpointRows")
        require(type(collector_rows) is list and len(collector_rows) == len(wave_checkpoint_names) <= 4 and
                type(references) is list and len(references) == len(collector_rows),
                "passive collector row count or export references differ")
        collected = {}
        prior_ordinal, observed_wave_ids, collector_bytes = 0, set(), 0
        for name, record, reference in zip(wave_checkpoint_names, collector_rows, references):
            obj(record, "collector row")
            ordinal = integer(record.get("collectorOrdinal"), "collector ordinal", 1, 4)
            require(ordinal == prior_ordinal + 1, "collector records are missing or reordered")
            prior_ordinal = ordinal
            integer(record.get("queryOrdinal"), "collector query ordinal", 1, 300)
            require(record.get("file") == name and record.get("matchId") == match_id and
                    record.get("query") == COLLECTOR_QUERY and
                    record.get("parameters") == [MAX_NATIVE_BYTES - COLLECTOR_METADATA_RESERVE_BYTES - collector_bytes, match_id,
                                                 json.dumps(sorted(observed_wave_ids), separators=(",", ":"))],
                    "collector query/file/match provenance differs")
            generation_text, config_text = record.get("generationText"), record.get("configText")
            require(type(generation_text) is str and type(config_text) is str,
                    "collector original config/generation TEXT is missing")
            require(sha(generation_text.encode("utf-8")) == digest(record.get("generationTextSha256"), "collector generation digest")
                    and sha(config_text.encode("utf-8")) == digest(record.get("configTextSha256"), "collector config digest"),
                    "collector original config/generation text hashes differ")
            generation = parse(generation_text.encode("utf-8"), "collector generation")
            require(generation == record.get("generation") and type(generation) is list and len(generation) == 4
                    and all(type(value) is int and value >= 0 for value in generation)
                    and parse(config_text.encode("utf-8"), "collector config") == config,
                    "collector config/generation differs from same native match")
            exported = bundle.json(name, "native", native_descriptors[name])
            require(record.get("bytes") == native_descriptors[name]["bytes"] and
                    record.get("checkpointTextSha256") == native_descriptors[name]["sha256"],
                    "collector checkpoint TEXT bytes were altered during export")
            collector_bytes += native_descriptors[name]["bytes"]
            require(exported.get("format") == "orcs-vs-fairies-save" and exported.get("version") == 4,
                    "collector checkpoint envelope differs")
            saved_state = obj(exported.get("state"), "collector checkpoint state")
            saved_runtime = obj(exported.get("runtime"), "collector checkpoint runtime")
            saved_tick = integer(saved_state.get("tick"), "collector checkpoint tick")
            require(saved_tick == record.get("checkpointTick") and saved_tick <= integer(record.get("matchTick"), "collector match tick")
                    and saved_state.get("controllers") == CONTROLLERS and saved_state.get("teams") == TEAMS
                    and all(type(team) is int for team in saved_state["teams"]),
                    "collector checkpoint row or roster binding differs")
            retained_waves = obj(obj(saved_runtime.get("teamAI"), "collector team AI").get("coordinator"), "collector coordinator").get("waves")
            require(type(retained_waves) is list, "collector launched waves missing")
            launched_ids = sorted(integer(w.get("id"), "collector wave ID", 1) for w in retained_waves
                                  if w.get("launched") is True and {p.get("side") for p in w.get("participants", [])} == {2, 3})
            new_launched_ids = sorted(set(launched_ids) - observed_wave_ids)
            require(record.get("waveIds") == new_launched_ids and bool(new_launched_ids),
                    "collector has no newly observed authentic launched wave ID")
            observed_wave_ids.update(new_launched_ids)
            require(reference == {"file": name, "matchId": match_id, "tick": saved_tick, "collectorOrdinal": ordinal},
                    "root collector export reference differs")
            collected[name] = (exported, generation)
        require(collector.get("records") == len(collector_rows) and collector.get("checkpointPayloadBytes") == collector_bytes,
                "collector final count or retained byte total differs")
        require(selected_checkpoint == "native-checkpoint.json" or selected_checkpoint in collected,
                "selected launch checkpoint is not a retained collector record")
        if selected_checkpoint in collected:
            checkpoint, collector_generation = collected[selected_checkpoint]
            state, runtime = checkpoint["state"], checkpoint["runtime"]
            cp_tick, cp_time = state["tick"], number(state.get("time"), "selected collector checkpoint time")
        report["passiveCollectorReference"] = collector
    else:
        require(assignment["collectorReceipt"] is None and extraction.get("waveCheckpointRows") == [] and
                selected_checkpoint == "native-checkpoint.json", "unexpected collector selection or receipt")
    frames = {}
    frame_receipts = extraction.get("frameRows")
    require(type(frame_receipts) is list and len(frame_receipts) == len(frame_names), "native frame row receipts missing")
    for frame_name, receipt in zip(frame_names, frame_receipts):
        exact(receipt, ["file", "matchId", "tick"], "native frame row")
        require(receipt["file"] == frame_name and receipt["matchId"] == match_id,
                "native frame row match/file differs")
        tick = integer(receipt["tick"], "native frame tick")
        views = bundle.json(frame_name, "native", native_descriptors[frame_name])
        require(type(views) is list and len(views) == 4 and tick not in frames,
                "native full four-view frame missing or duplicated")
        for side, view in enumerate(views):
            check_view(view, side, tick, frame_name)
        require(len({v["time"] for v in views}) == 1, "native frame times disagree")
        frames[tick] = views
    require(list(frames) == sorted(frames), "native frames are not tick-ordered")
    queries = extraction.get("queries")
    expected_match_query = "SELECT id,lobby_id,config,tick,checkpoint_tick,checkpoint,engine_hash,state_hash FROM matches WHERE id=?"
    expected_frame_query = ("SELECT tick,views FROM frames WHERE match_id=? AND tick IN (" +
                            ",".join("?" for _ in frames) + ") ORDER BY tick")
    require(queries == [{"kind": "match", "text": expected_match_query, "parameters": [match_id]},
                        {"kind": "frames", "text": expected_frame_query,
                         "parameters": [match_id] + list(frames)}],
            "root extraction query text/parameters differ from bounded match-specific plan")
    team_ai = obj(runtime.get("teamAI"), "checkpoint team AI")
    require(team_ai.get("directives") == [] and team_ai.get("transfers") == [],
            "natural AI checkpoint contains human directives or transfers")
    coordinator = obj(team_ai.get("coordinator"), "checkpoint coordinator")
    waves = coordinator.get("waves")
    require(type(waves) is list and waves, "launch-era coordinator wave is absent; expiry cannot be reconstructed")
    wave_id = integer(extraction.get("candidateWaveId"), "candidate wave ID", 1)
    selected = [wave for wave in waves if obj(wave, "wave").get("id") == wave_id]
    require(len(selected) == 1, "candidate coordinator wave is missing or ambiguous")
    wave = exact(selected[0], ["id", "teamId", "target", "participants", "launchAt", "expiresAt", "launched"], "wave")
    require(wave["teamId"] == 1 and wave["launched"] is True, "wave was not launched for AI team")
    integer(wave["teamId"], "wave team", 1, 1)
    require(integer(coordinator.get("nextWaveId"), "next wave ID", 1) > wave_id,
            "selected wave does not precede coordinator nextWaveId")
    target = obj(wave["target"], "planner target")
    require(set(target) == {"key", "kind", "observer", "seenAt", "x", "y"} | ({"level"} if "level" in target else set()),
            "planner target fields differ from source schema")
    if "level" in target:
        integer(target["level"], "planner target level", 0, 1)
    require(target.get("kind") in ("hq", "building", "unit", "start") and target.get("observer") in (2, 3),
            "planner target is invalid")
    text(target.get("key"), "planner target key")
    for key in ("x", "y", "seenAt"):
        number(target.get(key), f"planner target {key}")
    require(target["seenAt"] <= cp_time, "planner target was observed after checkpoint")
    launch_at, expires_at = number(wave["launchAt"], "planned launch"), number(wave["expiresAt"], "wave expiry")
    clocks = runtime.get("aiWave")
    require(type(clocks) is list and len(clocks) == 4, "AI wave clocks missing")
    wave_time = number(clocks[2], "AI owner 2 wave clock", 0.000000001)
    require(clocks[3] == wave_time and launch_at <= wave_time <= cp_time < expires_at,
            "wave clocks differ or launch-era coordinator timing is unavailable")
    participants = wave["participants"]
    require(type(participants) is list and len(participants) == 2 and
            sorted(p.get("side") for p in participants) == [2, 3], "shared wave does not contain both AI owners")
    owners, owner_ids = {}, {}
    for participant in participants:
        exact(participant, ["side", "ids"], "wave participant")
        side = participant["side"]
        integer(side, "wave participant owner", 2, 3)
        owner_ids[side] = sorted(ids(participant["ids"], "wave participant IDs"))
        for eid in owner_ids[side]:
            require(eid not in owners, "duplicate shared wave participant ID")
            owners[eid] = side
    require(len(owners) >= 4, "shared wave has fewer than source minimum fighters")
    before_tick = integer(extraction.get("launchBeforeTick"), "launch before tick")
    after_tick = integer(extraction.get("launchAfterTick"), "launch after tick")
    require(before_tick in frames and after_tick in frames and after_tick - before_tick == 4,
            "adjacent native launch bracket frames missing")
    before, after = frames[before_tick], frames[after_tick]
    require(before[0]["time"] < wave_time <= after[0]["time"] <= cp_time,
            "AI clocks are outside retained native launch bracket")
    elapsed_launch_ticks = (wave_time - before[0]["time"]) * 20
    launch_tick_offset = round(elapsed_launch_ticks)
    require(1 <= launch_tick_offset <= 4 and abs(elapsed_launch_ticks - launch_tick_offset) <= 1e-7,
            "shared AI clock cannot be mapped to source20Hz launch tick")
    launch_tick = before_tick + launch_tick_offset
    for label, views in (("before shared launch", before), ("after shared launch", after)):
        for side in (0, 1):
            alive(views[side], label)
    width, height = number(state.get("width"), "map width", 1), number(state.get("height"), "map height", 1)
    starts = state.get("starts")
    require(type(starts) is list and len(starts) == 4, "native starts missing")
    transitions = []
    for side, intended in sorted(owner_ids.items()):
        old, new = entity_map(before[side], "launch before owner"), entity_map(after[side], "launch after owner")
        # Source sorts eligible owned IDs and batches launches in groups of 100.
        for base in range(0, len(intended), 100):
            chunk = intended[base:base + 100]
            columns = math.ceil(math.sqrt(len(chunk)))
            direction = 1 if number(starts[side].get("y"), "AI start y") < height / 2 else -1
            for index, eid in enumerate(chunk):
                require(eid in old and eid in new, "wave participant missing from launch bracket")
                first, last = old[eid], new[eid]
                require(first.get("owner") == last.get("owner") == side and first.get("side") == last.get("side") == side
                        and first.get("kind") == last.get("kind") == "unit" and first.get("role") != "worker"
                        and first["hp"] > 0 and last["hp"] > 0 and not first.get("illusion") and not last.get("illusion"),
                        "wave participant ownership or live combat-unit identity differs")
                require(not obj(first.get("tactics", {}), "participant tactics").get("formation") and
                        not obj(last.get("tactics", {}), "participant tactics").get("formation"),
                        "formation order semantics need separately reviewed support")
                dx = 0 if len(chunk) == 1 else (index % columns - (columns - 1) / 2) * .8 * direction
                dy = 0 if len(chunk) == 1 else (index // columns - (columns - 1) / 2) * .8 * direction
                expected = {"type": "attackMove", "x": max(.6, min(width - .6, target["x"] + dx)),
                            "y": max(.6, min(height - .6, target["y"] + dy))}
                if "level" in target:
                    expected["level"] = target["level"]
                observed = obj(last.get("order"), "participant launch order")
                require(first.get("order") != observed and observed.get("type") == "attackMove" and
                        set(observed) == set(expected) and all(
                            (abs(observed[key] - expected[key]) <= 1e-9 if key in ("x", "y") else observed[key] == expected[key])
                            for key in expected), "participant lacks source-derived attackMove transition to common target")
                transitions.append({"side": side, "id": eid, "beforeTick": before_tick, "afterTick": after_tick,
                                    "beforeOrder": first.get("order"), "afterOrder": observed})
    report["nativeWave"] = {"id": wave_id, "target": target, "plannedLaunchAt": launch_at,
                            "committedDispatchDerived": True, "aiWaveTime": wave_time,
                            "aiWaveTickDerived": launch_tick,
                            "participantIdsByOwnerAtCheckpoint": owner_ids, "ownerOrderTransitions": transitions,
                            "checkpointFile": selected_checkpoint, "checkpointTick": cp_tick, "checkpointTime": cp_time}
    public = {name: bundle.json(name, "public", public_descriptors[name]) for name in PUBLIC_NAMES if name.endswith(".json")}
    identities, result, windows, cleanup = [public[name] for name in
                                            ("public-identities.json", "public-results.json", "public-windows.json", "public-cleanup.json")]
    require(identities.get("schema") == "feature63-public-identities-v1" and identities.get("matchId") == match_id
            and identities.get("lobbyId") == lobby_id and identities.get("sourcePin") == source_pin,
            "public identity/source/match/lobby differs")
    human_profiles = identities.get("profiles")
    humans = identities.get("humans")
    native_humans = config.get("participants")
    require(type(humans) is list and len(humans) == 2 and type(human_profiles) is list and len(human_profiles) == 2
            and type(native_humans) is list and len(native_humans) == 2,
            "two real human account bindings missing")
    accounts = {}
    for human in humans:
        side = integer(human.get("side"), "human side", 0, 1)
        require(human.get("profile") == list(PROFILES)[side] and side not in accounts, "human profile/side differs")
        account = obj(human.get("account"), "public human account")
        username = text(account.get("username"), "human guest username")
        require(username.startswith("Guest-"), "browser account is not a real guest")
        matching = [p for p in native_humans if p.get("side") == side and
                    obj(p.get("account"), "native account").get("username") == username]
        require(len(matching) == 1, "public guest username differs from unique native participant")
        account_id = text(account.get("id"), "public human account ID")
        require(account == matching[0]["account"], "public guest account differs from native participant")
        guest_response = obj(human.get("guestResponse"), "normal public guest response")
        require(guest_response.get("url") == "http://127.0.0.1:5373/api/auth/guest" and
                guest_response.get("status") == 200 and type(guest_response.get("payload")) is str and
                obj(parse(guest_response["payload"].encode("utf-8"), "public guest response"), "guest response").get("account") == account,
                "complete normal guest response does not bind the public account")
        accounts[side] = account_id
    require(accounts[0] != accounts[1], "human profiles use one account")
    require(result.get("schema") == "feature63-public-result-v1" and result.get("matchId") == match_id
            and result.get("sourcePin") == source_pin
            and result.get("publicCandidatePassed") is True
            and result.get("firstFailure") is None and result.get("errors") == [] and
            result.get("cleanupPassed") is True and result.get("feature63Qualified") is False and
            result.get("nativeCompositionAuditRequired") is True and
            result.get("acquisitionFailures") == [] and result.get("producerSha256") == assignment["publicProducerSha256"]
            and result.get("publicProducerSha256") == assignment["publicProducerSha256"]
            and result.get("publicDriverSha256") == assignment["publicDriverSha256"],
            "canonical public candidate result or producer binding failed")
    require(cleanup.get("schema") == "feature63-public-cleanup-v1" and
            cleanup.get("matchId") == match_id and cleanup.get("browserClosed") is True and cleanup.get("failures") == []
            and cleanup.get("allOwnedBrowsersClosed") is True and cleanup.get("captureFailures") == [],
            "public cleanup or capture receipt failed")
    cleanup_contexts = cleanup.get("contexts")
    require(type(cleanup_contexts) is list and len(cleanup_contexts) == 2 and
            all(c.get("closed") is True for c in cleanup_contexts), "owned browser contexts did not close")
    for human in human_profiles:
        text(human.get("contextId"), "human browser context ID")
        matching = [c for c in cleanup_contexts if c.get("profile") == human["profile"] and
                    c.get("contextId") == human["contextId"]]
        require(len(matching) == 1, "cleanup context differs from public human identity")
    require(len({human["contextId"] for human in human_profiles}) == 2,
            "human browser contexts are not distinct")
    public_match_identity = public["public-match-identity.json"]
    require(public_match_identity.get("schema") == "feature63-public-match-identity-v1" and
            public_match_identity.get("matchId") == match_id and public_match_identity.get("lobbyId") == lobby_id and
            public_match_identity.get("sourcePin") == source_pin and
            public_match_identity.get("expectedControllers") == CONTROLLERS and
            public_match_identity.get("expectedTeams") == TEAMS and
            public_match_identity.get("accounts") == humans,
            "early public match identity differs from final real-account binding")
    if wave_checkpoint_names:
        public_identity_reference = obj(collector.get("publicMatchIdentity"), "collector public identity reference")
        require(public_identity_reference.get("bytes") == public_descriptors["public-match-identity.json"]["bytes"] and
                public_identity_reference.get("sha256") == public_descriptors["public-match-identity.json"]["sha256"],
                "passive collector was assigned a different early public match identity")
    require(windows.get("schema") == "feature63-public-windows-v1" and windows.get("matchId") == match_id,
            "public candidate window schema/match differs")
    candidates = windows.get("candidates")
    require(type(candidates) is list and 1 <= len(candidates) <= 2000, "public candidates missing or unbounded")
    candidate_index = integer(windows.get("selectedCandidateIndex"), "selected public candidate", 0, len(candidates) - 1)
    candidate = obj(candidates[candidate_index], "public candidate")
    require(result.get("selectedCandidateIndex") == candidate_index, "canonical result and window indexes differ")
    start, end = integer(candidate.get("startTick"), "fight start"), integer(candidate.get("endTick"), "fight end")
    require(0 < end - start <= 400 and end > launch_tick and candidate.get("maxTicks") == 400
            and candidate.get("publicPredicatePassed") is True and candidate.get("bothHumansAliveThroughout") is True,
            "fight is outside shared launch or bounded alive window")
    require(start in frames and end in frames, "native/public fight boundary identity frames missing")
    wires = {profile: public_wire(bundle, public_descriptors, profile, match_id) for profile in PROFILES}
    if collector_generation is not None:
        for profile, side in PROFILES.items():
            require(all(message.get("generation") == collector_generation[side] for _, message in wires[profile]["hellos"]),
                    "public socket generation differs from retained collector match generation")
    actions = {}
    for profile in PROFILES:
        name = f"{profile}-ui-actions.ndjson"
        records = ndjson(bundle.read(name, "public", public_descriptors[name]), name)
        actions[profile] = {}
        for action in records:
            require(action.get("schema") == "feature63-public-ui-action-v1" and action.get("profile") == profile,
                    "public UI action schema differs")
            action_id = text(action.get("actionId"), "UI action ID")
            action_state = action.get("state")
            require(action_state in ("began", "completed", "accepted"), "public UI action failed or has unknown state")
            lifecycle = actions[profile].setdefault(action_id, {})
            require(action_state not in lifecycle, "duplicate UI action lifecycle state")
            lifecycle[action_state] = action
    accepted = candidate.get("acceptedAttackMoves")
    require(type(accepted) is list and 2 <= len(accepted) <= 32, "accepted UI attack commands missing or unbounded")
    commanded = {0: set(), 1: set()}
    command_evidence = []
    for entry in accepted:
        profile = entry.get("profile")
        require(profile in PROFILES and entry.get("side") == PROFILES[profile], "accepted command profile/owner differs")
        wire = wires[profile]
        seq = integer(entry.get("clientSeq"), "accepted command client sequence", 1)
        require(seq in wire["commands"] and seq in wire["acks"], "command/ack not retained as original wire payloads")
        command_ordinal, message = wire["commands"][seq]
        ack_ordinal, ack = wire["acks"][seq]
        require(entry.get("commandWireOrdinal") == command_ordinal and entry.get("ackWireOrdinal") == ack_ordinal
                and command_ordinal < ack_ordinal and entry.get("command") == message and entry.get("ack") == ack,
                "window command/ack differs from native wire payload")
        require(ack.get("accepted") is True and "reason" not in ack and ack["appliedTick"] == entry.get("appliedTick")
                and ack["appliedTick"] <= start and message["observedTick"] < ack["appliedTick"],
                "UI attack acknowledgement failed or applied after fight began")
        command = message["command"]
        require(command.get("type") == "attackMove" and not command.get("queued"), "required command is not direct UI attackMove")
        selected_ids = ids(command.get("ids"), "commanded IDs", 100)
        eligibility_tick = integer(entry.get("eligibilityFrameTick"), "public command eligibility tick")
        require(eligibility_tick in wire["snapshots"], "command eligibility frame is not retained")
        eligibility_ordinal, eligibility_message = wire["snapshots"][eligibility_tick]
        require(entry.get("eligibilityWireOrdinal") == eligibility_ordinal and eligibility_ordinal < command_ordinal
                and eligibility_tick < ack["appliedTick"], "command eligibility frame is not contemporaneous before command application")
        eligible = sorted(set(selected_ids) & eligible_owned_ids(eligibility_message["view"], PROFILES[profile]))
        require(eligible == sorted(selected_ids) and entry.get("eligibleCommandedIds") == eligible,
                "accepted bulk command names ineligible or self-reported-only actors")
        action_id = entry.get("uiActionId")
        require(action_id in actions[profile], "UI action transcript missing")
        lifecycle = actions[profile][action_id]
        require(set(lifecycle) == {"began", "completed", "accepted"}, "canvas action lifecycle is incomplete")
        began, completed, action = [lifecycle[k] for k in ("began", "completed", "accepted")]
        detail = obj(began.get("detail"), "canvas action detail")
        require(began.get("action") == completed.get("action") == action.get("action") == "canvas-attack-move"
                and detail == completed.get("detail") and detail.get("precedingKeys") == ["F2", "a"]
                and detail.get("button") == "left" and sorted(detail.get("selectedIds", [])) == sorted(selected_ids)
                and sorted(action.get("selectedIds", [])) == sorted(selected_ids)
                and action.get("commandWireOrdinal") == command_ordinal
                and action.get("ackWireOrdinal") == ack_ordinal and action.get("clientSeq") == seq
                and action.get("command") == message and action.get("ack") == ack
                and action.get("eligibleCommandedIds") == eligible
                and action.get("eligibilityFrameTick") == eligibility_tick and detail.get("displayedTick") == eligibility_tick
                and action.get("eligibilityWireOrdinal") == eligibility_ordinal,
                "accepted attack command is not bound to actual normal UI actions")
        selected_units = detail.get("selectedUnits")
        require(type(selected_units) is list and sorted(e.get("id") for e in selected_units) == sorted(selected_ids)
                and all(e.get("side") == PROFILES[profile] and e.get("kind") == "unit" and
                        e.get("role") != "worker" and number(e.get("hp"), "selected human HP") > 0 for e in selected_units),
                "UI selected combat actors are not owned living units")
        action_target = obj(detail.get("target"), "canvas observed ground target")
        require(abs(number(command.get("x"), "attackMove x") - number(action_target.get("x"), "UI ground x")) < .1
                and abs(number(command.get("y"), "attackMove y") - number(action_target.get("y"), "UI ground y")) < .1,
                "sent attackMove differs from canvas ground target")
        require(action.get("id") == action_id and action.get("kind") == "canvas-keyboard-attack-move" and
                action.get("completed") is True and type(action.get("steps")) is list and len(action["steps"]) == 6,
                "accepted UI action lacks complete normal key/minimap/canvas transcript")
        steps = action["steps"]
        require([s.get("kind") for s in steps] == ["key-down", "key-up", "minimap-click", "key-down", "key-up", "canvas-click"]
                and [steps[i].get("key") for i in (0, 1, 3, 4)] == ["F2", "F2", "a", "a"]
                and steps[5].get("actionId") == action_id and steps[5].get("target") == action_target,
                "normal UI attack action transcript differs")
        for index, expected_action in ((0, "keyboard"), (2, "minimap-left-click"), (3, "keyboard")):
            prior_id = steps[index].get("actionId")
            require(prior_id in actions[profile], "preceding real UI action was not retained")
            previous_action = actions[profile][prior_id]
            require(set(previous_action) == {"began", "completed"} and
                    previous_action["began"].get("action") == previous_action["completed"].get("action") == expected_action,
                    "preceding UI selection/minimap/attack-key action did not complete")
            prior_detail = obj(previous_action["began"].get("detail"), "preceding UI action detail")
            require(prior_detail == previous_action["completed"].get("detail"), "preceding UI action details changed")
            if expected_action == "keyboard":
                require(prior_detail.get("key") == steps[index].get("key"), "preceding actual UI key differs")
            else:
                require(prior_detail.get("point") == steps[index].get("point"), "preceding actual minimap click differs")
        commanded[PROFILES[profile]].update(eligible)
        command_evidence.append({"profile": profile, "side": PROFILES[profile], "clientSeq": seq,
                                 "appliedTick": ack["appliedTick"], "ids": selected_ids,
                                 "uiActionId": action_id, "commandWireOrdinal": command_ordinal,
                                 "eligibleCommandedIds": eligible, "eligibilityFrameTick": eligibility_tick,
                                 "eligibilityWireOrdinal": eligibility_ordinal,
                                 "eligibilityPayloadSha256": wire["wire"][eligibility_ordinal][2],
                                 "ackWireOrdinal": ack_ordinal,
                                 "commandPayloadSha256": wire["wire"][command_ordinal][2],
                                 "ackPayloadSha256": wire["wire"][ack_ordinal][2]})
    require(all(commanded.values()), "both humans lack accepted UI attack commands")
    event_records, payload_records = {}, []
    for profile, side in PROFILES.items():
        snapshots = wires[profile]["snapshots"]
        selected_ticks = sorted(t for t in snapshots if start <= t <= end)
        require(selected_ticks == list(range(start, end + 1, 4)), "public fight has a missing authoritative frame")
        ranges = obj(candidate.get("profileFrameRanges"), "public frame ranges")
        selected_range = obj(ranges.get(profile), "public profile range")
        expected_range = {"firstWireOrdinal": snapshots[start][0], "lastWireOrdinal": snapshots[end][0],
                          "firstFrameTick": start, "lastFrameTick": end, "frameCount": len(selected_ticks)}
        require(all(selected_range.get(k) == v for k, v in expected_range.items()) and
                selected_range.get("contiguous") is True,
                "public selected frame range differs from actual wire capture")
        prior_tick = start - 4
        require(prior_tick in snapshots and obj(selected_range.get("beforeWindow"), "preceding public frame").get("tick") == prior_tick
                and selected_range["beforeWindow"].get("wireOrdinal") == snapshots[prior_tick][0],
                "preceding complete public frame is missing")
        alive(snapshots[prior_tick][1]["view"], "before public fight")
        for tick in selected_ticks:
            ordinal, message = snapshots[tick]
            view = message["view"]
            entities = alive(view, "public fight")
            if tick in frames:
                require(view == frames[tick][side], "public snapshot differs from native same-tick owner view")
                payload_records.append({"profile": profile, "tick": tick, "wireOrdinal": ordinal,
                                        "payloadSha256": wires[profile]["wire"][ordinal][2],
                                        "viewSemanticSha256": sha(semantic(view))})
            for event in view["events"]:
                if event.get("type") != "attack":
                    continue
                event_tick = integer(event.get("tick"), "attack event tick")
                require(tick - 4 < event_tick <= tick, "public attack event is outside complete four-tick event buffer")
                if not start < event_tick <= end:
                    continue
                event_id = text(event.get("eventId"), "attack event ID")
                amount = number(event.get("amount"), "attack amount")
                if amount <= 0 or event.get("source") is None or event.get("target") is None:
                    continue
                source_id, target_id = event["source"], event["target"]
                if source_id not in entities or target_id not in entities:
                    continue  # No retained contemporaneous owner identity, so it cannot qualify.
                actor, victim = entities[source_id], entities[target_id]
                if actor.get("kind") != "unit" or victim.get("kind") != "unit":
                    continue
                owner, victim_owner = actor.get("owner"), victim.get("owner")
                if actor.get("side") != owner or victim.get("side") != victim_owner or event.get("side") != owner:
                    continue
                kind = None
                if owner in (0, 1) and source_id in commanded[owner] and target_id in owners and owners[target_id] == victim_owner:
                    kind = "human-to-wave-participant"
                if kind is None:
                    continue
                require(view["time"] > wave_time and event_tick > launch_tick,
                        "qualifying combat event does not follow committed launch bracket")
                require(tick in frames and frames[tick][side] == view,
                        "qualifying combat event lacks native/public same-frame identity")
                core = {"eventId": event_id, "tick": event_tick, "side": owner,
                        "source": source_id, "target": target_id, "amount": amount,
                        "sourceOwner": owner, "targetOwner": victim_owner, "kind": kind}
                existing = event_records.get(event_id)
                if existing:
                    require(existing["event"] == core, "duplicate attack event has conflicting identity or amount")
                else:
                    event_records[event_id] = {"event": core, "observations": []}
                event_records[event_id]["observations"].append({"profile": profile, "wireOrdinal": ordinal, "frameTick": tick,
                                                              "payloadSha256": wires[profile]["wire"][ordinal][2]})
    human_events = [r for r in event_records.values() if r["event"]["kind"] == "human-to-wave-participant"]
    require({r["event"]["sourceOwner"] for r in human_events} == {0, 1},
            "both commanded humans do not attack the same shared-wave participant set")
    require({r["event"]["targetOwner"] for r in human_events} == {2, 3},
            "commanded human witnesses do not collectively target both AI owners in the same shared wave")
    report["matchIdentity"] = {"matchId": match_id, "lobbyId": lobby_id, "humanAccounts": accounts,
                               "controllers": CONTROLLERS, "teams": TEAMS}
    report["publicFight"] = {"startTick": start, "endTick": end, "windowTicks": end - start,
                             "bothHumansAliveInAllRetainedFrames": True, "authoritativeCadenceTicks": 4,
                             "acceptedUIAttackCommands": command_evidence,
                             "qualifiedEvents": list(event_records.values()), "nativePublicPayloadMatches": payload_records}
    report["checks"] = {"rootBinding": True, "closedExtraction": True, "nativeBounds": True,
                        "sharedPlannerTarget": True, "committedDispatchDerived": True,
                        "sameParticipantCombat": True, "publicAliveCoverage": True,
                        "bothHumanUICommands": True, "bothHumanAttacks": True, "bothNativeAIWaveOwners": True,
                        "humanWitnessesTargetBothAIWaveOwners": True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", required=True, help="root-provided literal JSON export directory")
    parser.add_argument("--assignment-sha256", required=True, help="root-authenticated digest supplied outside bundle")
    args = parser.parse_args()
    report = {"schema": SCHEMA, "status": "rejected", "passed": False,
              "qualificationClaim": False, "failures": [], "sourcePin": None,
              "sqliteOpened": False, "databaseContentHashed": False,
              "runtimeOrReplayRun": False, "checksUseAssertions": False}
    bundle = None
    try:
        bundle = Bundle(args.bundle)
        audit(bundle, args.assignment_sha256, report)
        report["status"] = "closed-native-composition-pass-pending-root-disposition"
        report["passed"] = True
    except (Rejection, OSError, ValueError, TypeError, KeyError, AttributeError, RecursionError) as error:
        report["failures"].append(str(error))
    if bundle is not None:
        report["inputIdentities"] = bundle.identities
        report["inputByteTotals"] = bundle.byte_totals
    print(json.dumps(report, indent=2, sort_keys=True, allow_nan=False))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
