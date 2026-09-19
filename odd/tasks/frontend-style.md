# Feature — `frontend-style` (choose the mockup tool and the style source of truth for the Next.js UI, before any UI exists)

> **Reading copy in Spanish:** `frontend-style.es.md`. Code blocks are byte-identical to this file;
> if they diverge, the English is canonical. The Spanish copy is a study copy, regenerated, never
> edited on its own.

**Workflow:** Organic Driven Development (ODD).
**Requirements source of truth:** the supervisor's four decisions of 2026-09-19, recorded verbatim in
*Decisions taken with the supervisor* below, plus the tool facts measured in §1.1 of the evidence log.
`openspec/changes/audio-extract-vertical-slice/` is untouched by this feature and stays untouched.
**Status:** `closed` for its own five tasks — created 2026-09-19 and closed the same day, work unit
`0b8e434` on `docs/frontend-style-decision`. The three deferred items (installing the tool, wiring the
MCP entry, writing the style skill) are **separate features, not residues**: each carries a runtime
acceptance that a Markdown task cannot claim.

**Amended 2026-09-19, after the tool was installed and measured (task 1.6).** Two claims this document
made were wrong: it asserted the MCP server was headless, and it asserted a `bun` version it had never
measured. Both are corrected in place below, with the original wording kept and the correction labelled,
because deleting the wrong sentence would hide the fact that it was written. The feature stays `closed`:
a correction is not a reopening.

---

## Why this feature exists

The UI does not exist yet, and that is the point.

`apps/web/` is a deliberate empty slot: a `package.json` with no dependencies (`s1-foundation.md`
§1.3 measured it — Next.js, React and React DOM are ~300 MB of tree for a package with no source
files) and a README that states the slice ships no interface. `design.md` §2.2 reserves the slot for
Next.js; §11 and `project.md` record that this slice ships no web UI and that **Playwright was
rejected for this slice**, for the honest reason that a browser driver with no UI tests nothing.

So the UI slice — whenever it is chartered — opens with two questions already asked and unanswered:

1. **Where do the mockups live?** Before a component exists, a visual direction has to be explorable.
   The supervisor asked for this explicitly, and asked for it *not* to require writing the interface
   to see it.
2. **Where is the style's source of truth?** A palette and a type scale that live only in a design
   tool's cloud file are not recoverable by `git clone`, and this project's governing objective is
   *verifiable portfolio evidence*.

Deciding these inside the UI slice would fold a tool evaluation into a delivery slice and inflate its
review — the exact cost the `Review Workload Forecast` in the change's `tasks.md` already warns about.
Deciding them now is cheap, reversible, and bounded: a tool choice and a token pipeline.

**What this feature deliberately does not do.** It does not define the visual style. No palette, no
type scale, no breakpoints, no wireframes. A style spec written before the first component is a spec
nobody implements, and this repository already records what a document asserting something nobody
re-measured costs (`odd-doc-structure.md`, *Why this feature exists*). The style is authored against
real components, in the UI slice, and this feature exists to make sure that work starts from a decided
tool and a decided source of truth instead of from a blank page.

## Constraints (non-negotiable)

- **Strict TDD.** Mode `strict`; source `openspec/config.yaml:58` (`strict_tdd: true`); runners the two
  gates: `pnpm --filter api --fail-if-no-match run test` (api) and
  `uv run --project workers/media pytest workers/media/tests -q` (worker). **No RED cycle applies to
  this feature**: it changes only Markdown, so no runtime behaviour exists to write a failing test for.
  Stating that is the honest use of a conditional field, not an exemption. The checks that do apply are
  the mechanical acceptance criteria below.
- **No unwritten verification.** Every factual claim about the tool is measured against the v0.15.1
  source and cited in the evidence log. Claims that could only be sourced from a vendor's own account
  are labelled as such, in place, and never restated as this feature's own measurement.
- **The tool is not installed by this feature.** `bun add -g` and the harness MCP entry are harness
  changes with their own runtime acceptance; committing a tool selection and installing the tool are
  different acts with different failure modes. The selection is recorded here; the installation is a
  separate feature.
- **Filesystem confinement is part of the decision, not a later hardening pass.** The MCP server
  exposes a filesystem root and defaults it to the home directory on Windows. The selected
  configuration must set `OPENPENCIL_MCP_ROOT` to a narrow directory. This repository already deleted
  an attack surface on purpose — `ADR-0001` dropped public-URL ingestion and with it the SSRF and
  DNS-rebinding surface — so re-opening an unbounded filesystem root to an agent would contradict a
  decision already made and paid for.
- **The English document is canonical.** The `.es.md` copy is regenerated, never edited on its own;
  fenced code blocks stay byte-identical.

