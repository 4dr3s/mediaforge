# contracts/

The language-neutral contract shared by the TypeScript API and the Python worker
(`design.md` §2.2). Nothing here yet: this README only holds the directory, because git cannot
track an empty one.

Planned contents, in the order the work units need them:

| File | Contents | Work unit |
| --- | --- | --- |
| `job-types.json` | the job-type registry, treated as data rather than code | WU-3 |
| `dispatch-envelope.schema.json` | versioned JSON Schema for the dispatch envelope | WU-3 |
| `fixtures/` | golden envelopes and params parsed by **both** suites | WU-3, WU-8 |

The rule that makes this directory worth having: each runtime carries its own validator
(`zod` on the Node side, `pydantic` on the Python side), and a contract test makes both parse the
same fixture documents. The envelope carries its own version; the schema file is versioned by git.
