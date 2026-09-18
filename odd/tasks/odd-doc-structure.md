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
- **Running count:** slices 1.1, 1.2 and 1.3 together measure **1054** authored changed lines,
  additions plus deletions — the one formula the supervisor settled on 2026-09-17 — anchored to
  **commits** and measured with `git diff --numstat 96f03f6..ad8b122`: 515 in the English
  documents and 539 in their Spanish mirrors, so the mirrors are again ~51% of the cost.
  Re-anchored in 1.3a (2026-09-17): the previous bullet measured the working tree (`git diff
  --numstat 96f03f6`) and so included its own lines and moved with every later edit; slice 1.3
  is now committed as `ad8b122`, and a count anchored to commits cannot be invalidated by the
  act of writing it down. This work unit (1.3a) adds its own authored changed lines on top,
  counted separately against the working tree with `git diff --numstat ad8b122` — raw output
  and totals in §1.3a; that count includes the record's own lines (the §1.1 re-measure
  mechanism). The ~750-line forecast does not hold: 1054 is already measured across the first
  three slices, and the two remaining document pairs (1.4, 1.5) and the verification slice
  (1.6) are still to come. The base stays §1.1's hard-won lesson, the branch point and not the
  previous feature's tip: a range starting at `2a62fa7` would swallow the four `wu3-contract`
  commits, ancestors of this branch. Slice 1.4 landed as `64177be`, so it is now commit-anchored
  like slices 1.1–1.3: `git diff --numstat c96dd3d..64177be` reproduces exactly the slice's recorded
  working-tree total, 390 (EN=191, ES=199) — raw output and the arithmetic in §1.5. The historical
  working-tree value (`git diff --numstat c96dd3d`, recorded in §1.4) stays visible and labelled: it
  read the same 390, and the committed range confirms it line for line. Slice 1.5, the slice this
  bullet is being updated by, has no commit yet, so nothing about it is anchored to one: its own
  lines are counted against the working tree at `64177be` with `git diff --numstat 64177be` — raw
  output and totals in §1.5; that count includes the record's own lines (the §1.1 re-measure
  mechanism). Slices 1.1–1.3 keep their commit anchor (`96f03f6..ad8b122` = 1054, above) and slice
  1.3a's own unit keeps its recorded count against `ad8b122` (545, in §1.3a).
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

### 1.3a — Correct the forecast formula to additions plus deletions, and record the RDD conformance decision · owner: AI

Two supervisor decisions, taken 2026-09-17 (the day this feature was created), applied here:

- **One forecast formula.** The single formula is additions plus deletions. §1.1's four
  per-feature totals were *net* (additions minus deletions) and are corrected, keeping the old
  net figures visible and labelled; `wu3-contract.md` `## Delivery` carries the same correction.
- **Re-anchored running count.** Slices 1.1–1.3 are measured from commits (`git diff --numstat
  96f03f6..ad8b122`), because the working-tree measurement included the bullet's own lines and
  moved with every edit. This work unit's own lines are counted separately.
- **The RDD decision.** The supervisor opted out of native review for this feature's candidates,
  explicitly and informed, on the review entry rule's documentation-only passive edit exception,
  with in-repo precedent in `repo-hygiene.md` §1.8. The outcome is recorded in the new
  `## RDD conformance` section; task 1.6's mechanical verification carries the check instead.

**Acceptance:** every corrected number is measured and its raw output is in §1.3a; no corrected
number replaces an old one without the old figure staying visible and labelled; the `.es.md`
mirrors are regenerated in step; and the RDD record names the outcome, its scope, and what the
feature carries instead.

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
| 1.3a | Correct the §1.1 formula, re-anchor the running count, record the RDD decision | `[x]` | §1.3a |
| 1.4 | `s1-foundation.md` + mirror | `[x]` | §1.4 |
| 1.5 | `wu2-data-model.md` + mirror | `[x]` | §1.5 |
| 1.6 | Verification across all 8 documents | `[ ]` | — |
| 1.7 | Closure | `[ ]` | — |

## Evidence log

Raw output, appended as each task closes. Verbatim, not paraphrased.

### 1.1 — the shape and the measured facts (2026-09-17)

Per-feature authored changed lines, measured with `git log <range> --numstat`, additions plus
deletions, excluding `pnpm-lock.yaml`, `generated` paths and `.lock` files:

| Feature | Range | Total (add+del) | Code/tests | Docs EN | Docs ES | Old total (net) |
| --- | --- | --- | --- | --- | --- | --- |
| `s1-foundation` | `b05afcd..9eb288b` | +1934 | +666 | +644 | +624 | +1930 |
| `repo-hygiene` | `9eb288b..1c73e4c` | +1163 | +20 | +585 | +558 | +951 |
| `wu2-data-model` | `1c73e4c..2a62fa7` | +4478 | +2092 | +1219 | +1167 | +3224 |
| `wu3-contract` | `2a62fa7..96f03f6` | +1598 | +1004 | +308 | +286 | +1572 |

