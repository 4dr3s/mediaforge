/**
 * WU-2 / task 1.1 — the schema contract suite (RED-first).
 *
 * Every assertion here reads the **migrated database**, never the schema file. That is the point:
 * Prisma cannot express the `state` enum, the three CHECK constraints or the partial outbox index,
 * so those live only in the hand-edited migration. A schema file that says the right thing while
 * the database says something else is exactly the failure this suite exists to catch, and only the
 * database can prove what landed.
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
 * Unique/primary constraints as sorted column sets, so comparison does not depend on the order the
 * columns were declared in — uniqueness does not care about order, and neither should the test.
 */
async function uniqueColumnSets(client: Client, table: string): Promise<string[][]> {
  const { rows } = await client.query<{ cols: string[] }>(
    `SELECT array_agg(a.attname ORDER BY a.attname) AS cols
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype IN ('u', 'p') AND t.relname = $1
      GROUP BY c.conname`,
    [table],
  );
  return rows.map((row) => row.cols);
}

/** Index definitions, straight from the catalog, so a partial index is visible as written. */
async function indexDefs(client: Client, table: string): Promise<string[]> {
  const { rows } = await client.query<{ indexdef: string }>(
    `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1`,
    [table],
  );
  return rows.map((row) => row.indexdef);
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

async function checkConstraintDefs(client: Client, table: string): Promise<string[]> {
  const { rows } = await client.query<{ def: string }>(
    `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
      WHERE c.contype = 'c' AND t.relname = $1`,
    [table],
  );
  return rows.map((row) => row.def);
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

/** The one exception in §4: no database default, because the worker mints this id. */
const PK_WITH_DATABASE_DEFAULT = ['jobs', 'job_inputs', 'attempts', 'submissions', 'outbox'];

describe('schema :: tables exist', () => {
  it('creates exactly the six tables of the ERD', async () => {
    await withClient(async (client) => {
      const { rows } = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          ORDER BY table_name`,
      );

      expect(rows.map((row) => row.table_name)).toEqual([...EXPECTED_TABLES].sort());
    });
  });
});

describe('schema :: the six states, and no seventh', () => {
  it('types jobs.state as an enum whose labels are exactly the six canonical states', async () => {
    await withClient(async (client) => {
      const stateColumn = (await columnsOf(client, 'jobs')).find(
        (column) => column.column_name === 'state',
      );
      expect(stateColumn, 'jobs.state is missing').toBeDefined();

      // The label set is read from whatever type the column actually uses, so this assertion does
      // not depend on the type's name — only on the fact that it is an enum with these six labels.
      const { rows } = await client.query<{ enumlabel: string }>(
        `SELECT e.enumlabel
           FROM pg_enum e
           JOIN pg_type ty ON ty.oid = e.enumtypid
          WHERE ty.typname = $1
          ORDER BY e.enumlabel`,
        [stateColumn!.udt_name],
      );

      expect(rows.map((row) => row.enumlabel)).toEqual([
        'canceled',
        'created',
        'failed',
        'queued',
        'running',
        'succeeded',
      ]);
    });
  });
});

describe('schema :: uniqueness is enforced, and by the engine', () => {
  it('declares the four unique column sets the ERD requires', async () => {
    await withClient(async (client) => {
      expect(await uniqueColumnSets(client, 'job_inputs')).toContainEqual(['job_id', 'ordinal']);
      expect(await uniqueColumnSets(client, 'attempts')).toContainEqual(['job_id', 'attempt_no']);
      expect(await uniqueColumnSets(client, 'submissions')).toContainEqual([
        'client_id',
        'idempotency_key',
      ]);
      expect(await uniqueColumnSets(client, 'submissions')).toContainEqual(['job_id']);
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

describe('schema :: ids are database-minted', () => {
  it('defaults every primary key to uuidv7() except artifacts.id', async () => {
    await withClient(async (client) => {
      for (const table of PK_WITH_DATABASE_DEFAULT) {
        const id = (await columnsOf(client, table)).find((column) => column.column_name === 'id');
        expect(id?.column_default, `${table}.id has no uuidv7() default`).toMatch(/uuidv7\(\)/);
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
  it('indexes outbox (published_at) WHERE published_at IS NULL', async () => {
    await withClient(async (client) => {
      const defs = await indexDefs(client, 'outbox');
      const partial = defs.find(
        (def) => /published_at/.test(def) && /WHERE\s*\(?published_at IS NULL/i.test(def),
      );

      expect(partial, `no partial outbox index; found:\n${defs.join('\n')}`).toBeDefined();
    });
  });
});

describe('schema :: CHECK constraints Prisma cannot express', () => {
  it('constrains ordinal, attempt_no and error_class', async () => {
    await withClient(async (client) => {
      const inputChecks = (await checkConstraintDefs(client, 'job_inputs')).join(' | ');
      const attemptChecks = (await checkConstraintDefs(client, 'attempts')).join(' | ');

      expect(inputChecks).toMatch(/ordinal\s*>=\s*1/);
      expect(attemptChecks).toMatch(/attempt_no\s*>=\s*1/);
      expect(attemptChecks).toMatch(/error_class/i);
      expect(attemptChecks).toMatch(/retryable/);
      expect(attemptChecks).toMatch(/non_retryable/);
    });
  });
});

describe('schema :: types are the ones the model declares', () => {
  it('uses timestamptz, bigint and jsonb where the ERD says so', async () => {
    await withClient(async (client) => {
      const jobs = await columnsOf(client, 'jobs');
      const jobInputs = await columnsOf(client, 'job_inputs');
      const artifacts = await columnsOf(client, 'artifacts');

      const typeOf = (rows: ColumnRow[], column: string) =>
        rows.find((row) => row.column_name === column)?.data_type;

      expect(typeOf(jobs, 'params')).toBe('jsonb');
      expect(typeOf(jobs, 'created_at')).toBe('timestamp with time zone');
      expect(typeOf(jobs, 'available_at')).toBe('timestamp with time zone');
      expect(typeOf(jobInputs, 'byte_size')).toBe('bigint');
      expect(typeOf(artifacts, 'expires_at')).toBe('timestamp with time zone');
    });
  });
});

describe('schema :: every foreign key is indexed', () => {
  it('has an index whose leading column is each foreign-key column', async () => {
    await withClient(async (client) => {
      const keys = await foreignKeys(client);
      expect(keys.length).toBeGreaterThan(0);

      const unindexed: string[] = [];
      for (const key of keys) {
        const leading = await leadingIndexColumns(client, key.table);
        if (!leading.includes(key.column)) {
          unindexed.push(`${key.table}.${key.column} -> ${key.references}`);
        }
      }

      expect(unindexed).toEqual([]);
    });
  });
});
