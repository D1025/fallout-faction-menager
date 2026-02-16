-- Add ploys tracker and chem inventory

CREATE TYPE "ChemRarity" AS ENUM ('COMMON', 'UNCOMMON');

ALTER TABLE "Army"
    ADD COLUMN "ploys" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "Chem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rarity" "ChemRarity" NOT NULL,
    "costCaps" INTEGER NOT NULL,
    "effect" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArmyChem" (
    "id" TEXT NOT NULL,
    "armyId" TEXT NOT NULL,
    "chemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ArmyChem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Chem_name_key" ON "Chem"("name");
CREATE INDEX "Chem_rarity_sortOrder_name_idx" ON "Chem"("rarity", "sortOrder", "name");
CREATE UNIQUE INDEX "ArmyChem_armyId_chemId_key" ON "ArmyChem"("armyId", "chemId");
CREATE INDEX "ArmyChem_armyId_idx" ON "ArmyChem"("armyId");
CREATE INDEX "ArmyChem_chemId_idx" ON "ArmyChem"("chemId");

ALTER TABLE "ArmyChem"
    ADD CONSTRAINT "ArmyChem_armyId_fkey"
    FOREIGN KEY ("armyId") REFERENCES "Army"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ArmyChem"
    ADD CONSTRAINT "ArmyChem_chemId_fkey"
    FOREIGN KEY ("chemId") REFERENCES "Chem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;