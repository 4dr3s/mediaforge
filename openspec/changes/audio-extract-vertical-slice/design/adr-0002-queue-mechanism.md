# ADR-0002 — Queue mechanism: raw Redis Streams with consumer groups

- **Status:** Accepted
- **Date:** 2026-09-16
- **Change:** `audio-extract-vertical-slice`
- **Resolves:** research questions **R1**, **R3**, **R4**, and the *"Message queue"* open decision carried since `explore.md`
- **Supersedes:** the `project.md` premise that *"BullMQ is awkward to consume from Python"* (see [The premise this reverses](#the-premise-this-reverses))
- **Deciders:** project owner (broker family: **Redis**), orchestrating parent (mechanism, per explicit delegation)
- **Evidence:** `design/research-queue-r1-r3-r4.md`

---

## Context

The broker *family* was chosen by the project owner: **Redis**. What remained open was the
**mechanism** — how a queue is actually built on Redis, and which abstraction sits on top of it.

Three constraints shape the decision:

1. **The governing objective.** `project.md` states it plainly: *"The project's real subject is the
   **job pipeline** — queue, retries, idempotency, progress reporting, storage lifecycle, and
   resource limits — not the media libraries themselves."* The deliverable is evidence that this
   pipeline can be built and defended, not that a library can be configured.
2. **The spec already fixes the semantics.** `C3` and `C4` require: at-least-once delivery,
   acknowledgement that follows the commit, terminal-state dedupe *by state*, a fencing-guarded
   commit, and **no requeue path** in v0.1. Any mechanism must serve those requirements, not
   replace them.
3. **The domain contract stays broker-agnostic.** The proposal commits that no broker-specific
   vocabulary enters the slice's contract. Dispatch and consumption sit behind a **queue port**;
   the mechanism is an adapter detail.

### The premise this reverses

`project.md` recorded: *"BullMQ is awkward to consume from Python, which motivates this
direction."* The proposal repeated it as the project's **riskiest unknown**. Research refuted it —
BullMQ publishes an **official Python library**, and the vendor documents Python and Node queues as
**interoperable** because both use the same Lua scripts (R4).

That premise is dead. **The decision below does not rest on it**, and is reached on entirely
different grounds: what the governing objective rewards, and what the spec already fixes.

---

## What a queue must provide, and what Redis can provide

Asked of a queue by `C3`/`C4`: at-least-once delivery, acknowledgement, a record of what has been
handed out but not confirmed, recovery when a consumer dies, and a poison-message signal.

| Redis structure | At-least-once | Ack | Pending record + recovery | Delay |
| --- | --- | --- | --- | --- |
| List (`LPUSH`/`BRPOP`) | no | no | no | no |
| Pub/Sub | no | no | no | no |
| Sorted set (`ZADD`/`ZRANGEBYSCORE`) | no | no | no | **yes** — score is a timestamp |
| **Streams + consumer groups** | **yes** | **`XACK`** | **PEL + `XAUTOCLAIM`** | no — must be built outside |

Only **Streams** carries the primitives the spec requires. The others are not worse *designs*; they
simply make different guarantees, and those guarantees are insufficient here.

---

## Decision

**Use raw Redis Streams with consumer groups.**

- The **API (TypeScript)** produces with `XADD`.
- The **worker (Python, `redis-py`)** consumes with `XREADGROUP` against a consumer group.
- Success is confirmed with **`XACK`** — **after** the outcome commit, never before, per `C4`.
- Recovery of a dead consumer's un-acked entries is **`XAUTOCLAIM`**, which the official command
  reference documents as available **since Redis 6.2.0**.
- The **queue port** keeps the domain contract broker-agnostic; these commands are the adapter.

### Why `XAUTOCLAIM`, and what it guarantees

The official reference states that *"claiming a message resets its idle time. This ensures that
**only a single consumer can successfully claim a given pending message at a specific instant of
time** and trivially reduces the probability of processing the same message multiple times."*

That single-claimer guarantee is the broker-level analogue of this project's Postgres lease, and it
is why `XAUTOCLAIM` is usable as a *transport* recovery path — **not** as a replacement for the
lease. `XAUTOCLAIM` recovers a **message**; the job's `running` state and its lease are the
database's business. The two must be reconciled, never conflated.

Two documented details that constrain the adapter:

- **`min-idle-time` is in milliseconds**, and the `JUSTID` option *"means the retry counter is not
  incremented"* — so a monitoring-based poison signal depends on not using `JUSTID`.
- Deleted or trimmed entries are **not claimed and are removed from the PEL** — *"This feature was
  introduced in Redis 7.0."* Before 7.0 they would linger in the PEL.

### `XNACK` — noted, not adopted

Redis exposes `XNACK key group <SILENT | FAIL | FATAL> IDS …`, which releases pending messages back
to the group *"immediately available for re-delivery … eliminating the idle-timeout delay normally
required for message recovery"*, with a `FATAL` mode documented for *"invalid or suspected
malicious messages"*.

It is **not adopted in this slice**, for two reasons:

1. **Version and deployment cost.** It is documented as available **since Redis 8.8.0**, and its own
   compatibility table lists **❌ Redis Software** and **❌ Redis Cloud**. That is a deployment
   constraint the project does not need to take on.
2. **It would not change the outcome anyway.** Releasing a message does not fix the job: the job is
   `running`, and T4 requires `queued`. A re-delivered message for a `running` job can be neither
   claimed nor treated as terminal. **This independently confirms the proposal's T7 decision** —
   both failure classes commit `failed` — on a deeper ground than the original reasoning.

---

## Alternative rejected: BullMQ

BullMQ is a legitimate, maintained, cross-language queue library, and its Python port is official.
It is rejected here for one structural reason and one ergonomic one.

### The structural reason: its value lands in slices this change deliberately deferred

| BullMQ feature (ported to Python) | Needed in… | Needed in this slice? |
| --- | --- | --- |
| **Delayed jobs / backoff** | the hardening slice (T8) | **No** — T8 is deferred and no retry occurs at all |
| **Retries with backoff** | the hardening slice | **No** — T7 commits `failed` for both classes; there is no requeue path |
| **Job progress / events** | slice 2 (`C7`) | **No** — C7 contributes no code here |
| **Job deduplication** | never | **No** — the project has its own `idempotency_key` in `submissions` |
| **Lock Manager (batched lock renewal)** | never | **No** — the project has its own lease + heartbeat |
| Worker loop, consumption, acknowledgement | now | **Yes — and that is the entire list** |

In this slice, BullMQ would supply a consumer loop and an ack. Everything else it offers would have
to be **turned off** to satisfy the spec. Adopting a library in order to disable it is not a
trade-off; it is overhead.

### The structural reason that matters more: two authorities on the same question

This design rests on a rule already written into the proposal:

> **The queue is a notification; Postgres is the truth.**

BullMQ carries its **own job model** — its own states (`waiting`, `active`, `delayed`, `completed`,
`failed`), its own retry counting, and its own lock renewal. Adopting it means the pipeline has
**two state machines and two idempotency systems**, and every incident becomes *"which one is
right?"* The `attempts` table, the lease and the fencing token exist precisely to be the single
answer to that question. A second answer is not a feature; it is a defect.

### The honest counter

This decision means **the project builds** the consumer loop, and later the delayed-retry
scheduling and the progress/event stream. That is more work, and later slices will feel it.

That work, however, **is the deliverable**. It is the difference between a repository that
demonstrates a job pipeline and one that demonstrates a dependency list.

### Variant rejected: BullMQ as the system of record

A stronger form of this alternative deserves its own record, because the analysis above does not
answer it. The section above rejects BullMQ **alongside** the project's state machine. This variant
proposes BullMQ **as** the state machine — replacing `attempts`, the lease, the fencing token and
part of the six-state model — on the argument that **substituting is less work than duplicating**.

That argument is coherent, and it defeats the "features would have to be disabled" framing, which
assumed coexistence. It fails for a different and more fundamental reason:

> **Substituting does not remove state. It duplicates it.**

The domain holds state that is **not queue-shaped**:

| Domain fact | Can BullMQ hold it? |
| --- | --- |
| `created` — intent accepted, bytes not yet arrived | **No.** Nothing is queued yet; there is no message |
| The artifact and its `storage_key` | **No.** BullMQ has no concept of a promoted artifact |
| `expires_at` — a 7-day retention *policy* | **No** — see the retention tension below |
| The `error_code` the API serves to the client | **Not durably** — it exists only while the job entry does |
| `submissions` idempotency, transactionally consistent with job creation | **No.** BullMQ's dedup lives in Redis and cannot be atomic with a Postgres insert |

Two facts settle it, and both come from the vendor's own production guidance:

**1. A system of record retains by policy; BullMQ retains by memory pressure.** BullMQ's
documentation states that *"BullMQ keeps every completed and failed job in Redis forever unless you
tell it not to"*, and separately that Redis *"cannot work properly if [it] evicts keys arbitrarily.
Therefore is very important to configure the `maxmemory-policy` setting to `noeviction`"* — *"the
only setting that guarantees the correct behavior of the queues."*

Together those two facts leave no room: either Redis memory grows without bound, or completed jobs
are removed to bound it — **and then there is no record.** A 7-day retention policy and a
memory-pressure-bounded store are incompatible drivers. The record has to live somewhere else.

**2. A lock you must ask about is not a fence.** BullMQ's `lockToken` is enforced by BullMQ's own
Lua scripts when *it* moves a job between states. It has no authority over a raw
`UPDATE jobs SET state = 'succeeded'` issued against Postgres. Guarding the commit by *asking
BullMQ* whether the lock is still held is **check-then-act**: between the question and the write,
the lock can expire. This project's fencing puts the token **in the `WHERE` clause**, so the check
and the write are one atomic operation. That is strictly stronger, and it is not something a queue
can provide for a database it does not own.

**Where the variant would be right.** If the project's jobs were genuinely queue-shaped —
fire-and-forget work with no lasting output, no artifact, no policy lifetime and no API query —
then BullMQ as the system of record would be the leaner and correct design, and this ADR would be
written the other way. Sending an email is that kind of job. **`audio.extract` is not**: it produces
an **artifact with a policy lifetime**, **queryable by the API**, **authorized by capability**, and
**retained for seven days**. That is a domain entity, not a queue entry.

**Where the objection is right, and what it narrows.** The section above argued that BullMQ's
features would have to be *disabled*, which assumes coexistence. Under substitution, slice 1
genuinely does save code. The claim that survives is narrower: BullMQ substitutes only for the
**queue-shaped part** of the domain, and the non-queue-shaped part stays in Postgres — after which
two views of the same job must be reconciled, which is a harder problem than the outbox it was
meant to remove.

### The premise that is *not* part of this rejection

BullMQ is **not** rejected because it is awkward from Python. That claim is false and is corrected
elsewhere. If the governing objective were "ship a queue-backed feature quickly", BullMQ would be
the correct answer and this ADR would be written the other way.

---

## Consequences

### Enabling

- The pipeline keeps **one authority**: Postgres. The queue transports an intent and nothing more.
- **No overlap** between our lease/fencing and a library's lock renewal — the fencing guarantee
  stays legible and testable, which matters because it is written twice (TS and Python) and is the
  project's largest unnamed risk.
- The **`queue port`** keeps its value: the spec's broker-agnostic contract is honoured by an
  adapter, and swapping mechanisms later remains an adapter change.
- Vendor documentation covers the Python path: Redis's own docs include a *"Redis streaming with
  redis-py"* use case using `XREADGROUP`/`XACK` and recovering stuck deliveries with `XAUTOCLAIM`.

### Costs accepted

- **The consumer loop is ours to write** (consume, ack-after-commit, claim recovery, poison
  detection via the delivery counter).
- **Delayed retry has no broker primitive.** When the reaper lands, retry scheduling lives in
  Postgres as `available_at` — which the design was already going to need.
- **Progress and events (C7) are ours to build** in a later slice.
- **`redis-py`'s API surface was not directly verified** in the research. Mitigation below.

### Residual risk and its mitigation

The research did **not** fetch the `redis-py` API reference; it established the official Redis
documentation's redis-py streaming use case instead. Before implementation, confirm with a small
spike that `redis-py` exposes consumer-group read, `XACK` and `XAUTOCLAIM` with a current,
documented API, and record the version. This is a verification step, not a design risk — the
mechanism is the vendor's documented path.

---

## Revisit triggers

- A **second consumer group** or a second producer language appears and the hand-written loop
  becomes duplicated per service.
- The **hardening slice** needs delayed retry with jitter at a rate that makes Postgres-side
  scheduling genuinely awkward.
- **`XNACK`'s availability broadens** (Redis Software/Cloud support), making broker-side release
  viable — which would reopen the retry design, though not the T7 decision.
- The **`redis-py` spike fails**, and no maintained client provides the required primitives.
- The project's *governing objective* changes from demonstrable pipeline evidence to delivery speed.
  That single change would reverse this ADR.

---

## Evidence

| # | Fact | Source | Quality |
| --- | --- | --- | --- |
| E1 | `XAUTOCLAIM key group consumer min-idle-time start [COUNT count] [JUSTID]`, **since Redis Open Source 6.2.0**; single-claimer guarantee stated explicitly; claiming increments the attempted-deliveries count unless `JUSTID`; deleted/trimmed entries removed from the PEL since Redis 7.0 | Redis command reference — *XAUTOCLAIM* | official docs |
| E2 | `XNACK … <SILENT \| FAIL \| FATAL>` **since Redis 8.8.0**; releases pending entries for immediate re-delivery; `FATAL` documented for *"invalid or suspected malicious messages"*; **❌ Redis Software, ❌ Redis Cloud** | Redis command reference — *XNACK* | official docs |
| E3 | `XREADGROUP` reads for a group member; `XACK` acknowledges; `XAUTOCLAIM` reassigns idle pending entries to a healthy consumer; a redis-py worker recovers stuck deliveries with `XAUTOCLAIM` | Redis docs — *Redis streaming with redis-py* | official docs |
| E4 | BullMQ publishes an **official Python library**; Python and Node queues are **interoperable** via shared Lua scripts; ported features include delayed jobs, backoff, retries, progress, dedup and Lock Manager; *"does not support all the features available in the NodeJS version"* | `taskforcesh/bullmq` → `python/README.md`; `pypi.org/project/bullmq/` (release `3.2.2`, 2026-09-14) | vendor-primary |
| E5 | No delay/schedule primitive was found among the stream commands examined | research notes | **absence of evidence, not a documented negative** |
| E6 | BullMQ *"cannot work properly if Redis evicts keys arbitrarily"*; `maxmemory-policy` must be `noeviction` — *"the only setting that guarantees the correct behavior of the queues."* | BullMQ docs — *Going to production* | vendor docs |
| E7 | *"BullMQ keeps every completed and failed job in Redis forever unless you tell it not to"*; retention is bounded by `removeOnComplete` / `removeOnFail`. Completed and failed jobs are stored in special sets by default | BullMQ docs — *Auto-removal of jobs* | vendor docs |

Full findings, source-quality caveats and open questions: `design/research-queue-r1-r3-r4.md`.
