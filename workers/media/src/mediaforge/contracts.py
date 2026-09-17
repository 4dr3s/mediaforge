"""The worker-side contract validators (design.md §2.2, WU-3).

The domain contract is language-neutral and lives in ``contracts/`` at the repository root; each
runtime carries its own validator against the same fixture documents. This module is the Python
half: ``parse_dispatch_envelope`` reads the raw queue message body exactly as it would arrive
from the queue port, and ``parse_audio_extract_params`` validates a decoded value against the
registry-declared ``audio.extract`` parameter schema (C5).

Both parsers raise ``ValueError`` on rejection; pydantic v2's ``ValidationError`` subclasses
``ValueError``, so callers may catch either.
"""

from __future__ import annotations

import json
import re
from typing import Literal

import pydantic

# The only version this contract ships (design.md §7.1); a different literal is a contract change.
ENVELOPE_TYPE_V1 = "mediaforge.job.dispatch.v1"

# RFC 3339 (design.md §7.1): the time offset is mandatory, so a bare date or an offset-less
# timestamp is not an RFC 3339 instant. pydantic would accept a naive string on a plain ``str``
# field, so the model enforces the grammar itself, mirroring the zod validator on the API side.
_RFC3339_WITH_OFFSET = re.compile(
    r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})"
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
        if not _RFC3339_WITH_OFFSET.fullmatch(value):
            raise ValueError(
                f"occurred_at must be an RFC 3339 instant with a time offset, got {value!r}"
            )
        return value


def parse_dispatch_envelope(raw: str | bytes) -> DispatchEnvelope:
    """Parse the raw queue message body (``str`` or ``bytes``) into a v1 dispatch envelope.

    Raises ``ValueError`` on any deviation: invalid JSON, a non-object value, an unsupported
    ``type`` version, a missing or wrong-typed field, a non-RFC-3339 ``occurred_at``, or an
    extra field.
    """
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    if not isinstance(raw, str):
        raise ValueError(f"envelope body must be str or bytes, got {type(raw).__name__}")
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
