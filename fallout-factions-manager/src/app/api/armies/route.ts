import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/prisma';
import { auth } from '@/lib/authServer';

type SubfactionDelegate = {
    findUnique(args: { where: { id: string }; select: { id: true; factionId: true } }): Promise<{ id: string; factionId: string } | null>;
};

// Uwaga: po zmianie schema.prisma trzeba uruchomić `prisma generate`.
// W edytorze mogą być stare typy, więc delegat `subfaction` może chwilowo nie istnieć w typach TS.
const pSub = prisma as unknown as { subfaction: SubfactionDelegate };

const CreateArmySchema = z.object({
    name: z.string().min(3),
    factionId: z.string(),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    // NOWE: goalSetId z frontu (opcjonalne, bo bezpieczeństwo)
    goalSetId: z.string().optional().nullable(),
    // NOWE: subfrakcja jest opcjonalna
    subfactionId: z.string().optional().nullable(),
});

async function ensureUserExists(userId: string): Promise<boolean> {
    // W normalnym flow user jest tworzony w authorize() (Credentials),
    // ale w praktyce środowiska mogą się rozjechać (inna baza w runtime vs auth).
    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (exists) return true;

    // Nie mamy wystarczających danych by stworzyć poprawnego usera (name/role),
    // więc tylko sygnalizujemy problem.
    return false;
}

export async function POST(request: NextRequest) {
    const session = await auth();
    const ownerId = session?.user?.id;
    if (!ownerId) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Guard: upewnij się, że user istnieje w tej bazie
    const userOk = await ensureUserExists(ownerId);
    if (!userOk) {
        return NextResponse.json(
            {
                error: 'OWNER_NOT_FOUND',
                details: 'Nie znaleziono użytkownika ownerId w bazie danych. Zaloguj się ponownie lub sprawdź konfigurację DATABASE_URL/APP_DATABASE_URL.',
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

    // jeżeli podano subfactionId – sprawdź, czy istnieje i należy do frakcji
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

    try {
        // Utwórz armię z aktywnym zestawem (jeśli podano)
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
    } catch (e: unknown) {
        // Prisma P2003: foreign key constraint failed
        const err = e as { code?: string };
        if (err?.code === 'P2003') {
            return NextResponse.json(
                {
                    error: 'FOREIGN_KEY_CONSTRAINT',
                    details: 'Nie udało się utworzyć armii (foreign key). Najczęściej ownerId z sesji nie istnieje w tej bazie. Sprawdź, czy backend i auth używają tej samej bazy (DATABASE_URL/APP_DATABASE_URL) i zaloguj się ponownie.',
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

    // armie które posiadasz lub masz share
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
