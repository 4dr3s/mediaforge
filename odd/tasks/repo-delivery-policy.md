# Feature — `repo-delivery-policy` (PR template, issue process, and the CI that enforces them)

> **Reading copy in Spanish:** `repo-delivery-policy.es.md`. Code blocks are byte-identical to this
> file; if they diverge, the English is canonical.

**Workflow:** Organic Driven Development (ODD).
**Requirements source of truth:** the supervisor's decision of 2026-09-18 (three answers, recorded
under *Decisions taken with the supervisor*) plus the measured state of the repository below.
**Status:** `in progress` — created 2026-09-18.

---

## Why this feature exists

The repository has no delivery policy at all, and that was measured, not assumed:

| Artifact | State measured on 2026-09-18 | Command |
| --- | --- | --- |
| `.github/` directory | **absent** — no workflow, no PR template, no issue template, no CODEOWNERS | `ls .github` → *No such file or directory* |
| CI | **none** — nothing runs on a PR | no `.github/workflows/` |
| Labels | **only GitHub's defaults** (`bug`, `documentation`, `enhancement`, …); no `type:*`, no `status:approved` | `gh label list` |
| Issues | **enabled, zero ever opened** (`has_issues: true`) | `gh api repos/4dr3s/mediaforge` |
| Shell scripts | **zero** — so a `shellcheck` job would inspect nothing | `find . -name '*.sh'` → empty |
| `.yamllint` | present at the repo root, **invoked by nothing** | — |
| `ruff` config | present in `pyproject.toml`, **invoked by nothing** | — |
| `eslint` / `prettier` | **not installed, not configured** | `repo-hygiene.md` §1.6 |
| PR #1 | opened 2026-09-18 with **no issue, no label, no template** — it predates any policy | `gh pr view 1` |

So the corrections made so far went straight into the repository with no issue, no label, and no
check. That worked while one person wrote everything; it does not survive a second contributor, and it
is the reason PR #1's own body had to explain its scope in prose that nothing validates.

Two distinctions this feature keeps separate, because they are not the same problem:

- **Missing policy is ambiguity.** Nothing tells a contributor what a valid PR looks like.
- **A check over an empty set is a false gate.** `shellcheck` over zero scripts, or a lint job whose
  tool was never configured, reports success while proving nothing — the same class as this
  repository's recorded defect D1 (*"a gate that cannot fail is not a gate"*).

## Authoritative inputs

| Input | What it governs |
| --- | --- |
| Supervisor's three answers, 2026-09-18 | PR policy strictness, PR #1's disposition, and the CI job set. |
| `Makefile` header comment | *"This Makefile is kept as the canonical entrypoint for Linux and CI."* — CI runs the same commands the repo already documents. |
| `odd/tasks/repo-hygiene.md` §1.6 | The measured lint state: `eslint` not found, `knip` evaluated and deliberately not adopted. |
| `odd/tasks/s1-foundation.md` D1–D4 | The gate discipline: every check must be demonstrably able to fail. |
| `docker/compose.yaml` | The only provisioning path for Postgres/Redis; its `init-test-db.sql` is what creates `mediaforge_test`. |
| `.gitattributes` | `* text=auto eol=lf` — already covers the CRLF-in-container risk D2/D3 came from. |

## Decisions taken with the supervisor (2026-09-18)

1. **PR policy is intermediate.** A PR must carry **exactly one `type:*` label** and its **branch name
   must match the type regex**. Linking an issue is **optional** — if one exists it is linked, and if
   not, the description stands alone. CI validates **label and branch**, not `Closes #N`.
2. **PR #1 is regularized, not exempted.** An issue is opened describing what it carries (retroactive,
   marked `status:approved` because the work is already authorized), the PR gains its `type:*` label,
   and its body is rewritten with the new template and `Closes #2` — the issue number GitHub
   assigned to the retroactive issue, because issues and pull requests share one number space and
   PR #1 already occupies `1`. The bootstrap leaves no debt and CI
   is green from the first PR.
3. **CI runs four jobs**: `api`, `worker`, `lint`, `policy`. The lint job covers **`ruff` and
   `yamllint`** — the two linters this repo already configures. **No `shellcheck` job**: the repo has
   zero shell scripts, so that check would pass over an empty set and prove nothing. `eslint` is
   likewise excluded because it is not installed or configured; adding it is a separate decision.

