# Feature — `openpencil-setup` (install the design tool and confine the MCP server to one directory)

> **Reading copy in Spanish:** `openpencil-setup.es.md`. Code blocks are byte-identical to this file;
> if they diverge, the English is canonical. The Spanish copy is a study copy, regenerated, never
> edited on its own.

**Workflow:** Organic Driven Development (ODD).
**Requirements source of truth:** the open decisions in `odd/tasks/frontend-style.md` — *Out of scope*
named the installation as a separate feature with its own runtime acceptance, and *Next step* named it
as the supervisor's choice. This feature executes that, and the ADR's hard constraint on
`OPENPENCIL_MCP_ROOT` is an acceptance criterion here, not a note.
**Status:** `closed` — created and closed 2026-09-19 on `chore/openpencil-setup`, sitting one commit
above `73e6994`, the ADR correction it depends on. Six of the seven tasks are runtime-verified; task 1.5 is
deliberately open and says so. This document does not state its own commit hash: it cannot cite the commit
that contains it, the same boundary `frontend-style` §1.5 recorded.

---

## Why this feature exists

A decision document is not a tool. `frontend-style` chose OpenPencil and pinned the pipeline, and
recorded the installation as explicitly out of scope for one reason: **selecting a tool and installing
it fail differently.** The first fails as a judgement call; the second fails as a broken command, a
missing binary, a version that no longer matches the schemas the decision assumed, or — worst —
silently, when the tool works but the confinement it was chosen for does not hold.

That is why the security requirement is the deliverable here rather than a footnote. The OpenPencil
MCP server is a filesystem-capable agent surface, and **on Windows it defaults its root to the home
directory** when the root is not set. Wiring it without a confined root would have handed an agent
`~/`, in a repository that had already deleted the SSRF surface on purpose in `ADR-0001`. Two of this
feature's five tasks exist to make that specific claim measurable instead of asserted.

The second reason is the ADR's own honesty problem. `frontend-style` asserted that bun was present at
1.3.14 — a claim its author (this session) copied from `openspec/project.md` without measuring. It was
wrong, and the way it was wrong is instructive: `openspec/project.md` is stale in at least three
places, and a document that quotes a stale document inherits the staleness while looking verified.
Task 1.4 corrects that in the ADR, with the original wording kept.

## Constraints (non-negotiable)

- **Strict TDD.** Mode `strict`; source `openspec/config.yaml:58`. **No RED cycle applies to the
  repository files this feature changes** — they are Markdown and one JSON config, and no behaviour
  exists to write a failing test for. That partial exemption is stated precisely, because this feature
  is *not* free of runtime checks: the install and the confinement have real acceptance criteria below,
  and they were run before this document claimed anything.
- **Pinned versions.** `@open-pencil/cli` and `@open-pencil/mcp` are installed at `0.15.1`, which is
  the version the ADR's measurements describe. This repository pins its linters for the reason that *a
  gate whose tool drifts is a gate whose meaning drifts*; a design tool whose schemas are the
  interface deserves the same treatment.
- **No unverified integrity.** `https://bun.sh/install` was **not** used. See §1.2.
- **The confinement is an acceptance criterion, not documentation.** A tool call naming a path outside
  the root must be refused, and the refusal must be recorded. §1.3 shows both the refusal and a control
  inside the root — because a check that only ever passes proves nothing, which is this repository's
  defect D1.
- **Nothing is installed on the Windows side, and nothing is started on the user's behalf.** The
  desktop application is the user's to launch; the server's own error text says so explicitly.
- **The English document is canonical.** The `.es.md` copy is regenerated; fenced blocks byte-identical.

## Decisions taken with the supervisor (2026-09-19)