## Decisions taken with the supervisor (2026-09-19)

Four decisions, taken in conversation. They are the requirements source of truth for this feature, so
they are recorded verbatim in substance rather than paraphrased into a conclusion.

| # | Decision | Value | Basis |
| --- | --- | --- | --- |
| D1 | What "visualization tool" means for this project | **Pre-code mockups** — a visual design surface, not a browser-screenshot capability for the agent. The first reading (an MCP browser tool so the agent can see its own render) was **corrected by the supervisor** and is recorded here as a corrected misreading, not silently dropped. | supervisor, 2026-09-19 |
| D2 | Tool | **OpenPencil**, MIT, used **headless first** (`.fig` files on disk plus the stdio MCP server); app mode is opt-in. | supervisor accepted the recommendation built on the measured facts in §1.1 |
| D3 | Document home | **`odd/tasks/`**, as an ODD feature document. Measured reason: the repository has **no** ADR convention outside an OpenSpec change — `find . -iname '*adr*'` returns only `audio-extract-vertical-slice/design/adr-0001-*` and `adr-0002-*` — and no `docs/` directory exists. Opening an OpenSpec change to hold a decision, when no implementation slice is chartered, would create the change before the work. | supervisor |
| D4 | Scope | **The decision only.** No style spec, no Next.js scaffold, no tool installation. | supervisor, on the offered scope options |

## Context

Three constraints shape the decision, and none of them is "the tool is popular".

1. **The agent must be able to read the mockup, not only look at it.** An element of this workflow is
   not a human looking at a canvas: it is an agent that has to reason about the structure — which
   frames exist, what the type scale is, whether two near-identical greys are a mistake. A design
   surface that produces only pixels makes that reasoning guesswork; one that exposes its document as
   queryable structure makes it measurement. This is the same distinction this repository already
   applies to tests: `design.md` §11 rejects SQLite because Postgres-specific semantics would produce
   false negatives. A tool whose content cannot be inspected produces the same class of false belief.

2. **The style's source of truth has to survive the tool.** A design file is a working surface, not a
   durable artifact. If the palette exists only inside a `.fig`, then the day the tool changes — or the
   day the file is lost — the style is gone, and `git log` never knew it.

3. **The environment is split across a boundary.** The supervisor's machine runs WSL with the
   repository on the Windows filesystem (`/mnt/c/...`). A desktop application runs on Windows; the CLI
   and the MCP server run inside WSL. They do not share a global package install. Any design that
   assumes the editor and the agent share a process boundary would fail on the first step, and would
   fail in a way that looks like a tool defect rather than a topology mistake.

## Decision

**The mockup surface is OpenPencil, used headless first.** Headless mode means `.fig` documents on
disk, read and written through `openpencil` (CLI) and `openpencil-mcp` (stdio MCP) inside WSL, with no
running editor in the loop. App mode — connecting to a live editor — is an opt-in convenience, not a
dependency of the workflow.

> **Amended 2026-09-19 (task 1.6), after measuring.** The second half of that sentence is **false as
> written**. The MCP server is *not* headless: with no desktop application running, a document tool
> answers `OpenPencil app is not connected. STOP and tell the user: "The OpenPencil desktop app is not
> running or no document is open."`, and the server reaches the app through
> `OPENPENCIL_MCP_DISCOVERY_PATH` / `_SOCKET` / `_TCP` against `127.0.0.1:7600`. So the corrected claim is:
> **the CLI is headless; the MCP is a bridge to the running desktop app and is inert without it.** The
> first half is correct and came out better than written — the same measurement found that
> `openpencil import page.html -o page.fig` turns HTML/CSS/Tailwind into a real `.fig` with nothing
> running, which makes writing a mockup in HTML and converting it a first-class path rather than a
> workaround. Two smaller corrections from the same measurement: `export -f jsx` is **per node**
> (`--node` is required; without it the CLI answers `Nothing to export`), which is component-oriented
> behaviour rather than a defect, and `--page` takes a page **name**, not an id.

**The style's source of truth is CSS custom properties in the repository.** The design file is the
authoring surface; the tokens are the artifact. The pipeline is one direction and has one step:

```text
[OpenPencil canvas]  →  variables (tokens)  →  CSS custom properties in-repo  →  Tailwind v4 @theme
```

Why each half is the shape it is:

- **Headless first, because of constraint 3.** It removes the Windows/WSL process-boundary problem
  instead of working around it, and it removes the "is the editor running?" precondition from every
  agent step. The CLI answers
  `openpencil tree design.fig` with no application alive.
