-- Home Turf catalogs: hazards and facilities dictionaries

CREATE TABLE "HomeFacilityDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeFacilityDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeHazardDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeHazardDefinition_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "HomeTurf"
    ADD COLUMN "hazardDefId" TEXT;

ALTER TABLE "HomeFacility"
    ADD COLUMN "facilityDefId" TEXT;

CREATE UNIQUE INDEX "HomeFacilityDefinition_name_key" ON "HomeFacilityDefinition"("name");
CREATE UNIQUE INDEX "HomeHazardDefinition_name_key" ON "HomeHazardDefinition"("name");
CREATE INDEX "HomeFacilityDefinition_sortOrder_name_idx" ON "HomeFacilityDefinition"("sortOrder", "name");
CREATE INDEX "HomeHazardDefinition_sortOrder_name_idx" ON "HomeHazardDefinition"("sortOrder", "name");
CREATE INDEX "HomeTurf_hazardDefId_idx" ON "HomeTurf"("hazardDefId");
CREATE INDEX "HomeFacility_facilityDefId_idx" ON "HomeFacility"("facilityDefId");
CREATE UNIQUE INDEX "HomeFacility_turfId_facilityDefId_key" ON "HomeFacility"("turfId", "facilityDefId");

ALTER TABLE "HomeTurf"
    ADD CONSTRAINT "HomeTurf_hazardDefId_fkey"
    FOREIGN KEY ("hazardDefId") REFERENCES "HomeHazardDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HomeFacility"
    ADD CONSTRAINT "HomeFacility_facilityDefId_fkey"
    FOREIGN KEY ("facilityDefId") REFERENCES "HomeFacilityDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

