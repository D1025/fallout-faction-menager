import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';
type AsyncCtx = { params: Promise<{ id: string }> };

const BodySchema = z.object({
    action: z.literal('advance'),
});

async function canWrite(armyId: string, userId: string) {
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
    const { id: armyId } = await ctx.params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'VALIDATION' }), { status: 400 });
    }

    if (!(await canWrite(armyId, userId))) {
        return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });
    }

    const army = await prisma.army.findUnique({
        where: { id: armyId },
        select: {
            id: true,
            tier: true,
            activeGoalSetId: true,
            activeGoalSet: {
                select: {
                    goals: {
                        select: { id: true, tier: true, target: true },
                    },
                },
            },
        },
    });
    if (!army) return new Response('NOT_FOUND', { status: 404 });
    if (!army.activeGoalSetId) {
        return new Response(JSON.stringify({ error: 'NO_ACTIVE_SET' }), { status: 400 });
    }

    const currentTier = army.tier;
    const goalsThisTier = (army.activeGoalSet?.goals ?? []).filter(g => g.tier === currentTier);
    // If there are no goals for this tier, allow advancement.
    if (goalsThisTier.length > 0) {
        const prog = await prisma.armyGoalProgress.findMany({
            where: { armyId },
            select: { goalId: true, ticks: true },
        });
        const map = new Map(prog.map(p => [p.goalId, p.ticks]));
        const allDone = goalsThisTier.every(g => (map.get(g.id) ?? 0) >= g.target);
        if (!allDone) {
            return new Response(JSON.stringify({ error: 'TIER_NOT_COMPLETED' }), { status: 400 });
        }
    }

    const updated = await prisma.army.update({
        where: { id: armyId },
        data: { tier: currentTier + 1 },
        select: { id: true, tier: true },
    });

    return new Response(JSON.stringify(updated), { status: 200 });
}
