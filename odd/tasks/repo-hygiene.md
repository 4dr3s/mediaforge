# Feature — `repo-hygiene` (close the known inconsistencies left by the S1 rebuild)

> **Reading copy in Spanish:** `repo-hygiene.es.md`. Code blocks are byte-identical to this file;
> if they diverge, the English is canonical. The Spanish copy is a study copy, regenerated, never
> edited on its own.

**Workflow:** Organic Driven Development (ODD).
**Requirements source of truth:** `openspec/changes/audio-extract-vertical-slice/` (untouched).
**Status:** `in progress`.

---

## Why this feature exists

`odd/tasks/s1-foundation.md` ends with a section, *"Known inconsistencies left behind (open
decisions)"*, whose last line says: *"Ninguna de estas bloquea la tarea 1.4, que está completa."*
That is exactly the problem. Every item on that list is small, none of them blocks anything, and
together they are the difference between a repository that tells the truth and one that carries
statements nobody has measured. The S1 rebuild is closed; the residue is not.

The supervisor reviewed `docker/`, understood the stack, and asked for the residue to be attacked
in parallel on 2026-09-17.

## Method rule for this feature

Each item on the S1 list was re-measured against the repository **before** being written down here,
because two of them had already drifted from the code they describe. A list of known problems is
itself a claim about the repository, and this one was stale. Findings that turned out to need no
work are recorded as findings, not silently dropped: "we checked and it was already true" is
evidence too.

## Decisions taken with the supervisor (2026-09-17)

| # | Question | Decision |
| --- | --- | --- |
| 1 | `make` is not installed on this machine; keep or drop the `Makefile` | **Keep both.** The `Makefile` stays as the Linux/CI entrypoint, the root `package.json` scripts stay as the portable path. The rule gets documented (task 1.5). |
| 2 | 5 local commits, `origin` empty | **Push now**, before the line-ending churn, as a safety net and so the remote stops being a single point of failure. |
| 3 | The SDD plan attests 7 artifacts that no longer exist, and prescribes the broken D1 gate | **Uncheck the 7 and fix the runner.** The checkboxes go back to `[ ]` with a note explaining why, and the runner line takes the verified command. |
| 4 | `core.autocrlf=true` leaves CRLF in the working copy, which is what Docker copies into the build context | **LF for all text**, in the repository and in the working copy: `* text=auto eol=lf`. |

## Findings that changed the list
### F1 — the stale SDD runtime record can no longer be closed, and it is not what reports `next: apply`

The S1 list says the runtime record `.git/gentle-ai/sdd-runtime/v1/audio-extract-vertical-slice/`
holds an `attempt/begin` with no matching `end`, and that `gentle-ai sdd-status` therefore still
reports `next: apply`. Half of that is wrong.

```text
$ gentle-ai sdd-attempt --help
Usage: gentle-ai sdd-attempt grant [flags]
Record explicit per-change edit authority. Runtime attempt operations are retired.
```

The native runtime **retired attempt operations**; only `grant` survives. There is no supported
operation to end or abort that record, so "close the attempt" was never an available fix. The
record is inert legacy state and deleting it by hand would be tampering with an audit store to make
a document look cleaner.

And `next: apply` does not come from that record: it comes from the 67 unchecked tasks in the plan.
It will keep saying `apply` for as long as the SDD plan has unfinished work units, which is the
correct answer for a plan whose execution moved to ODD. There is nothing to repair here; there is
something to document. Recorded in task 1.7.

### F2 — `odd/tasks/s1-foundation.md` misdescribes its own history

The *Git history* section says *"Four commits on `main`"* and lists four, but `main` has five: the
fifth (`9eb288b`) is the commit that wrote that section. It also still says *"Nothing has been
pushed yet."* Both statements are now false, and the second one became false during this feature
(decision 2). A history section that omits the commit documenting it is a small thing; it is also
the third instance in this repository of a document asserting something nobody re-measured.
Recorded in task 1.7.

### F3 — items that need no work, re-checked

- **No baseline to diff the rebuild against.** True and unfixable: the repository had zero commits
  before the rebuild. The safety-net tarball is now redundant, because the rebuilt tree is
  committed **and pushed**. The item closes by resolution, not by action.
