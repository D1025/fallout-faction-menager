-- Soft delete for armies
ALTER TABLE "Army"
ADD COLUMN "deleted" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Army_ownerId_deleted_idx" ON "Army"("ownerId", "deleted");
CREATE INDEX "Army_deleted_idx" ON "Army"("deleted");

-- Per-unit temporary tag
ALTER TABLE "UnitInstance"
ADD COLUMN "temporary" BOOLEAN NOT NULL DEFAULT false;
