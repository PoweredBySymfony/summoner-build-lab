ALTER TABLE "ImportedMatch"
ADD COLUMN "mongoMatchImportRef" TEXT,
ADD COLUMN "mongoTimelineRef" TEXT,
ADD COLUMN "mongoSnapshotRef" TEXT,
ADD COLUMN "mongoBackfilledAt" TIMESTAMP(3);

CREATE INDEX "ImportedMatch_mongoMatchImportRef_idx" ON "ImportedMatch"("mongoMatchImportRef");
CREATE INDEX "ImportedMatch_mongoTimelineRef_idx" ON "ImportedMatch"("mongoTimelineRef");
