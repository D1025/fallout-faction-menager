-- Add free-text value/details for weapon effects (e.g. Selective Fire [Area (1"), Storm (3")])

ALTER TABLE "WeaponBaseEffect"
    ADD COLUMN "valueText" TEXT;

ALTER TABLE "WeaponProfileEffect"
    ADD COLUMN "valueText" TEXT;
