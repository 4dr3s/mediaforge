"""WU-3 / task 1.1 -- the contract parity suite, Python half (RED-first).

The deliverable of WU-3 is *agreement*: the Python worker and the TypeScript API must accept and
reject exactly the same documents. This suite therefore reads the fixture documents in
``contracts/fixtures/`` rather than inventing its own values -- a document that only one side
accepts is a parity failure, not two opinions. The TypeScript half
(``apps/api/test/contract.parity.spec.ts``) asserts the same facts against the same files.

The envelope is a **notification, not the truth** (design.md §7.1): ``type``, ``job_id``,
``occurred_at`` and nothing else. Two families of assertions exist exactly because of that:

- the *key-set* assertion after parsing: a parser that silently tolerates a fourth field would
  pass every parse test while the envelope stopped being a notification; the moment it carries
  parameters or state it is a second, stale copy of the truth;
- the *rejection* assertions, including the v2 ``type``: a consumer that ignores an unsupported
  version would ack a message the relay will never re-publish (design.md §7.2 calls that the
  "silent eternity"), so partial processing is exactly as forbidden as ignoring it.

C3 also requires the contract to be broker-agnostic: the last test scans the schema, the registry,
every fixture and both validator modules for Redis adapter vocabulary (F3 narrowed that list to
Redis machinery and added the three validator files as targets).

The Python parser's surface differs from the TypeScript one on purpose (task 1.2's interface):
``parse_dispatch_envelope`` takes the *raw* message body (``str | bytes``), so envelopes are
handed to it exactly as they would arrive from the queue port; ``parse_audio_extract_params``
takes a parsed value. Rejection is asserted as ``ValueError``, which also covers pydantic's
``ValidationError`` -- pydantic v2 subclasses ``ValueError`` -- so this file does not need to
import pydantic to name the contract.

Expected RED: ``workers/media/src/mediaforge/contracts.py`` does not exist yet, so the import
below fails collection with ``ModuleNotFoundError: No module named 'mediaforge.contracts'``. That
absence -- never a malformed assertion in this file -- is the point of this run. The fixtures'
absence is equally an absence failure: every sweep starts with a directory read that raises
``FileNotFoundError`` until the directories exist.
"""

import json
from pathlib import Path

import pytest

from mediaforge.contracts import parse_audio_extract_params, parse_dispatch_envelope

# Repo-root ``contracts/`` directory: this file lives at <repo>/workers/media/tests/, so the
# repo root is its third parent directory.
REPO_ROOT = Path(__file__).resolve().parents[3]
CONTRACTS_DIR = REPO_ROOT / "contracts"

# The Redis adapter vocabulary that must never reach the domain contract (C3: the queue port is
# broker-agnostic). The list names Redis machinery only -- ``xadd``, ``xreadgroup``, ``xack``
# and ``xautoclaim`` are stream commands, ``xgroup`` the group machinery, ``delivery_count`` a
# message field, and ``redis`` the broker itself. Words like ``consumer``, ``group`` or
# ``stream`` are deliberately absent: the specification itself calls the two runtimes
# "consumers" (C3's "the Python consumer"), so banning them would outlaw the domain's own
# vocabulary, not the adapter's. Prose in the contract files and the validators may therefore
# use the domain's words freely; the scan is for the adapter's machinery, and only in the
# files that declare or implement the contract.
FORBIDDEN_VOCABULARY = (
    "xadd",
    "xreadgroup",
    "xack",
    "xautoclaim",
    "xgroup",
    "delivery_count",
    "redis",
)

# The only version this contract ships (design.md §7.1); a different literal is a contract change.
ENVELOPE_TYPE_V1 = "mediaforge.job.dispatch.v1"

# A v1 envelope that is valid by construction; every rejection test disturbs exactly one property.
ENVELOPE_V1: dict[str, str] = {
    "type": ENVELOPE_TYPE_V1,
    "job_id": "01952f1a-c0de-4000-8000-000000000000",
    "occurred_at": "2026-09-17T12:00:00Z",
}


def read_json(relative: str) -> object:
    return json.loads((CONTRACTS_DIR / relative).read_text(encoding="utf-8"))


def fixture_files(*segments: str) -> list[Path]:
    """The sorted ``.json`` files under ``contracts/fixtures/<segments>``.

    The non-empty guard exists because an absent or empty directory would otherwise make every
    sweep pass vacuously -- the failure mode the WU-2 privilege suite already caught in its own
    RED run ("green for a reason unrelated to what is being asserted"). Here the absence is red,
    on purpose: ``FileNotFoundError`` is the RED evidence.
    """
    directory = CONTRACTS_DIR / "fixtures" / Path(*segments)
    files = sorted(
        path for path in directory.iterdir() if path.is_file() and path.suffix == ".json"
    )
    assert files, f"contracts/fixtures/{'/'.join(segments)} has no .json files"
    return files


