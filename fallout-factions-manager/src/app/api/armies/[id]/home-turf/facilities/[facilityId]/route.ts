import { prisma } from '@/server/prisma';
import { auth } from '@/lib/authServer';

export const runtime = 'nodejs';
type AsyncCtx = { params: Promise<{ id: string; facilityId: string }> };

async function canWrite(armyId: string, userId: string) {
    const army = await prisma.army.findUnique({ where: { id: armyId }, select: { ownerId: true } });
    if (!army) return false;
    if (army.ownerId === userId) return true;
    const share = await prisma.armyShare.findFirst({
        where: { armyId, userId, perm: 'WRITE' },
        select: { id: true },
    });
    return Boolean(share);
}

export async function DELETE(_req: Request, ctx: AsyncCtx) {
    const { id, facilityId } = await ctx.params;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });
    if (!(await canWrite(id, userId))) return new Response('FORBIDDEN', { status: 403 });

    const fac = await prisma.homeFacility.findUnique({
        where: { id: facilityId },
        include: { turf: true },
    });
    if (!fac) return new Response('NOT_FOUND', { status: 404 });
    if (fac.turf.armyId !== id) return new Response('FORBIDDEN', { status: 403 });

    await prisma.homeFacility.delete({ where: { id: facilityId } });
    return new Response(null, { status: 204 });
}
