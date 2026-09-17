# Feature — `wu2-data-model` (the authoritative data model: Prisma schema, first migration, least-privilege roles)

> **Reading copy in Spanish:** `wu2-data-model.es.md`, generated at closure. Code blocks are
> byte-identical to this file; if they diverge, the English is canonical.

**Workflow:** Organic Driven Development (ODD).
**Requirements source of truth:** `openspec/changes/audio-extract-vertical-slice/` (read-only here).
**Status:** `in progress` — created 2026-09-17.

---

## Why this feature exists

WU-1 (workspace scaffold, toolchains, harness) is closed, pushed, and its residue is closed
(`odd/tasks/repo-hygiene.md`). The next unit in the SDD plan is **WU-2 — Authoritative data model**,
and it is the first unit where the project stops being scaffolding and starts having a contract that
the rest of the slice is written against: six states, attempts as rows, the idempotency pair, the
outbox intent, artifact metadata, and the two runtime roles that make "one DDL authority" real.

Everything after WU-2 depends on it. WU-3 (the dispatch contract) and WU-6 onward (queue, worker,
state machine) are written *against* this schema, so a mistake here is a migration, not a patch.

## Authoritative inputs

| Input | What it governs |
| --- | --- |
| `design.md` §3 *Data model* (line 129) | **The ERD is the authoritative model**: six tables, columns, types, uniques, the partial index, the FK indexes, and the two role privilege sets. |
| `design.md` §4 *UUID strategy* | `@default(dbgenerated("uuidv7()")) @db.Uuid` on every PK except `artifacts.id`, which the worker mints with `SELECT uuidv7()`. No ORM-level ids, no Python id generation. |
| `design.md` §5 *Migration ownership* | Prisma owns migrations. The enum, the three CHECK constraints and the partial index are **hand-edited into the generated migration**, which stays the single authority. |
| `adr-0003-worker-writes-postgres.md` | The worker writes Postgres directly; the schema is read-only from the Python side. |
| `tasks.md` → WU-2 | The acceptance criteria this feature mirrors, so the SDD plan and the ODD feature stay reconcilable. |
| Capability specs | C1 (job row before bytes), C2 (six states, attempts as rows, `attempts_used` derived, plural inputs with unique ordinal, terminal outcome), C3 (dispatch intent committed with the transition), C6 (artifact pointer + metadata, 7-day `expires_at`). |

**A file that must not be referenced:** `design/schema.prisma`. It is named in `tasks.md` as
non-existent, and it is: `git log --all -- '*schema.prisma'` returns zero commits, and no deletion
record exists. An earlier session note claimed it held 145 lines; the repository says otherwise, and
the repository wins. The ERD in §3 is the input.

## Constraints (non-negotiable)

- **Strict TDD.** `openspec/config.yaml` declares `strict_tdd: true`: RED is written and *observed
  failing* before any schema exists. A green suite that never went red is not evidence.
- **One DDL authority.** `apps/api/prisma/migrations/` is the only place DDL lives. The worker emits
  no DDL, ever. Every schema change is a Prisma migration on the API side.
- **The roles are part of the schema, not an afterthought.** The migration creates `mediaforge_api`
  and `mediaforge_worker` with exactly the privileges §3 lists, and revokes `PUBLIC`.
- **No counter column.** `attempts_used` is derived from `attempts`. `2.1` asserts the absence
  directly in `information_schema`, because "we did not add it" is not a check.
- **The two deliberate exceptions stay visible.** `jobs.available_at` exists and nothing schedules
  against it in this slice; `artifacts.id` has no database default and is minted by the worker.
- **RDD stays on** (supervisor decision, 2026-09-17). Each work unit is assessed and independently
  verified. The cost is known and accepted: the native review cannot start in this clone, and the
  assessment's passive path is unreachable, so every unit takes the risk-gated path. See
  `repo-hygiene.md` findings F1 and the RDD conformance record.

## Decisions taken with the supervisor (2026-09-17)

1. **The writer is the AI; the supervisor reads and objects.** The SDD plan tags WU-2 `owner: core`
   ("the user writes it and defends it in an interview"), and the standing working agreement
   replaced that on 2026-09-16: the AI writes every file, the supervisor reviews every change.
