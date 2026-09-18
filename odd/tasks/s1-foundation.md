# Feature — `s1-foundation` (rebuild of the SDD apply phase S1)

**Workflow:** Organic Driven Development (ODD).
**Source of truth for requirements:** `openspec/changes/audio-extract-vertical-slice/` (kept intact).
**Status:** `closed` — all four tasks 1.1–1.4 carry recorded evidence; the residue list below was
re-measured and closed by the follow-up feature `repo-hygiene` (commit `6fe5314`, 2026-09-17); and
this feature's tip `9eb288b` is an ancestor of `origin/main`. Spanish reading copy:
`s1-foundation.es.md`. See *Defects* (D1–D4) and the *Supervisor review log*.

---

## Why this feature exists

The SDD apply phase began work unit **S1 foundation** (WU-1 scaffold, WU-5 redis-py spike,
WU-13 sandbox precheck) and wrote ≈930 authored lines across `apps/`, `workers/`, `docker/`,
`contracts/` and the root manifests. The user could not understand the result, could not modify
it, and could not explain what any of it did.

Decision taken with the user on 2026-09-16:

1. **Delete every artifact of that first apply phase** (no rescue of spike evidence).
2. **Rebuild it under ODD**, with every change explained well enough for the user to read,
   question, and defend.

The aim is not speed either. It is that no file lands in the repository that the supervisor
cannot read and interrogate.

## Working agreement (revised 2026-09-16)

| Role | Who | Responsibility |
| --- | --- | --- |
| Writer | AI | Writes every file, runs every command, records raw output |
| Supervisor | user | Reads and reviews every change; raises anything that does not add up; the AI resolves it |
| Delegation | AI discretion | Work-routing ladder applies: mechanical multi-file work may go to a bounded writer. Writes stay single-threaded |

Revision history: the first agreement (user writes, AI directs) lasted one task and was replaced
by the supervisor's instruction: *"you do the project as usual, I supervise, reading and reviewing
every change; if something does not add up I tell you and you resolve it."*

Checkbox rule: a task is `[x]` only when its acceptance command ran and its output was seen.
"No evidence, no tick." The supervisor's review is a second gate; a raised objection reopens the
task rather than ticking it.

## Supervisor review log

Observations raised by the supervisor while reading the work, and what happened to each.

### O1 — "`contracts/` looks new; did ODD create it?" (2026-09-16)

Answered: the directory is not an ODD invention. It comes from `design.md` §2.2 (module layout:
`dispatch-envelope.schema.json`, `job-types.json`, `fixtures/`) and from the plan's task 1.2. It
existed in the deleted scaffold as an 11-line README and was recreated here; only the README's
text is new. The contract files themselves are WU-3's. Standing offer: delete the directory until
WU-3 if it reads as noise.

### O2 — "You used `pg` for Postgres; Prisma brings its own client, so do not create two
clients" (2026-09-16) — **accepted, binding on WU-2**

The instinct is right about both the structure and the risk: this slice must not grow two
independent data-access paths, and two variables (`DATABASE_URL` for the application,
`DATABASE_URL_TEST` for the harness) deliberately point at different databases, which is exactly
where a "wrong database" bug lives.

Disposition, with the honest nuance:

- `pg` is in `devDependencies`, not `dependencies`, and `test/harness.spec.ts` is the only file
  that imports it. There is no second connection pool at runtime.
- It is there because WU-1's harness has to run **before** Prisma exists: WU-2 owns `schema.prisma`,
  `prisma generate` and the first migration. Switching this assertion to Prisma today would mean
  doing WU-2 first, on an empty schema.
- **Binding constraint:** when WU-2 lands, `test/harness.spec.ts` moves its database assertions to
  the Prisma client and `pg` + `@types/pg` leave `package.json`. That makes the harness *stronger*
  than it is today — it would assert `current_database() = 'mediaforge_test'` through the client
  the application actually uses, instead of through a stand-in. WU-2 is not done when Prisma
  lands; it is done when this swap is done too.

## Deletion record (2026-09-16)

Removed: `apps/`, `workers/`, `docker/`, `contracts/`, `node_modules/`, `package.json`,
`pnpm-workspace.yaml`, `pnpm-lock.yaml`, `Makefile`, `.env`, `.env.example`, `.gitignore`,
`.dockerignore`. Kept: `openspec/`, `.git/`, `.pi/`, `.atl/`.

