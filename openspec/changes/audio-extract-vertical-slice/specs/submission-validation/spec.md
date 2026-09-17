# Submission & Validation Specification

**Capability** C1 — Submission & Validation · **Lane** API · **Change** `audio-extract-vertical-slice`

## Purpose

The API edge that turns an upload into a validated job: it accepts a submission, validates the
request against the job-type registry, mints the `job_id` and the creator token, streams the
input bytes into the inbox zone, and performs `created` → `queued` (T1) when — and only when —
every input is complete and legal.

**In this slice:** metadata submission, plural input declaration, upload-only ingestion, declared-type
allowlist plus magic-byte validation, streamed size cap, creator-token minting, idempotent
submission, T1, and per-IP submission rate limiting.

**Not in this slice:** URL ingestion, input-TTL failure of an abandoned submission (no janitor),
progress/event emission, notification emails, and the web UI. The concrete DDL and the Prisma
schema are fixed by design, not by this spec.

## Requirements

### Requirement: The Job-Type Registry Is the Only Source of Submission Rules

The system MUST declare, per job type, the parameter schema, the input arity, the allowed input
types, the input size cap, and the wall-clock limit as registry data rather than as code
constants. `audio.extract` MUST be registered with input arity 1 and an input size cap of
200 MB (ADR-0001 D5). The system MUST reject a submission whose `job_type` is not registered.
Validation MUST be pure and synchronous: it MUST NOT invoke ffmpeg, parse the media container,
or read the artifact store.

#### Scenario: Unknown job type is rejected

- GIVEN the registry contains `audio.extract` and no other type
- WHEN a client submits a job with an unregistered `job_type`
- THEN the API rejects the request as an unknown job type
- AND no `jobs` row is created
- AND no dispatch intent is recorded

#### Scenario: Changing a limit is a registry change, not a code change

- GIVEN `audio.extract` is registered with an input size cap
- WHEN the cap is changed in registry data
- THEN submissions up to the new cap are accepted and submissions above it are rejected
- AND no validation code was modified

### Requirement: A Job Row Exists Before Any Byte Is Accepted

The API MUST create the `jobs` row in state `created` before it accepts the input bytes for that
job, and MUST return the `job_id` to the client at that point. The API MUST persist the `jobs`
row, the `job_inputs` rows, and the `submissions` row in one database transaction, so that an
interrupted submission leaves no partial record.

#### Scenario: The job row precedes the bytes

- GIVEN a valid submission request
- WHEN the API accepts the submission
- THEN a `jobs` row exists with state `created`
- AND one `job_inputs` row exists per declared input
- AND the response carries the `job_id` and the creator token

#### Scenario: A failed submission transaction leaves nothing partial

- GIVEN a submission whose transaction fails before commit
- WHEN the client inspects the system afterwards
- THEN no `jobs`, `job_inputs`, or `submissions` row from that attempt is visible

#### Scenario: Bytes are rejected for an unknown or non-`created` job

- GIVEN a job that is already `queued` or that does not exist
- WHEN a client uploads input bytes for that `job_id`
- THEN the API rejects the upload
- AND the job's job_inputs are unchanged

### Requirement: Ingestion Is Upload-Only

v0.1 MUST accept uploaded files only. A submission MUST NOT cause the system to fetch a remote
URL, MUST NOT honor a URL field, and MUST NOT issue outbound HTTP requests on behalf of a
submission. The worker MUST be read-only on the inbox zone: it MAY read input bytes through an
input handle and MUST fail any attempt to write there.

#### Scenario: A submission carrying a URL is rejected

- GIVEN a submission that supplies a remote URL instead of an uploaded file
- WHEN the API validates the request
- THEN the request is rejected and no job is created
- AND no outbound network request is made

#### Scenario: The worker cannot write to the inbox zone

- GIVEN a job whose input bytes are stored in the inbox zone
- WHEN the worker processes the job
- THEN the worker can read the input through its handle
- AND a write attempt by the worker into the inbox zone fails

### Requirement: The Declared Input Count Must Match the Registry Arity

The API MUST create exactly one `job_inputs` row per declared input, with `ordinal` set to the
input's position in the submission (1, 2, …). At T1 the API MUST verify that the number of
inputs equals the arity declared by the job-type registry for that job type; `audio.extract`
declares arity 1. A submission that supplies a different number of inputs MUST be rejected, and
the inputs MUST NOT be treated as a single implicit file.

#### Scenario: Correct arity passes

- GIVEN `audio.extract` declares arity 1
- WHEN a submission declares exactly one input
- THEN one `job_inputs` row is created with `ordinal` 1

#### Scenario: Wrong arity is rejected

- GIVEN `audio.extract` declares arity 1
- WHEN a submission declares two inputs
- THEN the API rejects the submission for an arity mismatch
- AND the job does not transition to `queued`

### Requirement: Declared Input Types Are Enforced by Content, Not by Name

The API MUST reject any input whose declared type is not in the job-type registry allowlist. For
every uploaded input the API MUST validate the actual file signature (magic bytes) and MUST NOT
trust the filename extension or the client-supplied `Content-Type`. An input whose real
signature does not match its declared type MUST be rejected before dispatch. The client's
filename MUST NOT be used to build a storage key or a handler path.

