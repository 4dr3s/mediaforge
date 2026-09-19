"""The worker-side contract validators (design.md §2.2, WU-3).

The domain contract is language-neutral and lives in ``contracts/`` at the repository root; each
runtime carries its own validator against the same fixture documents. This module is the Python
half: ``parse_dispatch_envelope`` reads the raw queue message body exactly as it would arrive
from the queue port, and ``parse_audio_extract_params`` validates a decoded value against the
registry-declared ``audio.extract`` parameter schema (C5).

Both parsers raise ``ValueError`` on rejection; pydantic v2's ``ValidationError`` subclasses
``ValueError``, so callers may catch either.

The ``occurred_at`` check is deliberately two gates (fix F2, task 1.3a): the regex pins the
RFC 3339 *grammar* (mandatory time offset with a ``:`` separator, seconds always present),
and ``datetime.fromisoformat`` supplies the *calendar and offset-range* gate the grammar alone
cannot — February 30th, month 13, a non-leap February 29th and a ``+24:00`` offset all match
the regex but contradict the calendar. Neither gate alone would be correct.

The instant domain is years 0001–9999. RFC 3339's ABNF admits any 4-digit year lexically
while delegating the calendar to ISO 8601, whose calendar has no year 0000, and ``datetime``
cannot represent year 0 at all — so a ``0000-`` timestamp matches the grammar gate and fails
the calendar gate. Gate 2 is what supplies the year-domain exclusion, mirroring the zod
validator's own rejection of year 0000.
"""

from __future__ import annotations

import datetime as dt
import json
import re
from typing import Literal

import pydantic

# The only version this contract ships (design.md §7.1); a different literal is a contract change.
ENVELOPE_TYPE_V1 = "mediaforge.job.dispatch.v1"

# RFC 3339 is enforced in two gates, because neither alone is sufficient (fix F2, task 1.3a):
#
# 1. the grammar gate below — the time offset is mandatory, so a bare date or an offset-less
#    timestamp is not an RFC 3339 instant, the offset must carry the ``:`` separator
#    (``fromisoformat`` alone would also accept out-of-band forms such as ``+0000``), and
#    seconds are always present. The offset's hour and minute components are range-pinned here
#    on purpose: ``fromisoformat`` does **not** range-check them, it *normalises* them, so
#    ``+02:60`` becomes ``+03:00`` and ``+02:99`` becomes ``+03:39`` instead of being rejected.
#    The zod validator rejects both, so the grammar gate has to as well or the two runtimes
#    disagree over the offset domain — the defect this whole task exists to remove, and one
#    that shipped here before (`offset-minutes-out-of-range-occurred-at.json` measures it);
# 2. a calendar and offset-range gate via ``datetime.fromisoformat`` — the regex accepts
#    February 30th, month 13 and a non-leap February 29th (all of which RFC 3339 forbids and
#    the zod validator rejects), but the calendar itself does not. It also supplies the
#    year-domain exclusion: year 0000 is out, so the instant domain is 0001-9999.
#
# pydantic would accept a naive string on a plain ``str`` field, so the model enforces both
# gates itself, mirroring the zod validator on the API side.
_RFC3339_WITH_OFFSET = re.compile(
    r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)"
)