**Corrected in 1.3a, 2026-09-17.** The four rows above were originally *net* totals (additions
minus deletions) — +1930 = +666/+642/+622, +951 = +20/+459/+472, +3224 = +1502/+865/+857,
+1572 = +1002/+284/+286 — contradicting the formula sentence above them. The supervisor settled
2026-09-17 on one formula, **additions plus deletions**, and the rows were re-measured from the
commits with `git log <range> --numstat` (both formulas, raw output in §1.3a): +1934 =
+666/+644/+624, +1163 = +20/+585/+558, +4478 = +2092/+1219/+1167, +1598 = +1004/+308/+286.
The old net figures stay visible: the `Old total (net)` column, and in full in the sentence
above as the historical measurement. Other numbers in this section that were measured at the
time are left as written evidence (the trap paragraph's +2106/+450/+454 and the share figures in
task 1.1's text); the mirror-share claim holds under both formulas, ~49% of each pair's
documentation lines.

Every feature exceeds the ~400-line advisory budget, by 2.9× to 11.2×. In three of four, the Spanish
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
mechanism, so the total includes this section's own lines. *(Consistency note, 1.3a,
2026-09-17: 1054 was the working-tree measurement, captured before the commit and including the
lines that state it. Slice 1.3 has since landed as `ad8b122`, and the commit-anchored range
`git diff --numstat 96f03f6..ad8b122` reproduces exactly 1054 — the arithmetic is in §1.3a —
so the historical value survives unchanged while 1.3a re-anchors the bullet to commits.)*

**What surprised me.**

1. **§1.1's `repo-hygiene` row (+951 = +20/+459/+472) does not reproduce under its stated
   formula.** Summing additions *plus* deletions over `git log 9eb288b..1c73e4c --numstat` gives
   +1163, not +951. The +951 split reproduces exactly only as additions *minus* deletions per
   file: 430 + 445 + 23 + 27 + 10 + 3 + 7 + 6 = 951 (repo-hygiene.md, repo-hygiene.es.md,
   s1-foundation.md, s1-foundation.es.md, .gitattributes, package.json, Makefile, and the SDD
   `tasks.md` bucketed into the English docs). §1.1's arithmetic contradicts its own formula
   sentence; the corrected forecast (additions plus deletions) is recorded in `repo-hygiene.md`
   `## Delivery`, and §1.1's row is left untouched as accepted evidence. *(Superseded in 1.3a,
   2026-09-17: the supervisor settled the one formula as additions plus deletions, and §1.1's
   four rows were corrected with the old net figures kept visible and labelled, in place of
   "left untouched"; see §1.1 and §1.3a.)*
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

### 1.3a — the formula correction, the re-anchored count and the RDD record (2026-09-17)

Everything in this section comes from a command, and every number is a measured value; where the
original was deliberately preserved as written evidence, that is stated and not hidden. The
supervisor's dictated add+del totals and category splits reproduced exactly — nothing was corrected
back to the parent. The only disagreement found was my own first awk run, which printed the per-
category net split wrong (the net accumulators sat outside the category branch, so each column
printed the total); the corrected run below is the record.

**Check 1 — the per-feature re-measurement, both formulas.** Same ranges, same exclusions
(`pnpm-lock.yaml`, `generated` paths, `.lock` files; `migration_lock.toml` is a `.toml`, not a
`.lock` file, and counts as code/tests):

```text
$ for r in "b05afcd..9eb288b" "9eb288b..1c73e4c" "1c73e4c..2a62fa7" "2a62fa7..96f03f6"; do git log "$r" --numstat | grep -v '^$' | grep -v '^commit ' | grep -v '^Author' | grep -v '^Date' | grep -v '^    ' | awk -v R="$r" '$3 !~ /pnpm-lock\.yaml$/ && $3 !~ /generated/ && $3 !~ /\.lock$/ { if ($3 ~ /\.es\.md$/) { addes+=$1+$2; netes+=$1-$2 } else if ($3 ~ /\.md$/) { adden+=$1+$2; neten+=$1-$2 } else { addcode+=$1+$2; netcode+=$1-$2 } } END { printf "=== %s ===\nadd+del total: %d (code/tests=%d, Docs EN=%d, Docs ES=%d)\nnet (add-del): %d (code/tests=%d, Docs EN=%d, Docs ES=%d)\n", R, addcode+adden+addes, addcode, adden, addes, netcode+neten+netes, netcode, neten, netes }'; done
=== b05afcd..9eb288b ===
add+del total: 1934 (code/tests=666, Docs EN=644, Docs ES=624)
net (add-del): 1930 (code/tests=666, Docs EN=642, Docs ES=622)
=== 9eb288b..1c73e4c ===
add+del total: 1163 (code/tests=20, Docs EN=585, Docs ES=558)
net (add-del): 951 (code/tests=20, Docs EN=459, Docs ES=472)
=== 1c73e4c..2a62fa7 ===
add+del total: 4478 (code/tests=2092, Docs EN=1219, Docs ES=1167)
net (add-del): 3224 (code/tests=1502, Docs EN=865, Docs ES=857)
=== 2a62fa7..96f03f6 ===
add+del total: 1598 (code/tests=1004, Docs EN=308, Docs ES=286)
net (add-del): 1572 (code/tests=1002, Docs EN=284, Docs ES=286)
```

The add+del column is what §1.1's table now carries; the net column is the old measurement
(`Old total (net)`). The net splits reproduce the old rows exactly — 666/642/622, 20/459/472,
1502/865/857, 1002/284/286.

**Check 2 — `##` heading count, EN vs ES, both pairs:**

```text
$ for p in odd-doc-structure wu3-contract; do printf '%s: EN=%s ES=%s\n' "$p" "$(grep -c '^## ' odd/tasks/$p.md)" "$(grep -c '^## ' odd/tasks/$p.es.md)"; done
odd-doc-structure: EN=10 ES=10
wu3-contract: EN=10 ES=10
```

**Check 3 — fenced code blocks byte-identical, both pairs.** The wu3 pair, which this record does
not touch inside its fences:

```text
$ awk '/^```/{f=!f;next} f' odd/tasks/wu3-contract.md | md5sum
6e58b62bedfa054f43d9a83cdb1ce708  -
$ awk '/^```/{f=!f;next} f' odd/tasks/wu3-contract.es.md | md5sum
6e58b62bedfa054f43d9a83cdb1ce708  -      # identical
```

The pair that contains these very lines cannot state its own hash inside itself without
circularity, so it is measured separately, in prose: `awk '/^```/{f=!f;next} f' odd/tasks/odd-doc-structure.md | md5sum` → `f8dd5e327a4391e76ec58d9c557b24be`, and the same command on `odd-doc-structure.es.md` → `f8dd5e327a4391e76ec58d9c557b24be` — identical.

**Check 4 — every `[x]` in `## Progress` resolves to a heading in the same document:**

```text
$ for f in odd/tasks/odd-doc-structure.md odd/tasks/odd-doc-structure.es.md odd/tasks/wu3-contract.md odd/tasks/wu3-contract.es.md; do
    awk '/^## Progress/{p=1;next} /^## / && p{p=0} p && /^\|/ && /\[x\]/ {print}' "$f" | while read -r row; do
      id=$(printf '%s' "$row" | awk -F'|' '{gsub(/^[ \t]*§?[ \t]*|[ \t]+$/,"",$5); print $5}')
      [ -z "$id" ] && continue
      if grep -q "^### $id" "$f"; then echo "$(basename "$f"): §$id OK"; else echo "$(basename "$f"): §$id MISSING"; fi
    done
  done
odd-doc-structure.md: §1.1 OK
odd-doc-structure.md: §1.2 OK
odd-doc-structure.md: §1.3 OK
odd-doc-structure.md: §1.3a OK
odd-doc-structure.es.md: §1.1 OK
odd-doc-structure.es.md: §1.2 OK
odd-doc-structure.es.md: §1.3 OK
odd-doc-structure.es.md: §1.3a OK
wu3-contract.md: §1.1 OK
wu3-contract.md: §1.2 OK
wu3-contract.md: §1.3 OK
wu3-contract.es.md: §1.1 OK
wu3-contract.es.md: §1.2 OK
wu3-contract.es.md: §1.3 OK
```

**Check 5 — the diff of this work unit.** `git diff --stat` and the unit's own numstat, measured
after everything in this section was written (the counts include this section's own lines):

```text
$ git diff --stat
 odd/tasks/odd-doc-structure.es.md | 266 +++++++++++++++++++++++++++++++++++---
 odd/tasks/odd-doc-structure.md    | 257 +++++++++++++++++++++++++++++++++---
 odd/tasks/wu3-contract.es.md      |  11 +-
 odd/tasks/wu3-contract.md         |  11 +-
 4 files changed, 501 insertions(+), 44 deletions(-)
```

A read of the diff, file by file: `odd-doc-structure.md` — the running-count bullet replaced
(re-anchored to commits), §1.1's table corrected with the new `Old total (net)` column and a
labelled correction note, the derived multiplier sentence corrected (2.9× to 11.2×), two labelled
notes appended to §1.3 (consistency + supersede), the new task 1.3a, the new `## Progress` row,
the new `## RDD conformance` section, the new `### 1.3a` evidence entry, and the one-line
`## Next step` update; `odd-doc-structure.es.md` — the same changes, translated; `wu3-contract.md`
and its mirror — only the `## Delivery` `**Forecast:**` bullet, corrected with the old +1572 set
kept and labelled. No other lines changed. The unit's own authored lines, from the working tree:

```text
$ git diff --numstat ad8b122
247	19	odd/tasks/odd-doc-structure.es.md
238	19	odd/tasks/odd-doc-structure.md
8	3	odd/tasks/wu3-contract.es.md
8	3	odd/tasks/wu3-contract.md

add+del total for this unit: 545 (EN=268, ES=277)
```

**Slices 1.1–1.3, anchored to commits (Decision 2):**

```text
$ git diff --numstat 96f03f6..ad8b122
384	0	odd/tasks/odd-doc-structure.es.md
372	0	odd/tasks/odd-doc-structure.md
101	2	odd/tasks/repo-hygiene.es.md
96	1	odd/tasks/repo-hygiene.md
49	3	odd/tasks/wu3-contract.es.md
44	2	odd/tasks/wu3-contract.md
```

add+del total: **1054** (515 English, 539 Spanish). A commit-anchored count cannot be invalidated
by the act of writing it down, which is why the bullet now rests on this range instead of on the
working tree. The consistency arithmetic: the numstat block captured in §1.3 (382/370/101·2/96·1/
49·3/44·2) sums to 1050, and the committed range reads 1054 — four lines in the pair landed between
that capture and the commit, because the lines that state the count were still being written. That
is exactly the circularity 1.3a removes.

**Decision 3 — the RDD switch, read-only:**

```text
$ gentle-ai review mode status
receipt-driven development: on (decided by global)
  global:      on
  clone-local: unset
```

**What was deliberately left as written evidence.** The trap paragraph (+2106/+450/+454) and task
1.1's share figures are historical measurements taken under the old formula, and they are preserved
as recorded; the mirror-share claim they carry holds under both formulas (~49% of each pair's
documentation lines). The ES mirror's `## Next step` had drifted before this unit — it named the
chain-strategy question and task 1.2 — and was regenerated to mirror the English, which is where
that heading now reads.

### 1.4 — `s1-foundation.md` and its Spanish mirror (2026-09-17)

The four structures added to both files, and the `Status` line corrected — it said `in progress`
about a feature that is finished: all four tasks 1.1–1.4 carry evidence sections in the same
document, the residue list was closed by the follow-up feature `repo-hygiene` (commit `6fe5314`),
and this feature's tip `9eb288b` is an ancestor of `origin/main`. The rest of the line (the
Spanish-copy pointer and the Defects / Supervisor review log pointer) is untouched. Task headings
kept their text; state lives only in the `## Progress` table. The checks below are the checks
task 1.6 will re-run across all eight documents, run here on both pairs this unit touches, raw:

```text
$ for f in s1-foundation.md s1-foundation.es.md odd-doc-structure.md odd-doc-structure.es.md; do
    printf '%s: constraints=%s delivery=%s progress=%s next=%s\n' "$f" \
      "$(grep -c '^## Constraints (non-negotiable)\|^## Restricciones (no negociables)' odd/tasks/$f)" \
      "$(grep -c '^## Delivery$' odd/tasks/$f)" "$(grep -c '^## Progress$' odd/tasks/$f)" \
      "$(grep -c '^## Next step$' odd/tasks/$f)"; done
s1-foundation.md: constraints=1 delivery=1 progress=1 next=1
s1-foundation.es.md: constraints=1 delivery=1 progress=1 next=1
odd-doc-structure.md: constraints=1 delivery=1 progress=1 next=1
odd-doc-structure.es.md: constraints=1 delivery=1 progress=1 next=1

$ for f in odd/tasks/s1-foundation.md odd/tasks/s1-foundation.es.md odd/tasks/odd-doc-structure.md odd/tasks/odd-doc-structure.es.md; do
    awk '/^## Progress/{p=1;next} /^## / && p{p=0} p && /^\|/ && /\[x\]/ {print}' "$f" | while read -r row; do
      id=$(printf '%s' "$row" | awk -F'|' '{gsub(/^[ \t]*§?[ \t]*|[ \t]+$/,"",$5); print $5}')
      [ -z "$id" ] && continue
      if grep -q "^### $id" "$f"; then echo "$(basename "$f"): §$id OK"; else echo "$(basename "$f"): §$id MISSING"; fi
    done
  done
s1-foundation.md: §1.1 OK
s1-foundation.md: §1.2 OK
s1-foundation.md: §1.3 OK
s1-foundation.md: §1.4 OK
s1-foundation.es.md: §1.1 OK
s1-foundation.es.md: §1.2 OK
s1-foundation.es.md: §1.3 OK
s1-foundation.es.md: §1.4 OK
odd-doc-structure.md: §1.1 OK
odd-doc-structure.md: §1.2 OK
odd-doc-structure.md: §1.3 OK
odd-doc-structure.md: §1.3a OK
odd-doc-structure.md: §1.4 OK
odd-doc-structure.es.md: §1.1 OK
odd-doc-structure.es.md: §1.2 OK
odd-doc-structure.es.md: §1.3 OK
odd-doc-structure.es.md: §1.3a OK
odd-doc-structure.es.md: §1.4 OK

$ for f in odd/tasks/s1-foundation.md odd/tasks/s1-foundation.es.md; do
    echo "== $f"
    awk '/^## /{ev=0} /^## Evidence log|^## Log de evidencia/{ev=1} /^### / && ev{print $2}' "$f" | sort | uniq -c
  done
== odd/tasks/s1-foundation.md
      1 1.1
      1 1.2
      1 1.3
      1 1.4
== odd/tasks/s1-foundation.es.md
      1 1.1
      1 1.2
      1 1.3
      1 1.4

$ awk '/^```/{f=!f;next} f' odd/tasks/s1-foundation.md | md5sum
8d954644a76f8076f6367e059d56d6a0  -
$ awk '/^```/{f=!f;next} f' odd/tasks/s1-foundation.es.md | md5sum
8d954644a76f8076f6367e059d56d6a0  -      # identical

$ git log b05afcd..9eb288b --numstat | grep -v '^$' | grep -v '^commit ' | grep -v '^Author' | grep -v '^Date' | grep -v '^    ' | awk -v R="b05afcd..9eb288b" '$3 !~ /pnpm-lock\.yaml$/ && $3 !~ /generated/ && $3 !~ /\.lock$/ { if ($3 ~ /\.es\.md$/) { addes+=$1+$2; netes+=$1-$2 } else if ($3 ~ /\.md$/) { adden+=$1+$2; neten+=$1-$2 } else { addcode+=$1+$2; netcode+=$1-$2 } } END { printf "=== %s ===\nadd+del total: %d (code/tests=%d, Docs EN=%d, Docs ES=%d)\nnet (add-del): %d (code/tests=%d, Docs EN=%d, Docs ES=%d)\n", R, addcode+adden+addes, addcode, adden, addes, netcode+neten+netes, netcode, neten, netes }'
=== b05afcd..9eb288b ===
add+del total: 1934 (code/tests=666, Docs EN=644, Docs ES=624)
net (add-del): 1930 (code/tests=666, Docs EN=642, Docs ES=622)

$ git branch -a --list '*s1-foundation*' | grep . || echo "no s1-foundation branch (local or remote)"
no s1-foundation branch (local or remote)

$ git merge-base --is-ancestor 9eb288b origin/main && echo "9eb288b is an ancestor of origin/main; origin/main is $(git rev-parse --short origin/main)"
9eb288b is an ancestor of origin/main; origin/main is 1c73e4c
```

This pair cannot state its hash inside its own fences without circularity — §1.3a records
the same constraint. Measured at the end of this entry, after the last fenced edit:
`awk '/^```/{f=!f;next} f' odd/tasks/odd-doc-structure.md | md5sum` → `b1ee203a829db94b174fddd407974dd5`, and the
same command on `odd-doc-structure.es.md` → `b1ee203a829db94b174fddd407974dd5` — identical.

**What surprised me.**

1. **The pointer scan needed a section bound to be honest.** The §1.3-era one-liner
   (`awk '/^## Evidence log|^## Log de evidencia/{ev=1} /^### / && ev{print $2}'`) counts the
   `### D1`–`### D4` headings too, because in `s1-foundation` the *Defects* sections come after
   the evidence log. The unbounded scan returns 1.1, 1.2, 1.3, 1.4, D1, D2, D3, D4 in both
   files; the bounded scan above (every `## ` heading resets the guard) returns exactly 1.1–1.4.
   The reported scan is the section-bounded one.