Runtime state removed: containers `mediaforge-{api,postgres,redis,worker}`, volumes
`docker_mediaforge-{pgdata,redisdata,storage}`, network `docker_mediaforge-internal`, images
`docker-api:latest` and `docker-worker:latest`.

Safety net (the repository has **zero commits**, so deletion was irreversible):
`C:/Users/andre/Documents/Trabajo/_backups/mediaforge-s1-baseline-20260916-202423.tar.gz`
(186 KB, 89 entries, excludes `node_modules`, `.venv`, `__pycache__`, `.pytest_cache`, `.git`).
Restore: `tar -xzf <file> -C <target-dir>`.

Residue: the empty directory `apps/api` could not be removed — a Windows process still holds a
handle on it. It contains no files. It is reused as-is by task 1.2.

## Environment variables

There is no `.env.example`. The supervisor dropped it after the path policy refused the filename,
and the defaults make it unnecessary: every variable has one, and they match what the host-side
harness tests assume. `.env` stays gitignored, so credentials never enter the repository.

| Variable | Default | Consumed by | Meaning |
| --- | --- | --- | --- |
| `POSTGRES_USER` | `postgres` | compose | database user |
| `POSTGRES_PASSWORD` | `postgres` | compose | database password |
| `POSTGRES_DB` | `mediaforge` | compose | development database name |
| `POSTGRES_PORT` | `5432` | compose | **host** port for PostgreSQL |
| `REDIS_PORT` | `6379` | compose | **host** port for Redis |
| `API_PORT` | `3000` | compose | **host** port for the API; the container always listens on 3000 |

Composed inside the service environment blocks rather than set by hand:

| Variable | Value inside the containers |
| --- | --- |
| `DATABASE_URL` | `postgresql://<user>:<password>@postgres:5432/mediaforge` |
| `DATABASE_URL_TEST` | same host, database `mediaforge_test` |
| `REDIS_URL` | `redis://redis:6379/0` — the broker the pipeline uses |
| `REDIS_URL_TEST` | `redis://redis:6379/1` — the test database number |

The host-side harness tests need **no** variables at all: `test/harness.spec.ts` and
`test_harness.py` default to `localhost:5432` / `localhost:6379`, the same database names, and
Redis database 1. Change `POSTGRES_PORT` or `REDIS_PORT` and the two `_TEST` URLs must be exported
in your shell too, or the tests keep looking at the old ports.

## Git history

Five commits on `main`, each a reviewable unit rather than one bulk import. The first four were
created 2026-09-16; the fifth (`9eb288b`) is the commit that wrote this section:

| Commit | Subject | Size |
| --- | --- | --- |
| `b05afcd` | `chore(sdd): import the approved SDD artifacts for audio-extract-vertical-slice` | 24 files, 5798 insertions |
| `892f706` | `docs(odd): track the S1 foundation rebuild as an ODD feature` | 2 files, 1176 insertions |
| `9d05ebd` | `feat(scaffold): pnpm workspace, NestJS api, uv worker project and dependency harness` | 20 files, 4363 insertions |
| `ab47532` | `feat(docker): local stack with PostgreSQL 18, Redis 7 and both service images` | 6 files, 331 insertions |
| `9eb288b` | `docs(odd): record the git history and the line-ending finding` | 2 files, 56 insertions |

The fifth row is what finding F2 in `repo-hygiene.md` was about: this section used to say *"Four
commits on `main`"* and omitted the commit that wrote it.

Remote `origin` is `https://github.com/4dr3s/mediaforge.git`, verified public and **empty** before
the first commit (`git ls-remote` returned no refs), so no merge was needed. **Pushed on
2026-09-17:** `main` went to `origin` carrying all five commits, through `9eb288b`. The six
commits of the `repo-hygiene` feature — `746be7f` feature tracking · `914b65d` SDD plan
reconciliation · `758df00` Makefile entrypoints · `b8f1c7d` pnpm build scripts · `42a189b` lint
re-measurement and D1 control · `23585e5` LF line endings — are local, not pushed.

## Known inconsistencies left behind (closed)

Every item below was re-measured on 2026-09-17 by the follow-up feature
[`repo-hygiene`](repo-hygiene.md) and now ends in exactly one of three states: **resolved**,
**inert** (with the reason), or **binding on a future feature** (named below). No item stays
ambiguous.