- **pi-lens / knip findings.** `knip` flagged every NestJS dependency as unused while `src/` did not
  exist; they disappeared when the source landed. Re-measured in task 1.6 with the current tree,
  not trusted from the old note.
- **`.env.example`.** Resolved by supervisor decision on 2026-09-16 (dropped; variables documented
  in `docker/compose.yaml` and the S1 doc). No action.
- **O2 (harness database assertions move to the Prisma client, `pg` leaves `package.json`).** Still
  binding, and still belongs to WU-2, not here. It is a constraint on a future feature, not a
  residue of this one.

### F4 — the `large-class` advisory reproduces, and the rule is the thing that is wrong

Re-measured 2026-09-17 with the installed pi-lens 4.2.0 analyzer on the current tree:

```text
🔎 pi-lens: apps\api\src\health.controller.ts — 0 blocking, 0 warning(s), 1 advisory(ies)
  ⚠ L18 large-class: [slop] Large class detected — consider splitting responsibilities
```

Exit `0`. It reproduces, and it should not be acted on: the message claims "more than 20 methods"
while the shipped rule carries **no method-count condition**, and the rule's own test fixture marks
`class A { foo() {} }` — a one-method class — as a violation. The tool flags any class with at least
one method. Disposition: leave the controller alone, suppress nothing in code. If the noise ever
matters, the defect to fix is the rule's arity, not the file.

### F5 — the knip finding in `apps/api` is gone, and knip found a different one that is real

The original claim — every NestJS dependency in `apps/api/package.json` reported as unused — **does
not reproduce**. `pnpm dlx knip --workspace api` exits `0` with no output on the current tree: the
premise of that finding was that `apps/api/src/` did not exist yet, and it does now.

But the full-workspace run exposes something the S1 list never noticed:

```text
Unlisted binaries (1)
uv  package.json
```

`uv` is a machine-level tool that the root `package.json` script `test:worker` invokes, and knip is
right that the script depends on a binary the manifest never declares — the same class of problem
as `make` being absent, one layer down. It is **recorded, not actioned**: knip is not a project
dependency and has no configuration in this repository (it was run via `pnpm dlx`), so adding a
`knip.json` to silence a tool nobody has wired into CI would be inventing scope. The finding belongs
with the decision to adopt knip, and it is listed in *Out of scope* with that reason.

Also unavailable, and not to be confused with clean: `pnpm --filter api exec eslint .` fails with
`Command "eslint" not found`. This project has no ESLint dependency and no ESLint configuration, so
that check is **unavailable**, not passing.

## Tasks

### 1.1 — Baseline: the stack is green before anything is touched · owner: AI

The renormalization commit (1.2) rewrites every tracked file in the index, and 1.4 changes the
dependency install. Without a green baseline, a later red result cannot be attributed.

```bash
docker compose -f docker/compose.yaml up -d --wait
pnpm test:api
pnpm test:worker
```

**Acceptance:** the raw output of all three, with exit codes, is in the evidence log.

### 1.2 — `.gitattributes`: LF in the repository and in the working copy · owner: AI

```bash
# create .gitattributes
git add --renormalize .
git add .gitattributes
git commit -m "chore(repo): force LF line endings so the build context never sees CRLF"
git checkout-index -f -a          # bring the working copy to LF as well
git status --short                # must print nothing
```

**Acceptance:**

- `git ls-files --eol` reports `i/lf w/lf` for every tracked text file.
- `git diff --ignore-cr-at-eol HEAD~1 HEAD` prints nothing: the commit changed **only** carriage
  returns. That is the proof that the renormalization did not touch content.
- `git status --short` is empty afterwards, i.e. the working copy and the index agree again.

### 1.3 — Reconcile the SDD plan with what exists · owner: AI

`openspec/changes/audio-extract-vertical-slice/tasks.md`:

- The 7 checkboxes that attest deleted artifacts (1.1–1.4, 5.1, 5.2, 13.2) go back to `[ ]`, with
  one note stating why: their evidence was deleted with the S1 apply output and the work was
  rebuilt under ODD in `s1-foundation`.
- The `API` runner line takes the verified D1 replacement.

**Acceptance — measured, with the control corrected after measuring it wrong.**

