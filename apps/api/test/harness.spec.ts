/**
 * S1 harness — proves the API's real dependencies exist before any pipeline code does.
 *
 * RED-first (`openspec/config.yaml` -> `testing.strict_tdd`). These two assertions are the gate
 * for every later task: if either of them can pass against the wrong engine, every downstream
 * test lies.
 *
 * Names come from `.env.example` and `design.md` §2.1/§11, not from invention:
 * `DATABASE_URL_TEST` points at the dedicated `mediaforge_test` database.
 *
 * Each test opens and closes its own connection instead of sharing one `beforeAll` client.
 * Measured reason: with a shared `beforeAll` client, an unreachable database fails while setting
 * up *the file*, and vitest reports the two tests as `skipped` — which reads as "nothing was
 * checked" rather than "PostgreSQL is not answering". One connection per test costs milliseconds
 * and makes the failure land on the assertion that owns it, matching `test_harness.py`.
 */
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

const DATABASE_URL_TEST =
  process.env.DATABASE_URL_TEST ?? 'postgresql://postgres:postgres@localhost:5432/mediaforge_test';

/**
 * Version-7 UUID: the version nibble is the 15th hex digit, the variant nibble is the 20th.
 * A v4 UUID (what `uuid_generate_v4()` or a JS library would give us) fails this pattern.
 */
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('harness :: PostgreSQL 18 test database', () => {
  it('connects to the dedicated test database, not the development database', async () => {
    const client = new Client({ connectionString: DATABASE_URL_TEST });
    await client.connect();
    try {
      const { rows } = await client.query<{ db: string }>('SELECT current_database() AS db');

      expect(rows[0].db).toBe('mediaforge_test');
    } finally {
      await client.end();
    }
  });

  it('resolves uuidv7() natively and returns a version-7 UUID', async () => {
    const client = new Client({ connectionString: DATABASE_URL_TEST });
    await client.connect();
    try {
      // `uuidv7()` exists only in PostgreSQL 18+. On an older engine this statement raises an
      // error instead of quietly returning a v4 UUID, which is exactly the failure we want loud:
      // the pipeline's ordering-by-time IDs depend on the engine, not on the application.
      const { rows } = await client.query<{ id: string }>('SELECT uuidv7()::text AS id');

      expect(rows[0].id).toMatch(UUID_V7);
    } finally {
      await client.end();
    }
  });
});