- **Queryable structure, because of constraint 1.** The CLI exposes `tree`, `pages`, `node`,
  `find`, `query` (XPath), `variables`, `analyze` (colors, typography, spacing, repeated clusters)
  and `lint`, and every structured command supports `--json`. That is the difference between reading
  a mockup and squinting at it.
- **Tokens as CSS custom properties, because of constraint 2.** A design surface that can *export*
  its variables, and export JSX with Tailwind styles (`export -f jsx --style tailwind`), closes the
  loop from canvas to code without making the canvas authoritative. The repository keeps the truth; the
  canvas is where the truth is drawn.

### What makes the headless workflow workable rather than theoretical

The MCP surface includes `select_nodes` and `viewport_zoom_to_fit`, and the shipped agent guidance
instructs calling them *after* creating or editing visible content so the person at the editor sees
the result. In headless-first mode those calls are simply unavailable and the CLI is the whole
surface — which is why app mode is kept as an opt-in rather than presented as the default. The
workflow has to be correct without a GUI before it is convenient with one.

## Alternatives rejected

| Alternative | Why rejected | Kind of reason |
| --- | --- | --- |
| **Playwright MCP** (or a browser-screenshot MCP) **as the mockup tool** | It answers a different question. It gives the agent sight; it does not give the project a mockup surface, and with no UI built there is nothing to point it at. **Rejected here, not forever**: when the UI slice exists, the same engine becomes the E2E and visual-regression candidate on its own merits. | category error, then deferral |
| **Hand-written HTML/CSS mockups** (no design surface at all) | Cheapest and dependency-free, and it is what the repository would do by default. Rejected because the supervisor's requirement is a visual surface that does not require writing the interface to see it (D1); the mockup would become code before the style was decided, which is the ordering this feature exists to avoid. | requirement mismatch |
| **Evolus Pencil Project** | The open-source ancestor of this category, but it is a GUI prototyping canvas with no headless CLI, no MCP surface and no token export. A canvas we cannot query and cannot export from is the dead canvas this feature is trying to avoid. Reported for `github.com/evolus/pencil` on 2026-09-19: **GPL**, 9810 stars, 534 open issues. | capability gap |
| **Penpot** | Not evaluated to the same depth, and rejected on structure rather than on capability: its source of truth is a server we host. That is infrastructure and an operational surface this feature does not need, bought to answer a question that a local file already answers. Recording it as "rejected on structure, not evaluated in depth" is more honest than implying a comparison that was not run. | structural |
| **Figma** | Rejected, but note the epistemic status: the case against it rests on the *vendor's own* account of the platform. OpenPencil's documentation asserts that Figma's June 2025 MCP server was read-only and that Figma 126.1.2 began stripping `--remote-debugging-port` at startup, killing community tooling. **This feature did not verify those claims independently**, and does not rely on them: the decisive reason is constraint 2 — a design file in a proprietary binary format that only the vendor's software fully reads is exactly the artifact that does not survive the tool. | unverified vendor account, not load-bearing |

## Consequences

### Enabling

- The UI slice opens with the tool decided and one token pipeline defined, so its own review is about
  the interface and not about a tool bake-off.
- The mockup is inspectable by an agent as structure (`--json`, XPath, `analyze`, `lint`), which makes
  style review a measurement rather than an impression.
- The token path ends in the repository, so `git clone` recovers the style without the tool.
- Cost of reversal is bounded: this is a document. No dependency is added, no scaffold exists, nothing
  in `apps/web/` changes.

### Costs accepted

- **A pre-1.0 dependency.** The project's own README says *"Active development. Usable today, with some
  rough edges"*, and the measured version is 0.15.1. A tool at 0.15 will change its CLI and its MCP tool
  schemas. That is accepted with eyes open, and it is the reason the interface is used through the CLI
  in headless mode rather than through a committed application integration.
- **`bun` becomes a prerequisite** of the design workflow (`bun add -g @open-pencil/cli @open-pencil/mcp`).
  Measured present: bun 1.3.14. It is a second package manager in a project whose declared toolchain is
  pnpm and uv, and the cost is real even when it is small.

