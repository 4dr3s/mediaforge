# MediaForge — Job Pipeline Exploration

**Answer first.** The recommended first vertical slice is **end-to-end `audio.extract`
carrying real bytes, with four core mechanics pulled in from day one**: an `attempts`
record, a lease column, a terminal-state dedupe check, and atomic artifact promotion.
Everything else (reaper, DLQ, replay, progress streaming, cancellation, job types 2 and 3)
is deferred to slice 2.

`job-pipeline-core` is a **provisional label, not a decided scope**. The proposal phase
names the real change.

**The message queue stays open.** This document explores how each candidate changes the
domain model; it does not choose one. No ADR is decided here.

| Item | Count |
| --- | --- |
| Bounded contexts proposed | 9 (3 API-side, 2 worker-side, 4 shared) |
| Job lifecycle states | 6 (3 terminal) |
| Allowed transitions | 10, with 3 distinct writers |
| Duplication sources analysed | 5, with 1 mechanism that actually prevents each |
| Candidate first slices | 4 (+1 storage-only cut) |
| Open research questions | 10 |
| Assumptions to validate | 12 |

---

## 1. Bounded contexts and invariants

Lane key: **API** = NestJS boundary · **WKR** = Python worker runtime · **SHR** = shared
contract that both sides must honour.

| # | Context | Lane | Responsibility | Key invariants |
| --- | --- | --- | --- | --- |
| C1 | Submission & Validation | API | Authenticate (or identify) the caller, validate the request against the job-type registry, mint a `job_id`, hand back an upload/URL ingestion plan | A `job` row exists **before** any byte is accepted; validation is pure and synchronous (no ffmpeg, no PDF parsing at accept time); declared size and actual size are both checked |
| C2 | Job Registry & Lifecycle | SHR | Own the durable state machine: states, guarded transitions, attempt records, terminal immutability | Exactly one writer per transition; transitions are compare-and-set in SQL, not read-modify-write in app code; terminal states never leave |
| C3 | Dispatch & Queue Ingress | API | Turn a ready job into a queue message; guarantee no lost and no phantom dispatch | A job is never observable as `queued` without an intended message (outbox); a message never exists for a job that is not `queued` |
| C4 | Worker Runtime & Lease | WKR | Claim attempts, hold and renew leases, enforce timeouts, classify failures, ack/nack, detect already-terminal jobs | Only the current lease holder may commit; a worker never mutates a job it does not hold; ack-after-commit, never before |
| C5 | Job-Type Execution | WKR | Turn input handles + validated params into output handles for one job type | Handler is a pure function `(inputs, params, scratch) -> outputs`; handlers never touch the DB, the queue, or the canonical artifact key directly |
| C6 | Artifact & Storage Lifecycle | SHR | Own the four storage zones, the promote operation, and cleanup | Canonical artifact keys only ever appear via atomic promote; nothing partial is ever readable at a canonical key; a non-terminal job's input is never deleted |
| C7 | Progress & Event Stream | SHR | Emit and read attempt-scoped progress and lifecycle events | Progress is monotonic **within an attempt**; the presented value is `max` over attempts; events are append-only and never the source of truth for state |
| C8 | Download Grant & Access Control | API | Authorize a requester and hand out time-bounded read access | Storage paths and credentials never reach the client; artifact keys are unguessable; the user's original filename is display metadata only, never a storage key |
| C9 | Failure Handling, Dead-letter & Replay | SHR | Define retry classification, the dead-letter destination, and operator replay | Dead-letter is a **message fate**, not a job state; replay of a terminal job mints a new job, it never mutates the old one |

### What belongs where — the short version

- **API only:** accepting and validating intent, dispatch intent, granting download access.
- **Worker only:** claiming, executing, timing out, committing outcomes.
- **Shared (must be written down once and honoured twice):** the state machine, the job
  contract, the storage port, the event shape.