| # | Decision | Value | Basis |
| --- | --- | --- | --- |
| D1 | Toolchain | **Install bun in WSL**, then follow the ADR literally (`bun add -g`), rather than substituting npm or `npx` — even though npm was measured to work. | supervisor, on the offered options |
| D2 | Confined root | **`apps/web/design`** — repo-local, so mockups are versioned and therefore portfolio evidence, which `project.md` names as the governing objective. | supervisor |
| D3 | Scope | The install, the config and the repo files it needs. **Not** a style, not a scaffold, not a mockup. | inherited from `frontend-style` D4 |

## What was installed, measured

| Thing | Value | How it is known |
| --- | --- | --- |
| `bun` | **1.4.2** | `~/.bun/bin/bun --version` after a verified install |
| `@open-pencil/cli` | **0.15.1**, bin `openpencil` | `openpencil --version` |
| `@open-pencil/mcp` | **0.15.1**, bins `openpencil-mcp`, `openpencil-mcp-http` | `tools/list` handshake returns `serverInfo.version` |
| `core-js` postinstall | **blocked, deliberately** | `bun pm -g untrusted` names it; it is `require('./postinstall')`, a donation banner, so blocking costs nothing |

Three things about the machine were also measured, and each contradicts `openspec/project.md`:

| `project.md` says | Measured |
| --- | --- |
| `node v25.2.1` | **v25.9.0** |
| `bun 1.3.14` | **no bun at all** in WSL — `~/.bun/bin` existed and was empty; only `bun.exe` on the Windows side |
| Docker CLI 29.6.2, daemon running | **`docker` is not present** in this WSL distro |

## The configuration, and why it is committed

`.mcp.json` at the repository root, with a **relative** root:

```json
{
  "mcpServers": {
    "open-pencil": {
      "command": "openpencil-mcp",
      "env": {
        "OPENPENCIL_MCP_ROOT": "apps/web/design"
      },
      "lifecycle": "lazy"
    }
  }
}
```

Four deliberate choices, each measured rather than assumed:

1. **Relative, not absolute.** Measured: `OPENPENCIL_MCP_ROOT=opnroot` with cwd `/tmp` resolved to
   `/tmp/opnroot` and the confinement held. A relative root means the configuration is **identical in
   every worktree**, which is what makes committing it correct instead of merely convenient. An
   absolute path would have pinned a machine layout into a shared file, and this repository has two
   live worktrees today.
2. **Committed, not machine-global.** A committed file is reviewable, travels with the branch, and
   documents the confinement to whoever reads the diff. A `~/.pi/agent/mcp.json` entry documents it to
   nobody.
3. **No `bun` at launch — and this took two attempts.** The first shipped form was
   `{"command":"bun","args":["x","openpencil-mcp"]}`, chosen after measuring that **`bunx` does not
   exist** in bun 1.4.2 — OpenPencil's own agent skill documents `{"command":"bunx"}`, which would have
   failed at first start. That form was *still* wrong, for a reason this session did not find: **`bun` is
   not on the PATH of the process that launches Pi**, so the server would have failed to spawn with a
   `command not found` — an error that reads like a broken OpenPencil rather than a missing PATH entry.
   The shipped form is now `{"command":"openpencil-mcp"}`, which resolves through Pi's own bin directory
   (`~/.pi/agent/bin`, always first on PATH) because the package's `dist/stdio.mjs` carries a
   `#!/usr/bin/env node` shebang and `node` is on PATH. **Launch depends on node; only installation
   depends on bun** — the two were conflated until that cost a defect. Found by the peer session
   `01a0b75f-7ce3-728c-85b8-02b9f4d8ad5a`, not by this session's own acceptance: the acceptance tested the
   *server* and never tested that the *launcher* could find it.
4. **`lifecycle: lazy`.** The server is spawned on demand. Measured: it starts successfully even when
   the root does not exist and fails only at the tool call, so a checkout without `apps/web/design`
   cannot break a session by merely having the config.

