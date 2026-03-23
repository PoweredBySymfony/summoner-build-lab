-- CreateEnum
CREATE TYPE "LanguageCode" AS ENUM ('fr', 'en');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'FLEX');

-- CreateEnum
CREATE TYPE "PuzzleDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "PuzzleChoiceType" AS ENUM ('ITEM', 'COMPONENT', 'BUILD_PATH', 'SITUATIONAL_CHOICE');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('BOOTS', 'CRIT', 'TANK', 'MAGE', 'LETHALITY', 'SUPPORT', 'BRUISER', 'MARKSMAN', 'ASSASSIN', 'FIGHTER', 'UTILITY', 'DEFENSIVE');

-- CreateEnum
CREATE TYPE "ItemRelationType" AS ENUM ('SYNERGY', 'COUNTER', 'CORE_BUILD', 'ALTERNATIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT NOT NULL,
    "preferredRoles" "Role"[],
    "targetSkills" TEXT[],
    "language" "LanguageCode" NOT NULL DEFAULT 'fr',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Champion" (
    "id" TEXT NOT NULL,
    "riotId" INTEGER,
    "riotKey" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT,
    "primaryRole" "Role",
    "roles" "Role"[],
    "damageType" TEXT,
    "image" TEXT NOT NULL,
    "tags" TEXT[],
    "threatJson" JSONB,
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
    "shortDescription" JSONB,
    "fullDescription" JSONB,
    "goldTotal" INTEGER NOT NULL,
    "goldBase" INTEGER,
    "goldSell" INTEGER,
    "combineCost" INTEGER,
    "category" "ItemCategory" NOT NULL,
    "statsJson" JSONB,
    "image" TEXT NOT NULL,
    "isMythic" BOOLEAN NOT NULL DEFAULT false,
    "isLegendary" BOOLEAN NOT NULL DEFAULT true,
    "isBoots" BOOLEAN NOT NULL DEFAULT false,
    "activeEffect" JSONB,
    "passiveEffect" JSONB,
    "activeName" TEXT,
    "passiveName" TEXT,
    "componentsJson" JSONB,
    "tags" TEXT[],
    "patch" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Puzzle" (
    "id" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "slug" TEXT NOT NULL,
    "difficulty" "PuzzleDifficulty" NOT NULL,
    "patch" TEXT NOT NULL,
    "description" JSONB NOT NULL,
    "situation" JSONB NOT NULL,
    "question" JSONB NOT NULL,
    "explanation" JSONB NOT NULL,
    "role" "Role" NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "championId" TEXT,
    "enemyTeamJson" JSONB,
    "allyTeamJson" JSONB,
    "gameContextJson" JSONB NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Puzzle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuzzleChoice" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "label" JSONB NOT NULL,
    "choiceType" "PuzzleChoiceType" NOT NULL,
    "itemId" TEXT,
    "textFallback" JSONB,
    "explanation" JSONB NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "PuzzleChoice_pkey" PRIMARY KEY ("id")
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
    "puzzleTagId" TEXT NOT NULL,

    CONSTRAINT "PuzzleTagOnPuzzle_pkey" PRIMARY KEY ("puzzleId","puzzleTagId")
);

