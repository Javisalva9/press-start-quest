-- CreateTable
CREATE TABLE "achievement_finale_votes" (
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "isFinale" BOOLEAN NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_finale_votes_pkey" PRIMARY KEY ("userId","achievementId")
);

-- CreateIndex
CREATE INDEX "achievement_finale_votes_achievementId_idx" ON "achievement_finale_votes"("achievementId");

-- AddForeignKey
ALTER TABLE "achievement_finale_votes" ADD CONSTRAINT "achievement_finale_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_finale_votes" ADD CONSTRAINT "achievement_finale_votes_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
