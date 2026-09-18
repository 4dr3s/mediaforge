# Feature — `odd-doc-structure` (give every ODD feature document the four structures it lacks)

> **Reading copy in Spanish:** `odd-doc-structure.es.md`. Code blocks are byte-identical to this file;
> if they diverge, the English is canonical.

**Workflow:** Organic Driven Development (ODD).
**Requirements source of truth:** the installed ODD contract — `assets/orchestrator-memory.md:7`
(the document's content list), `assets/orchestrator-delegation.md:96` (TDD mode, source, runner) and
`:102` (delivery forecast, strategy, slice boundaries) — plus the four measured gaps below.
**Status:** `in progress` — created 2026-09-17.

---

## Why this feature exists

Four features were tracked under ODD and none of their documents carries the four structures the
contract asks for. This was measured, not assumed:

| Document | Declared state | State actually readable from the document | Resolvable? |
| --- | --- | --- | --- |
| `s1-foundation.md:5` | `in progress` | its residue list is being closed by `repo-hygiene`; the feature is done | **No** |
| `repo-hygiene.md:9` | `in progress` | slice pushed; task 1.6 exists and has **no evidence section** (1.1–1.5, 1.7, 1.8 do). The trace sits in finding F5, with nothing linking it to 1.6 | **No** |
| `wu2-data-model.md:10` | `closed` | 1.1–1.8 with complete evidence | Yes |
| `wu3-contract.md:9` | `in progress` | task 1.4 (Closure) has **no evidence section**, and the verifier's own fix plan (F1, F2, F3 — "before this feature closes") is unapplied: the four calendar fixtures it demanded do not exist and the Python validator has no calendar-aware check | **No** |

Three of four durable documents cannot answer the one question they exist to answer: *is this done?*
The only trustworthy one is the one that declared `closed`.

Two distinct defects, and they are not the same class:

- **Missing structure is ambiguity.** It costs a re-read. It does not deceive.
- **A false statement is active misinformation.** `s1-foundation.md:5` and `repo-hygiene.md:9` assert
  states that measurement contradicts. `repo-hygiene`'s own finding F2 already recorded this: *"Third
  instance in this repo of a document asserting something nobody re-measured."*

The four structures were chosen from the contract, not invented, and they are graded — two are
unconditional content, two are conditional operational rules:

| Structure | Contract source | Kind |
| --- | --- | --- |
| `## Progress` (checklist state per stable task ID) | `orchestrator-memory.md:7` — *"actionable checklist with stable task IDs … progress"* | Unconditional content |
| `## Next step` | `orchestrator-memory.md:7` — *"and next step"* | Unconditional content |
| TDD mode / source / runner, one line inside `## Constraints` | `orchestrator-delegation.md:96` — *"Record resolved mode, source, and runner in the feature document **when present**"* | Conditional |
| `## Delivery` (forecast, strategy, slice boundaries) | `orchestrator-delegation.md:102` — *"forecast authored changed lines … record slice boundaries … in the feature document"* | Conditional (triggered past ~400 authored lines) |

Upstream practice confirms the grading rather than the flat reading. Measured on the maintainers' own
four documents in `Gentleman-Programming/gentle-shell@main`, `odd/tasks/`: checkboxes **4/4**,
`## Progress` **4/4**, next step **3/4**, TDD as one line inside `Constraints` **3/4**, and
forecast + slice boundaries **0/4**. The two unconditional structures are practice; the delivery block
has no precedent anywhere, including upstream.

## Authoritative inputs

| Input | What it governs |
| --- | --- |
| `assets/orchestrator-memory.md:7` | The document's content list, the full-mirror rule, and the `todo` projection being a projection and not a third authority. |
| `assets/orchestrator-memory.md:9` | *"Check off only observed outcomes with applicable proof"* — the honesty rule this feature is bound by. |
| `assets/orchestrator-delegation.md:80` | Proportionality: *"Small, understood work creates no durable task artifacts."* Structure is for substantial work, not a tax on everything. |
| `assets/orchestrator-delegation.md:96`, `:102` | The two conditional structures, verbatim. |
| `odd/tasks/command-palette.md` (upstream) | The reference shape: TDD as one line inside `Constraints`, and `## Next step` as a real heading. |

## Constraints (non-negotiable)

- **Strict TDD.** Mode `strict`; source `openspec/config.yaml:58` (`strict_tdd: true`); runner the two
  gates: `pnpm --filter api --fail-if-no-match run test` (api) and
  `uv run --project workers/media pytest workers/media/tests -q` (worker). **No RED cycle applies to
  this feature**: it changes only Markdown, so no runtime behaviour exists to write a failing test
  for. Stating that is the honest use of a conditional field, not an exemption — the checks that do
  apply are acceptance criteria below, and they are mechanical.
- **No checkoff without proof.** A `[x]` in any `## Progress` table requires an evidence section in
  the same document that shows the observed outcome. Missing evidence is `[ ]`, never a guess. The two
  unresolved tasks found here (1.6 in `repo-hygiene`, 1.4 in `wu3-contract`) stay unmarked.
- **No invented history.** A forecast for an already-closed feature is measured from `git log
  --numstat` and labelled retrospective. A number nobody measured is worse than an empty field.
- **The English document is canonical.** The `.es.md` copy is regenerated, never edited on its own;
  fenced code blocks stay byte-identical.
- **The existing prose is preserved.** This feature adds structure; it does not rewrite accepted
  findings, evidence or decisions. Task headings keep their text and gain nothing but a state row.
- **One state per task, in one place.** State lives in the `## Progress` table only. Duplicating it in
  the task headings would create exactly the drift this feature exists to remove.

## Delivery

- **Strategy:** `ask-on-risk` (the default) — the forecast exceeds the ~400-authored-line budget, so
  the chain strategy is asked once, before the first commit, and cached here.
- **Chain strategy:** `feature-branch-chain` — recorded 2026-09-17 from the supervisor's answer to the
  `ask-on-risk` prompt.
- **Forecast:** ~750 authored changed lines (additions plus deletions, generated files and lockfiles
  excluded) across 8 documents, 4 English plus 4 Spanish mirrors acting as a single unit each.
  Measured basis: the additions per document are 4 structures × ~15–20 lines, doubled by the mirror.
- **Running count:** 1054 authored changed lines across slices 1.1, 1.2 and 1.3 together,
  measured from the feature branch base `96f03f6` with `git diff --numstat 96f03f6` (the
  uncommitted slice 1.3 edits included, this bullet's own lines among them): 515 in the English
  documents and 539 in their Spanish mirrors, so the mirrors are again ~51% of the cost. This is
  additions plus deletions, the one formula the supervisor settled on 2026-09-17; §1.1's four
  per-feature totals are *net* instead, which is the defect recorded below and corrected in 1.3a.
  The base is §1.1's hard-won lesson, the branch point and not the previous feature's tip: a range
  starting at `2a62fa7` would swallow the four `wu3-contract` commits, ancestors of this branch.
- **Slice boundaries:** five slices, one per document pair (an English document plus its Spanish
  mirror), stacked on `feat/odd-doc-structure` and integrated at the end. Slice 1 is this document's
  own pair, from work-unit 1.1 (`92c5fb4`); slices 2–5 are tasks 1.2–1.5. The commit range of each
  slice is appended here as it lands, because a range is only knowable after its work unit commits.

## Tasks

Every task closes with at least one work-unit commit on the feature branch.

### 1.1 — Define the uniform target shape, and record the measured facts · owner: AI

The spec the next agent copies, kept in this document so it has exactly one home: section order and
the four structures' exact form; the TDD line's canonical wording; the `## Progress` table columns;
the `## Delivery` block's fields; the `## Next step` rule (one line, and an explicit *none* when the
feature is closed).

Measured facts recorded here, not re-derived per document: the two canonical runners; the per-feature
authored line counts; the branch and commit range of each feature; and the finding that the Spanish
mirror is roughly half of every feature's authored lines (s1 +622 of +1930, `repo-hygiene` +472 of
+951, `wu2` +857 of +3224, `wu3` +286 of +1572) — a duplicated delivery cost no document ever counted.

