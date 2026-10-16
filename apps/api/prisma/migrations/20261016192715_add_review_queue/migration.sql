-- AlterTable
ALTER TABLE "user_games" ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedSignal" "CompletionSignal";