**A bridge entry also exists in `~/.pi/agent/mcp.json`**, with an absolute root pointing at the main
worktree, because Pi resolves project configuration from the *session's* cwd — which for this session
is the main worktree, where this branch's `.mcp.json` does not exist yet. That entry is machine-scoped
by nature, so an absolute path is correct there and wrong in the committed file. **It should be removed
once this branch merges**, and task 1.5 records that: two sources for one server is a footgun, not
belt-and-braces.

## Delivery

- **Strategy:** `single-pr`. One work unit, one branch, stacked on `docs/frontend-style-decision`
  because this feature implements that ADR and cites it by file; the PR base is that branch, so a
  reviewer sees the install and not the decision document again.
- **Forecast:** the repository files are `985` authored lines across the document pair
  (`493` English, `492` Spanish) — the Spanish mirror is `49.9%` of the
  cost, which is this repository's measured constant for a fifth consecutive feature. The install
  itself contributes no repository lines; it changes the machine.
- **Slice boundaries:** none. There is one config file, one directory and one document pair.
- **Not delivered:** any style value, the Next.js scaffold, a mockup, and the style skill. See *Out of
  scope*.

## Tasks

### 1.1 — Install the toolchain, verified, and pin it · owner: AI

Install `bun` and the two packages at `0.15.1`, without accepting the vendor installer's integrity
model.

**Acceptance:** `bun --version`, `openpencil --version` and an MCP `tools/list` handshake all recorded
in §1.2, with the artifact hash that was verified before the binary was placed.

### 1.2 — Prove the CLI works headless, end to end · owner: AI

Not `--help`: a real document. HTML in, `.fig` out, read back, exported.

**Acceptance:** the produced `.fig` exists with a non-zero size, `info` and `tree` read it, and an
export produces a non-empty artifact — all with no application running.

### 1.3 — Prove the confinement, with a control · owner: AI

Two `open_file` calls through the MCP server: one outside the root, one inside it.

**Acceptance:** the outside call is refused by name, **and** the inside call behaves differently. A test
that cannot distinguish the two is not a confinement test.

### 1.4 — Correct the ADR the measurement refuted · owner: AI

`frontend-style` claimed the MCP was headless and that bun was present at 1.3.14. Both are wrong. The
correction lands on that branch as its own work unit, on the `odd-doc-structure` §1.3a precedent.

**Acceptance:** the ADR carries the corrections with its original wording preserved and labelled; the
wrong claims remain readable; and the ADR's own check block no longer goes stale on every edit.

### 1.5 — Record what was *not* verified · owner: AI

The honest half. Three things are left open and are written down rather than implied: whether the
WSL-side server can reach a Windows-side app; whether the auto-start HTTP surface is reachable across
that boundary; and the fact that this session still sees the server as absent because Pi reads MCP
configuration at startup.

**Acceptance:** §1.5 names each open question, what would settle it, and what is claimed in the
meantime. **This task is `[ ]`** — it is an open question by construction, not an unfinished task, and
marking it `[x]` would assert a verification that does not exist.

### 1.6 — Verify this document pair mechanically · owner: AI

Mechanical, and recorded raw: the pair's fenced blocks byte-identical, the two files agreeing on heading
count, fence count and field headings, every `[x]` resolving to a heading in its own file. The mirror
check is shown failing on a constructed counter-example first, because this repository's defect D1 rule
applies to its own documents.

**Acceptance:** the raw output is in §1.6, the counter-example diverges, and the one open row is named
rather than counted.

### 1.7 — Correct the launcher the acceptance never tested · owner: AI

The first shipped `.mcp.json` started the server with `{"command":"bun"}`, and `bun` is not on the PATH
of the process that launches Pi. Every acceptance run above invoked the server *directly*, from a shell
that had `~/.bun/bin` exported — so the one thing never exercised was the launcher itself. A dead server
would have looked like a broken OpenPencil.

Found by the peer session `01a0b75f-7ce3-728c-85b8-02b9f4d8ad5a`, which measured `command -v bun` as empty
inside the Pi environment and said so unprompted. This is the second defect in this feature that a peer
caught and its own acceptance did not.

