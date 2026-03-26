-- CreateTable
CREATE TABLE "RiotAccountIndex" (
    "id" TEXT NOT NULL,
    "puuid" TEXT NOT NULL,
    "gameName" TEXT NOT NULL,
    "tagLine" TEXT NOT NULL,
    "normalizedRiotId" TEXT NOT NULL,
    "platform" TEXT,
    "region" TEXT,
    "profileIconId" INTEGER,
    "summonerLevel" INTEGER,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiotAccountIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiotAccountIndex_puuid_key" ON "RiotAccountIndex"("puuid");

-- CreateIndex
CREATE INDEX "RiotAccountIndex_normalizedRiotId_idx" ON "RiotAccountIndex"("normalizedRiotId");

-- CreateIndex
CREATE INDEX "RiotAccountIndex_gameName_idx" ON "RiotAccountIndex"("gameName");

-- CreateIndex
CREATE INDEX "RiotAccountIndex_tagLine_idx" ON "RiotAccountIndex"("tagLine");

-- CreateIndex
CREATE INDEX "RiotAccountIndex_lastSeenAt_idx" ON "RiotAccountIndex"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "RiotAccountIndex_gameName_tagLine_key" ON "RiotAccountIndex"("gameName", "tagLine");
