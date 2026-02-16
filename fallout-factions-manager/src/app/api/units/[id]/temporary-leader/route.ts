import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';

type AsyncCtx = { params: Promise<{ id: string }> };

const Body = z.object({ temporaryLeader: z.boolean() });

async function canWriteByUnitId(unitId: string, userId: string) {
    const unit = await prisma.unitInstance.findUnique({
        where: { id: unitId },
        select: { armyId: true, army: { select: { ownerId: true } } },
    });
    if (!unit) return false;
    if (unit.army.ownerId === userId) return true;
    const share = await prisma.armyShare.findFirst({
        where: { armyId: unit.armyId, userId, perm: 'WRITE' },
        select: { id: true },
    });
    return Boolean(share);
}

export async function PATCH(req: Request, ctx: AsyncCtx) {
    const { id } = await ctx.params;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = Body.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });

    const ok = await canWriteByUnitId(id, userId);
    if (!ok) return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });

    // We keep exactly one Crew Leader per army.
    // When setting true, clear the flag on all other units in the same army first.
    if (parsed.data.temporaryLeader) {
        const unit = await prisma.unitInstance.findUnique({ where: { id }, select: { armyId: true } });
        if (!unit) return new Response('NOT_FOUND', { status: 404 });

        await prisma.$transaction([
            prisma.unitInstance.updateMany({
                where: { armyId: unit.armyId, temporaryLeader: true },
                data: { temporaryLeader: false },
            }),
            prisma.unitInstance.update({ where: { id }, data: { temporaryLeader: true } }),
        ]);
    } else {
        await prisma.unitInstance.update({ where: { id }, data: { temporaryLeader: false } });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
