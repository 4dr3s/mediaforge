/**
 * WU-3 / task 1.1 — the contract parity suite, TypeScript half (RED-first).
 *
 * The deliverable of WU-3 is *agreement*: the TypeScript API and the Python worker must accept
 * and reject exactly the same documents. That is why this suite reads the fixture documents in
 * `contracts/fixtures/` instead of inventing its own values — a document that only one side
 * accepts is a parity failure, not two opinions. The Python half
 * (`workers/media/tests/test_contract_parity.py`) asserts the same facts against the same files.
 *
 * The envelope is a **notification, not the truth** (design.md §7.1): `type`, `job_id`,
 * `occurred_at`, and nothing else. Several assertions in this file exist exactly because of that:
 *
 * - the *key-set* assertion after parsing — zod's default `.strip()` would silently drop an
 *   unknown key, keeping three keys while the envelope stopped being a notification; the moment
 *   it carries parameters or state it is a second, stale copy of the truth. The key-set check
 *   proves what the parsed value *is*, so a tolerant parser cannot launder a fourth field past
 *   the contract;
 * - the *rejection* of a fourth field — the check above would pass under `.strip()`, so this
 *   suite also demands that the parser *refuses* the envelope. Both directions exist on purpose;
 * - the *rejection* of a `type` other than `mediaforge.job.dispatch.v1` — a consumer that
 *   ignores an unsupported version would ack a message the relay will never re-publish
 *   (design.md §7.2 calls that the "silent eternity"), so partial processing is exactly as
 *   forbidden as ignoring it.
 *
 * C3 also requires the contract to be broker-agnostic; the last suite scans the schema, the
 * registry and every fixture for a fixed list of adapter-vocabulary tokens.
 *
 * Expected RED: `apps/api/src/contracts/` does not exist yet, so the two imports below cannot
 * resolve and this file fails to load; the fixture directories are equally absent, so every
 * document sweep starts with a `readdirSync` that raises `ENOENT`. That absence — never a
 * malformed assertion in this file — is the point of this run. Task 1.2 creates the validators
 * and the documents this file reads.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseAudioExtractParams } from '../src/contracts/job-params';
import { parseDispatchEnvelope } from '../src/contracts/envelope';

/** Repo-root `contracts/` directory, resolved from this file's own location (test/ → repo root). */
const CONTRACTS_DIR = fileURLToPath(new URL('../../../contracts/', import.meta.url));

/**
 * The adapter vocabulary that must never reach the domain contract (C3). The list is the
 * dispatch's checklist verbatim — including the misspelled `xautoclave` variant, on purpose:
 * the scan is vocabulary-presence, not spelling, and a contract file containing either spelling
 * is a leak.
 */
const FORBIDDEN_VOCABULARY = [
  'xadd',
  'xreadgroup',
  'xautoclave',
  'xautoclaim',
  'consumer',
  'group',
  'stream',
  'redis',
  'delivery_count',
];

/** The only version this contract ships (design.md §7.1); a different literal is a contract change. */
const ENVELOPE_TYPE_V1 = 'mediaforge.job.dispatch.v1';

/** A v1 envelope that is valid by construction; every rejection test disturbs exactly one property. */
const ENVELOPE_V1 = {
  type: ENVELOPE_TYPE_V1,
  job_id: '01952f1a-c0de-4000-8000-000000000000',
  occurred_at: '2026-09-17T12:00:00Z',
};

/** Read one document, failing with the file's name so a bad fixture is identifiable. */
function readJsonDocument(path: string): unknown {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`cannot read ${path}: ${(error as Error).message}`);
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`${path} is not a well-formed JSON document: ${(error as Error).message}`);
  }
}

function readContract(relative: string): unknown {
  return readJsonDocument(join(CONTRACTS_DIR, relative));
}

/**
 * The sorted `.json` files under `contracts/fixtures/<segments...>`. The non-empty guard exists
 * because an absent or empty directory would otherwise make every sweep pass vacuously — the
 * failure mode the WU-2 privilege suite already caught in its own RED run ("green for a reason
 * unrelated to what is being asserted"). Here the absence is red, on purpose.
 */
function fixtureFiles(...segments: string[]): string[] {
  const directory = join(CONTRACTS_DIR, 'fixtures', ...segments);
  const files = readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .map((name) => join(directory, name))
    .sort();
  expect(files, `contracts/fixtures/${segments.join('/')} has no .json files`).not.toHaveLength(0);
  return files;
}

/**
 * Parsing must throw; `reason` is what the failure message says escaped. Concepts, not text: the
 * implementation is free to phrase errors however it likes, so no assertion pins error wording.
 */
function expectRejectedEnvelope(value: unknown, reason: string): void {
  expect(() => parseDispatchEnvelope(value), `envelope was NOT rejected: ${reason}`).toThrow();
}

