/**
 * S1 harness — proves the API's real dependencies exist before any pipeline code does.
 *
 * RED-first (`openspec/config.yaml` -> `testing.strict_tdd`). These two assertions are the gate
 * for every later task: if either of them can pass against the wrong engine, every downstream
 * test lies.
 *
 * **These assertions go through the Prisma client** (task 1.4, the supervisor's binding O2). They
 * used to go through `pg` directly, which meant the harness proved a *substitute* could reach the
 * database rather than the client the application actually uses. The stronger claim is the one
 * worth having, and it is the difference between "PostgreSQL answers" and "the application's own
 * path to PostgreSQL works".
 *
 * Names come from `design.md` §2.1/§11, not from invention: `DATABASE_URL_TEST` points at the
 * dedicated `mediaforge_test` database, which `test/prisma-client.ts` resolves.
 *
 * One client per test, through `withClient`, instead of a shared `beforeAll` client. Measured
 * reason: with a shared client, an unreachable database fails while setting up *the file*, and
 * vitest reports the two tests as `skipped` — which reads as "nothing was checked" rather than
 * "PostgreSQL is not answering". One connection per test costs milliseconds and makes the failure
 * land on the assertion that owns it.
 */
import { describe, expect, it } from 'vitest';

import { withClient } from './prisma-client';

/**
 * Version-7 UUID: the version nibble is the 15th hex digit, the variant nibble is the 20th.
 * A v4 UUID (what `uuid_generate_v4()` or a JS library would give us) fails this pattern.
 */
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('harness :: PostgreSQL 18 test database', () => {
  it('connects to the dedicated test database, not the development database', async () => {
    await withClient(async (client) => {
      const rows = await client.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;

      expect(rows[0].db).toBe('mediaforge_test');
    });
  });

  it('resolves uuidv7() natively and returns a version-7 UUID', async () => {
    await withClient(async (client) => {
      // `uuidv7()` exists only in PostgreSQL 18+. On an older engine this statement raises an
      // error instead of quietly returning a v4 UUID, which is exactly the failure we want loud:
      // the pipeline's ordering-by-time IDs depend on the engine, not on the application.
      const rows = await client.$queryRaw<{ id: string }[]>`SELECT uuidv7()::text AS id`;

      expect(rows[0].id).toMatch(UUID_V7);
    });
  });
});
