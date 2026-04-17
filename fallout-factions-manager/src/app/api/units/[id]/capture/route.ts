import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';
type AsyncCtx = { params: Promise<{ id: string }> };
const p = prisma as unknown as {
    unitInstance: {
        findUnique: (args: unknown) => Promise<unknown>;
        update: (args: unknown) => Promise<unknown>;
    };
};

const BodySchema = z.object({
    capturedByArmyId: z.string().min(1).nullable(),
});

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

export async function PATCH(req: Request, ctx: AsyncCtx) {
    const { id: unitId } = await ctx.params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'VALIDATION', details: parsed.error.flatten() }), { status: 400 });
    }

    const unit = await p.unitInstance.findUnique({
        where: { id: unitId },
        select: { id: true, armyId: true },
    }) as { id: string; armyId: string } | null;
    if (!unit) return new Response('NOT_FOUND', { status: 404 });

    const canWriteOwnerArmy = await canWriteByArmyId(unit.armyId, userId);
    if (!canWriteOwnerArmy) return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });

    const { capturedByArmyId } = parsed.data;
    if (!capturedByArmyId) {
        await p.unitInstance.update({
            where: { id: unitId },
            data: {
                capturedByArmyId: null,
                capturedAt: null,
            },
        });
        return new Response(JSON.stringify({ ok: true, capturedByArmyId: null, capturedAt: null }), { status: 200 });
    }

    if (capturedByArmyId === unit.armyId) {
        return new Response(JSON.stringify({ error: 'CANNOT_CAPTURE_TO_OWNER_ARMY' }), { status: 400 });
    }

    const sharedTarget = await prisma.armyShare.findFirst({
        where: { userId, armyId: capturedByArmyId },
        select: { id: true },
    });
    if (!sharedTarget) {
        return new Response(JSON.stringify({ error: 'TARGET_ARMY_NOT_AVAILABLE_IN_SHARED_LIST' }), { status: 400 });
    }

    const now = new Date();
    await p.unitInstance.update({
        where: { id: unitId },
        data: {
            capturedByArmyId,
            capturedAt: now,
        },
    });

    return new Response(JSON.stringify({ ok: true, capturedByArmyId, capturedAt: now.toISOString() }), { status: 200 });
}