describe('dispatch envelope :: the golden fixtures (design.md §7.1)', () => {
  it('parses every fixture in envelopes/valid/, carrying exactly type, job_id and occurred_at', () => {
    const files = fixtureFiles('envelopes', 'valid');
    for (const file of files) {
      const parsed = parseDispatchEnvelope(readJsonDocument(file)) as Record<string, unknown>;

      // Key-set, not subset: a fourth field must fail here even if the parser tolerated it — the
      // assertion is about what the parsed value *is*, so `.strip()` cannot launder an extra
      // field past the contract. The type checks pin the three values to their declared kinds.
      expect(Object.keys(parsed).sort(), file).toEqual(['job_id', 'occurred_at', 'type']);
      expect(parsed.type, file).toBe(ENVELOPE_TYPE_V1);
      expect(typeof parsed.job_id, file).toBe('string');
      expect(typeof parsed.occurred_at, file).toBe('string');
    }
  });

  it('rejects every fixture in envelopes/invalid/, naming the fixture that escaped', () => {
    const files = fixtureFiles('envelopes', 'invalid');
    for (const file of files) {
      expect(
        () => parseDispatchEnvelope(readJsonDocument(file)),
        `${file} was expected to be rejected (missing field, wrong type, bad occurred_at, extra field or unsupported version)`,
      ).toThrow();
    }
  });
});

describe('dispatch envelope :: the rejection contract (design.md §7.1)', () => {
  it('rejects an envelope whose type is not mediaforge.job.dispatch.v1 — including the next plausible version', () => {
    // The version discriminator is the whole point of `type`: a consumer that only knows v1 must
    // reject v2 outright. "Ignored" is forbidden with the same force as "partially processed" —
    // an ack of that message while `outbox.published_at` is set would strand the job in `queued`
    // with nothing left to deliver it (design.md §7.2, the "silent eternity").
    expectRejectedEnvelope(
      { ...ENVELOPE_V1, type: 'mediaforge.job.dispatch.v2' },
      'type mediaforge.job.dispatch.v2 (a new version is a contract change, not a shrug)',
    );
    expectRejectedEnvelope(
      { ...ENVELOPE_V1, type: 'mediaforge.job.dispatch.banana' },
      'type mediaforge.job.dispatch.banana (unknown version)',
    );
  });

  it('rejects an envelope missing any of the three fields', () => {
    for (const missing of ['type', 'job_id', 'occurred_at'] as const) {
      const { [missing]: _dropped, ...rest } = ENVELOPE_V1;
      expectRejectedEnvelope(rest, `missing ${missing}`);
    }
  });

  it('rejects an envelope whose fields have the wrong type', () => {
    expectRejectedEnvelope({ ...ENVELOPE_V1, type: 42 }, 'type is a number, not a string');
    expectRejectedEnvelope({ ...ENVELOPE_V1, job_id: { not: 'a string' } }, 'job_id is an object');
    expectRejectedEnvelope({ ...ENVELOPE_V1, occurred_at: 0 }, 'occurred_at is a number');
  });

  it('rejects a fourth field in the parser, as well as in the key-set assertion', () => {
    // The key-set assertion above catches a parser that tolerates the extra field; this one
    // catches the tolerance itself (zod's default `.strip()` would pass the key-set check while
    // dropping the field). Both directions exist because the moment an envelope carries
    // parameters or state it stops being a notification (C3, glossary §0.1).
    expectRejectedEnvelope({ ...ENVELOPE_V1, environment: 'staging' }, 'a fourth field');
  });

  it('rejects a non-RFC-3339 occurred_at: date-only and offset-less timestamps are not RFC 3339', () => {
    // RFC 3339's time-offset is mandatory, so a bare date or a naive timestamp is not an RFC 3339
    // instant. This is the requirement; the schema and the validator decide the mechanism for it.
    expectRejectedEnvelope({ ...ENVELOPE_V1, occurred_at: '2026-09-17' }, 'date-only');
    expectRejectedEnvelope({ ...ENVELOPE_V1, occurred_at: '2026-09-17T12:00:00' }, 'no time offset');
  });

  it('rejects a value that is not an object at all', () => {
    expectRejectedEnvelope(['not', 'an', 'object'], 'a JSON array is not an envelope');
    expectRejectedEnvelope(
      JSON.stringify(ENVELOPE_V1),
      'a JSON text is not an envelope — the parser reads a value, not a string',
    );
  });
});

describe('audio.extract params :: the fixture documents', () => {
  it('parses every fixture in params/valid/ as audio.extract params', () => {
    const files = fixtureFiles('params', 'valid');
    for (const file of files) {
      expect(
        () => parseAudioExtractParams(readJsonDocument(file)),
        `${file} was expected to parse as audio.extract params`,
      ).not.toThrow();
    }
  });

  it('rejects every fixture in params/invalid/, naming the fixture that escaped', () => {
    const files = fixtureFiles('params', 'invalid');
    for (const file of files) {
      expect(
        () => parseAudioExtractParams(readJsonDocument(file)),
        `${file} was expected to be rejected (quality outside the enum, unknown key, or wrong shape)`,
      ).toThrow();
    }
  });
});