2. **RDD stays on** for this feature, accepting the per-work-unit independent verifier.
3. **The "review before commit" sequence is corrected, not applied.** That rule fixes a *working*
   facade. Both paths are broken today (`start` demands a `lineageId` that `inspect` never issues;
   `assess` fails schema validation on any candidate without a risk signal), so the position of the
   commit relative to the review changes nothing now. Work-unit commits stay, because they are the
   recovery points and the reviewable units.

## Tasks

Every task closes with at least one work-unit commit on the feature branch, and every commit is
assessed and independently verified (constraint above).

### 1.1 — RED: the schema contract suite · owner: AI

Write `apps/api/test/schema.spec.ts` (Vitest) asserting **against the migrated database**:

- the six state enum values and no seventh;
- `unique (job_id, ordinal)` rejects a duplicate ordinal; `unique (job_id, attempt_no)`;
  `unique (client_id, idempotency_key)` and `unique (job_id)` on `submissions`;
- **no counter column on `jobs`**, read from `information_schema`;
- every PK except `artifacts.id` defaults to `uuidv7()`, and `artifacts.id` has no default;
- the partial index `outbox (published_at) WHERE published_at IS NULL`;
- `CHECK (ordinal >= 1)`, `CHECK (attempt_no >= 1)`, `CHECK (error_class IN (...))`;
- `timestamptz` / `bigint` / `jsonb` column types;
- every foreign-key column is indexed.

**Acceptance:** the file exists and the observed failure is recorded. It fails because there is no
schema, not because the file is malformed — those are different failures and the log must show the
first.

### 1.2 — RED: the least-privilege suite · owner: AI

Write `workers/media/tests/test_db_privileges.py` (pytest) asserting, by *connecting as each role*:

- `mediaforge_worker` **cannot** `SELECT outbox`, cannot DDL, cannot DELETE; **can** SELECT
  `jobs`/`job_inputs`/`submissions`, INSERT/UPDATE `attempts`, INSERT `artifacts`, UPDATE `jobs`;
- `mediaforge_api` cannot DDL and cannot DELETE;
- `PUBLIC` is revoked.

**Acceptance:** the file exists and the observed failure is recorded, with the connection error
distinguished from a privilege denial (a role that does not exist yet fails differently from a role
that is denied, and the log must say which happened).

### 1.3 — GREEN: schema, migration, roles · owner: AI

1. Write `apps/api/prisma/schema.prisma` from the §3 ERD.
2. Generate the first migration into `apps/api/prisma/migrations/`.
3. Hand-edit that migration for what Prisma cannot express: the `state` enum type, the three CHECK
   constraints, and the partial outbox index. Add the role creation and grants.
4. `prisma migrate deploy` against `mediaforge_test`.

**Acceptance — the exact commands and their output recorded:**

```bash
docker compose -f docker/compose.yaml up -d --wait
pnpm --filter api --fail-if-no-match exec prisma migrate deploy
pnpm test:api
pnpm test:worker
pnpm --filter api --fail-if-no-match exec prisma migrate diff \
  --from-schema-datasource apps/api/prisma/schema.prisma --to-schema-datamodel apps/api/prisma/schema.prisma
```

The last command must report **no drift**. Both suites green. `--fail-if-no-match` is required, not
decorative (defect D1).

### 1.4 — O2: the harness database assertions move to the Prisma client · owner: AI

The supervisor's observation O2, accepted 2026-09-16 and **binding on this unit**: when WU-2 lands,
`apps/api/test/harness.spec.ts` moves its database assertions to the Prisma client, and `pg` plus
`@types/pg` leave `package.json`.

**Acceptance:** no `pg` import remains anywhere; `pg`/`@types/pg` are gone from the manifest and the
lockfile; both harness suites are green; and the harness is **stronger** than before, asserting
`current_database() = 'mediaforge_test'` through the client the application actually uses instead of
through a substitute.

### 1.5 — The two deliberate exceptions, verified as present · owner: AI

- `jobs.available_at` exists and always passes the T4 guard in this slice; **nothing schedules
  against it**. Verified by reading the schema and the migration, and stated where a reader looks.
- `artifacts.id` is written by the worker via `SELECT uuidv7()` (WU-12), never by a Python UUID
  generator. In this unit it is asserted as *absent default*, which is what makes the future
  insertion-with-explicit-id legal.

