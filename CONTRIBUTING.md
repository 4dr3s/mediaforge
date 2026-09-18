# Contributing to MediaForge

MediaForge is small, single-maintainer, and measured: every command in this guide is one the
repository itself runs, and every check CI performs here you can run with the same command. If
something in this guide disagrees with what you see, that is a divergence — record it in the PR
template's *Known divergences* section instead of quietly picking a side.

## Issues

Blank issues are disabled; every issue starts from one of the two templates.

- The **bug report** (default label `type:bug`) asks for: what happened, what you expected, the
  exact reproduction steps, the **raw command output** as evidence, and the environment (OS, Docker,
  Node, pnpm, Python/uv versions) that produced it. A report without the raw output cannot be
  verified, so the template requires it.
- The **feature request** (default label `type:feature`) asks for: the problem, the proposed change,
  the alternatives considered, and — because this repository's documents always name the non-goals —
  **what is out of scope**.

Questions are not issues. The tracker is for work with evidence, not support; ask the maintainer
directly instead of opening an untemplated issue.

## Branch naming

Every branch is `<type>/<slug>`, where `<type>` is one of the list below and `<slug>` matches
`[a-z0-9._-]+`:

```
^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)\/[a-z0-9._-]+$
```

| `<type>` | Example |
| --- | --- |
| `feat` | `feat/queue-consumer` |
| `fix` | `fix/prisma-config-url` |
| `docs` | `docs/contributing-guide` |
| `chore` | `chore/pin-build-scripts` |
| `refactor` | `refactor/envelope-schema` |
| `test` | `test/gate-negative-controls` |

The CI `policy` job enforces this regex on the PR's head branch.

## Commit messages

Subjects follow Conventional Commits, verified against the repository's own history:

```
^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\([a-z0-9._-]+\))?: .+$
```

Measured on 2026-09-18: all **46** existing commit subjects match this regex.

## Labels

Seven labels exist: the six `type:*` variants plus `status:approved`.

| Label | Meaning |
| --- | --- |
| `type:feature` | new behavior |
| `type:bug` | a defect fixed |
| `type:docs` | documentation only |
| `type:refactor` | behavior-preserving change |
| `type:chore` | maintenance with no user-visible behavior |
| `type:breaking-change` | an incompatible behavior change |
| `status:approved` | the work is already authorized — used to regularize retroactive work |

## Pull requests

- Use the PR template and keep its section order.
- Add **exactly one** `type:*` label; the CI `policy` job rejects anything else.
- Name the branch per the regex above; the same job validates it.
- Linking an issue is **optional**; if one exists, use `Closes #N`.

## Running the checks locally

CI runs the repository's own commands; every one of them works on your machine. Bring the stack up
first — both test commands need Postgres and Redis healthy:

```bash
docker compose -f docker/compose.yaml up -d --wait postgres redis
```

(CI runs exactly that form; `docker compose -f docker/compose.yaml up -d --wait` also brings up the
api and worker containers for local use.)

First-time setup, then the checks:

```bash
pnpm install
uv sync --project workers/media --extra dev
pnpm --filter api --fail-if-no-match run test
uv run --project workers/media pytest workers/media/tests -q
uvx --from ruff==0.16.8 ruff check workers/media
uvx --from yamllint==1.38.0 yamllint -c .yamllint docker/compose.yaml .yamllint pnpm-workspace.yaml openspec/config.yaml .github
```

`pnpm test:api` and `pnpm test:worker` (the root `package.json` scripts) are shorthand for the two
test commands and are the portable path: GNU make is **not** installed on the author's Windows
machine, so those scripts are what actually runs there (measured in `odd/tasks/s1-foundation.md`
§1.5; the `Makefile` documents the equivalent targets for Linux and CI). `--fail-if-no-match` is
required, not decorative — without it a typo'd `--filter` exits `0` while running nothing
(defect D1).

## What CI does not check, and why

- **`shellcheck`** — the repository has zero shell scripts (`find . -name '*.sh'` is empty), so the
  check would pass over an empty set and prove nothing.
- **`eslint`** — not installed and not configured in this repository (measured in
  `odd/tasks/repo-hygiene.md` §1.6).
- **`prettier`** — likewise not installed or configured.

This is a deliberate scope decision, not an oversight: the lint job runs exactly the two linters the
repository already configures (`ruff` per `workers/media/pyproject.toml`, `yamllint` per `.yamllint`
at the root). CI also does not lint `pnpm-lock.yaml` — it is machine-written YAML, not hand-reviewed.

## Working style

- **Evidence over assertion.** Claims carry the command that produced them; the bug template
  requires the raw output.
- **No checkoff without observed proof.** A checkbox is ticked only for a run that was seen.
- **Divergences are recorded, not hidden.** The PR template's *Known divergences* section exists so
  a stated gap is reviewable material instead of a defect discovered later.
