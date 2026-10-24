/*
  Warnings:

  - A unique constraint covering the columns `[gameId]` on the table `deals` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[itadId]` on the table `games` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "deals_gameId_fetchedAt_idx";

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "lowestAt" TIMESTAMP(3),
ADD COLUMN     "lowestPrice" DECIMAL(8,2);

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "itadId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "deals_gameId_key" ON "deals"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "games_itadId_key" ON "games"("itadId");
