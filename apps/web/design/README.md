# `apps/web/design`

**Mockup surfaces, and the filesystem root the OpenPencil MCP server is confined to.**

This directory is the answer to one question: *how much of the filesystem does the design agent
get?* The OpenPencil MCP server is a filesystem-capable agent surface — `open_file`, `save_file` and
every export path resolve against a root, and on Windows that root **defaults to your home
directory** when it is not set. So it is set: `.mcp.json` at the repository root passes
`OPENPENCIL_MCP_ROOT=apps/web/design`, relative to the checkout, and this directory is that root.

That confinement is not a hardening pass bolted on afterwards. It is the same decision `ADR-0001`
already made and paid for when it dropped public-URL ingestion and with it the SSRF and
DNS-rebinding surface. A directory is the cheapest boundary available, and an agent that can only
name paths inside one cannot be talked into naming paths outside it.

Verified, not assumed — an `open_file` call targeting a path outside the root is refused:

```text
{"error":"Path is outside the allowed root: .../apps/web/design"}
```

## What belongs here

Design work in progress, in the format the tool authors it in:

| File | What it is |
| --- | --- |
| `*.fig` | OpenPencil documents. The **authoring surface**, not the source of truth — see below. |
| `*.png`, `*.svg` | Rendered exports of an accepted design. These are the record: they survive without the tool. |

## What does *not* belong here

**The style's source of truth.** That is CSS custom properties in the repository, fed from the
document's variables — not the `.fig` file. The reason is ownership: `.fig` is Figma's format, read
through a vendored Kiwi binary codec, held by a project at 0.15. If OpenPencil disappears tomorrow,
the repository should lose the ability to *re-open* a mockup and keep everything that decides what
the interface looks like. A `.fig` file is a working surface; the tokens are the artifact.

The pipeline is one direction, one step:

```text
[OpenPencil canvas]  →  variables (tokens)  →  CSS custom properties in-repo  →  Tailwind v4 @theme
```

## How work happens here

The tool is used **headless first**: `.fig` files on disk, read and written by the `openpencil`
CLI. No editor has to be running for the agent to read a mockup as structure — `info`, `tree`,
`query` (XPath), `variables`, `analyze`, `lint`, and every structured command answers `--json`. That
is the difference between reading a mockup and squinting at one.

Two modes do not work the same way, and the difference is worth knowing before either surprises
someone:

- **The CLI is genuinely headless.** HTML/CSS goes in, a `.fig` comes out, with nothing else
  running: `openpencil import page.html -o page.fig`, then `openpencil info page.fig`.
- **The MCP server is not.** It discovers and drives the *desktop application*; with no app
  running, its document tools answer `OpenPencil app is not connected`. It starts, it enforces the
  confinement above, and it is inert for documents until the app is up. Do not start the app on the
  agent's behalf — the server's own error text says so.

## Why this directory is not the "empty slot"

`apps/web/README.md` records that this workspace ships no user interface and no dependencies, and
that is still true: there is no Next.js here, no React, no `src/`, and nothing wired into the
pipeline. This directory holds design artifacts and a security boundary, both of which exist before
any component does. It is deliberate, and it is reversible by deleting one environment variable and
one directory.