-- CreateTable
CREATE TABLE "PuzzleAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "selectedChoiceId" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PuzzleAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemRelation" (
    "id" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,
    "targetItemId" TEXT NOT NULL,
    "relationType" "ItemRelationType" NOT NULL,
    "note" TEXT,

    CONSTRAINT "ItemRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Champion_riotId_key" ON "Champion"("riotId");

-- CreateIndex
CREATE UNIQUE INDEX "Champion_riotKey_key" ON "Champion"("riotKey");

-- CreateIndex
CREATE UNIQUE INDEX "Champion_slug_key" ON "Champion"("slug");

-- CreateIndex
CREATE INDEX "Champion_name_idx" ON "Champion"("name");

-- CreateIndex
CREATE INDEX "Champion_slug_idx" ON "Champion"("slug");

-- CreateIndex
CREATE INDEX "Champion_primaryRole_idx" ON "Champion"("primaryRole");

-- CreateIndex
CREATE UNIQUE INDEX "Item_riotItemId_key" ON "Item"("riotItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_slug_key" ON "Item"("slug");

-- CreateIndex
CREATE INDEX "Item_slug_idx" ON "Item"("slug");

-- CreateIndex
CREATE INDEX "Item_name_idx" ON "Item"("name");

-- CreateIndex
CREATE INDEX "Item_category_idx" ON "Item"("category");

-- CreateIndex
CREATE INDEX "Item_isBoots_idx" ON "Item"("isBoots");

-- CreateIndex
CREATE INDEX "Item_patch_idx" ON "Item"("patch");

-- CreateIndex
CREATE UNIQUE INDEX "Puzzle_slug_key" ON "Puzzle"("slug");

-- CreateIndex
CREATE INDEX "Puzzle_slug_idx" ON "Puzzle"("slug");

-- CreateIndex
CREATE INDEX "Puzzle_championId_idx" ON "Puzzle"("championId");

-- CreateIndex
CREATE INDEX "Puzzle_isPublished_idx" ON "Puzzle"("isPublished");

-- CreateIndex
CREATE INDEX "Puzzle_difficulty_idx" ON "Puzzle"("difficulty");

-- CreateIndex
CREATE INDEX "Puzzle_patch_idx" ON "Puzzle"("patch");

-- CreateIndex
CREATE INDEX "Puzzle_moduleKey_idx" ON "Puzzle"("moduleKey");

-- CreateIndex
CREATE INDEX "Puzzle_role_idx" ON "Puzzle"("role");

-- CreateIndex
CREATE INDEX "PuzzleChoice_puzzleId_idx" ON "PuzzleChoice"("puzzleId");

-- CreateIndex
CREATE INDEX "PuzzleChoice_itemId_idx" ON "PuzzleChoice"("itemId");

-- CreateIndex
CREATE INDEX "PuzzleChoice_displayOrder_idx" ON "PuzzleChoice"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PuzzleTag_slug_key" ON "PuzzleTag"("slug");

-- CreateIndex
CREATE INDEX "PuzzleTag_slug_idx" ON "PuzzleTag"("slug");

-- CreateIndex
CREATE INDEX "PuzzleTag_name_idx" ON "PuzzleTag"("name");

-- CreateIndex
CREATE INDEX "PuzzleTagOnPuzzle_puzzleId_idx" ON "PuzzleTagOnPuzzle"("puzzleId");

-- CreateIndex
CREATE INDEX "PuzzleTagOnPuzzle_puzzleTagId_idx" ON "PuzzleTagOnPuzzle"("puzzleTagId");

-- CreateIndex
CREATE INDEX "PuzzleAttempt_userId_idx" ON "PuzzleAttempt"("userId");

-- CreateIndex
CREATE INDEX "PuzzleAttempt_puzzleId_idx" ON "PuzzleAttempt"("puzzleId");

-- CreateIndex
CREATE INDEX "PuzzleAttempt_selectedChoiceId_idx" ON "PuzzleAttempt"("selectedChoiceId");

-- CreateIndex
CREATE INDEX "PuzzleAttempt_answeredAt_idx" ON "PuzzleAttempt"("answeredAt");

-- CreateIndex
CREATE INDEX "ItemRelation_sourceItemId_idx" ON "ItemRelation"("sourceItemId");

-- CreateIndex
CREATE INDEX "ItemRelation_targetItemId_idx" ON "ItemRelation"("targetItemId");

-- CreateIndex
CREATE INDEX "ItemRelation_relationType_idx" ON "ItemRelation"("relationType");

-- AddForeignKey
ALTER TABLE "Puzzle" ADD CONSTRAINT "Puzzle_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleChoice" ADD CONSTRAINT "PuzzleChoice_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleChoice" ADD CONSTRAINT "PuzzleChoice_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleTagOnPuzzle" ADD CONSTRAINT "PuzzleTagOnPuzzle_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleTagOnPuzzle" ADD CONSTRAINT "PuzzleTagOnPuzzle_puzzleTagId_fkey" FOREIGN KEY ("puzzleTagId") REFERENCES "PuzzleTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleAttempt" ADD CONSTRAINT "PuzzleAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleAttempt" ADD CONSTRAINT "PuzzleAttempt_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleAttempt" ADD CONSTRAINT "PuzzleAttempt_selectedChoiceId_fkey" FOREIGN KEY ("selectedChoiceId") REFERENCES "PuzzleChoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemRelation" ADD CONSTRAINT "ItemRelation_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemRelation" ADD CONSTRAINT "ItemRelation_targetItemId_fkey" FOREIGN KEY ("targetItemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
