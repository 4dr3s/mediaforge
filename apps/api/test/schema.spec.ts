/**
 * WU-2 / task 1.1 — the schema contract suite (RED-first).
 *
 * Every assertion here reads the **migrated database**, never the schema file. That is the point:
 * Prisma cannot express the three CHECK constraints or the partial outbox index, so those live
 * only in the hand-edited migration. A schema file that says the right thing while the database
 * says something else is exactly the failure this suite exists to catch, and only the database
 * can prove what landed.
 *
 * (Correction, recorded here rather than repeated: `design.md` §5 claims the `state` enum is also
 * something Prisma cannot express, but Prisma *can* express it natively — it generates the
 * `CREATE TYPE` for an enum on `prisma migrate`. Only the CHECK constraints and the partial
 * index are hand-edited into the generated migration.)
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
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

const DATABASE_URL_TEST =
  process.env.DATABASE_URL_TEST ?? 'postgresql://postgres:postgres@localhost:5432/mediaforge_test';

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: DATABASE_URL_TEST });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

type ColumnRow = {
  column_name: string;
  data_type: string;
  udt_name: string;
  column_default: string | null;
  is_nullable: string;
};

/** The columns of a table, in declaration order. An empty array means the table does not exist. */
async function columnsOf(client: Client, table: string): Promise<ColumnRow[]> {
  const { rows } = await client.query<ColumnRow>(
    `SELECT column_name, data_type, udt_name, column_default, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [table],
  );
  return rows;
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
async function uniqueColumnSets(client: Client, table: string): Promise<string[][]> {
  // `json_agg`, not `array_agg`: node-postgres does not parse `text[]` results, so `array_agg`
  // arrives as the literal string `'{job_id,ordinal}'` and every comparison against a real array
  // fails. `json` IS parsed by default, so the driver hands back an actual array. Measured in the
  // GREEN run: the `array_agg` version reported `'{id}'` where `['id']` was expected.
  const { rows } = await client.query<{ cols: string[] }>(
    `SELECT json_agg(a.attname ORDER BY a.attname) AS cols
       FROM pg_index i
       JOIN pg_class t ON t.oid = i.indrelid
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
      WHERE i.indisunique AND i.indpred IS NULL AND t.relname = $1
      GROUP BY i.indexrelid`,
    [table],
  );
  return rows.map((row) => row.cols);
}

/** The leading column of every index on a table: what a single-column lookup can actually use. */
async function leadingIndexColumns(client: Client, table: string): Promise<string[]> {
  const { rows } = await client.query<{ column_name: string }>(
    `SELECT a.attname AS column_name
       FROM pg_index i
       JOIN pg_class t ON t.oid = i.indrelid
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
      WHERE t.relname = $1`,
    [table],
  );
  return rows.map((row) => row.column_name);
}

/**
 * Partial (predicated) indexes, with their leading key column, key-column count and raw predicate
 * expression. A partial index cannot be verified as *the* relay-poll index from its DDL string
 * alone: the leading column is what the poll's plan actually uses, so it must be checked too.
 */
async function partialIndexes(
  client: Client,
  table: string,
): Promise<{ column_name: string; key_columns: number; predicate: string }[]> {
  const { rows } = await client.query<{
    column_name: string;
    key_columns: number;
    predicate: string;
  }>(
    `SELECT a.attname AS column_name, i.indnkeyatts AS key_columns,
            pg_get_expr(i.indpred, i.indrelid) AS predicate
       FROM pg_index i
       JOIN pg_class t ON t.oid = i.indrelid
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
      WHERE t.relname = $1 AND i.indpred IS NOT NULL`,
    [table],
  );
  return rows;
}

/**
 * CHECK constraints of a table, with the columns each one references. Tying a check to its column
 * via `conkey` is what "a constraint ON column X" means: a constraint that merely mentions
 * `error_class` in its text while constraining a different column is not a constraint on it.
 */
async function checkConstraints(
  client: Client,
  table: string,
): Promise<{ def: string; columns: string[] }[]> {
  const { rows } = await client.query<{ def: string; columns: string[] }>(
    `SELECT pg_get_constraintdef(c.oid) AS def,
            ARRAY(SELECT a.attname
                    FROM pg_attribute a
                   WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)) AS columns
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
      WHERE c.contype = 'c' AND t.relname = $1`,
    [table],
  );
  return rows;
}

/** The columns of a table's primary key, or an empty array when the table has none. */
async function primaryKeyColumns(client: Client, table: string): Promise<string[]> {
  // `json_agg` for the same measured reason as `uniqueColumnSets` above.
  const { rows } = await client.query<{ cols: string[] }>(
    `SELECT json_agg(a.attname ORDER BY a.attnum) AS cols
       FROM pg_index i
       JOIN pg_class t ON t.oid = i.indrelid
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
      WHERE t.relname = $1 AND i.indisprimary
      GROUP BY i.indexrelid`,
    [table],
  );
  return rows.length > 0 ? rows[0].cols : [];
}

/** Every foreign-key column of a table, with the table it points at. */
async function foreignKeys(
  client: Client,
): Promise<{ table: string; column: string; references: string }[]> {
  const { rows } = await client.query<{ table: string; column: string; references: string }>(
    `SELECT tc.table_name AS table, kcu.column_name AS column, ccu.table_name AS references
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`,
  );
  return rows;
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
    { name: 'error_class', data_type: 'text', nullable: true },
    { name: 'error_code', data_type: 'text', nullable: true },
    { name: 'created_at', data_type: 'timestamp with time zone', nullable: false },
  ],
  submissions: [
    { name: 'id', data_type: 'uuid', nullable: false },
    { name: 'job_id', data_type: 'uuid', nullable: false },
    { name: 'client_id', data_type: 'text', nullable: true },
    { name: 'idempotency_key', data_type: 'text', nullable: true },
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
    { name: 'event_type', data_type: 'text', nullable: false },
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
      const { rows } = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            AND table_name <> '_prisma_migrations'
          ORDER BY table_name`,
      );

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
      const { rows } = await client.query<{ enumlabel: string }>(
        `SELECT e.enumlabel
           FROM pg_enum e
           JOIN pg_type ty ON ty.oid = e.enumtypid
          WHERE ty.typname = $1
          ORDER BY e.enumsortorder`,
        [stateColumn!.udt_name],
      );

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
      expect(await uniqueColumnSets(client, 'submissions')).toContainEqual(
        setOf(['client_id', 'idempotency_key']),
      );
      expect(await uniqueColumnSets(client, 'submissions')).toContainEqual(setOf(['job_id']));
    });
  });

  it('rejects a duplicate (job_id, ordinal) with a real unique violation', async () => {
    await withClient(async (client) => {
      await client.query('BEGIN');
      try {
        const { rows: jobRows } = await client.query<{ id: string }>(
          `INSERT INTO jobs (job_type, params, state, available_at, created_at, updated_at)
           VALUES ('audio.extract', '{}'::jsonb, 'created', now(), now(), now())
           RETURNING id`,
        );
        const jobId = jobRows[0].id;

        const insertInput = (ordinal: number) =>
          client.query(
            `INSERT INTO job_inputs (job_id, ordinal, declared_type, storage_key, byte_size, created_at)
             VALUES ($1, $2, 'video/mp4', $3, 1024, now())`,
            [jobId, ordinal, `inbox/${jobId}/${ordinal}`],
          );

        await insertInput(1);

        // 23505 is `unique_violation`. Asserting the SQLSTATE rather than "it threw" is what makes
        // this a statement about the constraint instead of about any error at all.
        await expect(insertInput(1)).rejects.toMatchObject({ code: '23505' });
      } finally {
        // Rolled back on purpose: this test proves enforcement, it does not leave rows behind.
        await client.query('ROLLBACK');
      }
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
  it('constrains ordinal, attempt_no and error_class, each on its own column', async () => {
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

      // The label set is compared exactly, not searched for: `CHECK (error_class = 'non_retryable')`
      // matched the old `/retryable/` substring inside `non_retryable` while forbidding the
      // retryable label entirely. Extract the quoted literals from every CHECK that references
      // `error_class` and compare the union to the two labels §3 fixes.
      const labels = [
        ...new Set(
          onColumn(attempts, 'error_class').flatMap((check) =>
            [...check.def.matchAll(/'([^']+)'/g)].map((match) => match[1]),
          ),
        ),
      ].sort();
      expect(labels, 'error_class CHECK must allow exactly retryable and non_retryable').toEqual([
        'non_retryable',
        'retryable',
      ]);
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