def assert_envelope_rejected(payload: str | bytes, reason: str) -> None:
    """The parser must refuse ``payload``; ``reason`` is what the failure message says escaped.

    Concepts, not text: the implementation is free to phrase errors however it likes, so no
    assertion pins error wording. An exception that is not a ``ValueError`` propagates and errors
    the test -- refusing with the wrong exception kind is not "rejected per the interface".
    """
    try:
        parse_dispatch_envelope(payload)
    except ValueError:
        return
    pytest.fail(f"envelope was NOT rejected: {reason}")


def assert_params_rejected(payload: object, reason: str) -> None:
    """``assert_envelope_rejected`` for the params parser; same contract, same rationale."""
    try:
        parse_audio_extract_params(payload)
    except ValueError:
        return
    pytest.fail(f"params were NOT rejected: {reason}")


def test_every_golden_envelope_parses_to_exactly_the_three_fields() -> None:
    for path in fixture_files("envelopes", "valid"):
        payload = dict(parse_dispatch_envelope(path.read_text(encoding="utf-8")))

        # Key-set, not subset: a fourth field must fail here even if the parser tolerated it.
        # ``dict(model)`` yields pydantic's field names, so this asserts what the parsed value
        # *is*; a tolerant parser cannot launder an extra field past the contract.
        assert set(payload) == {"job_id", "occurred_at", "type"}, (
            f"{path.name} carries {sorted(payload)}"
        )
        assert payload["type"] == ENVELOPE_TYPE_V1, path.name
        assert isinstance(payload["job_id"], str), path.name
        assert isinstance(payload["occurred_at"], str), path.name


def test_every_invalid_envelope_fixture_is_rejected() -> None:
    for path in fixture_files("envelopes", "invalid"):
        raw = path.read_text(encoding="utf-8")
        try:
            # Both suites share the rule that a fixture is a *JSON document* whose content the
            # validator rejects; a file that is not JSON is a fixture bug, not a rejection case,
            # and is reported as such instead of silently counting as "rejected" on this side.
            json.loads(raw)
        except json.JSONDecodeError as exc:
            pytest.fail(f"{path.name} is not a well-formed JSON document: {exc}")
        try:
            parse_dispatch_envelope(raw)
        except ValueError:
            continue
        except Exception as exc:  # noqa: BLE001 -- deliberate: the interface names ValueError
            pytest.fail(f"{path.name}: rejected with {type(exc).__name__}, expected ValueError")
        pytest.fail(f"{path.name} was expected to be rejected but parsed")


def test_an_unsupported_envelope_version_is_rejected_not_ignored() -> None:
    # The version discriminator is the whole point of ``type``: a consumer that only knows v1
    # must reject v2 outright. "Ignored" is forbidden with the same force as "partially
    # processed" -- an ack of that message while ``outbox.published_at`` is set would strand the
    # job in ``queued`` with nothing left to deliver it (design.md §7.2, the "silent eternity").
    v2 = dict(ENVELOPE_V1, type="mediaforge.job.dispatch.v2")
    assert_envelope_rejected(json.dumps(v2), "type mediaforge.job.dispatch.v2 (a new version is a contract change, not a shrug)")
    banana = dict(ENVELOPE_V1, type="mediaforge.job.dispatch.banana")
    assert_envelope_rejected(json.dumps(banana), "type mediaforge.job.dispatch.banana (unknown version)")


def test_an_envelope_missing_any_of_the_three_fields_is_rejected() -> None:
    for missing in ("type", "job_id", "occurred_at"):
        payload = {key: value for key, value in ENVELOPE_V1.items() if key != missing}
        assert_envelope_rejected(json.dumps(payload), f"missing {missing}")


def test_an_envelope_with_wrong_typed_fields_is_rejected() -> None:
    assert_envelope_rejected(json.dumps(dict(ENVELOPE_V1, type=42)), "type is a number, not a string")
    assert_envelope_rejected(
        json.dumps(dict(ENVELOPE_V1, job_id={"not": "a string"})), "job_id is an object"
    )
    assert_envelope_rejected(json.dumps(dict(ENVELOPE_V1, occurred_at=0)), "occurred_at is a number")


def test_a_fourth_field_is_rejected_in_the_parser_as_well_as_by_the_key_set_assertion() -> None:
    # The key-set assertion catches a parser that tolerates the extra field; this one catches the
    # tolerance itself. Both directions exist because the moment an envelope carries parameters or
    # state it stops being a notification (C3, glossary §0.1).
    assert_envelope_rejected(
        json.dumps(dict(ENVELOPE_V1, environment="staging")), "a fourth field"
    )


