-- Add SPECIAL requirements + INNATE flag to Perk

CREATE TYPE "StatKeySpecial" AS ENUM ('S','P','E','C','I','A','L');

ALTER TABLE "Perk"
    ADD COLUMN     "statKey" "StatKeySpecial",
    ADD COLUMN     "minValue" INTEGER,
    ADD COLUMN     "isInnate" BOOLEAN NOT NULL DEFAULT false;
