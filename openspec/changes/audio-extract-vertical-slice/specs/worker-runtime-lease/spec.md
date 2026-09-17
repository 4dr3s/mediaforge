# Worker Runtime & Lease Specification

**Capability** C4 — Worker Runtime & Lease · **Lane** WKR · **Change** `audio-extract-vertical-slice`

## Purpose

How the Python worker claims a job, holds and renews a lease, decides whether to work at all,
and commits an outcome it is still entitled to write. This capability owns T4, T6, and T7, and it
is the half of the state machine where the fencing guarantee actually lives.

**In this slice:** guarded claim, bounded lease, heartbeat renewal, terminal-state dedupe before
work, fencing-guarded commit for success and for failure of either class, acknowledgement
ordering, and process-group termination on wall-clock timeout.

**Accepted limitations, recorded honestly:** there is no requeue path, so an attempt budget can
never be consumed and a job whose worker dies mid-attempt stays `running` until a later slice adds
lease-expiry recovery. Failure classification is still performed, but **in this slice both classes
commit T7** — an error classified retryable fails the job with a distinguishable error code
instead of being retried. Committing *some* outcome for every failure is what keeps a live worker
from stranding the job in `running` (no reaper exists to recover it) or leaving the message
unacknowledged and re-delivered indefinitely (an unclaimable non-terminal job is neither terminal
nor workable). When the reaper lands, the retryable class moves to T8 instead of T7.

## Requirements

### Requirement: Claiming Is T4 — One Guarded CAS That Records the Attempt

The worker MUST claim a job only by performing T4 (`queued` → `running`) as a single conditional
update whose guard requires `available_at <= now` and a derived attempt count below the registry's
attempt budget. The attempt row (`attempt_no`, `lease_owner`, `lease_expires_at`) MUST be recorded
in the same transaction as the state change, so a job can never be `running` without a recorded
holder of the lease.

#### Scenario: A claimable job is claimed once

- GIVEN a job in `queued` whose availability time has passed
- WHEN two workers attempt to claim it concurrently
- THEN exactly one claim commits
- AND exactly one `attempts` row exists for that job

#### Scenario: A job that is not claimable is not claimed

- GIVEN a job in `running` or in a terminal state
- WHEN a worker attempts to claim it
- THEN the conditional update matches no row
- AND no attempt row is created

#### Scenario: The lease is bounded in time

- GIVEN a successful claim
- WHEN the attempt row is read
- THEN it carries a lease owner and a lease expiry in the future
- AND the expiry follows from the registry's lease configuration

### Requirement: Only the Current Lease Holder May Commit

A worker MUST record an outcome for a job only while it holds the current lease for that job. A
worker whose lease was lost — because the lease expired, its holder changed, or the job left
`running` — MUST stop work and MUST NOT write the outcome.

#### Scenario: A lost lease stops the worker

- GIVEN a worker that holds a lease which is no longer current
- WHEN the worker is about to write an outcome
- THEN the write is rejected
- AND the job's state and outcome records are unchanged

#### Scenario: Duplicate work is tolerated, duplicate commit is not

- GIVEN two workers processing the same job because a lease is no longer current
- WHEN both attempt to write an outcome
- THEN at most one write is accepted
- AND the accepted write is the one from the current lease holder

### Requirement: Heartbeat Renewal Is a CAS on the Held Lease

The worker MUST renew its lease periodically while work is in progress, and renewal MUST be a
conditional update tied to the current lease owner. A renewal that matches no row means the lease
was lost; the worker MUST stop and MUST NOT commit an outcome.

#### Scenario: A live worker keeps its lease

- GIVEN a worker that holds the current lease for a long-running job
- WHEN it renews the lease before the expiry
- THEN the lease expiry moves forward
- AND the lease owner is unchanged

#### Scenario: A failed renewal ends the attempt's write authority

- GIVEN a worker whose lease was taken or expired
- WHEN its heartbeat renewal matches no row
- THEN the worker stops working on that job
- AND no outcome is committed by that worker

### Requirement: Terminal-State Dedupe Happens Before Any Work

Before doing any work for a message, the worker MUST read the job record. If the job is in a
terminal state, the worker MUST acknowledge the message and exit without creating an attempt,
invoking a handler, or touching storage. Dedupe MUST be by job state, never by message identity.

#### Scenario: A redelivered terminal message is acknowledged without work

- GIVEN a job in `succeeded` whose message is delivered again
- WHEN the worker handles the delivery
- THEN the worker acknowledges the message
- AND it creates no attempt
- AND no handler is invoked

#### Scenario: Dedupe does not depend on message identity

- GIVEN two different messages that refer to the same terminal job
- WHEN both are handled
- THEN both are acknowledged without work
- AND no side effect occurs for either

### Requirement: Acknowledgement Follows the Commit

The worker MUST NOT acknowledge a message before the job outcome is committed. If the commit
fails, the message MUST NOT be acknowledged, so the job can be re-delivered rather than silently
abandoned.

#### Scenario: Ack after a successful commit

- GIVEN an attempt whose outcome commit succeeded
- WHEN the worker finishes handling the message
- THEN the message is acknowledged

#### Scenario: A failed commit is not acknowledged