The boundary that carries the most risk is C6 ↔ C4: the worker wants to write bytes, the
storage context wants to own the naming and promote rules. Keep the handler ignorant of
both and give it a scratch directory plus a `promote()` call.

---

## 2. Job lifecycle state machine

### States (6)

| State | Terminal | Meaning | Notes |
| --- | --- | --- | --- |
| `created` | no | Intent accepted, input not yet complete | The "paperwork exists, bytes don't" window |
| `queued` | no | Input complete, dispatch intended or re-intended | Includes retry waits (`available_at` in the future) |
| `running` | no | An attempt is currently leased | The only state where side effects may occur |
| `succeeded` | **yes** | An attempt committed outputs | Immutable; holds `artifact_id` |
| `failed` | **yes** | Non-retryable error, or attempt budget exhausted | Immutable; holds `error_code` |
| `canceled` | **yes** | User cancellation observed | Immutable |

`expired`, `dead_lettered`, `retrying`, and `timed_out` are deliberately **not** states.
They are `error_code` values on `failed`, or queue-layer fates. Adding them multiplies the
transition matrix without adding information.

### Transitions (10) and owners (3)

| # | From → To | Owner | Trigger | Guard |
| --- | --- | --- | --- | --- |
| T1 | `created` → `queued` | API (C1/C3) | Input finalized (upload completed, or URL ingestion plan committed) | Input handle exists and size ≤ cap |
| T2 | `created` → `failed` | Janitor (C9) | Input TTL expired, submission abandoned | `age > input_ttl` |
| T3 | `created` → `canceled` | API (C8/C1) | User cancels before dispatch | — |
| T4 | `queued` → `running` | Worker (C4) | Claim + lease acquired | `available_at <= now` **and** `attempts_used < max_attempts` |
| T5 | `queued` → `canceled` | API | User cancels while waiting | no active lease |
| T6 | `running` → `succeeded` | Worker (C4) | Outputs promoted and committed | current lease holder (`lease_owner = me AND state = 'running'`) |
| T7 | `running` → `failed` | Worker (C4) | Non-retryable error, or retries exhausted | current lease holder |
| T8 | `running` → `queued` | Reaper (C9) | Lease expired with attempts remaining | `lease_expires_at < now` |
| T9 | `running` → `canceled` | Worker (C4) | Cooperative cancel observed | current lease holder |
| T10 | `queued` → `failed` | Reaper (C9) | Poison message: delivery attempts far exceeded without a claim | `available_at < now - poison_window` |

That is **10 legal transitions over 6 states, with 3 disjoint writer sets**. The invariant
worth writing in the spec: *the union of permitted transitions per component is disjoint,
and every transition is one conditional `UPDATE ... WHERE id = ? AND state = ?`.*

### Crash, timeout, retry, cancel, duplicate — the concrete answers

| Situation | What happens | Why it is safe |
| --- | --- | --- |
| Crash after claim, before any side effect | Lease expires → **T8** → retry | No side effect to duplicate; only wall-clock wasted |
| Crash after side effect, before commit | Lease expires → **T8** → retry re-executes | Output was written to `work/{job}/{attempt}/` and only promoted atomically; the canonical key never held partial data. Re-execution overwrites instead of duplicating |
| Crash after commit, before ack | Queue redelivers | Worker reads the job, sees terminal state, **acks without working**. Dedupe is by *state*, not by message id |
| Reaper requeues while the original worker is slow but alive | Two workers run the same attempt | **Attempt fencing**: commit is rejected for the stale lease holder. Duplicate *work* is an accepted cost; duplicate *commit* is impossible |
| Soft timeout (job exceeded its wall-clock budget) | Worker kills the process group, classifies retryable vs non-retryable, performs **T7** | Handler-agnostic; must kill the whole process group or ffmpeg children survive |
| Hard timeout (worker itself died) | Reaper observes expiry, performs **T8** or **T10** | This is the only path that recovers from a wedged worker; the lease is the recovery primitive |
| Cancellation while `queued` | **T5** by the API | No worker involved |
| Cancellation while `running` | API sets `cancel_requested`; worker observes at heartbeat/boundary and performs **T9**; if the handler ignores it, the hard path is lease revocation, not a kill | Cooperative cancel is a request, never a guarantee. Do not promise instant cancel in the product copy |
| Duplicate submission (double-click) | Identical request *with* an idempotency key returns the existing job id; *without* a key it is a legitimate second job | Only a client-supplied key plus a unique index prevents this; nothing downstream can |
| Duplicate submission after the first completed | Same as above; the second request returns the terminal job | No re-execution |

