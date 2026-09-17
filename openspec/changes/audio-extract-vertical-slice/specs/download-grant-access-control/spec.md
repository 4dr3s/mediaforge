# Download Grant & Access Control Specification

**Capability** C8 — Download Grant & Access Control · **Lane** API · **Change** `audio-extract-vertical-slice`

## Purpose

Authorization and the way bytes leave the system. v0.1 has no accounts and no identity: access is
a **capability** — an unguessable job identifier plus a creator token returned once at submission.
This capability authorizes every job-scoped API operation, hands out a time-bounded read grant
through the storage port, and defines the download response for each job state, including the case
where the job is `succeeded` but its artifact has expired.

**In this slice:** capability authorization, `createReadGrant` usage, the single grant branch
(redirect or proxy), state-aware download responses, and capability-authorized cancellation of
`created` and `queued` jobs.

**Not in this slice:** accounts, tenancy, job listing or discovery, replay endpoints, and
cancellation of a `running` job. Secret handling (hashing, never logging) is specified by the
submission & validation capability; response shapes, status codes, and grant TTL values are fixed
by design.

## Requirements

### Requirement: Authorization Is a Capability, Never an Identity

The system MUST authorize job-scoped access by possession of that job's creator token, verified
against the stored hash, and MUST NOT rely on any user identity, account, tenant, or session for
authorization. Capability identifiers MUST be unguessable and MUST NOT be enumerable or
sequential. The exact identifier strategy — whether the capability id is the `job_id` itself or a
separate opaque public id — is fixed by design; a bare identifier without the creator token MUST
NOT be sufficient authorization for any job-scoped operation.

#### Scenario: A known job id without the token is not enough

- GIVEN a requester that knows a valid `job_id` but has no creator token for it
- WHEN it requests a job-scoped operation
- THEN the request is rejected as unauthorized
- AND no job data or artifact bytes are disclosed

#### Scenario: A wrong token is rejected

- GIVEN a requester that presents a creator token which does not match the stored hash
- WHEN it requests a job-scoped operation
- THEN the request is rejected

#### Scenario: Identifiers are not sequential

- GIVEN a set of created jobs
- WHEN their identifiers are inspected
- THEN the identifiers are unguessable and not sequential integers

### Requirement: Every Job-Scoped Operation Requires the Capability

Uploading input bytes, canceling a job, and downloading an artifact MUST each require the creator
token of that job. A rejected request MUST NOT disclose whether the job exists, and token
comparison MUST NOT be bypassable by a request that omits the token.

#### Scenario: Upload requires the capability for that job

- GIVEN a valid `job_id` and a creator token belonging to a different job
- WHEN input bytes are uploaded for that `job_id`
- THEN the upload is rejected
- AND no inbox bytes are written for that job

#### Scenario: Cancel requires the capability

- GIVEN a job and a requester without that job's creator token
- WHEN the requester asks to cancel the job
- THEN the request is rejected
- AND the job's state is unchanged

#### Scenario: Denial does not reveal existence

- GIVEN a requester with an invalid token
- WHEN it probes an existing job id and a non-existent job id
- THEN the two responses do not let the requester distinguish existence

### Requirement: Read Access Is Granted Through `createReadGrant` With a Bounded Lifetime

The download path MUST obtain access through `createReadGrant` with a configurable, bounded TTL and
MUST branch exactly once on the grant kind: for a `redirect` grant it MUST respond so the client
follows the grant URL, and for a `proxy` grant it MUST stream the bytes itself. The response and
the grant MUST NOT expose a storage path, a canonical storage key, a bucket name, or a storage
credential, and MUST NOT require the API to build storage URLs outside the port.

#### Scenario: A proxy grant streams through the API

- GIVEN the local storage adapter, which returns a proxy grant
- WHEN a download is authorized
- THEN the API streams the artifact bytes to the client
- AND the response contains no storage path or credential

#### Scenario: Read access expires

