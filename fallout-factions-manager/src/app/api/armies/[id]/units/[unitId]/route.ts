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
        const unit = await prisma.unitInstance.findFirst({
            where: { id: unitId, armyId },
            select: { id: true },
        });
        if (!unit) {
            return NextResponse.json(
                { error: 'Army or unit not found (or unit not in this army).' },
                { status: 404 }
            );
        }

        // 2) Remove dependencies in a transaction, then delete the unit.
        await prisma.$transaction([
            prisma.weaponInstance.deleteMany({ where: { unitId } }),
            prisma.statUpgrade.deleteMany({ where: { unitId } }),
            prisma.unitInstance.delete({ where: { id: unitId } }),
        ]);

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('DELETE /api/armies/[id]/units/[unitId] failed:', err);
        return NextResponse.json({ error: 'Failed to delete unit.' }, { status: 500 });
    }
}
