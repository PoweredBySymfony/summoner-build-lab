ALTER TABLE "ImportedMatch"
ADD COLUMN "sourceRegion" TEXT,
ADD COLUMN "targetPuuid" TEXT,
ADD COLUMN "targetGameName" TEXT,
ADD COLUMN "targetTagLine" TEXT,
ADD COLUMN "targetChampionId" INTEGER,
ADD COLUMN "targetChampionSlug" TEXT,
ADD COLUMN "targetRole" "Role",
ADD COLUMN "gameCreationAt" TIMESTAMP(3),
ADD COLUMN "gameDurationSeconds" INTEGER,
ADD COLUMN "timelineFetchedAt" TIMESTAMP(3),
ADD COLUMN "timelineMissingReason" TEXT,
ADD COLUMN "timelineData" JSONB;

CREATE INDEX "ImportedMatch_patch_idx" ON "ImportedMatch"("patch");
CREATE INDEX "ImportedMatch_sourceRegion_idx" ON "ImportedMatch"("sourceRegion");
CREATE INDEX "ImportedMatch_targetPuuid_idx" ON "ImportedMatch"("targetPuuid");
CREATE INDEX "ImportedMatch_targetChampionSlug_idx" ON "ImportedMatch"("targetChampionSlug");
CREATE INDEX "ImportedMatch_targetRole_idx" ON "ImportedMatch"("targetRole");
CREATE INDEX "ImportedMatch_gameCreationAt_idx" ON "ImportedMatch"("gameCreationAt");
