# Feature — `wu3-contract` (the shared TS↔Python dispatch contract and the job-type registry)

> **Reading copy in Spanish:** `wu3-contract.es.md`, generated at closure. Code blocks are
> byte-identical to this file; if they diverge, the English is canonical.

**Workflow:** Organic Driven Development (ODD).
**Requirements source of truth:** `openspec/changes/audio-extract-vertical-slice/` — read-only unless
the supervisor asks for a correction.
**Status:** `in progress` — created 2026-09-17.

---

## Why this feature exists

WU-2 left the project with a database and a data model, and nothing that two runtimes both understand.
WU-3 is the unit that makes "one contract honored twice" real: a versioned dispatch envelope, the
job-type registry as **data**, and one fixture set that the TypeScript and Python validators must
agree on.

It is also the first unit whose deliverable is *agreement* rather than behaviour. A contract that two
runtimes interpret differently does not fail loudly — it fails as a job that the worker cannot resolve,
or worse, one it processes with the wrong parameters. That is why the acceptance is a parity test and
not a schema file that looks right.

## Authoritative inputs

| Input | What it governs |
| --- | --- |
| `design.md` §2.2 (module layout) | Where each artifact lives: `contracts/` for the language-neutral files, `apps/api/src/contracts/` for the zod validators, `workers/media/src/mediaforge/contracts.py` for the pydantic models. |
| `design.md` §7.1 (the domain contract) | The envelope's three fields and the rule that makes them enough: **a notification, not the truth**. Parameters, inputs and state are always re-read from Postgres. |
| C3 *One Versioned Message Contract Honored by Both Runtimes* | The envelope is defined once as a versioned JSON contract; a consumer that does not support the version **rejects** it instead of processing it partially. |
| C3 *The Queue Port Is Broker-Agnostic* | **No broker vocabulary** in the domain contract. The schema must not name Redis, streams, groups or claims. |
| C1 *The Job-Type Registry Is the Only Source of Submission Rules* | The registry is **data, not code constants**: param schema, input arity, allowed input types, input size cap, wall-clock limit. `audio.extract` = arity 1, 200 MB input cap. |
| C5 *The Handler Asserts Its Registry-Declared Arity and Params* | Params are validated against the registry's schema **before** the handler starts. |

## Constraints (non-negotiable)

- **The envelope carries exactly three fields**: `type` (the version discriminator), `job_id`,
  `occurred_at`. Adding a fourth is a contract change with a new version, not an implementation
  detail — the moment the envelope carries parameters or state it stops being a notification and
  becomes a second, stale copy of the truth.
- **No broker vocabulary** in the contract files. `xadd`, `xreadgroup`, `xautoclaim`, `group`,
  `consumer`, `delivery_count` belong to the adapter and must not appear in the schema, the registry
  or the fixtures.
- **The registry is data.** Changing a limit is a registry change, not a code change: no limit may be
  duplicated as a constant in either runtime, and the tests read the values from the file.
- **Two validators, one fixture set.** The parity test is the mechanism that keeps zod and pydantic
  honest. A fixture that only one side parses is a failing test, not a skipped one.
- **Strict TDD.** `openspec/config.yaml` declares `strict_tdd: true`: the two suites are written and
  observed failing before the contract files exist.
- **RDD stays on**, with the per-work-unit independent verifier, as in WU-2.

## Decisions taken before writing

1. **What WU-3 does not build.** The registry *loaders* that the runtimes will use in production
   (design §2.2 puts one in `workers/media/src/mediaforge/registry/`) belong to the units that consume
   them: the API's submission validation (WU-4) and the worker's handler dispatch (WU-8/9). WU-3
   delivers the contract, the validators and the parity proof; the tests read `job-types.json`
   directly. Building a loader now would be a module with no caller.
2. **The fixtures are the contract's executable form.** Every assertion the two suites make about
   shape, rejection and registry contents is expressed as a document in `contracts/fixtures/`, so
   "both runtimes accept the same envelope" is demonstrated rather than described.
3. **The parity suites are separate from the E2E.** C3's scenario about real bytes is the compose
   smoke (WU-21). WU-3 proves the two validators agree on the same documents; WU-21 proves the two
   processes agree on real ones.

## Tasks

Every task closes with at least one work-unit commit on the feature branch, assessed and independently
verified.

### 1.1 — RED: the two parity suites · owner: AI

Write both, against the same fixture documents:

- `apps/api/test/contract.parity.spec.ts` (Vitest, zod);
- `workers/media/tests/test_contract_parity.py` (pytest, pydantic).

They must assert, identically:

- every golden envelope in `contracts/fixtures/envelopes/` parses, and the parsed value carries
  **only** `type`, `job_id`, `occurred_at` — an envelope with an extra field is rejected;
- an envelope whose `type` is not `mediaforge.job.dispatch.v1` is **rejected** (not ignored, not
  partially processed);
- a malformed envelope (missing field, wrong type, non-RFC-3339 `occurred_at`) is rejected;
- `contracts/job-types.json` declares `audio.extract` with arity 1, a 200 MB input cap, an output cap,
  a wall-clock limit, lease TTL and grace, an attempt budget, and exactly one optional parameter —
  `quality`, an enum of `128k | 192k | 320k`;
- the param fixtures parse on both sides, and a param value outside the enum is rejected;
- **no broker vocabulary** appears in the schema, the registry or the fixtures.