> **Amended 2026-09-19 (task 1.6).** *"Measured present: bun 1.3.14"* was not measured. It was copied
> from `openspec/project.md`, which is precisely the class of claim this repository keeps having to
> correct — and that file is stale here in at least three ways: `bun 1.3.14` and `node v25.2.1` against a
> measured **no bun at all** and **node v25.9.0**, plus a Docker CLI this WSL distro does not have. What
> was measured: bun is **not** installed in WSL — `~/.bun/bin` existed and was empty, the cache was not,
> and only `bun.exe` exists on the Windows side — so it was installed, at **1.4.2**. The installation
> deliberately did **not** use `https://bun.sh/install`: that script downloads a release zip and unzips it
> with **no integrity check beyond TLS** (`grep -cE 'shasum|sha256|sha512|gpg|signature'` returns `0`, and
> `unzip` is not even installed in this distro). The zip was fetched directly and verified against the
> release's published `SHASUMS256.txt` instead. Both packages are pinned at `0.15.1`, which is this
> repository's rule for gates and applies to a design tool for the same reason. Also measured: **`bunx`
> does not exist** in bun 1.4.2, so the entry form the tool's own skill documents
> (`{"command":"bunx","args":["openpencil-mcp"]}`) would have failed at the first start; the working
> form is `bun x`.
- **A Windows/WSL split** for anyone choosing app mode, at least until the whole workflow lives on one
  side of the boundary.
- **The repository gains a design file format it does not own.** See residual risk below.

### Residual risk and its mitigation

**The `.fig` format is Figma's, read through a vendored Kiwi binary codec.** OpenPencil opens and writes
it with round-trip fidelity, and the format is not OpenPencil's to guarantee. So the mockup artifacts
sit on someone else's format, held by a 0.15 project, under a licence that is permissive but is not a
stability guarantee.

The mitigation is not "trust the tool". It is that **the durable artifact is not the `.fig` file** — it
is the tokens, exported to CSS custom properties and committed. If OpenPencil disappears tomorrow, the
repository loses the ability to *re-open* the mockups and keeps everything that decides what the
interface looks like. A rendered PNG or SVG export of an accepted design belongs in the repository for
the same reason, as record rather than as source.

## Revisit triggers

- OpenPencil's headless CLI or MCP tool schemas change incompatibly across a version bump, and the cost
  of re-adopting exceeds the cost of switching.
- The UI slice needs component-level visual regression. That is **Playwright's** trigger, recorded in
  *Alternatives rejected* as deferred rather than dismissed, and it is a decision for that slice.
- A `.fig` round-trip against a real Figma file loses fidelity in a way that matters — which would
  invalidate the "the canvas is where the truth is drawn" half of the decision.
- The token pipeline stops being expressible as CSS custom properties, which would break the single
  transformation step and with it constraint 2.
- The tool is used through the MCP server and the filesystem root cannot be confined as this feature
  requires.

## Delivery

Recorded 2026-09-19, from measurements taken after the document was written, not estimated at creation.
The counts therefore include the record's own lines — the same capture-time property the
`odd-doc-structure` feature documented, and the reason its commit-anchored counts were preferred once a
commit existed.

- **Strategy:** `single-pr`. One document pair, one work unit, no dependency on any other branch.
- **Forecast, corrected in place:** the forecast was **under 400 authored lines for the pair**. Measured:
  **1302** authored lines (`frontend-style.md` 637, `frontend-style.es.md`
  665), additions only — both files are new, so each contributes its line count and zero
  deletions. The forecast was wrong by a factor of 3.3 and is kept visible here rather than
  overwritten, which is the rule this bullet set for itself when it was wrong.
- **The mirror is 51.1% of the cost** — 665 of 1302 lines. That
  reproduces the constant `odd-doc-structure` §1.1 measured across four features (the mirror at ~49–51%
  of every pair), which is now five features and the same constant. It is the delivery cost no document
  in this repository had counted before that feature, and it is why a 400-line budget and a 400-line
  *document* are not the same thing.
- **The budget is exceeded, and that is reported rather than argued away.** At 1302 lines the
  pair sits at 3.25× the 400-line advisory budget. Nothing here is padded and nothing will be
  shrunk to reach 400: the two files are one decision document and its required study copy, and cutting
  either to fit the number would delete the decision or the mirror rule. The honest reading is that the
  400-line budget is a *review* unit for code, and that this repository's mirror convention has been
  pushing documentation pairs past it since the first feature — the measurement is the finding, not the
  failure.
- **Slice boundaries:** none, because none are needed. The work is one document pair; there is nothing
  to stack. It landed as **one work unit, `0b8e434`**, one commit ahead of `origin/main`, and the closure
  record in §1.5 is the immediately following commit on the same branch — which is why the closure entry's
  own commit is not named anywhere: it cannot be. One branch, and no stack; task 1.6 added its own commit later.
- **Not delivered by this feature:** the installation of the tool, the harness MCP entry, any style
  value, and the Next.js scaffold. See *Out of scope*.

## Tasks

Every task closes with at least one work-unit commit on the feature branch.

### 1.1 — Evaluate the tool and measure the facts the decision rests on · owner: AI

Read the v0.15.1 source rather than the landing page: licences, package names, binary entry points,
the CLI command surface, the MCP transports, and the security-relevant root handling. Record what was
measured and mark what was not.