2. **The pair-hash check did not move for the s1 pair.** The pair already held many fenced
   blocks and this unit's edits added none, so the hash is unchanged (`8d954644…`) and still
   identical across the pair. Not a vacuous pass — the check compares actual command-output
   blocks and would fail if a mirror edit drifted; here nothing inside the fences changed.
3. **The two diff blocks below are capture-time values by design.** The counts include the
   record's own lines (the §1.1 re-measure mechanism), so they are true at the moment of
   capture and move only if the record is edited again before commit.

**Prose proof.** `git diff --stat` (this work unit, uncommitted) and the unit's own numstat
against the working tree:

```text
$ git diff --stat
 odd/tasks/odd-doc-structure.es.md | 148 +++++++++++++++++++++++++++++++++++++-
 odd/tasks/odd-doc-structure.md    | 143 +++++++++++++++++++++++++++++++++++-
 odd/tasks/s1-foundation.es.md     |  51 +++++++++++++-
 odd/tasks/s1-foundation.md        |  48 ++++++++++++-
 4 files changed, 381 insertions(+), 9 deletions(-)

$ git diff --numstat c96dd3d
145	3	odd/tasks/odd-doc-structure.es.md
140	3	odd/tasks/odd-doc-structure.md
49	2	odd/tasks/s1-foundation.es.md
47	1	odd/tasks/s1-foundation.md

add+del total for this slice: 390 (EN=191, ES=199)
```

The working diff touches only the four document files, and a read of the diff shows each change
is one of: the four structures added (constraints + delivery + progress + next step), the
`Status` line corrected, or the bookkeeping in this document. Nothing else was rewritten.

**On the running count.** Slices 1.1–1.3 stay anchored to their commits (`96f03f6..ad8b122` =
1054) and slice 1.3a's own unit keeps its recorded count against `ad8b122` (545); this slice has
no commit yet, so its count is the working-tree measurement above (`git diff --numstat c96dd3d`),
which includes this record's own lines. No commit-anchored total is claimed for it — the anchor
is the working tree until the work unit lands.

### 1.5 — `wu2-data-model.md` and its Spanish mirror (2026-09-17)

The four structures added to both files, and nothing else: task headings kept their text, the
`## Closure (2026-09-17)` section is untouched, and the Spanish mirror's `cerrada` status token is
left exactly as it is (finding below, handed to task 1.6). `## Progress` came out fully `[x]` — this
was the only document whose declared state (`Status: closed`) was already truthful — and `## Next
step` is an explicit *none*. The TDD bullet in `## Constraints (non-negotiable)` gained the
mode/source/runner it was missing while keeping its explanatory sentence; verified before writing
that `openspec/config.yaml:58` is `strict_tdd: true`, that the root `package.json` scripts
`test:api` (`pnpm --filter api --fail-if-no-match run test`) and `test:worker` (`uv run --project
workers/media pytest workers/media/tests -q`) run exactly the two commands the line names, and that
`apps/api/package.json` carries the `test` script (`vitest run`) the API gate resolves to. The
checks below are the checks task 1.6 will re-run across all eight documents, run here on the four
files this slice touches, raw:

```text
$ for f in wu2-data-model.md wu2-data-model.es.md odd-doc-structure.md odd-doc-structure.es.md; do
    printf '%s: constraints=%s delivery=%s progress=%s next=%s\n' "$f" \
      "$(grep -c '^## Constraints (non-negotiable)\|^## Restricciones (no negociables)' odd/tasks/$f)" \
      "$(grep -c '^## Delivery$' odd/tasks/$f)" "$(grep -c '^## Progress$' odd/tasks/$f)" \
      "$(grep -c '^## Next step$' odd/tasks/$f)"; done
wu2-data-model.md: constraints=1 delivery=1 progress=1 next=1
wu2-data-model.es.md: constraints=1 delivery=1 progress=1 next=1
odd-doc-structure.md: constraints=1 delivery=1 progress=1 next=1
odd-doc-structure.es.md: constraints=1 delivery=1 progress=1 next=1
```

Every `[x]` in either `## Progress` table resolves to an evidence heading in the same document; the
section-bounded scan (every `## ` heading resets the guard) and the evidence-heading census are
below — the census is what makes the bound necessary, because in the wu2 pair the unbounded form
counts duplicate `### 1.1`–`### 1.3` headings (and a third `### 1.1` from `## Tasks`).