**Acceptance:** this document contains the shape and the facts, and this document itself carries all
four structures.

### 1.2 — `wu3-contract.md` and its Spanish mirror · owner: AI

Add the four structures. Progress must record the truth: 1.1–1.3 are `[x]` (their evidence exists);
**1.4 stays `[ ]`**; and the `## Next step` names the verifier's unapplied fix plan (F1, F2, F3) as
the next action, because that is what the document currently does not say.

### 1.3 — `repo-hygiene.md` and its Spanish mirror · owner: AI

Add the four structures, correct the `Status` line that currently contradicts the pushed slice, and
leave **1.6 at `[ ]`** with the reason: no evidence section, trace only in finding F5.

### 1.4 — `s1-foundation.md` and its Spanish mirror · owner: AI

Add the four structures and correct `Status`, which says `in progress` about a feature whose residue
list is already being closed elsewhere.

### 1.5 — `wu2-data-model.md` and its Spanish mirror · owner: AI

Add the four structures. This is the only document whose state was already truthful, so its `## Progress`
should come out fully `[x]` and its `## Next step` should be an explicit *none*.

### 1.6 — Verification across all 8 documents · owner: AI

Mechanical, and recorded verbatim:

- every one of the 8 documents contains all four structures (grep by heading);
- every `[x]` has an evidence pointer that resolves to a real section in the same document;
- every `[ ]` has a stated reason;
- English and Spanish fenced code blocks are byte-identical (§1.2–1.5 must not have broken the mirror
  rule), compared by extracting and hashing the blocks;
