/**
 * WU-2 / task 1.1 — the schema contract suite (RED-first).
 *
 * Every assertion here reads the **migrated database**, never the schema file. That is the point:
 * Prisma cannot express the two CHECK constraints or the partial outbox index, so those live only
 * in the hand-edited migration. A schema file that says the right thing while the database says
 * something else is exactly the failure this suite exists to catch, and only the database can
 * prove what landed.
 *
 * (Correction, recorded here rather than repeated: `design.md` §5 claims the `state` enum is also
 * something Prisma cannot express, but Prisma *can* express enums natively — it generates the
 * `CREATE TYPE` for `state`, `error_class` and `event_type` on `prisma migrate`. Only the two
 * CHECK constraints and the partial index are hand-edited into the generated migration.)
 *
 * The catalog is the contract, and one behavioral assertion proves the catalog is not a story: a
 * duplicate ordinal must be rejected by the engine, not merely declared in `pg_constraint`.
 *
 * `design.md` §3 (the ERD) is the authoritative model; §4 fixes the id strategy (every PK except
 * `artifacts.id` defaults to `uuidv7()`, and `artifacts.id` deliberately has no default because the
 * worker mints it with `SELECT uuidv7()` before promote).
 *
 * One connection per test, as in `harness.spec.ts`, and for the same measured reason: a shared
 * `beforeAll` client turns an unreachable database into `skipped`, which reads as "nothing was
 * checked" instead of "PostgreSQL is not answering".
 */
import { describe, expect, it } from 'vitest';

import { PrismaClient } from '../generated/prisma/client';
import { withClient } from './prisma-client';

/**
 * Thrown at the end of every deliberate transaction in this file. Prisma rolls back when the
 * callback throws, so this is how a test asks for a rollback — and asserting the *sentinel* is what
 * keeps a deliberate rollback distinguishable from a database error. A test that merely expected
 * "it threw" would pass on a typo in the statement.
 */
const ROLLBACK = new Error('rollback on purpose');

type ColumnRow = {
  column_name: string;
  data_type: string;
  udt_name: string;
  column_default: string | null;
  is_nullable: string;
};

/** The columns of a table, in declaration order. An empty array means the table does not exist. */
async function columnsOf(client: PrismaClient, table: string): Promise<ColumnRow[]> {
  return await client.$queryRaw<ColumnRow[]>`
    SELECT column_name, data_type, udt_name, column_default, is_nullable
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ${table}
     ORDER BY ordinal_position`;
}

/**
 * Unique/primary indexes as sorted column sets, so comparison does not depend on the order the
 * columns were declared in — uniqueness does not care about order, and neither should the test.
 *
 * Read **indexes**, not `pg_constraint` rows: Prisma emits `CREATE UNIQUE INDEX` for
 * `@unique`/`@@unique` (a unique `@id` is the same) and that creates no `pg_constraint` row, so a
 * correct schema would fail every assertion made against constraints. Partial unique indexes
 * (`indpred IS NOT NULL`) are excluded because they enforce uniqueness only inside their subset,
 * never globally.
 */
async function uniqueColumnSets(client: PrismaClient, table: string): Promise<string[][]> {
  // `json_agg`, not `array_agg`: the driver under Prisma is still node-postgres, which does not
  // parse `text[]` results — `array_agg` arrives as the literal string `'{job_id,ordinal}'` and
  // every comparison against a real array fails. `json` IS parsed, so the driver hands back an
  // actual array. Measured in the GREEN run: the `array_agg` version reported `'{id}'` where
  // `['id']` was expected.
  const rows = await client.$queryRaw<{ cols: string[] }[]>`
    SELECT json_agg(a.attname ORDER BY a.attname) AS cols
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
     WHERE i.indisunique AND i.indpred IS NULL AND t.relname = ${table}
     GROUP BY i.indexrelid`;
  return rows.map((row) => row.cols);
}

