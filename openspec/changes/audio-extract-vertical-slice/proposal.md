# Proposal — `audio-extract-vertical-slice`: the first working job pipeline

**Answer first.** The first slice ships exactly one path that works end to end: a client
uploads a video, the API accepts and validates it, the worker runs `audio.extract` via
ffmpeg, the mp3 is promoted atomically, and the client downloads it through a capability
grant. The four mechanics that are cheap now and structurally expensive to retrofit — a real
`attempts` table, terminal-state dedupe before work, atomic promote, and fencing-guarded
commit — are in from day one. Everything else (reaper, DLQ, replay, progress streaming,
cooperative cancel, job types 2 and 3) is explicitly deferred.

> **Naming.** `job-pipeline-core` was the provisional label from `explore.md` §7 and is not
> the decided scope. The change is **`audio-extract-vertical-slice`**, and the change
> directory was renamed to match. Later slices — hardening, `pdf.merge`, `pdf.split` — are
> separate changes with separate directories.

---

## Why

| Driver | Consequence |
| --- | --- |
| Governing objective is **verifiable portfolio evidence** | The evidence hardest to fake is a reviewer submitting a file and receiving a real artifact. Slices B and C produce systems whose correctness must be taken on faith from tests; this slice produces a demo. |
| The **TS ↔ Python contract crossing** is what this slice proves | **Not because it is awkward.** The earlier premise that BullMQ is awkward to consume from Python was refuted by research and by the vendor's own documentation (`ADR-0002`, R4). The crossing still matters: the producer is TypeScript and the consumer is Python, so the message shape and the job contract must agree across two languages, and this slice proves that with real bytes. The residual risk is narrower — the Python client's API surface — and it is closed by a spike before implementation |
| Do not defer the two hardest invariants | Fencing and atomic promote are the usual casualties of a "thin happy path" slice. They are pulled in now. |
| Honest counter, on the record | Slice A does **not** demonstrate retry/failure mastery, which is the strongest interview material. That is precisely why slice C (hardening) is the recommended *second* slice — before job types 2 and 3, not after. |

---

## What Changes

### Components built in this slice

| Area | Lane | What lands |
| --- | --- | --- |
| Submission & Validation (C1) | API | Upload-only ingestion; job-type registry validation; **input type allowlist + magic-byte sniffing**; mint `job_id` + creator token; plural `job_inputs` rows |
| Job Registry & Lifecycle (C2) | SHR | The 6-state machine; CAS-only transitions; terminal immutability; real `attempts` table |
| Dispatch & Queue Ingress (C3) | API | Transactional outbox + relay, against a **broker behind a queue port**. Mechanism decided: **Redis Streams with consumer groups** (`ADR-0002`); the port keeps the domain contract broker-agnostic |
| Worker Runtime & Lease (C4) | WKR | Claim + lease, heartbeat renewal, terminal-state dedupe before work, fencing-guarded commit |
| Job-Type Execution (C5) | WKR | Pure handler contract `(inputs[], params, scratch) -> outputs`; `audio.extract` via ffmpeg; **sandboxing doctrine** |
| Artifact & Storage Lifecycle (C6) | SHR | The storage port (ADR-0001), inbox/work/artifacts zones, atomic promote, worker read-only on inbox |
| Download Grant & Access Control (C8) | API | Capability authorization (hashed creator token), `createReadGrant`, the "succeeded but artifact expired" response case |

**Not touched in this slice:** C7 (progress/event stream) and C9 (DLQ/replay/reaper) are
deferred; they contribute no code here.

### Capability → spec map

Each capability's requirements live in their own spec directory under `specs/`. This mapping is
normative: it is how a reader gets from a bounded context to its requirements.

| Context | Capability | Spec |
| --- | --- | --- |
| C1 | Submission & Validation | `specs/submission-validation/spec.md` |
| C2 | Job Registry & Lifecycle | `specs/job-registry-lifecycle/spec.md` |
| C3 | Dispatch & Queue Ingress | `specs/dispatch-queue-ingress/spec.md` |
| C4 | Worker Runtime & Lease | `specs/worker-runtime-lease/spec.md` |
| C5 | Job-Type Execution | `specs/job-type-execution/spec.md` |
| C6 | Artifact & Storage Lifecycle | `specs/artifact-storage-lifecycle/spec.md` |
| C8 | Download Grant & Access Control | `specs/download-grant-access-control/spec.md` |
| C7, C9 | Deferred — no spec in this slice | — |

