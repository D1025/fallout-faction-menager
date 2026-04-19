import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';

type AsyncCtx = { params: Promise<{ id: string }> };

type ArmyAccessRow = {
    id: string;
    ownerId: string;
    deleted: boolean;
};

async function getArmyAccessRow(armyId: string): Promise<ArmyAccessRow | null> {
    return (await prisma.army.findUnique({
        where: { id: armyId },
        select: { id: true, ownerId: true, deleted: true },
    })) as ArmyAccessRow | null;
}

export async function DELETE(_req: Request, ctx: AsyncCtx) {
    const { id: armyId } = await ctx.params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const army = await getArmyAccessRow(armyId);
    if (!army || army.deleted) return new Response('NOT_FOUND', { status: 404 });
    if (army.ownerId !== userId) return new Response('FORBIDDEN', { status: 403 });

    await prisma.$transaction([
        prisma.army.update({
            where: { id: armyId },
            data: { deleted: true },
        }),
        prisma.armyPublicShare.updateMany({
            where: { armyId, enabled: true },
            data: { enabled: false },
        }),
    ]);

    return new Response(JSON.stringify({ ok: true, deleted: true }), { status: 200 });
}
