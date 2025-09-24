// src/app/factions/page.tsx
export const dynamic = 'force-dynamic'; // nie generuj w czasie builda
export const revalidate = 0;

import { prisma } from '@/server/prisma';
import { FactionsClient, type Faction as UIFaction } from '@/components/FactionsClient';

export default async function Page() {
    // Pobierz frakcje + limity z DB; w razie błędu pokaż pustą listę (UI się załaduje)
    let factions: UIFaction[] = [];
    try {
        const rows = await prisma.faction.findMany({
            include: { limits: true },
            orderBy: { name: 'asc' },
        });

        // Mapowanie do typu używanego przez UI
        factions = rows.map((f) => ({
            id: f.id,
            name: f.name,
            limits: f.limits.map((l) => ({
                tag: l.tag,
                tier1: l.tier1 ?? null,
                tier2: l.tier2 ?? null,
                tier3: l.tier3 ?? null,
            })),
            // wymagane przez typ Faction w FactionsClient:
            goalSets: [],
            upgradeRules: [],
        }));
    } catch {
        factions = [];
    }

    return <FactionsClient initialFactions={factions} />;
}
