// src/app/army/[armyId]/unit/[unitId]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { prisma } from '@/server/prisma';
import { UnitClient } from '@/components/army/UnitClient';

export default async function Page({
                                       params,
                                   }: {
    params: Promise<{ armyId: string; unitId: string }>;
}) {
    const { armyId, unitId } = await params;

    const unit = await prisma.unitInstance.findUnique({
        where: { id: unitId },
        include: { weapons: true, upgrades: true, army: true },
    });

    if (!unit || unit.armyId !== armyId) {
        return <div className="p-4 text-red-300">Nie znaleziono jednostki.</div>;
    }

    // Placeholder SPECIAL — docelowo licz z template + upgrades
    const special: Record<'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L', number> = {
        S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5,
    };

    return (
        <UnitClient
            armyId={armyId}
            unitId={unit.id}
            name={unit.id.slice(0, 6)} // TODO: podmień na nazwę z UnitTemplate, gdy dodasz relację
            wounds={unit.wounds}
            present={unit.present}
            weapons={unit.weapons.map((w) => ({
                id: w.id,
                templateId: w.templateId,
                mods: w.activeMods,
            }))}
            upgradesCount={unit.upgrades.length}
            special={special}
            photoPath={unit.photoPath ?? null}
        />
    );
}