describe('audio.extract params :: the closed shape (registry-declared)', () => {
  it('accepts no params at all: every parameter is optional', () => {
    // C5 validates params against the registry's schema *before* the handler starts; a job with
    // no params is the common case and must not be its first failure.
    expect(() => parseAudioExtractParams({})).not.toThrow();
  });

  it('accepts each of the three enum values', () => {
    for (const quality of ['128k', '192k', '320k'] as const) {
      expect(() => parseAudioExtractParams({ quality }), `quality ${quality} is registry-declared`).not.toThrow();
    }
  });

  it('rejects a quality outside the enum', () => {
    expect(() => parseAudioExtractParams({ quality: '96k' })).toThrow();
  });

  it('rejects a non-string quality', () => {
    expect(() => parseAudioExtractParams({ quality: 320 })).toThrow();
  });

  it('rejects an unknown extra key: exactly one parameter exists', () => {
    expect(() => parseAudioExtractParams({ quality: '320k', bitrate: '256k' })).toThrow();
  });

  it('rejects a params value that is not an object', () => {
    expect(() => parseAudioExtractParams(['not', 'an', 'object'])).toThrow();
  });
});

describe('job-types.json :: the registry is data, not code (C1)', () => {
  it('declares audio.extract as the only job type, with the spec limits and exactly one optional parameter', () => {
    const registry = readContract('job-types.json') as Record<string, unknown>;

    // WU-3 ships exactly one type (the out-of-scope note is explicit); a second entry is a
    // deliberate registry change and must update this list on purpose.
    expect(Object.keys(registry).sort()).toEqual(['audio.extract']);

    const entry = registry['audio.extract'] as Record<string, unknown>;

    // The two literals come from the spec (design.md §2.2, C1): arity 1 and a 200 MB input cap
    // are the *requirement*, so they are asserted as constants, and the MB unit is fixed here
    // ("200 MB" = 200 × 1024 × 1024 bytes). Every other limit is read from the file and only
    // checked for presence and sanity — changing a limit is a registry change, not a test change.
    expect(entry.input_arity).toBe(1);
    expect(entry.input_size_cap_bytes).toBe(200 * 1024 * 1024);

    // C1 requires the registry to declare the **allowed input types** as data, and design §2.2
    // lists the allowlist alongside the caps. Asserted as "non-empty, all strings, canonical
    // container present" rather than as an exact array: the point of a data registry is that
    // adding a container is a registry change, and a test that pinned the list would turn that
    // data change into a test change. Added after the first draft of this suite omitted it
    // entirely, which would have shipped a contract with no allowlist and a gate that could not
    // notice.
    const allowlist = entry.allowed_input_types;
    expect(Array.isArray(allowlist), 'allowed_input_types must be an array').toBe(true);
    expect(
      (allowlist as unknown[]).length,
      'allowed_input_types must not be empty',
    ).toBeGreaterThan(0);
    expect((allowlist as unknown[]).every((type) => typeof type === 'string')).toBe(true);
    expect(allowlist, "video/mp4 is the slice's canonical input").toContain('video/mp4');

    const limits = [
      'output_size_cap_bytes',
      'wall_clock_limit_s',
      'lease_ttl_s',
      'lease_grace_s',
      'attempt_budget',
    ];
    for (const key of limits) {
      expect(
        Number.isInteger(entry[key]) && (entry[key] as number) > 0,
        `${key} is not a positive integer`,
      ).toBe(true);
    }

    const params = entry.params as { properties?: Record<string, unknown>; required?: string[] };
    const properties = params.properties ?? {};
    expect(Object.keys(properties).sort()).toEqual(['quality']);
    const quality = (properties as Record<string, { enum?: string[] }>).quality;
    expect(quality?.enum).toEqual(['128k', '192k', '320k']);

    // Optional = listed as required nowhere; an omitted `required` reads as "nothing required".
    // Together with the single `properties` key, that spells "exactly one optional parameter".
    expect(params.required ?? []).toEqual([]);
  });
});

describe('contract files :: broker-agnostic (C3)', () => {
  it('contains none of the adapter vocabulary in the schema, the registry or any fixture', () => {
    const targets = [
      join(CONTRACTS_DIR, 'dispatch-envelope.schema.json'),
      join(CONTRACTS_DIR, 'job-types.json'),
      ...fixtureFiles('envelopes', 'valid'),
      ...fixtureFiles('envelopes', 'invalid'),
      ...fixtureFiles('params', 'valid'),
      ...fixtureFiles('params', 'invalid'),
    ];

    const offenders: string[] = [];
    for (const file of targets) {
      const text = readFileSync(file, 'utf8').toLowerCase();
      for (const word of FORBIDDEN_VOCABULARY) {
        if (text.includes(word)) {
          offenders.push(`${file} contains "${word}"`);
        }
      }
    }

    // Single assertion so the failure lists every offender at once instead of stopping at the
    // first one. The scan is substring-on-lowercase, which trips on a token anywhere — including
    // inside a string *value*, which is right: `"stream": ...` in a fixture is a leak too.
    expect(offenders).toEqual([]);
  });
});