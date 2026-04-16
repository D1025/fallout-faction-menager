import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';

type AsyncCtx = { params: Promise<{ id: string }> };

const BodySchema = z.object({
    unitIds: z.array(z.string().min(1)).min(1),
});

async function userHasWriteAccess(armyId: string, userId: string): Promise<boolean> {
    const army = await prisma.army.findUnique({ where: { id: armyId }, select: { ownerId: true } });
    if (!army) return false;
    if (army.ownerId === userId) return true;

    const share = await prisma.armyShare.findFirst({
        where: { armyId, userId, perm: 'WRITE' },
        select: { id: true },
    });
    return Boolean(share);
}

export async function PATCH(req: Request, ctx: AsyncCtx) {
    const { id: armyId } = await ctx.params;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'VALIDATION', details: parsed.error.flatten() }), { status: 400 });
    }

    const canWrite = await userHasWriteAccess(armyId, userId);
    if (!canWrite) return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });

    const payloadIds = parsed.data.unitIds;
    const uniquePayloadIds = new Set(payloadIds);
    if (uniquePayloadIds.size !== payloadIds.length) {
        return new Response(JSON.stringify({ error: 'DUPLICATE_UNIT_IDS' }), { status: 400 });
    }

    const existing = await prisma.unitInstance.findMany({
        where: { armyId },
        select: { id: true },
    });

    const existingIds = existing.map((u) => u.id);
    if (existingIds.length !== payloadIds.length) {
        return new Response(JSON.stringify({ error: 'UNIT_LIST_MISMATCH' }), { status: 400 });
    }

    const existingSet = new Set(existingIds);
    const valid = payloadIds.every((id) => existingSet.has(id));
    if (!valid) {
        return new Response(JSON.stringify({ error: 'UNIT_LIST_MISMATCH' }), { status: 400 });
    }

    await prisma.$transaction(
        payloadIds.map((unitId, index) =>
            prisma.unitInstance.update({
                where: { id: unitId },
                data: { displayOrder: index },
            }),
        ),
    );

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