**Acceptance:** the config's `command` resolves from Pi's own environment with no profile edit and no manual
export; the handshake and the confinement both still hold through that path; and the correction is recorded
as its own work unit rather than silently rewritten over the wrong one.

## Progress

| ID | Task | State | Evidence |
| --- | --- | --- | --- |
| 1.1 | Install the toolchain, verified and pinned | `[x]` | §1.1, §1.2 |
| 1.2 | CLI works headless, end to end | `[x]` | §1.2 |
| 1.3 | Confinement proven, with a control | `[x]` | §1.3 |
| 1.4 | ADR corrected | `[x]` | §1.4 |
| 1.5 | What was not verified | `[ ]` | §1.5 |
| 1.6 | Verify this document pair mechanically | `[x]` | §1.6 |
| 1.7 | Correct the launcher the acceptance never tested | `[x]` | §1.7 |

Task 1.5 is `[ ]` with its reason stated, and this is the honest reading of the repository's own rule
that a `[x]` needs observed proof: the three items in §1.5 are things nobody observed, including this
feature. An open row that says so is worth more than a closed row that lies.

## Evidence log

Raw output, unedited.

### 1.1 — the toolchain (2026-09-19)

```text
$ which bun || echo "command -v bun: nada"
command -v bun: nada
$ ls -A ~/.bun/bin
                                # empty: a previous bun install left ~/.bun/install and no binary
$ unzip -v >/dev/null 2>&1 || echo "unzip: no instalado"
unzip: no instalado

$ sha256sum /tmp/bun.zip
36368faef7527875d5ffa52e53cd48021741f2a83eb6208a8dd64068d422a913  /tmp/bun.zip
$ grep -E 'bun-linux-x64\.zip$' /tmp/SHASUMS256.txt
36368faef7527875d5ffa52e53cd48021741f2a83eb6208a8dd64068d422a913  bun-linux-x64.zip
$ ~/.bun/bin/bun --version
1.4.2

$ bun add -g @open-pencil/cli@0.15.1 @open-pencil/mcp@0.15.1
installed @open-pencil/mcp@0.15.1 with binaries:
 - openpencil-mcp
 - openpencil-mcp-http
128 packages installed [2.98s]
Blocked 1 postinstall. Run `bun pm -g untrusted` for details.
$ openpencil --version
0.15.1
```

**The install was not `curl https://bun.sh/install | bash`, and that is a finding rather than a
preference.** The script was downloaded and read first: `grep -cE 'shasum|sha256|sha512|gpg|signature'`
returns **0**. It fetches a release zip over TLS and unzips it. TLS to GitHub is a reasonable trust
anchor and the vendor's model is not unreasonable — but this repository's adjacent decisions are
explicit about integrity, so the zip was fetched directly and checked against the release's published
`SHASUMS256.txt`, whose hash matches. A GPG signature exists upstream (`SHASUMS256.txt.asc`, and `gpg`
is installed), and it was **not** verified: doing so would require importing the signing key from a
keyserver, which trades a TLS anchor for a trust-on-first-use one. That is recorded as a judgement, not
as a gap pretending to be coverage.

`unzip` is absent from this distro, so extraction used Python's `zipfile` — visible above as the reason
no `unzip` invocation appears.

### 1.2 — headless, end to end (2026-09-19)

Nothing was running: no desktop application, no editor, no display.

