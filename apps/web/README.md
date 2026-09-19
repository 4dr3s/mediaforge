# apps/web

**No user interface, by design — and one directory that is not a UI.**

`design.md` §2.2 reserves this slot for a Next.js application, and §11 states that the slice
ships no web UI: every acceptance check runs over HTTP calls and the worker, and Playwright was
explicitly rejected.

Three deliberate omissions, all reversible:

- **No dependencies.** Next.js, React and React DOM would add roughly 300 MB of dependency tree
  for a package with no source files. They arrive with the UI work unit, not before it.
- **No `src/`.** Git cannot track an empty directory, so this `package.json` exists only to hold
  the workspace slot open. `pnpm install` resolves it and nothing else happens.
- **No components.** `design/` is not the UI: it holds mockup surfaces and doubles as the filesystem
  root the OpenPencil MCP server is confined to. It exists before any component does, because a
  security boundary is not a user interface; `design/README.md` records why.

If you are reading this because `apps/web` looks broken: it is not. Nothing here is wired into
the pipeline yet.