## Constraints (non-negotiable)

- **Strict TDD.** Mode `strict`; source `openspec/config.yaml:58` (`strict_tdd: true`); runner the two
  gates: `pnpm --filter api --fail-if-no-match run test` (api) and
  `uv run --project workers/media pytest workers/media/tests -q` (worker). **No RED cycle applies to
  the YAML/Markdown artifacts themselves** — a workflow file has no unit under test. What replaces it
  is this repository's own gate doctrine: every CI check must be shown **failing** on a constructed
  counter-example before its pass counts (task 1.5), exactly as §1.6 of `odd-doc-structure` did.
- **CI runs the repo's own commands.** The workflow invokes the same entrypoints the `Makefile`
  documents (`pnpm test:api`, `pnpm test:worker`, `docker compose up -d --wait`) rather than
  reimplementing provisioning. A second provisioning path would be a second thing to keep true.
- **No invented lint rules.** `ruff` and `yamllint` run with the configuration that already exists in
  the repository. If a rule fails, the failure is reported; the configuration is not loosened to make
  CI green.
- **No secret in a workflow.** The repository's credentials are the compose defaults
  (`postgres`/`postgres`), already public in `docker/compose.yaml`. Nothing is added to repository
  secrets, and no workflow writes a credential anywhere.
- **The policy gates are demonstrably able to fail.** A `policy` job that cannot reject a bad PR is
  worse than no job: task 1.5 constructs a failing branch name and a missing label and shows the job
  rejecting both.
- **Documentation lives with the policy.** A template nobody can find is not a process: the same work
  unit that adds the templates adds the contributor document that explains them, in the same commit.

## Delivery

- **Strategy:** `single-pr` — one work unit, one branch, one PR against `main`, consistent with the
  supervisor's answer on PR #1's shape.
- **Forecast:** ~450 authored changed lines (additions plus deletions) across ~8 new files (2 issue
  templates + 1 template config + 1 PR template + 1 workflow + 1 contributor doc + this document and
  its mirror). Labelled a **forecast**, not a measurement: `odd-doc-structure`'s closure measured its
  own forecast at 4.3× the estimate, so this number is treated as a hypothesis to be checked in
  task 1.5, not as a commitment.