- GIVEN an attempt whose outcome commit failed
- WHEN the worker finishes handling the message
- THEN the message is not acknowledged
- AND the job record still shows the state it had before the commit

### Requirement: T6 Is Fencing-Guarded and Follows the Atomic Promote

The worker MUST commit `succeeded` through a single conditional update whose precondition is the
current lease owner and `state = 'running'`, and MUST do so only after the artifact has been
atomically promoted. The same commit MUST record the artifact reference, so a `succeeded` job
always points at promoted bytes.

#### Scenario: The current holder commits success

- GIVEN a worker holding the current lease whose artifact promote succeeded
- WHEN it commits the outcome
- THEN the job becomes `succeeded` with the artifact reference
- AND the message is acknowledged afterwards

#### Scenario: A stale holder can never commit

- GIVEN a worker whose lease is no longer current for a `running` job
- WHEN it attempts to commit `succeeded`
- THEN the conditional update matches no row
- AND the job does not become `succeeded`
- AND no artifact reference is recorded by that worker

#### Scenario: Promote precedes the commit

- GIVEN an attempt whose output is still only in the work zone
- WHEN the worker would commit `succeeded`
- THEN the artifact is promoted first
- AND a `succeeded` job is never observed without a resolvable artifact

### Requirement: T7 Commits Both Failure Classes, Distinguished by Error Code

The worker MUST attempt T7 (`running` → `failed`) for **every** failure it observes while holding
the current lease, MUST fence the write on the current lease holder, and MUST record an error code.
The error code MUST distinguish a non-retryable failure from one that was classified retryable, so
a later slice can tell the two apart without re-running anything. The worker MUST NOT implement a
requeue path, and no guard in this slice may depend on a retry budget.

**Rationale to preserve:** a worker that observes a failure and commits *nothing* leaves the job
`running` while the message is either acknowledged (stranding the job permanently, because no
reaper exists) or left unacknowledged (re-delivered indefinitely, because an unclaimable
non-terminal job is neither terminal nor workable). Committing a terminal outcome for both classes
removes both failure modes without introducing retry behaviour.

#### Scenario: A non-retryable failure fails the job

- GIVEN a malformed input that the handler classifies as invalid input
- WHEN the worker reports the outcome
- THEN the job becomes `failed` with a non-retryable error code
- AND the write is accepted only from the current lease holder

#### Scenario: A retryable failure also reaches a terminal outcome

- GIVEN a transient failure (for example a storage write error) that the worker classifies retryable
- WHEN the worker reports the outcome
- THEN the job becomes `failed`
- AND the recorded error code identifies the failure as retryable
- AND the message is acknowledged, because an outcome was committed

#### Scenario: No failure leaves the job in `running` or the message unacknowledged

- GIVEN any failure observed by a worker holding the current lease
- WHEN the worker finishes handling that attempt
- THEN a terminal outcome has been committed
- AND the message has been acknowledged

#### Scenario: No requeue path exists

- GIVEN any failed attempt in this slice
- WHEN the system inspects what happens to the job next
- THEN the job does not return to `queued`
- AND no retry-budget guard or retry scheduling is present

#### Scenario: A stale worker cannot fail the job

- GIVEN a worker whose lease is no longer current
- WHEN it attempts to commit `failed`
- THEN the conditional update matches no row
- AND the job's state is unchanged

### Requirement: Every Outcome Write Carries the Attempt's Fencing Token

Every write that follows a side effect MUST carry the fencing token of the attempt that produced
it. A code path that can write a job outcome without such a token MUST NOT exist, because it would
make the idempotency guarantee false.

#### Scenario: No unguarded outcome write exists

- GIVEN the code paths that write job outcomes
- WHEN they are inspected
- THEN each carries the attempt's fencing token in its precondition

### Requirement: Wall-Clock Timeout Terminates the Whole Process Group

The worker MUST enforce the job-type wall-clock limit from the registry. On timeout it MUST
terminate the handler process group — the handler process and its children — so that no orphaned
tool process keeps consuming resources. The terminated attempt MUST be classified and reported
through the failure path rather than being left silent.

#### Scenario: A long-running handler is killed with its children

- GIVEN a handler that exceeds the job-type wall-clock limit and has spawned a child tool process
- WHEN the timeout fires
- THEN the handler process and its child are both terminated
- AND no surviving process from that attempt remains

#### Scenario: A timeout is classified rather than left silent

- GIVEN an attempt terminated by the wall-clock timeout
- WHEN the worker reports the outcome
- THEN the failure is classified
- AND it commits `failed` with an error code through T7, whether the classification is retryable or not
- AND the message is acknowledged, because an outcome was committed

### Requirement: The Worker Decides From the Job Record, Never From the Message

The worker MUST determine what to do by reading the job record: its state, job type, parameters,
and inputs. It MUST NOT use the message as a source of job state or parameters, and MUST NOT
assume that a message corresponds to a job it is allowed to run.

#### Scenario: A message for an unfit job does nothing

- GIVEN a message that refers to a job that is not claimable
- WHEN the worker handles it
- THEN the worker takes no job action beyond acknowledging or leaving the message
- AND it does not run a handler
