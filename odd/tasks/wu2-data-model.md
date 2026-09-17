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
   facade. Today it only works on one path, and this decision was written before that was measured:
   with the candidate **uncommitted**, `inspect` returns an `execute` transition that issues the
   `lineageId` itself and offers the complete `review start` route — so the sequence is exactly right
   there. With the workspace **clean** (everything committed) the projection is empty, the transition
   becomes `collect` / `empty_candidate_base_ref_required`, and *that* path dead-ends on a `lineageId`
   its own collect step never issues. `assess` fails schema validation on any candidate without a risk
   signal. Work-unit commits stay, because they are the recovery points and the reviewable units.
4. **Data-model corrections from the supervisor's review of the artifacts (2026-09-17).** Three
   changes, each with its own reason: `attempts.error_class` and `outbox.event_type` become **enum
   types** (closed domains the design fixes), and `submissions` loses `client_id` while
   `idempotency_key` becomes NOT NULL and globally unique. The third one fixes a **measured defect**,
   not a style preference — see task 1.7 and the evidence log. The criterion for enum-versus-text is
   now written in the schema header so the next column is not decided by accident.

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

**Planned hand-edits to the generated migration.** Prisma cannot express these, so they are appended
to the generated SQL so that one file stays the single DDL authority (`design.md` §5). The enum is
**not** in this list: Prisma expresses it natively (`CREATE TYPE`), contrary to §5's wording.

```sql
-- 1. CHECK constraints -------------------------------------------------------
ALTER TABLE "job_inputs" ADD CONSTRAINT "job_inputs_ordinal_positive" CHECK ("ordinal" >= 1);
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_attempt_no_positive" CHECK ("attempt_no" >= 1);
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_error_class_allowed"
  CHECK ("error_class" IS NULL OR "error_class" IN ('retryable', 'non_retryable'));

-- 2. The partial index the relay poll needs ----------------------------------
CREATE INDEX "outbox_unpublished_idx" ON "outbox" ("published_at") WHERE "published_at" IS NULL;

-- 3. Least-privilege roles (design.md §3) ------------------------------------
-- LOGIN without a password: credentials are a deployment concern and are set out-of-band, so no
-- password is committed in a migration. The privilege suite exercises these roles through SET ROLE
-- and asserts `rolcanlogin` separately. The DO blocks make the migration re-appliable to a second
-- database in the same cluster, where the roles already exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mediaforge_api') THEN
    CREATE ROLE "mediaforge_api" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mediaforge_worker') THEN
    CREATE ROLE "mediaforge_worker" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- The roles must be able to reach the database and the schema before table grants mean anything.
-- The database name differs between dev and test, so it is read from the current connection.
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO "mediaforge_api", "mediaforge_worker"',
                 current_database());
END
$$;
GRANT USAGE ON SCHEMA "public" TO "mediaforge_api", "mediaforge_worker";

-- PUBLIC holds nothing (design.md §3).
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM PUBLIC;
REVOKE ALL ON SCHEMA "public" FROM PUBLIC;

-- api: SELECT/INSERT/UPDATE on its four tables, SELECT on attempts and artifacts. No DDL, no DELETE.
GRANT SELECT, INSERT, UPDATE ON "jobs", "job_inputs", "submissions", "outbox" TO "mediaforge_api";
GRANT SELECT ON "attempts", "artifacts" TO "mediaforge_api";

-- worker: SELECT on jobs/job_inputs/submissions, full control of attempts, INSERT on artifacts,
-- UPDATE on jobs. No outbox access, and no DELETE for either role: scratch cleanup is a storage
-- operation, never a database DELETE.
GRANT SELECT ON "jobs", "job_inputs", "submissions" TO "mediaforge_worker";
GRANT SELECT, INSERT, UPDATE ON "attempts" TO "mediaforge_worker";
GRANT INSERT ON "artifacts" TO "mediaforge_worker";
GRANT UPDATE ON "jobs" TO "mediaforge_worker";
```

