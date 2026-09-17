# Job-Type Execution Specification

**Capability** C5 — Job-Type Execution · **Lane** WKR · **Change** `audio-extract-vertical-slice`

## Purpose

The pure handler boundary and the containment doctrine around it: a handler takes
`(inputs[], params, scratch)` and returns outputs, never touching the database, the queue, or the
canonical artifact key. This capability owns the only job type shipped in this slice,
`audio.extract`, and the sandbox rules that bound the blast radius when a hostile file passes
every check and still reaches a media codec.

**In this slice:** the pure handler contract, registry-declared arity assertion, `audio.extract`
via ffmpeg, argument-injection prevention, property-based artifact acceptance, the container-per-
worker isolation boundary, one process per job, and a network-less handler child.

**Not in this slice:** `pdf.merge` and `pdf.split`, handler-level progress reporting, and
cooperative cancellation inside a running handler. Timeouts and lease handling belong to the
worker runtime capability.

## Requirements

### Requirement: The Handler Contract Is Pure

A job-type handler MUST be called as `(inputs[], params, scratch) -> outputs`. A handler MUST NOT
read or write the database, MUST NOT read or write the queue, and MUST NOT write to or resolve a
canonical artifact key. A handler MUST write only inside the scratch location it receives and MUST
return output handles plus the output metadata it can establish; promotion of bytes to the
canonical key is the pipeline's job, never the handler's.

#### Scenario: The handler is exercised without infrastructure

- GIVEN a handler and a scratch directory
- WHEN the handler is invoked with input handles and validated params
- THEN it returns output handles without any database, queue, or canonical key access

#### Scenario: A handler cannot reach the canonical key

- GIVEN a running handler
- WHEN it attempts to write outside its scratch location
- THEN the write fails
- AND the canonical artifact key is never written by the handler

### Requirement: The Handler Asserts Its Registry-Declared Arity and Params

A handler MUST assert that the number of inputs it received equals the arity declared by the
job-type registry, and MUST fail as a typed error when it does not; `audio.extract` declares
arity 1. Handler parameters MUST be validated against the registry's parameter schema before the
handler starts, and the handler MUST reject parameters it does not understand.

#### Scenario: A correct arity is accepted

- GIVEN `audio.extract` with registry arity 1
- WHEN the handler receives exactly one input
- THEN the handler proceeds

#### Scenario: A wrong arity is a typed failure

- GIVEN `audio.extract` with registry arity 1
- WHEN the handler receives two inputs
- THEN it fails with a typed error rather than guessing which input to use

#### Scenario: Invalid params are rejected before execution

- GIVEN a params value that does not satisfy the registry parameter schema
- WHEN an attempt would start
- THEN the handler is not invoked with that value
- AND the attempt is reported as a typed failure

### Requirement: `audio.extract` Produces Exactly One mp3 From One Video Input

The `audio.extract` handler MUST convert its single video input into exactly one mp3 output using
ffmpeg, and MUST produce no other artifact. The ffmpeg invocation MUST be built from a fixed,
validated argument set for a given params value, so two runs over the same input and params use
identical arguments.

#### Scenario: One input yields one mp3

- GIVEN a valid video input
- WHEN `audio.extract` completes
- THEN exactly one output handle is returned
- AND its content type is mp3

#### Scenario: The invocation is not improvised per run

- GIVEN the same input and params twice
- WHEN the handler builds the ffmpeg invocation
- THEN the two argument lists are identical

### Requirement: Handler Arguments Cannot Be Injected

The handler MUST build process arguments as an argument array and MUST NOT use a shell string or
shell interpolation. User-supplied values MUST NOT be appended as tool arguments, and the client's
filename MUST NOT be interpolated into a command. Selectable options MUST come from a validated,
enumerated set.

#### Scenario: A hostile filename cannot change the command

- GIVEN an input whose display filename contains shell metacharacters
- WHEN the handler runs
- THEN the filename does not appear in the command line
- AND the executed argument list is the fixed argument set

#### Scenario: No shell is involved

- GIVEN the handler's process launch path
- WHEN it is inspected
- THEN arguments are passed as an array
- AND no shell executes the command

### Requirement: Artifact Acceptance Is by Properties, Not by Bytes

The artifact produced by a handler MUST be verified by properties — such as duration, codec, and
bitrate read back from the output — and MUST NOT be verified by byte-identical comparison or by
content hash equality. Handler output is not guaranteed to be bit-identical across ffmpeg builds.

#### Scenario: Properties are asserted

- GIVEN a completed `audio.extract` attempt
- WHEN the artifact is verified
- THEN its properties are read back from the produced file
- AND the verification does not require byte equality with a stored golden file

### Requirement: The Sandbox Is a Container per Worker and a Process per Job

The worker MUST run in an ephemeral container with a read-only root filesystem, a non-root user,
and enforced resource limits; that container is the host ↔ worker boundary. Inside it, each job
MUST execute in its own process; that process boundary is the job ↔ job boundary, so no job may
share process state or scratch files with another job. The worker's own network access MUST be
limited to the database and the queue, and the handler child process MUST run with no network
access at all.

#### Scenario: The worker container is read-only and non-root

- GIVEN the running worker container
- WHEN its runtime configuration is inspected
- THEN the root filesystem is read-only
- AND the process does not run as root
- AND resource limits are configured

#### Scenario: Jobs do not share a process

- GIVEN two jobs executing in one worker container
- WHEN their handler processes are inspected
- THEN each job runs in its own process
- AND terminating one job's process does not terminate the other's

#### Scenario: The handler child has no network

- GIVEN a running handler child process
- WHEN it attempts an outbound network connection
- THEN the connection fails
- AND the worker itself still reaches the database and the queue

### Requirement: Handlers Fail Loudly With a Typed Error

A handler MUST report failure as a typed error the runtime can classify, including invalid or
unsupported input. A handler MUST NOT exit successfully after a failure, MUST NOT swallow an error
into an empty output, and MUST NOT return an output handle for bytes it did not produce.

#### Scenario: A malformed input fails with a type

- GIVEN an input that ffmpeg cannot read as a media file
- WHEN the handler runs
- THEN it returns a typed failure for invalid input
- AND it does not return an output handle

#### Scenario: A failure is never reported as success

- GIVEN a handler whose tool process failed
- WHEN the handler returns
- THEN the result is a failure
- AND the pipeline records no success for that attempt

### Requirement: The Handler Cannot Exceed the Containment Budget

A handler MUST NOT be able to make the worker do more work than the job-type limit table allows:
the container resource limits, the job-type wall-clock limit, and the scratch space available to
the attempt bound what a hostile input can consume. The handler MUST NOT spawn unbounded child
work that outlives the attempt.

#### Scenario: A resource-expensive input is bounded

- GIVEN an input crafted to consume maximal CPU or memory
- WHEN the handler runs
- THEN the container resource limits bound its consumption
- AND the worker process itself survives the attempt

#### Scenario: No handler work outlives the attempt

- GIVEN an attempt that ends, for any reason
- WHEN the container and process tree are inspected
- THEN no process spawned by that attempt is still running