### State machine in v0.1

All six states exist and are reachable. **Six of ten transitions ship; four are deferred.**

| # | Transition | Owner | In v0.1? |
| --- | --- | --- | --- |
| T1 | `created` → `queued` | API | ✅ upload-only (no URL clause) |
| T3 | `created` → `canceled` | API | ✅ single CAS, no worker |
| T4 | `queued` → `running` | Worker | ✅ claim + lease |
| T5 | `queued` → `canceled` | API | ✅ no active lease |
| T6 | `running` → `succeeded` | Worker | ✅ fencing-guarded, after atomic promote |
| T7 | `running` → `failed` | Worker | ✅ **every** failure observed by the lease holder — both classes commit, distinguished by `error_code`. "Retries exhausted" is **not reachable in v0.1**: T8 is the only requeue path and it is deferred, so `attempts_used` can never exceed 1 |
| T2 | `created` → `failed` (input TTL) | Janitor | ⛔ deferred (no janitor) |
| T8 | `running` → `queued` (lease expiry) | Reaper | ⛔ deferred (no reaper) |
| T9 | `running` → `canceled` (cooperative) | Worker | ⛔ deferred |
| T10 | `queued` → `failed` (poison message) | Reaper | ⛔ deferred |

Terminal immutability is enforced from day one: `succeeded`, `failed`, and `canceled` are
never left. `canceled` has inbound transitions (T3, T5), so it is a reachable state — see
the AV5 rationale under [Carried assumptions](#carried-assumptions-to-validate).

### Data model (new tables)

> **This is not the schema.** The table below lists only the notable fields and the decisions
> attached to them. The concrete DDL — full column lists, types, constraints, indexes — and the
> Prisma schema are written in **design**.

| Table | Purpose | Key notes |
| --- | --- | --- |
| `jobs` | Source of truth | `job_id` (UUID, unguessable), type, params, state, terminal immutability |
| `job_inputs` | Plural inputs from day one | PK `id`; **unique `(job_id, ordinal)`**, where `ordinal` is the input's position within the job (1, 2, …) and the storage key is `inbox/{job_id}/{ordinal}` |
| `attempts` | Idempotency lives here | PK `id`; real rows: `attempt_no`, `lease_owner`, `lease_expires_at`, start/end, error class — **not** a counter column |
| `submissions` | Submission event record | `idempotency_key`, unique `(client_id, key)`, and **`job_id` as a foreign key** — the submission *records* the resulting job, it does not mint the id. The API writes `jobs`, `submissions` and the outbox row **in one transaction** |
| `artifacts` | Immutable byte product | `artifact_id`; **`storage_key`** — the canonical key, i.e. the bridge to the bytes; `byte_size`, `content_type`, `checksum`, `filename` (display only); `created_at`, `expires_at` (7-day policy) |

**Every table carries a UUID primary key.** The **database never stores the bytes**: an artifact
row is a pointer plus metadata. The bytes live in the storage backend.

**`attempts_used` is derived, never stored.** Any guard that needs it — for example T4's
`attempts_used < max_attempts` — computes it from the `attempts` table (`count(*)`, or
`max(attempt_no)` for that job). Adding a counter column would violate non-negotiable #1.

### Storage (per ADR-0001)

- One `StoragePort` with the local filesystem adapter now; S3 as a coexisting adapter later.
  `promote(ref) → ArtifactHandle`, `putScratch`, `createReadGrant`, `remove`.
- Inbox written by the API only; the worker is **read-only** on inbox (URL ingestion is out).
- Upload streams to disk, never buffers to memory (ADR-0001 E4).
- Download uses `createReadGrant`; the local adapter returns `{ kind: 'proxy' }`, so the API
  streams the artifact. No storage path or credential ever reaches the client.

### Handler contract

`(inputs[], params, scratch) -> outputs`, from day one. Arity is a job-type registry value:
`audio.extract` = 1, `pdf.merge` = N ≤ 20, `pdf.split` = 1. `audio.extract` asserts arity 1.
Handlers never touch the DB, the queue, or the canonical artifact key.

---

## Impact

### Affected areas

| Context | Change |
| --- | --- |
| C1 | Accepts uploaded files only; validates declared type + magic bytes before dispatch |
| C2 | 6 states, 6 transitions, terminal immutability, `attempts` table |
| C3 | Outbox + relay behind a queue port (broker unspecified) |
| C4 | Claim/lease/heartbeat, terminal dedupe, fencing-guarded commit |
| C5 | `audio.extract` ffmpeg handler, sandboxed, one job per process |
| C6 | Storage port + three zones, atomic promote, worker read-only inbox |
| C8 | Capability auth, `createReadGrant`, "succeeded but expired" response |
| C7, C9 | No code in this slice |

### Cross-cutting consequences

- **No new state beyond the six.** The expired-artifact case is a *response*, not a state.
- **The queue is a notification; Postgres is the truth.** The worker never trusts a message;
  it reads the job row and decides from state.
- **Terminal immutability** makes replay (later) mint a new job, never mutate an old one.

---

## Scope (in)

1. End-to-end `audio.extract` carrying real bytes: upload → validate → dispatch → claim →
   ffmpeg → promote → download.
2. The four non-negotiables: real `attempts` table, terminal-state dedupe before work, atomic
   promote, fencing-guarded commit.
3. The 6-state model with transitions T1, T3, T4, T5, T6, T7.
4. Transactional outbox + relay (queue-agnostic).
5. Plural `job_inputs` with the registry-declared arity guard on T1.
6. Capability authorization (128-bit `job_id` + hashed creator token).
7. 7-day retention policy declared; `artifacts.expires_at` written.
8. Input type allowlist + magic-byte content sniffing (owner-raised).
9. Sandboxing doctrine: **container per worker** (read-only rootfs, non-root, resource
   limits) with **one process per job** inside it; the handler child runs with no network
   (owner-raised).
10. Output size cap, declared per job type in the registry and verified **after promote** and
    before the outcome commits; an oversized artifact fails the job.

## Non-goals (out of this slice)

- **Reaper / janitor** — no lease-expiry requeue (T8), no input-TTL failure (T2), no poison
  message (T10), no retention sweep, no orphan-artifact sweep.
- **Dead-letter queue** and **replay** (C9).
- **Progress streaming** (C7) and any event-stream payloads.
- **Cooperative cancellation while running** (T9).
- **Job types 2 and 3** — `pdf.merge` and `pdf.split`.
- **Public URL ingestion** — v0.1 accepts uploaded files only (AV2).
- **User accounts** — no identity, no login, no per-tenant scheduling.
- **Web UI** — no UI in this slice.
- **Retry rescheduling / backoff** — T7 can classify a failure, but automatic re-dispatch
  (T8) is the reaper's job and is deferred.
- **Backpressure** — no queue-depth threshold and no `429`/`503` on submission. Queue growth is
  unbounded in this slice, and the per-IP rate limit is the only valve. `explore.md` §6 proposed
  a depth threshold; deferring it is deliberate, and it is recorded here rather than dropped.

---

## Decided items

### Confirmed product decisions (question round — do not re-open)

**AV2 — Public URL ingestion is deferred out of v0.1.** Uploaded files only.

- The entire SSRF / DNS-rebinding / per-hop revalidation / egress-policy surface leaves v0.1.
- R8 leaves the critical path.
- C1's "upload or URL ingestion plan" becomes **upload-only**.
- T1's trigger loses its URL clause.
- The worker loses write access to the inbox zone (read-only there).

**AV6 — Job inputs are plural from day one.**

- A `job_inputs` table with unique `(job_id, ordinal)`; key shape `inbox/{job_id}/{ordinal}`.
- Per-type **arity** is a job-type registry value (`audio.extract` = 1, `pdf.merge` = N ≤ 20,
  `pdf.split` = 1).
- The handler contract is `(inputs[], params, scratch) -> outputs` from day one; `audio.extract`
  asserts arity 1.
- T1's guard becomes: input handles exist, the count matches the declared arity, and every
  size is within the cap (200 MB per ADR-0001 D5).

**AV1 — No user accounts in v0.1.** Authorization is a capability.

- An unguessable 128-bit `job_id` plus a creator token returned once at submission.
- The creator token is a bearer secret: stored **hashed**, and **never logged** (neither the
  token nor the full URL).
- The rate limit is **per-IP**; the shared-NAT limitation is recorded honestly in the spec.
- C8 authorizes by capability, never by identity.

**AV4 — Retention is bounded at 7 days** for both inputs and artifacts.

- The policy is declared in v0.1; the artifact row carries `expires_at`.
- The actual sweep ships with the hardening slice — **no janitor in slice 1**.
- Terminal states are immutable, so when a job is `succeeded` but its artifact has expired,
  the job **stays `succeeded`**. This is a new **response case**, not a new state.
- The download endpoint must distinguish "succeeded but artifact expired" from "failed".

### Owner-raised requirements (must land as requirements, not footnotes)

1. **Input type allowlist + content sniffing.** Enforce the declared file types against the
   job-type registry, and validate the actual file signature (magic bytes) rather than
   trusting the extension. Rationale: with SSRF out of v0.1, hostile file *content* is the
   primary remaining vector — `explore.md` §6 covers "malformed container" but never "wrong
   type entirely".
2. **Sandboxing / blast-radius containment as a doctrine.** An allowlist reduces surface but
   does not contain a codec CVE. A container per worker with a read-only rootfs, a non-root
   user and resource limits contains the damage; a fresh process per job keeps jobs from
   contaminating one another. The **handler child** runs with no network — the worker cannot,
   because it needs Postgres and the queue.

### Already accepted (input, not re-litigated)

- **ADR-0001** — ingestion transport, storage port, and delivery path. Supersedes
  `explore.md` §6's 2 GiB cap for v0.1: the `audio.extract` input cap is **≤ 200 MB**, as a
  registry value (D5). This ADR is authority for v0.1; `explore.md` is the preserved snapshot.

### Sandbox policy (decided)

- **One container per worker** — ephemeral, read-only root filesystem, non-root user, resource
  limits. This is the **host ↔ worker** boundary, and it is the sandbox.
- **One process per job inside it.** This is the **job ↔ job** boundary.
- The **handler / child process** (ffmpeg) runs with **no network**, non-root and a read-only
  filesystem. The **worker itself keeps network access limited to Postgres and the queue** — it
  needs both to claim and to commit. Stating "no network" for the worker would be
  unimplementable.
- Docker is available (AV11 resolved), so this is enforceable in v0.1. Escalate to
  container-per-job only if a job ever becomes arbitrary executable code — today the work is
  "run ffmpeg over a file", which does not.

---

## Carried assumptions to validate

These are **unresolved** and recorded as assumptions to validate — never as decided facts.

| # | Assumption | Recommendation recorded |
| --- | --- | --- |
| AV5 | Cancellation scope | **Split.** Keep T3 (`created`→`canceled`) and T5 (`queued`→`canceled`) in v0.1 — each is a single CAS with no worker involvement. Defer T9 (`running`→`canceled`, cooperative cancel). **Rationale:** dropping all cancellation would give `canceled` zero inbound transitions, making it an unreachable state — the same defect `explore.md` already rejected for `dead_lettered` and `retrying`. |
| AV7 | Queue order | FIFO; no priorities or fairness. |
| AV8 | Web UI | Not part of the first slice. |
| AV9 | Progress shape | May be stage-labelled rather than a continuous percentage for fast job types (tied to R6). |

Still open from `explore.md` §10 and carried forward: **AV10** (3-attempt budget with
exponential backoff + jitter) — **inert in v0.1**: with T8 deferred there is no requeue path,
so the budget can never be consumed. It becomes meaningful when the reaper lands.

**AV11 — RESOLVED.** Re-verified in this session: the Docker daemon **is** running (server
`29.6.2`, API `1.55`). It is no longer a blocker for compose-dependent work. Caution: an
unrelated container (`tiendita-postgres`) is running — MediaForge must use **its own**
container, volume and database, never that one.

**AV12** (worker always runs under `uv`; the PATH `python` is never the project runtime).

**AV13 (new — raised by the project owner). Job discoverability.** With no accounts there is no
identity, and therefore no "my jobs": a user cannot find a job again unless the client stored
its `job_id` and creator token locally. Registered as a product question to resolve in design.
Leading option for v0.1: client-side storage, with a token-authenticated listing endpoint
deferred until something resembling identity exists.

---

## Open decisions

| Decision | Status | Who/what closes it |
| --- | --- | --- |
| **Message queue mechanism** | **DECIDED — Redis Streams with consumer groups.** The broker family was chosen by the project owner; the mechanism was decided by `ADR-0002` after research R1/R3/R4. Dispatch and consumption stay behind a queue port and no broker-specific vocabulary enters this slice's contract | `ADR-0002` (accepted). Residual: confirm the Python client's `XREADGROUP`/`XACK`/`XAUTOCLAIM` API surface by spike before implementation |
| Test runner | `unresolved-pending-design` | Design phase (Vitest / pytest / Playwright candidates). Not decided here. |
| Delivery strategy | `ask-on-risk`, review budget 400 lines | A delivery decision is **required** — see below. |

**Delivery note.** Slice A is estimated at ~800–950 changed lines, which exceeds the 400-line
review budget — as does every recommended slice except B. A delivery decision
(`ask-on-risk`) is therefore required before design/implementation proceeds. This proposal
**records the requirement**; it does not choose a chain strategy or infer `size:exception`
(which requires explicit acceptance).

---

## Architecture surface deferred to design

The proposal fixes **what** and **why**. It does not specify **how the system is put together**.
The following are deliberately deferred to `sdd-design`, listed here so the deferral is tracked
instead of reading as an omission:

| # | Deferred item | Constraint already recorded |
| --- | --- | --- |
| 1 | Process topology — how many processes, what runs where | Sandbox decision above: one container per worker, one job per process |
| 2 | Repository / module structure — where the storage port, the queue port and the shared contract live | The bounded contexts and their lanes (API / WKR / SHR) are the boundaries to respect |
| 3 | Database access from **two languages** | **Prisma is the ORM preference (TypeScript).** Prisma has no Python client, so the worker needs its own path to Postgres — see the fork below |
| 4 | Migration ownership | **Exactly one owner.** Prisma owns migrations, or the Python side does — never both, or the schema drifts |
| 5 | The TS ↔ Python contract mechanics | Direction already recorded in `project.md`: versioned JSON contract, zod on the Node side, pydantic on the Python side |
| 6 | Configuration, secrets, observability | Creator tokens and DB credentials must never reach logs (AV1) |

### The architecture fork this exposes

`C2` (Job Registry & Lifecycle) is lane **SHR** — shared. Transitions **T4, T6 and T7 are owned
by the worker**, which runs **Python**. The invariant *"every transition is one conditional
`UPDATE ... WHERE id = ? AND state = ?`"* is therefore implemented **twice, in two languages**,
and **the fencing guarantee lives in the Python half**.

> This is the project's biggest unnamed risk: if the two CAS implementations diverge, fencing
> silently stops working and no test catches it.

| Option | How | Trade-off |
| --- | --- | --- |
| Worker writes Postgres directly | Python executes its own CAS | Fewer hops. Cost: **the invariant exists twice** and must stay semantically identical |
| **API is the only writer** | The worker requests claim/commit over HTTP | **One CAS implementation** (Prisma). Cost: the API sits in the latency path of every claim and commit, and the state machine moves behind an HTTP boundary |

Design chooses one and records it as an ADR.

### UUID strategy

Prisma supports `uuid(7)`, but **`uuid()` is ORM-level**: Prisma Client generates the value and
the database does not. If the API generates ids through Prisma while the worker generates its
own, the system ends up with **two id generators**. The single-source form is
`@default(dbgenerated("uuidv7()")) @db.Uuid`, which lets **PostgreSQL 18** generate the UUIDv7 —
and the container already running is Postgres 18.

One consequence to accept consciously: a UUIDv7 embeds a millisecond timestamp, so a `job_id`
used directly as a capability leaks *when* the job was created. 74 random bits remain —
infeasible to guess, but not 122. If zero leak is required, carry a separate `public_id` UUIDv4
for the URL instead.

---

## Risks

| Risk | Likelihood / impact | Mitigation |
| --- | --- | --- |
| Slice A never survives a crash (no reaper → a dead worker leaves a job `running`) | Accepted, by design | The four non-negotiables are in; C-hardening (reaper, retry, DLQ) is the recommended second slice |
| A transient failure **fails** the job instead of retrying it | Accepted, by design | Both failure classes commit T7 in v0.1, distinguished by `error_code`. Retrying is impossible without a reaper (T8), and committing *nothing* would strand the job or storm the queue; failing is the honest option, and the retryable class moves to T8 when the reaper lands |
| The Python client's consumer-group API surface (`XREADGROUP` / `XACK` / `XAUTOCLAIM`) is unverified | Low | The mechanism is Redis's own documented Python path (the official docs ship a redis-py streaming use case). Confirm the API surface and record the version with a small spike before implementation — `ADR-0002`, residual risk |
| ffmpeg output not bit-identical across builds | Medium | Assert artifact *properties* (duration, codec, bitrate via ffprobe), never hashes |
| 200 MB streamed through the API | Medium | Stream-to-disk (ADR-0001 E4); never buffer to memory; cap is a registry value |
| Wrong-type hostile file reaches ffmpeg | Medium | Allowlist + magic-byte sniffing at C1 (owner-raised requirement) |
| Codec CVE executes despite allowlist | Low / high impact | Sandboxing doctrine: container per worker (read-only rootfs, non-root, resource limits) + one process per job; the handler child runs with no network |
| Per-IP rate limiting over-blocks shared NAT | Low | Recorded honestly as a documented limitation |
| Fencing implementation error (stale writer commits) | Low / high impact | Commit is a single CAS on `lease_owner = me AND state = 'running'`; covered by strict TDD |

---

## Rollback

This is greenfield additive work with no prior schema or deployed environment to restore.
Rollback is a git revert of the change; the local filesystem zones (`inbox/`, `work/`,
`artifacts/`) are disposable and recreated, and no production data is at risk. There is no
data migration to reverse — this slice creates the first schema.

---

## Success criteria

- [ ] A reviewer can upload a video and download a real mp3, end to end, with no manual steps.
- [ ] The TS producer and Python consumer interoperate across the queue (contract parity proven
      with real bytes).
- [ ] A `jobs` row exists before any byte is accepted; T1's guard checks handle existence,
      declared arity, and the 200 MB cap.
- [ ] The `attempts` table is a real table (not a counter column) carrying `lease_owner` and
      `lease_expires_at`.
- [ ] `attempts_used` is computed from the `attempts` table; no counter column exists.
- [ ] A terminal job is deduped **by state** — a redelivered message is acked without work.
- [ ] The canonical artifact key is only ever reachable via atomic promote; no partial bytes
      are readable there.
- [ ] A stale lease holder can never commit (fencing enforced).
- [ ] Terminal states are immutable; replay (later) mints a new job.
- [ ] A wrong-type input (renamed extension) is rejected before dispatch via magic-byte check.
- [ ] The worker runs in a container with a read-only rootfs, a non-root user and resource limits; one process per job; the handler child has no network.
- [ ] The download endpoint distinguishes "succeeded but artifact expired" from "failed" and
      never returns a storage path or credential.
- [ ] The creator token is stored hashed and never appears in logs.

---

## References

- `openspec/changes/audio-extract-vertical-slice/explore.md` — exploration snapshot (preserved, unedited).
- `openspec/changes/audio-extract-vertical-slice/design/adr-0001-ingestion-storage-port-delivery.md` — accepted.
- `openspec/changes/audio-extract-vertical-slice/design/adr-0002-queue-mechanism.md` — accepted. Decides the queue mechanism and records the rejected BullMQ variants.
- `openspec/changes/audio-extract-vertical-slice/design/research-queue-r1-r3-r4.md` — the evidence behind `ADR-0002`, with per-item source quality.
- `openspec/glossary.md` — canonical vocabulary; `[+]` entries carried here as requirements.
- `openspec/project.md` — live project context.
- `openspec/config.yaml` — delivery/testing configuration.