**A version trap worth recording.** `npx prisma` (which the schema linter reaches for) resolves the
`latest` dist-tag, and at the time of writing `latest` is **`8.0.0-rc.15`** — a release candidate. The
last stable is **`7.10.0`** (`dist-tag: prev`), and that is what this project pins, for the same reason
`pyproject.toml` pins Python to `3.11.x` exactly: an unpinned toolchain silently stops matching the
thing being designed.

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

### 1.7 — Data-model corrections from the supervisor's review · owner: AI

Raised by the supervisor after reading the feature document and the created artifacts. Four items,
three of them changes to the model and one a documentation fix.

1. **`attempts.error_class` becomes the enum type `FailureClass`** (`retryable`, `non_retryable`). The
   column was `text` plus a CHECK, while `jobs.state` — the same kind of closed domain — was already an
   enum. The design stated no criterion for the difference, and the reason it gave in §5 ("constraints
   Prisma cannot express") is false: Prisma generates `CREATE TYPE` for an enum. Converting it also
   removes the CHECK, and with it the gap an independent verifier had constructed — a type cannot be
   written in a way that forbids NULL on a column the design declares nullable.
2. **`outbox.event_type` becomes the enum type `OutboxEventType`** (`job.queued`). The design fixes
   the set; a type documents it and is how a second event is added.
3. **`submissions` loses `client_id`; `idempotency_key` becomes NOT NULL and globally unique.** This is
   a defect fix, measured, not a preference: see the evidence log.
4. **The criterion is written down.** `job_type` stays text (a registry key, open by design) and both
   `error_code` columns stay text (an open taxonomy the design expects to grow). The schema header now
   states when each applies.

**Acceptance:** the three enums exist in the live database with the declared labels; `submissions` has
no `client_id` and rejects a repeated `idempotency_key`; both suites green; `migrate diff` reports no
drift. Because the migration has **never left this machine** (the branch is local and `mediaforge_test`
is its only destination), the change is folded into the initial migration instead of adding a second
one — if it had been shared, a fixup migration would have been the only honest option.

**Divergence, recorded and now closed:** `design.md` §3 showed `client_id`, `text` `error_class` and
`text` `event_type`, and C1's spec described the `(client_id, key)` pair. The design and the specs are
approved artifacts, so this feature treated them as read-only and recorded the divergence instead of
editing them unasked. The supervisor asked for the ERD to be updated on 2026-09-17, and both artifacts
were amended in the same change — see task 1.8.

### 1.8 — Update the ERD and the C1 spec to the built model · owner: AI

Requested by the supervisor once the divergence above was on the table. `design.md` §3 and
`specs/submission-validation/spec.md` now describe what the database enforces, as **explicit dated
amendments** rather than silent rewrites — the convention this repository already used for ADR-0001,
so the reason for each change is readable next to it.

**Acceptance:** the ERD's six tables, three enum types, four uniques, six foreign keys, two CHECKs and
partial index match the live catalog with no divergence in either direction; §5 no longer claims that
Prisma cannot express enums, nor that no schema file exists; the C1 requirement no longer scopes
idempotency to a pair; and an independent verifier confirms the agreement rather than the writer.

**One thing this task exposed that is not documentation:** the generated Prisma client was stale —
`prisma generate` had not been run after the schema changed, and every test passed anyway. See the
evidence log.

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


### 1.1 — independent verification, and what it changed (2026-09-17)

The RDD gate for this work unit ran an independent verifier against `schema.spec.ts`. Verdict: the
suite is a **genuine RED** — 11 of 11, every failure confirmed as absence-of-schema, re-run
independently — and it is **not a complete gate**. Two items lead, because they are defects rather
than opinions:

1. **A false-RED waiting in GREEN.** `uniqueColumnSets` reads `pg_constraint` (`contype IN ('u','p')`).
   Prisma emits `CREATE UNIQUE INDEX` for `@unique` and `@@unique`, and a unique index creates **no**
   `pg_constraint` row. On a *correct* generated schema the four unique assertions would fail. The
   suite has to read uniqueness as **enforcement** (unique indexes, partial ones excluded), not as
   constraint rows — and the alternative, hand-editing the migration to convert uniques into
   constraints, would be contorting the schema to please a test.
2. **A false statement in this file's own header, inherited from the design.** The header claims
   Prisma cannot express the `state` enum. It can: Prisma has native enum blocks and generates
   `CREATE TYPE`. `design.md` §5 says the same thing and WU-2's `2.3` repeats it. Only the three CHECK
   constraints and the partial index are genuinely inexpressible. `design.md` is this feature's
   read-only source and is **not** edited here; the finding is recorded instead.

**The finding that decided the response.** The verifier constructed a single wrong schema that passes
**all eleven** assertions: a scrambled enum declaration order, `CHECK (error_class = 'non_retryable')`
(which satisfies all three substring regexes, including `/retryable/` matching *inside* that literal),
`submissions` without `creator_token_hash`, `artifacts.id` nullable and with no primary key,
`outbox.payload` as `text`, an unrelated partial index on `created_at`, and `jobs.artifact_id`
pointing at `submissions`. A gate that admits that schema is not a gate, so the suite is strengthened
**before** GREEN: a suite measured against nothing produces green evidence about nothing.

The strengthening list, all from that review: read uniqueness from unique indexes; assert the
declared enum order as well as the label set; anchor the `uuidv7()` default regex instead of matching
a substring; require the partial index's **leading column** and not only its predicate; compare the
`error_class` label set exactly instead of matching substrings; assert the six expected foreign keys
**and** their targets instead of only "every existing FK is indexed"; assert nullability in both
directions for every column the ERD marks nullable; assert a primary key on every table; assert full
column sets for `job_inputs`, `submissions`, `artifacts` and `outbox`, which had none; and widen the
type assertions to the `int`, `uuid`, `jsonb` and remaining `timestamptz` columns.


### 1.2 — RED: the least-privilege suite (2026-09-17)

```text
$ uv run --project workers/media pytest workers/media/tests/test_db_privileges.py -q

E   asyncpg.exceptions.InvalidParameterValueError: role "mediaforge_api" does not exist
=========================== short test summary info ===========================
FAILED ...::test_both_runtime_roles_exist_without_superuser_power
FAILED ...::test_the_privilege_matrix_is_exactly_as_designed[mediaforge_api-granted0]
FAILED ...::test_the_privilege_matrix_is_exactly_as_designed[mediaforge_worker-granted1]
FAILED ...::test_worker_cannot_reach_the_outbox
FAILED ...::test_neither_role_can_run_ddl[mediaforge_api]
FAILED ...::test_neither_role_can_run_ddl[mediaforge_worker]
FAILED ...::test_neither_role_can_delete[mediaforge_api]
FAILED ...::test_neither_role_can_delete[mediaforge_worker]
FAILED ...::test_public_holds_nothing_on_the_tables
FAILED ...::test_worker_can_actually_claim_an_attempt_and_fence_a_job
FAILED ...::test_api_can_actually_write_its_create_transaction
11 failed in 0.99s
[exit=1]
```

The failure reason is absence (`role "mediaforge_api" does not exist`), not a malformed file.

**The first run passed one test, and that pass was vacuous.** Before the fix, the run was
`10 failed, 1 passed`, and the pass was `test_public_holds_nothing_on_the_tables`: with no tables in
`pg_class`, the ACL query returns nothing, and an empty result satisfies "no privilege leaked". Green
for a reason unrelated to what is asserted. Fixed by asserting `to_regclass(table) IS NOT NULL`
before each ACL check, which is also what makes the test meaningful in GREEN. Second run: 11 failed,
0 passed. This is the same family as defect D1 and the broken CR scan — a check that cannot fail
the way it claims to.

**A linter finding fixed structurally, not silenced.** The first version of this file built SQL by
interpolation (`SET ROLE "{role}"`) and passed the statement into a helper as a string; pi-lens
flagged it as an injection sink. The role names are module constants, so it was not exploitable —
which is precisely why silencing it would have been the wrong call. It was removed instead:
`set_config('role', $1, false)` is the same operation with the role as a bound parameter, and the
`as_role` context manager takes no SQL at all, so the denial statements are literals at their call
sites. Result: `Python clean`.


### 1.2 — independent verification, and what it changed (2026-09-17)

Verdict: a genuine RED (absence failures only, independently re-run), the design's privilege matrix
matched **cell by cell in both directions**, and the vacuous-pass fix was confirmed as the correct
assertion level — the verifier agreed that asserting "PUBLIC holds nothing" is the property that
matters and that rejecting a NULL `relacl` would be testing a side effect instead.

**Refuted, and fixed in this work unit:**

- **The matrix swept four privileges, not all of them.** `GRANT TRUNCATE ON any_table TO either_role`
  passed all eleven tests, contradicting the docstring's own claim that "every other combination must
  be absent". The sweep now covers all seven table privileges PostgreSQL has.
- **§3 requires migrations to run under the owner role, and nothing asserted it.** An owner can
  `ALTER` or `DROP` a table **without holding any DDL grant**, so the DDL denial could have been
  meaningless while every other assertion stayed green. A new test asserts no runtime role owns a
  table, non-vacuously: it asserts the six tables exist before judging their owner.
- **The header credited `.env.example`** for the variable names. That file does not exist — the
  supervisor dropped it on 2026-09-16 — so the provenance is `design.md` §3, and the comment now says
  only that.

**Not measurable, recorded instead of assumed:** whether `set_config('role', $1, false)` enforces the
same membership check as `SET ROLE` (constructing a non-membership denial requires creating roles,
outside the verifier's authorized surface; PostgreSQL documents both as the same setting, and the
observed missing-role failure is an absence error either way); and whether `REVOKE ALL FROM PUBLIC`
can leave a zero-privilege `aclitem` behind (the assertion's direction is sound either way).

**Residual, stated rather than implied:** column-level grants live in `pg_attribute.attacl` and are
not swept. The design's matrix is table-level, and `has_table_privilege` does return true for
any-column privileges, so a column-level grant is caught only where it touches the two executed write
paths. That is now written in the suite's header instead of being left for a reader to discover.


### 1.3 — GREEN: schema, migration, roles (2026-09-17)

**Prisma 7, adopted by supervisor decision, and what that changed.** The design and the plan assumed
the classic model. Prisma 7 removed `datasource.url` from the schema, requires `prisma7.config.ts`
for the connection string, replaces the generator with `prisma-client` (explicit `output`) and needs a
driver adapter for a direct connection. The adapter depends on `pg`. Recorded because it is a real
change to the design's assumptions, not a dependency bump.

> **Correction (2026-09-17, same day).** This section originally claimed that "O2's letter still
> holds — `pg` never enters this manifest". **That was false in both directions and the independent
> verifier refuted it.** `pg` and `@types/pg` were already direct devDependencies of `apps/api` from
> the S1 scaffold, and they are still there; and `test/harness.spec.ts` still imports `Client` from
> `pg`. O2 was never satisfied by this work unit — it is **task 1.4**, and it is still open. The claim
> was written from reasoning about the adapter instead of from reading the manifest, which is exactly
> the failure this project keeps finding in other people's documents.
>
> **Closed later the same day, in task 1.4.** Both halves are now true and measured: neither `pg` nor
> `@types/pg` appears in any manifest in this repository, and no file imports `from 'pg'` — both suites
> talk to PostgreSQL through the Prisma client. `@prisma/adapter-pg` still brings `pg` **transitively**,
> which is expected and is the honest way to state it: the constraint is about the manifest.

**A version trap, measured.** `npm view prisma dist-tags` reports `latest: 8.0.0-rc.15` — a release
candidate under the `latest` tag — and `prev: 7.10.0`. `npx prisma` (which the schema linter reaches
for) resolves that RC. This project pins `7.10.0` in the manifest.

**The plan's 2.4 acceptance command no longer exists in v7.** `--from-schema-datasource` and
`--to-schema-datamodel` were replaced by `--from-config-datasource` and `--to-schema`, and
`--exit-code` turns "no drift" into exit `0` (empty: 0, error: 1, not empty: 2). The replacement was
measured rather than assumed:

```text
$ pnpm --filter api exec prisma migrate diff --from-config-datasource \
    --to-schema=prisma/schema.prisma --exit-code
Loaded Prisma config from prisma7.config.ts.
No difference detected.
[exit=0]
```

**The ERD and the design's own canonical SQL disagreed about defaults.** Found while reviewing the
migration, not by reading prose. Two statements in §6 insert rows without every NOT NULL column:

| Line | Canonical SQL | Columns it omits |
| --- | --- | --- |
| `design.md:355` | `INSERT INTO outbox (job_id, event_type, payload)` | `attempts`, `created_at` |
| `design.md:379` | `INSERT INTO attempts (job_id, attempt_no, lease_owner, lease_expires_at, started_at)` | `created_at` |

Resolved in favour of the canonical SQL: those three columns carry defaults, and **no other column
does**. C1's create transaction (jobs, job_inputs, submissions) has no canonical SQL in the design, so
it gets no defaults — a forgotten value there fails loudly instead of being papered over. Recorded as
a decision in the schema header, not left as an unexplained inconsistency.

**Migration and hand-edits.** Generated with `migrate dev --create-only --name init`, then edited:
the `state` enum is **not** among the hand-edits (Prisma generated `CREATE TYPE` itself, refuting §5's
wording and this file's earlier header), while the three CHECK constraints, the partial outbox index
and the roles/grants are appended to the same file, which stays the single DDL authority.

```text
$ pnpm --filter api exec prisma migrate deploy
1 migration found in prisma/migrations
Applying migration `20260917183632_init`
All migrations have been successfully applied.
[exit=0]
```

`CREATE ROLE` inside Prisma's migration transaction works — measured here, because it was an open
question and "it should work" is not evidence.

**Both suites green, through the canonical commands:**

```text
$ pnpm test:api      -> Test Files 2 passed (2) · Tests 20 passed (20)   [exit=0]
$ pnpm test:worker   -> 14 passed in 0.70s                              [exit=0]
```

**Three failures that only GREEN could reveal — all of them test bugs, not schema bugs.** In RED every
assertion failed for absence, so nothing exercised whether the assertions could *express* a pass:

1. `array_agg` returns a **string** (`'{job_id,ordinal}'`) through node-postgres, which does not parse
   `text[]`; the comparisons against real arrays could never pass. Fixed with `json_agg`, which the
   driver does parse. This is the same class as the `pg_constraint` issue the verifier predicted, and
   it is the reason a suite that is red for absence cannot validate its own assertions.
2. The "exactly six tables" assertion counted `_prisma_migrations`, Prisma's own ledger. Excluded.
3. A unique-column-set expectation written in declaration order failed against the correctly sorted
   set; the schema was right and the assertion was wrong. Now compared with an explicit `setOf`, so
   the order-insensitivity is in the code instead of in a helper's `ORDER BY`.

**A gate that did not cover its own suites.** `test:api` ran only `test:harness`, and `test:worker`
only `tests/test_harness.py`, so the schema and privilege suites were outside the canonical commands:
they could pass or fail without `pnpm test:api` ever running them. Both scripts (and the `Makefile`
targets) now run the whole suite for their runtime. Same family as defect D1 — a gate that cannot fail
is not a gate, and a gate that does not run the test is not covering it.

**The image was rebuilt and inspected, not assumed.** The lockfile changed, so a green `build` would
have proven nothing about the image (defects D2/D3):

```text
$ docker compose -f docker/compose.yaml build api   [exit=0]
$ docker compose -f docker/compose.yaml up -d --wait [exit=0]
mediaforge-api Up (healthy) · mediaforge-postgres Up (healthy)
mediaforge-redis Up (healthy) · mediaforge-worker Up

$ docker run --rm --entrypoint sh mediaforge-api:latest -c "..."
/app: apps, node_modules, package.json, pnpm-lock.yaml, pnpm-workspace.yaml
apps/api/dist: app.module.js, health.controller.js, main.js (+ .d.ts, .map)   <- no partial emit
apps/api/prisma/migrations: 20260917183632_init, migration_lock.toml          <- present in the image
apps/api/node_modules/.bin/prisma --version: prisma 7.10.0 / @prisma/client 7.10.0 / linux
```

A first attempt at that inspection reported "prisma not found" and "no dist"; both were wrong because
the paths assumed a flat layout. In a pnpm workspace the binaries live under `apps/api/node_modules`,
and `dist` under `apps/api/dist`. The image was fine; the check was not. Listed here because the
correction is the point: `docker run` is only evidence if the path is right.


### 1.3 — independent verification, and what it refuted (2026-09-17)

Seven claims held: the live database matches the ERD §3/§4 with **zero divergence in either
direction** (49 domain columns, types, nullability, the six-label enum in declared order, four
composite uniques, the `uuidv7()` defaults and the `artifacts.id` exception, six foreign keys, three
CHECKs, the partial index, and the index trace); both roles match §3's privilege table in both
directions and neither owns a table; no drift, reproduced; both gates green **and** covering the
suites; the defaults decision sound within its scope (verified against both canonical statements, and
the answer to "is there any other NOT NULL column a canonical statement omits?" is no); nothing
smuggled in.

**One claim was refuted, and it was this unit's own: O2 is not satisfied.** See the correction above.
The verifier also noted that the transitive part is real — `@prisma/adapter-pg@7.10.0` depends on `pg`
and `@types/pg` — but the honest statement is that `pg` is **both** a direct devDependency and a
transitive one, not "transitive only".

**The suite can still be fooled, in three constructible ways.** The verifier read all eighteen
assertions and built wrong databases that pass every one:

1. **The sharpest:** replacing the `error_class` CHECK with one that forbids NULL
   (`CHECK (error_class IS NOT NULL AND error_class IN (...))`) passes, because the suite compares the
   union of quoted literals. But the ERD declares `error_class` nullable and §6's canonical T6 does
   `UPDATE attempts SET ... error_class = NULL`, which that constraint would reject.
2. `CHECK (ordinal >= 1 AND ordinal <= 1)` matches the suite's regex — the file's own header admits
   the regex is a spelling check, not a semantic proof — and the single behavioral test only inserts
   ordinal 1.
3. **No assertion reads `column_default` for the three §6 defaults**, so a database that dropped them
   passes all eighteen and then fails the design's own canonical inserts at runtime.

**Where those three stand — and a correction.** The first is closed **by construction**: `error_class`
is now an enum type and the suite asserts the column stays nullable, so a CHECK that forbids NULL no
longer exists to be written. The other two — the over-constrained `ordinal` CHECK and the three §6
defaults — were **not** closed when this paragraph first claimed they were; saying "closed in the
follow-up" before the assertions existed is the same failure this feature keeps finding, one level up.
All three are now closed, in the 1.4 follow-up that moved this suite to the Prisma client: the
over-constrained CHECK is caught behaviorally (an `ordinal = 2` row must be accepted) and the defaults
are asserted by reading `column_default` and requiring **exactly** `attempts.created_at`,
`outbox.created_at` and `outbox.attempts` — and no other column. The lesson stands either way: a
catalog assertion proves what it reads, and nothing more.


### 1.4 — O2 closed, and the two remaining suite gaps (2026-09-17)

O2's two halves, measured rather than asserted: no `pg` and no `@types/pg` in any manifest in this
repository, and no file importing `from 'pg'` — both suites reach PostgreSQL through the Prisma client
built by `test/prisma-client.ts`. The adapter still depends on `pg` transitively; the constraint is
about the manifest, and that is how it is reported.

```text
$ grep -rn "from 'pg'" apps workers        -> NINGUNO
$ grep -n '"pg"|@types/pg' apps/api/package.json -> NO esta en el manifiesto
$ pnpm test:api     -> Test Files 2 passed (2) · Tests 24 passed (24)   [exit=0]
$ pnpm test:worker  -> 14 passed in 0.76s                              [exit=0]
$ prisma migrate diff --from-config-datasource --to-schema --exit-code -> No difference detected [exit=0]
```

The two remaining verifier gaps are closed **behaviorally**, not by tightening a regex:

- **The over-constrained CHECK.** A transaction inserts a `job_inputs` row with `ordinal = 2` and must
  be accepted. `CHECK (ordinal >= 1 AND ordinal <= 1)` satisfies the regex the CHECK suite uses, and
  only execution tells the two apart.
- **The §6 defaults.** A new test reads `column_default` for every non-`id` column of the six tables
  and requires **exactly** the three the design's canonical SQL needs. A database that dropped them
  used to pass all eighteen assertions and then fail the design's own inserts at runtime.

**Two things measurement corrected along the way.** First, the behavioral tests now drive the
**generated client** rather than raw SQL, and the duplicate-ordinal assertion changed from the raw
SQLSTATE `23505` to Prisma's `P2002`. That was measured, not assumed: the test asserted `P2002` and
passed on the first run. Second, pi-lens's `[sql-injection]` rule flags **any** interpolation inside a
raw statement, including the tagged-template form Prisma parameterizes — so the fix was to stop
writing raw SQL in those two tests and use the typed client, which is the client the application uses.
The rule was not suppressed; the construct it objects to is gone, and the code is better for it.


### 1.5 — the two deliberate exceptions, verified (2026-09-17)

Both were checked against the live database rather than read off the schema:

```text
$ psql -c "SELECT column_name, column_default IS NULL AS sin_default FROM information_schema.columns
            WHERE table_name='artifacts' AND column_name='id'"
 id | t

$ psql -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns
            WHERE table_name='jobs' AND column_name='available_at'"
 available_at | timestamp with time zone | NO
```

`artifacts.id` has no default — the worker mints it with `SELECT uuidv7()` before promoting, and the
schema suite asserts the absence, which is what makes that future insert legal. `jobs.available_at`
exists and is NOT NULL, and **nothing schedules against it**: a repository-wide grep finds it only in
the migration, the suite's expected-column list, and test inserts that set it to `now()`. There is no
reaper and no scheduling code in this slice, so the column is a T4 guard and nothing else — exactly
what the ERD claims.


### 1.7 — the `client_id` defect, measured (2026-09-17)

The supervisor asked why `submissions` has a `client_id` when there is no authentication and no
registration to assign one. The question exposed two things.

**Nothing anywhere defines where `client_id` comes from.** Not the design, not the proposal, not the
specs, not the glossary. The glossary defines `Submission` as "the API-level event and record of a
user's request: idempotency key, client id, timestamp, resulting `job_id`" — and stops there. With no
accounts (AV13), no component could produce it.

**And because it was nullable, the uniqueness it was half of protected nothing.** PostgreSQL treats
NULLs as distinct, so `unique (client_id, idempotency_key)` allows unlimited rows with a NULL client.
Measured on the migrated database, in a rolled-back transaction:

```text
NOTICE:  CASO 1 (client_id NULL): segundo INSERT ACEPTADO -> NO deduplica
NOTICE:  CASO 1: filas con la misma key = 2
NOTICE:  CASO 2 (client_id presente, jobs distintos): segundo INSERT RECHAZADO -> SI deduplica
```

The consequence is not cosmetic: C1 promises that a repeated submission carrying the same key returns
the first job. For any client that omitted `client_id` — which nothing required it to send — that
promise silently degraded into "create a second job".

**Resolution:** `idempotency_key` becomes NOT NULL and globally unique, and `client_id` is removed.
Without accounts, a per-client namespace adds nothing; a client-generated UUID key makes collisions
negligible, and the hole closes by construction.

**The other three items, for the record.** `error_class` and `event_type` became enum types, and the
criterion is now in the schema header. The enums were generated by Prisma itself:

```text
CREATE TYPE "JobState" AS ENUM ('created', 'queued', 'running', 'succeeded', 'failed', 'canceled');
CREATE TYPE "FailureClass" AS ENUM ('retryable', 'non_retryable');
CREATE TYPE "OutboxEventType" AS ENUM ('job.queued');
```

`OutboxEventType` needed `@map("job.queued")` on the enum value, because a Prisma enum value must be a
valid identifier and `job.queued` is not. The database label keeps the dot the design specifies.

**Two clarifications added to the design's own vocabulary**, because the supervisor's confusion was
produced by the documentation and not by him: `outbox` is the **transactional outbox pattern** (one
atomic write of the state change and the dispatch intent, with a relay publishing afterwards), not an
event log; and `submissions` is the **ownership and idempotency row** for one job (1:1), not an event
log. `design.md` §3 describes the tables by row count and not by purpose, which is what made two
different things look like the same thing.


### 1.8 — the ERD updated, and a stale client found (2026-09-17)

The supervisor asked for the ERD to be updated, so `design.md` §3 and the C1 idempotency requirement
now describe what the database enforces. Both are explicit dated amendments rather than silent
rewrites, following the convention this repository already used for ADR-0001. Updating the ERD alone
would have left the C1 requirement scoping idempotency to a `(client_id, key)` pair that no longer
exists, which is the same inconsistency in a new place, so both changed together.

**The finding that mattered: the generated Prisma client was stale.** `prisma generate` had never
been run after the schema changed, so the client's runtime data model still declared `Submission.clientId`
and mapped `client_id`, and its enum map was empty. **Every test passed anyway**, because the suites
touch that model only through `$queryRaw` and through `job`/`jobInput` accessors — the stale part was
invisible to the gate and would have surfaced as a runtime failure the first time WU-3 used
`submission.create(...)` or read the `FailureClass` enum. Regenerated, and verified afterwards that no
field named `clientId` survives.

**Two corrections to my own reading along the way.** A first grep for `client_id` in the generated
client looked like the staleness had survived regeneration, and it had not: the matches were the
**schema's own comments**, which Prisma embeds verbatim into `internal/class.ts` as `inlineSchema`. The
second: that same embedded text showed the schema header still claiming "three CHECK constraints"
including the `error_class` one, which had just become an enum — a stale comment found only because
the generated file quoted it back. Both fixed; the grep lesson is the same one this session keeps
producing, that a match is not a finding until you read what it matched.

**A note for WU-3:** the client is generated into `apps/api/generated/prisma/` and gitignored, so any
build that compiles the API must run `prisma generate` first. The Docker image does not do it yet
because nothing imports the client — that changes with the first unit that does.

**Independent verification of the amended artifacts (2026-09-17).** The RDD gate for this work unit ran
an adversarial verifier against the amended design and the live database. Verdict: **no refuted
claim.** All six tables, all 48 domain columns with their types and nullability, the three enum types
in declared order, six primary keys, four uniques (including `submissions.idempotency_key` being global
rather than paired), six foreign keys, the two CHECKs, the partial index and the least-privilege grants
match the catalog in both directions; each of the nine query-path rows names an index that exists with
the claimed shape; and §5's migration path, its single applied record and the no-drift result were
re-run rather than taken on faith.

Two things it corrected, both fixed: the §3 amendment said `event_type` had been `text` plus a CHECK
when it never had one, and the §5 amendment called the two CHECKs and the partial index "the only
hand-edits left" while the same migration also carries the roles and grants.

One claim it could not re-measure, and said so instead of accepting it: the spec note's historical
statement that two submissions with the same key and a NULL client were both accepted. That column no
longer exists, so the measurement is not repeatable on the current schema — but the verifier found the
pre-fix shape in git (`3b35895`: a nullable `client_id` and a unique index on the pair) and confirmed
the NULL-distinct reasoning. The honest state of that claim is **corroborated, not re-measured**.

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