```text
$ openpencil import /tmp/hero.html -o /tmp/opnroot/hero.fig
    input: /tmp/hero.html
    output: /tmp/opnroot/hero.fig
    format: fig
    pages: 1
    rootElements: 1
$ ls -l /tmp/opnroot/hero.fig
-rw-r--r-- 1 yorsh yorsh 29461 /tmp/opnroot/hero.fig

$ openpencil info /tmp/opnroot/hero.fig
  1 pages, 3 nodes
DOM/CSS  █ 3nodes
1 FRAME, 2 TEXT
Fonts: Inter

$ openpencil tree /tmp/opnroot/hero.fig
[0] [page] "DOM/CSS" (0:3)
  [0] [frame] "div" (0:4)
    [0] [text] "MediaForge" (0:5)
    [1] [text] "Job pipeline status" (0:6)

$ openpencil export /tmp/opnroot/hero.fig -o /tmp/hero.png
✓ Exported /tmp/hero.png (4.1 KB)

$ openpencil export /tmp/opnroot/hero.fig -f jsx --node 0:4 --style tailwind -o /tmp/frame.tsx
<div data-name="div" className="w-[375px] h-50 bg-[#0B1F2A]">
  <p data-name="MediaForge" className="w-20 h-5 text-7 text-[#F2F5F7]">MediaForge</p>
  <p data-name="Job pipeline status" className="w-38 h-5 text-sm text-[#F2F5F7]">Job pipeline status</p>
</div>
```

**This is the result that changed the ADR.** The pipeline the decision document described as a chain of
exports is also an **input**: HTML/CSS/Tailwind goes in and a `.fig` comes out, with nothing running.
Writing a mockup in HTML and importing it is therefore a first-class path, not a workaround, and the
CLI reads the result as structure — `tree` gives node ids, `query` gives XPath, `variables` gives
tokens.

Two behaviours recorded here so nobody rediscovers them as bugs: `export -f jsx` requires `--node`
(without it: `ERROR Nothing to export`) because JSX output is component-oriented, and `--page` takes a
page **name** — `--page 0:3` answers `Page "0:3" not found. Available pages: "DOM/CSS"`.

### 1.3 — the confinement, with its control (2026-09-19)

Two calls to the same tool, differing only in whether the path is inside the root:

```text
$ OPENPENCIL_MCP_ROOT=/tmp/opnroot   # absolute form, same root for both calls
$ open_file {"path":"/etc/hosts"}                    # outside the root
{"error":"Path is outside the allowed root: /tmp/opnroot"}

$ OPENPENCIL_MCP_ROOT=/tmp/opnroot
$ open_file {"path":"inside.fig"}                     # inside the root
{"error":"OpenPencil app is not connected. STOP and tell the user: ..."}
```

The two answers are different, and that difference is the check. Outside the root: refused **by name**,
with the canonical root in the message. Inside the root: accepted as a path and refused for a completely
different reason — there is no application to talk to. The second answer is also the evidence for the
ADR correction, which is why one experiment settled two questions.

The relative form was measured separately, because the committed configuration depends on it:

```text
$ cd /tmp && OPENPENCIL_MCP_ROOT=opnroot   # relative
$ open_file {"path":"/etc/hosts"}
{"error":"Path is outside the allowed root: /tmp/opnroot"}    # canonicalised against cwd, still refused
```

### 1.4 — the ADR correction (2026-09-19)

Landed on `docs/frontend-style-decision` as `73e6994`, one commit, two files. It corrects the two claims
this feature's run refuted, rebuilds the ADR's check block so it asserts invariants instead of counts
that every later edit invalidates, and leaves the original sentences standing with the amendments
labelled. The ADR's own §1.6 records the raw output; this entry records where the correction went rather
than repeating it.

### 1.5 — what was *not* verified (open)

Three open questions, stated so that nobody reads this feature as broader than it is:

1. **Can the WSL-side MCP server reach a Windows-side desktop application?** The server discovers the
   app at `127.0.0.1:7600` (and via `OPENPENCIL_MCP_DISCOVERY_PATH` / `_SOCKET` / `_TCP`). Whether that
   resolves across the WSL boundary was not tested: the app was not running, and starting it is the
   user's call. **Not claimed.**
