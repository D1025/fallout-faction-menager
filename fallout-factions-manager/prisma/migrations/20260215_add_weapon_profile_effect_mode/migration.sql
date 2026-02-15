-- Add mode for weapon profile effects (add/remove base effects)

CREATE TYPE "WeaponProfileEffectMode" AS ENUM ('ADD', 'REMOVE');

ALTER TABLE "WeaponProfileEffect"
    ADD COLUMN "effectMode" "WeaponProfileEffectMode" NOT NULL DEFAULT 'ADD';