**Progress on retry:** the attempt counter increments, the attempt's own progress restarts at
0. The *presented* progress must not go backwards, so the projector takes max over attempts
and labels the stage. Without the attempt scoping, progress is unfixable later.

---

## 3. Domain vocabulary (canonical)

| Term | One meaning to keep | Ambiguity to kill |
| --- | --- | --- |
| **Job** | The durable record of a unit of user intent: `job_id`, type, params, state, inputs, attempts. It is the source of truth | "job" ≠ the queue message. A message is a *dispatch* of a job; several messages may reference one job |
| **Job type** | A named, registered operation contract (`audio.extract`): param schema, input/output arity, limits, handler | Not "job name" (free text), not "file format" |
| **Submission** | The API-level event and record of a user's request: idempotency key, client id, timestamp, resulting `job_id` | Not a synonym for job. A resubmitted identical request is a second submission of the *same* job |
| **Attempt** | One execution try by one worker: number, lease owner, lease expiry, start/end, error class. **Idempotency lives here** | Not "retry" (retry is the mechanism that creates the next attempt), not "run" |
| **Artifact** | An immutable byte product in the artifact store, keyed by an unguessable `artifact_id` and reachable through a canonical key. A job may have many | Not "output" (the handler's return value) and not "result" (the API's response shape) |
| **Progress** | Attempt-scoped value in `[0, 1]` plus a mandatory stage label | Never a bare percentage without saying *of what*. Near-instant PDF ops are stage-only, not 0→100 |
| **Lease / visibility timeout** | Time-bounded exclusive right of one worker to execute one attempt: `lease_owner`, `lease_expires_at` | Pick **lease**. "Lock" implies indefinite; "visibility timeout" is one queue vendor's word for the same idea |
| **Dead-letter** | A message fate: the destination for messages that cannot progress | Not a job state. The job is `failed`; the message is dead-lettered |
| **Cancel** | User-requested termination of a job | Pick **cancel**. Kill "abort", "stop", "terminate" |
| **Replay** | Operator-initiated re-execution, minting a new job that references the original (`replayed_from`) | Not a retry. Retry happens inside one job's attempt budget; replay happens after terminality |

Two of these are worth a glossary file in the repo, because getting them wrong silently in
code is how the state machine rots: **job vs message**, and **attempt vs retry**.

---

## 4. Idempotency and the exactly-once illusion

Exactly-once *delivery* is not achievable on an at-least-once transport. Target instead:
**exactly-once effect** (fencing + idempotent writes) and **exactly-once user-visible result**
(one canonical artifact per job).

| # | Where duplication enters | Mechanism that actually prevents it | Mechanism that only pretends to |
| --- | --- | --- | --- |
| D1 | Client retry / double submit | Client-supplied `Idempotency-Key` + unique index on `(client_id, key)` storing the resulting `job_id` and the response | UI disabling the button; server-side de-dupe on payload hash |
| D2 | Producer crash between DB write and publish | Transactional **outbox** (write job + outbox row in one transaction; a relay publishes), plus a stable message id | Publishing then writing; "it basically never happens" |
| D3 | Queue redelivery (lost ack, visibility timeout) | Worker checks state first: terminal → ack and exit. Plus an idempotent handler | Trusting the transport to deliver once |
| D4 | Worker crash after side effect, before commit | Attempt-scoped scratch + **atomic promote** to the canonical key. Partial bytes are unreadable at the canonical key | Writing directly to the final path and hoping |
| D5 | Reaper requeue racing a live worker | **Attempt fencing**: commit accepted only from the current `lease_owner`/`attempt_no`; attempts used increments on claim, not on completion | "The reaper is unlikely to fire early" |

