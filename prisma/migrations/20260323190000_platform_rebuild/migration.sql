-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LanguageCode" AS ENUM ('fr', 'en');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'FLEX');

-- CreateEnum
CREATE TYPE "PuzzleDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "PuzzleChoiceType" AS ENUM ('ITEM', 'COMPONENT', 'BUILD_PATH', 'BOOTS', 'SITUATIONAL_DECISION');

-- CreateEnum
CREATE TYPE "PuzzleMode" AS ENUM ('GENERAL', 'CHAMPION_SPECIFIC', 'PERSONALIZED', 'DAILY');

-- CreateEnum
CREATE TYPE "PuzzleSourceType" AS ENUM ('MANUAL', 'GENERATED', 'IMPORTED_MATCH', 'AI_GENERATED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'GOOGLE', 'RIOT');

-- CreateEnum
CREATE TYPE "GeneratedPuzzleRequestType" AS ENUM ('CHAMPION', 'MATCH_BASED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "GeneratedPuzzleRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "avatarUrl" TEXT,
    "language" "LanguageCode" NOT NULL DEFAULT 'fr',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthProviderAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthProviderAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Champion" (
    "id" TEXT NOT NULL,
    "riotChampionId" INTEGER,
    "championKey" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT,
    "rolePrimary" "Role",
    "roleSecondary" "Role",
    "image" TEXT NOT NULL,
    "splashImage" TEXT,
    "iconImage" TEXT,
    "tags" JSONB NOT NULL,
    "stats" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "patch" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Champion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "riotItemId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "fullDescription" TEXT,
    "image" TEXT NOT NULL,
    "goldTotal" INTEGER NOT NULL,
    "goldBase" INTEGER,
    "goldSell" INTEGER,
    "category" TEXT,
    "tags" JSONB NOT NULL,
    "stats" JSONB NOT NULL,
    "activeEffect" TEXT,
    "passiveEffect" TEXT,
    "buildsFrom" JSONB NOT NULL,
    "buildsInto" JSONB NOT NULL,
    "mapAvailability" JSONB,
    "isBoots" BOOLEAN NOT NULL DEFAULT false,
    "isLegendary" BOOLEAN NOT NULL DEFAULT false,
    "isConsumable" BOOLEAN NOT NULL DEFAULT false,
    "isTrinket" BOOLEAN NOT NULL DEFAULT false,
    "isStarter" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "patch" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Puzzle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "mode" "PuzzleMode" NOT NULL,
    "sourceType" "PuzzleSourceType" NOT NULL,
    "difficulty" "PuzzleDifficulty" NOT NULL,
    "patch" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shortPrompt" TEXT NOT NULL,
    "situation" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "role" "Role",
    "championId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isDailyEligible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Puzzle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuzzleChoice" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "choiceType" "PuzzleChoiceType" NOT NULL,
    "itemId" TEXT,
    "textFallback" TEXT,
    "explanation" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "PuzzleChoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuzzleScenario" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "playerChampionId" TEXT NOT NULL,
    "playerRole" "Role" NOT NULL,
    "gameMinute" INTEGER NOT NULL,
    "playerGold" INTEGER NOT NULL,
    "playerLevel" INTEGER,
    "kills" INTEGER,
    "deaths" INTEGER,
    "assists" INTEGER,
    "cs" INTEGER,
    "currentBuild" JSONB NOT NULL,
    "allyTeam" JSONB NOT NULL,
    "enemyTeam" JSONB NOT NULL,
    "allyItems" JSONB,
    "enemyItems" JSONB,
    "notableThreats" JSONB,
    "objectiveState" JSONB,
    "damageProfile" JSONB,
    "mapState" JSONB,
    "notes" TEXT,

    CONSTRAINT "PuzzleScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuzzleTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PuzzleTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuzzleTagOnPuzzle" (
    "puzzleId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "PuzzleTagOnPuzzle_pkey" PRIMARY KEY ("puzzleId","tagId")
);

-- CreateTable
CREATE TABLE "PuzzleAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "selectedChoiceId" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseTimeMs" INTEGER,

    CONSTRAINT "PuzzleAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserChampionProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "championId" TEXT NOT NULL,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "correctAttempts" INTEGER NOT NULL DEFAULT 0,
    "masteryScore" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserChampionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGlobalProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "totalCorrect" INTEGER NOT NULL DEFAULT 0,
    "dailyStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastDailyCompletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGlobalProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyChallenge" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "challengeDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyChallengeCompletion" (
    "id" TEXT NOT NULL,
    "dailyChallengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCorrect" BOOLEAN NOT NULL,

    CONSTRAINT "DailyChallengeCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "riotPuuid" TEXT,
    "riotGameName" TEXT,
    "riotTagLine" TEXT,
    "region" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedMatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "riotMatchId" TEXT NOT NULL,
    "patch" TEXT,
    "matchData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportedMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedPuzzleRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "GeneratedPuzzleRequestType" NOT NULL,
    "championId" TEXT,
    "importedMatchId" TEXT,
    "parameters" JSONB NOT NULL,
    "status" "GeneratedPuzzleRequestStatus" NOT NULL DEFAULT 'PENDING',
    "resultPuzzleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedPuzzleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailReminderPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "preferredHour" INTEGER,
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailReminderPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuthProviderAccount_userId_idx" ON "AuthProviderAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthProviderAccount_provider_providerAccountId_key" ON "AuthProviderAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Champion_riotChampionId_key" ON "Champion"("riotChampionId");

-- CreateIndex
CREATE UNIQUE INDEX "Champion_championKey_key" ON "Champion"("championKey");

-- CreateIndex
CREATE UNIQUE INDEX "Champion_slug_key" ON "Champion"("slug");

-- CreateIndex
CREATE INDEX "Champion_slug_idx" ON "Champion"("slug");

-- CreateIndex
CREATE INDEX "Champion_name_idx" ON "Champion"("name");

-- CreateIndex
CREATE INDEX "Champion_riotChampionId_idx" ON "Champion"("riotChampionId");

-- CreateIndex
CREATE INDEX "Champion_rolePrimary_idx" ON "Champion"("rolePrimary");

-- CreateIndex
CREATE INDEX "Champion_patch_idx" ON "Champion"("patch");

-- CreateIndex
CREATE UNIQUE INDEX "Item_riotItemId_key" ON "Item"("riotItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_slug_key" ON "Item"("slug");

-- CreateIndex
CREATE INDEX "Item_slug_idx" ON "Item"("slug");

-- CreateIndex
CREATE INDEX "Item_name_idx" ON "Item"("name");

-- CreateIndex
CREATE INDEX "Item_riotItemId_idx" ON "Item"("riotItemId");

-- CreateIndex
CREATE INDEX "Item_patch_idx" ON "Item"("patch");

-- CreateIndex
CREATE INDEX "Item_isBoots_idx" ON "Item"("isBoots");

-- CreateIndex
CREATE UNIQUE INDEX "Puzzle_slug_key" ON "Puzzle"("slug");

-- CreateIndex
CREATE INDEX "Puzzle_slug_idx" ON "Puzzle"("slug");

-- CreateIndex
CREATE INDEX "Puzzle_championId_idx" ON "Puzzle"("championId");

-- CreateIndex
CREATE INDEX "Puzzle_isPublished_idx" ON "Puzzle"("isPublished");

-- CreateIndex
CREATE INDEX "Puzzle_mode_idx" ON "Puzzle"("mode");

-- CreateIndex
CREATE INDEX "Puzzle_difficulty_idx" ON "Puzzle"("difficulty");

-- CreateIndex
CREATE INDEX "Puzzle_patch_idx" ON "Puzzle"("patch");

-- CreateIndex
CREATE INDEX "PuzzleChoice_puzzleId_idx" ON "PuzzleChoice"("puzzleId");

-- CreateIndex
CREATE INDEX "PuzzleChoice_itemId_idx" ON "PuzzleChoice"("itemId");

-- CreateIndex
CREATE INDEX "PuzzleChoice_displayOrder_idx" ON "PuzzleChoice"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PuzzleScenario_puzzleId_key" ON "PuzzleScenario"("puzzleId");

-- CreateIndex
CREATE INDEX "PuzzleScenario_playerChampionId_idx" ON "PuzzleScenario"("playerChampionId");

-- CreateIndex
CREATE INDEX "PuzzleScenario_playerRole_idx" ON "PuzzleScenario"("playerRole");

-- CreateIndex
CREATE UNIQUE INDEX "PuzzleTag_slug_key" ON "PuzzleTag"("slug");

-- CreateIndex
CREATE INDEX "PuzzleTag_slug_idx" ON "PuzzleTag"("slug");

-- CreateIndex
CREATE INDEX "PuzzleTag_name_idx" ON "PuzzleTag"("name");

-- CreateIndex
CREATE INDEX "PuzzleTagOnPuzzle_puzzleId_idx" ON "PuzzleTagOnPuzzle"("puzzleId");

-- CreateIndex
CREATE INDEX "PuzzleTagOnPuzzle_tagId_idx" ON "PuzzleTagOnPuzzle"("tagId");

-- CreateIndex
CREATE INDEX "PuzzleAttempt_userId_idx" ON "PuzzleAttempt"("userId");

-- CreateIndex
CREATE INDEX "PuzzleAttempt_puzzleId_idx" ON "PuzzleAttempt"("puzzleId");

-- CreateIndex
CREATE INDEX "PuzzleAttempt_selectedChoiceId_idx" ON "PuzzleAttempt"("selectedChoiceId");

-- CreateIndex
CREATE INDEX "PuzzleAttempt_answeredAt_idx" ON "PuzzleAttempt"("answeredAt");

-- CreateIndex
CREATE INDEX "UserChampionProgress_userId_idx" ON "UserChampionProgress"("userId");

-- CreateIndex
CREATE INDEX "UserChampionProgress_championId_idx" ON "UserChampionProgress"("championId");

-- CreateIndex
CREATE UNIQUE INDEX "UserChampionProgress_userId_championId_key" ON "UserChampionProgress"("userId", "championId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGlobalProgress_userId_key" ON "UserGlobalProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChallenge_challengeDate_key" ON "DailyChallenge"("challengeDate");

-- CreateIndex
CREATE INDEX "DailyChallenge_challengeDate_idx" ON "DailyChallenge"("challengeDate");

-- CreateIndex
CREATE INDEX "DailyChallengeCompletion_dailyChallengeId_idx" ON "DailyChallengeCompletion"("dailyChallengeId");

-- CreateIndex
CREATE INDEX "DailyChallengeCompletion_userId_idx" ON "DailyChallengeCompletion"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChallengeCompletion_dailyChallengeId_userId_key" ON "DailyChallengeCompletion"("dailyChallengeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerProfile_userId_key" ON "PlayerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedMatch_riotMatchId_key" ON "ImportedMatch"("riotMatchId");

-- CreateIndex
CREATE INDEX "ImportedMatch_userId_idx" ON "ImportedMatch"("userId");

-- CreateIndex
CREATE INDEX "ImportedMatch_riotMatchId_idx" ON "ImportedMatch"("riotMatchId");

-- CreateIndex
CREATE INDEX "GeneratedPuzzleRequest_userId_idx" ON "GeneratedPuzzleRequest"("userId");

-- CreateIndex
CREATE INDEX "GeneratedPuzzleRequest_championId_idx" ON "GeneratedPuzzleRequest"("championId");

-- CreateIndex
CREATE INDEX "GeneratedPuzzleRequest_importedMatchId_idx" ON "GeneratedPuzzleRequest"("importedMatchId");

-- CreateIndex
CREATE INDEX "GeneratedPuzzleRequest_status_idx" ON "GeneratedPuzzleRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EmailReminderPreference_userId_key" ON "EmailReminderPreference"("userId");

-- AddForeignKey
ALTER TABLE "AuthProviderAccount" ADD CONSTRAINT "AuthProviderAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Puzzle" ADD CONSTRAINT "Puzzle_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleChoice" ADD CONSTRAINT "PuzzleChoice_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleChoice" ADD CONSTRAINT "PuzzleChoice_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleScenario" ADD CONSTRAINT "PuzzleScenario_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleScenario" ADD CONSTRAINT "PuzzleScenario_playerChampionId_fkey" FOREIGN KEY ("playerChampionId") REFERENCES "Champion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleTagOnPuzzle" ADD CONSTRAINT "PuzzleTagOnPuzzle_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleTagOnPuzzle" ADD CONSTRAINT "PuzzleTagOnPuzzle_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "PuzzleTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleAttempt" ADD CONSTRAINT "PuzzleAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleAttempt" ADD CONSTRAINT "PuzzleAttempt_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleAttempt" ADD CONSTRAINT "PuzzleAttempt_selectedChoiceId_fkey" FOREIGN KEY ("selectedChoiceId") REFERENCES "PuzzleChoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChampionProgress" ADD CONSTRAINT "UserChampionProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChampionProgress" ADD CONSTRAINT "UserChampionProgress_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGlobalProgress" ADD CONSTRAINT "UserGlobalProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChallenge" ADD CONSTRAINT "DailyChallenge_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChallengeCompletion" ADD CONSTRAINT "DailyChallengeCompletion_dailyChallengeId_fkey" FOREIGN KEY ("dailyChallengeId") REFERENCES "DailyChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChallengeCompletion" ADD CONSTRAINT "DailyChallengeCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerProfile" ADD CONSTRAINT "PlayerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedMatch" ADD CONSTRAINT "ImportedMatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPuzzleRequest" ADD CONSTRAINT "GeneratedPuzzleRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPuzzleRequest" ADD CONSTRAINT "GeneratedPuzzleRequest_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPuzzleRequest" ADD CONSTRAINT "GeneratedPuzzleRequest_importedMatchId_fkey" FOREIGN KEY ("importedMatchId") REFERENCES "ImportedMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPuzzleRequest" ADD CONSTRAINT "GeneratedPuzzleRequest_resultPuzzleId_fkey" FOREIGN KEY ("resultPuzzleId") REFERENCES "Puzzle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailReminderPreference" ADD CONSTRAINT "EmailReminderPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
