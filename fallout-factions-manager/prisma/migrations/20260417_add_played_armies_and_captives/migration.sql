CREATE TABLE "ArmyPlayed" (
    "id" TEXT NOT NULL,
    "armyId" TEXT NOT NULL,
    "opponentArmyId" TEXT NOT NULL,
    "boxesTotal" INTEGER NOT NULL DEFAULT 3,
    "boxesChecked" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArmyPlayed_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArmyPlayed_armyId_opponentArmyId_key"
    ON "ArmyPlayed"("armyId", "opponentArmyId");

CREATE INDEX "ArmyPlayed_armyId_idx"
    ON "ArmyPlayed"("armyId");

CREATE INDEX "ArmyPlayed_opponentArmyId_idx"
    ON "ArmyPlayed"("opponentArmyId");

ALTER TABLE "ArmyPlayed"
    ADD CONSTRAINT "ArmyPlayed_armyId_fkey"
    FOREIGN KEY ("armyId")
    REFERENCES "Army"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "ArmyPlayed"
    ADD CONSTRAINT "ArmyPlayed_opponentArmyId_fkey"
    FOREIGN KEY ("opponentArmyId")
    REFERENCES "Army"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "UnitInstance"
    ADD COLUMN "capturedByArmyId" TEXT,
    ADD COLUMN "capturedAt" TIMESTAMP(3);

CREATE INDEX "UnitInstance_capturedByArmyId_idx"
    ON "UnitInstance"("capturedByArmyId");

ALTER TABLE "UnitInstance"
    ADD CONSTRAINT "UnitInstance_capturedByArmyId_fkey"
    FOREIGN KEY ("capturedByArmyId")
    REFERENCES "Army"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