- **SDD `tasks.md` attestation** — **resolved** by commit `914b65d`. The 7 stale checkboxes
  (1.1–1.4, 5.1, 5.2, 13.2) are back to `[ ]` (0/74), with a note stating that their evidence was
  deleted with the S1 apply output and that the work was rebuilt under ODD in this feature.
- **`tasks.md` "Runners and canonical commands" prescribes the D1 command** — **resolved** by the
  same commit `914b65d`: the verified replacement is written back into the SDD plan, and both
  runner lines carry `--fail-if-no-match`. The claim that the replacement "has not been written
  back into the SDD plan" is no longer true.
- **The SDD runtime record** — **inert**. `gentle-ai sdd-attempt --help` reports *"Runtime attempt
  operations are retired"*: no supported operation can end or abort the `attempt/begin`, so
  "close the attempt" was never an available fix, and deleting the record by hand would be
  tampering with an audit store. `next: apply` comes from the plan's 67 unchecked tasks, not from
  the record, and is the correct answer for a plan whose execution moved to ODD.
- **Line endings (found while committing, 2026-09-16)** — **resolved** by commit `23585e5`. The
  original note asserted an unmeasured mechanism: content is stored with LF *"and the working
  copy gets CRLF"*. Measured 2026-09-17, the working copy was already LF — 54 of 54 tracked
  files, no CR byte anywhere (`git ls-files --eol` reports `i/lf w/lf` for every file). The
  conversion was a **latent** risk that would have materialized on the next clone or checkout; the
  failure mode the note worried about (a shell script or entrypoint copied into a Linux container)
  is real, and `.gitattributes` (`* text=auto eol=lf`) removes the risk.
- **Git history and remote** — **resolved** (finding F2 in `repo-hygiene.md`): the two false
  statements are corrected in the *Git history* section above.
- **No baseline to diff the rebuild against** — **resolved** by resolution. The rebuilt tree is
  now committed **and pushed** (2026-09-17), so the safety-net tarball stopped being the only
  copy of the deleted S1 output.
- **`make` is not installed on this machine** — **resolved** by decision plus commit `758df00`.
  Both entrypoints stay: the `Makefile` remains the Linux/CI entrypoint and the root
  `package.json` scripts (`pnpm test:api`, `pnpm test:worker`) remain the portable path; the rule
  is documented in a comment header in the `Makefile` itself.
- **`pnpm install` ignores two build scripts** (`@nestjs/core`, `esbuild`) — **resolved** by
  commit `b8f1c7d`: the allowed set is pinned (`pnpm.onlyBuiltDependencies`) and `pnpm install`
  no longer reports the ignored-scripts notice.
- **pi-lens / knip** — **resolved with verdicts** (findings F4/F5 in `repo-hygiene.md`), not
  actioned. `knip`'s claim about `apps/api` does not reproduce on the current tree
  (`pnpm dlx knip --workspace api` exits `0` with no output). The `large-class` advisory
  reproduces but is a defect in the rule — the shipped rule carries no method-count condition
  while its message claims "more than 20 methods" — not in `health.controller.ts`. The
  full-workspace knip run surfaced a live finding the list never had: `uv` as an unlisted binary
  for `test:worker` (a machine-level tool the root script invokes). It is recorded and deferred:
  it only becomes binding if knip is adopted as a project dependency (`repo-hygiene.md`, *Out of
  scope*).
- **O2 (harness database assertions)** — **binding on WU-2**, not on this feature. When WU-2
  lands, `test/harness.spec.ts` moves its database assertions to the Prisma client, and `pg` +
  `@types/pg` leave `package.json` in the same task; see the supervisor review log.
- **`.env.example`** — **resolved**; the resolution is recorded in the *Environment variables*
  section above. Dropped by supervisor decision on 2026-09-16 (the path policy refused the
  filename; every variable has a default, documented here and in `docker/compose.yaml`).

## Constraints (non-negotiable)

- **Strict TDD.** Mode `strict`; source `openspec/config.yaml:58` (`strict_tdd: true`); runner the two
  gates: `pnpm --filter api --fail-if-no-match run test` (api) and
  `uv run --project workers/media pytest workers/media/tests -q` (worker).

## Delivery

Recorded 2026-09-17, measured retrospectively from the commits, not estimated at creation — this
feature predates the field.

