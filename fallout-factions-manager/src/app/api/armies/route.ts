import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/prisma';
import { auth } from '@/lib/authServer';

type SubfactionDelegate = {
    findUnique(args: { where: { id: string }; select: { id: true; factionId: true } }): Promise<{ id: string; factionId: string } | null>;
};

// Note: after schema.prisma changes, run `prisma generate`.
// Editor types may be stale, so `subfaction` delegate can temporarily be missing in TS types.
const pSub = prisma as unknown as { subfaction: SubfactionDelegate };

const CreateArmySchema = z.object({
    name: z.string().min(3),
    factionId: z.string(),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    // NEW: goalSetId from frontend (optional, for safety)
    goalSetId: z.string().optional().nullable(),
    // NEW: subfaction is optional
    subfactionId: z.string().optional().nullable(),
});

async function ensureUserExists(userId: string): Promise<boolean> {
    // In normal flow user is created in authorize() (Credentials),
    // but environments can drift in practice (different DB for runtime vs auth).
    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (exists) return true;

    // We do not have enough data to create a correct user (name/role),
    // so we only signal the problem.
    return false;
}

export async function POST(request: NextRequest) {
    const session = await auth();
    const ownerId = session?.user?.id;
    if (!ownerId) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Guard: make sure user exists in this database
    const userOk = await ensureUserExists(ownerId);
    if (!userOk) {
        return NextResponse.json(
            {
                error: 'OWNER_NOT_FOUND',
                details: 'ownerId user was not found in the database. Log in again or verify DATABASE_URL/APP_DATABASE_URL configuration.',
            },
            { status: 409 },
        );
    }

    const body = await request.json().catch(() => null);
    const parsed = CreateArmySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const { name, factionId, tier, goalSetId, subfactionId } = parsed.data;

    // if subfactionId is provided, verify it exists and belongs to faction
    let finalSubfactionId: string | null = null;
    if (subfactionId) {
        const sf = await pSub.subfaction.findUnique({
            where: { id: subfactionId },
            select: { id: true, factionId: true },
        });
        if (!sf) {
            return NextResponse.json({ error: 'SUBFACTION_NOT_FOUND' }, { status: 400 });
        }
        if (sf.factionId !== factionId) {
            return NextResponse.json({ error: 'SUBFACTION_NOT_IN_FACTION' }, { status: 400 });
        }
        finalSubfactionId = sf.id;
    }

    // if goalSetId is provided, verify it exists and belongs to selected faction
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

    try {
        // Create army with active goal set (if provided)
        const army = await (prisma as unknown as { army: { create: (args: unknown) => Promise<{ id: string; activeGoalSetId: string | null }> } }).army.create({
            data: {
                name,
                factionId,
                tier,
                ownerId,
                activeGoalSetId,
                subfactionId: finalSubfactionId,
            },
            select: { id: true, activeGoalSetId: true },
        });

        // (optional) seed progress = 0 for all goals in selected set
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
    } catch (e: unknown) {
        // Prisma P2003: foreign key constraint failed
        const err = e as { code?: string };
        if (err?.code === 'P2003') {
            return NextResponse.json(
                {
                    error: 'FOREIGN_KEY_CONSTRAINT',
                    details: 'Failed to create army (foreign key). Most often the ownerId from session does not exist in this database. Verify backend/auth use the same database (DATABASE_URL/APP_DATABASE_URL) and log in again.',
                },
                { status: 409 },
            );
        }
        throw e;
    }
}

export async function GET() {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    // armies you own or that are shared with you
    const owned = await prisma.army.findMany({
        where: { ownerId: userId },
        select: { id: true, name: true, factionId: true, tier: true, activeGoalSetId: true },
        orderBy: { name: 'asc' },
    });

    const shared = await prisma.armyShare.findMany({
        where: { userId },
        select: { armyId: true, perm: true },
    });

    return NextResponse.json({ owned, shared }, { status: 200 });
}