The first version of this criterion used a non-matching *test file* as the negative control. That
control is worthless, and it took a measurement to see it: `vitest run no/such/spec.ts` exits `1`
by itself, with or without the flag, so it goes red for a reason that has nothing to do with the
fix. It was a plausible control, which is exactly what made it dangerous.

The defect lives in the **`--filter` selector**, so the control has to change the selector while
keeping the flag off and on. A/B, measured 2026-09-17:

```bash
pnpm --filter nosuchpkg run test:harness                              # exit 0  <- D1 alive
pnpm --filter nosuchpkg --fail-if-no-match run test:harness           # exit 1
pnpm --filter nosuchpkg exec vitest run test/harness.spec.ts          # exit 0  <- D1 alive, in the shape the plan prescribed
pnpm --filter nosuchpkg --fail-if-no-match exec vitest run test/harness.spec.ts  # exit 1
pnpm --filter api --fail-if-no-match exec vitest run test/harness.spec.ts        # exit 0  real suite, green
```

The flag is what makes the gate capable of failing. This is D1's own lesson repeating one level
up: the first control was a guess that read as evidence, and only the A/B disproved it.

**The observation that killed the first control, stated as its own measurement** (writer run,
2026-09-17 — an independent verifier pointed out that the paragraph above asserted this without a
reproducible command in the document, which is exactly the kind of claim this feature exists to
stop):

```bash
pnpm --filter api exec vitest run no/such/spec.ts                 # exit 1, without the flag
pnpm --filter api --fail-if-no-match exec vitest run no/such/spec.ts  # exit 1, with the flag
```

Both red, so that control cannot tell the fix apart from vitest failing on its own. It measures
vitest, not the gate.

### 1.4 — Pin the allowed build scripts · owner: AI

`pnpm install` reports two ignored build scripts (`@nestjs/core`, `esbuild`). Harmless while a human
runs the install; a silent difference in the image a pipeline builds.

```bash
# add pnpm.onlyBuiltDependencies to the root package.json
pnpm install
pnpm test:api && pnpm test:worker
```

**Acceptance:** `pnpm install` no longer reports ignored build scripts, and both suites are still
green. `pnpm-lock.yaml` changes only if a lockfile change is required.

### 1.5 — Document the two entrypoints · owner: AI

Decision 1, written where the next person will look for it: a comment header in the `Makefile`
stating that GNU make is not installed on the author's Windows machine, that the root
`package.json` scripts are the portable path, and that the `Makefile` exists for Linux and CI.

**Acceptance:** the comment exists; no recipe changed; `pnpm test:api` and `pnpm test:worker` still
exit 0.

### 1.6 — Re-measure the findings that were never actioned · owner: AI
pi-lens flagged `apps/api/src/health.controller.ts` with `ast-grep:large-class`, and `knip` flagged
every NestJS dependency as unused before `src/` existed. Both were left unactioned. Re-run the
check against the current tree.

**Acceptance:** either a raw finding plus a decision, or recorded evidence that it no longer
reproduces. No silent skip, and no action taken purely to silence a linter. **Done — verdicts in
F4 and F5.**

### 1.7 — Close the loop in the S1 document, and keep the Spanish copies honest · owner: AI

- Rewrite the *"Known inconsistencies left behind"* list in `odd/tasks/s1-foundation.md` so every
  item states **resolved**, **inert (with the reason)**, or **binding on a future feature** — no
  item may stay ambiguous. Point at this feature and at the commit ids.
- Correct the two false statements in its *Git history* section (findings F2), and drop the stale
  sentence *"Two more, and then 1.3 is closed"*.
- Regenerate `odd/tasks/s1-foundation.es.md` in sync, and create `odd/tasks/repo-hygiene.es.md`.

**Acceptance:** both `.es.md` copies have their `##` sections in the same order as the English, and
the code blocks are byte-identical — verified with the same check the S1 doc records:

```bash
awk '/^```/{f=!f;next} f' <file> | md5sum
```

### 1.8 — RDD conformance record · owner: AI

The RDD contract requires an assessment after each work-unit commit and a per-task record of the
assessed tier and outcome. The slice was assessed once at close, which was a deviation, and the
corrected record turned out to be impossible to produce as written. Both the sweep and the reasons
are in the evidence log under *1.8 — RDD conformance record*.

**Acceptance:** every work unit carries an explicit outcome, and the reason it cannot carry a tier
is measured rather than assumed.

## Evidence log

Raw output, appended as each task closes. Verbatim, not paraphrased.
### 1.1 — Baseline (2026-09-17)

The first attempt was red and it was an environment fact, not a regression. `docker compose`
failed with `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine;
check if the path is correct and see if the daemon is running`, and both suites failed with
connection refused to Postgres and Redis. Docker Desktop was started (server 29.6.2) and the run
below is the second attempt:

```text
$ docker compose -f docker/compose.yaml up -d --wait
 mediaforge-redis Healthy · mediaforge-postgres Healthy · mediaforge-api Healthy · mediaforge-worker Healthy
[exit=0]
$ pnpm test:api
 Test Files  1 passed (1) · Tests  2 passed (2)
[exit=0]
$ pnpm test:worker
 2 passed in 0.24s
[exit=0]
```

### 1.2 — `.gitattributes` (2026-09-17)

The interesting part: a first byte scan reported all 54 files as containing CR, and that number
was garbage. `xargs` splits arguments on whitespace, and a carriage return *is* whitespace, so the
pattern arrived at `grep` empty and matched every line of every file. The re-run uses a
two-character PCRE pattern (`\r`) so no raw control byte travels through `argv`. Measured
conclusion: nothing on disk had CRLF; the danger was latent in the next clone or checkout, which
`eol=lf` removes.

```text
$ git ls-files --eol | awk '{print $1, $2}' | sort | uniq -c
     54 i/lf w/lf
$ git ls-files -z | xargs -0 grep -lUP '\r'      # correct scan
(no output)  -> 0 of 54 tracked files contain a carriage return
$ awk 'BEGIN{n=0} /\r/{n++} END{...}' Makefile .gitattributes package.json docker/compose.yaml
 0 CR lines each