- **Strategy:** `single-pr`, retrospective. The label is the nearest vocabulary, but the measured
  truth is that no branch or pull request ever existed: the four commits of this slice went directly
  onto `main` and were pushed through `9eb288b`. Verified: no `s1-foundation` branch exists anywhere
  (local or remote) and `9eb288b` is an ancestor of `origin/main`.
- **Forecast:** +1934 authored changed lines (additions plus deletions), measured retrospectively
  with `git log b05afcd..9eb288b --numstat`, excluding `pnpm-lock.yaml`, `generated` paths and
  `.lock` files; split +666 code/tests, +644 English docs, +624 Spanish mirror. Raw output and the
  per-file decomposition are at `odd-doc-structure.md` §1.4.
- **Slice boundaries:** none, because none were used. The work is `main`-linear: the four commits of
  the slice — `9eb288b` (git history and line-ending record) · `ab47532` (local docker stack) ·
  `9d05ebd` (workspace scaffold) · `892f706` (feature tracking) — went directly onto `main` and were
  pushed; no `s1-foundation` branch exists (local or remote) and `9eb288b` is an ancestor of
  `origin/main`.

---

## Tasks

Source: `openspec/changes/audio-extract-vertical-slice/tasks.md` → WU-1 (identical acceptance
criteria, kept so the SDD plan and the ODD feature stay reconcilable).
`openspec/config.yaml` declares `strict_tdd: true`, so RED precedes GREEN in every task.

### 1.1 — RED: write the two harness tests and watch them fail · owner: AI

Write:

- `apps/api/test/harness.spec.ts` (Vitest): asserts a live connection to the `mediaforge_test`
  database, and that `SELECT uuidv7()` returns a version-7 UUID.
- `workers/media/tests/test_harness.py` (pytest): asserts `asyncpg` connects to the same
  database and that Redis is reachable.

**Acceptance:** both files exist, and the exact failure observed when running them is recorded
verbatim in the evidence log below. The expected RED here is "the runner does not exist yet" —
no project, no environment.

**Outcome:** RED-2 behaved as designed. RED-1 exposed defect **D1** — the planned API command
exits `0` while running nothing — which is why task 1.4 now carries a negative control.

### 1.2 — Scaffold the workspace · owner: AI

Write:

- `package.json`, `pnpm-workspace.yaml` (pnpm workspace)
- `apps/api` NestJS skeleton, `apps/web` placeholder only (no code — there is no UI in this slice)
- `workers/media` with `uv` + `pyproject.toml`
- `contracts/`
- Vitest config, pytest-asyncio config, `Makefile` targets

**Acceptance:** `pnpm install` resolves the workspace; the NestJS app builds; `uv sync` (or
equivalent) creates the worker environment. Reference: `design.md` §2 (topology and module
layout); `openspec/project.md` (stack).

**Trap to avoid:** the deleted `Makefile` carried a `test-sandbox` target pointing at
`workers/media/tests/test_sandbox_precheck.py`, a file that never existed. Do not recreate dead
targets.

**Outcome:** met. Raw output in the evidence log. Three deliberate deviations from the plan, each
one recorded rather than smuggled in:

1. **`.gitignore` moved from 1.3 to 1.2.** `pnpm install` and `uv sync` create `node_modules/`
   and `.venv/` immediately; one task of exposure to a stray `git add -A` was not worth the
   cleanliness of the split.
2. **`apps/web` has no dependencies.** Next.js + React + React DOM are ~300 MB of tree for a
   package with no source in this slice. The slot is held by `package.json` + `README.md`.
3. **Workspace packages are named `api` and `web`, unscoped.** The plan's canonical commands say
   `--filter api`; a scoped name (`@mediaforge/api`) would have made every one of them ambiguous.
   The previous scaffold had the scoped name *and* the unscoped filter — a mismatch waiting to
   be blamed on something else.

Also pinned `requires-python = ">=3.11,<3.12"` instead of `">=3.11"`: the wide range lets uv
resolve 3.13 on a machine that has it, and the worker would quietly stop being Python 3.11.

### 1.3 — Containers, volumes, environment · owner: AI

Write:

- `docker/compose.yaml`: Postgres 18, Redis 7, named volumes including `mediaforge-storage`,
  database `mediaforge` plus test database `mediaforge_test`
- `docker/api.Dockerfile`, `docker/worker.Dockerfile`
- `.env.example` (credentials from environment; `.env` gitignored), `.gitignore`