#### Scenario: A renamed file is rejected before dispatch

- GIVEN a registry that allowlists video container types for `audio.extract`
- WHEN a client uploads a file named `clip.mp4` whose magic bytes identify an unrelated format
- THEN the API rejects the input as a type mismatch
- AND the job is never dispatched

#### Scenario: A declared type outside the allowlist is rejected

- GIVEN a registry allowlist for `audio.extract`
- WHEN a submission declares an input type that is not in the allowlist
- THEN the request is rejected before any byte is accepted
- AND the rejection identifies the declared type

#### Scenario: A matching signature is accepted

- GIVEN an uploaded file whose magic bytes match an allowlisted type
- WHEN the API validates the input
- THEN the input is accepted and its declared type is recorded on the `job_inputs` row

### Requirement: Inputs Are Streamed to Disk Under a Hard Size Cap

The API MUST stream each uploaded input directly to disk and MUST NOT hold the whole input in
memory. The API MUST enforce the registry input size cap while streaming, and MUST abort and
reject an input whose stream exceeds the cap. The truncated bytes of an aborted upload MUST NOT
be recorded or used as a valid input.

#### Scenario: An oversized upload is aborted

- GIVEN `audio.extract` registered with a 200 MB input cap
- WHEN a client streams an input larger than the cap
- THEN the API aborts the upload and rejects the input
- AND the job does not become dispatchable

#### Scenario: Memory does not grow with the input

- GIVEN an input at the cap size
- WHEN the API accepts it
- THEN the bytes are written to the inbox zone
- AND the API's resident memory does not grow in proportion to the input size

### Requirement: Submission Is Idempotent per Client Key

The API MUST accept a client-supplied `Idempotency-Key` and MUST persist it in the `submissions`
record under a unique `(client_id, key)` constraint. A repeated submission carrying the same
client id and key MUST return the job and response of the first submission and MUST NOT create a
second job. A submission without a key is a legitimate new job.

#### Scenario: A double submission with the same key yields one job

- GIVEN a completed submission for client `c1` with key `k1`
- WHEN the same client resubmits with `c1` and `k1`
- THEN the API returns the existing `job_id`
- AND exactly one `jobs` row exists for that submission pair

#### Scenario: A submission without a key creates a new job

- GIVEN an identical submission body carrying no idempotency key
- WHEN the client submits it twice
- THEN two distinct jobs are created

### Requirement: T1 Is a Single Guarded Transition from `created` to `queued`

The API MUST perform T1 as one conditional update of the form
`UPDATE ... WHERE id = ? AND state = 'created'`. T1's guard MUST be exactly: every input handle
exists, the input count equals the registry-declared arity, and every input size is within the
cap. The API MUST NOT perform T1 by any read-modify-write sequence, and no component other than
the API MAY perform T1.

#### Scenario: The guard passes and the job is queued

- GIVEN a job in `created` whose single input exists, matches arity 1, and fits the cap
- WHEN the API finishes validating the input
- THEN the job transitions to `queued` in one conditional update
- AND a dispatch intent exists for that job

#### Scenario: A failed guard leaves the job in `created`

- GIVEN a job in `created` whose uploaded input fails the magic-byte check
- WHEN validation completes
- THEN the job does not transition to `queued`
- AND no dispatch intent is recorded for it
- AND the API answers the client with a validation error

#### Scenario: A concurrent transition is not overwritten

- GIVEN a job in `created` that another request has already moved out of `created`
- WHEN the API attempts T1
- THEN the conditional update matches no row
- AND the job's state is not changed by the API

### Requirement: Submissions Are Rate Limited per Source IP

The API MUST rate limit submissions per source IP address, because v0.1 has no accounts and no
identity. A rate-limited submission MUST be rejected and MUST NOT create a job. The documented
limitation is that clients sharing one NAT egress address share a single bucket and can throttle
each other.

#### Scenario: Repeated submissions from one IP are throttled

- GIVEN a source IP that has exceeded the submission rate limit
- WHEN that IP submits another job
- THEN the API rejects the request as rate limited
- AND no `jobs` row is created

#### Scenario: The shared-NAT limitation is documented

- GIVEN the project documentation for the submission endpoint
- WHEN a reader looks for the rate-limit scope
- THEN the documentation states that the limit is per source IP
- AND it states that clients behind a shared NAT address share one bucket

### Requirement: The Creator Token Is Returned Once, Stored Hashed, and Never Logged

The API MUST mint an unguessable `job_id` and a creator token at submission, MUST return the
creator token exactly once in the submission response, and MUST persist only a hash of that
token. The system MUST NOT log the creator token, nor a URL that carries it, and MUST NOT be
able to reproduce the token from stored data.

#### Scenario: The token is returned once and never again

- GIVEN a completed submission
- WHEN the client reads the submission or the job afterwards
- THEN the response does not contain the creator token
- AND stored data holds only a hash of the token

#### Scenario: The token never reaches logs

- GIVEN a submission request and a later download request that both carry the creator token
- WHEN the API writes its log records
- THEN neither the token nor the capability URL appears in any log record