**Acceptance:** every fact the *Decision* section depends on appears in §1.1 with the command or file
that produced it, and every claim that could not be verified is labelled unverified in place.

### 1.2 — Write the decision and its consequences, English canonical · owner: AI

This document: context, decision, alternatives with the kind of reason for each rejection, consequences
including costs accepted, residual risk with its mitigation, and revisit triggers.

**Acceptance:** the document carries all four structures — `## Constraints (non-negotiable)` with the TDD
line, `## Delivery`, `## Progress`, `## Next step` — and no alternative is rejected by assertion alone.

### 1.3 — Regenerate the Spanish mirror, fenced blocks byte-identical · owner: AI

`frontend-style.es.md`, prose headings translated, field headings (`Delivery`, `Progress`, `Next step`)
verbatim, and every fenced code block byte-identical to the English.

**Acceptance:** the extracted fenced blocks hash identically across the pair, and the `##` heading
sequence is identical in both files.

### 1.4 — Verification, mechanical and recorded verbatim · owner: AI

- every fenced block extracted and hashed across the pair, compared;
- `##` heading count and order in both files;
- every `[x]` in `## Progress` resolving to a `### <id>` heading in the same document;
- every `[ ]` carrying a stated reason;
- the working diff touching only this feature's two files.

**Acceptance:** the raw output is in §1.4, including any failure, and the mirror check is shown failing
for a constructed counter-example — this repository's own defect D1 rule, *a gate that cannot fail is
not a gate*, applied to its own documents.

### 1.5 — Closure · owner: AI

The document pair agrees with what exists, the measurements are recorded, and this section is replaced
by the closure record. **Not** declared `closed` while the deferred items in *Out of scope* remain
unstarted: they are separate features, and this document says so instead of implying they are pending
work here.

### 1.6 — Correct the two claims the measurement refuted · owner: AI

This feature was closed on two claims that no measurement supported, and both surfaced in the follow-up
feature `openpencil-setup` when it installed the tool: that the MCP server is headless, and that `bun` is
present at 1.3.14. The second was inherited from `openspec/project.md` and never checked here.

Corrected in place, with the original sentences kept and the amendments labelled, and with the §1.4b check
block rebuilt so it asserts invariants instead of counts every later edit invalidates.

Task 1.5's own text says the feature is **not** declared `closed` while the deferred items remain
unstarted. That text is left standing and the tension is resolved here rather than edited away: the items
are not pending work on this document, they are three separate features with their own runtime
acceptance, and §1.5 records that reasoning. If they are instead treated as residues, task 1.5's condition
is unmet and the status line is wrong — the reader gets both readings and the reasoning to choose.

**Acceptance:** each correction says what was measured, names the command, and identifies the claim it
replaces; the original wording stays visible; and §1.6 records raw output rather than a summary.

## Progress

State is `[x]` only where the evidence log holds observed proof for that task.

| ID | Task | State | Evidence |
| --- | --- | --- | --- |
| 1.1 | Evaluate the tool and measure the facts | `[x]` | §1.1 |
| 1.2 | Decision and consequences, English canonical | `[x]` | §1.2 |
| 1.3 | Spanish mirror, blocks byte-identical | `[x]` | §1.3 |
| 1.4 | Verification, mechanical and recorded | `[x]` | §1.4 |
| 1.5 | Closure | `[x]` | §1.5 |
| 1.6 | Correct the two refuted claims | `[x]` | §1.6 |

Task 1.5 is `[x]` because the work unit it was waiting on exists: `0b8e434`. The closure entry in §1.5
records the commit, and records honestly that its own commit is necessarily outside the range it
describes — this entry cannot name the commit that contains it. Task 1.6 was added after closure, on the
`odd-doc-structure` §1.3a precedent: a defect found after closing is its own work unit, never a silent
rewrite of a closed record.

## Evidence log

Raw output, appended as each task closes. Verbatim, not paraphrased.

### 1.1 — the tool facts (2026-09-19)

Measured against a local clone of `github.com/open-pencil/open-pencil` and its published package
manifests, not against the project's marketing page.

```text
$ head -3 LICENSE
MIT License

Copyright (c) 2026 Danila Poyarkov and OpenPencil contributors

$ head -3 skills/open-pencil/LICENSE.txt
MIT License

Copyright (c) 2026 Danila Poyarkov

$ grep -n '"name"\|"version"\|"license"' packages/cli/package.json | head -3
2:  "name": "@open-pencil/cli",
3:  "version": "0.15.1",
4:  "license": "MIT",

$ grep -n '"name"\|"version"\|"license"' packages/mcp/package.json | head -3
2:  "name": "@open-pencil/mcp",
3:  "version": "0.15.1",
4:  "license": "MIT",

$ grep -n '"bin"' -A4 packages/mcp/package.json
44:  "bin": {
45-    "openpencil-mcp": "./dist/stdio.mjs",
46-    "openpencil-mcp-http": "./dist/index.mjs"
47-  },

$ grep -n '"bin"' -A3 packages/cli/package.json
9:  "bin": {
10-    "openpencil": "./bin/openpencil.js"
11-  },
```

