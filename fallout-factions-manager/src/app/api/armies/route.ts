import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/prisma';
import { auth } from '@/lib/authServer';

const CreateArmySchema = z.object({
    name: z.string().min(3),
    factionId: z.string(),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    // NOWE: goalSetId z frontu (opcjonalne, bo bezpieczeństwo)
    goalSetId: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = CreateArmySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const { name, factionId, tier, goalSetId } = parsed.data;

    // jeśli podano goalSetId – sprawdź, czy istnieje i należy do wybranej frakcji
    let activeGoalSetId: string | null = null;
    if (goalSetId) {
        const set = await prisma.factionGoalSet.findUnique({
            where: { id: goalSetId },
            select: { id: true, factionId: true },
        });
        if (!set) {
            return NextResponse.json({ error: 'GOAL_SET_NOT_FOUND' }, { status: 400 });
        }
        if (set.factionId !== factionId) {
            return NextResponse.json({ error: 'GOAL_SET_NOT_IN_FACTION' }, { status: 400 });
        }
        activeGoalSetId = set.id;
    }

    // Utwórz armię z aktywnym zestawem (jeśli podano)
    const army = await prisma.army.create({
        data: {
            name,
            factionId,
            tier,
            ownerId: session.user.id,
            activeGoalSetId, // <<<<<<<<<< tu zapisujemy
        },
        select: { id: true, activeGoalSetId: true },
    });

    // (opcjonalnie) zasiej progress = 0 dla wszystkich celów z wybranego setu
    if (army.activeGoalSetId) {
        const goals = await prisma.factionGoal.findMany({
            where: { setId: army.activeGoalSetId },
            select: { id: true },
        });
        if (goals.length) {
            await prisma.armyGoalProgress.createMany({
                data: goals.map((g) => ({ armyId: army.id, goalId: g.id, ticks: 0 })),
                skipDuplicates: true,
            });
        }
    }

    return NextResponse.json({ id: army.id }, { status: 201 });
}
