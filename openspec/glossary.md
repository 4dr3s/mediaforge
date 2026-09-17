# MediaForge — Glossary

Read this before writing pipeline code. **If two terms both seem to fit a situation, you
have found a modelling bug, not a wording preference.** Vocabulary drift is how a state
machine rots.

Provenance markers:

- `[E]` — established in `openspec/changes/audio-extract-vertical-slice/explore.md`.
- `[+]` — raised by the project owner, **not yet carried into the change artifacts**.
  Treat as an open item to route through proposal or design, never as a decided fact.

---

## 0. The two distinctions that must never blur

These two are promoted above everything else. Getting either wrong silently is how the
pipeline acquires a bug that no test catches until production.

### 0.1 Job vs message `[E]`

| | Job | Message |
| --- | --- | --- |
| What it is | The durable record of a unit of user intent | An instruction to dispatch that job |
| Where it lives | Postgres (`jobs` row) | The broker |
| Cardinality | One | Zero or more, over the job's life |
| Is it the source of truth? | **Yes** | No — it is only a hint |
| If it is lost | Data loss | The job survives; a relay or the reaper re-dispatches |

The rule that follows from this: **the queue is a notification, the database is the truth.**
A worker never trusts a message. It reads the job row and decides from state.

### 0.2 Attempt vs retry `[E]`

| | Attempt | Retry |
| --- | --- | --- |
| What it is | One execution try by one worker: number, lease owner, expiry, start/end, error class | The *mechanism* that creates the next attempt |
| Is it a thing? | A row in an `attempts` table | A policy (budget, backoff, classification) |
| Where idempotency lives | **Here** | Nowhere — it is not a noun |

Do not write `retries` as a column and do not call an attempt a "run". A counter column
cannot answer "which worker wrote these bytes, and was it still allowed to?" An `attempts`
row can.

---

## 1. Core entities `[E]`

| Term | Meaning | Why it matters here |
| --- | --- | --- |
| **Job** | Durable record of a unit of user intent: `job_id`, type, params, state, inputs, attempts. The source of truth | Everything else is derived from it or points at it |
| **Job type** | A registered operation contract (`audio.extract`): param schema, input/output arity, limits, handler | Not free text, not a file format. The limits table hangs off this |
| **Submission** | The API-level event and record of a user's request: idempotency key, client id, timestamp, resulting `job_id` | A resubmitted identical request is a second submission of the *same* job |
| **Attempt** | One execution try by one worker. Carries `lease_owner`, `lease_expires_at`, `attempt_no`, error class | Idempotency lives here (see §0.2) |
| **Artifact** | An immutable byte product, keyed by an unguessable `artifact_id`, reachable through a canonical key. A job may have many | What the user actually receives |
| **Output** | The handler's return value | Not the artifact. The handler returns handles; the pipeline promotes bytes |
| **Result** | The API's response shape | Not the artifact either. Three words, three concepts |
| **Progress** | Attempt-scoped value in `[0, 1]` plus a **mandatory stage label** | Never a bare percentage without saying *of what* |
| **Lease** | Time-bounded exclusive right of one worker to execute one attempt | The system's only recovery primitive |
| **Dead-letter** | A **message fate**: the destination for messages that cannot progress | Not a job state. The job is `failed`; the message is dead-lettered |
| **Cancel** | User-requested termination of a job | Pick "cancel". Kill "abort", "stop", "terminate" |
| **Replay** | Operator-initiated re-execution that mints a **new** job referencing the original (`replayed_from`) | Not a retry. Retry happens inside one job's attempt budget; replay happens after terminality |

---

## 2. Queue and broker `[E]`