- **Slice boundaries:** one slice. The artifact set is small, its parts are interdependent (the
  workflow validates the templates' labels; the contributor doc explains both), and splitting them
  would produce a PR whose CI checks a policy the same PR does not yet document.
- **Running count:** none yet — this feature's first work unit is not committed. Measured against the
  working tree at the branch point `3032dbf` once the artifacts exist, with the raw output in §1.5.

## Tasks

Every task closes with at least one work-unit commit on the feature branch. Task headers carry the
route declaration the delegation contract asks for (`orchestrator-delegation.md:136`), in the form
`· route: … · trigger: …` — the convention the supervisor set on 2026-09-18 for documents written
from this point on.

### 1.1 — Labels, issue templates and the PR template · owner: AI · route: delegated · trigger: multi-file write rule

Create the label set the policy needs (`type:feature`, `type:bug`, `type:docs`, `type:refactor`,
`type:chore`, `type:breaking-change`, `status:approved`), the issue templates (`.github/ISSUE_TEMPLATE/`
with a bug report, a feature request, and a config), and `.github/PULL_REQUEST_TEMPLATE.md` whose
sections are: summary, type (mapping each checkbox to its `type:*` label), changes table, test plan
with this repo's real commands, a checklist, and a **known divergences** section — the disclosure habit
this repository already practices.

**Acceptance:** the files exist; the label set exists on the remote (`gh label list`); the PR template's
checkbox-to-label mapping matches the labels actually created; and the templates do not require an
issue, matching decision 1.

### 1.2 — The CI workflow · owner: AI · route: delegated · trigger: multi-file write rule

`.github/workflows/ci.yml` with four jobs, each invoking a command the repository already documents:

- `api` — bring up Postgres 18 and Redis via `docker compose up -d --wait postgres redis` (the repo's
  own path, which runs `init-test-db.sql` and therefore creates `mediaforge_test`), run
  `prisma generate`, `prisma migrate deploy` against the test database, then
  `pnpm --filter api --fail-if-no-match run test`.
- `worker` — the same services, then `uv run --project workers/media pytest workers/media/tests -q`.
- `lint` — `ruff check` and `yamllint`, using the configurations already in the repository.
- `policy` — exactly one `type:*` label present, and the head branch name matching the type regex.

**Acceptance:** the workflow is valid YAML; every command in it exists in the repository today; no
command is invented; the `policy` job's two rules are exactly decision 1's; and the job set is exactly
decision 3's (no `shellcheck`, no `eslint`).

### 1.3 — The contributor document · owner: AI · route: inline · trigger: none (documentation for work already mapped)

A `CONTRIBUTING.md` at the repository root covering: how to open an issue and what the templates ask
for; the branch-naming regex and the commit-message convention, both already in use (all 40 existing
commit subjects match the convention — measured); the label vocabulary; how to open a PR and what CI
enforces; how to run every check locally with the same commands CI runs; and an explicit statement of
what CI does **not** check and why (`shellcheck` over zero scripts, `eslint` unconfigured).

**Acceptance:** every command quoted in the document was run and its output observed; the document
names the four CI jobs and their rules exactly as the workflow implements them.

### 1.4 — Regularize PR #1 · owner: AI · route: inline · trigger: none (a remote mutation, not a file edit)

Per decision 2: open the issue describing what PR #1 carries, with `status:approved`; add the `type:*`
label to PR #1; rewrite its body using the new template with `Closes #2`; and confirm the `policy` job
passes on it.

**Acceptance:** `gh pr view 1` shows the label, the rewritten body and the linked issue; the `policy`
job for PR #1 is green; and the issue's own body demonstrates the template's shape.

### 1.5 — Verification, and the forecast checked · owner: AI · route: delegated · trigger: verification rule

The gate doctrine: **each of the four CI jobs is shown failing on a constructed counter-example**, not
merely passing. At minimum: the `policy` job rejects a bad branch name and a missing label; the `lint`
job rejects a file with a real `yamllint` violation and a real `ruff` violation; the `api` and `worker`
jobs reject a deliberately broken assertion. The forecast's ~450 lines is re-measured and reported
whether it held. Recorded verbatim, including any failure.

**Acceptance:** the raw output of every real run and every negative control is in §1.5; the measured
line count is stated next to the forecast; and any check that could not be made to fail is named as
such rather than reported as a pass.

### 1.6 — Closure · owner: AI · route: inline · trigger: none (bookkeeping)

The gates recorded, the mirrors regenerated and verified, and the feature closed with its residue and
open decisions listed.

## Progress

State is `[x]` only where the evidence log holds observed proof for that task.

| ID | Task | State | Evidence |
| --- | --- | --- | --- |
| 1.1 | Labels, issue templates, PR template | `[ ]` | — **not closed**: the artifacts do not exist yet |
| 1.2 | The CI workflow | `[ ]` | — **not closed**: no workflow exists yet |
| 1.3 | The contributor document | `[ ]` | — **not closed**: no `CONTRIBUTING.md` yet |
| 1.4 | Regularize PR #1 | `[ ]` | — **not closed**: PR #1 still carries no issue, no label, no template body |
| 1.5 | Verification and the forecast | `[ ]` | — **not closed**: nothing to verify until 1.1–1.4 land |
| 1.6 | Closure | `[ ]` | — **not closed**: it is the last task |

## Evidence log

Raw output, appended as each task closes. Verbatim, not paraphrased.

*(empty — the first entry lands with task 1.1)*

## Out of scope

- **`eslint` and `prettier`.** Neither is installed nor configured. Adding a linter the team has not
  chosen is a separate decision, not a side effect of adding CI.
- **`knip`.** Evaluated and deliberately not adopted in `repo-hygiene.md` §1.6; this feature does not
  reopen it.
- **`shellcheck`.** No shell scripts exist to check. If one is ever added, the job is added with it.
- **A required-status-check configuration on the remote.** Making the four jobs *blocking* is a
  repository setting, and it is the supervisor's to enable once the jobs have run green at least once.
- **Branch protection rules, CODEOWNERS, dependabot, and release automation.** Not requested and not
  needed by the policy chosen.
- **Rewriting history, or rewriting PR #1's commits.** Only its metadata and body are regularized.

## Next step

Run task 1.1 — create the labels, the issue templates and the PR template — then 1.2 (the workflow),
1.3 (the contributor document), 1.4 (regularize PR #1), 1.5 (verification with negative controls) and
1.6 (closure).
