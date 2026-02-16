// src/app/factions/page.tsx
export const dynamic = 'force-dynamic'; // do not generate at build time
export const revalidate = 0;

import { prisma } from '@/server/prisma';
import { FactionsClient, type Faction as UIFaction } from '@/components/FactionsClient';
import { MobilePageShell } from '@/components/ui/antd/MobilePageShell';

export default async function Page() {
    // Fetch factions + limits from DB; on error return an empty list (UI still loads)
    let factions: UIFaction[];
    try {
        const rows = await prisma.faction.findMany({
            include: { limits: true },
            orderBy: { name: 'asc' },
        });

        // Map to UI type
        factions = rows.map((f) => ({
            id: f.id,
            name: f.name,
            limits: f.limits.map((l) => ({
                tag: l.tag,
                tier1: l.tier1 ?? null,
                tier2: l.tier2 ?? null,
                tier3: l.tier3 ?? null,
            })),
            // required by Faction type in FactionsClient:
            goalSets: [],
            upgradeRules: [],
        }));
    } catch {
        factions = [];
    }

    return (
        <MobilePageShell title="Factions" backHref="/">
            <FactionsClient initialFactions={factions} />
        </MobilePageShell>
    );
}