| Term | Meaning | Why it matters here |
| --- | --- | --- |
| **Broker** | The intermediary process that stores messages until someone consumes them. Candidates: Redis Streams, RabbitMQ | Undecided by design; closed by an ADR, not by preference |
| **Queue** | The logical place where messages wait | A concept; the broker is one implementation of it |
| **Producer / Consumer** | Who publishes / who consumes | NestJS produces, Python consumes. That language crossing is the project's riskiest unknown |
| **Ack / Nack** | "I finished, delete it" / "I failed, do something" | The ack is an explicit contract. Silence is indistinguishable from death |
| **At-least-once** | Delivery guarantee: one or more times, never zero | The only honest guarantee a real broker gives. All of §3 exists because of this |
| **At-most-once** | May lose, never duplicates | Rarely what you want; loses work silently |
| **Exactly-once delivery** | Delivery exactly once | **Does not exist over a network.** Anyone selling it to you is selling you a fiction |
| **Visibility timeout** | The window during which a consumer's claim on a message is respected; on expiry the message becomes visible again | The broker's analogue of a lease |
| **Consumer group** | Several consumers sharing one stream, each message going to one of them | What makes horizontal worker scaling safe |
| **PEL / `XAUTOCLAIM`** | In Redis Streams: the list of delivered-but-unacked entries, and the command that reclaims them for another consumer | Determines whether claim recovery lives in the broker, in Postgres, or both |
| **Prefetch / QoS** | How many unacked messages a consumer holds at once | Too high and a slow worker hoards work another worker could finish |
| **Redelivery** | Re-delivery of a message already delivered | The mechanism by which duplicates appear at all |
| **Backoff + jitter** | Retrying after ever-longer, randomized delays | Without jitter, every retry stampedes at the same instant |
| **Delayed retry** | Retrying *later* rather than now | Lives either in the queue (TTL + DLX) or in `jobs.available_at`. Where it lives is an open question |
| **Dead-letter queue (DLQ)** | A separate destination for messages that cannot progress | See §1 "dead-letter": a message fate, never a job state |
| **Poison message** | A message that will always fail (e.g. a corrupt input) | Retrying it three times is pure waste. Classify it non-retryable |

---

## 3. Reliability and idempotency `[E]`

The most important family in the project. Six words here are the whole pipeline.

| Term | Meaning | Why it matters here |
| --- | --- | --- |
| **Idempotency** | An operation that applied N times has the same result as applied once | The only way to survive at-least-once |
| **Idempotency key** | A client-supplied unique token per submission | The only real defence against a double click. Disabling the button in the UI is *not* a defence |
| **Dedupe** | Detecting and suppressing duplicates | Here it is done **by state**: "if this job is already terminal, ack and exit" |
| **Exactly-once effect** | A single effect despite multiple deliveries | The real target, instead of the fictional exactly-once delivery |
| **Outbox pattern** | Write the domain row and a "to be published" row in **one transaction**; a relay publishes afterwards | Prevents the unrecoverable case: job `queued` with no message, nobody ever processes it |
| **Relay** | The process that reads the outbox and publishes to the broker | Frequently overlooked; it is what closes the gap the transaction cannot |
| **Fencing token** | A monotonically increasing value (`attempt_no`) attached to writes so stale writers are rejected | A zombie worker may *work*, but it can never *commit* |
| **Lost update** | Two writers read the same value and one silently clobbers the other | The classic concurrency bug this whole family exists to prevent |
| **Compare-and-set (CAS)** | `UPDATE ... WHERE id = ? AND state = ?` — the database rejects the write if the precondition no longer holds | The pattern of the whole design: **every** transition is a CAS, never a read-modify-write |
| **Read-modify-write** | Read in the app, decide in the app, write in the app | The antipattern CAS replaces. Between the read and the write, another writer may change everything |
| **Reconciliation** | Accepting that a race can leave inconsistency, and fixing it with a periodic sweep instead of an impossible transaction | A crash between promote and commit leaves an orphan. Sweep it; do not pretend it cannot happen |

---

## 4. Time and coordination `[E]`

