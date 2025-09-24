import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';

type AsyncCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: AsyncCtx) {
    const { id } = await ctx.params;

    const army = await prisma.army.findUnique({
        where: { id },
        select: {
            id: true,
            tier: true,
            activeGoalSetId: true,
            activeGoalSet: {
                select: {
                    id: true,
                    name: true,
                    goals: {
                        select: { id: true, tier: true, description: true, target: true, order: true },
                        orderBy: { order: 'asc' },
                    },
                },
            },
        },
    });
    if (!army) return new Response('NOT_FOUND', { status: 404 });

    if (!army.activeGoalSet) {
        return new Response(JSON.stringify({
            armyId: army.id,
            currentTier: army.tier,
            set: null,
            goals: [],
        }), { status: 200 });
    }

    const prog = await prisma.armyGoalProgress.findMany({
        where: { armyId: army.id },
        select: { goalId: true, ticks: true },
    });
    const ticksMap = new Map(prog.map(p => [p.goalId, p.ticks]));

    const goals = army.activeGoalSet.goals.map(g => ({
        id: g.id,
        tier: g.tier,
        description: g.description,
        target: g.target,
        order: g.order,
        ticks: ticksMap.get(g.id) ?? 0,
    }));

    return new Response(JSON.stringify({
        armyId: army.id,
        currentTier: army.tier,
        set: { id: army.activeGoalSet.id, name: army.activeGoalSet.name },
        goals,
    }), { status: 200 });
}