/** The leading column of every index on a table: what a single-column lookup can actually use. */
async function leadingIndexColumns(client: PrismaClient, table: string): Promise<string[]> {
  const rows = await client.$queryRaw<{ column_name: string }[]>`
    SELECT a.attname AS column_name
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
     WHERE t.relname = ${table}`;
  return rows.map((row) => row.column_name);
}

/**
 * Partial (predicated) indexes, with their leading key column, key-column count and raw predicate
 * expression. A partial index cannot be verified as *the* relay-poll index from its DDL string
 * alone: the leading column is what the poll's plan actually uses, so it must be checked too.
 */
async function partialIndexes(
  client: PrismaClient,
  table: string,
): Promise<{ column_name: string; key_columns: number; predicate: string }[]> {
  return await client.$queryRaw<
    { column_name: string; key_columns: number; predicate: string }[]
  >`
    SELECT a.attname AS column_name, i.indnkeyatts AS key_columns,
           pg_get_expr(i.indpred, i.indrelid) AS predicate
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
     WHERE t.relname = ${table} AND i.indpred IS NOT NULL`;
}

/**
 * CHECK constraints of a table, with the columns each one references. Tying a check to its column
 * via `conkey` is what "a constraint ON column X" means: a constraint that merely mentions
 * `ordinal` in its text while constraining a different column is not a constraint on it.
 */
async function checkConstraints(
  client: PrismaClient,
  table: string,
): Promise<{ def: string; columns: string[] }[]> {
  // `json_agg` for the column list as well, for the same reason as `uniqueColumnSets`: the driver
  // does not hand back a `text[]` as an array, and a string would make `columns.includes(...)`
  // either wrong or a type error.
  return await client.$queryRaw<{ def: string; columns: string[] }[]>`
    SELECT pg_get_constraintdef(c.oid) AS def,
           COALESCE(
             (SELECT json_agg(a.attname)
                FROM pg_attribute a
               WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)),
             '[]'::json) AS columns
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
     WHERE c.contype = 'c' AND t.relname = ${table}`;
}

/** The columns of a table's primary key, or an empty array when the table has none. */
async function primaryKeyColumns(client: PrismaClient, table: string): Promise<string[]> {
  // `json_agg` for the same measured reason as `uniqueColumnSets` above.
  const rows = await client.$queryRaw<{ cols: string[] }[]>`
    SELECT json_agg(a.attname ORDER BY a.attnum) AS cols
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
     WHERE t.relname = ${table} AND i.indisprimary
     GROUP BY i.indexrelid`;
  return rows.length > 0 ? rows[0].cols : [];
}

/** Every foreign-key column of a table, with the table it points at. */
async function foreignKeys(
  client: PrismaClient,
): Promise<{ table: string; column: string; references: string }[]> {
  return await client.$queryRaw<{ table: string; column: string; references: string }[]>`
    SELECT tc.table_name AS table, kcu.column_name AS column, ccu.table_name AS references
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`;
}

const EXPECTED_TABLES = ['jobs', 'job_inputs', 'attempts', 'submissions', 'artifacts', 'outbox'];

/** `design.md` §3, column for column. `jobs` carries no counter: `attempts_used` is derived. */
const EXPECTED_JOB_COLUMNS = [
  'id',
  'job_type',
  'params',
  'state',
  'available_at',
  'error_code',
  'artifact_id',
  'created_at',
  'updated_at',
];

const PK_WITH_DATABASE_DEFAULT = ['jobs', 'job_inputs', 'attempts', 'submissions', 'outbox'];

/**
 * Column sets are compared **order-insensitively**: uniqueness does not care which column was
 * declared first, so neither should the assertion. Written as an explicit sort rather than relying on
 * the helper's `ORDER BY`, so the intent survives a change to that query. Measured in the GREEN run:
 * an expectation written in declaration order (`['job_id','attempt_no']`) failed against the
 * correctly-sorted `['attempt_no','job_id']` — the schema was right and the assertion was wrong.
 */
const setOf = (columns: string[]): string[] => [...columns].sort();

