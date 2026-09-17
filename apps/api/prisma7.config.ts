// WU-2 — Prisma 7 configuration.
//
// Prisma 7 moved the datasource connection string out of `schema.prisma` and into this file, and it
// requires a driver adapter for a direct database connection. Both changes are recorded as decisions
// in `odd/tasks/wu2-data-model.md`; the schema keeps only `provider = "postgresql"`.
//
// There is deliberately **no `dotenv` import**. This project's environment comes from the shell and
// from `docker/compose.yaml`, and `design.md` §2.1 already warns that two variables point at two
// different databases on purpose (`DATABASE_URL` for the application, `DATABASE_URL_TEST` for the
// harness). A config file that silently loads a `.env` would be a second, invisible source for the
// same decision. Export the variable before running a Prisma command:
//
//   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mediaforge_test" \
//     pnpm --filter api exec prisma migrate deploy

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
