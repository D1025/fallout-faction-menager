export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { prisma } from '@/server/prisma';
import { ResourcesClient } from '@/components/army/ResourcesClient';

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
        include: { changes: { orderBy: { at: 'desc' }, take: 50 } },
    });
    if (!army) return <div className="p-4 text-red-300">Nie znaleziono armii.</div>;

    const totals = army.changes.reduce<Record<Kind, number>>((acc, c) => {
        if (isKind(c.kind)) acc[c.kind] += c.delta;
        return acc;
    }, { caps: 0, parts: 0, reach: 0 });

    return (
        <ResourcesClient
            armyId={army.id}
            armyName={army.name}
            totals={totals}
            history={army.changes.map(c => ({
                id: c.id,
                kind: isKind(c.kind) ? c.kind : 'caps',
                delta: c.delta,
                at: c.at.toISOString(),
                note: c.note ?? '',
            }))}
        />
    );
}