/**
 * The ERD (§3), column for column, in declaration order: name, `information_schema` `data_type`,
 * and nullability. `nullable: true` exactly where the ERD marks a column nullable; every other
 * column is NOT NULL. An empty or partial table, a wrong type, or a column whose nullability
 * disagrees with the ERD in either direction all fail here.
 */
type ColumnSpec = { name: string; data_type: string; nullable: boolean };

const EXPECTED_COLUMNS: Record<string, ColumnSpec[]> = {
  jobs: [
    { name: 'id', data_type: 'uuid', nullable: false },
    { name: 'job_type', data_type: 'text', nullable: false },
    { name: 'params', data_type: 'jsonb', nullable: false },
    // `USER-DEFINED` is `information_schema`'s answer for any enum; the label set and its order
    // are asserted separately against the column's actual type.
    { name: 'state', data_type: 'USER-DEFINED', nullable: false },
    { name: 'available_at', data_type: 'timestamp with time zone', nullable: false },
    { name: 'error_code', data_type: 'text', nullable: true },
    { name: 'artifact_id', data_type: 'uuid', nullable: true },
    { name: 'created_at', data_type: 'timestamp with time zone', nullable: false },
    { name: 'updated_at', data_type: 'timestamp with time zone', nullable: false },
  ],
  job_inputs: [
    { name: 'id', data_type: 'uuid', nullable: false },
    { name: 'job_id', data_type: 'uuid', nullable: false },
    { name: 'ordinal', data_type: 'integer', nullable: false },
    { name: 'declared_type', data_type: 'text', nullable: false },
    { name: 'storage_key', data_type: 'text', nullable: false },
    { name: 'display_name', data_type: 'text', nullable: true },
    { name: 'byte_size', data_type: 'bigint', nullable: false },
    { name: 'created_at', data_type: 'timestamp with time zone', nullable: false },
  ],
  attempts: [
    { name: 'id', data_type: 'uuid', nullable: false },
    { name: 'job_id', data_type: 'uuid', nullable: false },
    { name: 'attempt_no', data_type: 'integer', nullable: false },
    { name: 'lease_owner', data_type: 'text', nullable: false },
    { name: 'lease_expires_at', data_type: 'timestamp with time zone', nullable: false },
    { name: 'started_at', data_type: 'timestamp with time zone', nullable: false },
    { name: 'ended_at', data_type: 'timestamp with time zone', nullable: true },
    // `USER-DEFINED` for the same reason as `jobs.state`: the label set and its order are
    // asserted separately against the column's actual type.
    { name: 'error_class', data_type: 'USER-DEFINED', nullable: true },
    { name: 'error_code', data_type: 'text', nullable: true },
    { name: 'created_at', data_type: 'timestamp with time zone', nullable: false },
  ],
  submissions: [
    { name: 'id', data_type: 'uuid', nullable: false },
    { name: 'job_id', data_type: 'uuid', nullable: false },
    // `client_id` is gone (task 1.7): idempotency is one globally unique key, and it must be NOT
    // NULL — a nullable key is no key, because PostgreSQL treats NULLs as distinct.
    { name: 'idempotency_key', data_type: 'text', nullable: false },
    { name: 'creator_token_hash', data_type: 'text', nullable: false },
    { name: 'created_at', data_type: 'timestamp with time zone', nullable: false },
  ],
  artifacts: [
    { name: 'id', data_type: 'uuid', nullable: false },
    { name: 'job_id', data_type: 'uuid', nullable: false },
    { name: 'storage_key', data_type: 'text', nullable: false },
    { name: 'byte_size', data_type: 'bigint', nullable: false },
    { name: 'content_type', data_type: 'text', nullable: false },
    { name: 'checksum', data_type: 'text', nullable: false },
    { name: 'filename', data_type: 'text', nullable: false },
    { name: 'created_at', data_type: 'timestamp with time zone', nullable: false },
    { name: 'expires_at', data_type: 'timestamp with time zone', nullable: false },
  ],
  outbox: [
    { name: 'id', data_type: 'uuid', nullable: false },
    { name: 'job_id', data_type: 'uuid', nullable: false },
    // `USER-DEFINED`: `event_type` is an enum whose single label is asserted separately.
    { name: 'event_type', data_type: 'USER-DEFINED', nullable: false },
    { name: 'payload', data_type: 'jsonb', nullable: false },
    { name: 'published_at', data_type: 'timestamp with time zone', nullable: true },
    { name: 'attempts', data_type: 'integer', nullable: false },
    { name: 'created_at', data_type: 'timestamp with time zone', nullable: false },
  ],
};

