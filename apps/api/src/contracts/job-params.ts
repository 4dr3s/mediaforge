/**
 * The `audio.extract` parameter object, validated against the param schema the registry declares
 * in `contracts/job-types.json` (C1: the registry is data, not code). C5 validates params
 * against the registry *before* the handler starts; a job with no params is the common case.
 *
 * The registry declares exactly one optional parameter (`quality`, enum `128k | 192k | 320k`);
 * `required` is absent, so everything is optional. An unknown key is a different job's parameter
 * or a typo, and must fail here, not in the handler (`.strict()` rejects it instead of
 * stripping).
 */
import { z } from 'zod';

const audioExtractParamsSchema = z
  .object({
    quality: z.enum(['128k', '192k', '320k']).optional(),
  })
  .strict();

export type AudioExtractParams = z.infer<typeof audioExtractParamsSchema>;

/**
 * Parse an unknown JSON value as `audio.extract` params.
 *
 * Accepts `{}` and `{"quality": "128k" | "192k" | "320k"}`; throws (zod's `ZodError`) on
 * anything else — an enum miss, a non-string value, an unknown key, or a non-object shape.
 */
export function parseAudioExtractParams(value: unknown): AudioExtractParams {
  return audioExtractParamsSchema.parse(value);
}