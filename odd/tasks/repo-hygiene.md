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

```
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

**Acceptance — measured, not quoted from the S1 doc:**

```bash
pnpm --filter api --fail-if-no-match exec vitest run test/harness.spec.ts   # exit 0
pnpm --filter api --fail-if-no-match exec vitest run no/such/spec.ts        # exit non-zero
```

The negative control is the whole point: the prescribed command passed without running anything
(defect D1), so a green run proves nothing. Only the non-zero exit on a non-matching selector
proves the gate can fail.

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
reproduces. No silent skip, and no action taken purely to silence a linter.

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

## Evidence log

Empty until 1.1 runs.

## Out of scope

- WU-2 and everything after it (Prisma schema, contract contents, state machine). The O2 constraint
  is recorded here but belongs to WU-2's own feature.
- WU-5 (redis-py spike) and WU-13 (sandbox namespace precheck): their evidence was deleted by
  decision and must be revisited before WU-6 and WU-14, inside the SDD plan.
- Restoring egress denial on the compose network (`internal: true`, defect D4). Doing that requires
  moving the acceptance inside a container first; it is a change of its own.