- GIVEN a download grant with a bounded lifetime
- WHEN the lifetime elapses
- THEN the grant no longer authorizes access to the bytes

#### Scenario: The API learns nothing backend-specific

- GIVEN the download endpoint
- WHEN its code path is inspected
- THEN it branches on the grant kind only
- AND it contains no logic that depends on the storage backend

### Requirement: The Download Endpoint Distinguishes the Six States and the Expired Artifact Case

The download endpoint MUST return a distinguishable outcome for each of these situations:
not-yet-ready (`created`, `queued`, `running`), `succeeded` with an available artifact,
`succeeded` with an artifact whose `expires_at` is not in the future, `failed`, and `canceled`. An
artifact is expired when its `expires_at` is at or before the current time. The expired case MUST
NOT be reported as a failure and MUST NOT serve the artifact bytes as a successful download; the
job itself MUST remain `succeeded`.

#### Scenario: A ready artifact downloads

- GIVEN a `succeeded` job with an unexpired artifact
- WHEN an authorized client downloads it
- THEN the artifact bytes are served through the read grant

#### Scenario: An expired artifact is not a failure

- GIVEN a `succeeded` job whose artifact `expires_at` is in the past
- WHEN an authorized client downloads it
- THEN the response identifies the artifact as expired rather than failed
- AND the artifact bytes are not served as a successful download
- AND the job is still reported as `succeeded`

#### Scenario: A failed job reports its failure instead

- GIVEN a `failed` job
- WHEN an authorized client requests a download
- THEN the response reports the failure and its error code
- AND no artifact is offered

#### Scenario: A job still in flight is not downloadable

- GIVEN a job in `created`, `queued`, or `running`
- WHEN an authorized client requests a download
- THEN the response reports that the artifact is not yet available
- AND no bytes are served

#### Scenario: A canceled job is reported as canceled

- GIVEN a `canceled` job
- WHEN an authorized client requests a download
- THEN the response reports the job as canceled
- AND no bytes are served

### Requirement: Cancellation Is a Capability-Authorized Pre-Execution CAS

A capability-authorized cancel request MUST perform a single conditional update: `created` →
`canceled` or `queued` → `canceled`. A cancel request for a `running` job MUST NOT change the job
and MUST be reported as not cancellable, because cooperative cancellation of a running attempt is
out of this slice. A cancel request for an already terminal job MUST NOT change it, and MUST report
the job's terminal state rather than an error that hides it.

#### Scenario: Canceling a created job succeeds

- GIVEN an authorized cancel request for a job in `created`
- WHEN the request is handled
- THEN the job becomes `canceled`

#### Scenario: Canceling a queued job succeeds

- GIVEN an authorized cancel request for a job in `queued` with no active lease
- WHEN the request is handled
- THEN the job becomes `canceled`

#### Scenario: Canceling a running job does not apply

- GIVEN an authorized cancel request for a job in `running`
- WHEN the request is handled
- THEN the job remains `running`
- AND the response reports that the job is not cancellable

#### Scenario: Canceling a terminal job is a no-op that reports the truth

- GIVEN an authorized cancel request for a job in `succeeded`
- WHEN the request is handled
- THEN the job remains `succeeded`
- AND the response reports the terminal state

### Requirement: The Display Filename Is Sanitized and Never a Storage Key

The filename offered to the client MUST come from display metadata and MUST be sanitized before it
is placed in a `Content-Disposition` header, so header injection and path traversal are impossible.
The filename MUST NOT be used as a storage key and MUST NOT grant any access on its own.

#### Scenario: A hostile filename is neutralized in the response

- GIVEN an artifact whose recorded display filename contains header separators or path segments
- WHEN the download response is produced
- THEN the header value contains no injected separator or traversal segment
- AND the storage key used to read the bytes is unchanged

#### Scenario: Renaming display metadata changes nothing else

- GIVEN an artifact whose display filename is changed
- WHEN the artifact is downloaded again
- THEN the same bytes are returned
- AND the canonical storage key is unchanged
