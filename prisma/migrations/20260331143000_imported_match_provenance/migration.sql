ALTER TABLE "ImportedMatch"
ADD COLUMN "sourceKind" TEXT,
ADD COLUMN "sourceMetadata" JSONB;

CREATE INDEX "ImportedMatch_sourceKind_idx" ON "ImportedMatch"("sourceKind");
