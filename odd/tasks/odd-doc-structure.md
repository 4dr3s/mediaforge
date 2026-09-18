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
- **Running count:** +454 authored changed lines after work-unit 1.1 — 223 in the English document and 231 in its Spanish mirror, so the mirror is again 51% of the cost. Both the forecast and this count exceed the ~400 budget, so the chain strategy is applied before the next commit, not after.
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
| 1.2 | `wu3-contract.md` + mirror | `[ ]` | — |
| 1.3 | `repo-hygiene.md` + mirror | `[ ]` | — |
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

Answer the chain-strategy question recorded in `## Delivery`, then run task 1.2.
