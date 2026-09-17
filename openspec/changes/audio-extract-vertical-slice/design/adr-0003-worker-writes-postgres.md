# ADR-0003 — Database-access fork: the worker writes Postgres directly

- **Status:** Accepted
- **Date:** 2026-09-16
- **Change:** `audio-extract-vertical-slice`
- **Resolves:** the "database access from two languages" fork the proposal deferred to design (§ Architecture surface, items 3 and 4); the migration-ownership decision.
- **Supersedes:** nothing. This is the first ADR on the write path.
- **Deciders:** design phase (sdd-design), on a fork the proposal explicitly handed to design.
- **Related:** ADR-0001 (storage port), ADR-0002 (queue mechanism).

---

## Context

`C2` (Job Registry & Lifecycle) is lane **SHR**. Its invariant is that *every
transition is one conditional `UPDATE ... WHERE id = ? AND state = ?`*. The transition
owners are **disjoint**: T1/T3/T5 are executed by the API (TypeScript), T4/T6/T7 by the
worker (Python). The fencing guarantee — the thing that makes a stale worker unable to
commit — lives in the Python half (T6/T7).

Two facts pin the decision down before any preference enters:

1. **The worker must read Postgres directly regardless of who writes.** C4 requires the
   worker to *"determine what to do by reading the job record: its state, job type,
   parameters, and inputs"* and to *"never use the message as a source of job state."*
   There is no HTTP-proxied form of that requirement; the worker opens a database
   connection and reads.
2. **Prisma Client is TypeScript-only.** There is no official Python client, so the
   worker's read path can never go through Prisma. A Python database path exists in
   every option; the question is only whether it carries the three write statements too.

The fork, as the proposal stated it:

| Option | How | Trade-off |
| --- | --- | --- |
| **A — worker writes Postgres directly** | Python executes its own CAS | Fewer hops. Cost: the CAS pattern is implemented in two languages and must stay semantically identical |
| **B — API is the only writer** | Worker requests claim/commit over HTTP | One CAS implementation (Prisma). Cost: the API sits in the latency path of every claim and commit, and the state machine moves behind an HTTP boundary |

---

## Decision

**Option A: the worker writes Postgres directly.**

- The API owns T1/T3/T5 through Prisma; the worker owns T4/T6/T7 through a Python
  Postgres driver (`asyncpg`), each as one conditional `UPDATE`.
- The fencing check is **atomic with the write** in both halves: the fence lives in the
  `WHERE` clause of the single `UPDATE` (`lease_owner = me AND attempt_no = me AND
  lease_expires_at > now() AND state = 'running'`). There is no check-then-act against
  any external lock. The database is the enforcer; the issuing language is irrelevant to
  the guarantee.
- **Migration ownership: Prisma owns migrations, alone.** `apps/api/prisma/migrations/`
  is the single DDL authority. The worker never runs DDL; it is read-only on schema and
  issues only `SELECT`/`INSERT`/`UPDATE`. Any schema change flows through
  `prisma migrate` on the API side, and the worker's SQL is reviewed against the
  generated migration.

### Why the fence does not need "one language"

The proposal framed the risk as *"the invariant is implemented twice and the fencing
guarantee lives in the Python half."* That is true of the *code*, but the **guarantee**
lives in Postgres: a conditional `UPDATE`'s row lock and snapshot isolation reject a
stale write whether the statement was sent by Python, by Prisma, or by psql. Option B
does not move the fence into one language; it moves the *statement* behind an HTTP proxy
while the fence remains exactly where it was — in the database. What option B actually
buys is a single place to *review the SQL text*, at the price of an HTTP hop on the
worker's hottest path.

The real, addressable cost of option A is **drift between two copies of the CAS
pattern**. It is addressed structurally rather than by avoiding it:

1. **Disjoint ownership.** No transition exists in two languages. T1/T3/T5 exist only in
   TypeScript; T4/T6/T7 only in Python. There are not two implementations of one
   transition; there is one implementation per transition, and a shared *pattern*.
2. **One canonical CAS template.** The six statements are written down once as the SHR
   contract in `design.md` § State machine (the canonical SQL), with the exact
   `WHERE` clauses. Both runtimes' code is written against that text.
3. **Behavioral contract tests.** One concurrency test suite (same scenarios, same
   fixtures) runs against *both* runtimes and asserts the same state-machine outcomes
   (stale precondition rejects; fence rejects a non-holder; terminal is immutable).
   Drift fails the test, not a code review.

---

## Alternatives considered