**Acceptance:** `docker compose -f docker/compose.yaml up -d --wait` reports every service
healthy. Reference: `design.md` §2.1.

**Note:** `.gitignore` is the first file worth writing, because without it `git status` lists
harness state (`.atl/`, `.pi/`) and every future `node_modules` entry as untracked.

**Outcome:** met. `up -d --wait` exits `0` with all four services healthy (evidence log below).
The image files were recovered from the safety-net tarball and reviewed line by line rather than
reinvented, because that build was known to work. Eight changes, all deliberate:

1. **`.dockerignore` anchors every pattern with `**/`.** A bare `node_modules/` matches only the
   top level, so the host's nested `apps/api/node_modules` was copied over the image's own
   install — Windows shims and absolute symlinks included — and the api build died (defect D2).
   Host build caches were leaking the same way (defect D3).
2. **`--fail-if-no-match` on the image build command**, same reasoning as D1: without it a filter
   that matches nothing produces an image with no `dist/` at all, reporting success.
3. **The api image no longer runs as root** (`USER 1000:1000`, numeric per hadolint DL3066 so the
   number two containers must agree on stays visible). Flagged in the file: the first time the API
   writes to the shared volume (WU-16/WU-17), its ownership becomes a real decision.
4. **The container port is fixed at 3000**, and only the host port follows `API_PORT`. Both
   followed it in the recovered file, so `API_PORT=8080` published a mapping to a port nothing
   listened on.
5. **The api healthcheck probes `127.0.0.1`**, not `localhost`: the app binds IPv4 only, and
   inside the container `localhost` also resolves to `::1`. Measured on the host: both answer
   `200`, so this is risk reduction rather than a defect fix.
6. **The worker runs `sleep infinity` as a documented placeholder**, with the WU-9 `CMD` it will
   become written next to it. A `CMD` naming a module that does not exist yet would crash-loop.
7. **Postgres no longer mounts `mediaforge-storage`.** The database has no business writing into
   the artifact volume; the design shares that volume between the API and the worker.
8. **The network drops `internal: true`.** Measured, not assumed — see the A/B/A experiment in the
   1.4 evidence and defect D4.

**`.env.example`: dropped by supervisor decision** (2026-09-16). The path policy refuses that
filename, and the option chosen was to drop the file rather than write it out of band. The
variables are documented where a reader needs them: the header of `docker/compose.yaml` and the
*Environment variables* section above. Accepted cost: no copy-paste template, which the compose
defaults make unnecessary anyway.

### 1.4 — GREEN: record the evidence · owner: AI

Run and record the exact output of these three commands:

```bash
docker compose -f docker/compose.yaml up -d --wait
pnpm --filter api exec vitest run test/harness.spec.ts
uv run --project workers/media pytest workers/media/tests/test_harness.py
```

**Acceptance:** compose is healthy and both harness tests pass against a **real** PostgreSQL 18
and a **real** Redis. Never SQLite: it produces false negatives on `uuidv7()`, `FOR UPDATE`,
partial indexes and CAS semantics. Never the PATH `python` — `project.md` records it as an
unrelated virtualenv.

**Negative control (required by D1):** the API harness command must exit **non-zero** when the
workspace or the test database is absent. Prove it twice: once before `apps/api` is scaffolded,
and once with the containers stopped. A gate that returns `0` while running nothing is not a gate.

**Feature done when:** the three commands above pass, their output is recorded here, and the
negative control exits non-zero.

**Outcome:** met. Both host-side suites pass against the running stack (`2 passed` / `2 passed`),
and the negative control holds in both directions (`--filter no-such-project` exits `1`; the real
filter with no database exits `1`). Raw output in the evidence log.

**Rollback:** delete `apps/`, `workers/`, `contracts/`, `docker/` and the root manifests.

## Progress

State is `[x]` only where the evidence log holds observed proof for that task.

| ID | Task | State | Evidence |
| --- | --- | --- | --- |
| 1.1 | RED: write the two harness tests and watch them fail | `[x]` | §1.1 |
| 1.2 | Scaffold the workspace | `[x]` | §1.2 |
| 1.3 | Containers, volumes, environment | `[x]` | §1.3 |
| 1.4 | GREEN: record the evidence | `[x]` | §1.4 |

---

## Evidence log

