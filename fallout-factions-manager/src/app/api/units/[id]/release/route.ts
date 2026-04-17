import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';
type AsyncCtx = { params: Promise<{ id: string }> };
const p = prisma as unknown as {
    unitInstance: {
        findUnique: (args: unknown) => Promise<unknown>;
        update: (args: unknown) => Promise<unknown>;
    };
};

async function canWriteByArmyId(armyId: string, userId: string): Promise<boolean> {
    const army = await prisma.army.findUnique({
        where: { id: armyId },
        select: { ownerId: true },
    });
    if (!army) return false;
    if (army.ownerId === userId) return true;
    const share = await prisma.armyShare.findFirst({
        where: { armyId, userId, perm: 'WRITE' },
        select: { id: true },
    });
    return Boolean(share);
}

export async function POST(_req: Request, ctx: AsyncCtx) {
    const { id: unitId } = await ctx.params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const unit = await p.unitInstance.findUnique({
        where: { id: unitId },
        select: { id: true, capturedByArmyId: true },
    }) as { id: string; capturedByArmyId: string | null } | null;
    if (!unit) return new Response('NOT_FOUND', { status: 404 });
    if (!unit.capturedByArmyId) {
        return new Response(JSON.stringify({ error: 'UNIT_IS_NOT_CAPTURED' }), { status: 400 });
    }

    const canRelease = await canWriteByArmyId(unit.capturedByArmyId, userId);
    if (!canRelease) return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });

    await p.unitInstance.update({
        where: { id: unitId },
        data: {
            capturedByArmyId: null,
            capturedAt: null,
        },
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