- the English documents' pre-existing prose is unchanged except for the added structures and the
  corrected `Status` lines — checked by diffing prose, not by trusting the edit.

**Acceptance:** the checks are run and their raw output is in the evidence log, including any failure.
A check that cannot fail is not a check: the evidence must show it failing for a constructed
counter-example.

### 1.7 — Closure · owner: AI

The feature documents agree with what exists, the Spanish mirrors are regenerated and verified, and
this document closes with its gates recorded.

## Progress

State is `[x]` only where the evidence log holds observed proof for that task.

| ID | Task | State | Evidence |
| --- | --- | --- | --- |
| 1.1 | The uniform shape and the measured facts | `[x]` | §1.1 |
| 1.2 | `wu3-contract.md` + mirror | `[x]` | §1.2 |
| 1.3 | `repo-hygiene.md` + mirror | `[x]` | §1.3 |
| 1.4 | `s1-foundation.md` + mirror | `[ ]` | — |
| 1.5 | `wu2-data-model.md` + mirror | `[ ]` | — |
| 1.6 | Verification across all 8 documents | `[ ]` | — |
| 1.7 | Closure | `[ ]` | — |

## Evidence log

Raw output, appended as each task closes. Verbatim, not paraphrased.

### 1.1 — the shape and the measured facts (2026-09-17)

Per-feature authored changed lines, measured with `git log <range> --numstat`, additions plus
deletions, excluding `pnpm-lock.yaml`, `generated` paths and `.lock` files:

| Feature | Range | Total | Code/tests | Docs EN | Docs ES |
| --- | --- | --- | --- | --- | --- |
| `s1-foundation` | `b05afcd..9eb288b` | +1930 | +666 | +642 | +622 |
| `repo-hygiene` | `9eb288b..1c73e4c` | +951 | +20 | +459 | +472 |
| `wu2-data-model` | `1c73e4c..2a62fa7` | +3224 | +1502 | +865 | +857 |
| `wu3-contract` | `2a62fa7..96f03f6` | +1572 | +1002 | +284 | +286 |

Every feature exceeds the ~400-line advisory budget, by 2.4× to 8×. In three of four, the Spanish
mirror alone is at or above the whole budget, and no document records that cost.

The four structures' absence, measured across the 4 English documents:

| Structure | `s1-foundation` | `repo-hygiene` | `wu2-data-model` | `wu3-contract` |
| --- | --- | --- | --- | --- |
| `## Progress` | absent | absent | absent | absent |
| `## Next step` | absent | absent | present (prose, line 816) | absent |
| TDD mode/source/runner | mode only, inline (line 205) | **absent** | mode only, inline (line 43) | mode only, inline (line 49) |
| `## Delivery` | absent | absent | absent | absent |
| Checkboxes anywhere | 0 | 0 | 0 | 0 |

`git log -S'- [ ]' -- odd/tasks/` returns no commit that ever added one: the omission is stable across
the whole feature history, not a regression.

**A measurement trap found by making it.** The first count taken for this feature was `git log 2a62fa7..HEAD --numstat` → **+2106**, which is wrong: because the history is linearly stacked (`feat/wu2-data-model` is an ancestor of `feat/wu3-contract`, which is the parent of this branch), a range that starts at the *previous feature's* tip silently swallows that feature's commits — the four `wu3-contract` commits, +1572 of the total. The correct base is the branch point, `git merge-base feat/wu3-contract HEAD` → `96f03f6`, which yields **+450**. Re-measured after this correction, the same range reads **+454** (223 English, 231 Spanish) — the correction is part of the same work unit, which is why the count moves by exactly the four lines it added. This is precisely the class of error the delivery forecast exists to catch, and it was caught by measuring rather than by reading: the two numbers differ by 4.6×.

The unapplied `wu3-contract` fix plan, measured against the working tree: the four fixtures F2 demands
are absent from `contracts/fixtures/envelopes/invalid/` (present: `date-only`, `fourth-field`,
`missing-job-id`, `missing-occurred-at`, `missing-type`, `naive-occurred-at`, `non-object`,
`numeric-occurred-at`, `numeric-type`, `object-job-id`, `unknown-version`, `unsupported-version`), and
`workers/media/src/mediaforge/contracts.py` contains no `datetime`, `date(` or `fromisoformat` — so the
calendar-aware validation F2 asks for is not there.

