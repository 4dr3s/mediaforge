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
| `dispatch-envelope.schema.json` | JSON Schema for the dispatch envelope: `type` (`mediaforge.job.dispatch.v1`), `job_id`, `occurred_at` (RFC 3339, instant domain **years 0001–9999** via `pattern: "^(?!0000)"`), nothing else — `additionalProperties: false` |
| `job-types.json` | the job-type registry, treated as data rather than code; declares `audio.extract` (input arity 1, 200 MB input cap, `video/mp4` allowlist, output cap, wall-clock limit, lease TTL/grace, attempt budget) and its single optional `quality` parameter (`128k \| 192k \| 320k`) |
| `fixtures/envelopes/valid/` | envelopes that must parse on both sides (the canonical v1 document, a non-UTC offset, fractional seconds, and the two year boundaries `0001-01-01` and `9999-12-31`) |
| `fixtures/envelopes/invalid/` | envelopes that must be rejected on both sides (missing fields, wrong types, non-RFC-3339 `occurred_at`, unsupported version, fourth field, non-object, and the boundary cases: an impossible date, an invalid month, a non-leap February 29th, an offset outside RFC 3339 (`+24:00`), offset minutes outside the grammar (`+02:60`), and year `0000`) |
| `fixtures/params/valid/` | `audio.extract` params that must parse on both sides (`{}` and each enum value) |
| `fixtures/params/invalid/` | params that must be rejected on both sides (enum miss, non-string value, unknown key, non-object) |

Why the invalid fixtures exist even though the suites also reject inline values: a fixture is a
*both-sides* document, so a rejection the suites only wrote inline would still hide a parity
drift — the Python side accepting a document the TypeScript side rejects is exactly the failure
WU-3 exists to catch.

Both suites also read the schema file itself and assert its semantics — `type: object`,
`additionalProperties: false`, exactly the three properties with the two value fields typed as
strings, the version `const`, `format: date-time` and the year-domain `pattern` — so the file that
C3 calls the contract cannot drift while the parsers stay green.

The contract is broker-agnostic (C3): the last test in each suite scans the schema, the registry,
every fixture, and both validator modules (`apps/api/src/contracts/envelope.ts`,
`apps/api/src/contracts/job-params.ts`, `workers/media/src/mediaforge/contracts.py`) for the Redis
adapter's vocabulary — `xadd`, `xreadgroup`, `xack`, `xautoclaim`, `xgroup`, `xautoclave`, `group`,
`stream`, `delivery_count`, `redis` — and fails on any presence; a leak inside a string value counts
too. `consumer` is deliberately **not** on that list: it is the specification's own word for the two
runtimes, so banning it would outlaw the domain's vocabulary rather than the adapter's.