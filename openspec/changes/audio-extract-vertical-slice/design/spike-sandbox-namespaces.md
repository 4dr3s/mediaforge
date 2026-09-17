# Spike — sandbox namespace precondition (WU-13)

**Date:** 2026-09-16
**Change:** `audio-extract-vertical-slice`
**Resolves:** the precondition `design.md` §10 states honestly — whether the handler child can be given
its own user + network namespace inside the worker container, so it has **no network** while the worker
keeps Postgres and Redis.
**Related:** `design.md` §10 (sandbox realization), `tasks.md` WU-13 and WU-15, `workers/media/spikes/RESULTS.md` (the WU-5 spike)

---

## Result

**The sandbox is realizable — but not with Docker's default seccomp profile.** The blocker is
**seccomp, not the kernel and not the capabilities**. A targeted custom seccomp profile is sufficient;
`--privileged` and `CAP_SYS_ADMIN` are **not** required. This is the fallback `design.md` §10 already
anticipated, now confirmed as viable rather than assumed.

---

## Evidence

Environment: `mediaforge-worker` (`docker-worker:latest`, `python:3.11-slim` base), Docker server
`29.6.2`, kernel exposed by Docker Desktop on Windows.

### Tooling and kernel state inside the worker container

| Check | Observed |
| --- | --- |
| `unshare` binary | **present** — `/usr/bin/unshare` |
| `bwrap` binary | **present** — `/usr/bin/bwrap` |
| `/proc/sys/kernel/unprivileged_userns_clone` | **does not exist** (a Debian/Ubuntu-specific knob; its absence is not evidence of a block) |
| `/proc/sys/user/max_user_namespaces` | **31085** — user namespaces are available in the kernel |

### The isolation matrix

Command under test, run in a throwaway container from the same image:

```sh
unshare --user --net true   # user namespace first, then network namespace
```

| # | Container flags | `unshare --user --net` | `unshare --net` (alone) |
| --- | --- | --- | --- |
| A | `--security-opt seccomp=unconfined --security-opt no-new-privileges --cap-drop ALL` | **✅ OK** | ❌ EPERM |
| B | `--security-opt seccomp=unconfined` (default capabilities) | **✅ OK** | ❌ EPERM |
| C | *(control)* Docker default seccomp profile | ❌ EPERM | ❌ EPERM |

The live worker container currently reports:

```text
SeccompProfile=[no-new-privileges:true]  CapDrop=[ALL]  ReadonlyRootfs=true
```

There is **no explicit seccomp profile**, so Docker's default applies — which is row C, blocked.

The Python `ctypes` route that `bwrap` relies on was also tested in the live container and failed
identically:

```text
unshare(user) -> errno 1 Operation not permitted
unshare(net)  -> errno 1 Operation not permitted
```

That eliminates "the `unshare(1)` binary is doing something unusual" as an explanation.

---

## What the two independent failures mean

Two distinct mechanisms are at play, and separating them is what makes the remedy precise:

1. **`unshare --user --net` fails only under the default seccomp profile.** Rows A and B show it
   succeeds with the *fewest* privileges available — `cap_drop: ALL` **and** `no-new-privileges`. So the
   block is Docker's seccomp filter denying the `unshare`/`clone` syscalls with namespace flags. It is
   **not** a capability problem and **not** a kernel problem.
2. **`unshare --net` alone fails even with seccomp unconfined**, because creating a network namespace
   by itself requires `CAP_SYS_ADMIN`, which `cap_drop: ALL` removes. This is expected and harmless:
   **order matters.** Unsharing the *user* namespace first grants the full capability set *inside* that
   new namespace, so the immediately following `--net` succeeds. `unshare --user --net` does exactly
   that. A design that attempted `--net` without `--user` would fail for the wrong reason.

---

## Consequence for WU-15

`design.md` §10's `bwrap` invocation stays as written:

```bash
bwrap --unshare-user --unshare-net --unshare-pid --die-with-parent ...
```

`--unshare-user` comes **before** `--unshare-net` in `bwrap`'s own ordering, so it is already correct.
What the worker container needs added is a **custom seccomp profile** that permits `unshare` and `clone`
with the namespace flags and leaves everything else at the default posture. Concretely, WU-15 must:

- add a seccomp profile file (for example `docker/worker-seccomp.json`) based on Docker's default
  profile, with the namespace-creating `unshare`/`clone` cases allowed for the worker container;
- reference it in `docker/compose.yaml` as
  `security_opt: [seccomp:./worker-seccomp.json, no-new-privileges:true]`, keeping `cap_drop: [ALL]`,
  `read_only: true`, the `tmpfs: /tmp` and the resource limits exactly as they are;
- re-run **this spike** after the change, in the live worker container, and paste the output here. The
  acceptance is that `unshare --user --net true` succeeds **inside `mediaforge-worker`** while the
  container still has `cap_drop: ALL` and no `--privileged`.

No `--privileged` and no `CAP_SYS_ADMIN` are needed, which is the property that makes this fallback
acceptable rather than a weakening of the sandbox.

---

## Residual uncertainty, stated

- The probe ran on **Docker Desktop for Windows**, whose Linux VM kernel differs from a deployment
  host's. The seccomp finding is a property of the Docker **daemon's** profile, which is portable, so
  the remedy should transfer — but the acceptance re-run must be repeated on the target runtime before
  the sandbox is claimed as working.
- If a custom seccomp profile is rejected as policy in some future environment, the escalation named in
  `design.md` §10 applies. The honest fallback then is to **weaken the isolation claim rather than
  silently drop it**: run the handler non-root on a read-only filesystem with the resource limits and
  the process-group kill, and record that the handler child shares the worker's network namespace
  instead of claiming it has none.
