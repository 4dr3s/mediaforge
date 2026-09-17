# Job Registry & Lifecycle Specification

**Capability** C2 — Job Registry & Lifecycle · **Lane** SHR · **Change** `audio-extract-vertical-slice`

## Purpose

The durable state machine that both runtimes honor: the six states, the guarded transitions
allowed in this slice with their owners, terminal immutability, and the `attempts` and
`job_inputs` records that make the transitions safe. Lane **SHR** means it is written once here
and honored twice — by the TypeScript API and the Python worker.

**In this slice:** the six states, T1, T3, T4, T5, T6, T7, CAS-only transitions, terminal
immutability, the real `attempts` table, derived `attempts_used`, and plural `job_inputs`.

**Not in this slice:** lease-expiry requeue, input-TTL failure, poison-message failure, and
cooperative cancellation while running; no requeue path exists, so an attempt budget can never be
consumed. Progress projection and event records are also out. The concrete DDL, the Prisma
schema, and which language owns migrations are fixed by design.

## Requirements

### Requirement: Exactly Six States, With Canonical Names

The job lifecycle MUST consist of exactly these six states: `created`, `queued`, `running`,
`succeeded`, `failed`, `canceled`. `succeeded`, `failed`, and `canceled` MUST be terminal. The
system MUST NOT add further lifecycle states; conditions such as expiry, dead-lettering, retrying,
or timing out MUST be expressed as an error code on `failed` or as a queue-layer fate, never as a
state.

#### Scenario: A job is always in exactly one of the six states

- GIVEN any persisted job
- WHEN its state is read
- THEN the value is one of the six canonical state names
- AND no storage location holds a seventh state value

#### Scenario: Expiry is not a state

- GIVEN a job whose artifact is past its retention date while the job is `succeeded`
- WHEN the job is read
- THEN its state is still `succeeded`
- AND no expiry state is introduced

### Requirement: Every Transition Is a Single Compare-and-Set

Every state transition MUST be performed as one conditional update of the form
`UPDATE ... WHERE id = ? AND state = ?`, so the database rejects the write when the precondition
no longer holds. The system MUST NOT perform a transition as a read-modify-write in application
code. A conditional update that matches no row MUST be treated as "the transition did not happen"
and MUST NOT be retried with a blind write that ignores the precondition.

#### Scenario: A stale precondition rejects the write

- GIVEN a job in `running`
- WHEN a transition that requires `state = 'queued'` is attempted
- THEN the conditional update matches no row
- AND the job's state and outcome records are unchanged

#### Scenario: No transition bypasses the precondition

- GIVEN the implemented transition paths
- WHEN the code paths that write job state are inspected
- THEN each writes state only through a conditional update naming the expected source state

### Requirement: The Implemented Transition Set and Its Disjoint Owners

The system MUST implement exactly these transitions, each with exactly one owning component:

| Transition | From → To | Owner |
| --- | --- | --- |
| T1 | `created` → `queued` | API |
| T3 | `created` → `canceled` | API |
| T4 | `queued` → `running` | Worker |
| T5 | `queued` → `canceled` | API |
| T6 | `running` → `succeeded` | Worker |
| T7 | `running` → `failed` | Worker |

No other transition MAY exist in this slice. A component MUST NOT perform a transition it does
not own, and the owner sets MUST stay disjoint, so two components never contend for the same job
endpoint.

#### Scenario: The worker cannot cancel through a queued transition

- GIVEN a job in `queued`
- WHEN the worker attempts the `queued` → `canceled` transition
- THEN the attempt is rejected as not owned by the worker
- AND the job remains `queued`

#### Scenario: The API cannot commit a running job as succeeded

- GIVEN a job in `running`
- WHEN the API attempts the `running` → `succeeded` transition
- THEN the attempt is rejected as not owned by the API
- AND the job remains `running`

### Requirement: Terminal States Are Immutable

A job in `succeeded`, `failed`, or `canceled` MUST NEVER leave that state, and no subsequent
operation MAY change its outcome records. Re-execution of work for a terminal job is therefore
expressed as a new job, never as a revival of the terminal one.

#### Scenario: A terminal job ignores further transitions

- GIVEN a job in `succeeded`
- WHEN any transition is attempted against it
- THEN the conditional update matches no row
- AND the state and outcome records are unchanged

#### Scenario: Redelivery does not revive a terminal job

- GIVEN a job that reached `succeeded`, whose dispatch message is redelivered
- WHEN the redelivered message is handled
- THEN the job's state is unchanged
- AND no new attempt is recorded for it

### Requirement: Attempts Are Recorded as Rows, Not as a Counter

