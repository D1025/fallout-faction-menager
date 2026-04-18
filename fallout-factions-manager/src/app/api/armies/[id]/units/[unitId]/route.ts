/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';

// Note: Next.js requires the second route handler argument to be typed as `any`,
// otherwise it may throw an "invalid DELETE export" error.
export async function DELETE(_req: Request, { params }: any) {
    const armyId: string = params.id;
    const unitId: string = params.unitId;

    try {
        // 1) Validate that the unit exists and belongs to this army.
        const unit = (await prisma.unitInstance.findFirst(({
            where: { id: unitId, armyId },
            select: {
                id: true,
                companionOwnerId: true,
                companionUnits: { select: { id: true } },
            },
        }) as unknown as Parameters<typeof prisma.unitInstance.findFirst>[0])) as unknown as
            | {
                  id: string;
                  companionOwnerId: string | null;
                  companionUnits: Array<{ id: string }>;
              }
            | null;
        if (!unit) {
            return NextResponse.json(
                { error: 'Army or unit not found (or unit not in this army).' },
                { status: 404 }
            );
        }

        const idsToDelete = new Set<string>([unit.id]);
        // Deleting Champion removes its linked Companions as well.
        if (!unit.companionOwnerId) {
            for (const c of unit.companionUnits) idsToDelete.add(c.id);
        }
        const targetIds = [...idsToDelete];

        // 2) Remove dependencies in a transaction, then delete unit(s).
        await prisma.$transaction(async (tx) => {
            // If a linked Companion is removed directly, remove companion perk bonus from owner.
            if (unit.companionOwnerId) {
                await tx.unitChosenPerk.deleteMany({
                    where: {
                        unitId: unit.companionOwnerId,
                        perk: { behavior: { in: ['COMPANION_ROBOT', 'COMPANION_BEAST'] } },
                    },
                });
            }

            await tx.weaponInstance.deleteMany({ where: { unitId: { in: targetIds } } });
            await tx.statUpgrade.deleteMany({ where: { unitId: { in: targetIds } } });
            await tx.unitInstance.deleteMany({ where: { id: { in: targetIds } } });
        });

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('DELETE /api/armies/[id]/units/[unitId] failed:', err);
        return NextResponse.json({ error: 'Failed to delete unit.' }, { status: 500 });
    }
}
