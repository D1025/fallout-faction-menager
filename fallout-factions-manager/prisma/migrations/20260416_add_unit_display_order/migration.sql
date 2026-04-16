ALTER TABLE "UnitInstance"
    ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY "armyId" ORDER BY "createdAt", id) - 1 AS rn
    FROM "UnitInstance"
)
UPDATE "UnitInstance" u
SET "displayOrder" = ranked.rn
FROM ranked
WHERE ranked.id = u.id;

CREATE INDEX "UnitInstance_armyId_displayOrder_idx"
    ON "UnitInstance"("armyId", "displayOrder");
