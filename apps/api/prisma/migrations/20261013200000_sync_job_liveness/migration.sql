-- AlterTable
ALTER TABLE "sync_jobs" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Finished jobs: their last write was when they finished. Active jobs keep
-- the time of this migration, which gives them the full 2 minutes of grace.
UPDATE "sync_jobs"
SET "updatedAt" = COALESCE("finishedAt", "startedAt", "createdAt")
WHERE "status" NOT IN ('QUEUED', 'RUNNING');

-- The unique index below can't be created while a user has two active jobs
-- (the race it prevents). Keep the newest and close the others as interrupted.
UPDATE "sync_jobs" AS "older"
SET "status" = 'FAILED',
    "error" = 'SYNC_INTERRUPTED',
    "finishedAt" = CURRENT_TIMESTAMP,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "older"."status" IN ('QUEUED', 'RUNNING')
  AND EXISTS (
    SELECT 1
    FROM "sync_jobs" AS "newer"
    WHERE "newer"."userId" = "older"."userId"
      AND "newer"."status" IN ('QUEUED', 'RUNNING')
      AND ("newer"."createdAt", "newer"."id") > ("older"."createdAt", "older"."id")
  );

-- CreateIndex (by hand: Prisma's schema can't express it without a preview)
-- One active sync per user, enforced by the database. Partial: only QUEUED
-- and RUNNING rows take part, so finished jobs don't count.
CREATE UNIQUE INDEX "sync_jobs_one_active_per_user" ON "sync_jobs"("userId") WHERE "status" IN ('QUEUED', 'RUNNING');