| Alternative | Why not now | Revisit trigger |
| --- | --- | --- |
| **B — API is the only writer** (worker requests claim/commit over HTTP) | The worker already reads Postgres directly (fact 1), so no driver is saved. Claim, **heartbeat**, and commit all become HTTP calls: heartbeat is a periodic CAS with a seconds-scale cadence, so an API outage or slow request silently lets the lease lapse and strands a job. The API gains a worker-facing RPC surface with its own trust question, while the database remains the actual enforcer — the HTTP proxy adds a failure mode and removes nothing. | A managed identity/network posture makes the API the only component allowed to reach Postgres (e.g., the worker is demoted to a no-database sandbox). |
| **B-variant — worker writes through a Prisma-backed RPC (e.g. tRPC/REST generated from Prisma)** | Still an HTTP hop per claim/heartbeat/commit; the fence stays in Postgres; the generated client cannot express the `EXISTS(attempts ...)` fence without hand-written endpoints. | Not expected; recorded for completeness. |
| **Shared SQL in one file compiled into both runtimes** | No cross-language SQL embedding tool is worth adopting for six statements; the canonical-template + contract-test approach gives the same anti-drift guarantee with zero tooling. | If the transition count grows beyond a handful, revisit a code-generated SQL contract. |

---

## Consequences

### Enabling

- The worker stays autonomous: it can claim, heartbeat, and commit even while the API is
  down or restarting. The pipeline's recovery story does not acquire an API dependency.
- The fence remains a single Postgres statement in both halves, and is testable directly
  against a real database.
- One authority is preserved: Postgres is the truth; the queue is the hint (ADR-0002's
  core rule). Option B would have put an HTTP boundary between the worker and that truth
  without strengthening it.

### Costs accepted

- **The CAS pattern is written twice.** Accepted and bounded by the canonical template
  plus the behavioral contract suite (see above). This is the honest price of a
  two-language pipeline with disjoint transition owners.
- **The worker carries a Python database driver** (`asyncpg`) and its own SQL review
  discipline. It must never emit DDL and must match the Prisma-owned schema.
- **Migration ownership discipline.** Prisma owns migrations; the worker is read-only on
  schema. A future schema change that touches a worker-written statement is a
  coordinated change (migration first, worker SQL reviewed against it).

### Non-consequences (explicitly not claimed)

- This ADR does **not** cite any "awkward to consume from Python" premise. The rejected
  premise concerned BullMQ (ADR-0002 refutes it); the factual basis here is that Prisma
  Client has no Python client, which is unrelated to BullMQ.

---

## Evidence

| # | Fact | Source | Quality |
| --- | --- | --- | --- |
| E1 | C4 requires the worker to decide from the job record (state, type, params, inputs) and never from the message — a direct Postgres read, independent of any write-path choice | `specs/worker-runtime-lease/spec.md` | normative spec |
| E2 | Prisma Client is TypeScript/JavaScript-only; there is no official Python client | Prisma documentation — *Prisma Client* | official docs |
| E3 | The fencing guarantee is a single conditional `UPDATE` whose `WHERE` carries `lease_owner`/`lease_expires_at`/`state`; atomicity comes from Postgres row locking + snapshot isolation, independent of the issuing language | PostgreSQL documentation — *Concurrency Control* (row-level locking, READ COMMITTED) | official docs |
| E4 | Transition owners are disjoint (T1/T3/T5 API; T4/T6/T7 Worker); no transition is implemented in two languages | `specs/job-registry-lifecycle/spec.md` | normative spec |
| E5 | Heartbeat renewal is a periodic CAS (lease + grace, renewed every ~15s); an HTTP hop per renewal adds a latency/failure mode to the hottest path | `explore.md` §6 limit table; `specs/worker-runtime-lease/spec.md` | normative + exploration |
| E6 | A lock you must ask about is not a fence: check-then-act against an external lock can expire between check and write; the token must be in the `WHERE` clause | ADR-0002 § "A lock you must ask about is not a fence" | accepted ADR |

---

## Revisit triggers

- The worker's network posture changes such that it may no longer reach Postgres (e.g.,
  a managed runtime where only the API holds database credentials). That single change
  would force option B and reopen this ADR.
- A second worker language appears (a third CAS implementation) — reconsider a shared,
  code-generated SQL contract.
- The transition count grows large enough that hand-maintained parity becomes a real
  liability (revisit the "shared SQL compiled into both" alternative).
- Strict TDD contract tests reveal drift the template did not prevent — strengthen the
  shared contract mechanism rather than accepting a second source of truth.
