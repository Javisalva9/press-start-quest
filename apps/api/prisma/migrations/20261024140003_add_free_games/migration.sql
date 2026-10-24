-- CreateTable
CREATE TABLE "free_games" (
    "id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "worth" TEXT,
    "imageUrl" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "stores" TEXT[],
    "endsAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "free_games_pkey" PRIMARY KEY ("id")
);