class DispatchEnvelope(pydantic.BaseModel):
    """A dispatch notification: ``type``, ``job_id``, ``occurred_at`` and nothing else (C3).

    The envelope is a notification, not the truth — the moment it carries parameters or state it
    is a second, stale copy of the job record. ``extra="forbid"`` makes a fourth field a
    validation error instead of dropping it, so the key-set assertion in the parity suite cannot
    be laundered past the parser.
    """

    model_config = pydantic.ConfigDict(extra="forbid")

    type: str
    job_id: str
    occurred_at: str

    @pydantic.field_validator("type")
    @classmethod
    def _type_must_be_v1(cls, value: str) -> str:
        # The version discriminator is the whole point of ``type``: a consumer that only knows v1
        # must reject v2 outright — acknowledging it would strand the job in ``queued`` with
        # nothing left to deliver it (design.md §7.2, the "silent eternity").
        if value != ENVELOPE_TYPE_V1:
            raise ValueError(f"unsupported envelope type {value!r}")
        return value

    @pydantic.field_validator("occurred_at")
    @classmethod
    def _occurred_at_must_be_rfc3339(cls, value: str) -> str:
        # Gate 1, grammar: the regex pins the RFC 3339 shape — mandatory time offset with the
        # ``:`` separator, seconds always present (see the module comment).
        if not _RFC3339_WITH_OFFSET.fullmatch(value):
            raise ValueError(
                f"occurred_at must be an RFC 3339 instant with a time offset, got {value!r}"
            )
        # Gate 2, calendar and offset range: the regex accepts impossible dates and offsets
        # outside RFC 3339 (February 30th, month 13, a non-leap February 29th, ``+24:00``)
        # that the calendar itself rejects; ``fromisoformat`` is the measured calendar gate
        # (Python >= 3.11, which this package requires, accepts the ``Z`` suffix). It runs
        # only after the grammar gate, because on its own it would accept forms RFC 3339 does
        # not — for example ``2026-09-17T12:00:00+0000``, an offset without the colon. Gate 2
        # is also what supplies the year-domain exclusion: the instant domain is years
        # 0001–9999 (the ISO 8601 calendar has no year 0000), so a ``0000-`` timestamp passes
        # the grammar gate above and falls here, where ``datetime`` cannot represent year 0.
        try:
            dt.datetime.fromisoformat(value)
        except ValueError as exc:
            raise ValueError(
                f"occurred_at is not a calendar-valid RFC 3339 instant, got {value!r}"
            ) from exc
        return value


def parse_dispatch_envelope(raw: str | bytes) -> DispatchEnvelope:
    """Parse the raw queue message body (``str`` or ``bytes``) into a v1 dispatch envelope.

    Raises ``ValueError`` on any deviation in the *document*: invalid JSON, a non-object value, an
    unsupported ``type`` version, a missing or wrong-typed field, a non-RFC-3339 ``occurred_at``, or
    an extra field. An argument that is neither ``str`` nor ``bytes`` violates the declared
    precondition and raises ``TypeError`` -- a caller bug, not a rejected envelope.
    """
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    if not isinstance(raw, str):
        # A wrong argument TYPE is a caller error, not a rejected document: Python's own
        # convention (and ruff TRY004) puts a precondition violation under TypeError, while
        # every rejection of a *document* stays ValueError -- which is what the parity suite
        # asserts. The TS side takes `unknown` and lets zod throw, so no parity fixture
        # depends on this branch.
        raise TypeError(f"envelope body must be str or bytes, got {type(raw).__name__}")
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"envelope body is not well-formed JSON: {exc}") from exc
    try:
        return DispatchEnvelope.model_validate(value)
    except pydantic.ValidationError as exc:
        # Re-raising keeps the rejection under the documented ``ValueError`` contract and makes
        # the throw explicit at this boundary instead of implicit inside the model call.
        raise ValueError(f"invalid dispatch envelope: {exc}") from exc


class AudioExtractParams(pydantic.BaseModel):
    """The ``audio.extract`` parameter object declared in ``contracts/job-types.json`` (C5).

    Every parameter is optional and exactly one exists (``quality``); an unknown key is a
    different job's parameter or a typo, and both must fail before the handler starts.
    """

    model_config = pydantic.ConfigDict(extra="forbid")

    quality: Literal["128k", "192k", "320k"] | None = None


def parse_audio_extract_params(value: object) -> AudioExtractParams:
    """Validate a decoded value against the registry-declared ``audio.extract`` params.

    Accepts ``{}`` and ``{"quality": "128k" | "192k" | "320k"}``; raises ``ValueError`` on
    everything else (an enum miss, a non-string value, an unknown key, or a non-object shape).
    """
    try:
        return AudioExtractParams.model_validate(value)
    except pydantic.ValidationError as exc:
        raise ValueError(f"invalid audio.extract params: {exc}") from exc