2. **Is the app's auto-started HTTP MCP surface reachable from here?** The documentation says a
   production Tauri build starts `openpencil-mcp-http` on `127.0.0.1:7600` when `@open-pencil/mcp` is
   installed globally — **on Windows**, where it is not installed. So the auto-start is not in play on
   either side. **Not claimed.**
3. **Is the live server visible to Pi in this session?** Measured, and the answer is **no**: `mcp({})`
   still reports `0/1 servers`. Pi resolves MCP configuration at startup, so both the committed
   `.mcp.json` and the machine bridge entry need a reload. What *is* verified is the server itself:
   handshake, confinement, and the ten `OPENPENCIL_MCP_*` variables it honours.

**What would settle 1 and 2:** starting the desktop application on the Windows side and calling a
document tool through the MCP gateway. Until then the honest statement is that the CLI is verified
end-to-end and the MCP is verified as far as the app boundary and no further.

### 1.6 — the pair's mechanical check (2026-09-19)

The counter-example runs first, on a copy with one token changed inside a fenced block, so the
comparison is shown capable of failing before any pass of it is worth anything. The command is indented
rather than fenced **on purpose**: a command inside a fenced block sits in the content it is about to
modify, so a `sed` naming its own target rewrites the description of the test and diverges for a
degenerate reason. Indented, it stays outside the extracted content and the divergence is real:

    cp odd/tasks/openpencil-setup.es.md /tmp/counter.md
    sed -i 's|OPENPENCIL_MCP_ROOT|OPENPENCIL_MCP_ROOTS|' /tmp/counter.md
    rm -f /tmp/counter.md

Measured: the counter run's fenced-block hash **differs** from the English one, as required. The real
then run reports:

```text
headings   : same count in both -> equal
fences     : same count in both -> equal
blocks md5 : EN vs ES -> equal
field heads: EN=[## Delivery ## Progress ## Next step ] ES=[## Delivery ## Progress ## Next step ] -> equal
pointers   : 0 unresolved [x] rows (0 = every [x] resolves to an evidence entry in the evidence log, not to a task header)
open rows  : EN=1 ES=1 (0 = the "every [ ] has a reason" criterion is vacuous)
```

**This check could not fail, and a peer session's report is why it now can.** The resolver originally
matched `### <id>` anywhere in the file — and every task id appears twice, once as a task header under
`## Tasks` and once as an evidence entry under the evidence log — so it matched the *header* and would
have passed with the evidence entry deleted. Demonstrated, not inferred: a copy of this document with
§1.1's 40-line evidence entry removed still reported `0 unresolved`. The resolver is now bounded to the
evidence section, and that same tampered copy reports `UNRESOLVED §1.1`, so the check has been shown able
to fail — the standard `odd-doc-structure` §1.6 set for a check of this kind. The peer found the same
ambiguity in its own document; this instance was worse, because the weak check was the thing certifying
the evidence pointers themselves.

The one open row is task 1.5, and it carries a stated reason — so **the `[ ]` criterion is not vacuous
here**, which distinguishes this pair from `frontend-style`, where closing every task left that criterion
with nothing to check and it was recorded as vacuous rather than green. The hash values themselves are
stated in prose in §1.4 of the other document's convention, not here: this block sits inside the content
it hashes. Measured: the pair hashes `da229800c5c888b3a81c2a2e918fadc0` on both sides, and the counter-example run hashes
`1d3d21fc2180c6e2102e11b034633089` — different, so the comparison can fail.

**A gap this feature leaves, stated rather than implied.** The check above is a *transcript*. The script
that produced it lives in `/tmp` and is not in the repository, so re-running it means re-deriving the
commands from this block. That is weaker than it looks: a check nobody can re-run is a check nobody will
re-run, which is the failure this repository already recorded as defect D1 in another form. Committing the
script — or wiring these assertions into the existing CI `lint` job — belongs to whoever next touches these
two document pairs, and it is named here so it is not rediscovered as a surprise.

### 1.7 — the launcher defect, corrected (2026-09-19)

