# ADR-0001 — Ingestion transport, storage port, and the delivery path

- **Status:** Accepted (v0.1 scope). The message queue remains undecided and out of this ADR.
- **Date:** 2026-09-16
- **Change:** `audio-extract-vertical-slice`
- **Resolves:** research question **R10**; assumption **AV3**
- **Supersedes:** `explore.md` §6 input cap for `audio.extract` (see [Consequences](#consequences))
- **Deciders:** project owner

---

## Context

`explore.md` left R10 open with an explicit instruction: *"Do not decide this from intuition."* R10
was phrased as a binary — *"multipart through the API, or presigned direct-to-storage PUT?"* —
and it named a consequence: *"Whether the API is a byte pipe or a metadata service."*

Four facts constrain the decision:

1. **The governing objective is verifiable portfolio evidence**, not scale or revenue. The first
   slice must be the thinnest artifact that proves the TypeScript ↔ Python contract with real bytes.
2. **The environment is local.** At the time of writing, AV11 recorded that the Docker CLI was
   present but the **daemon was not running**.
   *(Amended 2026-09-16, later the same day: AV11 is **resolved** — the daemon runs, server
   `29.6.2`, API `1.55`. The decision below does not rest on this fact; it rests on D2's
   structural argument and on the model not gaining a step.)* There is no deployed environment,
   no object store, no reverse proxy, no CDN.
3. **AV3 was unanswered**, and `explore.md` states AV3 *drives* the ingestion design. It has now
   been answered: **v0.1 input cap is ≤ 200 MB**.
4. **`explore.md` §6 labels its own numbers *"to confirm"***, so confirming them is in scope.

---

## The framing correction: four axes, not one question

R10 as posed collapses four independent decisions into a single binary. Recording the axes is the
durable part of this ADR — the specific answers will change, the axes will not.

| # | Axis | The question | Decided by |
| --- | --- | --- | --- |
| 1 | **Storage backend** | Where do bytes live at rest? | The storage adapter |
| 2 | **Upload transport** | How do bytes get **in**? | The API edge |
| 3 | **Download transport** | How do bytes get **out**? | The read-grant adapter |
| 4 | **Reverse proxy / edge** | What sits in front? | Deployment |

Two confusions are worth recording, because both were made during this discussion:

- **Confusing axis 1 with axis 2.** "Do we store the file or only its metadata?" is an axis-1
  question. R10 is an axis-2 question. But the trap is symmetric: deciding the transport does
  **not** decide the backend. Assuming it does is how an architecture quietly locks itself in.
- **Importing axis 4 into a local project.** A reverse proxy and a CDN are *deployment* concerns.
  Neither exists here. Naming their defaults as *conditions of a design decision* lets a component
  that does not exist exercise veto power over a component that does. Their facts are recorded
  below as **conditional deployment notes**, explicitly not as v0.1 constraints.

Note that `explore.md` already separated axis 3 correctly: **C8 (Download Grant & Access Control)**
is its own bounded context, and §5 states the two layers — *authorize*, then *grant*.

---

## Decision

### D1 — Storage backend: one port, a local adapter now, S3 as a coexisting adapter

The storage is accessed through a **port** with a **local filesystem adapter** in v0.1. An S3-compatible
adapter is expected later and must be installable **without touching the domain model**. Both adapters
coexist behind the port, selected by configuration.

This answer is *independent of* the transport and delivery answers, and that independence is the point.

### D2 — Upload transport: byte pipe

The client uploads to the API; the API streams the bytes into the inbox zone.

This is **not a preference between two available options — it is a consequence of D1**. With a local
filesystem adapter there is no HTTP-addressable endpoint for a client to `PUT` to, so presigned direct
upload is impossible by construction. Presigned upload becomes *available* exactly when an
HTTP-addressable adapter (S3) exists. Axis 2 is downstream of axis 1.

**Engineering rule that follows:** stream to disk, never buffer to memory. The NestJS default is a
latent hazard here (see [Evidence](#evidence), E4).

### D3 — Download transport: one semantic operation, one branch at the edge

The port exposes a single **`createReadGrant`** operation returning an opaque grant. The download
endpoint branches exactly once and never learns whether the bytes come from local disk, S3, or a CDN.

### D4 — No reverse proxy and no CDN in v0.1

Neither exists in the environment, neither is required by any v0.1 requirement, and both are
deployment concerns. The nginx and CloudFront facts below are recorded as **conditional deployment
notes** for whoever deploys later, with the triggers that make them relevant.

### D5 — v0.1 input cap is ≤ 200 MB, as a registry value

`audio.extract` accepts inputs up to **200 MB**, matching what §6 already proposed for the PDF types.
The cap is a **job-type registry value**, not a hardcoded constant, so raising it later is a
configuration change plus (only if it crosses the threshold below) the D1/D2 upgrade path.

---

## The port contract

The contract is the load-bearing part of this ADR. Two traps must be closed **before any code is
written**, because both are cheap to avoid now and effectively impossible to reverse later.

### Trap 1 — filesystem verbs in the port

```ts
// REJECTED — the filesystem leaked into the contract
interface StoragePort {
  rename(from: string, to: string): Promise<void>;  // assumes atomic rename
  read(path: string): Promise<Readable>;            // assumes POSIX-like paths
  delete(path: string): Promise<void>;
}
```

`rename()` assumes an atomic rename. **General-purpose S3 has no atomic rename** — it is a copy plus a
delete, which is not atomic (see E1). Exposing `rename()` therefore makes the port unimplementable by
an S3 adapter, permanently. `path: string` is the same class of leak: S3 has bucket + key + region,
not paths.

### Trap 2 — raw URLs or paths escaping the port

If the API builds storage URLs itself, it has hardcoded the backend. A CDN then requires changing the
API, which is exactly the coupling the port exists to prevent.

### Accepted contract

```ts
interface StoragePort {
  putScratch(ref: ScratchRef, bytes: Readable): Promise<void>;
  promote(ref: ScratchRef): Promise<ArtifactHandle>;
  createReadGrant(handle: ArtifactHandle, ttlSeconds: number): Promise<ReadGrant>;
  remove(ref: ScratchRef | ArtifactHandle): Promise<void>;
}

type ReadGrant =
  | { kind: 'redirect'; url: string; expiresAt: Date }
  | { kind: 'proxy';    expiresAt: Date };
```

**`promote(ref) → ArtifactHandle`** means: *make these complete bytes appear at the canonical key,
atomically, or fail leaving nothing there.* It is a semantic verb, not a filesystem call.

| Adapter | Mechanism | Where atomicity comes from |
| --- | --- | --- |
| local filesystem | `rename()` | The OS rename on the same volume is atomic |
| S3 | A single `PutObject`, or `CompleteMultipartUpload` | A complete-object PUT is atomic and strongly consistent (E2) |

Different mechanisms, **identical contract**. In S3 the atomicity comes from PUT semantics, *not* from
rename. That is what makes the two adapters interchangeable rather than merely similar.

**`createReadGrant`** realizes the time-bounded read access that C8 requires, without the port naming
a vendor:

| Adapter | Returns | Note |
| --- | --- | --- |
| local filesystem | `{ kind: 'proxy' }` — the API streams the bytes | No HTTP endpoint exists to redirect to |
| S3 | `{ kind: 'redirect', url }` — a presigned GET | Presigned URLs cap at 7 days (E3) |
| CloudFront (future) | `{ kind: 'redirect', url }` — a signed CloudFront URL | No 7-day cap; origin stays private via OAC |

The edge stays trivial and backend-agnostic:

```ts
const grant = await storage.createReadGrant(artifact, 900);
if (grant.kind === 'redirect') return res.redirect(302, grant.url);
return streamArtifact(res, artifact);
```

**The payoff:** adding S3 or CloudFront later is writing one adapter, not rewriting the API, the worker,
or the state machine. That — not a cost comparison — is the reason D3 matters.

---

## Alternatives considered

| Alternative | Why not now | Revisit trigger |
| --- | --- | --- |
| **Presigned direct-to-storage upload** | Impossible with a local adapter (D2). Requires an S3-compatible store from day one, i.e. MinIO under Docker Compose — and the Docker daemon was not running at the time of writing (AV11, since resolved). Adds a **verification step before T1**: the client asserts "upload complete" and the API cannot trust it, so it must `HEAD` the object and compare size/hash. Byte pipe keeps that guarantee free and keeps T1's guard as written. | The cap rises above ~500 MB, **or** resumable upload across a flaky connection becomes a product requirement |
| **S3 adapter in v0.1** | No object store exists, no requirement needs one, and it would force Docker into the first slice | The demo must run against real object storage, or the cap crosses the threshold above |
| **CloudFront in front of S3** | Requires an AWS account, bucket, distribution, certificate, domain and deployment. None exist. For a local v0.1 it is cost optimization for traffic that does not exist | Deployment is real **and** (egress volume is material **or** read grants must outlive 7 days **or** reader latency matters) |
| **nginx / reverse proxy** | Not in the stack, not in the environment | Any deployment that puts a proxy in front of the API |

### Rejected for the wrong reason — recorded deliberately

CloudFront was initially proposed because *"S3 is expensive per request."* The conclusion is sound; the
reasoning is not, and the record matters more than the verdict:

| Concept | Cost (approx., us-east-1) |
| --- | --- |
| One `GET` serving a 200 MB artifact | ~$0.0000004 |
| Egress for that same 200 MB | **~$0.018** |

S3 GET requests are **~$0.0004 per 1,000**; egress is **~$0.09/GB**. **Egress dominates by roughly four
orders of magnitude.** Spending $1 on GET requests requires ~2.5 million downloads; spending $1 on
egress requires ~55. A CDN is justified by *cached egress* (and by free S3 → CloudFront origin
transfer, latency, and the 7-day presigned cap) — **not** by request charges.

---

## Consequences

### Enabling

- v0.1 needs **no object store, no CDN, no proxy, no CORS, and no new state**. It stays the thinnest
  artifact that proves the TS ↔ Python contract with real bytes.
- Swapping or adding a storage/delivery backend later is an adapter change, by construction.
- The `created` state already covers the "paperwork exists, bytes do not" window, so D2 introduces
  **no new transition** — T1 keeps its guard.

### Costs accepted

- **No resumable upload.** A 200 MB upload that fails at 90% restarts from zero. Accepted for v0.1;
  the migration path is S3 multipart with per-part presigned URLs.
- **The API carries the upload bytes.** With a 200 MB cap and streamed-to-disk handling this is
  acceptable; it is a real ceiling and it is the reason the cap is a registry value rather than a
  permanent architectural limit.
- **A second adapter is a future obligation, not free work.** The port contract is what keeps that
  work bounded.

### Artifact supersession

- **`explore.md` §6** proposes `audio.extract` ≤ **2 GiB**. **For v0.1 this is superseded by D5: ≤ 200 MB.**
  The §6 column is headed *"numbers to confirm"*, so this confirms it rather than contradicting it.
  `explore.md` is left unedited as the exploration snapshot; this ADR is the authority for v0.1.
  The 2 GiB figure is not wrong as a future ceiling — it is wrong as a v0.1 value.
- **`explore.md` §9 R10** is **answered** by this ADR.
- **`explore.md` §10 AV3** is **answered**: ≤ 200 MB.

---

## Evidence

Source quality is stated per item. AWS pricing pages render client-side and could not be read in full;
exact currency figures come from consolidated secondary sources and are **region-dependent and subject
to change**. The structural facts are corroborated by AWS's own documentation.

| # | Fact | Source | Quality |
| --- | --- | --- | --- |
| E1 | General-purpose S3 has **no atomic rename**: *"Rename objects by copying them and deleting the original ones"*. A `RenameObject` API exists **only** for directory buckets using the S3 Express One Zone storage class, where it *is* atomic | AWS — *Copying, moving, and renaming objects*; *RenameObject* API | official docs |
| E2 | S3 provides **strong read-after-write consistency for PUT and DELETE** in all regions, including overwrites | AWS — *What is Amazon S3?*; *Amazon S3 Strong Consistency* | official docs |
| E3 | Presigned URL expiry: **1 second to 7 days** with SigV4 (IAM credentials); the console caps at 12 hours. Grants longer than 7 days require CloudFront signed URLs/cookies | AWS — *Download and upload objects with presigned URLs* | official docs |
| E4 | NestJS `FileInterceptor` / multer default to a **`Buffer`** — the entire file in memory. Maintainers declined to change the default (breaking change) and pointed to documentation instead. Open since 2024-02-02 | nestjs/nest issue **#13158** | maintainer thread |
| E5 | S3 multipart: max object **48.8 TiB**, **10,000** parts, part size **5 MiB–5 GiB**, no minimum on the last part. AWS suggests considering multipart at **100 MB** | AWS — *Amazon S3 multipart upload limits* | official docs |
| E6 | CloudFront: egress from ~**$0.085/GB**; **data transfer from AWS origins to CloudFront is free**; 1 TB/month free tier | AWS — *CloudFront Pricing*, *CloudFront FAQs* | official docs + secondary |
| E7 | nginx deployment notes: `client_max_body_size` default **`1m`**; `client_body_buffer_size` default `8k\|16k`, overflowing to a temp file; `proxy_request_buffering` default **`on`**, which reads the *entire* request body before forwarding upstream | nginx.org — `ngx_http_core_module`, `ngx_http_proxy_module` | official docs |

**Deployment note derived from E7 (not a v0.1 constraint):** under `proxy_request_buffering on`, the
*"streaming hard cut"* that `explore.md` §6 requires is **not implementable** — the proxy consumes the
whole body before the application sees a byte. Any deployment behind such a proxy must set
`proxy_request_buffering off` and raise `client_max_body_size` to make the §6 requirement achievable.

---

## Revisit triggers

- **Cap** rises above ~500 MB → re-evaluate D2, D5 and the S3 adapter.
- **Resumable upload** becomes a product requirement → S3 multipart with per-part presigned URLs.
- **Egress volume** becomes material, or **read grants must outlive 7 days**, or **reader latency
  matters** → D3's CloudFront adapter.
- **Any reverse proxy** enters the deployment → apply the E7 notes.
- **A second consumer** of the storage port appears → re-examine whether the port surface is still
  minimal.