**Where "exactly once" is genuinely unachievable and should be stated, not hidden:** a crash
between a promote and the commit leaves an orphaned artifact at the canonical key with a job
still `running`. The fix is not transactional cleverness but *reconciliation*: the retry
promotes again to the same key (overwrite) and commits, so the artifact is right; a janitor
sweeps artifacts with no referencing job. Say this out loud in the design doc — it is the
honest version of "exactly once".

**Cross-cutting rule worth enforcing mechanically:** every write that follows a side effect
carries the attempt's fencing token. If the code path can write without a token, the
idempotency claim is false.

---

## 5. Storage lifecycle

### Four zones

| Zone | Key shape | Writer | Reader | Lifetime |
| --- | --- | --- | --- | --- |
| Inbox (inputs) | `inbox/{job_id}/{input_ordinal}` | API (upload) or worker (URL ingestion) | Worker only, via handle | Until job terminal + retention sweep |
| Work (scratch) | `work/{job_id}/{attempt_no}/…` | Worker handler | Worker handler | Deleted at attempt end, either outcome; prefix delete recovers partials |
| Artifacts | `artifacts/{job_id}/{artifact_id}` | Worker via `promote()` (atomic rename) | API (stream or sign) | Retention policy decision (see assumptions) |
| (reserved) | — | — | — | No fourth zone needed in v0.1; URL fetch stages into inbox |

### Ownership and cleanup

- **Worker** owns `work/`: deletes its own attempt prefix on every exit path, including crash
  recovery by the janitor.
- **Janitor/ticker** owns inbox and artifact retention: orphaned inbox entries for
  `failed`/`canceled` jobs, artifacts with no referencing job, and `work/` prefixes whose
  attempt is terminal.
- **Nothing non-terminal is cleaned.** Deleting a `queued` job's input while a retry is
  pending is a data-loss bug, not a tidy-up.

### Failing halfway

Because every output lands in attempt scratch and reaches the canonical key only by atomic
promote, a job that fails halfway leaves: no artifact row, a garbage-collectable scratch
prefix, and a `failed` job with an `error_code`. The download endpoint answers with the
job's state and reason — not a 500, and not a broken file.

### Download without leaking access

Two layers, both required:

1. **Authorize:** resolve the requester against job ownership (v0.1: an unguessable job id
   plus, if accounts are deferred, a creator token).
2. **Grant:** either stream through the API or return a short-lived signed URL (e.g. 15 min).

Consequences to decide in the proposal: signed URLs need the store to be reachable by the
browser (or behind a gateway) and are the cheapest; proxying keeps storage private but makes
the API a bandwidth pipe and reintroduces the large-file problem. Either way: the API never
returns storage paths, credentials, or internal keys; artifact ids are 128-bit; user
filenames are display metadata only and are sanitized for the `Content-Disposition` header.

### Decision to surface: is the API a byte pipe or a metadata service?

| Option | Consequence |
| --- | --- |
| Uploads stream through the API | Simple auth and validation; API memory/bandwidth becomes the bottleneck; large-file support requires care |
| Client uploads directly to storage with a presigned PUT, API only records metadata | Scales and is what production systems do; needs a verification step (does the claimed size/hash match?) and a Postgres-or-S3 dependency for the first slice |

Do not decide this from intuition — see research question R10.

---

## 6. Resource limits and abuse surface