```text
$ for f in odd/tasks/wu2-data-model.md odd/tasks/wu2-data-model.es.md odd/tasks/odd-doc-structure.md odd/tasks/odd-doc-structure.es.md; do
    awk '/^## Progress/{p=1;next} /^## / && p{p=0} p && /^\|/ && /\[x\]/ {print}' "$f" | while read -r row; do
      id=$(printf '%s' "$row" | awk -F'|' '{gsub(/^[ \t]*§?[ \t]*|[ \t]+$/,"",$5); print $5}')
      [ -z "$id" ] && continue
      if grep -q "^### $id" "$f"; then echo "$(basename "$f"): §$id OK"; else echo "$(basename "$f"): §$id MISSING"; fi
    done
  done
wu2-data-model.md: §1.1 OK
wu2-data-model.md: §1.2 OK
wu2-data-model.md: §1.3 OK
wu2-data-model.md: §1.4 OK
wu2-data-model.md: §1.5 OK
wu2-data-model.md: §1.6 OK
wu2-data-model.md: §1.7 OK
wu2-data-model.md: §1.8 OK
wu2-data-model.es.md: §1.1 OK
wu2-data-model.es.md: §1.2 OK
wu2-data-model.es.md: §1.3 OK
wu2-data-model.es.md: §1.4 OK
wu2-data-model.es.md: §1.5 OK
wu2-data-model.es.md: §1.6 OK
wu2-data-model.es.md: §1.7 OK
wu2-data-model.es.md: §1.8 OK
odd-doc-structure.md: §1.1 OK
odd-doc-structure.md: §1.2 OK
odd-doc-structure.md: §1.3 OK
odd-doc-structure.md: §1.3a OK
odd-doc-structure.md: §1.4 OK
odd-doc-structure.md: §1.5 OK
odd-doc-structure.es.md: §1.1 OK
odd-doc-structure.es.md: §1.2 OK
odd-doc-structure.es.md: §1.3 OK
odd-doc-structure.es.md: §1.3a OK
odd-doc-structure.es.md: §1.4 OK
odd-doc-structure.es.md: §1.5 OK
```

All 28 rows resolve: the 16 wu2 rows (EN+ES) and the 12 `[x]` rows of this document's own pair
(the two `[ ]` rows — 1.6, 1.7 — are untouched by design).

```text
$ for f in odd/tasks/wu2-data-model.md odd/tasks/wu2-data-model.es.md; do
    echo "== $f"
    awk '/^## /{ev=0} /^## Evidence log|^## Registro de evidencia/{ev=1} /^### / && ev{print $2}' "$f" | sort | uniq -c
  done
== odd/tasks/wu2-data-model.md
      2 1.1
      2 1.2
      2 1.3
      1 1.4
      1 1.5
      1 1.6
      1 1.7
      1 1.8
== odd/tasks/wu2-data-model.es.md
      2 1.1
      2 1.2
      2 1.3
      1 1.4
      1 1.5
      1 1.6
      1 1.7
      1 1.8
```

The duplicates are structural, not a resolution problem: tasks 1.1, 1.2 and 1.3 each carry two
evidence headings — the RED/GREEN run entry plus its *independent verification* entry, a
consequence of RDD per-work-unit verification — and both headings of a task sit in the same
`## Evidence log`. The progress pointer resolves by existence (`grep -q "^### <id>"`), so a
`[x]` pointing at §1.1 finds its evidence. This is a different shape from the `### D1`–`### D4`
case in `s1-foundation`, where sections *after* the evidence log leaked into an unbounded scan;
here the only leak would be the duplicates themselves.

The wu2 pair's fenced blocks, byte-identical after this slice's edit (the pair gained exactly one
new block, the 20-commit list in `## Delivery`):

```text
$ awk '/^```/{f=!f;next} f' odd/tasks/wu2-data-model.md | md5sum
9f41d0d28cb00bb828a2ac48773c69b5  -
$ awk '/^```/{f=!f;next} f' odd/tasks/wu2-data-model.es.md | md5sum
9f41d0d28cb00bb828a2ac48773c69b5  -      # identical
```

**The retrospective Delivery measurement**, the formula of record (additions plus deletions,
excluding `pnpm-lock.yaml`, `generated` paths and `.lock` files):

```text
$ git log 1c73e4c..2a62fa7 --numstat | grep -v '^$' | grep -v '^commit ' | grep -v '^Author' | grep -v '^Date' | grep -v '^    ' | awk -v R="1c73e4c..2a62fa7" '$3 !~ /pnpm-lock\.yaml$/ && $3 !~ /generated/ && $3 !~ /\.lock$/ { if ($3 ~ /\.es\.md$/) { addes+=$1+$2; netes+=$1-$2 } else if ($3 ~ /\.md$/) { adden+=$1+$2; neten+=$1-$2 } else { addcode+=$1+$2; netcode+=$1-$2 } } END { printf "=== %s ===\nadd+del total: %d (code/tests=%d, Docs EN=%d, Docs ES=%d)\nnet (add-del): %d (code/tests=%d, Docs EN=%d, Docs ES=%d)\n", R, addcode+adden+addes, addcode, adden, addes, netcode+neten+netes, netcode, neten, netes }'
=== 1c73e4c..2a62fa7 ===
add+del total: 4478 (code/tests=2092, Docs EN=1219, Docs ES=1167)
net (add-del): 3224 (code/tests=1502, Docs EN=865, Docs ES=857)
```

**Branch facts — why the strategy label is `feature-branch`, retrospective, and not
`s1-foundation`'s "no branch ever existed":**

```text
$ git branch -a --list '*wu2-data-model*'
  feat/wu2-data-model
  remotes/origin/feat/wu2-data-model
