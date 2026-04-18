ALTER TABLE "UnitInstance"
    ADD COLUMN "companionOwnerId" TEXT;

CREATE INDEX "UnitInstance_companionOwnerId_idx" ON "UnitInstance"("companionOwnerId");

ALTER TABLE "UnitInstance"
    ADD CONSTRAINT "UnitInstance_companionOwnerId_fkey"
    FOREIGN KEY ("companionOwnerId")
    REFERENCES "UnitInstance"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
