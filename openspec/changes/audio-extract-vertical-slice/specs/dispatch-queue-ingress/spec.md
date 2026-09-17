# Dispatch & Queue Ingress Specification

**Capability** C3 — Dispatch & Queue Ingress · **Lane** API · **Change** `audio-extract-vertical-slice`

## Purpose

Turning a ready job into a queue message without losing or inventing one: a transactional outbox
written with the job transition, and a relay that publishes through an abstract queue port. The
broker family is Redis; the concrete mechanism (Redis Streams with consumer groups versus BullMQ)
is **not** fixed here and is closed by `ADR-0002` in design. This capability therefore stays
broker-agnostic and names no broker-specific concept in its domain contract.

**In this slice:** outbox row written with the transition, relay publication, at-least-once
dispatch intent, the versioned message envelope, and the queue port's ack/claim-recovery
obligations.

**Not in this slice:** delayed retry scheduling, dead-letter destinations, replay, queue-depth
backpressure signalling, and progress or event payloads. Broker mechanics live behind the queue
port and are fixed by `ADR-0002`.

## Requirements

### Requirement: The Dispatch Intent Is Committed With the Job Transition

The transition to `queued` and its outbox row MUST be committed in one database transaction. A
job MUST NEVER be observable as `queued` without an intended message, and an outbox row MUST
NEVER exist for a job that is not `queued`.

#### Scenario: State and intent are inseparable

- GIVEN a job that transitions to `queued`
- WHEN the transaction commits
- THEN an outbox row for that job exists
- AND the transition and the outbox row are visible together or not at all

#### Scenario: No intent without a queued job

- GIVEN an outbox row written for a job
- WHEN a component reads the job
- THEN the job is in state `queued`
- AND the outbox row was never written for a `created`, `running`, or terminal job

#### Scenario: A failed transaction leaves no dispatch

- GIVEN a job whose transition transaction rolls back
- WHEN the outbox is inspected
- THEN no dispatch intent exists for that job

### Requirement: The Relay Publishes Through the Queue Port and Marks Only After Success

An outbox row MUST be published by the relay through the queue port, and the relay MUST mark a row
as published only after the publish has succeeded. A publish failure MUST leave the row eligible
for a later attempt and MUST NOT discard the intent.

#### Scenario: A successful publish marks the row

- GIVEN an unpublished outbox row
- WHEN the relay publishes it successfully
- THEN the row is marked published
- AND the row is not published again as a new intent

#### Scenario: A failed publish keeps the intent

- GIVEN a relay attempt whose publish fails
- WHEN the relay returns
- THEN the outbox row is still unpublished
- AND a later relay pass may publish the same intent

### Requirement: Dispatch Is At Least Once, Never Zero

The system MUST NOT lose a dispatch intent. Duplicate publication for one job is acceptable,
because consumers decide from the job record rather than from the message. The system MUST NOT
claim exactly-once delivery.

#### Scenario: A duplicate delivery is harmless

- GIVEN a job whose message is published twice
- WHEN the consumer handles both deliveries
- THEN the job's outcome is identical to handling it once
- AND no duplicate side effect is committed

#### Scenario: An interruption between state and publish recovers

- GIVEN a relay that stops after committing the transition and before publishing
- WHEN the relay runs again
- THEN the unpublished outbox row is published
- AND the job does not remain undispatched

### Requirement: The Message Is a Notification, Not the Truth

A dispatch message MUST be treated as an instruction to look at the job, not as a source of job
state: it MUST carry the job identity and the contract version, and consumers MUST resolve all
job state, parameters, and inputs from the job record. The message contract MUST NOT carry
broker-specific vocabulary, and it MUST be consumable from both the TypeScript producer and the
Python worker without a shared broker-specific client.

#### Scenario: The message alone cannot drive work

- GIVEN a message that refers to a job
- WHEN a consumer inspects the message
- THEN the decision about what to do requires reading the job record
- AND no job parameters are taken from broker metadata

#### Scenario: An unclaimed job is not executed from the message

- GIVEN a job in state `running` whose message is redelivered
- WHEN the consumer handles the redelivery
- THEN the consumer cannot claim the job, because claiming requires state `queued`
- AND no second execution of that job is started

### Requirement: The Queue Port Is Broker-Agnostic and the Adapter Owns Broker Mechanics

The domain contract MUST depend on a queue port, not on the chosen broker. The adapter behind that
port MUST provide, for the configured queue: delivery of each message to exactly one consumer of a
shared consumer group, explicit acknowledgement, and recovery of messages that were delivered to a
consumer which died before acknowledging. The concrete mechanism that implements these
obligations — consumer groups with claim recovery, or an equivalent job-queue mechanism — is fixed
by `ADR-0002` and MUST NOT appear in the domain contract.

#### Scenario: An unacknowledged message is recovered

- GIVEN a consumer that receives a message and dies before acknowledging it
- WHEN the queue adapter recovers unacknowledged messages
- THEN that message is delivered again to a live consumer
- AND at most one consumer processes it as the acknowledged owner

#### Scenario: The domain contract names no broker concept

- GIVEN the domain-facing dispatch and consumption interfaces
- WHEN they are inspected
- THEN they expose message identity, payload, and acknowledgement only
- AND they contain no broker-specific command or field

#### Scenario: Transport recovery is not job recovery

- GIVEN a job whose worker died mid-attempt and whose message is recovered at the transport level
- WHEN the recovered message is handled
- THEN the job is not requeued, because lease-expiry recovery is out of this slice
- AND the job remains `running` until a later slice introduces that recovery

### Requirement: One Versioned Message Contract Honored by Both Runtimes

The dispatch envelope MUST be defined once as a versioned JSON contract, honored by the NestJS
producer and the Python consumer. The envelope MUST carry the contract version. A consumer that
receives an envelope whose version it does not support MUST reject it rather than processing it
partially.

#### Scenario: Both runtimes accept the same envelope

- GIVEN a job payload produced by the API for `audio.extract`
- WHEN the worker consumes the envelope for real bytes
- THEN the worker resolves the same job, parameters, and inputs without translation

#### Scenario: An unsupported version is rejected

- GIVEN an envelope carrying a contract version the consumer does not support
- WHEN the consumer reads it
- THEN the message is rejected and not processed
- AND no job work is started
