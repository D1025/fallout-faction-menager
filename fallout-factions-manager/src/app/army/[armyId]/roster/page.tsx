export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { prisma } from '@/server/prisma';
import { RosterClient } from '@/components/army/RosterClient';

export default async function Page({
                                       params,
                                   }: {
    params: Promise<{ armyId: string }>;
}) {
    const { armyId } = await params;

    const army = await prisma.army.findUnique({
        where: { id: armyId },
        include: {
            faction: true,
            units: { include: { weapons: true, upgrades: true }, orderBy: { id: 'asc' } },
        },
    });

    if (!army) return <div className="p-4 text-red-300">Nie znaleziono armii.</div>;

    const rows = army.units.map((u) => ({
        id: u.id,
        name: u.id.slice(0, 6), // TODO: podmień na nazwę z UnitTemplate
        wounds: u.wounds,
        present: u.present,
        weaponsCount: u.weapons.length,
        upgradesCount: u.upgrades.length,
        photoPath: u.photoPath ?? null,
    }));

    return <RosterClient armyId={army.id} armyName={army.name} units={rows} />;
}