### 1.2 — `wu3-contract.md` and its Spanish mirror (2026-09-17)

The structures added, and the checks that were actually run:

```text
$ for f in wu3-contract.md wu3-contract.es.md; do
    echo "$f: $(grep -c '^## Delivery\|^## Progress\|^## Next step' $f) sections, TDD source: $(grep -c 'source `openspec' $f)"; done
wu3-contract.md: 3 sections, TDD source: 1
wu3-contract.es.md: 3 sections, TDD source: 1

$ blocks() { awk '/^```/{f=!f; print; next} f{print}' "$1" | md5sum; }
$ blocks wu3-contract.md && blocks wu3-contract.es.md
5164754a97cd612023d3ffb28522a9c8
5164754a97cd612023d3ffb28522a9c8      # identical
```

**One check passed vacuously, and it is recorded instead of hidden.** Run on this feature's own pair,
the same comparison returns `d41d8cd98f00b204e9800998ecf8427e` — the MD5 of the empty string — because
`odd-doc-structure.md` has no fenced code block at all. The mirror rule holds there trivially, so the
check cannot fail for that pair and proves nothing about it. That is the same class as this repository's
own recorded defect D1 (*"a gate that cannot fail"*): a check passing for a reason unrelated to what it
claims. Task 1.6 must therefore *demonstrate* the check failing on a constructed counter-example before
any pass of it is worth anything — and it must re-measure this pair too, because this evidence entry is
what gives the pair its first fenced block.

**What the document now says that it did not.** Task 1.4 (Closure) is `[ ]`, and `## Next step` names
the verifier's unapplied fix plan — measured, not inferred, as §1.1 records. The Delivery block records
the slice boundary as *"none, because none were used"*: `feat/wu3-contract` has no upstream and no pull
request, and sits 24 commits past `origin/main` (a count that includes `wu2-data-model`, because the
history is stacked).

### 1.3 — `repo-hygiene.md` and its Spanish mirror (2026-09-17)

The four structures added to both files; the `Status` line corrected (complete and pushed, nine
commits on `origin/main`); and the supervisor's 2026-09-17 overrule applied — repo-hygiene task
1.6 now carries an evidence section and is `[x]`, with the overrule recorded in that document
rather than hidden. The checks below are the checks task 1.6 will re-run across all eight
documents, run here on this pair, raw:

```text
$ for f in repo-hygiene.md repo-hygiene.es.md; do
    printf '%s: constraints=%s delivery=%s progress=%s next=%s\n' "$f" \
      "$(grep -c '^## Constraints (non-negotiable)\|^## Restricciones (no negociables)' odd/tasks/$f)" \
      "$(grep -c '^## Delivery$' odd/tasks/$f)" "$(grep -c '^## Progress$' odd/tasks/$f)" \
      "$(grep -c '^## Next step$' odd/tasks/$f)"; done
repo-hygiene.md: constraints=1 delivery=1 progress=1 next=1
repo-hygiene.es.md: constraints=1 delivery=1 progress=1 next=1

$ awk '/^## Evidence log|^## Log de evidencia/{ev=1} /^### / && ev{print $2}' odd/tasks/repo-hygiene.md | sort | uniq -c
      1 1.1
      1 1.2
      1 1.3
      1 1.4
      1 1.5
      1 1.6
      1 1.7
      1 1.8
$ awk '/^## Evidence log|^## Log de evidencia/{ev=1} /^### / && ev{print $2}' odd/tasks/repo-hygiene.es.md | sort | uniq -c
      1 1.1
      1 1.2
      1 1.3
      1 1.4
      1 1.5
      1 1.6
      1 1.7
      1 1.8

$ awk '/^```/{f=!f;next} f' odd/tasks/repo-hygiene.md | md5sum
246e1a4a0e106c5ea69b9577af0849d8  -
$ awk '/^```/{f=!f;next} f' odd/tasks/repo-hygiene.es.md | md5sum
246e1a4a0e106c5ea69b9577af0849d8  -      # identical
```

Every `[x]` in either `## Progress` table points at §1.1..§1.8 and every one of those sections
exists in the same document — the pointer scan above counts exactly one evidence heading per id,
in both languages. `##` heading order is identical in both files: 11 sections each, same
sequence; the Spanish copy translates the prose headings (`Restricciones (no negociables)`,
`Decisiones …`, `Hallazgos …`, `Tareas`, `Log de evidencia`, `Fuera de alcance`) and keeps the
field headings (`Delivery`, `Progress`, `Next step`) verbatim.

