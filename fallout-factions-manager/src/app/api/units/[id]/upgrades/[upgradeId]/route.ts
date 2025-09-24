import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';

// dopasowane do nazw folderów: [id]/upgrades/[upgradeId]
type Ctx = { params: Promise<{ id: string; upgradeId: string }> };

async function canWriteByUnit(unitId: string, userId: string) {
    const u = await prisma.unitInstance.findUnique({
        where: { id: unitId },
        include: { army: true },
    });
    if (!u) return false;
    if (u.army.ownerId === userId) return true;
    const share = await prisma.armyShare.findFirst({
        where: { armyId: u.armyId, userId, perm: 'WRITE' },
        select: { id: true },
    });
    return Boolean(share);
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const { id, upgradeId } = await ctx.params;
    const unitId = id;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const upg = await prisma.statUpgrade.findUnique({ where: { id: upgradeId } });
    if (!upg || upg.unitId !== unitId) return new Response('NOT_FOUND', { status: 404 });

    const ok = await canWriteByUnit(unitId, userId);
    if (!ok) return new Response('FORBIDDEN', { status: 403 });

    await prisma.statUpgrade.delete({ where: { id: upgradeId } });
    return new Response(null, { status: 204 });
}