Raw output, appended as each task closes. Verbatim, not paraphrased.

### 1.1 — RED (2026-09-16)

Toolchain present: `pnpm 10.33.0` (`AppData/Roaming/npm/pnpm`) and `uv 0.11.19`
(`AppData/Local/hermes/bin/uv`). Both were already installed from the deleted S1 session.

**RED-1 — API (Vitest).** Command and output, exactly as produced:

```text
$ pnpm --filter api exec vitest run test/harness.spec.ts
No projects found in "C:\Users\andre\Documents\Trabajo\mediaforge"
[exit=0]
```

Observed: nothing ran, and the exit status is `0`. Recorded as defect **D1**, not as a valid RED.
The assertion never got the chance to be wrong, so this run proves nothing about the test itself.

**RED-2 — worker (pytest).** Command and output, exactly as produced:

```text
$ uv run --project workers/media pytest workers/media/tests/test_harness.py -q
error: Failed to spawn: `pytest`
  Caused by: program not found
[exit=2]
```

Observed: valid RED, and loud. There is no `workers/media/pyproject.toml` and no `pytest` in any
environment, so the runner itself is missing — which is exactly the precondition 1.1 exists to
expose.

### 1.2 — Scaffold the workspace (2026-09-16)

**Install (both runtimes).**

```text
$ pnpm install
Scope: all 3 workspace projects
Packages: +395
WARN  1 deprecated subdependencies found: glob@10.4.5
╭ Warning ─────────────────────────────────────────────────────────────────╮
│   Ignored build scripts: @nestjs/core@10.4.22, esbuild@0.21.5.           │
│   Run "pnpm approve-builds" to pick which dependencies should be allowed │
╰──────────────────────────────────────────────────────────────────────────╯
Done in 12.1s using pnpm v10.33.0
[exit=0]
```

The three workspace projects are root, `api` and `web` — so the unscoped names are resolved by
pnpm as intended. pnpm 10 blocks dependency postinstall scripts by default; both `nest build` and
`vitest` work on this machine without approving them, so this is recorded as an open item (pin the
allowed set before CI exists) rather than actioned here.

```text
$ uv sync --project workers/media --extra dev
Using CPython 3.11.9 interpreter at: AppData/Local/Microsoft/WindowsApps/.../python.exe
Creating virtual environment at: workers\media\.venv
Resolved 12 packages in 510ms
 + asyncpg==0.31.0
 + mediaforge-media-worker==0.1.0 (from file:///.../workers/media)
 + pytest==9.1.1
 + pytest-asyncio==1.4.0
 + redis==8.1.0
[exit=0]
```

The `>=3.11,<3.12` pin held: uv took the 3.11 interpreter instead of the newer ones available on
this machine. `redis==8.1.0` matches the version the deleted spike measured (`RESULTS.md`), so the
consumer-group findings stay valid for the code that comes next.

**Build.**

```text
$ pnpm --filter api run build
> api@0.1.0 build C:\Users\andre\Documents\Trabajo\mediaforge\apps\api
> nest build

[exit=0]
```

`apps/api/dist/` emitted `main`, `app.module` and `health.controller` (`.js` + `.d.ts` + maps).

**D1 negative controls — the candidate fixes, tested instead of assumed.**

```text
$ pnpm --filter no-such-project exec vitest run test/harness.spec.ts
No projects matched the filters in "C:\Users\andre\Documents\Trabajo\mediaforge"
[exit=0]

$ pnpm --filter no-such-project run test:harness
No projects matched the filters in "C:\Users\andre\Documents\Trabajo\mediaforge"
[exit=0]

$ pnpm --filter no-such-project --fail-if-no-match run test:harness
No projects matched the filters in "C:\Users\andre\Documents\Trabajo\mediaforge"
[exit=1]
```

**Worker side, same discipline:**

```text
$ uv run --project no-such-dir pytest -q
warning: Project directory `no-such-dir` does not exist. This will become an error in a future
release. Use `--preview-features project-directory-must-exist` to error on this now.
error: Failed to spawn: `pytest`
  Caused by: program not found
[exit=2]
```

Fails closed, for two independent reasons, one of which uv itself has deprecated. No flag needed
here, but the command is only accidentally robust to a deleted project directory.

**Intermediate RED — runner present, services absent.** This is the state between 1.2 and 1.4, and
it is the honest RED for these assertions:

```text
$ pnpm test:api
     Tests  2 failed (2)
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  api@0.1.0 test:harness: `vitest run test/harness.spec.ts`
Exit status 1
[exit=1]

$ pnpm test:worker
FAILED workers\media\tests\test_harness.py::test_asyncpg_connects_to_the_dedicated_test_database
FAILED workers\media\tests\test_harness.py::test_redis_is_reachable_on_the_test_database_number
2 failed in 8.80s
[exit=1]
```

**Correction made during this task.** The first version of `harness.spec.ts` shared one `Client`
across a `beforeAll`. With no database, that produced `Test Files 1 failed (1)` and
`Tests 2 skipped (2)`: the failure was attributed to the file, and the two assertions were
reported as skipped — indistinguishable from "they never ran", which is the class of ambiguity
D1 is about. The file now opens one connection per test, mirroring `test_harness.py`, and the
Python side already reported `2 failed` for exactly this reason.

**`git status` hygiene check:** untracked entries are `.gitignore`, `Makefile`, `apps/`,
`contracts/`, `odd/`, `openspec/`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
`workers/`. Neither `node_modules/`, `.venv/` nor `dist/` appear, and neither do `.atl/` and
`.pi/`.

### 1.3 — Containers, volumes, environment (2026-09-16)

```text
$ docker compose -f docker/compose.yaml up -d --wait
 Container mediaforge-postgres Healthy
 Container mediaforge-redis Healthy
 Container mediaforge-worker Healthy
 Container mediaforge-api Healthy
[exit=0]

$ docker compose -f docker/compose.yaml ps
NAME                  STATUS                   PORTS
mediaforge-api        Up 5 seconds (healthy)   0.0.0.0:3000->3000/tcp, [::]:3000->3000/tcp
mediaforge-postgres   Up 3 minutes (healthy)   0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp
mediaforge-redis      Up 3 minutes (healthy)   0.0.0.0:6379->6379/tcp, [::]:6379->6379/tcp
mediaforge-worker     Up 2 minutes
```

**The two build failures on the way there**, both of the "the build lied" family (defects D2 and
D3, described below):

```text
# D2 -- api image build, after `COPY apps/api ./apps/api` overwrote the image's own install
Error: Cannot find module '/app/apps/api/node_modules/@nestjs/cli/bin/nest.js'
  code: 'MODULE_NOT_FOUND'
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  api@0.1.0 build: `nest build`

# D3 -- api container, from an image whose `nest build` had reported success
Error: Cannot find module './app.module'
    at Object.<anonymous> (/app/apps/api/dist/main.js:4:22)
```

Checked directly in the fixed image instead of inferred from a green build log:

```text
$ docker run --rm --entrypoint sh mediaforge-api -c 'ls /app/apps/api/dist'
app.module.d.ts  app.module.js  app.module.js.map
health.controller.d.ts  health.controller.js  health.controller.js.map
main.d.ts  main.js  main.js.map  tsconfig.tsbuildinfo
```

### 1.4 — GREEN, and the D1 negative control (2026-09-16)

```text
$ pnpm test:api
 Test Files  1 passed (1)
      Tests  2 passed (2)
[exit=0]

$ pnpm test:worker
..                                                                       [100%]
2 passed in 0.26s
[exit=0]
```

Both suites ran **on the host**, against the running containers, against a real PostgreSQL 18 and
a real Redis. That is the acceptance — and note that the first run of the api build sequence
looked green at every step while the container could not start.

**The `internal: true` experiment (A/B/A).** The recovered compose put the network behind
`internal: true`. It had been removed for a reason that was never measured, so it was measured:

```text
without internal: true   ->  pnpm test:api 2 passed  ·  pnpm test:worker 2 passed  [exit=0]
with internal: true      ->  pnpm test:api 1 failed  ·  pnpm test:worker 2 failed  [exit=1]
     (containers stayed healthy and `up --wait` stayed green; only the host lost the ports)
without internal: true   ->  pnpm test:api 2 passed  ·  pnpm test:worker 2 passed  [exit=0]
```

The third leg is what makes the attribution causal rather than coincidental. Consequence,
recorded as defect D4: with the network as the deleted scaffold had it, the host-side acceptance
**could not** have passed while `up --wait` still reported every service healthy. Whatever the
recorded S1 GREEN attested, it is not reproducible against that file.

