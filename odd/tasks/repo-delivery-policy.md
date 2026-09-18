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
| 1.1 | Labels, issue templates, PR template | `[x]` | §1.1–1.3 |
| 1.2 | The CI workflow | `[x]` | §1.1–1.3, §1.5 |
| 1.3 | The contributor document | `[x]` | §1.1–1.3 |
| 1.4 | Regularize PR #1 | `[x]` | §1.4 |
| 1.5 | Verification and the forecast | `[x]` | §1.5 |
| 1.6 | Closure | `[x]` | §1.6, `## Closure` |

## Evidence log

Raw output, appended as each task closes. Verbatim, not paraphrased.

### 1.1–1.3 — the artifacts, the workflow and the docs (2026-09-18)

Created in one work unit (`8ab9f5e`): the three issue-form YAMLs, the PR template, the four-job
workflow, and `CONTRIBUTING.md`. Every command the workflow runs was checked against the file that
defines it, and every YAML was parsed with a real parser:

```text
$ python3 -c "import yaml,sys; [yaml.safe_load(open(f)) for f in sys.argv[1:]]; print('parsed')" \
    .github/ISSUE_TEMPLATE/*.yml .github/workflows/ci.yml
parsed

$ grep -E '^  (api|worker|lint|policy):' .github/workflows/ci.yml
  api:
  worker:
  lint:
  policy:

$ uvx --from ruff==0.16.8 ruff check workers/media
All checks passed!

$ uvx --from yamllint==1.38.0 yamllint -c .yamllint docker/compose.yaml .yamllint \
    pnpm-workspace.yaml openspec/config.yaml .github
  9:1       warning  truthy value should be one of [false, true]  (truthy)   # ci.yml `on:`
exit=0
```

**The lint job surfaced a real pre-existing defect, and it was fixed rather than tolerated.**
`ruff` reported one error on the untouched tree, from the ruleset it enables by default:

```text
$ uvx --from ruff==0.16.8 ruff check workers/media --output-format=concise   # before the fix
workers/media/src/mediaforge/contracts.py:77:9: TRY004 Prefer `TypeError` exception for invalid type
Found 1 error.
```

`parse_dispatch_envelope` declares `raw: str | bytes` and raised `ValueError` when the argument was
neither — a **precondition violation**, which Python's own convention (and TRY004) puts under
`TypeError`, not a rejected document. The fix changes that one branch; every document-level rejection
still raises `ValueError`, which is what the parity suite asserts. A/B measured, both suites, before
and after:

```text
$ uv run --project workers/media pytest workers/media/tests -q     # with the fix
13 failed, 20 passed in 5.36s
$ uv run --project workers/media pytest workers/media/tests -q     # reverted to baseline
13 failed, 20 passed in 4.04s
```

Identical, and all 13 failures are connection failures (`asyncpg` cannot reach Postgres: Docker is
not available in this WSL distro), not assertions. The parity suite alone, which is the change's real
blast radius, is green in both: `19 passed`.

### 1.4 — PR #1 regularized (2026-09-18)

Issue **#2** opened retroactively with `type:chore` and `status:approved`, PR #1 labelled
`type:feature`, and its body rewritten with the new template. The issue number is **#2, not #1**:
issues and pull requests share one number space, and PR #1 already occupies `1`.

```text
$ gh issue view 2 --json number,title,labels --jq '{number,title,labels:[.labels[].name]}'
{"number":2,"title":"chore(repo): add the delivery policy — PR template, issue templates, and CI",
 "labels":["type:chore","status:approved"]}

$ gh pr view 1 --json labels,body --jq '{labels:[.labels[].name], closes:(.body|test("Closes #2"))}'
{"labels":["type:feature"],"closes":true}
```

Both `policy` rules pass for PR #1 by hand: branch `feat/odd-doc-structure` matches the regex, and
exactly one `type:*` label is present.

**A structural discovery that changed the plan.** The workflow only runs when it exists on the pull
request's **head** branch, so PR #1 — whose head was `feat/odd-doc-structure` — could never have had
CI at all. The branch was fast-forwarded onto this work unit (`3032dbf..59363c2`) rather than left
without a gate, consistent with the supervisor's earlier decision that PR #1 carries everything.

### 1.5 — verification, and the forecast checked (2026-09-18)

**Half A — the four jobs, on the real PR.** `gh pr checks 1`:

```text
api     pass    36s
lint    pass     7s
policy  pass     2s
worker  pass    37s
```

This is also the first real run of the `api` and `worker` suites, which could not run locally: the
run reported `Tests 1 failed | 42 passed (43)` and `1 failed, 33 passed` **with the scratch failure
below injected**, so the repository's own suites pass on a clean checkout in CI.

**Half B — the negative control, on a real throwaway branch.** The doctrine is that a gate which
cannot fail is not a gate (defect D1), so a branch was pushed with one deliberately failing
assertion in each runtime and no label, and PR #3 opened against `main`. All four jobs failed:

```text
$ gh pr checks 3
api     fail    33s
lint    fail     5s
policy  fail     5s
worker  fail    46s
```

Each with a real reason, from the run logs:

| Job | Observed failure |
| --- | --- |
| `api` | `AssertionError: expected 1 to be 2` — `Tests 1 failed \| 42 passed (43)` |
| `worker` | `assert 1 == 2` — `1 failed, 33 passed in 0.62s` |
| `lint` | `PLR0133 Two constants compared in a comparison` — `Found 1 error` |
| `policy` | `rule 1 - exactly one type:* label required, found 0 (none)` **and** `rule 2 - branch "ci-negative-control" does not match /^(feat\|fix\|chore\|docs\|style\|refactor\|perf\|test\|build\|ci\|revert)\/[a-z0-9._-]+$/` |