**Acceptance:** both exceptions are asserted by `1.1`'s suite or documented with the reason, and the
`Out of scope` section below names what would violate them.

### 1.6 — RDD conformance, per work unit · owner: AI

For each work-unit commit: run the assessment, record the assessed tier and outcome in the evidence
log, and satisfy the resulting plan. Given the two known defects, the expected record is
`unassessable`-as-high with an independent verifier; if a tier ever differs, that is new information
and belongs in the log rather than in a habit.

**Acceptance:** every work unit has an explicit tier-or-outcome line, and the independent verifier's
findings are recorded with what was done about each one.

## Evidence log

Raw output, appended as each task closes. Verbatim, not paraphrased.

### 1.1 — RED: the schema contract suite (2026-09-17)

```text
$ pnpm --filter api --fail-if-no-match exec vitest run test/schema.spec.ts

 test/schema.spec.ts (11 tests | 11 failed) 262ms
   × schema :: tables exist > creates exactly the six tables of the ERD
     → expected [] to deeply equal [ 'artifacts', 'attempts', …(4) ]
   × schema :: the six states, and no seventh > types jobs.state as an enum whose labels are exactly the six canonical states
     → jobs.state is missing: expected undefined to be defined
   × schema :: uniqueness is enforced, and by the engine > declares the four unique column sets the ERD requires
     → expected [] to deeply equally contain [ 'job_id', 'ordinal' ]
   × schema :: uniqueness is enforced, and by the engine > rejects a duplicate (job_id, ordinal) with a real unique violation
     → relation "jobs" does not exist
   × schema :: no counter column on jobs > has exactly the ERD columns, and none of them is a counter
     → expected [] to deeply equal [ 'id', 'job_type', 'params', …(6) ]
   × schema :: no counter column on jobs > keeps attempts as rows: the table exists and is keyed per attempt
     → expected [] to deeply equal [ 'id', 'job_id', 'attempt_no', …(7) ]
   × schema :: ids are database-minted > defaults every primary key to uuidv7() except artifacts.id
     → .toMatch() expects to receive a string, but got undefined
   × schema :: the partial index the relay poll needs > indexes outbox (published_at) WHERE published_at IS NULL
     → no partial outbox index; found:
   × schema :: CHECK constraints Prisma cannot express > constrains ordinal, attempt_no and error_class
     → expected '' to match /ordinal\s*>=\s*1/
   × schema :: types are the ones the model declares > uses timestamptz, bigint and jsonb where the ERD says so
     → expected undefined to be 'jsonb'
   × schema :: every foreign key is indexed > has an index whose leading column is each foreign-key column
     → expected 0 to be greater than 0

 Test Files  1 failed (1)
      Tests  11 failed (11)
[exit=1]
```

**Why this is the right red.** Ten of the eleven fail because the catalog is empty, and the eleventh
because the behavioral insert found no table (`relation "jobs" does not exist`). None failed on a
syntax or type error inside the test file. That distinction is the whole point of recording a RED
run: a malformed test also fails, and that failure would prove nothing about the schema.

**A plumbing artifact worth recording.** A second run piped through `head -30` printed `exit=0`. That
number came from the truncated pipe, not from a green suite — the authoritative exit code is the
first run's `1`, taken without truncation. It is defect D1 in miniature: a status produced by the
plumbing is not evidence about the thing being measured.

**Linter advisory, not actioned.** pi-lens reported a **stale** knip finding for
`apps/api/package.json`: `Unused devDependency @nestjs/schematics`. That package is not in the
manifest (checked directly), so the finding does not reproduce and nothing was changed to silence
it — the same disposition as findings F4/F5 in `repo-hygiene.md`.

## Out of scope

- WU-3 onward: the TS↔Python contract, the queue, the worker runtime, the state machine, storage.
- **Worker-side SQL.** The worker's `INSERT`/`UPDATE` statements are written in WU-4 and after. This
  unit makes the schema and the roles; the Python side only gains the privilege *assertions*.
- Any DDL from Python, and any second migration owner. If a later unit needs a schema change, it is a
  new migration here, not an `ALTER` there.
- Adding a counter column, a `public_id`, a reaper, retention sweeps, or a seventh state. All four
  are named as forbidden by the specs or the design, and none of them is a shortcut this unit may
  take.
- The `.es.md` reading copy is generated at closure, in sync, with byte-identical code blocks.
