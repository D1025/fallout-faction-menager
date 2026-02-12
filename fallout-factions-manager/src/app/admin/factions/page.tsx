// app/admin/factions/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { prisma } from '@/server/prisma';
import { FactionsClient, type UIFaction } from '@/components/FactionsClient';
import { AppHeader } from '@/components/nav/AppHeader';

export default async function Page() {
    let factions: UIFaction[];
    try {
        const rows = await prisma.faction.findMany({
            include: {
                limits: true,
                goalSets: { include: { goals: true }, orderBy: { name: 'asc' } },
                upgradeRules: true,
            },
            orderBy: { name: 'asc' },
        });

        factions = rows.map((f) => ({
            id: f.id,
            name: f.name,
            limits: f.limits.map((l) => ({
                tag: l.tag,
                tier1: l.tier1 ?? null,
                tier2: l.tier2 ?? null,
                tier3: l.tier3 ?? null,
            })),
            goalSets: f.goalSets.map((gs) => ({
                id: gs.id,
                name: gs.name,
                goals: gs.goals
                    .sort((a, b) => a.tier - b.tier || a.order - b.order)
                    .map((g) => ({ id: g.id, tier: g.tier as 1 | 2 | 3, description: g.description, target: g.target, order: g.order })),
            })),
            upgradeRules: f.upgradeRules.map((r) => ({ statKey: r.statKey, ratingPerPoint: r.ratingPerPoint })),
        }));
    } catch {
        factions = [];
    }

    return (
        <div className="min-h-dvh">
            <AppHeader title="Frakcje (admin)" backHref="/admin" />
            <FactionsClient initialFactions={factions} />
        </div>
    );
}
