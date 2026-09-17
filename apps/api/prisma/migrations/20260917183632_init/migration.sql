-- CreateEnum
CREATE TYPE "JobState" AS ENUM ('created', 'queued', 'running', 'succeeded', 'failed', 'canceled');

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "job_type" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "state" "JobState" NOT NULL,
    "available_at" TIMESTAMPTZ(6) NOT NULL,
    "error_code" TEXT,
    "artifact_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_inputs" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "job_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "declared_type" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "display_name" TEXT,
    "byte_size" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "job_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "job_id" UUID NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "lease_owner" TEXT NOT NULL,
    "lease_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "error_class" TEXT,
    "error_code" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "job_id" UUID NOT NULL,
    "client_id" TEXT,
    "idempotency_key" TEXT,
    "creator_token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "content_type" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "job_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobs_artifact_id_idx" ON "jobs"("artifact_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_inputs_job_id_ordinal_key" ON "job_inputs"("job_id", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_job_id_attempt_no_key" ON "attempts"("job_id", "attempt_no");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_job_id_key" ON "submissions"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_client_id_idempotency_key_key" ON "submissions"("client_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "artifacts_job_id_idx" ON "artifacts"("job_id");

-- CreateIndex
CREATE INDEX "outbox_job_id_idx" ON "outbox"("job_id");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_inputs" ADD CONSTRAINT "job_inputs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- WU-2 hand-edits.
--
-- Prisma cannot express the following, so they are appended to the generated migration instead of
-- living in a second file: `design.md` §5 makes this file the single DDL authority. The `state`
-- enum is NOT here -- Prisma expressed it above with `CREATE TYPE`, contrary to §5's wording.
--
-- Referential actions were chosen by Prisma, not by this design: RESTRICT on every required
-- relation and SET NULL on the optional `jobs.artifact_id`. No runtime role holds DELETE, so they
-- are unreachable in practice; they are recorded here rather than left as an unexamined default.

-- 1. CHECK constraints ------------------------------------------------------
ALTER TABLE "job_inputs" ADD CONSTRAINT "job_inputs_ordinal_positive" CHECK ("ordinal" >= 1);
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_attempt_no_positive" CHECK ("attempt_no" >= 1);
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_error_class_allowed"
  CHECK ("error_class" IS NULL OR "error_class" IN ('retryable', 'non_retryable'));

-- 2. The partial index the relay poll needs (C3) ----------------------------
CREATE INDEX "outbox_unpublished_idx" ON "outbox" ("published_at") WHERE "published_at" IS NULL;

-- 3. Least-privilege roles (design.md §3) -----------------------------------
-- LOGIN without a password: credentials are a deployment concern and are set out-of-band, so no
-- password is committed in a migration. The privilege suite exercises these roles through SET ROLE
-- and asserts `rolcanlogin` separately. The guards make this migration re-appliable to a second
-- database in the same cluster, where the roles already exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mediaforge_api') THEN
    CREATE ROLE "mediaforge_api" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mediaforge_worker') THEN
    CREATE ROLE "mediaforge_worker" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- The roles must reach the database and the schema before table grants mean anything. The database
-- name differs between dev and test, so it is read from the current connection rather than written
-- down twice.
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO "mediaforge_api", "mediaforge_worker"',
                 current_database());
END
$$;
GRANT USAGE ON SCHEMA "public" TO "mediaforge_api", "mediaforge_worker";

-- PUBLIC holds nothing.
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM PUBLIC;
REVOKE ALL ON SCHEMA "public" FROM PUBLIC;

-- api: SELECT/INSERT/UPDATE on its four tables, SELECT on attempts and artifacts. No DDL, no DELETE.
GRANT SELECT, INSERT, UPDATE ON "jobs", "job_inputs", "submissions", "outbox" TO "mediaforge_api";
GRANT SELECT ON "attempts", "artifacts" TO "mediaforge_api";

-- worker: SELECT on jobs/job_inputs/submissions, full control of attempts, INSERT on artifacts,
-- UPDATE on jobs. No outbox access, and no DELETE for either role: scratch cleanup is a storage
-- operation, never a database DELETE.
GRANT SELECT ON "jobs", "job_inputs", "submissions" TO "mediaforge_worker";
GRANT SELECT, INSERT, UPDATE ON "attempts" TO "mediaforge_worker";
GRANT INSERT ON "artifacts" TO "mediaforge_worker";
GRANT UPDATE ON "jobs" TO "mediaforge_worker";