/** `design.md` §3 relationships, verbatim: table.column -> target table. One entry per FK. */
const EXPECTED_FOREIGN_KEYS = [
  'artifacts.job_id -> jobs',
  'attempts.job_id -> jobs',
  'job_inputs.job_id -> jobs',
  'jobs.artifact_id -> artifacts',
  'outbox.job_id -> jobs',
  'submissions.job_id -> jobs',
].sort();

describe('schema :: tables exist', () => {
  it('creates exactly the six tables of the ERD', async () => {
    await withClient(async (client) => {
      const rows = await client.$queryRaw<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
           AND table_name <> '_prisma_migrations'
         ORDER BY table_name`;

      // `_prisma_migrations` is excluded on purpose: it is Prisma's own migration ledger, created
      // by the tool that applies this schema, not a table of the domain model. Counting it would
      // make the assertion fail on every correctly migrated database.
      expect(rows.map((row) => row.table_name)).toEqual([...EXPECTED_TABLES].sort());
    });
  });
});

describe('schema :: the six states, and no seventh', () => {
  it('types jobs.state as an enum whose labels are exactly the six canonical states, in order', async () => {
    await withClient(async (client) => {
      const stateColumn = (await columnsOf(client, 'jobs')).find(
        (column) => column.column_name === 'state',
      );
      expect(stateColumn, 'jobs.state is missing').toBeDefined();

      // The label list is read from whatever type the column actually uses, so this assertion does
      // not depend on the type's name — only on the fact that it is an enum with these six labels.
      // `enumsortorder` is the order the type was *declared* in (the order §3 fixes), not the
      // alphabetical order a label-set comparison would silently allow.
      const rows = await client.$queryRaw<{ enumlabel: string }[]>`
        SELECT e.enumlabel
          FROM pg_enum e
          JOIN pg_type ty ON ty.oid = e.enumtypid
         WHERE ty.typname = ${stateColumn!.udt_name}
         ORDER BY e.enumsortorder`;

      expect(rows.map((row) => row.enumlabel)).toEqual([
        'created',
        'queued',
        'running',
        'succeeded',
        'failed',
        'canceled',
      ]);
    });
  });
});

describe('schema :: uniqueness is enforced, and by the engine', () => {
  it('declares the four unique column sets the ERD requires', async () => {
    await withClient(async (client) => {
      expect(await uniqueColumnSets(client, 'job_inputs')).toContainEqual(setOf(['job_id', 'ordinal']));
      expect(await uniqueColumnSets(client, 'attempts')).toContainEqual(
        setOf(['job_id', 'attempt_no']),
      );
      // The `(client_id, idempotency_key)` pair is gone with `client_id` (task 1.7): the key is
      // unique globally, so a repeated key is rejected no matter who submitted it.
      expect(await uniqueColumnSets(client, 'submissions')).toContainEqual(
        setOf(['idempotency_key']),
      );
      expect(await uniqueColumnSets(client, 'submissions')).toContainEqual(setOf(['job_id']));
    });
  });

  it('rejects a duplicate (job_id, ordinal) with a real unique violation', async () => {
    await withClient(async (client) => {
      await expect(
        client.$transaction(async (tx) => {
          // The generated client, not raw SQL. It is the client the application uses, so exercising
          // it here proves the schema and the client agree — and it is parameterized by
          // construction, which is the honest way to answer a linter that flags interpolation in a
          // raw statement instead of suppressing it.
          const job = await tx.job.create({
            data: {
              jobType: 'audio.extract',
              params: {},
              state: 'created',
              availableAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          const insertInput = (ordinal: number) =>
            tx.jobInput.create({
              data: {
                jobId: job.id,
                ordinal,
                declaredType: 'video/mp4',
                storageKey: `inbox/${job.id}/${ordinal}`,
                byteSize: 1024n,
                createdAt: new Date(),
              },
            });

          await insertInput(1);

          // `P2002` is Prisma's code for a unique-constraint violation, and asserting *that code*
          // rather than "it threw" is what makes this a statement about the constraint: a typo in
          // the call would fail differently and would not pass.
          await expect(insertInput(1)).rejects.toMatchObject({ code: 'P2002' });

          throw ROLLBACK;
        }),
      ).rejects.toBe(ROLLBACK);
    });
  });

  it('accepts ordinal 2, so the CHECK is a lower bound and not an equality', async () => {
    await withClient(async (client) => {
      // Catches `CHECK (ordinal >= 1 AND ordinal <= 1)`: it satisfies the regex the CHECK suite
      // uses while violating the ERD, and only execution tells the two apart.
      await expect(
        client.$transaction(async (tx) => {
          const job = await tx.job.create({
            data: {
              jobType: 'audio.extract',
              params: {},
              state: 'created',
              availableAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          await tx.jobInput.create({
            data: {
              jobId: job.id,
              ordinal: 2,
              declaredType: 'video/mp4',
              storageKey: `inbox/${job.id}/2`,
              byteSize: 1024n,
              createdAt: new Date(),
            },
          });

          throw ROLLBACK;
        }),
      ).rejects.toBe(ROLLBACK);
    });
  });
});

describe('schema :: columns, types and nullability match the ERD', () => {
  for (const [table, expected] of Object.entries(EXPECTED_COLUMNS)) {
    it(`defines ${table} with exactly the ERD columns, their types, and their nullability`, async () => {
      await withClient(async (client) => {
        const actual = (await columnsOf(client, table)).map((column) => ({
          name: column.column_name,
          data_type: column.data_type,
          nullable: column.is_nullable === 'YES',
        }));

        // Exact row-for-row equality, in declaration order: a missing column, an extra column, a
        // wrong type, a nullable-vs-NOT-NULL disagreement — in either direction — all fail here.
        expect(actual, `${table} deviates from design.md §3`).toEqual(expected);
      });
    });
  }
});

describe('schema :: no counter column on jobs', () => {
  it('has exactly the ERD columns, and none of them is a counter', async () => {
    await withClient(async (client) => {
      const names = (await columnsOf(client, 'jobs')).map((column) => column.column_name);

      // Exact set, not a subset: a new column on `jobs` is a deliberate schema change and must
      // update this list on purpose, which is the only way "we did not add a counter" stays true.
      expect(names).toEqual(EXPECTED_JOB_COLUMNS);

      // Stated separately so the failure message names the intent, not just a diff.
      expect(names.filter((name) => /attempt|retry|count/i.test(name))).toEqual([]);
    });
  });

  it('keeps attempts as rows: the table exists and is keyed per attempt', async () => {
    await withClient(async (client) => {
      const names = (await columnsOf(client, 'attempts')).map((column) => column.column_name);

      expect(names).toEqual([
        'id',
        'job_id',
        'attempt_no',
        'lease_owner',
        'lease_expires_at',
        'started_at',
        'ended_at',
        'error_class',
        'error_code',
        'created_at',
      ]);
    });
  });
});

describe('schema :: every table has a primary key', () => {
  it('keys each of the six tables on its id column', async () => {
    await withClient(async (client) => {
      for (const table of EXPECTED_TABLES) {
        expect(
          await primaryKeyColumns(client, table),
          `${table} has no primary key on id`,
        ).toEqual(['id']);
      }
    });
  });
});

describe('schema :: ids are database-minted', () => {
  it('defaults every primary key to uuidv7() except artifacts.id', async () => {
    await withClient(async (client) => {
      for (const table of PK_WITH_DATABASE_DEFAULT) {
        const id = (await columnsOf(client, table)).find((column) => column.column_name === 'id');
        expect(id, `${table}.id is missing`).toBeDefined();

        // Compare the *expression*, not a substring: `'uuidv7()'::uuid` is a literal constant — a
        // fixed value, not a call — and must not satisfy a "database-minted" default. A trailing
        // `::uuid` cast written or rendered on the call itself is the same expression and is
        // stripped first.
        expect(
          (id!.column_default ?? '').replace(/::uuid\s*$/, ''),
          `${table}.id has no uuidv7() default`,
        ).toBe('uuidv7()');
      }

      // The deliberate exception (§4). Asserted as an absence because that absence is what makes
      // the worker's explicit `SELECT uuidv7()` insert legal.
      const artifactsId = (await columnsOf(client, 'artifacts')).find(
        (column) => column.column_name === 'id',
      );
      expect(artifactsId?.column_default, 'artifacts.id must have no default').toBeNull();
    });
  });
});

describe("schema :: the defaults the design's canonical SQL requires", () => {
  it('defaults exactly the three columns §6 inserts without providing, and no other', async () => {
    await withClient(async (client) => {
      const withDefaults: string[] = [];
      for (const table of EXPECTED_TABLES) {
        for (const column of await columnsOf(client, table)) {
          // `id` is excluded because every primary key except `artifacts.id` carries a `uuidv7()`
          // default and that is asserted by its own test. What matters here is every *other*
          // column: the design's canonical SQL is what decides, not the ERD drawing, which shows
          // no defaults at all.
          if (column.column_name !== 'id' && column.column_default !== null) {
            withDefaults.push(`${table}.${column.column_name}`);
          }
        }
      }

      // `design.md` §6 inserts `outbox` (line 355) and `attempts` (line 379) without these columns,
      // and all three are NOT NULL — so they cannot be un-defaulted. No other column may carry one:
      // a default where the design is silent would paper over a forgotten value instead of failing
      // loudly, which is the whole reason the other columns have none.
      expect(withDefaults.sort()).toEqual([
        'attempts.created_at',
        'outbox.attempts',
        'outbox.created_at',
      ]);

      const attemptsColumn = (await columnsOf(client, 'outbox')).find(
        (column) => column.column_name === 'attempts',
      );
      expect(attemptsColumn?.column_default, 'outbox.attempts must default to 0').toMatch(/^0/);
    });
  });
});

describe('schema :: the partial index the relay poll needs', () => {
  it('indexes outbox on published_at, WHERE published_at IS NULL', async () => {
    await withClient(async (client) => {
      const partials = await partialIndexes(client, 'outbox');
      const relayPoll = partials.find(
        (index) =>
          index.column_name === 'published_at' &&
          index.key_columns === 1 &&
          // pg_get_expr wraps the boolean in parens; strip exactly one outer pair before the exact
          // comparison, so `WHERE published_at IS NULL AND <anything>` cannot pass as "the" index.
          index.predicate.replace(/^\((.*)\)$/, '$1') === 'published_at IS NULL',
      );

      expect(
        relayPoll,
        `no partial outbox index (published_at) WHERE published_at IS NULL; found:\n${
          partials
            .map((p) => `  ${p.column_name}${p.key_columns > 1 ? ' +…' : ''} WHERE ${p.predicate}`)
            .join('\n') || '  (none)'
        }`,
      ).toBeDefined();
    });
  });
});

describe('schema :: CHECK constraints Prisma cannot express', () => {
  it('constrains ordinal and attempt_no, each on its own column', async () => {
    await withClient(async (client) => {
      const inputs = await checkConstraints(client, 'job_inputs');
      const attempts = await checkConstraints(client, 'attempts');

      const onColumn = (checks: { def: string; columns: string[] }[], column: string) =>
        checks.filter((check) => check.columns.includes(column));

      // The column binding comes from the catalog (`conkey`), so a constraint that merely mentions
      // `ordinal` in its text while constraining a different column does not pass. The regex is a
      // spelling check for the canonical form `>= 1`, not a semantic proof: for an integer, `> 0`
      // is equivalent, and review should accept it — the gate must not pretend a regex proves the
      // lower bound exists.
      const ordinal = onColumn(inputs, 'ordinal');
      expect(ordinal.length, 'no CHECK on job_inputs.ordinal').toBeGreaterThan(0);
      expect(
        ordinal.some((check) => /ordinal\s*>=\s*1/.test(check.def)),
        'no CHECK spelling ordinal >= 1 on job_inputs',
      ).toBe(true);

      const attemptNo = onColumn(attempts, 'attempt_no');
      expect(attemptNo.length, 'no CHECK on attempts.attempt_no').toBeGreaterThan(0);
      expect(
        attemptNo.some((check) => /attempt_no\s*>=\s*1/.test(check.def)),
        'no CHECK spelling attempt_no >= 1 on attempts',
      ).toBe(true);

      // `error_class` is not here. Its domain moved from CHECK-constrained text to the
      // `FailureClass` enum, asserted in the enum suite below.
    });
  });
});

describe('schema :: closed-set domains are enum types, not CHECK-constrained text', () => {
  it('types attempts.error_class as an enum with exactly retryable and non_retryable, in order, and keeps it nullable', async () => {
    await withClient(async (client) => {
      const errorClass = (await columnsOf(client, 'attempts')).find(
        (column) => column.column_name === 'error_class',
      );
      expect(errorClass, 'attempts.error_class is missing').toBeDefined();

      // The CHECK is gone on purpose (task 1.7): a CHECK could be written in a way that forbids
      // NULL on a column the design declares nullable, and a type cannot. The enum still rejects
      // a third value exactly as the CHECK did, and the column stays nullable by declaration.
      expect(errorClass!.is_nullable, 'attempts.error_class must stay nullable').toBe('YES');

      // `enumsortorder` is the order the type was *declared* in, not alphabetical order — the
      // same claim the `jobs.state` suite makes, for a domain of two.
      const rows = await client.$queryRaw<{ enumlabel: string }[]>`
        SELECT e.enumlabel
          FROM pg_enum e
          JOIN pg_type ty ON ty.oid = e.enumtypid
         WHERE ty.typname = ${errorClass!.udt_name}
         ORDER BY e.enumsortorder`;

      expect(rows.map((row) => row.enumlabel)).toEqual(['retryable', 'non_retryable']);
    });
  });

  it('types outbox.event_type as an enum whose label is exactly job.queued', async () => {
    await withClient(async (client) => {
      const eventType = (await columnsOf(client, 'outbox')).find(
        (column) => column.column_name === 'event_type',
      );
      expect(eventType, 'outbox.event_type is missing').toBeDefined();

      const rows = await client.$queryRaw<{ enumlabel: string }[]>`
        SELECT e.enumlabel
          FROM pg_enum e
          JOIN pg_type ty ON ty.oid = e.enumtypid
         WHERE ty.typname = ${eventType!.udt_name}
         ORDER BY e.enumsortorder`;

      expect(rows.map((row) => row.enumlabel)).toEqual(['job.queued']);
    });
  });
});

describe('schema :: foreign keys match the ERD', () => {
  it('declares exactly the six foreign keys of the ERD, with their target tables', async () => {
    await withClient(async (client) => {
      const actual = (await foreignKeys(client))
        .map((key) => `${key.table}.${key.column} -> ${key.references}`)
        .sort();

      // Exact set, with targets: a missing FK (say no `outbox.job_id`), a copy that points at the
      // wrong table, or an FK the ERD does not declare all fail here.
      expect(actual).toEqual(EXPECTED_FOREIGN_KEYS);
    });
  });

  it('has an index whose leading column is each foreign-key column', async () => {
    await withClient(async (client) => {
      const unindexed: string[] = [];
      for (const key of EXPECTED_FOREIGN_KEYS) {
        const [tableAndColumn] = key.split(' -> ');
        const [table, column] = tableAndColumn.split('.');
        const leading = await leadingIndexColumns(client, table);
        if (!leading.includes(column)) {
          unindexed.push(key);
        }
      }

      expect(unindexed).toEqual([]);
    });
  });
});