-- Ploy catalog with faction and subfaction allow/deny rules

CREATE TABLE "PloyDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isStandard" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PloyDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FactionPloy" (
    "id" TEXT NOT NULL,
    "factionId" TEXT NOT NULL,
    "ployId" TEXT NOT NULL,

    CONSTRAINT "FactionPloy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubfactionPloyAllow" (
    "id" TEXT NOT NULL,
    "subfactionId" TEXT NOT NULL,
    "ployId" TEXT NOT NULL,

    CONSTRAINT "SubfactionPloyAllow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubfactionPloyDeny" (
    "id" TEXT NOT NULL,
    "subfactionId" TEXT NOT NULL,
    "ployId" TEXT NOT NULL,

    CONSTRAINT "SubfactionPloyDeny_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PloyDefinition_name_key" ON "PloyDefinition"("name");
CREATE INDEX "PloyDefinition_isStandard_sortOrder_name_idx" ON "PloyDefinition"("isStandard", "sortOrder", "name");

CREATE UNIQUE INDEX "FactionPloy_factionId_ployId_key" ON "FactionPloy"("factionId", "ployId");
CREATE INDEX "FactionPloy_ployId_idx" ON "FactionPloy"("ployId");

CREATE UNIQUE INDEX "SubfactionPloyAllow_subfactionId_ployId_key" ON "SubfactionPloyAllow"("subfactionId", "ployId");
CREATE INDEX "SubfactionPloyAllow_ployId_idx" ON "SubfactionPloyAllow"("ployId");

CREATE UNIQUE INDEX "SubfactionPloyDeny_subfactionId_ployId_key" ON "SubfactionPloyDeny"("subfactionId", "ployId");
CREATE INDEX "SubfactionPloyDeny_ployId_idx" ON "SubfactionPloyDeny"("ployId");

ALTER TABLE "FactionPloy"
    ADD CONSTRAINT "FactionPloy_factionId_fkey"
    FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FactionPloy"
    ADD CONSTRAINT "FactionPloy_ployId_fkey"
    FOREIGN KEY ("ployId") REFERENCES "PloyDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubfactionPloyAllow"
    ADD CONSTRAINT "SubfactionPloyAllow_subfactionId_fkey"
    FOREIGN KEY ("subfactionId") REFERENCES "Subfaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubfactionPloyAllow"
    ADD CONSTRAINT "SubfactionPloyAllow_ployId_fkey"
    FOREIGN KEY ("ployId") REFERENCES "PloyDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubfactionPloyDeny"
    ADD CONSTRAINT "SubfactionPloyDeny_subfactionId_fkey"
    FOREIGN KEY ("subfactionId") REFERENCES "Subfaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubfactionPloyDeny"
    ADD CONSTRAINT "SubfactionPloyDeny_ployId_fkey"
    FOREIGN KEY ("ployId") REFERENCES "PloyDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
