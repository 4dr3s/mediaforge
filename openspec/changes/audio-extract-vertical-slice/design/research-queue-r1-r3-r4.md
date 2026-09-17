# Research — queue behaviour R1, R3, R4

**Date:** 2026-09-16
**Change:** `audio-extract-vertical-slice`
**Purpose:** make the queue-mechanism decision in `ADR-0002` evidence-backed instead of
preference-based. `explore.md` §9 stated these questions were unanswered and that *"None of these
are answered here from memory."*
**Performed by:** the orchestrating parent. A delegated research child returned
`documentation: blocked; tools=[]` and `open-web: blocked; tools=[]` — the research capabilities are
not inherited by the child in this runtime — and correctly **refused to answer from memory**.

> **Headline:** the premise recorded in `project.md` — *"BullMQ is awkward to consume from Python,
> which motivates this direction"* — is **not supported by current vendor documentation**. BullMQ
> ships an **official Python library**, and the vendor states that Python and Node queues are
> **interoperable** because they share the same Lua scripts. See [R4](#r4--python-client-support-and-the-typescriptpython-pairing).

---

## R1 — Claim recovery under Redis Streams

**Finding.** Recovery of an un-acked pending entry is a first-class, documented mechanism, and the
official documentation states the single-claimer guarantee explicitly.

**Evidence** — Redis command reference (official documentation):

| Fact | Source |
| --- | --- |
| `XAUTOCLAIM key group consumer min-idle-time start [COUNT count] [JUSTID]`, **available since Redis Open Source 6.2.0** | *XAUTOCLAIM* — redis.io/docs/latest/commands/xautoclaim/ |
| *"claiming a message resets its idle time. This ensures that **only a single consumer can successfully claim a given pending message at a specific instant of time** and trivially reduces the probability of processing the same message multiple times."* | same page |
| `min-idle-time` is in **milliseconds**; the official example uses `3600000` (one hour) | same page |
| Claiming **increments the attempted-deliveries count**, *"unless the `JUSTID` option has been specified"*. *"Messages that cannot be processed for some reason — for example, because consumers systematically crash when processing them — will exhibit high attempted delivery counts that can be detected by monitoring."* | same page |
| Entries that no longer exist in the stream (trimmed or `XDEL`ed) are **not claimed and are removed from the PEL** — *"This feature was introduced in Redis 7.0."* | same page |
| `COUNT` defaults to 100, and the command scans at most `count × 10` PEL entries per call, so *"the number of entries claimed will be less than the specified value"* | same page |

**Additional finding not anticipated by R1's phrasing — `XNACK`.** Redis exposes
`XNACK key group <SILENT | FAIL | FATAL> IDS numids id … [RETRYCOUNT count] [FORCE]`, which lets a
consumer *"explicitly release pending messages back to the group's Pending Entries List (PEL)
without acknowledging them"*, making them *"immediately available for re-delivery to other
consumers, **eliminating the idle-timeout delay normally required for message recovery**"*. The
three modes adjust the delivery counter: `SILENT` decrements it, `FAIL` leaves it, and **`FATAL`
sets it to the maximum, marking the message permanently failed — documented as the mode for
*"invalid or suspected malicious messages"*.**

- **Version constraint:** `XNACK` is documented as **available since Redis Open Source 8.8.0**.
- **Deployment constraint:** its own compatibility table lists **❌ Redis Software** and
  **❌ Redis Cloud** — it is an open-source-Redis-only command.
- Source: *XNACK* — redis.io/docs/latest/commands/xnack/

**Confidence.** High for `XAUTOCLAIM` (primary command reference). High for the existence and
semantics of `XNACK`; **lower for its practical availability**, because a very recent command with
no Redis Software/Cloud support may be absent from the distributions a deployment uses. Not
verified: whether the Python client we would use exposes `XNACK` at all.

**Decision it settles.** A Python worker *can* own claim recovery with documented semantics under
Redis Streams: `XAUTOCLAIM` may be used as the recovery path, its single-claimer guarantee is
explicit, and its delivery counter gives a broker-level poison signal. Crucially, **the broker's
reclaim path does not replace the Postgres lease** — `XAUTOCLAIM` recovers a *message*, while the
job's `running` state and its lease are the database's business. The two must be reconciled, not
conflated.

---

## R3 — Native delayed retry

**Finding.** The answer differs sharply by mechanism, and it inverts the assumption that delay must
always live in Postgres.

| Mechanism | Native delay/backoff | Cost and caveats |
| --- | --- | --- |
| **Raw Redis Streams** | **No delay primitive was found** among the stream commands examined (`XADD`, `XREAD`, `XREADGROUP`, `XACK`, `XPENDING`, `XCLAIM`, `XAUTOCLAIM`, `XNACK`, `XDEL`, `XTRIM`). Delay must be implemented outside the broker | Retry scheduling would live in Postgres as `available_at`, or be re-implemented in application code |
| **BullMQ (over Redis)** | **Yes — `delayed jobs` and `job backoff` are listed as ported features of the official Python library** | Delay is a *library* feature built on Redis, not a Redis primitive; adopting it means adopting BullMQ's data model |
| **RabbitMQ** | Per-message delay historically via the `x-delayed-message` plugin | **That plugin is archived and is reported not to load on RabbitMQ 4.3+**, because it was built on Mnesia, *"which was completely removed from RabbitMQ in the 4.3.0 development cycle"*. The portable path is TTL + dead-letter exchange, which per secondary sources requires a separate queue per delay duration |

**Evidence.**

- BullMQ Python feature list, official repository README
  (`github.com/taskforcesh/bullmq/blob/master/python/README.md`) and `pypi.org/project/bullmq/`:
  *"Add jobs to queues — Regular jobs. **Delayed jobs.** Job deduplication. Job priority. Repeatable …
  Job retries. **Job backoff.** … Lock Manager (batched lock renewal)."*
- RabbitMQ: the text quoted above is attributed to the `rabbitmq/rabbitmq-delayed-message-exchange`
  repository. **Source quality caveat: this was read from a search-result attribution to that
  repository, not fetched from the page directly.** The secondary sources agree, but the claim
  deserves a direct fetch before it is cited in an ADR.
- The "no delay primitive in Redis Streams" statement is **absence of evidence, not a documented
  negative**: I fetched four stream command pages, not the complete command set. Treat it as a
  strong lead, not as proven.

> **Correction to an earlier statement in this session.** I told the project owner that choosing
> Redis means *"retry scheduling must live in `jobs.available_at` in Postgres, because Redis Streams
> has no native delayed retry."* That is true for **raw Redis Streams** and **false for BullMQ**,
> which provides delayed jobs and backoff in both its Node and Python libraries. Which of the two we
> pick decides this, so the statement was premature.

**Confidence.** High that BullMQ provides delayed jobs and backoff in Python (official repo + PyPI).
Medium on the RabbitMQ plugin's archival (secondary attribution). Low as proof of the negative for
raw Redis Streams.

**Decision it settles.** Whether retry scheduling lives in the broker or in a Postgres
`available_at` column. Precisely: **raw Streams → Postgres; BullMQ → the broker can hold it.**
Note it is partly moot for the first slice, where T8 is deferred and no retry occurs at all.

---

## R4 — Python client support and the TypeScript/Python pairing

**Finding — this is the consequential one.** BullMQ publishes an **official Python library**, and the
vendor states that **Python and Node queues are interoperable**.

**Evidence.**

| Fact | Source |
| --- | --- |
| *"This is the **official BullMQ Python library**. It is a close port of the NodeJS version of the library. **Python Queues are interoperable with NodeJS Queues, as both libraries use the same .lua scripts** that power all the functionality."* | `github.com/taskforcesh/bullmq` → `python/README.md` (Taskforce.sh Inc.), and the same text on `pypi.org/project/bullmq/` |
| Latest distribution observed: **`bullmq-3.2.2-py3-none-any.whl`, uploaded 2026-09-14** — two days before this research | `pypi.org/project/bullmq/` file metadata |
| *"In order to consume the jobs from the queue you need to use the `Worker` class, providing a 'processor' function"* | `docs.bullmq.io/python/introduction` (official docs) |
| Ported features include **workers, job events, job progress, job retries, job backoff, delayed jobs, job deduplication, Flow Producer, Lock Manager (batched lock renewal), global concurrency and rate limit, and per-job cancellation (cooperative `AbortController`)** | official Python README |
| Explicit limitation: *"Currently, the library does not support all the features available in the NodeJS version."* The README lists what **is** ported; which features are **missing** is not enumerated | official Python README |
| BullMQ markets first-class support across *"Node.js, Bun, Python, Rust, Elixir, and PHP"* | `bullmq.io` |

**What this refutes.** `project.md` records, under *Open decisions and assumptions*:

> *"Contract layer | Working direction: JSON versioned contract, zod on Node side, pydantic on Python
> side. **BullMQ is awkward to consume from Python, which motivates this direction.**"*

And the approved proposal names the same premise as the project's riskiest unknown:

> *"The **TS ↔ Python queue crossing** is the riskiest unknown | `project.md` already flags that
> BullMQ is awkward to consume from Python."*

**Neither statement is supported by current vendor documentation.** The TS↔Python crossing over
BullMQ is a *supported, documented, vendor-maintained* path, not an awkward one. The premise that
motivated a substantial part of the contract-layer direction does not survive contact with the
sources.

**Important caveats — the finding does not make BullMQ automatically correct.**

1. **The Python port is a documented subset.** *"does not support all the features available in the
   NodeJS version."* The README enumerates what is present, not what is absent, so the gap is
   unknown without further work.
2. **Interoperability is a vendor claim**, supported by the shared-Lua-scripts argument. It is
   vendor-primary, but it is still a claim to verify in practice with a real TS producer and Python
   consumer before it is relied on.
3. **Adopting BullMQ adopts its data model.** BullMQ already implements leases and lock renewal
   (`Lock Manager`, batched lock renewal) and its own job states. That overlaps with this project's
   `attempts` table, lease and fencing — so the interaction between *BullMQ's* reliability
   machinery and *ours* has to be reasoned about explicitly. Two idempotency systems in one pipeline
   is a real hazard, not a free win.
4. **BullMQ is TypeScript-first.** The Python library is a port, so the Python side tracks the Node
   side rather than leading it.
5. **BullMQ was not verified from `redis-py`'s side**: whether raw `redis-py` offers the consumer
   group, ack and claim API surface needed for a Streams design was **not** established here as
   directly as BullMQ's Python story was.

**Confidence.** High that the official Python library exists, is maintained (release two days
before this note), and is documented as interoperable with Node. High that the `project.md`
premise is unsupported. Medium on the practical sufficiency of the Python port for this project's
needs, because the missing-feature list is not published.

**Decision it settles.** **The BullMQ branch is viable, not excluded.** The reasoning that made
Redis Streams the only candidate — "BullMQ cannot be consumed from Python" — is void. The mechanism
choice must now be made on other grounds: overlap with our own lease/fencing machinery, the value of
BullMQ's delayed jobs and backoff, the risk of the ported subset, and deployment constraints such as
`XNACK`'s absence from Redis Cloud.

---

## What this research changes

| # | Artifact | What is now wrong or settled |
| --- | --- | --- |
| 1 | `project.md` — contract-layer rationale | The *"BullMQ is awkward to consume from Python"* premise is **unsupported**. It is the stated motivation for the contract-layer direction |
| 2 | `proposal.md` — Why table | Same premise, named as *"the riskiest unknown"*. The risk did not survive the evidence |
| 3 | `ADR-0002` (not yet written) | Can now choose between **BullMQ** and **raw Redis Streams** on real grounds, with the trade-off being *overlap with our own lease/fencing* versus *a library-level delayed retry we would otherwise build* |
| 4 | Earlier statement in this session | The claim *"choosing Redis means retry scheduling must live in Postgres `available_at`"* holds only for raw Streams |

## Open questions this research did not close

- Which features the BullMQ Python port **lacks** — not published; would need the changelog, the
  issue tracker, or a spike.
- Whether `redis-py` exposes consumer-group read, ack and claim (including `XAUTOCLAIM`) with a
  documented, current API. The official Redis docs do contain a *"Redis streaming with redis-py"*
  use-case page that uses `XREADGROUP`/`XACK` and recovers stuck deliveries with `XAUTOCLAIM`, which
  is strong official evidence — but the redis-py API reference itself was **not** fetched.
- Whether `XNACK` is exposed by any current Python client.
- The RabbitMQ plugin archival claim, which needs a direct fetch before an ADR cites it.