| Limit | Layer | Concrete v0.1 proposal (numbers to confirm) |
| --- | --- | --- |
| Max input size | Accept time: `Content-Length`, then a streaming hard cut; worker: re-check the real file | `audio.extract` ≤ 2 GiB; PDF types ≤ 200 MiB |
| Per-job wall clock | Worker soft timeout; kill process group | `audio.extract` 10 min; PDF types 60 s |
| Lease TTL | Lease = soft timeout + grace | soft + 60 s, renewed by heartbeat every ~15 s |
| Attempt budget | Registry | 3 attempts, exponential backoff with jitter, capped delay |
| Concurrency | Worker pool (e.g. 2 jobs per worker) + ffmpeg thread cap + global API rate limit per client | Queue depth threshold → `429`/`503` rather than silent unbounded growth |
| Unbounded work per job | Job-type limit table | `pdf.merge` ≤ 20 inputs; `pdf.split` ≤ 500 outputs |
| Output size | Post-promote check | Reject and fail the job if the artifact exceeds the type cap |
| Disk | Per-attempt scratch quota; disk-full must fail the *job*, not the worker | — |

### Hostile input: what an attacker can actually do

| Vector | Target | Mitigation |
| --- | --- | --- |
| SSRF via URL ingestion | Internal network, cloud metadata endpoints | Scheme allowlist (http/https); resolve DNS, then reject private/loopback/link-local ranges; re-validate **every** redirect hop with a hop cap; connect and read timeouts; stream with a byte cap; no auth headers forwarded. The real backstop is egress network policy, because DNS rebinding defeats per-resolution checks |
| Argument injection into the media binary | ffmpeg | **Never** accept user-supplied ffmpeg args; build argv arrays from a validated enum; never `shell=True`; never interpolate filenames into a command string |
| Malformed container | ffmpeg crash / hang | Map exit codes: crash → non-retryable `invalid_input`; hang → timeout path. Retrying a malformed file three times is pure waste |
| CPU/memory bomb | Worker host | Wall-clock timeout, thread cap, memory limit on the container, one job per worker process |
| Path traversal / header injection via filename | Filesystem, HTTP responses | Filename is display metadata only; storage keys are server-generated; sanitize the `Content-Disposition` value |
| PDF with embedded scripts | Nothing in v0.1 if the library never executes JS | Structural merge/split only; assert the library does not evaluate JavaScript; treat as a standing invariant to re-verify per library upgrade |
| Queue flooding | Whole platform | Per-client submission rate limit + max queue depth |

The single highest-value abuse rule for a portfolio artefact: **a hostile input must not be
able to make the worker do more than the job-type limit table allows.**

---

## 7. Candidate first vertical slices

Line estimates are rough order-of-magnitude for a NestJS + Python + migrations + tests
implementation, to be refined in the proposal.