def test_a_non_rfc3339_occurred_at_is_rejected() -> None:
    # RFC 3339's time-offset is mandatory, so a bare date or a naive timestamp is not an RFC 3339
    # instant. This is the requirement, and it is deliberately *not* something pydantic enforces
    # out of the box on a ``datetime`` field (naive datetimes parse fine) -- the model has to add
    # an explicit check, and this test is where that requirement lives.
    assert_envelope_rejected(json.dumps(dict(ENVELOPE_V1, occurred_at="2026-09-17")), "date-only")
    assert_envelope_rejected(
        json.dumps(dict(ENVELOPE_V1, occurred_at="2026-09-17T12:00:00")), "no time offset"
    )


def test_a_value_that_is_not_an_object_is_rejected() -> None:
    assert_envelope_rejected(json.dumps(["not", "an", "object"]), "a JSON array is not an envelope")


def test_the_envelope_parser_accepts_the_byte_surface_too() -> None:
    # The interface is ``str | bytes``: the queue port hands the adapter raw bytes, so the parser
    # must accept the same document twice-encoded. One fixture is enough; it is the *surface*,
    # not the content, that is being pinned here.
    path = fixture_files("envelopes", "valid")[0]
    parsed = dict(parse_dispatch_envelope(path.read_bytes()))
    assert parsed["type"] == ENVELOPE_TYPE_V1


def test_every_param_fixture_parses() -> None:
    for path in fixture_files("params", "valid"):
        try:
            parse_audio_extract_params(json.loads(path.read_text(encoding="utf-8")))
        except ValueError:
            pytest.fail(f"{path.name} was expected to parse as audio.extract params")


def test_every_invalid_param_fixture_is_rejected() -> None:
    for path in fixture_files("params", "invalid"):
        raw = path.read_text(encoding="utf-8")
        try:
            decoded = json.loads(raw)
        except json.JSONDecodeError as exc:
            pytest.fail(f"{path.name} is not a well-formed JSON document: {exc}")
        try:
            parse_audio_extract_params(decoded)
        except ValueError:
            continue
        except Exception as exc:  # noqa: BLE001 -- deliberate: the interface names ValueError
            pytest.fail(f"{path.name}: rejected with {type(exc).__name__}, expected ValueError")
        pytest.fail(f"{path.name} was expected to be rejected but parsed")


def test_params_accept_no_params_at_all() -> None:
    # C5 validates params against the registry's schema *before* the handler runs; a job with no
    # params is the common case and must not be its first failure.
    parse_audio_extract_params({})


def test_params_accept_each_of_the_three_enum_values() -> None:
    for quality in ("128k", "192k", "320k"):
        parse_audio_extract_params({"quality": quality})


def test_params_reject_a_quality_outside_the_enum() -> None:
    assert_params_rejected({"quality": "96k"}, "quality 96k is not in the enum")


def test_params_reject_a_non_string_quality() -> None:
    assert_params_rejected({"quality": 320}, "quality is a number, not a string")


def test_params_reject_an_unknown_extra_key() -> None:
    # Exactly one parameter exists (the registry declares only ``quality``); an unknown key is a
    # different job's parameter or a typo, and both must fail before the handler starts (C5).
    assert_params_rejected({"quality": "320k", "bitrate": "256k"}, "bitrate is not a declared parameter")


def test_params_reject_a_value_that_is_not_an_object() -> None:
    assert_params_rejected(["not", "an", "object"], "an array is not a params object")


