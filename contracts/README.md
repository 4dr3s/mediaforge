# contracts/

The language-neutral contract shared by the TypeScript API and the Python worker
(`design.md` §2.2). The rule that makes this directory worth having: each runtime carries its
own validator (`zod` on the Node side, `pydantic` on the Python side), and the parity suites —
`apps/api/test/contract.parity.spec.ts` and `workers/media/tests/test_contract_parity.py` —
make both parse the same fixture documents. The envelope carries its own version; the schema
file is versioned by git.

## Contents (shipped in WU-3)

| File | Contents |
| --- | --- |
| `dispatch-envelope.schema.json` | JSON Schema for the dispatch envelope: `type` (`mediaforge.job.dispatch.v1`), `job_id`, `occurred_at` (RFC 3339), nothing else — `additionalProperties: false` |
| `job-types.json` | the job-type registry, treated as data rather than code; declares `audio.extract` (input arity 1, 200 MB input cap, `video/mp4` allowlist, output cap, wall-clock limit, lease TTL/grace, attempt budget) and its single optional `quality` parameter (`128k \| 192k \| 320k`) |
| `fixtures/envelopes/valid/` | envelopes that must parse on both sides (the canonical v1 document, a non-UTC offset, fractional seconds) |
| `fixtures/envelopes/invalid/` | envelopes that must be rejected on both sides (missing fields, wrong types, non-RFC-3339 `occurred_at`, unsupported version, fourth field, non-object) |
| `fixtures/params/valid/` | `audio.extract` params that must parse on both sides (`{}` and each enum value) |
| `fixtures/params/invalid/` | params that must be rejected on both sides (enum miss, non-string value, unknown key, non-object) |

Why the invalid fixtures exist even though the suites also reject inline values: a fixture is a
*both-sides* document, so a rejection the suites only wrote inline would still hide a parity
drift — the Python side accepting a document the TypeScript side rejects is exactly the failure
WU-3 exists to catch.

The contract is broker-agnostic (C3): the last test in each suite scans the schema, the registry
and every fixture for a fixed list of adapter-vocabulary tokens (the matching commands and terms
the broker adapter uses) and fails on any presence — a leak inside a string value counts too.