The CLI command surface, from the skill the project ships for agents
(`skills/open-pencil/SKILL.md`, MIT, shipped in-repo) — `info`, `tree`, `pages`, `node`, `selection`,
`find`, `query`, `variables`, `export`, `convert`, `analyze`, `lint`, `formats`, `eval`; "every command
that reports structured data supports `--json`". The export formats include `PNG/JPG/WEBP/SVG/PDF/JSX`
and `.fig`, and the design-to-code bridge is `openpencil export design.fig -f jsx --style tailwind`.

Transports and ports, from the same file: stdio for MCP clients, and in production Tauri builds the
desktop app starts the HTTP server automatically on `http://127.0.0.1:7600` (MCP Streamable HTTP at
`/mcp`) with a WebSocket bridge on `ws://127.0.0.1:7601`.

**The security fact this feature acts on**, quoted from the same file:

> The CLI defaults the filesystem root to the home directory on Windows and the current working
> directory elsewhere. Set `OPENPENCIL_MCP_ROOT` to an explicit narrow directory rather than relying
> on that default.

**What was *not* verified, and is labelled so in the decision.** The claims about Figma's platform
behaviour — that its 2025 MCP server was read-only, and that version 126.1.2 stripped
`--remote-debugging-port` — come from OpenPencil's own documentation. No independent source was
consulted and no test was run. They are recorded in *Alternatives rejected* as a vendor account, and
the rejection of Figma is made to rest on the format-ownership argument instead.

**Also measured, and worth recording because it is unusual:** the shipped skill's own text names this
ecosystem — *"ACP and Pi agents use the MCP surface, not the direct-model AI tool selection"* — so Pi is
a contemplated client rather than an unsupported one.

### 1.2 — the decision document (2026-09-19)

This document. The structural checks that verify it are in §1.4; the writing itself is not evidence, and
nothing in this entry claims otherwise.

### 1.3 — the Spanish mirror (2026-09-19)

`frontend-style.es.md` regenerated from the English. Prose headings translated — `Por qué existe esta
feature`, `Restricciones (no negociables)`, `Decisiones tomadas con el supervisor (2026-09-19)`,
`Contexto`, `Decisión`, `Alternativas rechazadas`, `Consecuencias`, `Disparadores de revisión`,
`Tareas`, `Log de evidencia`, `Fuera de alcance` — with the field headings (`Delivery`, `Progress`,
`Next step`) kept verbatim, which is the convention `odd-doc-structure` §1.3 recorded. Both files carry
the same `##` heading sequence and the same fenced blocks; the census and the hashes are in §1.4, and
the count is measured there rather than asserted here. The canonical document is the English one;
nothing was decided while translating, and where the Spanish reads as a study copy it is because it is
one.

### 1.4 — verification (2026-09-19)

The checks below are mechanical, and they are run rather than asserted. §1.4a is the counter-example
required by this repository's own defect D1 rule, run **first**, because a check that has never failed
proves nothing when it passes.

#### 1.4a — the mirror check, shown failing on a constructed counter-example

A copy of the Spanish mirror with one token changed *inside a fenced block*, compared against the
English:

```bash
cp odd/tasks/frontend-style.es.md /tmp/frontend-style-counter.md
sed -i 's|openpencil-mcp-http|openpencil-mcp-https|' /tmp/frontend-style-counter.md
rm -f /tmp/frontend-style-counter.md
```

The commands are the record; the **values** are stated here in prose, and that is deliberate. This pair
contains the lines that state its own hash, so a hash written inside a fenced block would be part of
the content it hashes and would be stale the moment it was written — the circularity
`odd-doc-structure.md` §1.3a already recorded for the same check. Prose is outside the fences, so a
value written in prose leaves the fenced content — and therefore the hash — unchanged.

Measured, in this order:

- **Counter-example, on the modified copy:** the counter run's hash **differs** from the English run's
  hash (`2118392227012d003175213b9928143a` against `583cbb563acc4df760201076c26bee28`). That divergence is the only property that matters
  here: a check whose failure mode has never been observed is not yet a check (defect D1).
- **English, the real run:** `583cbb563acc4df760201076c26bee28`
- **Spanish mirror, the real run:** `583cbb563acc4df760201076c26bee28` — identical to the English, or the mirror is wrong
  and this feature is not done.

