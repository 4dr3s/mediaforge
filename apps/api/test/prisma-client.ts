/**
 * WU-2 / task 1.4 — one client for the tests, and it is the application's client.
 *
 * The supervisor's observation O2, accepted 2026-09-16 and binding on this unit: the harness's
 * database assertions move to the Prisma client, and `pg` / `@types/pg` leave `package.json`. The
 * reason is not tidiness — a test that talks to Postgres through a *different* driver than the
 * application can pass while the application's own path is broken, which is the failure mode a
 * harness exists to rule out.
 *
 * `PrismaPg` accepts a connection string directly, so this file never imports `pg`. That matters:
 * the constraint is about this repository's manifest, and importing the driver here would keep the
 * dependency alive in the only place it was still needed.
 *
 * The test database, not the development one. `design.md` §2.1 keeps two URLs pointing at two
 * different databases on purpose, and a suite that defaults to the wrong one is how the wrong
 * database gets written to.
 *
 * One client per call, and it is always disconnected. That is the same discipline the suites had
 * with a single `pg` connection per test, and it exists for a measured reason: a shared client
 * turns an unreachable database into a failure while *setting up the file*, which reads as "nothing
 * was checked" instead of "PostgreSQL is not answering".
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client';

const DATABASE_URL_TEST =
  process.env.DATABASE_URL_TEST ?? 'postgresql://postgres:postgres@localhost:5432/mediaforge_test';

/** Run `fn` against a freshly connected Prisma client, and always disconnect it. */
export async function withClient<T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> {
  const adapter = new PrismaPg(DATABASE_URL_TEST);
  const client = new PrismaClient({ adapter });
  try {
    return await fn(client);
  } finally {
    await client.$disconnect();
  }
}
