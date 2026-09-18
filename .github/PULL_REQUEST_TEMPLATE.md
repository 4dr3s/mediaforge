<!-- Replace the italic placeholders. Keep the sections in this order. -->

## Summary

- _one to three bullets on what this PR does, and why_

## Linked issue

Linking is **optional** under this repository's policy (decision of 2026-09-18): if the work has an
issue, link it; if not, this description stands alone. Use the `Closes` keyword when one exists:

```
Closes #N
```

## Type

Tick **exactly one** box, and add the matching `type:*` label to the PR. The CI `policy` job
rejects a PR that does not carry exactly one `type:*` label.

- [ ] `type:feature` — new behavior
- [ ] `type:bug` — a defect fixed
- [ ] `type:docs` — documentation only
- [ ] `type:refactor` — behavior-preserving change
- [ ] `type:chore` — maintenance with no user-visible behavior
- [ ] `type:breaking-change` — an incompatible behavior change

## Changes

| File | Change |
| --- | --- |
| _path_ | _what changed, and why_ |

## Test plan

Bring the whole stack up first — both test commands below run against the real Postgres and Redis:

```
docker compose -f docker/compose.yaml up -d --wait
```

Then:

```
pnpm --filter api --fail-if-no-match run test
uv run --project workers/media pytest workers/media/tests -q
```

`--fail-if-no-match` is required (defect D1): without it, a typo'd `--filter` exits `0` while
running nothing, and a gate that cannot fail is not a gate.

## Checklist

- [ ] Commit subject follows Conventional Commits (`type(scope): subject`)
- [ ] Docs updated if behavior changed
- [ ] No secrets committed
- [ ] Branch name matches `^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)\/[a-z0-9._-]+$`
- [ ] Exactly one `type:*` label added

## Known divergences

Declare anything here that contradicts an earlier claim in this repository, anything deliberately
not fixed, and anything out of scope. Divergences are recorded, not hidden: this repository treats
a stated gap as reviewable material and an unstated one as a defect discovered later.