Every claim of a job MUST be recorded as a row in an `attempts` table carrying at least
`attempt_no`, `lease_owner`, `lease_expires_at`, start and end times, and an error class on
failure. The system MUST NOT represent an attempt as a counter column on `jobs`, and MUST NOT
call an attempt a "run".

#### Scenario: Claiming creates an attempt row

- GIVEN a job in `queued` that is successfully claimed
- WHEN the claim commits
- THEN one `attempts` row exists for that job with the claiming worker as `lease_owner`
- AND the row carries `attempt_no` 1, the lease owner, and a lease expiry

#### Scenario: The attempt count is not stored on the job

- GIVEN the schema for `jobs`
- WHEN the job columns are inspected
- THEN no counter column holds the number of attempts

### Requirement: `attempts_used` Is Derived From the Attempts Table

Any guard that needs the number of attempts consumed for a job MUST derive it from the `attempts`
table (for example `count(*)` or `max(attempt_no)` for that job). The system MUST NOT persist
`attempts_used` as a job column.

#### Scenario: The T4 guard computes the count from attempts

- GIVEN a job with one recorded attempt
- WHEN T4's guard is evaluated
- THEN the attempt count used by the guard is computed from the `attempts` rows for that job
- AND no stored `attempts_used` value is read

#### Scenario: Because no requeue path exists, the count cannot exceed one

- GIVEN a job that has been claimed once
- WHEN the attempt count is derived
- THEN the derived count is 1
- AND no guard in this slice depends on a budget larger than one attempt

### Requirement: Job Inputs Are Plural With a Unique Ordinal

A job MUST persist one `job_inputs` row per declared input, ordered by `ordinal`, where `ordinal`
is the input's position within the job (1, 2, …). The pair `(job_id, ordinal)` MUST be unique, so
two inputs of one job can never claim the same position. The mapping from an input to its bytes
is the storage key defined by the artifact & storage lifecycle capability.

#### Scenario: Duplicate ordinals are rejected

- GIVEN a job that already has an input at `ordinal` 1
- WHEN a second input row for the same job and `ordinal` 1 is written
- THEN the write is rejected by the uniqueness constraint
- AND the job's inputs are unchanged

#### Scenario: A job's inputs are ordered and resolvable

- GIVEN a job with inputs at ordinals 1, 2, and 3
- WHEN the job's inputs are read
- THEN they are returned in ordinal order
- AND each input resolves to exactly one byte source

### Requirement: A Terminal Job Records Its Outcome

A job that reaches `succeeded` MUST record the artifact reference produced by that attempt, and a
job that reaches `failed` MUST record an error code. A job in `succeeded` MUST always be
resolvable to an artifact record, and a job in `failed` MUST NOT be reported as having produced
an artifact.

#### Scenario: Success carries the artifact reference

- GIVEN a job that commits `succeeded`
- WHEN the job is read
- THEN it carries the artifact reference written by the same commit
- AND the artifact record exists for that job

#### Scenario: Failure carries an error code and no artifact

- GIVEN a job that commits `failed` through T7
- WHEN the job is read
- THEN it carries an error code
- AND no artifact is reported for that job

### Requirement: The Job Row Is the Source of Truth; the Message Is a Hint

The system MUST derive job state, parameters, and inputs from the persisted job record. No
component MAY treat a dispatch message as authoritative for state, MUST NOT infer a transition
from message metadata such as a delivery count, and MUST NOT change job state because a message
was redelivered.

#### Scenario: Message metadata cannot drive a transition

- GIVEN a dispatch message whose delivery count is greater than one
- WHEN a component inspects the message alone
- THEN no job state transition is derived from that count
- AND the job's persisted state decides what happens next

### Requirement: Cancellation Exists Only Before Execution Begins

A job MAY be canceled only while it is `created` (T3) or `queued` (T5); both transitions MUST be
performed by the API as a single CAS. T5's guard MUST include that the job holds no active lease
and is not `running`. `canceled` is terminal. A `running` job MUST NOT be cancelable in this
slice, and no cooperative cancellation of a running attempt may exist.

#### Scenario: A created job can be canceled

- GIVEN a job in `created`
- WHEN a capability-authorized cancel request arrives
- THEN the job transitions to `canceled` in one conditional update
- AND it is terminal afterwards

#### Scenario: A queued job can be canceled

- GIVEN a job in `queued` with no active lease
- WHEN a capability-authorized cancel request arrives
- THEN the job transitions to `canceled` in one conditional update

#### Scenario: A running job cannot be canceled

- GIVEN a job in `running` with an active lease
- WHEN a capability-authorized cancel request arrives
- THEN no transition is applied
- AND the job remains `running`

#### Scenario: `canceled` is reachable

- GIVEN the implemented transition set
- WHEN the inbound transitions of every state are inspected
- THEN `canceled` has at least one inbound transition
- AND it is not an unreachable state
