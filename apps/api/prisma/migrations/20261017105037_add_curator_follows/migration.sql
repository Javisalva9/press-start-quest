-- AlterTable
ALTER TABLE "user_games" ADD COLUMN     "addedByCuratorId" TEXT;

-- CreateIndex
CREATE INDEX "user_games_addedByCuratorId_idx" ON "user_games"("addedByCuratorId");

-- AddForeignKey
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_addedByCuratorId_fkey" FOREIGN KEY ("addedByCuratorId") REFERENCES "curators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex (by hand: Prisma's schema can't express it without a preview)
-- Global creators (no user) have unique names; a user's friends are
-- already unique per user (curators_userId_name_key).
CREATE UNIQUE INDEX "curators_global_name_key" ON "curators"("name") WHERE "userId" IS NULL;