The `lint` failure was not predicted: the scratch branch added only test files, and `ruff` caught
`PLR0133` in the Python scratch file. That is the lint job finding a genuine violation in genuine
code, which is stronger evidence than a synthetic one. PR #3 was then closed unmerged and the branch
deleted locally and on the remote.

**The forecast, checked.** `## Delivery` forecast **~450** authored lines. Measured:

```text
$ git diff --numstat 3032dbf..HEAD | awk '{a+=$1;d+=$2} END {printf "add+del=%d\n", a+d}'
add+del=678
```

**678** — about **1.5×** the forecast, over 8 files rather than the ~8 predicted (the file count held;
the per-file size did not). Better than `odd-doc-structure`'s 4.3×, and the same lesson: a forecast is
a hypothesis, and the honest thing is to print the ratio next to it.

**What surprised me.**

1. **The lint job earned its place on its first run, by finding a real defect in untouched code.**
   `TRY004` was pre-existing and invisible until a linter was pointed at the tree. The tempting
   response — add a rule ignore, or drop the job — would have buried it.
2. **The workflow does not exist for a PR whose head predates it.** That is not a subtlety of this
   repository; it is how GitHub Actions resolves workflows, and it silently produces a PR with no
   checks at all. It was found by asking why PR #1 had no CI, not by reading documentation.
3. **A negative control can find more than the failure it was designed for.** The scratch branch was
   built to fail `api` and `worker`; `lint` failed on its own, unplanned.
4. **Issues and PRs share a number space.** The retroactive issue is #2, not #1.

### 1.6 — closure (2026-09-18)

Task 1.6 is the closure: the gates are recorded in `## Closure` above, this document's mirrors are
regenerated in step, and the feature closes with its residue and open decisions listed there. The
closure is dated 2026-09-18 because that is when it was written — every earlier entry in this
document carries the same date, and no accepted date was changed.

```text
$ git log --oneline 3032dbf..HEAD
59363c2 fix(docs): correct two citations and the issue number in the policy docs
8ab9f5e feat(ci): delivery policy — templates, four CI gates, docs

$ git diff --numstat 3032dbf..HEAD | awk '{a+=$1;d+=$2} END {printf "add+del=%d\n", a+d}'
add+del=678
```

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

## Closure (2026-09-18)

**What shipped.** The repository's delivery policy, in one work unit (`8ab9f5e`) plus one correction
(`59363c2`): two issue forms and their config, a PR template, a four-job CI workflow, `CONTRIBUTING.md`,
and one source fix the lint job surfaced (`contracts.py` now raises `TypeError` for a precondition
violation). Seven labels were created on the remote.

**The gates, as they stand**, all four green on PR #1 and all four demonstrated **failing** on a real
throwaway branch (PR #3):

```text
api     pass 36s      |  negative control: fail (AssertionError, 1 failed | 42 passed)
worker  pass 37s      |  negative control: fail (assert 1 == 2, 1 failed, 33 passed)
lint    pass  7s      |  negative control: fail (PLR0133, Found 1 error)
policy  pass  2s      |  negative control: fail (both rules: 0 type:* labels, bad branch name)
```

**The policy, as enforced.** Exactly one `type:*` label, and a head branch matching the type regex.
Issue linkage is optional — the supervisor's decision, and the `policy` job implements exactly those
two rules and no third.

**The forecast, settled.** ~450 predicted, **678** measured (1.5×), over 8 files. Stated next to the
forecast rather than replacing it.

**Residue.** None in this feature's own artifacts. Three deliberate omissions, each stated in
`CONTRIBUTING.md` so the gap is visible rather than an oversight: no `shellcheck` (zero shell scripts
in the repository — the check would pass over an empty set), no `eslint` and no `prettier` (neither is
installed or configured; adding a linter the team has not chosen is a separate decision). `knip`
stays unevaluated-by-design, as `repo-hygiene.md` §1.6 recorded.

**What this feature does not do.** It does not make the four jobs *required*: that is a repository
setting, and it is the supervisor's to enable now that the jobs have run green at least once. It adds
no branch protection, no CODEOWNERS, no dependabot, no release automation. It does not retrofit the
policy onto the commits that already landed — they predate it, and rewriting them would be
misinformation.

**What measurement changed on the way.** The lint job found a real pre-existing defect in untouched
code (`TRY004`) and it was fixed rather than ignored; the workflow's non-existence for PR #1's original
head forced a fast-forward, because a PR whose head predates the workflow silently has no checks at
all; and the negative control found one failure it was not designed for (`lint` failing on a scratch
Python file).

**RDD conformance.** No native review ran for this feature's candidates: it is configuration, YAML,
Markdown and one four-line source fix, and the supervisor's standing decision for documentation-shaped
work applies. What carries the check instead is the verification battery above — every job demonstrated
able to fail on a real branch, not on a claim.

**Next.** Task 1.6 closes this feature. The next work unit is `wu3-contract`'s unapplied verifier fix
plan (F1, F2, F3); the supervisor separately owns enabling the required-status-check setting and
closing PR #1.

## Next step

Run task 1.6 — the closure — then this feature is done and the only open thread is `wu3-contract`'s
unapplied verifier fix plan (F1, F2, F3), whose task 1.4 is the only `[ ]` left across the 8 documents
of the previous feature.