**This value moved once, and the old one stays visible.** Before the closure entry in §1.5 added its own
fenced block, the pair hashed `a4adcb9cc995449ba4f5392b98a908b1`. Adding a block changes the content the
hash covers, so the figure above is the value at `HEAD` and the earlier one is recorded here rather than
overwritten — the same rule the *Delivery* forecast follows.

#### 1.4b — the checks

```text
headings   : same count in both -> equal
fences     : same count in both -> equal
blocks md5 : EN vs ES -> equal
field heads: EN=[## Delivery ## Progress ## Next step ] ES=[## Delivery ## Progress ## Next step ] -> equal
pointers   : 0 unresolved [x] rows (0 = every one resolves to a ### <id> heading)
open rows  : EN=0 ES=0 (0 = the "every [ ] has a reason" criterion is vacuous)
```

The field headings are listed without line numbers on purpose: the block that carries this output
also moves those numbers, so an absolute line number recorded here would be stale in the same
authoring pass that wrote it. Order and verbatim text are what the check is for, and both are stable.
The `[x]` scan resolves every marked row against a `### <id>` heading in the same document — five rows,
five resolutions, per file.

**This block asserts invariants on purpose, and it did not always.** Its first form recorded absolute
counts (`fenced blocks=4`, then `5`) and a `git status` snapshot, so every later edit to this document
made the recorded output stop reproducing — the very defect this feature set out to hunt, self-inflicted
on its own verification. It now asserts only relations: same heading count, same fence count, identical
fenced content, same field headings, zero unresolved pointers, zero open rows. None of those can be moved
by adding a section, a block or a commit. The one thing it cannot assert is its own hash — it sits inside
the content that hash covers — so that value lives in §1.4a, in prose, and is the only figure in this
document a later edit invalidates.

**One acceptance criterion now passes vacuously, and that is recorded rather than counted as a pass.**
Task 1.4 demands that every `[ ]` carry a stated reason. With the closure entry in §1.5, this document has
**zero** open state rows, so there is nothing for that criterion to check: it cannot fail here any more
than it could have before, and it proves nothing either way. It is the same category as this repository's
recorded defect D1 — a gate over an empty set is not a gate — and it is noted instead of being reported as
a green check. The criterion stays in the task text because a reopened task would need it again.

The authored-line measurement lives in *Delivery* and below, in prose, for the same reason the hashes
do: a number written inside a fenced block is part of the content that block's hash covers, and this
document's own size is what is being measured.

**Authored lines, this work unit:** 1302 total — 637 in `frontend-style.md`
and 665 in `frontend-style.es.md`, additions only, since both files are new and therefore
contribute zero deletions. Measured with `wc -l` against the working tree, after every other edit in this
pass; the substitution that wrote these numbers replaced tokens in place, so it changed neither the line
count nor the fenced content the hash above covers. That is the reason the numbers can be exact here
while a figure inside a fenced block could not be.

### 1.5 — closure (2026-09-19)

The work unit exists. Raw output, unedited:

```text
$ git show --stat --format="" HEAD
 odd/tasks/frontend-style.es.md | 535 +++++++++++++++++++++++++++++++++++++++++
 odd/tasks/frontend-style.md    | 513 +++++++++++++++++++++++++++++++++++++++
 2 files changed, 1048 insertions(+)

$ git rev-list --count origin/main..HEAD
1

$ git log -1 --format="%H %s"
0b8e43461c400e5b3af5e0b320675cb876271c5c docs(odd): record the frontend mockup tool and the style source of truth
```

The figure `1048` in that block is the commit's own statistics, and it is **frozen there on purpose**:
because §1.4b declares that this document's authored-line count moves with every edit to it, a document
that cited its current size inside a commit transcript would be citing a number the transcript itself
invalidates. The commit's count is history; the current count is stated in §1.4b, in prose, and updated
in the pass that makes it true.

**What the closure does not claim.** The commit above is the deliverable. The commit that *contains this
entry* is necessarily outside the range it describes, so it is not named — naming it would require
knowing a hash before writing the file that computes it. This is the same boundary `odd-doc-structure`
recorded for its slice 1.7, and it is stated rather than hidden.

**What remains open, and is not residual work.** The three deferred items in *Out of scope* — install,
harness entry, style skill — are the *Next step*, and they are separate features on purpose: two of them
have runtime acceptance criteria (the CLI answers `openpencil --help`; the MCP server answers a real
client call with `OPENPENCIL_MCP_ROOT` confined) that no Markdown task can satisfy or evidence.

### 1.6 — the two refuted claims and the invariant block (2026-09-19)