**Acceptance:** both files exist and both are observed failing, with the failure recorded verbatim.
They fail because the contract files do not exist yet — not because a suite is malformed, and the
evidence log must show the difference.

### 1.2 — GREEN: the contract, the registry, the fixtures and the two validators · owner: AI

- `contracts/dispatch-envelope.schema.json` — the versioned JSON Schema, three properties, no
  `additionalProperties`, RFC 3339 for `occurred_at`.
- `contracts/job-types.json` — the registry as data, with `audio.extract` as the only entry.
- `contracts/fixtures/envelopes/` and `contracts/fixtures/params/` — the golden and the
  must-be-rejected documents, named so the failing case is obvious from the filename.
- `apps/api/src/contracts/` — the zod validators (envelope and params).
- `workers/media/src/mediaforge/contracts.py` — the pydantic models, the same two validations.
- `contracts/README.md` — its table stops saying "nothing here yet".

**Acceptance:** both suites pass on the same fixtures, and the commands are recorded:

```bash
pnpm test:api
pnpm test:worker
```

### 1.3 — RDD conformance, per work unit · owner: AI

As in WU-2: assess each work unit, record the tier and outcome, and satisfy the resulting plan with an
independent verifier. The expected tier is `unassessable`-as-high for candidates with no risk signal
(the defect recorded in `repo-hygiene.md`); a different tier is new information for the log.

### 1.4 — Closure · owner: AI

`contracts/README.md` and the feature doc agree with what exists; the `.es.md` copy is generated and
verified (code blocks byte-identical); the feature is closed with its gates recorded.

## Evidence log

Raw output, appended as each task closes. Verbatim, not paraphrased.

### 1.1 — RED: the two parity suites (2026-09-17)

```text
$ pnpm --filter api exec vitest run test/contract.parity.spec.ts
Error: Failed to load url ../src/contracts/job-params (resolved id: ../src/contracts/job-params)
       in .../apps/api/test/contract.parity.spec.ts. Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
[exit=1]

$ uv run --project workers/media pytest workers/media/tests/test_contract_parity.py -q
E   ModuleNotFoundError: No module named 'mediaforge.contracts'
!!!!!!!!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!!!!!!!!!
1 error in 0.15s
[exit=2]
```

Both are **absence** failures: the TypeScript suite names the module that does not exist yet, and the
Python one fails at import for the same reason. Neither failed on a malformed test file, which is the
distinction that makes this a RED run rather than noise — and the Python file was additionally proved
syntactically valid with `python -m py_compile`, so the failure cannot be a syntax error in disguise.

**A gap found in the suites themselves, and closed.** An independent reading of the two files against
their own requirements showed that **neither asserted the registry's input-type allowlist**, which C1
requires and `design.md` §2.2 lists alongside the caps. Implementing 1.2 without noticing would have
shipped a contract with no allowlist and a gate that could not have caught its absence. The assertion
was added to both sides, deliberately loose: non-empty, every entry a string, and the slice's
canonical `video/mp4` present — **not** the exact list, because the point of a data registry is that
adding a container is a registry change, and a test that pinned the list would turn a data change into
a test change.

### 1.2 — GREEN: the contract, the registry and both validators (2026-09-17)

The registry, which is **data**:

```json
{
  "audio.extract": {
    "input_arity": 1,
    "input_size_cap_bytes": 209715200,
    "allowed_input_types": ["video/mp4"],
    "output_size_cap_bytes": 262144000,
    "wall_clock_limit_s": 600,
    "lease_ttl_s": 300,
    "lease_grace_s": 60,
    "attempt_budget": 3,
    "params": {
      "properties": {
        "quality": { "type": "string", "enum": ["128k", "192k", "320k"] }
      }
    }
  }
}
```

The two gates, with the parity suites inside them:

```text
$ pnpm test:api     -> Test Files 3 passed (3) · Tests 42 passed (42)   [exit=0]
                       (contract.parity 18 + harness 2 + schema 22)
$ pnpm test:worker  -> 33 passed in 0.82s                              [exit=0]
                       (contract parity 19 + privileges 12 + harness 2)
```

**The gate caught a real leak, which is the best evidence that it works.** The first version of the
envelope schema described one of its fields with the word *"consumer"* — adapter vocabulary that C3
forbids in the domain contract, sitting inside a JSON string value where a reader would never notice
it. The vocabulary scan failed the build. It was removed from the description, not from the scan.

**Two blockers, and they were different kinds.** pi-lens reported an unresolved import of
`mediaforge.contracts` and an un-sorted import block. The first was a **stale cache**: the finding was
captured before the module existed, and the proof is that the module imports and the suite that imports
it runs nineteen tests green. The second was **real, and not where I first looked**: it was not the
grouping — which is correct, `mediaforge` is first-party — but the formatting: a three-line import that
fits on one line (84 characters against a limit of 88). Collapsing it cleared the finding. Two things
were done before that, and both stay: the project now **declares** `known-first-party = ["mediaforge"]`
in `pyproject.toml` instead of leaving the convention implicit, and nothing was deformed to please a
tool.

## Out of scope

- The registry loaders and any code that *uses* the registry to validate a submission (WU-4) or to
  dispatch a handler (WU-8/9).
- The queue port and its Redis Streams adapter (WU-6/WU-7). WU-3 defines what travels; it does not
  move it.
- Any second envelope version. The version discriminator exists so that a v2 can be added later; v0.1
  ships one.
- Adding a job type other than `audio.extract`. The registry is shaped for more, and the fixtures
  deliberately do not invent one.
