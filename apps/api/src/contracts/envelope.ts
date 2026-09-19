/**
 * The dispatch envelope — the shared contract's notification payload (design.md §7.1), parsed
 * and validated on the API side. The Python worker carries the same contract
 * (`workers/media/src/mediaforge/contracts.py`), and the parity suites pin both sides to the
 * same fixture documents.
 *
 * The envelope is a **notification, not the truth**: `type`, `job_id`, `occurred_at`, and
 * nothing else. The moment it carries parameters or state it is a second, stale copy of the job
 * record, so a fourth field is rejected, not stripped.
 */
import { z } from 'zod';

/** The only version this contract ships; a different literal is a contract change. */
export const ENVELOPE_TYPE_V1 = 'mediaforge.job.dispatch.v1';

/**
 * `.strict()` is load-bearing: zod's default `.strip()` would silently drop an unknown key and
 * keep three keys, while the envelope stopped being a notification. The parity suite asserts the
 * parsed key set equals exactly these three, so the extra field must fail here, not vanish.
 */
const dispatchEnvelopeSchema = z
  .object({
    type: z.literal(ENVELOPE_TYPE_V1),
    job_id: z.string(),
    // RFC 3339's time-offset is mandatory (design.md §7.1); `offset: true` makes `Z` or `±HH:MM`
    // required, rejecting a bare date and a naive timestamp alike.
    occurred_at: z
      .string()
      .datetime({ offset: true })
      // The instant domain is years 0001–9999, and year 0000 is rejected loudly, never
      // interpreted. Grounds: RFC 3339's ABNF admits any 4-digit year lexically while
      // delegating the calendar to ISO 8601, whose calendar has no year 0000; Python's
      // `datetime` cannot represent year 0 at all, so no runtime on this side could ever
      // honor it; and no job exists in year 0. A producer running zod could otherwise emit
      // a year-0000 envelope the worker would refuse — the divergence this contract exists
      // to eliminate. `.datetime()` has already pinned the `YYYY-MM-DD…` shape, so the
      // prefix check below is precise about year 0000.
      .refine((instant) => !instant.startsWith('0000-'), {
        message: 'occurred_at year must be in 0001-9999: the ISO 8601 calendar has no year 0000',
      }),
  })
  .strict();

export type DispatchEnvelope = z.infer<typeof dispatchEnvelopeSchema>;

/**
 * Parse an unknown JSON value as a v1 dispatch envelope.
 *
 * Throws (zod's `ZodError`) on anything invalid: a non-object value, an unsupported `type`
 * (a new version is a contract change, never something to shrug at), a missing or wrong-typed
 * field, a non-RFC-3339 `occurred_at`, or an extra field.
 */
export function parseDispatchEnvelope(value: unknown): DispatchEnvelope {
  return dispatchEnvelopeSchema.parse(value);
}