$ git rev-parse feat/wu2-data-model
2a62fa7921796028461bad145515a985fc320c78
$ git rev-parse origin/feat/wu2-data-model
2a62fa7921796028461bad145515a985fc320c78
$ git rev-list --left-right --count feat/wu2-data-model...origin/feat/wu2-data-model
0	0
$ git merge-base feat/wu2-data-model origin/main
1c73e4c47be8ffd0e6916992a8023ec7e73d7fe6
$ git rev-parse --short origin/main
1c73e4c
$ git merge-base --is-ancestor 2a62fa7 origin/main && echo merged || echo "2a62fa7 is NOT an ancestor of origin/main"
2a62fa7 is NOT an ancestor of origin/main
$ git ls-remote origin 'refs/pull/*/head'; echo "exit=$?"
exit=0
```

The feature branch exists locally **and** on `origin`, the two point at the same commit
(`2a62fa7`) and are in sync (`0\t0`); the branch never merged into `main` (its merge-base with
`origin/main` is `1c73e4c`, `origin/main`'s tip). The `ls-remote` probe returned empty output with
exit `0` (no open pull refs). It sees open PRs only — a PR that was opened and closed without
merging does not show up, so that absence cannot be verified by git alone.

**The 1.4 re-anchor, measured — the check the running-count bullet now rests on:**

```text
$ git diff --numstat c96dd3d..64177be
145	3	odd/tasks/odd-doc-structure.es.md
140	3	odd/tasks/odd-doc-structure.md
49	2	odd/tasks/s1-foundation.es.md
47	1	odd/tasks/s1-foundation.md
```

add+del total: **390 (EN=191, ES=199)** — reproduces §1.4's recorded working-tree total exactly,
same four files, same numstat. Slice 1.4 is therefore commit-anchored now, like slices 1.1–1.3, and
its historical working-tree value (`git diff --numstat c96dd3d`, also 390, recorded in §1.4) stays
visible and labelled. This closes the loop §1.4 left open: "the anchor is the working tree until
the work unit lands, and then the commit becomes the anchor" — `64177be` is that commit.

**What each document now says that it did not.**

- `wu2-data-model.md`: the TDD line names its mode, source and runner (it was mode-only before:
  "the config declares `strict_tdd: true`"); `## Delivery` records the retrospective forecast
  (+4478, measured), the strategy (`feature-branch`, retrospective — the branch exists locally and
  on `origin`, in sync, never merged into `main`, no open PR) and the slice boundary (one branch,
  one slice, 20 commits listed verbatim); `## Progress` is fully `[x]` for 1.1–1.8 with a pointer
  per row; `## Next step` is an explicit *none* naming WU-3 as its own feature.
- `wu2-data-model.es.md`: the same, translated; the `cerrada` status token untouched (finding
  below).
- `odd-doc-structure.md`: task 1.5 is `[x]` (§1.5); the running count re-anchors slice 1.4 to its
  commit `64177be` (390, reproduced above) and counts this slice against the working tree at
  `64177be`; `## Next step` names 1.6, then 1.7; and the open items below are recorded for task 1.6
  instead of being fixed or hidden here.

**Prose proof.** — this unit's diff, measured from the working tree at `64177be` (capture-time
values; the counts include the record's own lines, the §1.1 re-measure mechanism):

```text
$ git diff --stat
 odd/tasks/odd-doc-structure.es.md | 318 ++++++++++++++++++++++++++++++++++++--
 odd/tasks/odd-doc-structure.md    | 305 ++++++++++++++++++++++++++++++++++--
 odd/tasks/wu2-data-model.es.md    |  75 +++++++++-
 odd/tasks/wu2-data-model.md       |  71 ++++++++-
 4 files changed, 745 insertions(+), 24 deletions(-)

$ git diff --numstat 64177be
308	10	odd/tasks/odd-doc-structure.es.md
295	10	odd/tasks/odd-doc-structure.md
72	3	odd/tasks/wu2-data-model.es.md
70	1	odd/tasks/wu2-data-model.md

add+del total for this slice: 769 (EN=376, ES=393)

$ git diff --name-only
odd/tasks/odd-doc-structure.es.md
odd/tasks/odd-doc-structure.md
odd/tasks/wu2-data-model.es.md
odd/tasks/wu2-data-model.md
```

The working diff touches only the four document files, and a read of the diff, file by file, shows
each change is one of: the four structures added to the wu2 pair, the TDD bullet completed in its
`## Constraints` (mode/source/runner added, explanatory sentence kept), or the bookkeeping in this
document (the `1.5` progress row, the running-count bullet re-anchored, the `## Next step` update,
and this entry). Nothing else was rewritten.

**On the running count.** Slices 1.1–1.3 stay anchored to their commits (`96f03f6..ad8b122` =
1054, above), slice 1.3a's own unit keeps its recorded count against `ad8b122` (545), and slice 1.4
is now re-anchored too — the bullet in `## Delivery` carries the update, and the re-anchor is
measured just above. This slice has no commit yet, so its count is the working-tree measurement
(`git diff --numstat 64177be`, in the prose-proof blocks), which includes this record's own lines.
No commit-anchored total is claimed for it — the anchor is the working tree until the work unit
lands.

**What surprised me.**

1. **`cerrada` vs `closed`: the one translated status token.** Raw lines of all eight status
   headers, measured 2026-09-17:

