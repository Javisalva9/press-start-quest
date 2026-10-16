-- CreateEnum
CREATE TYPE "CompletionSignal" AS ENUM ('ALL_ACHIEVEMENTS', 'FINALE_ACHIEVEMENT', 'PLAYTIME');

-- AlterTable
ALTER TABLE "achievements" ADD COLUMN     "finaleByRule" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "user_games" ADD COLUMN     "completionSignal" "CompletionSignal";