$ git add --renormalize .
(staged nothing beyond .gitattributes)
$ git check-attr text eol -- package.json
package.json: text: auto
package.json: eol: lf
```

Two notes on re-running this. The census reads **54** because that is the count at the moment of the
scan, before `.gitattributes` itself was tracked; at `HEAD` the same commands report **55**, and
both numbers are the whole tracked set (`54 of 54`, `55 of 55`). And the scanned set is what counts,
not the number.

### 1.3 — the runner gate

The A/B block is already in the task body above; measured 2026-09-17, so nothing new to record
here.

### 1.4 — the pnpm pin (2026-09-17)

The durations quoted below (`581ms`, `0.23s`) are single samples, as raw output always is: the
independent verification re-ran the same commands and got `585ms` and `0.20s` with identical pass
counts, exit codes and pnpm version. Pass counts and exit codes are the evidence; timings are
whatever the machine did that second.

```text
$ pnpm install
Scope: all 3 workspace projects
Lockfile is up to date, resolution step is skipped
Already up to date
Done in 581ms using pnpm v10.33.0
[exit=0]   (no "Ignored build scripts" notice)
$ wc -c pnpm-lock.yaml   -> 120856 before and 120856 after
$ pnpm test:api -> Test Files 1 passed (1) · Tests 2 passed (2)  [exit=0]
$ pnpm test:worker -> 2 passed in 0.23s                          [exit=0]
```

### 1.5 — the entrypoints (2026-09-17)

```text
$ command -v make
(no output) [exit=1]
$ make --version
make: command not found [exit=127]
```

### 1.7 — the closure (2026-09-17)

What this task changed: the S1 residue list now marks every item resolved, inert or binding; the
two false statements in its Git history section were corrected; and both `.es.md` copies were
regenerated and verified byte-identical on their code blocks.

**Commit ids for the evidence log:** `746be7f` feature tracking · `914b65d` SDD plan
reconciliation · `758df00` Makefile entrypoints · `b8f1c7d` pnpm build scripts · `42a189b` lint
re-measurement and D1 control · `23585e5` LF line endings. The five commits that preceded this
feature are `b05afcd`, `892f706`, `9d05ebd`, `ab47532`, `9eb288b`.

### 1.8 — RDD conformance record (2026-09-17)

The RDD contract requires an assessment after each work-unit commit and a per-task record of the
assessed tier and outcome (`granted | declined | passive | deferred to slice | unavailable`).
Measured after the slice was pushed, that record cannot be produced as written, for two independent
reasons — one of them mine.

**Reason one (mine): the step was not taken when it was expressible.** I ran a single assessment at
slice close instead of one per commit. The contract's passive path is what advances the reviewed
boundary; with no per-commit assessment the boundary never moved off the branch point, so the
candidate accumulated to 8 files and 943 lines. Accumulation was structural, not incidental.

**Reason two (the tooling's): the passive path is unreachable, so a boundary advance was never
possible anyway.** `assess` resolves the candidate as `<baseRef>..HEAD`. HEAD is now fixed, so
retroactive per-commit tiers are not expressible: every base produces the accumulated range rather
than the commit. And every range that carries no risk signal comes back `unassessable`:

| baseRef | `Makefile` inside the range | result |
| --- | --- | --- |
| `9eb288b` (parent of the slice) | yes | `high` · `process_boundary` · 8 files, 943 lines |
| `914b65d` | yes | `high` · `process_boundary` · 7 files, 786 lines |
| `758df00` | no | `unassessable` — `native response is schema incompatible` |
| `42a189b` | no | `unassessable` — same |
| `23585e5` | no | `unassessable` — same |
| `6fe5314` | no | `unassessable` — same |

The only risk signal in this slice is the `Makefile`, because the change touches a shell process
boundary. Ranges containing it assess fine; ranges without it fail schema validation on the Pi side.
The clean case — the one the contract maps to *"passive/low: no reviewer or consent ceremony, and
the boundary advances"* — is precisely the case that cannot produce a verdict, and the contract then
instructs treating a failed assessment as `high`. The mechanism is **inferred from four refuted and
two confirmed cases, not read from the schema**: strong support for a hypothesis, not a diagnosis.

Two earlier probes returned `native command returned empty output` instead. That string means the
base-ref argument did not resolve to a commit (it was mistyped), and it is distinguishable from the
schema incompatibility above — useful when reproducing, since the two failures look similar and are
not the same.

**Recorded outcome, per work unit: `unavailable`** — all eight, for the native review; and
`unassessable`-as-high wherever a base ref was tried. Nothing was invented to fill the field.

**Consequence, stated plainly.** This slice received the risk-gated path: writer self-verification
plus a mandatory independent verifier. It would have received exactly that under RDD off. The
contract's lighter path was never available to it, and no sequencing change would have made it
available.

**Follow-up work unit (the Spanish mirror sync), assessed 2026-09-17.** This one *was* assessed at
the workspace projection, the way the contract asks, and it fails the same way:

```text
$ gentle_review {"operation":"assess"}    # ambient working tree, two .md files
risk: unassessable
reasons: [{"code":"native-assess-unavailable",
           "detail":"native review assess failed: native response is schema incompatible"}]
nativeReviewOutcome: unknown · outcome_source: unknown
```

So the defect is not about committed ranges at all: it is about the candidate carrying **no risk
signal**. Seven data points now, all consistent — six base refs plus this workspace candidate.
Recorded outcome: `unassessable`-as-high. The native review itself was skipped for this candidate on
the entry rule's own terms (*"a trivial passive documentation-only edit"*), and the risk-gated path
was satisfied instead by the pair-hash check, re-run independently by the parent after the worker
reported it.

## Out of scope

- WU-2 and everything after it (Prisma schema, contract contents, state machine). The O2 constraint
  is recorded here but belongs to WU-2's own feature.
- WU-5 (redis-py spike) and WU-13 (sandbox namespace precheck): their evidence was deleted by
  decision and must be revisited before WU-6 and WU-14, inside the SDD plan.
- Restoring egress denial on the compose network (`internal: true`, defect D4). Doing that requires
  moving the acceptance inside a container first; it is a change of its own.
- **Adopting knip as a project dependency**, and with it the `uv` unlisted-binary finding from F5.
  Adding configuration for a tool the repository does not depend on is not hygiene, it is scope.
- ESLint. The repository has no ESLint dependency and no configuration; that is a stack decision,
  not a residue to clean up.