| # | Slice | Proves | Does **not** prove | Est. changed lines | Risk left open |
| --- | --- | --- | --- | --- | --- |
| A | **Thin end-to-end `audio.extract`** — accept upload, create + dispatch job, worker runs ffmpeg, promote artifact, return download link. Lifecycle minimal: attempts, lease column, terminal dedupe, atomic promote. No reaper, no DLQ, no progress stream, no cancel | The TS↔Python contract really works; the queue choice is consumable from both sides; bytes survive the whole path; a reviewer can watch it work | Retry/fencing under real failure, DLQ and replay, progress, cancellation, multi-input | ~800–950 (≈200 api, ≈250 worker runtime, ≈80 handler, ≈70 contracts, ≈130 storage port + local impl, ≈60 migrate, ≈200 tests) | A pipeline that has never survived a crash. Acceptable **only because** fencing + promote + terminal dedupe are included |
| B | **Queue + worker skeleton, no bytes** — synthetic `echo.sleep` job type; full claim/lease/retry/DLQ loop; no storage, no ffmpeg, no download | The state machine, lease reaper, retry classification and DLQ in isolation; fastest deterministic tests; no Docker dependency | Real handler integration, storage lifecycle, artifact access control, size limits, contract parity under real payloads | ~400–550 | A pipeline never exercised with bytes. Storage and contract problems surface in slice 2, both of which are where the hard invariants live |
| C | **Hardened pipeline core, synthetic job type** — attempts + fencing + reaper + retry classification + DLQ + replay CLI + progress events + fault-injection tests (`always_fails`, `flaky`, `hangs`) | The pipeline *as a system*; the strongest interview evidence (fault injection is demonstrable); queue-agnostic by construction | Media integration, real byte plumbing, artifact access, the web path | ~1000–1300 | Big infrastructure investment with no end-to-end demo; the TS↔Python contract is unproven until real payloads flow |
| D | **`pdf.split` end-to-end with multi-output artifacts** — same as A, but 1 input → N outputs, output-count cap, multi-input table shape | The artifact model is plural from day one; storage fan-out and naming; limit governor | The runtime stresses (subprocess lifecycle, streaming progress, long wall clocks, large outputs) | ~950–1100 | Multiplies the artifact surface before the single-output path is proven; slower to first demo |

(Bonus cut, considered and not recommended first: **storage-and-ingestion only** — inbox/
artifact zones, janitor TTLs, signed download, no queue. It proves storage invariants well
and proves nothing about queue semantics; better kept as slice 3 material.)

### Recommendation: A, with four non-negotiables

Choose **A**, and pull these four mechanics in even though they "belong" to C, because they
are cheap now and structurally expensive to retrofit:

1. `attempts` as a real table (not a counter column) with `lease_owner` / `lease_expires_at`.
2. Terminal-state check before doing work (kills D3 for free).
3. Atomic promote for artifacts (kills D4 for free).
4. Commit guarded by fencing (kills D5 for free).

Justification against the governing objective — **verifiable portfolio evidence**:

- It produces the evidence that is hardest to fake: a reviewer can submit a file and receive
  a real artifact. Slices B and C produce a system whose correctness has to be taken on
  faith from tests.
- It exercises the riskiest unknown at the earliest possible moment: the queue must be
  consumed from Python while produced from NestJS, which is exactly the friction already
  flagged in `project.md` (BullMQ is awkward from Python). If that boundary is wrong, it is
  better to find out in slice 1 than after building a hardened core on top of it.
- It does not defer the two hardest invariants (fencing, atomic promote), which is the usual
  failure mode of "thin happy path" slices.

Counter-argument to record honestly: A does not demonstrate retry/failure mastery, which is
the most interesting interview material. That is precisely why **C is the recommended second
slice**, before job types 2 and 3 — not after.

**Sequence:** A (2 chained PRs) → C-hardening: reaper, retry classification, DLQ + replay,
progress events (2 chained PRs) → `pdf.merge` (multi-input) → `pdf.split` (multi-output) →
web UI → URL ingestion.

**Review-budget note:** every slice above except B exceeds the 400-line budget, so slicing
will need an explicit delivery decision at proposal time (`ask-on-risk`). Do not adopt a chain
strategy here.

---

## 8. Which job type first

| Dimension | `audio.extract` | `pdf.merge` | `pdf.split` |
| --- | --- | --- | --- |
| Heavy external binary | Yes — ffmpeg (native 8.1.1 verified on PATH) | No | No |
| Dependency weight | High in the container image (ffmpeg + codecs) | Low (pure Python PDF lib) | Low |
| Input arity | 1 | N (needs `job_inputs` from day one) | 1 |
| Output arity | 1 | 1 | N (needs plural artifacts + cap) |
| Wall clock | Long (minutes) — exercises timeouts, heartbeat, soft/hard split | Near-instant — exercises nothing in the governor | Near-instant |
| Progress | High quality — ffmpeg emits structured progress on stdout | Stage labels only | Stage labels only |
| Cancellation | Requires process-group kill (real work) | Trivial/impossible mid-op | Same |
| Output size | Large — real storage pressure | Small | N × small |
| Idempotency difficulty | Medium (large output, encoding nondeterminism) | Trivial | Low |
| Exercises the pipeline vs the library | **Pipeline-heavy** | Library-heavy | Mixed, library-leaning |

