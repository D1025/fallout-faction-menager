import { auth } from '@/lib/authServer';
import { isZetansFactionName } from '@/lib/rules/trainingTable';
import { prisma } from '@/server/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export const runtime = 'nodejs';

// dopasowane do nazwy folderu: [id]
type Ctx = { params: Promise<{ id: string }> };

const p = prisma as unknown as {
    unitInstance: {
        findUnique: (args: unknown) => Promise<unknown>;
    };
    armyShare: {
        findFirst: (args: unknown) => Promise<unknown>;
    };
    armyPlayed: {
        findMany: (args: unknown) => Promise<unknown[]>;
    };
    statUpgrade: {
        create: (args: unknown) => Promise<unknown>;
    };
};

const Input = z.object({
    statKey: z.enum(['S', 'P', 'E', 'C', 'I', 'A', 'L', 'hp']),
    delta: z.number().int(),
    trainingArmyId: z.string().min(1).optional().nullable(),
});

type UnitWriteContext = {
    id: string;
    armyId: string;
    army: {
        ownerId: string;
        factionId: string;
        faction: { name: string };
    };
};

async function getUnitWriteContext(unitId: string): Promise<UnitWriteContext | null> {
    const u = await p.unitInstance.findUnique({
        where: { id: unitId },
        select: {
            id: true,
            armyId: true,
            army: {
                select: {
                    ownerId: true,
                    factionId: true,
                    faction: { select: { name: true } },
                },
            },
        },
    });
    return (u as UnitWriteContext | null) ?? null;
}

async function canWriteArmy(armyId: string, userId: string): Promise<boolean> {
    const share = await p.armyShare.findFirst({
        where: { armyId, userId, perm: 'WRITE' },
        select: { id: true },
    });
    return Boolean(share);
}

export async function POST(req: Request, ctx: Ctx) {
    const { id } = await ctx.params;
    const unitId = id;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response('UNAUTHORIZED', { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = Input.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
    }

    const unit = await getUnitWriteContext(unitId);
    if (!unit) return new Response('NOT_FOUND', { status: 404 });

    const isOwner = unit.army.ownerId === userId;
    const canWrite = isOwner || (await canWriteArmy(unit.armyId, userId));
    if (!canWrite) return new Response('FORBIDDEN', { status: 403 });

    let trainingArmyId: string | null = parsed.data.trainingArmyId ?? null;
    let trainingFactionId: string | null = null;

    const isZetansArmy = isZetansFactionName(unit.army.faction.name);
    if (!isZetansArmy && trainingArmyId) {
        return new Response('TRAINING_SOURCE_ONLY_FOR_ZETANS', { status: 400 });
    }

    if (isZetansArmy && parsed.data.delta > 0) {
        const playedRows = await p.armyPlayed.findMany({
            where: { armyId: unit.armyId, boxesChecked: { gt: 0 } },
            include: {
                opponentArmy: {
                    select: {
                        id: true,
                        factionId: true,
                        faction: { select: { name: true } },
                    },
                },
            },
            orderBy: { updatedAt: 'desc' },
        }) as Array<{
            opponentArmy: {
                id: string;
                factionId: string;
                faction: { name: string };
            };
        }>;

        const validSources = playedRows.filter(
            (row) => !isZetansFactionName(row.opponentArmy.faction.name),
        );

        if (validSources.length > 0) {
            if (!trainingArmyId) {
                return new Response('TRAINING_SOURCE_REQUIRED_FOR_ZETANS', { status: 400 });
            }
            const selected = validSources.find((row) => row.opponentArmy.id === trainingArmyId);
            if (!selected) {
                return new Response('INVALID_TRAINING_SOURCE_ARMY', { status: 400 });
            }
            trainingFactionId = selected.opponentArmy.factionId;
        } else {
            trainingArmyId = null;
            trainingFactionId = null;
        }
    } else {
        trainingArmyId = null;
        trainingFactionId = null;
    }

    const created = await p.statUpgrade.create({
        data: {
            unitId,
            statKey: parsed.data.statKey,
            delta: parsed.data.delta,
            trainingArmyId,
            trainingFactionId,
        },
    }) as {
        id: string;
        statKey: string;
        delta: number;
        at: Date;
        trainingArmyId?: string | null;
        trainingFactionId?: string | null;
    };
    if (unit.armyId) {
        revalidatePath(`/army/${unit.armyId}`);
        revalidatePath(`/army/${unit.armyId}/unit/${unitId}`);
    }

    return new Response(
        JSON.stringify({
            id: created.id,
            statKey: created.statKey,
            delta: created.delta,
            trainingArmyId: created.trainingArmyId ?? null,
            trainingFactionId: created.trainingFactionId ?? null,
            at: created.at,
        }),
        { status: 201 },
    );
}
