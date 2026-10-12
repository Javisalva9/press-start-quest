-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('STEAM', 'EPIC', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('BACKLOG', 'PLAYING', 'COMPLETED', 'ABANDONED', 'ON_HOLD', 'WISHLIST', 'DISCARDED');

-- CreateEnum
CREATE TYPE "StatusSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('COMPLETABLE', 'ENDLESS', 'SANDBOX', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('ONLINE', 'ANNOUNCED', 'PARTIAL', 'CLOSED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "GameKind" AS ENUM ('GAME', 'DLC', 'DEMO', 'SOUNDTRACK', 'TOOL');

-- CreateEnum
CREATE TYPE "TagKind" AS ENUM ('GENRE', 'THEME', 'MODE', 'PERSPECTIVE', 'STORE_CATEGORY');

-- CreateEnum
CREATE TYPE "CuratorKind" AS ENUM ('FRIEND', 'CREATOR');

-- CreateEnum
CREATE TYPE "FeedbackAction" AS ENUM ('ACCEPTED', 'NOT_NOW', 'NEVER', 'IGNORED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT,
    "lastSyncAt" TIMESTAMP(3),

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "igdbId" INTEGER,
    "steamAppId" INTEGER,
    "epicCatalogId" TEXT,
    "kind" "GameKind" NOT NULL DEFAULT 'GAME',
    "coverUrl" TEXT,
    "heroUrl" TEXT,
    "summary" TEXT,
    "releaseDate" TIMESTAMP(3),
    "developer" TEXT,
    "rating" DOUBLE PRECISION,
    "ratingCount" INTEGER,
    "metacritic" INTEGER,
    "steamReviewPct" INTEGER,
    "ttbMainMin" INTEGER,
    "ttbExtraMin" INTEGER,
    "ttbCompleteMin" INTEGER,
    "ttbSource" TEXT,
    "gameType" "GameType" NOT NULL DEFAULT 'UNKNOWN',
    "serverStatus" "ServerStatus" NOT NULL DEFAULT 'UNKNOWN',
    "serverClosedAt" TIMESTAMP(3),
    "metadataAt" TIMESTAMP(3),

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "TagKind" NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_tags" (
    "gameId" TEXT NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "game_tags_pkey" PRIMARY KEY ("gameId","tagId")
);

-- CreateTable
CREATE TABLE "user_games" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'BACKLOG',
    "statusSource" "StatusSource" NOT NULL DEFAULT 'AUTO',
    "completionConfidence" DOUBLE PRECISION,
    "owned" BOOLEAN NOT NULL DEFAULT true,
    "wishlistPriority" INTEGER,
    "wishlistedAt" TIMESTAMP(3),
    "playtimeMin" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" TIMESTAMP(3),
    "achievementsUnlocked" INTEGER,
    "achievementsTotal" INTEGER,
    "completedAt" TIMESTAMP(3),
    "personalRating" INTEGER,
    "goal" TEXT,
    "notes" TEXT,
    "typeOverride" "GameType",
    "serverOverride" "ServerStatus",
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "snoozedUntil" TIMESTAMP(3),
    "addedManually" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownerships" (
    "id" TEXT NOT NULL,
    "userGameId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalAppId" TEXT NOT NULL,
    "playtimeMin" INTEGER NOT NULL DEFAULT 0,
    "playtime2wMin" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" TIMESTAMP(3),

    CONSTRAINT "ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playtime_snapshots" (
    "id" TEXT NOT NULL,
    "userGameId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "playtimeMin" INTEGER NOT NULL,

    CONSTRAINT "playtime_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curators" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "kind" "CuratorKind" NOT NULL DEFAULT 'FRIEND',
    "color" TEXT,

    CONSTRAINT "curators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_curators" (
    "userId" TEXT NOT NULL,
    "curatorId" TEXT NOT NULL,
    "followedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_curators_pkey" PRIMARY KEY ("userId","curatorId")
);

-- CreateTable
CREATE TABLE "curator_picks" (
    "id" TEXT NOT NULL,
    "curatorId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curator_picks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taste_scores" (
    "userId" TEXT NOT NULL,
    "tagId" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taste_scores_pkey" PRIMARY KEY ("userId","tagId")
);

-- CreateTable
CREATE TABLE "recommendation_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL,
    "mood" TEXT,
    "action" "FeedbackAction" NOT NULL DEFAULT 'IGNORED',
    "shownAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actedAt" TIMESTAMP(3),

    CONSTRAINT "recommendation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "price" DECIMAL(8,2) NOT NULL,
    "regularPrice" DECIMAL(8,2) NOT NULL,
    "cutPct" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "url" TEXT NOT NULL,
    "isHistoricalLow" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "stats" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sources_platform_externalId_key" ON "sources"("platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "games_slug_key" ON "games"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "games_igdbId_key" ON "games"("igdbId");

-- CreateIndex
CREATE UNIQUE INDEX "games_steamAppId_key" ON "games"("steamAppId");

-- CreateIndex
CREATE UNIQUE INDEX "games_epicCatalogId_key" ON "games"("epicCatalogId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_kind_key" ON "tags"("name", "kind");

-- CreateIndex
CREATE INDEX "user_games_userId_status_idx" ON "user_games"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_games_userId_gameId_key" ON "user_games"("userId", "gameId");

-- CreateIndex
CREATE UNIQUE INDEX "ownerships_sourceId_externalAppId_key" ON "ownerships"("sourceId", "externalAppId");

-- CreateIndex
CREATE UNIQUE INDEX "playtime_snapshots_userGameId_date_key" ON "playtime_snapshots"("userGameId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "curators_userId_name_key" ON "curators"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "curator_picks_curatorId_gameId_key" ON "curator_picks"("curatorId", "gameId");

-- CreateIndex
CREATE INDEX "deals_gameId_fetchedAt_idx" ON "deals"("gameId", "fetchedAt");

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_tags" ADD CONSTRAINT "game_tags_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_tags" ADD CONSTRAINT "game_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownerships" ADD CONSTRAINT "ownerships_userGameId_fkey" FOREIGN KEY ("userGameId") REFERENCES "user_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownerships" ADD CONSTRAINT "ownerships_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playtime_snapshots" ADD CONSTRAINT "playtime_snapshots_userGameId_fkey" FOREIGN KEY ("userGameId") REFERENCES "user_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curators" ADD CONSTRAINT "curators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_curators" ADD CONSTRAINT "user_curators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_curators" ADD CONSTRAINT "user_curators_curatorId_fkey" FOREIGN KEY ("curatorId") REFERENCES "curators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curator_picks" ADD CONSTRAINT "curator_picks_curatorId_fkey" FOREIGN KEY ("curatorId") REFERENCES "curators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curator_picks" ADD CONSTRAINT "curator_picks_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taste_scores" ADD CONSTRAINT "taste_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taste_scores" ADD CONSTRAINT "taste_scores_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_events" ADD CONSTRAINT "recommendation_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_events" ADD CONSTRAINT "recommendation_events_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