The measurement that refuted the shipped config, and the fix, raw:

```text
$ command -v bun
                                # empty: ~/.bun/bin is NOT on the PATH Pi passes to its children
$ echo "$PATH" | tr ':' '\n' | head -3
/home/yorsh/.pi/agent/bin
/home/yorsh/.local/bin
/home/yorsh/.nvm/versions/node/v25.9.0/bin

$ head -1 ~/.bun/install/global/node_modules/@open-pencil/mcp/dist/stdio.mjs
#!/usr/bin/env node

$ ln -sf ~/.bun/bin/openpencil-mcp ~/.pi/agent/bin/openpencil-mcp
$ command -v openpencil-mcp
/home/yorsh/.pi/agent/bin/openpencil-mcp
$ printf '{...initialize...}' | openpencil-mcp
{"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"open-pencil","version":"0.15.1"}},"jsonrpc":"2.0","id":1}
$ open_file {"path":"/etc/hosts"}
{"error":"Path is outside the allowed root: /tmp/opnroot"}
```

Three symlinks were installed in `~/.pi/agent/bin` (`openpencil`, `openpencil-mcp`, `openpencil-mcp-http`) —
a machine change, outside the repository, and reversible by deleting them. Pi's own bin directory is used
deliberately because it is already first on PATH for every Pi process, so the committed configuration needs
no profile edit on any machine that has the packages installed.

**How this fix fails, measured rather than assumed.** The three symlinks are two hops deep —
`~/.pi/agent/bin/openpencil-mcp` → `~/.bun/bin/openpencil-mcp` →
`~/.bun/install/global/node_modules/@open-pencil/mcp/dist/stdio.mjs` — so they depend on the global bun
install surviving. Verified today: three links, none dangling (`find ~/.pi/agent/bin -xtype l` is empty).
If `~/.bun` is ever cleaned, the failure mode *changes* rather than disappears: a missing command answers
`command not found`, while a dangling link answers `No such file or directory`. Same cause, different
symptom, and the second one points at a file instead of at a PATH — worth recognising before debugging it.
The peer session that reported it found it while checking how its own backups recorded symlinks, and
measured that `find -type f` sees **1 of the 4 entries** in that directory: a snapshot taken that way can
omit the symlinks entirely and still report success.

**What the two defects have in common, which is the actual lesson.** §1.3 tested the server by invoking it
directly; §1.7 is the same server failing at a layer nobody invoked. Every check in this document was a
*supported* check — it configured the environment for the thing under test. A configuration whose value is
"it works when I set the environment up myself" is not verified; it is verified-minus-the-part-that-breaks.
The `lifecycle: lazy` setting hid this further: a lazily spawned server that cannot spawn produces no error
at session start, only silence until someone calls a tool.

## Out of scope

- **Any style value.** No palette, type scale, spacing scale, breakpoint, component or mockup. This
  feature installs a surface, not a design.
- **The Next.js scaffold.** `apps/web` still has no dependencies and no `src/`.
- **Installing anything on the Windows side.** Not needed for the headless path, which is the path the
  ADR chose; it would be needed for live app control, which is a decision nobody has taken.
- **Verifying bun's GPG signature.** Recorded in §1.1 with the reason rather than silently skipped.
- **The project-local style skill.** Still its own feature, per `frontend-style` *Out of scope*.

## Next step

The tool is installed and the CLI path is verified. Three actions belong to the supervisor:

1. **Reload the session** to pick up the MCP configuration, then start the OpenPencil desktop
   application on Windows if live app control is wanted — which is what would settle §1.5's first two
   questions.
2. **Remove the bridge entry** from `~/.pi/agent/mcp.json` once `chore/openpencil-setup` merges, so the
   committed `.mcp.json` is the single source.
3. **Decide the next feature** — the project-local style skill, or the first mockup, which is now
   possible with `openpencil import` and needs no further tooling.
