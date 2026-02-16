-- Public read-only share links for armies

CREATE TABLE "ArmyPublicShare" (
    "id" TEXT NOT NULL,
    "armyId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArmyPublicShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArmyPublicShare_armyId_key" ON "ArmyPublicShare"("armyId");
CREATE UNIQUE INDEX "ArmyPublicShare_token_key" ON "ArmyPublicShare"("token");
CREATE INDEX "ArmyPublicShare_token_enabled_idx" ON "ArmyPublicShare"("token", "enabled");

ALTER TABLE "ArmyPublicShare"
    ADD CONSTRAINT "ArmyPublicShare_armyId_fkey"
    FOREIGN KEY ("armyId") REFERENCES "Army"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