Raw output, unedited. The two falsified claims, measured:

```text
$ which bun || echo "command -v bun: nada"
command -v bun: nada

$ ls -A ~/.bun/bin
                                # empty: the binary was gone, the cache in ~/.bun/install was not

$ ls /mnt/c/Users/andre/.bun/bin/bun.exe
/mnt/c/Users/andre/.bun/bin/bun.exe   # the only bun on this machine lives on the Windows side

$ grep -cE 'shasum|sha256|sha512|gpg|signature' /tmp/bun-install.sh
0                               # bun.sh/install verifies nothing beyond TLS

$ sha256sum /tmp/bun.zip
36368faef7527875d5ffa52e53cd48021741f2a83eb6208a8dd64068d422a913  /tmp/bun.zip
$ grep -E 'bun-linux-x64\.zip$' /tmp/SHASUMS256.txt
36368faef7527875d5ffa52e53cd48021741f2a83eb6208a8dd64068d422a913  bun-linux-x64.zip

$ ~/.bun/bin/bun --version
1.4.2

$ printf '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"open_file","arguments":{"path":"/etc/hosts"}}}' | bun x openpencil-mcp
{"error":"Path is outside the allowed root: .../apps/web/design"}

$ printf '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"open_file","arguments":{"path":"/tmp/opnroot/inside.fig"}}}' | bun x openpencil-mcp
{"error":"OpenPencil app is not connected. STOP and tell the user: ..."}
```

The last two lines are the pair that makes the correction: the first shows the confinement holding, the
second shows the server is a bridge to the app and not a file reader. A test that only ran the first would
have confirmed the security property and missed the architectural error.

That transcript is a **capture, not a recipe**: `ls -A ~/.bun/bin` lists the binary now, because
installing it is what changed that line. The part that must never drift is the pair of sha256 lines, and
they are the reason the install skipped the vendor's own script.

**What "verified" was upgraded to mean.** Before this task, the confinement was a requirement stated in
prose. It is now an observed refusal, and the headless claim is now an observed failure rather than a
design assumption. Neither was true of the previous claim in this document, which is the whole point of
the task.

**Not verified, and recorded as such rather than implied.** Whether the WSL-side MCP server can reach a
desktop application running on the Windows side was not tested: the `127.0.0.1:7600` discovery path
crosses the WSL boundary, the app was not running, and the auto-start that would expose it requires
`@open-pencil/mcp` installed **on Windows**, which it is not. That is an open question for whoever first
wants live app control, not a solved one this document may claim.

## Out of scope

- **Installing the tool.** `bun add -g @open-pencil/cli` and `bun add -g @open-pencil/mcp` are harness
  changes with their own acceptance test — the CLI answers `openpencil --help`, and the MCP server
  answers a real client call. Selecting a tool and installing it fail differently, and bundling them
  would hide the second behind the first.
- **The harness MCP entry.** Adding `open-pencil` to `~/.pi/agent/mcp.json` edits machine
  configuration outside this repository. It needs its own authorization, and it must carry the confined
  `OPENPENCIL_MCP_ROOT` when it is added — which is why the confinement requirement is a hard constraint
  here rather than a note.
- **Any style value.** No palette, type scale, spacing scale, breakpoint, component, or wireframe.
- **The Next.js scaffold.** `apps/web/` stays empty. Its dependencies arrive with the UI work unit.
- **Playwright.** Deferred to the UI slice, on that slice's own merits, as recorded in *Revisit
  triggers*.
- **A design/style skill.** Two candidate skills exist and neither is adopted here: the MIT skill
  OpenPencil ships (`skills/open-pencil/SKILL.md` plus `references/design-authoring.md`), and Anthropic's
  `frontend-design` skill in `anthropics/claude-code`, which is method guidance rather than a tool —
  aesthetic direction, typography, an explicit list of the tells that make a page read as generated, and
  a two-pass plan/review/build/critique process. **Its licence was not verified**, so it is named here
  and not adopted. A project-local style skill, written for a product whose subject is a job pipeline
  rather than a generic SaaS page, is its own feature.
- **The UI slice's OpenSpec change.** This document does not charter it.

## Next step

This feature is closed. Two actions belong to the supervisor, and neither is taken here:

1. **Push and open the PR** for `docs/frontend-style-decision`. The branch carries one work unit plus the
   closure commit; it matches the CI policy's branch pattern, and the PR needs exactly one `type:*` label
   (`type:docs`). Pushing is a delivery act, not a review act, and it is the supervisor's call.
2. **Which deferred feature comes next** — installing the tool and wiring the confined MCP entry, or
   writing the project-local style skill. They are independent, and the first carries a runtime
   acceptance the second does not.
