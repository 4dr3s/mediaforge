# Tasks — `audio-extract-vertical-slice`

**Answer first.** These work units build the first working job pipeline in dependency order:
scaffold → authoritative data model → shared contract → ports → the API half of the state
machine → the worker half → containment → docs and the acceptance demo. Every unit is
RED-first (`openspec/config.yaml` declares `strict_tdd: true`), carries its tests with its
code, and names the requirement titles it satisfies.

**Ordering guardrails, honored above:** the §3 ERD-derived DDL (WU-2) precedes everything that
reads those tables; the storage port (WU-4) precedes every storage user; the queue port (WU-6)
precedes both the relay (WU-7) and the consumer (WU-9); and the canonical CAS SQL plus its
scenario matrix (design §6, WU-8) precedes either runtime implementing a transition (WU-7,
WU-9).

---

## Review Workload Forecast

| Field | Value |
| ------- | ------- |
| Estimated changed lines | **≈5,700–7,400 authored lines** (additions + deletions, tests included; excludes lockfiles, the generated Prisma client, and generated goldens) |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Suggested split | If the parent selects chaining: **S1 foundation** (WU-1…WU-3, WU-5, WU-13) → **S2 ports & contract** (WU-4, WU-6, WU-8) → **S3 API half** (WU-7, WU-16, WU-17) → **S4 worker half** (WU-9…WU-12, WU-14) → **S5 runtime & evidence** (WU-15, WU-18…WU-21) |
| Delivery strategy | `ask-on-risk` (from the session preflight; unchanged) |
| Chain strategy | `pending` — **not selected here**; the parent decides |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High
```

**Forecast reconciliation (honest, no code-golf).** The proposal records ~800–950 changed
lines. That figure reads as an estimate for an already-scaffolded repository; this repository
contains only `openspec/`, so `package.json`, `pyproject.toml`, both Dockerfiles, compose, and
the Vitest/pytest harness are all in scope, with 141 spec scenarios of test code on top.
Nothing here is padded to inflate the number and nothing will be shrunk by deleting tests,
docs, or comments to reach 400.

**Bounded slicing.** Per-unit estimates are in the table below. Even after one honest slicing
pass, the **smallest cohesive slice (S2) is ≈870–1,130 lines** — chaining reduces review size
but cannot reach 400 without splitting work units below cohesion. This forecast records the
requirement only; `size:exception` is **not** asserted or inferred here, and no chain strategy
is chosen. The parent owes the delivery decision before `apply`.

| Work unit | Owner | Depends on | Est. lines |
| --- | --- | --- | --- |
| WU-1 scaffold, toolchains, test harness | toil | — | 400–500 |
| WU-2 data model: Prisma schema, first migration, roles | core | WU-1 | 450–550 |
| WU-3 shared contract + job-type registry | core | WU-1 | 350–450 |
| WU-4 StoragePort + local adapter (both runtimes) | core | WU-1, WU-2 | 400–500 |
| WU-5 spike: redis-py consumer-group surface | artifact | WU-1 | 80–120 |
| WU-6 QueuePort + Redis Streams adapters | core | WU-5, WU-1 | 350–450 |
| WU-7 API CAS (T1/T3/T5) + outbox + relay | core | WU-2, WU-3, WU-6, WU-8 | 400–500 |
| WU-8 shared state-machine scenario fixture (drift guard) | artifact | WU-2 | 120–180 |
| WU-9 worker runtime: dedupe, T4, heartbeat, fenced T6/T7, ack order | core | WU-2, WU-4, WU-6, WU-8 | 450–550 |
| WU-10 timeout, process-group kill, scratch cleanup | core | WU-9, WU-12 | 220–300 |
| WU-11 `audio.extract` handler (pure boundary, fixed argv) | core | WU-3, WU-4 | 280–350 |
| WU-12 attempt pipeline: materialize → promote → cap → record | core | WU-4, WU-9, WU-11 | 300–400 |
| WU-13 spike: sandbox namespace precondition check | artifact | WU-1 | 80–120 |
| WU-14 process-per-job + network-less handler child | core | WU-9, WU-11, WU-12, WU-13 | 220–300 |
| WU-15 worker container runtime configuration | toil | WU-1, WU-13 | 150–220 |
| WU-16 submission & validation (C1) | core | WU-2, WU-3, WU-4, WU-7 | 500–650 |
| WU-17 capability auth, download, cancel (C8) | core | WU-2, WU-4, WU-7, WU-16 | 420–520 |
| WU-18 pending documentation corrections | artifact | WU-7, WU-16 | 60–90 |
| WU-19 structured logging + secret redaction | toil | WU-16, WU-17 | 140–200 |
| WU-20 declared limitations + operator docs (AV13) | artifact | WU-17 | 120–180 |
| WU-21 compose E2E smoke + ffprobe property gate | toil | all | 200–280 |

### Runners and canonical commands

- **API:** Vitest — `pnpm --filter api --fail-if-no-match exec vitest run <file>`. Always against a **real
  PostgreSQL 18** test database (`mediaforge_test`) and a **real Redis** test db number; never
  SQLite (false negatives on `uuidv7()`, `FOR UPDATE`, partial indexes, CAS semantics).
- **Worker:** pytest + `pytest-asyncio` — `uv run --project workers/media pytest
  workers/media/tests/<file> -q`. Never the PATH `python` (project.md: unrelated virtualenv).
- **Compose:** `docker compose -f docker/compose.yaml up -d --wait`.
- **E2E acceptance:** pytest over compose (WU-21). Playwright is **rejected** — there is no web
  UI in this slice (`design.md` §11, `project.md`).
- Fencing and CAS tests use **real concurrency** (two live connections), never transaction
  rollback.

### Owner tags

`core` — the user writes it and must defend it in an interview (pipeline, state machine,
idempotency, storage) · `artifact` — agent-written (test strategy, verification, ADR/spec
corrections, docs) · `toil` — delegable to subagents (scaffolding, Dockerfiles, compose,
fixtures, harnesses).

---

## S1 — Foundation

> **Note (2026-09-17):** the seven boxes WU-1 1.1–1.4, WU-5 5.1–5.2, and WU-13 13.2 were
> unchecked again on 2026-09-17 because the S1 apply artifacts they attested were deleted by
> supervisor decision and the work was rebuilt from scratch under ODD in
> `odd/tasks/s1-foundation.md`. The plan's checkboxes therefore describe intent, not shipped
> evidence; see `odd/tasks/repo-hygiene.md`.

### WU-1 — Workspace scaffold, toolchains, and test-harness bootstrap · owner: toil

**Anchors:** design §2 (topology + module layout), §2.1 (Postgres 18, Redis 7, shared
`mediaforge-storage` volume), §11 (runners); `openspec/config.yaml` `testing.strict_tdd`;
ADR-0002 (Redis Streams); `project.md` (stack: NestJS + TS API, Python 3.11 worker via `uv`).

- [ ] 1.1 RED — write `apps/api/test/harness.spec.ts` (Vitest) asserting a live connection to
  `mediaforge_test` and that `SELECT uuidv7()` returns a version-7 UUID, and
  `workers/media/tests/test_harness.py` (pytest) asserting `asyncpg` connects to the same
  database and Redis is reachable. Watch both fail: no project, no environment. · owner: toil
- [ ] 1.2 Scaffold the pnpm workspace (`package.json`, `pnpm-workspace.yaml`), `apps/api`
  NestJS skeleton, `apps/web` placeholder only (no code — no UI in this slice),
  `workers/media` with `uv`/`pyproject.toml`, `contracts/`, Vitest config, pytest-asyncio
  config, `Makefile` targets. · owner: toil
- [ ] 1.3 Write `docker/compose.yaml` (Postgres 18, Redis 7, named volumes including
  `mediaforge-storage`, DB `mediaforge`, test DB `mediaforge_test`), `docker/api.Dockerfile`,
  `docker/worker.Dockerfile`, `.env.example` (credentials from env; `.env` gitignored),
  `.gitignore`. · owner: toil
- [ ] 1.4 GREEN — record the exact results of `docker compose up -d --wait`,
  `pnpm --filter api --fail-if-no-match exec vitest run test/harness.spec.ts`, and
  `uv run --project workers/media pytest workers/media/tests/test_harness.py`. · owner: toil

**Start:** empty repository (only `openspec/`). **Done:** compose up is healthy; both harness
tests pass against real Postgres/Redis. **Verify:** the three commands above, output recorded in
the PR body. **Rollback:** delete `apps/`, `workers/`, `contracts/`, `docker/`, root manifests,
and the named volumes; no `openspec/` artifact changes.

### WU-2 — Authoritative data model: Prisma schema, first migration, least-privilege roles · owner: core

**Anchors:** C2 "Exactly Six States, With Canonical Names" · C2 "Attempts Are Recorded as Rows,
Not as a Counter" · C2 "`attempts_used` Is Derived From the Attempts Table" · C2 "Job Inputs Are
Plural With a Unique Ordinal" · C2 "A Terminal Job Records Its Outcome" · C3 "The Dispatch Intent
Is Committed With the Job Transition" · C6 "An Artifact Record Is a Pointer Plus Metadata, Never
Bytes" · C6 "Retention Is Declared as Seven Days and `expires_at` Is Written" · C1 "A Job Row
Exists Before Any Byte Is Accepted" · ADR-0003 (Prisma owns migrations; worker read-only on
schema); design **§3 ERD is the authoritative model**, §4 (UUID strategy), §5.
(`design/schema.prisma` does not exist and must not be referenced.)

- [ ] 2.1 RED — write `apps/api/test/schema.spec.ts` (Vitest) asserting, against the migrated
  database: the six-state enum values and no seventh; `unique (job_id, ordinal)` rejects a
  duplicate ordinal; `unique (job_id, attempt_no)`; `unique (client_id, idempotency_key)` and
  `unique (job_id)` on `submissions`; **no counter column on `jobs`** (`information_schema`);
  every PK except `artifacts.id` defaults to `uuidv7()`; the partial index
  `outbox (published_at) WHERE published_at IS NULL`; `CHECK (ordinal >= 1)`,
  `CHECK (attempt_no >= 1)`, `CHECK (error_class IN (...))`; `timestamptz`/`bigint`/`jsonb`
  types; FK indexes present. Fails: no schema. · owner: core
- [ ] 2.2 RED — write `workers/media/tests/test_db_privileges.py` (pytest) asserting the
  `mediaforge_worker` role cannot `SELECT outbox`, cannot DDL, cannot DELETE, and can
  SELECT `jobs`/`job_inputs`/`submissions`, INSERT/UPDATE `attempts`, INSERT `artifacts`,
  UPDATE `jobs`; `mediaforge_api` cannot DDL or DELETE; `PUBLIC` is revoked. Fails. · owner: core
- [ ] 2.3 Implement `apps/api/prisma/schema.prisma` from the §3 ERD, generate the first
  migration under `apps/api/prisma/migrations/`, then hand-edit that migration for the enum,
  the three CHECK constraints and the partial index (Prisma cannot express them), and add the
  role/grant SQL. One DDL authority only: the worker emits no DDL. · owner: core
- [ ] 2.4 GREEN — `prisma migrate deploy` against `mediaforge_test`, both suites pass,
  `prisma migrate diff` reports no drift. · owner: core
- [ ] 2.5 Verify the two deliberate exceptions are present and un-scheduled: `jobs.available_at`
  exists and always passes T4 in this slice; nothing schedules against it. `artifacts.id` is
  written by the worker via `SELECT uuidv7()` (WU-12), not by a Python UUID generator. · owner: core

**Start:** scaffold present, no schema. **Done:** ERD realized as one migration + roles; both
constraint suites green. **Verify:** 2.4 commands with output. **Rollback:** drop
`mediaforge_test` schema, delete `apps/api/prisma/`, delete the two test files; no other unit
touched.

### WU-3 — Shared TS↔Python dispatch contract and job-type registry · owner: core

**Anchors:** C3 "One Versioned Message Contract Honored by Both Runtimes" · C3 "The Message Is a
Notification, Not the Truth" · C3 "The Queue Port Is Broker-Agnostic and the Adapter Owns Broker
Mechanics" (no broker vocabulary in the contract) · C1 "The Job-Type Registry Is the Only Source
of Submission Rules" · C5 "The Handler Asserts Its Registry-Declared Arity and Params"; design
§2.2, §7.1.

- [ ] 3.1 RED — write `apps/api/test/contract.parity.spec.ts` (Vitest) and
  `workers/media/tests/test_contract_parity.py` (pytest): both parse the same
  `contracts/fixtures/` documents; the envelope carries only `type` (version discriminator),
  `job_id`, `occurred_at`; an unsupported `type` is rejected on both sides;
  `contracts/job-types.json` declares `audio.extract` with arity 1, 200 MB input cap, output
  cap, 10-minute wall clock, lease TTL/grace, attempt budget, and a single optional
  `quality: 128k|192k|320k` param enum. Both fail. · owner: core
- [ ] 3.2 Implement `contracts/dispatch-envelope.schema.json`, `contracts/job-types.json`,
  `contracts/fixtures/` (golden envelopes + params used by both suites), zod validators in
  `apps/api/src/contracts/`, pydantic models in `workers/media/src/mediaforge/contracts.py`.
  Registry limits are **data**, so changing a limit is a registry change, not a code change. ·
  owner: core (fixture authoring is delegable → toil)
- [ ] 3.3 GREEN — both suites pass on the same fixtures; record the commands. · owner: core

**Start:** scaffold only. **Done:** one versioned envelope + registry honored by two runtimes
with parity tests. **Verify:** the two test commands. **Rollback:** delete `contracts/` and both
validator modules with their tests; nothing else imports them yet.

### WU-5 — Spike: `redis-py` consumer-group surface · owner: artifact

**Anchors:** ADR-0002 residual risk (the client API surface was never directly verified);
design §13; C3 "The Queue Port Is Broker-Agnostic and the Adapter Owns Broker Mechanics".
This spike **gates WU-6**.

- [ ] 5.1 RED/verify (runner: pytest) — write `workers/media/spikes/redis_py_consumer_group_surface.py`
  and `workers/media/tests/test_redis_py_spike.py` against a scratch Redis 7: pin the resolved
  `redis` version; assert the documented signatures of `xgroup_create`, `xadd`, `xreadgroup`
  (`>` mode and `0` mode), `xack`, and `xautoclaim`; assert `xautoclaim` **without `JUSTID`**
  increments the delivery count on a second claim; assert `min-idle-time` is interpreted in
  **milliseconds**. Fails until each primitive is confirmed. · owner: artifact
- [ ] 5.2 Record in `workers/media/spikes/RESULTS.md`: exact `redis-py` version, the three call
  signatures as used, the delivery-count location in the `xautoclaim` response, and any
  behavioral difference from the command reference. A failure here is ADR-0002's own revisit
  trigger — report it, do not build a workaround. · owner: artifact

**Start:** worker `uv` env exists. **Done:** recorded evidence that all three primitives exist
with these semantics. **Verify:** `uv run --project workers/media pytest
workers/media/tests/test_redis_py_spike.py -q` + the RESULTS.md entry. **Rollback:** delete
`workers/media/spikes/` and the spike test; WU-6 is not started, so nothing depends on it.

### WU-13 — Spike: sandbox namespace precondition check · owner: artifact

**Anchors:** C5 "The Sandbox Is a Container per Worker and a Process per Job" (handler child has
no network) · design §10 "Preconditions, stated honestly". This spike **gates WU-14 and WU-15**.

- [ ] 13.1 RED/verify (runner: pytest inside the worker container) — write
  `workers/media/spikes/sandbox_namespace_precheck.sh` + `workers/media/tests/test_sandbox_precheck.py`:
  assert `bwrap --unshare-user --unshare-net --unshare-pid` starts a process inside the worker
  container; assert an outbound connection from the handler child **fails** while the worker
  process itself still reaches Postgres and Redis; assert the seccomp profile permits
  `unshare`/`clone` with the namespace flags. Fails when the preconditions do not hold. ·
  owner: artifact
- [ ] 13.2 Record the outcome and the fallback in `workers/media/spikes/RESULTS.md`: the
  verified kernel/seccomp facts, and — if blocked — the scoped fallback (a seccomp profile for
  `unshare` only; still non-root and read-only, no `--privileged`, no `CAP_SYS_ADMIN`). If the
  fallback is also blocked, escalate the sandbox decision instead of silently weakening it. ·
  owner: artifact

**Start:** worker container exists (WU-1). **Done:** recorded evidence plus an explicit
fallback/escalation statement. **Verify:** the precheck command and its captured output.
**Rollback:** delete `workers/media/spikes/sandbox_namespace_precheck.sh` and its test; WU-14/15
are not started.

---

## S2 — Ports and the shared contract

### WU-4 — `StoragePort` and the local filesystem adapter, both runtimes · owner: core

**Anchors:** C6 "One Storage Port With Semantic Verbs and No Filesystem Leak" · C6 "Storage Keys
Are Server-Generated" · C6 "The Three Zones Have One Writer Each" · C6 "Bytes Are Streamed
Through the Port" · C6 "Promote Is the Only Route to a Canonical Key, and It Is Atomic" · C6
"The Canonical Key Is Never Written Directly" · C6 "Scratch Is Deleted on Every Exit Path" · C8
"Read Access Is Granted Through `createReadGrant` With a Bounded Lifetime" · C1 "Ingestion Is
Upload-Only" (worker reads through an input handle and cannot write the inbox); ADR-0001 D1/D3
plus the `openRead` reconciliation recorded in WU-18; design §8.

- [ ] 4.1 RED — `apps/api/test/storage.port.spec.ts` (Vitest): the port exposes only semantic
  verbs and no path/URL/bucket in any type or value; `putScratch` consumes a stream without
  buffering (assert memory does not grow with a cap-sized object); `promote` is atomic (a
  concurrent reader sees the previous complete object or nothing, **never** partial bytes; a
  failed promote leaves nothing at the canonical key; re-promote overwrites with exactly one
  complete object); `remove(ScratchRef)` deletes the `work/{job_id}/{attempt_no}/` prefix;
  `createReadGrant` returns `{kind: 'proxy'}` for the local adapter with a bounded TTL;
  `openRead` returns a byte stream (never a path or URL); keys are derived from
  `job_id`/`ordinal`/`attempt_no`/`artifact_id` only, never from client input. Fails. · owner: core
- [ ] 4.2 RED — `workers/media/tests/test_storage_port.py` (pytest) mirroring the same
  invariants for the Python `Protocol` + local adapter, plus: a worker write into
  `inbox/{job_id}/{ordinal}` fails, and each attempt writes only under its own scratch prefix.
  Fails. · owner: core
- [ ] 4.3 Implement `apps/api/src/storage/` (TS interface + local adapter) and
  `workers/media/src/mediaforge/storage/` (Python `Protocol` + local adapter); atomicity comes
  from `rename(2)` on the single shared volume. · owner: core
- [ ] 4.4 GREEN — both suites pass; record the commands. · owner: core

**Start:** schema + compose storage volume exist. **Done:** one storage contract honored twice,
with atomic promote and prefix-scoped scratch removal proven. **Verify:** 4.1/4.2 commands.
**Rollback:** delete both port/adapter modules and both test files; nothing else imports them
yet.

### WU-6 — `QueuePort` and the Redis Streams adapters (producer + consumer) · owner: core

**Anchors:** C3 "The Queue Port Is Broker-Agnostic and the Adapter Owns Broker Mechanics" · C3
"Dispatch Is At Least Once, Never Zero" · C3 "One Versioned Message Contract Honored by Both
Runtimes" · C3 "The Message Is a Notification, Not the Truth" · C4 "The Worker Decides From the
Job Record, Never From the Message"; ADR-0002; design §7.2.

- [ ] 6.1 RED — `apps/api/test/queue.port.spec.ts` (Vitest): the producer interface names only
  message identity and payload; publishing an envelope reaches the stream behind the port; a
  publish failure surfaces as a failure (so the relay keeps the intent). Fails. · owner: core
- [ ] 6.2 RED — `workers/media/tests/test_queue_adapter.py` (pytest, real Redis): exactly one
  consumer of the shared group receives a message; an un-acked message is recovered via
  `XAUTOCLAIM` past `min_idle_ms` and delivered again; `XACK` removes it from the PEL;
  `delivery_count` is surfaced for observability and **never** read to derive a transition; an
  envelope with an unsupported version is **not** acknowledged and consumption halts loudly
  (the message stays parked in the PEL — a stall, not a strand). Fails. · owner: core
- [ ] 6.3 Implement `apps/api/src/queue/` (interface + Redis Streams producer) and
  `workers/media/src/mediaforge/queue/` (Protocol + consumer adapter): one stream
  `mediaforge:dispatch`, one group `mediaforge-workers` created idempotently
  (`XGROUP CREATE … MKSTREAM`, ignore `BUSYGROUP`), unique consumer name `worker-<uuid>`,
  `min_idle_ms = (wall_clock_limit_s + lease_grace_s - margin_s) * 1000`, replay of own pending
  via `XREADGROUP … 0`, `XAUTOCLAIM` **without** `JUSTID`. · owner: core
- [ ] 6.4 GREEN — both suites pass; record the commands. · owner: core

**Start:** WU-5 recorded; contract from WU-3. **Done:** broker mechanics confined to adapters;
ack, claim recovery and the version-refusal path proven. **Verify:** 6.1/6.2 commands plus a
manual `XINFO GROUPS` observation. **Rollback:** delete both queue modules and their tests; the
relay (WU-7) is the only consumer and is not yet wired.

### WU-8 — Shared state-machine scenario fixture (the drift guard) · owner: artifact

**Anchors:** C2 "Every Transition Is a Single Compare-and-Set" · C2 "The Implemented Transition
Set and Its Disjoint Owners" · C2 "Terminal States Are Immutable" · C4 "Only the Current Lease
Holder May Commit" · C4 "Every Outcome Write Carries the Attempt's Fencing Token"; ADR-0003
(canonical CAS template + behavioral contract tests as the anti-drift mechanism); design §6, §11.

- [ ] 8.1 RED — write `contracts/fixtures/state-machine/scenarios.json` plus
  `apps/api/test/state-machine.fixture.spec.ts` (Vitest) and
  `workers/media/tests/test_state_machine_fixture.py` (pytest) asserting that **both** runtimes
  load the same file and that every required scenario id is present: concurrent claim →
  exactly one winner; stale precondition → zero rows and no follow-up write; non-holder fence →
  rejected; terminal → immutable; T5 with an active lease → rejected; T6/T7 outcome + attempt
  closure atomic; zero-row result never followed by a blind write. Fails (fixture absent). ·
  owner: artifact
- [ ] 8.2 Author the fixture and `contracts/state-machine/README.md` recording the drift rule:
  one authoritative scenario list, executed by both runtimes' suites (WU-7 and WU-9), with
  fencing tests using real concurrency rather than transaction rollback. · owner: artifact
- [ ] 8.3 GREEN — both fixture suites pass and enumerate identical scenario ids. · owner: artifact

**Start:** schema exists (WU-2); the canonical SQL is in design §6. **Done:** one scenario
matrix both runtimes consume. **Verify:** the two fixture suites. **Rollback:** delete the
fixture directory and the two fixture suites; WU-7/WU-9 keep their own localized tests.

---

## S3 — API half

### WU-7 — API state machine (T1/T3/T5), outbox write, and the relay · owner: core

**Deps:** WU-2, WU-3, WU-6, WU-8 (the canonical CAS text and its scenario matrix exist before
the first transition is implemented).

**Anchors:** C3 "The Dispatch Intent Is Committed With the Job Transition" · C3 "The Relay
Publishes Through the Queue Port and Marks Only After Success" · C3 "Dispatch Is At Least Once,
Never Zero" · C2 "Every Transition Is a Single Compare-and-Set" · C2 "The Implemented
Transition Set and Its Disjoint Owners" · C2 "Terminal States Are Immutable" · C1 "T1 Is a Single
Guarded Transition from `created` to `queued`"; design §6 (canonical CAS SQL), §2.1 (in-process
relay).

- [ ] 7.1 RED — `apps/api/test/lifecycle.cas.spec.ts` (Vitest, two live connections): a stale
  source state yields zero rows and **no** follow-up write; terminal jobs reject every
  transition; T5's `NOT EXISTS` active-lease guard rejects a leased job; T1 and its `INSERT
  INTO outbox` commit or roll back **together**; no outbox row ever exists for a job that is not
  `queued`; the TS module exposes only T1/T3/T5 (disjoint owners). Fails. · owner: core
- [ ] 7.2 RED — `apps/api/test/relay.spec.ts` (Vitest): unpublished rows are polled with
  `FOR UPDATE SKIP LOCKED`; `published_at` is set only after a successful publish; a failed
  publish leaves the row unpublished and eligible again; an interruption after the commit and
  before the publish is recovered by the next pass (the job is not stranded). Fails. · owner: core
- [ ] 7.3 Implement `apps/api/src/lifecycle/` (the three CAS statements written against the
  design §6 canonical text) and `apps/api/src/dispatch/` (outbox insert inside T1's transaction;
  in-process relay poller at ~200 ms using the WU-6 producer port). · owner: core
- [ ] 7.4 GREEN — CAS and relay suites pass, plus the Vitest half of the WU-8 scenario matrix;
  record the commands. · owner: core

**Start:** schema, contract, queue port in place. **Done:** the API half of the state machine
with the intent coupled to the transition. **Verify:** 7.1/7.2 commands + WU-8 Vitest suite.
**Rollback:** delete `apps/api/src/lifecycle/` and `apps/api/src/dispatch/` with their tests;
T1 callers (WU-16) are also removed.

### WU-16 — Submission & validation at the API edge (C1) · owner: core

**Anchors:** C1 "The Job-Type Registry Is the Only Source of Submission Rules" · C1 "A Job Row
Exists Before Any Byte Is Accepted" · C1 "Ingestion Is Upload-Only" · C1 "The Declared Input
Count Must Match the Registry Arity" · C1 "Declared Input Types Are Enforced by Content, Not by
Name" · C1 "Inputs Are Streamed to Disk Under a Hard Size Cap" · C1 "Submission Is Idempotent
per Client Key" · C1 "T1 Is a Single Guarded Transition from `created` to `queued`" · C1
"The Creator Token Is Returned Once, Stored Hashed, and Never Logged"; ADR-0001 D2/D5, AV2.

- [ ] 16.1 RED — `apps/api/test/submission.spec.ts` (Vitest): unregistered `job_type` rejected
  with no `jobs` row and no dispatch intent; arity mismatch rejected; a declared type outside
  the allowlist rejected before any byte; a renamed file whose magic bytes do not match its
  declared type rejected **before dispatch**; a matching signature accepted and its declared
  type recorded on the `job_inputs` row; a submission carrying a URL rejected with **no
  outbound request**; an over-cap stream aborted and not recorded as an input; resident memory
  flat while streaming a cap-sized input; a forced failure in the create transaction leaves no
  `jobs`/`job_inputs`/`submissions` row visible; one `job_inputs` row per declared input with
  `ordinal` 1..n; `job_id` + creator token returned once and the token persisted only as
  `sha256`; the same `(client_id, Idempotency-Key)` returns the first `job_id` and creates no
  second job; no key → two distinct jobs; an over-limit source IP is rejected with no `jobs`
  row. Fails. · owner: core
- [ ] 16.2 RED — `apps/api/test/submission.t1.spec.ts` (Vitest): the guard (every input handle
  exists, count equals registry arity, every size within the cap) → one conditional update plus
  the outbox row; a failed guard leaves the job `created` with no dispatch intent and returns a
  validation error; a concurrent T1 matches zero rows and does not overwrite. Fails. · owner: core
- [ ] 16.3 Implement `apps/api/src/submission/`: multipart handling that **streams to disk**
  (never multer's default in-memory `Buffer`), aborting past the cap; magic-byte signature
  validation; registry-driven validation (pure, synchronous, no ffmpeg, no container parsing,
  no storage read); token minting (`crypto.randomBytes(32)`), hashing, constant-time compare;
  per-IP rate limiting; the create transaction (`jobs(created)` + `job_inputs` + `submissions`)
  committed before bytes; `inbox/{job_id}/{ordinal}` as the only key shape; the
  `Authorization: Bearer` header as the only token carrier. · owner: core
- [ ] 16.4 GREEN — both suites pass; runtime harness: `curl` a real multipart upload against the
  composed stack and observe the job reach `queued` with a published outbox row. · owner: core

**Start:** API CAS + ports exist. **Done:** upload → validated `created` job → T1 → dispatch
intent, with the create transaction strictly before bytes. **Verify:** 16.1/16.2 commands plus
the recorded `curl` transcript. **Rollback:** delete `apps/api/src/submission/` and its tests;
inbox files under the compose volume are disposable.

### WU-17 — Capability authorization, download responses, and cancel (C8) · owner: core

**Anchors:** C8 "Authorization Is a Capability, Never an Identity" · C8 "Every Job-Scoped
Operation Requires the Capability" · C8 "Read Access Is Granted Through `createReadGrant` With
a Bounded Lifetime" · C8 "The Download Endpoint Distinguishes the Six States and the Expired
Artifact Case" · C8 "Cancellation Is a Capability-Authorized Pre-Execution CAS" · C8 "The
Display Filename Is Sanitized and Never a Storage Key" · C2 "Cancellation Exists Only Before
Execution Begins"; design §8, §12.

- [ ] 17.1 RED — `apps/api/test/capability.spec.ts` (Vitest): a known `job_id` without its token
  is rejected; a wrong token is rejected; a token belonging to another job cannot upload,
  cancel, or download; responses to an invalid token do not distinguish an existing from a
  non-existent `job_id`; ids are unguessable and non-sequential; the token is never read from a
  URL query parameter. Fails. · owner: core
- [ ] 17.2 RED — `apps/api/test/download.spec.ts` (Vitest): six distinguishable outcomes —
  not-yet-ready (`created`/`queued`/`running`), `succeeded` + available, `succeeded` + expired
  (`expires_at <= now()` reported as expired, **not** failed, bytes not served, job still reads
  `succeeded`), `failed` with its error code, `canceled`; exactly one branch on grant kind
  (local `proxy` streams via `openRead`); no response carries a storage path, key, bucket, or
  credential; a hostile display filename is sanitized for `Content-Disposition`; the grant TTL
  is configurable, bounded, and expires. Fails. · owner: core
- [ ] 17.3 RED — `apps/api/test/cancel.spec.ts` (Vitest): T3 cancels a `created` job; T5 cancels
  a `queued` job with no active lease; a `running` job is unchanged and reported not
  cancellable; a terminal job is unchanged and reported by its real terminal state. Fails. ·
  owner: core
- [ ] 17.4 Implement `apps/api/src/download/` (capability check, `createReadGrant` + single
  branch, state-aware responses, retention enforced on the read path) and the cancel route
  wired to WU-7's T3/T5. · owner: core
- [ ] 17.5 GREEN — three suites pass; runtime harness: download a real artifact through the
  composed stack and record the response headers. · owner: core

**Start:** token hash from WU-16, storage port and T3/T5 from WU-4/WU-7. **Done:** capability
authorization on every job-scoped operation with the full response matrix. **Verify:** 17.1–17.3
commands + recorded headers. **Rollback:** delete `apps/api/src/download/` and the cancel route
with their tests; capability data in `submissions` is untouched.

---

## S4 — Worker half

### WU-9 — Worker runtime: dedupe, T4 claim, heartbeat, fenced T6/T7, ack-after-commit · owner: core

**Anchors:** C4 "Claiming Is T4 — One Guarded CAS That Records the Attempt" · C4 "Only the
Current Lease Holder May Commit" · C4 "Heartbeat Renewal Is a CAS on the Held Lease" · C4
"Terminal-State Dedupe Happens Before Any Work" · C4 "Acknowledgement Follows the Commit" · C4
"T6 Is Fencing-Guarded and Follows the Atomic Promote" · C4 "T7 Commits Both Failure Classes,
Distinguished by Error Code" · C4 "Every Outcome Write Carries the Attempt's Fencing Token" · C4
"The Worker Decides From the Job Record, Never From the Message" · C2 "The Job Row Is the Source
of Truth; the Message Is a Hint" · C3 "Transport recovery is not job recovery" scenario; ADR-0003;
design §6, §7.2.

- [ ] 9.1 RED — `workers/media/tests/test_claim.py` (pytest, real Postgres, two connections):
  of two concurrent T4 claims exactly one commits and exactly one `attempts` row exists; the
  attempt row is written in the same transaction as the state change; a `running`/terminal job
  yields zero rows and no attempt row; the guard requires `available_at <= now()` and a derived
  `max(attempt_no) < max_attempts` (never a stored counter); the lease expiry follows the
  registry lease TTL. Fails. · owner: core
- [ ] 9.2 RED — `workers/media/tests/test_state_machine_contract.py` (pytest) running the WU-8
  scenario matrix against the worker's transitions, plus
  `workers/media/tests/test_cross_runtime_cas_parity.py` driving a scenario runner from **both**
  runtimes and asserting identical outcome codes per scenario id (ADR-0003's drift guard).
  Fails — no worker CAS exists yet. · owner: core
- [ ] 9.3 RED — `workers/media/tests/test_consume_loop.py` (pytest): a terminal job → read the
  job row, `XACK`, no attempt, no handler, no storage access; a non-claimable job → ack and
  exit; `XACK` happens only after a successful outcome commit and never after a failed one; a
  stale worker's T6/T7 matches zero rows and closes nothing (its attempt closure is fenced on
  the same lease predicate and is skipped); both failure classes commit T7 with distinguishable
  `error_code`; no requeue path, no retry-budget guard; a redelivered message for a `running`
  job is acked and the job stays `running`. Fails. · owner: core
- [ ] 9.4 Implement `workers/media/src/mediaforge/runtime/`: `asyncpg` pool; job read resolving
  state, `job_type`, params and inputs from Postgres; terminal dedupe before work; T4/T6/T7
  written against the design §6 canonical text; heartbeat task as a CAS on the held lease
  (zero rows → stop, never commit); ack sequencing; worker concurrency = 1 from the registry. ·
  owner: core
- [ ] 9.5 GREEN — the three suites plus the WU-8 pytest half pass; record commands and the
  cross-runtime parity result. Runtime harness: one job claimed, worked by a trivial handler,
  and committed against the composed Postgres + Redis. · owner: core

**Start:** storage/queue ports, schema, contract, fixture in place. **Done:** the worker owns
T4/T6/T7 with the fence in the `WHERE` clause and ack strictly after commit. **Verify:** 9.1–9.3
commands + parity output. **Rollback:** delete `workers/media/src/mediaforge/runtime/` and the
three suites; the message stays unacked and no job is left half-written by the removal.

### WU-11 — `audio.extract` handler: pure boundary, fixed argv, typed errors · owner: core

**Anchors:** C5 "The Handler Contract Is Pure" · C5 "The Handler Asserts Its Registry-Declared
Arity and Params" · C5 "`audio.extract` Produces Exactly One mp3 From One Video Input" · C5
"Handler Arguments Cannot Be Injected" · C5 "Handlers Fail Loudly With a Typed Error"; design §2.2,
§8 (handler never sees an inbox key, a raw path, or the canonical key).

- [ ] 11.1 RED — `workers/media/tests/test_audio_extract.py` (pytest): one input → exactly one
  output handle whose content type is mp3 and no other artifact; the same input and params
  twice produce an identical argument list; a hostile display filename never appears in argv
  and the executed list equals the fixed argument array; arguments are passed as an array with
  no shell; wrong arity → typed error; params failing the registry schema are rejected before
  the handler is invoked; a malformed input → typed invalid-input failure with no output handle;
  the handler performs no database, queue, or canonical-key access and writes only inside the
  scratch it received. Fails. · owner: core
- [ ] 11.2 RED — `workers/media/tests/test_audio_extract_properties.py` (pytest): a completed
  extraction is verified by ffprobe properties (duration, codec, bitrate) read back from the
  produced file, with **no** byte-equality or hash-equality requirement. Fails. · owner: core
- [ ] 11.3 Implement `workers/media/src/mediaforge/handlers/audio_extract.py`: fixed argv built
  from the validated `quality` enum, `(inputs[], params, scratch) -> outputs`, typed error
  classes for invalid input / unsupported params / tool failure. · owner: core
- [ ] 11.4 GREEN — both suites pass; runtime harness: run the handler over a small real video in
  a scratch directory and record the ffprobe output. · owner: core

**Start:** registry params + storage port exist. **Done:** a pure, injection-proof,
property-verified handler. **Verify:** 11.1/11.2 commands + recorded ffprobe properties.
**Rollback:** delete the handler module and both suites; no pipeline code depends on it until
WU-12.

### WU-12 — Attempt pipeline: materialize → promote → cap check → artifact record · owner: core

**Anchors:** C6 "The Output Size Cap Is Verified After Promote" · C6 "An Artifact Record Is a
Pointer Plus Metadata, Never Bytes" · C6 "Retention Is Declared as Seven Days and `expires_at`
Is Written" · C6 "Promote Is the Only Route to a Canonical Key, and It Is Atomic" · C4 "T6 Is
Fencing-Guarded and Follows the Atomic Promote" · C2 "A Terminal Job Records Its Outcome" · C5
"The Handler Contract Is Pure"; design §4 (`artifacts.id` minted by `SELECT uuidv7()`), §8.

- [ ] 12.1 RED — `workers/media/tests/test_attempt_pipeline.py` (pytest): the input is
  materialized into the attempt scratch through `openRead` and the handler receives only
  scratch-local read-only paths; on success the worker mints `artifact_id` with
  `SELECT uuidv7()`, promotes to `artifacts/{job_id}/{artifact_id}`, inserts the `artifacts` row
  (`storage_key`, `byte_size`, `content_type`, `checksum`, `filename`, `expires_at =
  created_at + 7 days`), then commits T6 with the artifact reference; a failed promote creates
  **no** artifact row and never commits `succeeded`; an artifact over the registry output cap
  commits T7 `failed` with an error code and is never `succeeded`; the cap value is read from
  the registry, not from the handler; scratch is removed on both paths. Fails. · owner: core
- [ ] 12.2 Implement the pipeline glue in `workers/media/src/mediaforge/runtime/attempt.py`. ·
  owner: core
- [ ] 12.3 GREEN — the suite passes; record the command and, for the oversize case, the observed
  canonical-key bytes remaining unreferenced (the orphan case the design accounts for). ·
  owner: core

**Start:** storage port, worker CAS, handler exist. **Done:** a worked attempt produces promoted
bytes plus an artifact record, or a classified failure — never a `succeeded` job without a
resolvable artifact. **Verify:** 12.1 command + the recorded orphan observation. **Rollback:**
delete `attempt.py` and its suite; promoted bytes under the disposable volume are removed with
it.

### WU-10 — Timeout, process-group termination, and scratch cleanup on every exit path · owner: core

**Anchors:** C4 "Wall-Clock Timeout Terminates the Whole Process Group" · C6 "Scratch Is Deleted
on Every Exit Path" · C5 "The Handler Cannot Exceed the Containment Budget" · C4 scenarios "A
timeout is classified rather than left silent" and "No failure leaves the job in `running` or
the message unacknowledged"; design §10.

- [ ] 10.1 RED — `workers/media/tests/test_timeout.py` (pytest) with a fixture handler that
  spawns a child tool and sleeps past the registry limit: on expiry the handler **and its child**
  are terminated (`SIGTERM` then `SIGKILL` to the process group), no surviving process from the
  attempt remains, T7 commits `failed` with a timeout-classified error code, the message is
  acked because an outcome was committed, and the scratch prefix is gone. Fails. · owner: core
- [ ] 10.2 RED — `workers/media/tests/test_scratch_cleanup.py` (pytest): success, failure,
  timeout, and claim-loss paths each remove `work/{job_id}/{attempt_no}/`, and partial outputs
  are not readable afterwards. Fails. · owner: core
- [ ] 10.3 Implement the registry-driven wall-clock timer, `start_new_session=True` spawning,
  `os.killpg` termination, timeout classification, and `finally`-based scratch removal. ·
  owner: core
- [ ] 10.4 GREEN — both suites pass; runtime harness: force a timeout on the composed stack and
  record `ps` output showing no orphan processes. · owner: core

**Start:** attempt pipeline exists (WU-12). **Done:** no attempt can outlive its limit or leave
scratch behind. **Verify:** 10.1/10.2 commands + recorded `ps` output. **Rollback:** remove the
timer/kill/cleanup code and both suites; the spawn path falls back to WU-14's plain spawn.

### WU-14 — One process per job and a network-less handler child · owner: core

**Anchors:** C5 "The Sandbox Is a Container per Worker and a Process per Job" · C5 "The Handler
Cannot Exceed the Containment Budget" (no handler work outlives the attempt) · C4 "Wall-Clock
Timeout Terminates the Whole Process Group"; design §10; gated by WU-13.

- [ ] 14.1 RED — `workers/media/tests/test_process_isolation.py` (pytest): two jobs each run in
  their own handler process and terminating one does not terminate the other; the handler's
  mount view exposes only the attempt scratch (writable) and the materialized input (read-only);
  a handler write to the canonical artifact key or to the inbox fails; the handler child has no
  network while the worker still reaches Postgres and Redis; no process spawned by an attempt
  survives it. Fails. · owner: core
- [ ] 14.2 Implement `asyncio.create_subprocess_exec(..., start_new_session=True)` with a
  `bwrap` argument array built from a fixed set (`--unshare-user --unshare-net --unshare-pid
  --ro-bind / / --dev /dev --proc /proc --tmpfs /tmp --bind <scratch> /scratch --ro-bind <input>
  <input> --die-with-parent`), never a shell string. · owner: core
- [ ] 14.3 GREEN — the suite passes; runtime harness: run two sequential jobs and record `ps`
  showing no leftovers; record the handler-child connectivity probe result. · owner: core

**Start:** WU-13 recorded, worker CAS and pipeline in place. **Done:** job↔job isolation and a
no-network handler child proven. **Verify:** 14.1 command + recorded probes. **Rollback:** revert
the spawn path to a plain subprocess and delete the suite; the container limits from WU-15
remain.

---

## S5 — Runtime configuration, corrections, evidence

### WU-15 — Worker container runtime configuration · owner: toil

**Anchors:** C5 "The Sandbox Is a Container per Worker and a Process per Job" (read-only rootfs,
non-root, resource limits) · C5 "The Handler Cannot Exceed the Containment Budget" · C4 (worker
retains Postgres + Redis access); design §2.1, §10.

- [ ] 15.1 RED/verify (runner: pytest, `docker inspect`) — `workers/media/tests/test_container_config.py`
  asserting against the composed worker container: root filesystem read-only; process not root
  (uid 10001); `cap_drop: ALL`; `no-new-privileges`; memory, CPU and `pids_limit` set; attached
  only to the internal network carrying Postgres and Redis; `mediaforge-storage` mounted at the
  **same path** as in the API container. Fails until the configuration exists. · owner: toil
- [ ] 15.2 Update `docker/worker.Dockerfile` (pinned-by-digest `python:3.11-slim`, pinned
  ffmpeg/ffprobe, `util-linux` for `unshare`, `bubblewrap`, non-root `USER mediaforge`) and
  `docker/compose.yaml` (`read_only: true`, tmpfs `/tmp`, writable storage mount, limits,
  internal bridge with no default internet route). · owner: toil
- [ ] 15.3 GREEN — the config suite passes; record `docker inspect` excerpts and the internal
  network reachability result. · owner: toil

**Start:** worker image + WU-13 findings. **Done:** containment boundaries enforced by the
container, not by convention. **Verify:** 15.1 command + recorded inspect output. **Rollback:**
revert the Dockerfile/compose changes; the application code is unaffected.

### WU-18 — Pending documentation corrections · owner: artifact

**Anchors:** C3 "The Dispatch Intent Is Committed With the Job Transition" (an outbox row MUST
NEVER exist for a job that is not `queued`) · C1 "A Job Row Exists Before Any Byte Is Accepted"
(create before bytes) · ADR-0001 (accepted; four verbs) · C1 "Ingestion Is Upload-Only" (worker
reads input bytes through an input handle) · C6 "Bytes Are Streamed Through the Port" · C6 "One
Storage Port With Semantic Verbs and No Filesystem Leak"; design §3 "Two submission
transactions, not one (spec correction)" and §8 "Reconciliation note".

- [ ] 18.1 Correct `proposal.md`: replace the line stating the API writes *"jobs, submissions and
  the outbox row in one transaction"* with the **two** transactions the specs require — (1)
  create: `INSERT jobs (created)` + `INSERT job_inputs` + `INSERT submissions`, committed before
  any byte is accepted; (2) T1: `UPDATE jobs SET state='queued' WHERE state='created'` +
  `INSERT outbox`, committed only when every input is complete and legal (C3 forbids an outbox
  row for a non-`queued` job). Mirror the correction in `proposal.es.md`. Evidence: `git diff`
  touches only that paragraph, and no remaining one-transaction claim survives a re-read. ·
  owner: artifact
- [ ] 18.2 Amend **ADR-0001** in place: record `openRead` as the fifth storage-port verb, with
  the requirement trace (C1 requires the worker to read input bytes through an input handle; C6
  requires bytes to be streamed through the port) and the reason the original four were scoped
  to the API ingest/deliver path; note the C6 requirement's "exactly the four semantic
  operations" wording and how design §8 reconciles it; restate the intact invariant — `openRead`
  returns a byte stream, never a path or URL, so "no filesystem leak" holds. Keep the original
  decision text and add the amendment with its date; do not rewrite the accepted decision.
  Evidence: `git diff` of the ADR. · owner: artifact
- [ ] 18.3 Cross-artifact check: `grep` over `openspec/` for stale "four verbs" / "one
  transaction" phrasing, excluding `explore.md` (preserved snapshot) and
  `design/research-queue-*.md` (evidence). Record the grep and any additional correction needed.
  · owner: artifact

**Start:** the corrections are already decided in design §3/§8 and the preflight context.
**Done:** both artifacts corrected and cross-checked. **Verify:** the two diffs + the grep
output. **Rollback:** revert the two documents; no code depends on the prose.

### WU-19 — Structured logging and secret redaction · owner: toil

**Anchors:** C1 "The Creator Token Is Returned Once, Stored Hashed, and Never Logged" (scenario
"The token never reaches logs") · C8 "Read Access Is Granted Through `createReadGrant`…" (no
path/key/bucket/credential in a response) · C8 "The Display Filename Is Sanitized and Never a
Storage Key"; design §9.

- [ ] 19.1 RED — `apps/api/test/logging.redaction.spec.ts` (Vitest) and
  `workers/media/tests/test_logging_redaction.py` (pytest): capture the log output of a
  submission and a token-bearing download and assert that no creator token, no token-bearing
  URL, no `DATABASE_URL`/`REDIS_URL`/password, no raw upload body, no client filename in raw
  form, no idempotency key in raw form, and no storage key/URL ever appear; assert the
  correlation id is `job_id` and that the lifecycle events in design §9's "Logged" column are
  emitted (heartbeats at debug only; `delivery_count` as a metric). Fails. · owner: toil
- [ ] 19.2 Implement pino (Node) and structlog (Python) with the deny-list redactor
  (`authorization`, `token`, `DATABASE_URL`, `REDIS_URL`, `password`). · owner: toil
- [ ] 19.3 GREEN — both suites pass; record the captured-output excerpts. · owner: toil

**Start:** submission and download paths exist. **Done:** secrets cannot reach logs. **Verify:**
19.1 commands. **Rollback:** revert the logger configuration and delete both suites; request
handling is otherwise unaffected.

### WU-20 — Declared limitations, operator docs, and the AV13 note · owner: artifact

**Anchors:** C1 "Submissions Are Rate Limited per Source IP" (scenario "The shared-NAT
limitation is documented") · C6 "Retention Is Declared as Seven Days and `expires_at` Is
Written" (no sweep ships) · C8 "The Download Endpoint Distinguishes the Six States and the
Expired Artifact Case" · C4's recorded accepted limitations (a dead worker leaves a `running`
job; both failure classes commit T7) · design §12 (AV13); proposal success criteria.

- [ ] 20.1 RED/verify (runner: Vitest) — `apps/api/test/docs.contract.spec.ts` asserting the
  required statements are present in the repository documentation: the submission rate limit is
  **per source IP** and clients behind a shared NAT share one bucket; retention is **7 days**
  and **no sweep runs**; a `succeeded` job whose artifact has expired stays `succeeded` and its
  download is reported as expired (not failed); no reaper exists, so a worker dying mid-attempt
  leaves the job `running`; transient and non-retryable failures both commit `failed`,
  distinguished by `error_code`; there is no web UI and no queue-depth backpressure. Fails. ·
  owner: artifact
- [ ] 20.2 Write `README.md` (compose up, submit via `curl`, download via the capability header;
  Playwright is not used — no UI) and `docs/limitations.md`, including **AV13**: the client must
  store `job_id` + creator token locally; losing the token makes the job unreachable, and a
  resubmission with the same idempotency key returns the `job_id` but never re-issues the
  token. · owner: artifact
- [ ] 20.3 GREEN — the docs contract suite passes; record the command. · owner: artifact

**Start:** download/cancel behavior fixed (WU-17). **Done:** every declared limitation is
written where a reader finds it, and the doc requirement is checked, not asserted. **Verify:**
20.1 command. **Rollback:** revert the docs and delete the doc suite.

### WU-21 — Compose E2E smoke and artifact property gate · owner: toil

**Anchors:** C5 "Artifact Acceptance Is by Properties, Not by Bytes" · C5 "`audio.extract`
Produces Exactly One mp3 From One Video Input" · C3 "Both runtimes accept the same envelope"
scenario (contract parity with real bytes) · proposal success criteria 1–2; design §11 (E2E smoke
is an acceptance gate, not part of the red-green cycle).

- [ ] 21.1 RED — `workers/media/tests/test_e2e_smoke.py` (pytest over `docker compose`): submit
  real bytes over HTTP, poll job state until terminal, download through the capability, and
  assert mp3 properties with ffprobe (duration, codec, bitrate — **never** byte equality); assert
  the run needs no manual step and that a second submission is idempotent under a repeated
  `Idempotency-Key`. Fails until the stack is wired end to end. · owner: toil
- [ ] 21.2 Wire the remaining stack gaps the smoke test exposes (compose profiles, storage volume
  mounts, worker network, startup order) — fixing sequencing, not weakening assertions. ·
  owner: toil
- [ ] 21.3 GREEN — record the exact command and full output. This recorded demo run is the
  slice's portfolio evidence. · owner: toil

**Start:** all other units landed. **Done:** one command proves upload → validate → dispatch →
claim → ffmpeg → promote → download with real bytes. **Verify:** the recorded command and
output. **Rollback:** delete the smoke test; the running stack is disposable and recreated.

---

## Explicitly out of scope — must not appear as tasks

No reaper (T8), no input-TTL failure (T2), no poison-message handling (T10), no dead-letter
queue, no replay, no progress or event streaming (C7), no cooperative cancellation of a running
job (T9), no `pdf.merge` or `pdf.split`, no URL ingestion, no user accounts or tenancy, no web
UI, no queue-depth backpressure, no retention sweep, and no orphan-artifact sweep. Playwright is
not adopted (no UI).

`jobs.available_at` and the adapter's `delivery_count` are sanctioned by design §14 because the
specs' guards and ADR-0002 already require them: they exist, they are asserted only as
observability, and **nothing schedules against them**.