**Prose proof.** `git diff --stat` (this work unit, uncommitted) and a read of the diff:

```text
$ git diff --stat
 odd/tasks/odd-doc-structure.es.md | 122 +++++++++++++++++++++++++++++++++++++-
 odd/tasks/odd-doc-structure.md    | 117 +++++++++++++++++++++++++++++++++++-
 odd/tasks/repo-hygiene.es.md      | 103 +++++++++++++++++++++++++++++++-
 odd/tasks/repo-hygiene.md         |  97 +++++++++++++++++++++++++++++-
 4 files changed, 431 insertions(+), 8 deletions(-)

$ git diff --numstat 96f03f6
382	0	odd/tasks/odd-doc-structure.es.md
370	0	odd/tasks/odd-doc-structure.md
101	2	odd/tasks/repo-hygiene.es.md
96	1	odd/tasks/repo-hygiene.md
49	3	odd/tasks/wu3-contract.es.md
44	2	odd/tasks/wu3-contract.md
```

The working diff touches only the four document files, and each change is one of: the four
structures added, the `Status` line corrected, or the bookkeeping in this document. Nothing else
was rewritten.

**On the running count.** The `**Running count:**` bullet in `## Delivery` is brought up to date
for slices 1.1, 1.2 and 1.3 together: `git diff --numstat 96f03f6` (above, measured from the
feature branch base, uncommitted slice 1.3 edits included) reads 1054 authored changed lines —
515 in the English documents and 539 in their Spanish mirrors, so the mirrors are again ~51% of
the cost. It is additions plus deletions, which is now the single formula in this document; §1.1's
four totals are net, and unifying them is task 1.3a. Re-measuring after writing is the §1.1
mechanism, so the total includes this section's own lines.

**What surprised me.**

1. **§1.1's `repo-hygiene` row (+951 = +20/+459/+472) does not reproduce under its stated
   formula.** Summing additions *plus* deletions over `git log 9eb288b..1c73e4c --numstat` gives
   +1163, not +951. The +951 split reproduces exactly only as additions *minus* deletions per
   file: 430 + 445 + 23 + 27 + 10 + 3 + 7 + 6 = 951 (repo-hygiene.md, repo-hygiene.es.md,
   s1-foundation.md, s1-foundation.es.md, .gitattributes, package.json, Makefile, and the SDD
   `tasks.md` bucketed into the English docs). §1.1's arithmetic contradicts its own formula
   sentence; the corrected forecast (additions plus deletions) is recorded in `repo-hygiene.md`
   `## Delivery`, and §1.1's row is left untouched as accepted evidence.
2. **The Spanish mirror of this document had drifted before this slice.** `odd-doc-structure.es.md`
   `## Progress` row 1.2 read `[ ]` while the canonical English table read `[x]` (§1.2 evidence
   exists in both files). Caught while regenerating the mirror here; corrected to match the
   canonical.
3. **A range-notation nuance in the status line.** `746be7f..1c73e4c`, read as a git range,
   excludes `746be7f` and counts 8 commits; the 9-commit range is `9eb288b..1c73e4c`
   (`746be7f`'s parent is `9eb288b`). The supervisor's dictated wording said "9 commits" next to a
   range that holds eight, which is the notation trap in miniature. Corrected on 2026-09-17: the
   status line now writes the span as `746be7f`…`1c73e4c` (a span, not a git range) and the count
   of nine is the one measured from `9eb288b..1c73e4c`.

**On the overrule.** Task 1.3 of this document originally required repo-hygiene task 1.6 to stay
`[ ]` (*"no evidence section, trace only in finding F5"*). The supervisor overruled that on
2026-09-17 because the proof already exists in the same document — F4 holds the raw pi-lens
output and the decision not to act, F5 the raw knip output and the deferred `uv` finding. The
task body above keeps its original text; the overrule is recorded here and, as an evidence
section, in the overruled document itself.

## Out of scope

- The upstream fix. The supervisor decided (2026-09-17) not to file an issue against
  `Gentleman-Programming/gentle-shell`; this is a local backfill, and the corrected documents are the
  reference the next agent copies.
- A validator, a template file or a skill. This feature adds structure to documents; enforcement is a
  separate decision, deliberately not taken here.
- Rewriting evidence, findings or decisions already accepted in the existing documents.
- Closing `wu3-contract` or `repo-hygiene`. Recording that they are open is the job; finishing them is
  not.

## Next step

Run task 1.3 (`repo-hygiene.md` and its Spanish mirror), then 1.4, 1.5, and the verification in 1.6.
