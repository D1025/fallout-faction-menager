export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { prisma } from '@/server/prisma';
import { ArmyDashboardClient } from '@/components/army/ArmyDashboardClient';

type Kind = 'caps' | 'parts' | 'reach';
function isKind(x: string): x is Kind {
    return x === 'caps' || x === 'parts' || x === 'reach';
}

export default async function Page({
                                       params,
                                   }: {
    params: Promise<{ armyId: string }>;
}) {
    const { armyId } = await params;

    const army = await prisma.army.findUnique({
        where: { id: armyId },
        include: {
            faction: { include: { limits: true } },
            units: { include: { weapons: true, upgrades: true }, orderBy: { id: 'asc' } },
            changes: { take: 20, orderBy: { at: 'desc' } },
        },
    });

    if (!army) return <div className="p-4 text-red-300">Nie znaleziono armii.</div>;

    // placeholderowy rating – podmień na lib/rules/rating.ts
    const rating =
        army.units.length * 100 +
        army.units.reduce((sum, u) => sum + u.weapons.length * 10 + u.upgrades.length * 5, 0);

    // Zasoby – bez any, z wąskim typem Kind
    const totals = army.changes.reduce<Record<Kind, number>>((acc, c) => {
        if (isKind(c.kind)) acc[c.kind] += c.delta;
        return acc;
    }, { caps: 0, parts: 0, reach: 0 });

    return (
        <ArmyDashboardClient
            armyId={army.id}
            armyName={army.name}
            factionName={army.faction.name}
            tier={army.tier}
            rating={rating}
            limits={army.faction.limits.map(l => ({
                tag: l.tag,
                tier1: l.tier1 ?? null,
                tier2: l.tier2 ?? null,
                tier3: l.tier3 ?? null,
            }))}
            resources={totals}
            unitsCount={army.units.length}
        />
    );
}