```text
$ grep -H '^\*\*Status:\*\*' odd/tasks/wu2-data-model.md odd/tasks/s1-foundation.md odd/tasks/repo-hygiene.md odd/tasks/wu3-contract.md
odd/tasks/wu2-data-model.md:**Status:** `closed` 2026-09-17 — tasks 1.1 to 1.8 complete, every work unit verified independently.
odd/tasks/s1-foundation.md:**Status:** `closed` — all four tasks 1.1–1.4 carry recorded evidence; the residue list below was
odd/tasks/repo-hygiene.md:**Status:** complete and pushed (9 commits, `746be7f`…`1c73e4c`, on `origin/main`) — 2026-09-17.
odd/tasks/wu3-contract.md:**Status:** `in progress` — created 2026-09-17.
$ grep -H '^\*\*Estado:\*\*' odd/tasks/wu2-data-model.es.md odd/tasks/s1-foundation.es.md odd/tasks/repo-hygiene.es.md odd/tasks/wu3-contract.es.md
odd/tasks/wu2-data-model.es.md:**Estado:** `cerrada` el 2026-09-17 — tareas 1.1 a 1.8 completas, cada unidad de trabajo verificada de
odd/tasks/s1-foundation.es.md:**Estado:** `closed` — las cuatro tareas 1.1–1.4 llevan evidencia registrada; la lista de
odd/tasks/repo-hygiene.es.md:**Estado:** completo y pusheado (9 commits, `746be7f`…`1c73e4c`, en `origin/main`) — 2026-09-17.
odd/tasks/wu3-contract.es.md:**Estado:** `in progress` — creado el 2026-09-17.
```

   Only the wu2 pair translates the backticked token (`cerrada` against `closed`); `s1-foundation`
   (`closed`) and `wu3-contract` (`in progress`) keep the English token verbatim, and `repo-hygiene`
   carries no token (its status is prose, translated normally). This is a real, pre-existing
   inconsistency. The decision on it belongs to task 1.6, not to this slice, so the mirror keeps
   `cerrada` exactly as it is; recorded here as an open item for 1.6 with the raw lines above.
2. **Carried forward from the previous slice's independent verification, left to task 1.6.** Two
   items, recorded here as open items rather than fixed or hidden:
   (a) this document's own `## Progress` table rows 1.6 and 1.7 (`[ ]`) carry only a blanket reason
   — the lead-in sentence, "State is `[x]` only where the evidence log holds observed proof" — not
   a per-row reason, while task 1.6's spec demands "every `[ ]` has a stated reason";
   (b) §1.4's residue-closure claim — "closed by the follow-up feature `repo-hygiene` (commit
   `6fe5314`)" — is stated without raw git output for `6fe5314`. The claim is corroborated by
   `repo-hygiene.md`'s own slice-boundary list (commit `6fe5314` is "S1 residue closure and mirror
   regeneration"), but the 1.6 record should carry the raw output or mark the claim unverified.
3. **The Closure's "eighteen commits, none pushed" does not reproduce — both halves are
   capture-time claims.** The closure commit `2a62fa7` (the 20th in the range) introduced that
   sentence. Today the range `1c73e4c..2a62fa7` holds 20 commits (19 at `2a62fa7`'s parent), and
   the branch is pushed and in sync with `origin` — the delivery the Closure records as pending
   happened after capture. The count reconciles as 20 minus the tracking commit (`627979d`) and the
   closure commit (`2a62fa7`), which is plausible but not what the document states. The Closure
   section is preserved as accepted content; the wu2 `## Delivery` in this slice states the
   measured truth (20, pushed, in sync); and this discrepancy is recorded as an open item for 1.6.
4. **No check passed vacuously this slice.** The one probe bounded by construction is the PR probe:
   `git ls-remote origin 'refs/pull/*/head'` returning empty output with exit `0` is evidence about
   **open** PRs only, and the wu2 `## Delivery` says exactly that. The pair-hash check on the wu2
   pair compares real content (the pair gained exactly one new fenced block; the hash now reads
   `9f41d0d2…`, shared by both files), so this slice's hash pass is not the empty-string pass §1.2
   recorded for the then-blockless odd-doc-structure pair.

This pair cannot state its own hash inside its own fences without circularity — §1.3a and §1.4
record the same constraint. Measured at the end of this entry, after the last fenced edit (and
re-measured after the in-place correction of the prose-proof block above, which is a fenced edit):
`awk '/^```/{f=!f;next} f' odd/tasks/odd-doc-structure.md | md5sum` → `0521b8fe4b4a0cf37a3d312d2245a44f`,
and the same command on `odd-doc-structure.es.md` → `0521b8fe4b4a0cf37a3d312d2245a44f` — identical.
The wu2 pair's hash, quoted in the block above, is unaffected by this document's prose and still
matches (`9f41d0d2…`). The two prose-proof captures above are capture-time values by design (§1.1's
re-measure mechanism), and this note adds its own lines on top of them — the committed range
will confirm the numbers when this work unit lands.

## RDD conformance

A section because the supervisor made an explicit decision about this feature's candidates on
2026-09-17, and the decision is recorded here rather than left implicit in a log line.

- **Outcome: no lineage, no consent, no capture — the candidates of this feature were left
  unreviewed by explicit supervisor decision.** No native review transaction exists for this
  feature: nothing was STARTed, no consent envelope was issued, and no reviewer ran. The native
  review remains the independent check on the writer, and this feature does not have one.
- **Scope: this feature only.** The decision does not change repository-wide policy. The review
  switch still reads `global: on`, `clone-local: unset` — verified with the read-only
  `gentle-ai review mode status` (raw output in §1.3a). RDD stays on; other features'
  candidates are unaffected.
- **Why.** The supervisor was informed, before deciding, that the candidate was uncommitted and
  that review would run four lenses per work unit. The review entry rule carries an exception
  for a trivial passive documentation-only edit, and this feature changes only Markdown. The
  in-repo precedent is `repo-hygiene.md` §1.8, where the native review was skipped on the same
  exception and the risk-gated path was satisfied by a recomputed check instead.
- **What carries the check instead.** Task 1.6's mechanical verification — every structure
  present, every `[x]` resolving, every `[ ]` reasoned, fenced blocks byte-identical, prose
  diffed — including the constructed counter-example that must make the block-hash check fail,
  so the check is demonstrably able to fail.
- **What was NOT available.** An approved native review and its verdict. This feature therefore
  carries no review verdict; the recorded outcome is the explicit opt-out, and everything else
  in this document is the writer's own verification under the supervisor's decision.

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

Run task 1.6 (verification across all 8 documents), then 1.7 (closure).
