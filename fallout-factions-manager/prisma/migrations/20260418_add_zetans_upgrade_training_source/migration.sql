ALTER TABLE "StatUpgrade"
    ADD COLUMN "trainingArmyId" TEXT,
    ADD COLUMN "trainingFactionId" TEXT;

CREATE INDEX "StatUpgrade_trainingArmyId_idx" ON "StatUpgrade"("trainingArmyId");
CREATE INDEX "StatUpgrade_trainingFactionId_idx" ON "StatUpgrade"("trainingFactionId");