def test_job_types_registry_declares_audio_extract_exactly_as_the_spec_requires() -> None:
    """C1: the registry is *data*, not code constants.

    The document read here declares the limits; that the validators enforce them is proven by the
    fixture sweeps and the inline rejection tests, not by this test -- reading a file cannot prove
    a parser honors it. WU-3 ships exactly one type (the out-of-scope note is explicit); a second
    entry is a deliberate registry change and must update this list on purpose.
    """
    registry = read_json("job-types.json")
    assert isinstance(registry, dict), "job-types.json must be a JSON object"
    assert sorted(registry) == ["audio.extract"]

    entry = registry["audio.extract"]
    assert isinstance(entry, dict), "audio.extract entry must be an object"

    # The two literals come from the spec (design.md §2.2, C1): arity 1 and a 200 MB input cap
    # are the *requirement*, so they are asserted as constants, and the MB unit is fixed here
    # ("200 MB" = 200 × 1024 × 1024 bytes). Every other limit is read from the file and only
    # checked for presence and sanity -- changing a limit is a registry change, not a test change.
    assert entry["input_arity"] == 1
    assert entry["input_size_cap_bytes"] == 200 * 1024 * 1024

    # C1 requires the registry to declare the **allowed input types** as data, and design §2.2
    # lists the allowlist alongside the caps. Asserted as "non-empty, all strings, canonical
    # container present" rather than as an exact list: the point of a data registry is that adding
    # a container is a registry change, and a test that pinned the list would turn that data change
    # into a test change. Added after the first draft of this suite omitted it entirely, which would
    # have shipped a contract with no allowlist and a gate that could not notice.
    allowlist = entry["allowed_input_types"]
    assert isinstance(allowlist, list), "allowed_input_types must be a list"
    assert allowlist, "allowed_input_types must not be empty"
    assert all(isinstance(item, str) for item in allowlist), "every allowed input type must be a string"
    assert "video/mp4" in allowlist, "video/mp4 is the slice's canonical input"

    for key in (
        "output_size_cap_bytes",
        "wall_clock_limit_s",
        "lease_ttl_s",
        "lease_grace_s",
        "attempt_budget",
    ):
        value = entry[key]
        assert isinstance(value, int) and value > 0, f"{key} is not a positive integer"

    params = entry["params"]
    assert isinstance(params, dict), "audio.extract params declaration must be an object"
    properties = params.get("properties", {})
    assert isinstance(properties, dict), "params.properties must be an object"
    assert sorted(properties) == ["quality"], "params must declare exactly one parameter"

    quality = properties["quality"]
    assert isinstance(quality, dict), "quality declaration must be an object"
    assert quality.get("enum") == ["128k", "192k", "320k"], "quality enum must be exactly 128k | 192k | 320k"

    # Optional = listed as required nowhere; an omitted ``required`` reads as "nothing required".
    # Together with the single ``properties`` key, that spells "exactly one optional parameter".
    assert params.get("required", []) == []


def test_schema_declares_the_contracts_semantics() -> None:
    """F1: the schema file is the artifact C3 calls the contract, asserted on disk.

    For a long time nothing applied it: both parity suites parsed fixtures -- pydantic here,
    zod on the TypeScript side -- and the vocabulary scan read the file's *bytes*; neither
    read its *semantics*, so the schema could drift (a fourth property, a ``const`` bumped
    to v2, ``format: date`` instead of ``date-time``) while both gates stayed green. This
    test pins the schema's semantics to what the rest of this file assumes, so the file
    cannot become decoration again. The pydantic model is implemented against the same
    facts; this is where the file and the model are forced to agree.
    """
    schema = read_json("dispatch-envelope.schema.json")
    assert isinstance(schema, dict), "dispatch-envelope.schema.json must be a JSON object"

    assert schema.get("type") == "object"
    assert schema.get("additionalProperties") is False

    # ``required`` and ``properties`` are compared order-insensitively: JSON member order is
    # not significant, and neither is the order of ``required``.
    required = schema.get("required")
    assert isinstance(required, list), "required must be an array"
    assert set(required) == {"job_id", "occurred_at", "type"}

    properties = schema.get("properties")
    assert isinstance(properties, dict), "properties must be an object"
    assert set(properties) == {"job_id", "occurred_at", "type"}

    type_decl = properties["type"]
    assert isinstance(type_decl, dict), "properties.type must be an object"
    assert type_decl.get("const") == ENVELOPE_TYPE_V1

    occurred_at_decl = properties["occurred_at"]
    assert isinstance(occurred_at_decl, dict), "properties.occurred_at must be an object"
    assert occurred_at_decl.get("format") == "date-time"


def test_no_broker_vocabulary_in_the_contract_or_validator_files() -> None:
    """C3: the domain contract must not name the adapter's machinery.

    The scan is substring-on-lowercase, which trips on a token anywhere -- including inside a
    string *value*, which is right: ``"stream": ...`` in a fixture is a leak too. The single
    assertion at the end reports every offender at once instead of stopping at the first one.
    """
    targets = [
        CONTRACTS_DIR / "dispatch-envelope.schema.json",
        CONTRACTS_DIR / "job-types.json",
        *fixture_files("envelopes", "valid"),
        *fixture_files("envelopes", "invalid"),
        *fixture_files("params", "valid"),
        *fixture_files("params", "invalid"),
        # The two zod validators and the pydantic models are scanned too (F3): adapter
        # vocabulary smuggled into a validator would leak into the contract's enforcement
        # points, so the gate that keeps the contract broker-agnostic must watch them as well.
        REPO_ROOT / "apps/api/src/contracts/envelope.ts",
        REPO_ROOT / "apps/api/src/contracts/job-params.ts",
        REPO_ROOT / "workers/media/src/mediaforge/contracts.py",
    ]
    offenders = []
    for path in targets:
        text = path.read_text(encoding="utf-8").lower()
        for word in FORBIDDEN_VOCABULARY:
            if word in text:
                offenders.append(f"{path.name}:{word}")
    assert offenders == [], offenders
