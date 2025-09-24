import { auth } from '@/lib/authServer';
import { prisma } from '@/server/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';
type AsyncCtx = { params: Promise<{ id: string; goalId: string }> };

const BodySchema = z.object({
    ticks: z.number().int().min(0),
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
    const { id: armyId, goalId } = await ctx.params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'VALIDATION', details: parsed.error.flatten() }), { status: 400 });
    }

    if (!(await canWrite(armyId, userId))) {
        return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });
    }

    // upewnij się, że goal należy do aktywnego setu tej armii
    const army = await prisma.army.findUnique({
        where: { id: armyId },
        select: { activeGoalSetId: true },
    });
    if (!army?.activeGoalSetId) return new Response(JSON.stringify({ error: 'NO_ACTIVE_SET' }), { status: 400 });

    const goal = await prisma.factionGoal.findUnique({
        where: { id: goalId },
        select: { id: true, setId: true, target: true },
    });
    if (!goal || goal.setId !== army.activeGoalSetId) {
        return new Response(JSON.stringify({ error: 'GOAL_NOT_IN_ACTIVE_SET' }), { status: 400 });
    }

    const clamped = Math.max(0, Math.min(goal.target, parsed.data.ticks));

    const up = await prisma.armyGoalProgress.upsert({
        where: { armyId_goalId: { armyId, goalId } },
        update: { ticks: clamped },
        create: { armyId, goalId, ticks: clamped },
        select: { goalId: true, ticks: true },
    });

    return new Response(JSON.stringify(up), { status: 200 });
}
