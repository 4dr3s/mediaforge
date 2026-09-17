# MediaForge — Project Context

MediaForge is an asynchronous file-processing platform: a client uploads a file — or, later,
pastes a public URL — a worker processes it, and the result is a downloadable artifact.
The project's real subject is the **job pipeline** — queue, retries, idempotency,
progress reporting, storage lifecycle, and resource limits — not the media
libraries themselves.

## Quick path

1. Read the product and stack sections below.
2. Confirm the open decisions (test runner) before sdd-explore.
3. Proceed to `sdd-explore` to define bounded contexts and the first change.

## Product

| Area | Decision |
| ------ | ---------- |
| Input | Uploaded file (v0.1). Public URL ingestion is **deferred** — see ADR-0001 |
| Processing | Asynchronous worker |
| Output | Downloadable artifact |
| Subject | Job pipeline, not media libraries |
| Objective | Verifiable portfolio evidence, not revenue |
| "Billable" | Future consequence; never a design criterion |

### v0.1 job types

| Job type | Description |
| ---------- | ------------- |
| `audio.extract` | Video to mp3 via ffmpeg |
| `pdf.merge` | Merge multiple PDFs |
| `pdf.split` | Split a PDF |

## Ownership model

| Area | Owner |
| ------ | ------- |
| Core implementation (pipeline, state machine, idempotency, storage) | User — must be able to defend the code in an interview |
| Architecture artifacts, ADRs, threat model, test strategy, verification | Agents |
| Toil (Dockerfiles, CI, scaffolding, fixtures) | Delegated to subagents |

## Planned stack (decided, not yet scaffolded)

| Component | Stack |
| ----------- | ------- |
| `apps/api` | NestJS + TypeScript |
| `apps/web` | Next.js + TypeScript |
| `workers/media` | Python 3.11+ managed with `uv` |
| Database | PostgreSQL (planned) |
| Storage (v0.1) | Local filesystem behind a storage port. S3 and a CDN become adapters later, not rewrites — ADR-0001 |
| Message queue | **DECIDED** — Redis Streams with consumer groups (`XACK`, `XAUTOCLAIM` for claim recovery) behind a queue port — ADR-0002 |

## Open decisions and assumptions

| Topic | Status |
| ------- | -------- |
| Message queue mechanism | **DECIDED** — **Redis Streams with consumer groups**, behind a queue port. Broker family chosen by the project owner; mechanism decided by ADR-0002 after research R1/R3/R4. Residual: confirm the Python client's `XREADGROUP`/`XACK`/`XAUTOCLAIM` API surface by spike before implementation. **Superseded premise:** the earlier note that *"BullMQ is awkward to consume from Python"* is **not supported** — BullMQ publishes an official Python library and documents Python/Node queues as interoperable. ADR-0002 rejects BullMQ on different grounds entirely |
| Public URL ingestion | **DEFERRED** out of v0.1 (ADR-0001). v0.1 accepts uploaded files only. Removes the SSRF / DNS-rebinding surface and takes R8 off the critical path |
| Storage port, upload transport, delivery path | DECIDED — `openspec/changes/audio-extract-vertical-slice/design/adr-0001-ingestion-storage-port-delivery.md` |
| User accounts | **NONE** in v0.1. Authorization is a capability: unguessable `job_id` + a creator token (AV1) |
| Job inputs | **PLURAL** from day one (`job_inputs` table); per-type arity is a job-type registry value (AV6) |
| Artifact retention | **Bounded, 7 days** (AV4). Policy declared in v0.1; the sweep ships with the hardening slice |
| Contract layer | Working direction: **versioned JSON contract, zod on the Node side, pydantic on the Python side.** The motivation is that **two languages must agree on one message and job shape** — not, as an earlier note claimed, that BullMQ is awkward from Python. That claim is refuted; the direction stands on the cross-language contract itself |
| Test runner | `unresolved-pending-design` — none installed or chosen yet. |
| Multi-product monorepo | Explicit non-goal for now. Extracting a shared platform later, with two real consumers, is the intended evidence of architectural judgement. |

Open rule: an unanswered product question is recorded as an **assumption to
validate**, never as a decided fact.

## Environment (verified)

| Tool | Version / state |
| ------ | ----------------- |
| node | v25.2.1 |
| pnpm | 10.33.0 |
| bun | 1.3.14 |
| uv | 0.11.19 |
| ffmpeg / ffprobe | 8.1.1 (native on PATH) |
| git | 2.49.0 |
| Docker CLI | 29.6.2 — daemon **running** (server 29.6.2, API 1.55), verified 2026-09-16 |
| `python` on PATH | Unrelated hermes-agent virtualenv — never the project runtime |

The Python media worker must create its own environment with `uv`.

## Checklist

- [x] Message queue mechanism recorded by ADR-0002 (Redis Streams with consumer groups; BullMQ variant rejected with grounds)
- [x] Ingestion, storage port and delivery path recorded by ADR-0001
- [ ] Test runner chosen during design (Vitest / pytest / Playwright candidates)
- [x] Bounded contexts defined in sdd-explore (9 contexts, `explore.md` §1)
- [x] Docker Desktop daemon running (verified 2026-09-16: server 29.6.2, API 1.55)