| Term | Meaning | Why it matters here |
| --- | --- | --- |
| **Lease** | Exclusive right to execute, **bounded in time** | The recovery primitive. This glossary deliberately rejects "lock" (implies indefinite) and "visibility timeout" (one vendor's word for the same idea) |
| **TTL** | Time to live; when a thing expires | `lease_expires_at` is a TTL |
| **Heartbeat** | A periodic signal that renews the lease and proves the worker is alive | What distinguishes "slow" from "dead" |
| **Reaper / Janitor** | A periodic process that expires dead leases, re-queues, and sweeps orphaned storage | Without one, a dead worker leaves a job `running` forever |
| **Stale worker / zombie** | A worker that lost its lease but is still running | Duplicate *work* is an accepted cost; duplicate *commit* is impossible |
| **Race condition** | Two processes competing for one resource with an unpredictable outcome | The reason for everything above |
| **Cooperative cancellation** | The worker *checks* a flag; it is not interrupted by force | Therefore: do not promise instant cancellation in product copy |
| **Process group** | The parent process plus its children | Kill only the parent and the ffmpeg children survive, eating CPU |

---

## 5. State machine `[E]`

| Term | Meaning | Why it matters here |
| --- | --- | --- |
| **State machine** | A formal model: a set of states and the permitted transitions between them | It turns "did it work?" into a decidable question |
| **State** | The job's situation: `created`, `queued`, `running`, `succeeded`, `failed`, `canceled` | Six only. `retrying`, `timed_out`, `expired`, `dead_lettered` are deliberately **not** states — they multiply the matrix without adding information |
| **Terminal state** | A state you never leave: `succeeded`, `failed`, `canceled` | Immutable. This is exactly why replay mints a new job instead of reviving a terminal one |
| **Transition** | A move from one state to another | Ten in total, each owned by exactly one component |
| **Guard** | The condition that must hold for a transition to happen | "lease still current", "attempts remain", "`available_at <= now`" |
| **Invariant** | A property that must hold at all times, not just at the end | "The set of permitted transitions per component is disjoint, and every transition is one conditional `UPDATE ... WHERE id = ? AND state = ?`" |
| **Writer / owner** | Which component may perform a transition | Three disjoint sets: API, Worker, Reaper. Disjointness is what stops two components fighting over one job |

---

## 6. Storage and artifacts `[E]`

| Term | Meaning | Why it matters here |
| --- | --- | --- |
| **Inbox zone** | Where inputs land: `inbox/{job_id}/{ordinal}`, where `ordinal` is the input's position within the job (1, 2, …) | Written by the API on upload. The worker is **read-only** here — URL ingestion is deferred (AV2) |
| **Work / scratch zone** | A disposable per-attempt directory: `work/{job_id}/{attempt_no}/` | Where the handler writes. Deleted on every exit path, either outcome |
| **Canonical key** | The final, official artifact location: `artifacts/{job_id}/{artifact_id}` | Only ever reached via promote |
| **Atomic promote** | Moving scratch to the canonical key with a `rename()` | On one filesystem `rename` is atomic: a reader sees the old file or the new one, **never half of it** |
| **Orphan artifact** | An artifact at a canonical key with no job row referencing it | The expected residue of a crash between promote and commit. The retry overwrites the same key; the janitor sweeps the rest |
| **Retention** | How long something is kept before deletion | An open product question: bounded (e.g. 7 days) or indefinite |
| **Signed URL** | A time-bounded link carrying its own credential, e.g. 15 minutes | Cheap, but requires the store to be reachable by the browser |
| **Presigned PUT** | The client uploads **directly** to storage with a temporary token; the API only records metadata | The alternative to a byte pipe. Needs server-side verification that the claimed size and hash are real |
| **Byte pipe / proxy** | The API itself streams the bytes | Simple authorization, but the API becomes a bandwidth bottleneck |
| **Unguessable id** | A 128-bit identifier that *is* the access capability | If ids are enumerable, anyone can download everyone's files |
| **Content-Disposition** | The HTTP header that names the downloaded file | Sanitize it. The user's filename is display metadata and never a storage key |

---

## 7. Limits, hostile input and containment

| Term | Meaning | Why it matters here |
| --- | --- | --- |
| **Resource limit** | A hard cap on input size, wall clock, lease TTL, attempts, concurrency, output size or disk `[E]` | The governing rule: *hostile input must not make the worker do more than the limit table allows* |
| **Argument injection** | Smuggling extra arguments into a command | Never accept user-supplied ffmpeg args; build argv arrays from a validated enum; never `shell=True` `[E]` |
| **Path traversal** | Using `../` to escape the intended directory | Prevented by construction: storage keys are server-generated `[E]` |
| **SSRF** | Server-Side Request Forgery: making our server fetch an internal address (e.g. cloud metadata) | The cost of accepting user URLs. Backstop is egress network policy, because per-resolution checks lose to DNS rebinding `[E]` |
| **DNS rebinding** | An attacker's DNS answer changes between validation and connection | Why a resolve-then-check is not sufficient on its own `[E]` |
| **Extension / content-type allowlist** | Accepting only the file types the job-type registry declares, and rejecting everything else before dispatch | **`[+]` Not in explore.md §6.** It covers size and malformed containers but never "wrong type entirely" |
| **Content sniffing (magic bytes)** | Reading the actual file signature instead of trusting the name | **`[+]`** An extension is attacker-controlled data. A `.apk` renamed `.mp4` bypasses any name-based check |
| **Sandboxing / blast radius** | Containing what happens *when* a file passes every check and still reaches a codec bug | **`[+]`** An allowlist reduces surface; it does not contain a codec CVE. Read-only fs, no network, non-root, one job per process |

---

## 8. Architecture, contracts and process `[E]`

| Term | Meaning | Why it matters here |
| --- | --- | --- |
| **Bounded context** | A boundary inside which one model and one vocabulary hold consistently (DDD) | Nine of them. They are **not** nine services — they are conceptual boundaries |
| **Lane** | Which runtime owns it: API (NestJS), WKR (Python), SHR (shared contract honored by both) | Answers "where does this go?" in one word |
| **Shared contract** | A definition both sides must honor | The state machine and the job contract are written **once**, honored **twice** |
| **Port / adapter** | The handler depends on an interface, not on the filesystem, S3 or Postgres | Enables tests without real storage, and a storage backend swap |
| **Pure handler** | `(inputs, params, scratch) -> outputs`, touching neither DB nor queue | The healthiest boundary in the design, and the only truly unit-testable part |
| **Contract layer** | The versioned JSON schema: zod on the TypeScript side, pydantic on the Python side | The project's working direction. Its motivation is that **two languages must agree on one message and job shape** — **not** that BullMQ is awkward from Python; that claim is refuted by the vendor's own documentation (`ADR-0002`, R4) |
| **Schema validation** | Parse and **reject** at the boundary | Validate once, at the edge, never in the middle |
| **ADR** | Architecture Decision Record: a short document recording one decision, its alternatives, and its consequences | The queue choice is closed by an ADR, not by a chat |
| **Vertical slice** | A thin piece that crosses **every** layer for one use case | The opposite of building layer by layer. The delivery strategy here |
| **Happy path** | The failure-free route | The trap: exercising only the happy path makes a pipeline *look* healthy while the governor, progress and timeout paths go untested |
| **Fault injection** | Deliberately failing: `always_fails`, `flaky`, `hangs` | The strongest interview evidence, because recovery is demonstrated rather than asserted |
| **Golden file / property assertion** | Comparing exact bytes, versus asserting properties (duration, codec, bitrate) | ffmpeg output is not guaranteed bit-identical across builds, so artifacts assert properties via ffprobe |
| **Review budget** | The lines-changed ceiling a human can review well: 400 here | Every recommended slice exceeds it, so it needs an explicit delivery decision |
| **Delivery strategy** | How the change reaches review: single PR, chained PRs, or an accepted exception | Currently `ask-on-risk`. A chain strategy is a decision to make, never a default to assume |
| **Assumption to validate** | An unanswered product question, recorded as such | The open rule: an unanswered question never becomes a decided fact |
