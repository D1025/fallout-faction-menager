ALTER TABLE "FactionUpgradeRule"
    ADD COLUMN "ratingPerPointChampion" INTEGER;

UPDATE "FactionUpgradeRule"
SET "ratingPerPointChampion" = CASE UPPER("statKey")
    WHEN 'HP' THEN 20
    WHEN 'S' THEN 10
    WHEN 'P' THEN 10
    WHEN 'E' THEN 15
    WHEN 'C' THEN 8
    WHEN 'I' THEN 8
    WHEN 'A' THEN 10
    WHEN 'L' THEN 15
    ELSE "ratingPerPoint"
END
WHERE "ratingPerPointChampion" IS NULL;