**Recommendation: `audio.extract` first.** It is the only v0.1 type that stresses the
*runtime* — subprocess lifecycle, process-group kill, streaming progress parsing, wall-clock
timeouts, heartbeat renewal, large outputs — and the runtime is where the pipeline's hard
invariants live. The PDF types would let the pipeline look healthy while the governor,
progress, and timeout paths go untested.

Order: `audio.extract` → `pdf.merge` (proves multi-input, cheap and fast) → `pdf.split`
(proves multi-output and output caps). The PDF types also give fast deterministic tests with
no external binary, which makes them the right *second* type, not the first.

Counter-argument to record: ffmpeg makes CI heavier and output bytes are not guaranteed
bit-identical across builds, so artifact tests should assert *properties* (duration, codec,
bitrate via ffprobe) rather than hashes — unless research question R7 says otherwise.

---

## 9. Open questions needing external evidence (research candidates)

Each is phrased to be answerable and to name the decision it unblocks. **None of these are
answered here from memory.**

| # | Question | Decision it unblocks |
| --- | --- | --- |
| R1 | Under Redis Streams consumer groups, what exactly happens to a pending entry when a consumer dies? Is `XAUTOCLAIM` the accepted recovery path, and what minimum idle time is realistic? | Whether a queue-level claim can replace or must accompany the DB lease, and how the reaper is written |
| R2 | With RabbitMQ (quorum queues), when is an unacked message redelivered, how does `prefetch` interact with it, and does delivery-count tracking replace a custom attempt counter? | Whether attempt counting lives in queue metadata or in Postgres |
| R3 | What native delayed-retry/backoff does each candidate offer (RabbitMQ TTL+DLX or delayed-message plugin vs Redis Streams' lack of native delay), and what does each cost operationally? | Whether retry scheduling lives in the queue or in `jobs.available_at` |
| R4 | How do the maintained Python clients (redis-py, aio-pika/pika/Celery) handle groups/acks/claiming, and do they pair with a NestJS producer without a shared BullMQ dependency? | The contract/adapter layer design, and whether the "JSON schema + zod/pydantic" direction survives contact with the client libraries |
| R5 | What dead-letter and replay tooling exists out of the box in each candidate, and can an operator replay one message without custom code? | The scope of the DLQ/replay slice, and how much of C9 must be built |
| R6 | Is ffmpeg progress reliably parseable via `-progress pipe:1`, and how are missing or out-of-order `out_time_ms` values handled to keep a monotonic percentage? | The progress contract: continuous percentage vs stage labels |
| R7 | Is ffmpeg mp3 output deterministic for a fixed version and fixed args, and what do practitioners assert in tests — ffprobe properties or hashes? | The golden-file test strategy and whether content-hash artifact dedupe is viable |
| R8 | What are currently accepted SSRF mitigations for server-side URL fetch (specifically DNS rebinding), and how is egress restriction implemented in practice for containers? | Whether URL ingestion ships in v0.1 or is deferred |
| R9 | How large is a Python 3.11 + ffmpeg container, and how does installing ffmpeg via package manager compare with a static build for CI time? | Worker packaging and the CI time budget |
| R10 | For multi-hundred-MB browser uploads, what do real systems do — multipart through the API, or presigned direct-to-storage PUT with server-side verification? | Whether the API is a byte pipe or a metadata service (§5). This is the largest architectural fork in the document |

---

## 10. Assumptions to validate

Rule applied: an unanswered product question becomes an assumption to validate, never a
decided fact. **All 12 below are unvalidated.**

| # | Assumption | Why it matters | Validation route |
| --- | --- | --- | --- |
| AV1 | v0.1 is effectively single-tenant with no accounts | Determines the ownership model, signed-URL authorization, and whether rate limiting is per-IP | Product question in the proposal round |
| AV2 | URL ingestion is in scope for v0.1 | If deferred, SSRF surface and an entire abuse class disappears and slice 1 shrinks | Product question (tied to R8) |
| AV3 | Maximum input size is ~2 GiB video / ~200 MiB PDF | Drives ingestion design (direct upload vs presigned) and storage choice | Product question (tied to R10) |
| AV4 | Artifact retention is bounded (e.g. 7 days), not indefinite | Decides whether a janitor must exist in v0.1 and whether outputs must be re-derivable | Product question |
| AV5 | Job cancellation is out of scope for v0.1 | Removes T9 and cooperative-cancel plumbing from slice 1 | Product question |
| AV6 | A job may reference multiple inputs (needed by `pdf.merge`) | Decides whether `job_inputs` ships as a table in slice 1 or is retrofitted — cheap now, migration later | Confirm with the user; recommend modelling inputs as plural now |
| AV7 | Queue order is FIFO with no priorities or fairness in v0.1 | Keeps the dispatcher simple; avoids per-tenant scheduling | Product question |
| AV8 | The web UI is not part of the first slice | Cuts the first slice to API + worker; the UI arrives once the contract is stable | Product question |
| AV9 | Progress may be stage-labelled rather than a continuous percentage for fast job types | Determines the event contract shape and what the UI can show | Product question (tied to R6) |
| AV10 | Retry budget is 3 attempts with exponential backoff and jitter | Sets T4/T8/T10 guards and the DLQ threshold; changing it later is a config change if the attempt table exists | Confirm defaults |
| AV11 | Docker Compose is the delivery and demo mechanism for reviewers | Blocked today: Docker CLI 29.6.2 present but **daemon not running** | Start Docker Desktop before any compose-dependent design/apply work; confirm a live URL is not required |
| AV12 | The Python worker always runs under `uv` with its own environment | The PATH `python` is an unrelated hermes-agent virtualenv and must never be the project runtime | Already an environment fact; keep it a hard rule in the worker's README and CI |

---

## What the proposal phase must not silently decide

| Fork | Why it needs an explicit decision |
| --- | --- |
| Message queue | Stays open. The exploration shows the *shape* of the impact (claim recovery, attempt counting, delayed retry, DLQ tooling) without choosing |
| Byte pipe vs metadata service (§5, R10) | Largest architectural fork; changes the API's role, storage dependencies, and the whole ingestion path |
| Whether URL ingestion ships in v0.1 | Whole abuse class in or out |
| Replay semantics for terminal jobs | New job vs new attempt; determines whether terminal states are truly immutable |
| Review-budget strategy | Every recommended slice exceeds 400 lines; needs an `ask-on-risk` delivery decision, not an invented chain |

## Checklist

- [ ] 9 contexts agreed, with lanes (API / worker / shared) accepted
- [ ] 6 states and 10 transitions accepted; `dead_lettered` rejected as a state
- [ ] Vocabulary table accepted; `job_inputs` plural decided
- [ ] The four non-negotiables of slice A accepted (attempts table, terminal dedupe, atomic promote, fencing)
- [ ] `audio.extract` accepted as the first job type, or overridden with a reason
- [ ] R1–R10 entered as research tasks with owners
- [ ] AV1–AV12 answered or explicitly carried into the proposal as assumptions

## Next step

Proposal phase for `job-pipeline-core` (label provisional): one proposal question round with
3–5 product questions drawn from AV1–AV9, then a proposal that fixes the first slice as
described in §7, with the message queue still open, and a delivery decision recorded if the
slice exceeds 400 changed lines.