## Defects found in the plan

### D1 — the planned API harness command cannot fail (found 2026-09-16, during 1.1)

`tasks.md` §"Runners and canonical commands" prescribes:

```bash
pnpm --filter api exec vitest run <file>
```

Run today, with no workspace present, pnpm prints `No projects found in "<repo>"` and **exits
`0`**. The command cannot tell "the suite passed" apart from "the suite never ran", so a CI job
built on it reports green on an empty repository.

**Resolution — verified 2026-09-16, after the first attempt was disproven.** The first guess was
that `run` fails closed where `exec` does not. The negative control killed it: **both exit `0`**
with no matching project. The fix is the explicit flag:

```bash
pnpm --filter api --fail-if-no-match run test:harness
```

It lives in `Makefile` (`test-api`) and in the root `package.json` (`test:api`). Verified in both
directions: `--filter no-such-project` exits `1`, and `--filter api` with no database exits `1`.
The worker command needs no flag — `uv run --project <missing>` already exits non-zero.

The lesson is cheap to state and expensive to learn: the first fix was a plausible guess from
reading behaviour, and only the negative control proved it wrong.

## Defects found while implementing 1.2–1.3 (D2–D4)

D2 and D3 are defects in files this feature wrote. D4 is a defect in the scaffold that was
deleted. All three share one shape, and it is the shape D1 has too: **something reported success
while producing a broken result.**

### D2 — `.dockerignore` does not exclude nested `node_modules`

`node_modules/` matches the top-level directory only, not `apps/api/node_modules`. In a pnpm
workspace the nested ones are the interesting ones, so the host's install was copied into the
image **on top of** the image's own Linux install, Windows shims and absolute symlinks included:

```text
apps/api/node_modules/@nestjs/cli -> /c/Users/andre/.../node_modules/.pnpm/@nestjs+cli@10.4.9/...
```

`nest build` then died with `Cannot find module
'/app/apps/api/node_modules/@nestjs/cli/bin/nest.js'`.

**Fix:** every pattern in `.dockerignore` is anchored with `**/`. Verified by rebuilding the api
image with `--no-cache`, because a cached layer at that point would have produced a false green.

### D3 — a host incremental-build cache leaked into the image

`apps/api/tsconfig.tsbuildinfo` (148 KB) sat next to `tsconfig.json`, so `**/dist/` did not exclude
it. The image's `nest build` read the host's cache, concluded that `app.module.js` and
`health.controller.js` were already emitted, emitted only `main.js` and the `.d.ts` files, and
reported success. The image built; the container died with `Cannot find module './app.module'`.

**Fix, both halves:**

- `.dockerignore` excludes `**/*.tsbuildinfo` and `**/.eslintcache`; `.gitignore` excludes
  `*.tsbuildinfo`.
- `apps/api/tsconfig.build.json` — the conventional NestJS build config this scaffold was missing
  — pins `tsBuildInfoFile` **inside** `dist/`. The cache is then gitignored, excluded from the
  build context, and discarded together with the output it describes.

### D4 — `internal: true` made the acceptance impossible while looking healthy

Measured in 1.4 (A/B/A in the evidence log): containers healthy, `--wait` green, both host-side
commands red. The flag is **not** restored. The host-side commands are what turns task 1.4 into
evidence instead of a claim, and that requirement outranks the egress denial. Restoring egress
denial means moving the acceptance into a container first — a change of its own, not a flag.

## Out of scope

- WU-5 (redis-py consumer-group spike) and WU-13 (sandbox namespace precheck): their evidence was
  deleted by decision. Both must be revisited before WU-6 and WU-14 respectively. The surviving
  requirement documents are `design/spike-sandbox-namespaces.md` and
  `design/adr-0002-queue-mechanism.md`.
- Everything after WU-1 (data model, contract, ports, state machine). Tracked in the SDD
  `tasks.md` and to be re-planned as ODD features one at a time.

## Next step

None — no work remains on this document: the feature is closed (all four tasks 1.1–1.4 carry
recorded evidence; the residue list above was re-measured and closed by `repo-hygiene`; tip
`9eb288b` is an ancestor of `origin/main`). The still-open threads live elsewhere: the two deferred
decisions from `repo-hygiene.md` *Out of scope* — adopting knip (with the `uv` unlisted-binary
finding) and the absent ESLint configuration — belong to the supervisor.
